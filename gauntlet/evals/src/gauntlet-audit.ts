import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
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
  console.error("usage: pnpm run gauntlet:audit -- --objective <id> --class <HEADLESS|BROWSER_VISIBLE|MULTI_TICK|DYNAMIC_VISUAL|PRESENTATION|BOOKKEEPING> [--tests-pass true] [--integration-test-pass true] [--requires-slot-wiring true --slot-wiring-pass true]");
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

const screenshotDir = path.join(repoRoot, "docs/screenshots", objective);
let objectiveScreenshots: string[] = [];
try { objectiveScreenshots = (await readdir(screenshotDir)).filter((f) => /\\.(png|jpg|jpeg|webp)$/i.test(f)); } catch { /* absent */ }
add("required screenshot exists", screenshotRequired ? (objectiveScreenshots.length ? "PASS" : "FAIL") : "NOT_APPLICABLE", "builder", screenshotRequired && !objectiveScreenshots.length ? `missing docs/screenshots/${objective}/` : undefined);

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
  for (const dirent of await readdir(allRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name === objective) continue;
    let files: string[] = [];
    try { files = (await readdir(path.join(allRoot, dirent.name))).filter((f) => /\\.(png|jpg|jpeg|webp)$/i.test(f)); } catch { continue; }
    for (const file of files) {
      const bytes = await readFile(path.join(allRoot, dirent.name, file));
      const sha = createHash("sha256").update(bytes).digest("hex");
      const current = objectiveHashes.get(sha);
      if (current) duplicates.push({ current, other: `${dirent.name}/${file}`, sha256: sha });
    }
  }
  add("screenshot SHA uniqueness", duplicates.length ? "REVIEW_REQUIRED" : "PASS", duplicates.length ? "semantic" : "builder", duplicates.length ? JSON.stringify(duplicates.slice(0, 8)) : undefined);
} else add("screenshot SHA uniqueness", "NOT_APPLICABLE", "builder");

const state = await runStateChecks(repoRoot);
for (const c of state.checks) add(c.name, c.pass ? "PASS" : "FAIL", "orchestrator", c.detail);

const hasFail = checks.some((c) => c.status === "FAIL");
const hasReview = checks.some((c) => c.status === "REVIEW_REQUIRED");
const status: Status = hasFail ? "FAIL" : hasReview ? "REVIEW_REQUIRED" : "PASS";
const result = { schema_version: 1, gauntlet_version: "0.7.0", objective_id: objective, evidence_class: evidenceClass, status, checks };
console.log(JSON.stringify(result, null, 2));
if (status === "FAIL") process.exitCode = 1;
else if (status === "REVIEW_REQUIRED") process.exitCode = 3;
