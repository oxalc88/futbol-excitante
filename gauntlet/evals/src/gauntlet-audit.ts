import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStateChecks } from "./audit-state-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

type Status = "PASS" | "FAIL" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";
type Owner = "builder" | "orchestrator" | "semantic";
interface Check { name: string; status: Status; owner: Owner; detail?: string }

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key?.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) { args.set(key.slice(2), next); i += 1; } else args.set(key.slice(2), "true");
}
const objective = args.get("objective");
const evidenceClass = (args.get("class") ?? "").toUpperCase();
if (!objective || !["HEADLESS", "BROWSER_VISIBLE", "MULTI_TICK", "DYNAMIC_VISUAL", "PRESENTATION", "BOOKKEEPING"].includes(evidenceClass)) {
  console.error("usage: pnpm run gauntlet:audit -- --objective <id> --class <HEADLESS|BROWSER_VISIBLE|MULTI_TICK|DYNAMIC_VISUAL|PRESENTATION|BOOKKEEPING> [--tests-pass true] [--integration-test-pass true] [--requires-slot-wiring true --slot-wiring-pass true] [--candidate-commit <sha>]");
  process.exit(2);
}
const bool = (key: string) => args.get(key) === "true";
const checks: Check[] = [];
const add = (name: string, status: Status, owner: Owner, detail?: string) => checks.push({ name, status, owner, detail });

if (evidenceClass === "BOOKKEEPING") add("tests result", "NOT_APPLICABLE", "builder");
else add("tests result", bool("tests-pass") ? "PASS" : "FAIL", "builder", bool("tests-pass") ? undefined : "executed test result was not supplied as passing");

const screenshotRequired = ["BROWSER_VISIBLE", "DYNAMIC_VISUAL", "PRESENTATION"].includes(evidenceClass);
const trajectoryRequired = ["MULTI_TICK", "DYNAMIC_VISUAL"].includes(evidenceClass);
const integrationRequired = trajectoryRequired;
const semanticSequenceRequired = evidenceClass === "DYNAMIC_VISUAL";

const screenshotDir = path.join(repoRoot, "docs/screenshots", objective);
let objectiveScreenshots: string[] = [];
try { objectiveScreenshots = (await readdir(screenshotDir)).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).sort(); } catch { /* absent */ }
add("required screenshot exists", screenshotRequired ? (objectiveScreenshots.length ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", screenshotRequired && !objectiveScreenshots.length ? `missing docs/screenshots/${objective}/` : undefined);

const sequencePath = path.join(screenshotDir, "sequence.json");
if (semanticSequenceRequired) {
  let sequenceOk = false;
  let detail = "missing or invalid semantic sequence";
  try {
    const sequence = JSON.parse(await readFile(sequencePath, "utf8")) as { objective_id?: string; frames?: Array<{ label?: string; path?: string }> };
    const frames = Array.isArray(sequence.frames) ? sequence.frames : [];
    const named = new Set(objectiveScreenshots);
    sequenceOk = sequence.objective_id === objective && frames.length >= 3 && frames.length <= 5 && frames.every((frame) => Boolean(frame.label) && Boolean(frame.path) && named.has(String(frame.path)));
    if (!sequenceOk) detail = `DYNAMIC_VISUAL requires 3-5 labeled frames tied to ${objective}`;
  } catch { /* detail already set */ }
  add("semantic visual sequence", sequenceOk ? "PASS" : "FAIL", "builder", sequenceOk ? undefined : detail);
} else add("semantic visual sequence", "NOT_APPLICABLE", "builder");

const trajectory = path.join(repoRoot, "docs/evidence", objective, "trajectory.json");
let trajectoryExists = false;
try { trajectoryExists = (await stat(trajectory)).isFile(); } catch { /* absent */ }
add("required trajectory exists", trajectoryRequired ? (trajectoryExists ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", trajectoryRequired && !trajectoryExists ? `missing docs/evidence/${objective}/trajectory.json` : undefined);
add("integration test result", integrationRequired ? (bool("integration-test-pass") ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", integrationRequired && !bool("integration-test-pass") ? "multi-tick evidence requires a relevant integration-test pass" : undefined);

if (bool("requires-slot-wiring")) add("slot/player wiring invariants", bool("slot-wiring-pass") ? "PASS" : "FAIL", "builder", bool("slot-wiring-pass") ? undefined : "slot/player ownership or routing criterion requires a passing invariant test");
else add("slot/player wiring invariants", "NOT_APPLICABLE", "builder");

if (objectiveScreenshots.length) {
  const allRoot = path.join(repoRoot, "docs/screenshots");
  const objectiveHashes = new Map<string, string>();
  for (const file of objectiveScreenshots) {
    const bytes = await readFile(path.join(screenshotDir, file));
    objectiveHashes.set(createHash("sha256").update(bytes).digest("hex"), file);
  }
  const duplicates: Array<{ current: string; other: string; sha256: string }> = [];
  try {
    for (const dirent of await readdir(allRoot, { withFileTypes: true })) {
      if (!dirent.isDirectory() || dirent.name === objective) continue;
      let files: string[] = [];
      try { files = (await readdir(path.join(allRoot, dirent.name))).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)); } catch { continue; }
      for (const file of files) {
        const bytes = await readFile(path.join(allRoot, dirent.name, file));
        const sha = createHash("sha256").update(bytes).digest("hex");
        const current = objectiveHashes.get(sha);
        if (current) duplicates.push({ current, other: `${dirent.name}/${file}`, sha256: sha });
      }
    }
  } catch { /* screenshot root absent */ }
  add("screenshot SHA uniqueness", duplicates.length ? "REVIEW_REQUIRED" : "PASS", duplicates.length ? "semantic" : "builder", duplicates.length ? JSON.stringify(duplicates.slice(0, 8)) : undefined);
} else add("screenshot SHA uniqueness", "NOT_APPLICABLE", "builder");

const state = await runStateChecks(repoRoot);
for (const c of state.checks) add(c.name, c.pass ? "PASS" : "FAIL", "orchestrator", c.detail);

const hasFail = checks.some((c) => c.status === "FAIL");
const hasReview = checks.some((c) => c.status === "REVIEW_REQUIRED");
const status: Status = hasFail ? "FAIL" : hasReview ? "REVIEW_REQUIRED" : "PASS";
const version = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/VERSION.json"), "utf8")) as { version: string };
const result = {
  schema_version: 2,
  gauntlet_version: version.version,
  generated_at: new Date().toISOString(),
  objective_id: objective,
  candidate_commit: args.get("candidate-commit") ?? null,
  evidence_class: evidenceClass,
  status,
  checks,
};

const evidenceDir = path.join(repoRoot, "docs/evidence", objective);
await mkdir(evidenceDir, { recursive: true });
await writeFile(path.join(evidenceDir, "audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (status === "FAIL") process.exitCode = 1;
else if (status === "REVIEW_REQUIRED") process.exitCode = 3;
