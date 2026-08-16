import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key?.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) { args.set(key.slice(2), next); i += 1; }
}

const objective = args.get("objective");
const artifactId = args.get("artifact-id");
const artifactName = args.get("artifact-name");
const provider = args.get("provider");
const candidateCommit = args.get("candidate-commit");
const createdAt = args.get("created-at") ?? new Date().toISOString();
const expiresAt = args.has("expires-at") ? args.get("expires-at")! : null;

if (!objective || !artifactId || !artifactName || !provider || !candidateCommit) {
  console.error("usage: pnpm run gauntlet:video:reference -- --objective <id> --artifact-id <id> --artifact-name <name> --provider <provider> --candidate-commit <sha> [--created-at <iso>] [--expires-at <iso>]");
  process.exit(2);
}
if (!/^[0-9a-f]{7,40}$/i.test(candidateCommit)) throw new Error("candidate-commit must be a git SHA");
await execFileAsync("git", ["-C", repoRoot, "cat-file", "-e", `${candidateCommit}^{commit}`]);

const record = {
  schema_version: 1,
  objective_id: objective,
  artifact_id: artifactId,
  artifact_name: artifactName,
  provider,
  created_at: createdAt,
  expires_at: expiresAt,
  candidate_commit: candidateCommit,
};
const dir = path.join(repoRoot, "docs/evidence", objective);
await mkdir(dir, { recursive: true });
const file = path.join(dir, "video-reference.json");
await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(file);
