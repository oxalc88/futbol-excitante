import { readFile } from "node:fs/promises";
import process from "node:process";
import { createBuilderCheckpoint, validateBuilderCheckpoint, writeBuilderCheckpoint, type BuilderCheckpoint } from "../gauntlet/runtime/builder-checkpoint.js";
import { createContextPacket, validateContextPacket, writeContextPacket, type ObjectiveContextPacket } from "../gauntlet/runtime/context-packet.js";

const [kind, command, inputPath] = process.argv.slice(2);
if (!kind || !command || !inputPath) throw new Error("usage: gauntlet-context <packet|checkpoint> <create|check> <json>");
if (command !== "create" && command !== "check") throw new Error("command must be create or check");
const repoRoot = process.cwd();
const input = JSON.parse(await readFile(inputPath, "utf8")) as Record<string, unknown>;

if (kind === "packet") {
  const packet = command === "create"
    ? await createContextPacket(repoRoot, input as unknown as Omit<ObjectiveContextPacket, "schemaVersion" | "sourceDigest" | "nonAuthoritative">)
    : input as unknown as ObjectiveContextPacket;
  const validation = await validateContextPacket(repoRoot, packet);
  const output = command === "create" && validation.valid ? await writeContextPacket(repoRoot, packet) : null;
  process.stdout.write(`${JSON.stringify({ ...validation, output }, null, 2)}\n`);
  if (!validation.valid) process.exitCode = 1;
} else if (kind === "checkpoint") {
  const checkpoint = command === "create"
    ? await createBuilderCheckpoint(repoRoot, input as unknown as Omit<BuilderCheckpoint, "schemaVersion" | "sourceDigest" | "nonAuthoritative">)
    : input as unknown as BuilderCheckpoint;
  const validation = await validateBuilderCheckpoint(repoRoot, checkpoint);
  const output = command === "create" && validation.valid ? await writeBuilderCheckpoint(repoRoot, checkpoint) : null;
  process.stdout.write(`${JSON.stringify({ ...validation, output }, null, 2)}\n`);
  if (!validation.valid) process.exitCode = 1;
} else {
  throw new Error("kind must be packet or checkpoint");
}
