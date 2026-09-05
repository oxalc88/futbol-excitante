import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { digestRepositoryFiles, pathExistsAsFile } from "./digest.js";
import { RUNTIME_POLICY } from "./policy.js";

export const MEMORY_TYPES = ["architecture", "decision", "pattern", "discovery", "bugfix", "configuration"] as const;
export const MEMORY_STATUSES = ["proposed", "active", "needs_review", "superseded"] as const;
export type MemoryType = typeof MEMORY_TYPES[number];
export type MemoryStatus = typeof MEMORY_STATUSES[number];

export interface MemoryTopic {
  schemaVersion: number;
  topicKey: string;
  type: MemoryType;
  status: MemoryStatus;
  summary: string;
  canonicalRefs: string[];
  evidence: string[];
  supersedes: string[];
  supersededBy: string;
  sourceDigest: string;
  updatedAt: string;
  body: string;
  path: string;
}

export interface MemoryIssue {
  code: string;
  path: string;
  detail: string;
}

const TOPIC_DIRECTORIES = new Set(["architecture", "decisions", "patterns", "discoveries", "bugfixes", "configuration"]);
const FORBIDDEN_CONTENT = [
  { code: "RAW_TRANSCRIPT", pattern: /\b(raw\s+)?transcript\b|session\s+history/i },
  { code: "RAW_PROMPT", pattern: /\braw\s+prompt\b|chain[- ]of[- ]thought/i },
  { code: "RAW_LOG", pattern: /\braw\s+(provider\s+)?logs?\b/i },
  { code: "CREDENTIAL", pattern: /(?:api[_-]?key|secret|password|bearer\s+[a-z0-9._-]+)\s*[:=]/i },
  { code: "AUTHORITY_CLAIM", pattern: /memory\s+(?:is|remains|acts\s+as)\s+(?:the\s+)?(?:authoritative|source\s+of\s+truth)|memory\s+overrides?/i },
] as const;

function scalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) as string; } catch { return trimmed.slice(1, -1); }
  }
  return trimmed.replace(/^'|'$/g, "");
}

function parseList(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed === "[]") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try { return JSON.parse(trimmed.replace(/'/g, '"')) as string[]; } catch { return []; }
  }
  return [];
}

export function parseMemoryTopic(content: string, relativePath: string): MemoryTopic {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter");
  const values = new Map<string, string | string[]>();
  let listKey: string | null = null;
  for (const line of match[1]!.split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      const list = values.get(listKey);
      if (Array.isArray(list)) list.push(scalar(item[1]!));
      continue;
    }
    const field = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!field) continue;
    const [, key, rawValue] = field;
    if (rawValue === "") {
      values.set(key!, []);
      listKey = key!;
    } else {
      const list = parseList(rawValue!);
      values.set(key!, rawValue!.trim().startsWith("[") ? list : scalar(rawValue!));
      listKey = null;
    }
  }
  const getString = (key: string): string => typeof values.get(key) === "string" ? values.get(key) as string : "";
  const getList = (key: string): string[] => Array.isArray(values.get(key)) ? values.get(key) as string[] : [];
  return {
    schemaVersion: Number(getString("schema_version")),
    topicKey: getString("topic_key"),
    type: getString("type") as MemoryType,
    status: getString("status") as MemoryStatus,
    summary: getString("summary"),
    canonicalRefs: getList("canonical_refs"),
    evidence: getList("evidence"),
    supersedes: getList("supersedes"),
    supersededBy: getString("superseded_by"),
    sourceDigest: getString("source_digest"),
    updatedAt: getString("updated_at"),
    body: match[2]!.trim(),
    path: relativePath,
  };
}

async function topicFiles(repoRoot: string): Promise<string[]> {
  const memoryRoot = path.join(repoRoot, "memory");
  const files: string[] = [];
  for (const directory of [...TOPIC_DIRECTORIES].sort()) {
    let names: string[] = [];
    try { names = await readdir(path.join(memoryRoot, directory)); } catch { continue; }
    for (const name of names.sort()) if (name.endsWith(".md")) files.push(path.posix.join("memory", directory, name));
  }
  return files;
}

