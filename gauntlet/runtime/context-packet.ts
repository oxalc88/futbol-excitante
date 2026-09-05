import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { approximateTokens, digestRepositoryFiles, isSafeObjectiveId, pathExistsAsFile } from "./digest.js";
import { RUNTIME_POLICY } from "./policy.js";

export interface ContextFile {
  path: string;
  purpose: string;
}

export interface ContextDecision {
  topicKey: string;
  canonicalRefs: string[];
}

export interface ObjectiveContextPacket {
  schemaVersion: 1;
  objectiveId: string;
  sourceDigest: string;
  executiveSummary: string;
  files: ContextFile[];
  decisions: ContextDecision[];
  tests: string[];
  dependencies: string[];
  risks: string[];
  conflicts: string[];
  skillsToLoad: string[];
  nonAuthoritative: true;
}

export function packetSourcePaths(packet: Omit<ObjectiveContextPacket, "sourceDigest"> | ObjectiveContextPacket): string[] {
  return [...new Set([
    ...packet.files.map((file) => file.path),
    ...packet.decisions.flatMap((decision) => decision.canonicalRefs),
    ...packet.tests,
  ])].sort();
}

export async function createContextPacket(
  repoRoot: string,
  input: Omit<ObjectiveContextPacket, "schemaVersion" | "sourceDigest" | "nonAuthoritative">,
): Promise<ObjectiveContextPacket> {
  const draft = { schemaVersion: 1 as const, ...input, sourceDigest: "", nonAuthoritative: true as const };
  draft.sourceDigest = await digestRepositoryFiles(repoRoot, packetSourcePaths(draft));
  return draft;
}

export async function validateContextPacket(repoRoot: string, packet: ObjectiveContextPacket): Promise<{
  valid: boolean;
  stale: boolean;
  estimatedTokens: number;
  issues: string[];
}> {
  const issues: string[] = [];
  const serialized = JSON.stringify(packet);
  const estimatedTokens = approximateTokens(serialized);
  if (packet.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (!isSafeObjectiveId(packet.objectiveId)) issues.push("objectiveId must be a simple repository-safe identifier");
  if (packet.nonAuthoritative !== true) issues.push("packet must declare nonAuthoritative=true");
  if (estimatedTokens > RUNTIME_POLICY.objective_context.maximum_tokens) issues.push("packet exceeds configured token bound");
  if (/\b(transcript|chain[- ]of[- ]thought|raw prompt|accept(?:ed|ance)\s*:\s*true)\b/i.test(serialized)) issues.push("packet contains forbidden history/reasoning/acceptance content");
  if (packet.files.length > RUNTIME_POLICY.objective_context.mapper_file_limit) issues.push("packet selects too many files");
  if (packet.decisions.length > RUNTIME_POLICY.memory.initial_topic_limit) issues.push("packet loads too many memory topics initially");
  if (packetSourcePaths(packet).length > RUNTIME_POLICY.objective_context.mapper_file_limit) issues.push("packet references too many source files");
  for (const relativePath of packetSourcePaths(packet)) if (!(await pathExistsAsFile(repoRoot, relativePath))) issues.push(`missing referenced file: ${relativePath}`);
  let stale = false;
  try { stale = await digestRepositoryFiles(repoRoot, packetSourcePaths(packet)) !== packet.sourceDigest; }
  catch { stale = true; }
  if (stale) issues.push("sourceDigest is stale for referenced canonical inputs");
  return { valid: issues.length === 0, stale, estimatedTokens, issues };
}

export async function writeContextPacket(repoRoot: string, packet: ObjectiveContextPacket): Promise<string> {
  const validation = await validateContextPacket(repoRoot, packet);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  const directory = path.join(repoRoot, ".delivery-local", "context");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${packet.objectiveId}.json`);
  await writeFile(file, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return file;
}

export async function readContextPacket(repoRoot: string, objectiveId: string): Promise<ObjectiveContextPacket> {
  if (!isSafeObjectiveId(objectiveId)) throw new Error("objectiveId must be a simple repository-safe identifier");
  return JSON.parse(await readFile(path.join(repoRoot, ".delivery-local", "context", `${objectiveId}.json`), "utf8")) as ObjectiveContextPacket;
}
