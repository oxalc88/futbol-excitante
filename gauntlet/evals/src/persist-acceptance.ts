import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildEvidenceManifest, writeEvidenceManifest } from "./evidence-manifest.js";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const raw = process.env.GAUNTLET_ACCEPTANCE_JSON;
if (!raw) throw new Error("GAUNTLET_ACCEPTANCE_JSON is required");
const input = JSON.parse(raw) as Record<string, any>;
const required = ["objective_id", "candidate_commit", "builder", "critic", "integration", "deterministic_audit"];
for (const key of required) if (!input[key]) throw new Error(`missing acceptance field: ${key}`);
if (input.deterministic_audit.status !== "PASS") throw new Error("deterministic audit must PASS before persistence");
if (input.semantic_audit && input.semantic_audit.verdict !== "VALID") throw new Error("semantic audit must be VALID when invoked");
if (input.critic.verdict !== "ACCEPT") throw new Error("critic ACCEPT is mandatory; deterministic/cheap audits cannot substitute");
if (input.integration.verdict !== "ACCEPT") throw new Error("integration ACCEPT is mandatory");
if (input.builder.model === input.critic.model) throw new Error("builder/critic model independence violated");

const candidateCommit = String(input.candidate_commit);
if (!/^[0-9a-f]{7,40}$/i.test(candidateCommit)) throw new Error("candidate_commit must be a git commit SHA, not a verbal working-tree marker");
try {
  await execFileAsync("git", ["-C", repoRoot, "cat-file", "-e", `${candidateCommit}^{commit}`]);
} catch {
  throw new Error(`candidate_commit does not resolve to a local commit: ${candidateCommit}`);
}

const version = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/VERSION.json"), "utf8")) as { version: string };
const now = new Date();
const acceptedAt = now.toISOString();
const day = acceptedAt.slice(0, 10);
const stamp = acceptedAt.replace(/[:.]/g, "-");
const safeObjective = String(input.objective_id).replace(/[^A-Za-z0-9_-]/g, "_");
const dir = path.join(repoRoot, "gauntlet/evals/results", day);
await mkdir(dir, { recursive: true });
const file = path.join(dir, `${stamp}-${safeObjective}-acceptance.json`);
const relativeRecord = path.relative(repoRoot, file);
const record = {
  schema_version: 2,
  record_type: "candidate_acceptance",
  gauntlet_version: version.version,
  persisted_at: acceptedAt,
  state_audit_required: true,
  objective_manifest_required: true,
  ...input,
  candidate_commit: candidateCommit,
};

const manifest = await buildEvidenceManifest(repoRoot, version.version, acceptedAt, relativeRecord, {
  objective_id: String(input.objective_id),
  candidate_commit: candidateCommit,
  evidence_class: input.evidence_class ? String(input.evidence_class) : undefined,
  deterministic_audit: input.deterministic_audit,
  semantic_audit: input.semantic_audit ?? null,
  critic: input.critic,
  integration: input.integration,
  metrics: Array.isArray(input.metrics) ? input.metrics.map(String) : [],
});

let manifestFile: string | null = null;
try {
  manifestFile = await writeEvidenceManifest(repoRoot, safeObjective, manifest);
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
} catch (error) {
  if (manifestFile) await rm(manifestFile, { force: true });
  throw error;
}

console.log(JSON.stringify({ acceptance_record: file, objective_manifest: manifestFile }, null, 2));
