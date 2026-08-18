import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const checks = [
  { id: "gauntlet-eval", command: ["pnpm", "run", "gauntlet:eval"] },
  { id: "typecheck", command: ["pnpm", "run", "typecheck"] },
  { id: "test", command: ["pnpm", "run", "test"] },
  { id: "test-browser", command: ["pnpm", "run", "test-browser"] },
  { id: "sim-smoke", command: ["pnpm", "run", "sim-smoke"] },
  { id: "build", command: ["pnpm", "run", "build"] },
];

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function normalizeLine(line) {
  return stripAnsi(line)
    .replaceAll(process.cwd(), "<repo>")
    .replaceAll("/home/ubuntu/projects/oxDeveloop/pes-simulator", "<repo>")
    .replace(/\((\d+),(\d+)\)/g, "(*,*)")
    .replace(/:(\d+):(\d+)/g, ":*:*")
    .replace(/\b\d+(?:\.\d+)?ms\b/g, "<duration>")
    .replace(/\bpid:\s*\d+/g, "pid:<pid>")
    .replace(/\b20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z\b/g, "<timestamp>")
    .trim();
}

function isFailureLine(line) {
  return (
    /error TS\d+/i.test(line) ||
    /^FAIL(?:\s|$)/i.test(line) ||
    /^×\s/.test(line) ||
    /^❯\s/.test(line) ||
    /^AssertionError\b/i.test(line) ||
    /^Error:\s/i.test(line) ||
    /Test timed out/i.test(line) ||
    /ELIFECYCLE/i.test(line) ||
    /Process completed with exit code/i.test(line) ||
    /Replay divergence/i.test(line)
  );
}

function relevantLines(output) {
  const lines = stripAnsi(output).split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const selected = lines.filter(isFailureLine);
  return (selected.length > 0 ? selected : lines.slice(-20)).slice(0, 40);
}

function signature(checkId, output) {
  const material = Array.isArray(output) ? output.join("\n") : relevantLines(output).join("\n");
  return createHash("sha256").update(`${checkId}\n${material}`).digest("hex");
}

function fileHash(relativePath) {
  const full = resolve(relativePath);
  if (!existsSync(full)) return "<missing>";
  try {
    if (!statSync(full).isFile()) return "<non-file>";
    return createHash("sha256").update(readFileSync(full)).digest("hex");
  } catch {
    return "<unreadable>";
  }
}

function statusSnapshot() {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git status failed: ${result.stderr ?? "unknown"}`);
  const snapshot = new Map();
  for (const line of (result.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
    const status = line.slice(0, 2);
    let relativePath = line.slice(3).trim();
    if (relativePath.includes(" -> ")) relativePath = relativePath.split(" -> ").at(-1) ?? relativePath;
    relativePath = relativePath.replace(/^"|"$/g, "");
    snapshot.set(relativePath, { status, hash: fileHash(relativePath) });
  }
  return snapshot;
}

function collectManifestArtifacts(value, out) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && typeof value.path === "string" && typeof value.sha256 === "string") {
    out.set(value.path, value.sha256);
  }
  for (const child of Object.values(value)) collectManifestArtifacts(child, out);
}

function acceptedEvidenceSnapshot() {
  const expected = new Map();
  const root = resolve("docs/evidence");
  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(root, entry.name, "manifest.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        collectManifestArtifacts(manifest.evidence, expected);
      } catch {
        // Manifest validity is covered elsewhere; hygiene only observes usable hashes.
      }
    }
  }
  const actual = new Map();
  for (const artifactPath of expected.keys()) actual.set(artifactPath, fileHash(artifactPath));
  return { expected, actual };
}

function statusMutations(before, after) {
  const changed = [];
  const paths = new Set([...before.keys(), ...after.keys()]);
  for (const relativePath of paths) {
    const previous = before.get(relativePath);
    const current = after.get(relativePath);
    if (!previous && current) changed.push(`${relativePath}: clean -> ${current.status}`);
    else if (previous && !current) changed.push(`${relativePath}: ${previous.status} -> clean`);
    else if (previous && current && (previous.status !== current.status || previous.hash !== current.hash)) {
      changed.push(`${relativePath}: preexisting dirty content/status changed during suite`);
    }
  }
  return changed;
}

function acceptedMutations(before, after) {
  const changed = [];
  const paths = new Set([...before.actual.keys(), ...after.actual.keys()]);
  for (const artifactPath of paths) {
    const previous = before.actual.get(artifactPath);
    const current = after.actual.get(artifactPath);
    if (previous !== current) changed.push(`${artifactPath}: ${previous ?? "<not tracked>"} -> ${current ?? "<not tracked>"}`);
  }
  return changed;
}

function integrityMismatches(snapshot) {
  const mismatches = [];
  for (const [artifactPath, expectedSha] of snapshot.expected) {
    const actualSha = snapshot.actual.get(artifactPath) ?? "<missing>";
    if (actualSha !== expectedSha) mismatches.push(`${artifactPath}: manifest=${expectedSha} actual=${actualSha}`);
  }
  return mismatches;
}

const reportPath = resolve(process.env.CI_REPORT_PATH ?? "artifacts/ci/validation.json");
const targetSha = process.env.CI_TARGET_SHA ?? null;
const results = [];
const beforeStatus = statusSnapshot();
const beforeAccepted = acceptedEvidenceSnapshot();

for (const check of checks) {
  console.log(`\n=== ${check.id} ===`);
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CI: "1", GAUNTLET_EVIDENCE_CAPTURE: "0", GAUNTLET_EVAL_DURABLE: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  const exitCode = result.status ?? 1;
  const failed = exitCode !== 0;
  results.push({
    check_id: check.id,
    status: failed ? "FAIL" : "PASS",
    exit_code: exitCode,
    signature: failed ? signature(check.id, output) : null,
    summary: failed ? relevantLines(output) : [],
  });
}

const afterStatus = statusSnapshot();
const afterAccepted = acceptedEvidenceSnapshot();
const worktreeChanges = statusMutations(beforeStatus, afterStatus);
const acceptedChanges = acceptedMutations(beforeAccepted, afterAccepted);
const hygieneSummary = [...worktreeChanges, ...acceptedChanges.map((line) => `accepted evidence mutated: ${line}`)];
const hygieneFailed = hygieneSummary.length > 0;
results.push({
  check_id: "full-suite-worktree-hygiene",
  status: hygieneFailed ? "FAIL" : "PASS",
  exit_code: hygieneFailed ? 1 : 0,
  signature: hygieneFailed ? signature("full-suite-worktree-hygiene", hygieneSummary) : null,
  summary: hygieneSummary.slice(0, 40),
});
console.log(`${hygieneFailed ? "FAIL" : "PASS"} FULL-SUITE-WORKTREE-HYGIENE${hygieneFailed ? ` — ${hygieneSummary.join("; ")}` : ""}`);

const integrity = integrityMismatches(afterAccepted);
const integrityFailed = integrity.length > 0;
results.push({
  check_id: "accepted-evidence-immutable",
  status: integrityFailed ? "FAIL" : "PASS",
  exit_code: integrityFailed ? 1 : 0,
  signature: integrityFailed ? signature("accepted-evidence-immutable", integrity) : null,
  summary: integrity.slice(0, 40),
});
console.log(`${integrityFailed ? "FAIL" : "PASS"} ACCEPTED-EVIDENCE-IMMUTABLE${integrityFailed ? ` — ${integrity.join("; ")}` : ""}`);

const report = {
  schema_version: "ci-validation-v2",
  target_sha: targetSha,
  checks: results,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