export async function loadMemoryTopics(repoRoot: string): Promise<{ topics: MemoryTopic[]; issues: MemoryIssue[] }> {
  const topics: MemoryTopic[] = [];
  const issues: MemoryIssue[] = [];
  for (const relativePath of await topicFiles(repoRoot)) {
    try {
      topics.push(parseMemoryTopic(await readFile(path.join(repoRoot, relativePath), "utf8"), relativePath));
    } catch (error) {
      issues.push({ code: "INVALID_FRONTMATTER", path: relativePath, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  return { topics, issues };
}

export async function validateMemory(repoRoot: string): Promise<{
  valid: boolean;
  topics: number;
  issues: MemoryIssue[];
  needsReview: string[];
}> {
  const loaded = await loadMemoryTopics(repoRoot);
  const issues = [...loaded.issues];
  const needsReview = new Set<string>();
  const byKey = new Map<string, MemoryTopic[]>();
  const activeKnowledge = new Map<string, string>();
  for (const topic of loaded.topics) {
    const add = (code: string, detail: string): void => { issues.push({ code, path: topic.path, detail }); };
    if (topic.schemaVersion !== 1) add("SCHEMA_VERSION", "schema_version must be 1");
    if (!topic.topicKey) add("TOPIC_KEY", "topic_key is required");
    if (!MEMORY_TYPES.includes(topic.type)) add("TYPE", `invalid type: ${topic.type}`);
    if (!MEMORY_STATUSES.includes(topic.status)) add("STATUS", `invalid status: ${topic.status}`);
    if (!topic.summary || topic.summary.length > RUNTIME_POLICY.memory.summary_max_characters) add("SUMMARY_BOUNDS", "summary is empty or too large");
    if (topic.body.length > RUNTIME_POLICY.memory.body_max_characters) add("BODY_BOUNDS", "body is too large");
    if (!/^sha256:[a-f0-9]{64}$/.test(topic.sourceDigest)) add("SOURCE_DIGEST_FORMAT", "source_digest must be sha256:<64 lowercase hex>");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(topic.updatedAt)) add("UPDATED_AT", "updated_at must be YYYY-MM-DD");
    if (topic.canonicalRefs.length === 0) add("CANONICAL_REFS", "at least one canonical reference is required");
    for (const reference of topic.canonicalRefs) if (!(await pathExistsAsFile(repoRoot, reference))) add("MISSING_CANONICAL_REF", reference);
    if (topic.status === "active" && topic.evidence.length === 0) add("EVIDENCE_REQUIRED", "active topics require evidence paths");
    for (const evidence of topic.evidence) if (!(await pathExistsAsFile(repoRoot, evidence))) add("MISSING_EVIDENCE", evidence);
    if (topic.status === "superseded" && !topic.supersededBy) add("SUPERSESSION_REPLACEMENT", "superseded topics must identify superseded_by");
    for (const forbidden of FORBIDDEN_CONTENT) if (forbidden.pattern.test(`${topic.summary}\n${topic.body}`)) add(forbidden.code, "forbidden memory content");

    if (topic.canonicalRefs.length > 0) {
      try {
        const actual = await digestRepositoryFiles(repoRoot, topic.canonicalRefs);
        if (actual !== topic.sourceDigest) {
          needsReview.add(topic.topicKey);
          if (topic.status !== "needs_review") add("SOURCE_DIGEST_STALE", "canonical source changed; mark topic needs_review and review manually");
        }
      } catch {
        // Missing references already have a precise issue.
      }
    }
    const existing = byKey.get(topic.topicKey) ?? [];
    existing.push(topic);
    byKey.set(topic.topicKey, existing);
    if (topic.status === "active") {
      const identity = `${topic.type}\0${topic.summary.toLowerCase().replace(/\s+/g, " ").trim()}`;
      const duplicate = activeKnowledge.get(identity);
      if (duplicate && duplicate !== topic.topicKey) add("DUPLICATE_ACTIVE_KNOWLEDGE", `duplicates ${duplicate}`);
      else activeKnowledge.set(identity, topic.topicKey);
    }
  }
  for (const [topicKey, topics] of byKey) {
    if (topics.length > 1) for (const topic of topics) issues.push({ code: "DUPLICATE_TOPIC_KEY", path: topic.path, detail: topicKey });
  }
  return { valid: issues.length === 0, topics: loaded.topics.length, issues, needsReview: [...needsReview].sort() };
}

export interface MemorySearchPreview {
  topicKey: string;
  type: MemoryType;
  status: MemoryStatus;
  summary: string;
  path: string;
  score: number;
}

export async function searchMemory(repoRoot: string, query: string, requestedLimit = RUNTIME_POLICY.memory.search_preview_limit): Promise<MemorySearchPreview[]> {
  const limit = Math.max(0, Math.min(requestedLimit, RUNTIME_POLICY.memory.search_preview_limit));
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9._/-]*/g) ?? [])];
  if (terms.length === 0 || limit === 0) return [];
  const { topics } = await loadMemoryTopics(repoRoot);
  return topics
    .map((topic) => {
      const key = topic.topicKey.toLowerCase();
      const summary = topic.summary.toLowerCase();
      const body = topic.body.toLowerCase();
      const score = terms.reduce((total, term) => total + (key.includes(term) ? 8 : 0) + (summary.includes(term) ? 4 : 0) + (body.includes(term) ? 1 : 0), 0);
      return { topic, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.topic.topicKey.localeCompare(b.topic.topicKey))
    .slice(0, limit)
    .map(({ topic, score }) => ({ topicKey: topic.topicKey, type: topic.type, status: topic.status, summary: topic.summary, path: topic.path, score }));
}
