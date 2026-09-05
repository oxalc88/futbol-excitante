import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { approximateTokens, digestRepositoryFiles, isSafeObjectiveId, pathExistsAsFile } from "./digest.js";
import { RUNTIME_POLICY } from "./policy.js";
import type { ObjectiveContextPacket } from "./context-packet.js";

export interface BuilderCheckpoint {
  schemaVersion: 1;
  objectiveId: string;
  builderSessionId: string;
  phase: string;
  changedFiles: string[];
  implementedBehavior: string[];
  testsRun: Array<{ command: string; exitCode: number; artifactPath?: string }>;
  remainingFailures: string[];
  evidence: string[];
  nextAction: string;
  relevantFiles: string[];
  sourceDigest: string;
  nonAuthoritative: true;
}

export async function createBuilderCheckpoint(
  repoRoot: string,
  input: Omit<BuilderCheckpoint, "schemaVersion" | "sourceDigest" | "nonAuthoritative">,
): Promise<BuilderCheckpoint> {
  return {
    schemaVersion: 1,
    ...input,
    sourceDigest: await digestRepositoryFiles(repoRoot, input.relevantFiles),
    nonAuthoritative: true,
  };
}

export async function validateBuilderCheckpoint(repoRoot: string, checkpoint: BuilderCheckpoint): Promise<{ valid: boolean; stale: boolean; estimatedTokens: number; issues: string[] }> {
  const issues: string[] = [];
  const serialized = JSON.stringify(checkpoint);
  const estimatedTokens = approximateTokens(serialized);
  if (checkpoint.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (checkpoint.nonAuthoritative !== true) issues.push("checkpoint must declare nonAuthoritative=true");
  if (!isSafeObjectiveId(checkpoint.objectiveId)) issues.push("objectiveId must be a simple repository-safe identifier");
  if (!checkpoint.objectiveId || !checkpoint.builderSessionId || !checkpoint.phase || !checkpoint.nextAction) issues.push("checkpoint identity, phase, and nextAction are required");
  if (estimatedTokens > RUNTIME_POLICY.builder_checkpoint.maximum_tokens) issues.push("checkpoint exceeds configured token bound");
  if (/\b(transcript|chain[- ]of[- ]thought|raw prompt|full tool output)\b/i.test(serialized)) issues.push("checkpoint contains forbidden conversation/tool material");
  for (const relativePath of checkpoint.relevantFiles) if (!(await pathExistsAsFile(repoRoot, relativePath))) issues.push(`missing relevant file: ${relativePath}`);
  let stale = false;
  try { stale = await digestRepositoryFiles(repoRoot, checkpoint.relevantFiles) !== checkpoint.sourceDigest; }
  catch { stale = true; }
  if (stale) issues.push("sourceDigest is stale for relevant files");
  return { valid: issues.length === 0, stale, estimatedTokens, issues };
}

export async function writeBuilderCheckpoint(repoRoot: string, checkpoint: BuilderCheckpoint): Promise<string> {
  const validation = await validateBuilderCheckpoint(repoRoot, checkpoint);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  const directory = path.join(repoRoot, ".delivery-local", "checkpoints");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${checkpoint.objectiveId}.json`);
  await writeFile(file, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  return file;
}

export async function readBuilderCheckpoint(repoRoot: string, objectiveId: string): Promise<BuilderCheckpoint> {
  if (!isSafeObjectiveId(objectiveId)) throw new Error("objectiveId must be a simple repository-safe identifier");
  return JSON.parse(await readFile(path.join(repoRoot, ".delivery-local", "checkpoints", `${objectiveId}.json`), "utf8")) as BuilderCheckpoint;
}

export interface FreshBuilderSeed {
  objectiveId: string;
  roleContract: string;
  contextPacket: ObjectiveContextPacket;
  checkpoint: BuilderCheckpoint;
  selectedMemoryTopicPaths: string[];
  canonicalRefs: string[];
  previousTranscriptIncluded: false;
}

export function seedFreshBuilder(input: Omit<FreshBuilderSeed, "previousTranscriptIncluded">): FreshBuilderSeed {
  if (input.contextPacket.objectiveId !== input.objectiveId || input.checkpoint.objectiveId !== input.objectiveId) {
    throw new Error("fresh builder seed objective mismatch");
  }
  if (input.selectedMemoryTopicPaths.length > RUNTIME_POLICY.memory.initial_topic_limit) throw new Error("fresh builder seed exceeds memory topic limit");
  return { ...input, previousTranscriptIncluded: false };
}
