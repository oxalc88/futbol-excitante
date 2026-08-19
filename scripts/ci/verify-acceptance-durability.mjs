import { execFileSync } from "node:child_process";

export const CANONICAL_STATE_PATHS = [
  "gauntlet/state/CURRENT.md",
  "gauntlet/state/HORIZON.md",
  "gauntlet/state/HISTORY.md",
  "gauntlet/state/TIMING.md",
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readAtRef(ref, file) {
  try {
    return git(["show", `${ref}:${file}`]);
  } catch {
    return null;
  }
}

export function validateCanonicalAcceptanceState({ objective, current, horizon, history, timing, manifest }) {
  const id = escapeRegExp(objective);
  const checks = {
    current: Boolean(current && new RegExp(`(?:^|\\n)\\s*-\\s+${id}(?:\\s|$)`, "m").test(current)),
    horizon: Boolean(horizon && new RegExp(`- id:\\s*[\"']?${id}[\"']?[\\s\\S]{0,900}?status:\\s*accepted`, "m").test(horizon)),
    history: Boolean(history && new RegExp(`objective_id:\\s*${id}[\\s\\S]{0,1200}?result:\\s*accepted`, "m").test(history)),
    timing: Boolean(timing && new RegExp(`last_tracked_objective:\\s*${id}(?:\\s|$)`, "m").test(timing)),
    manifest: Boolean(manifest),
    acceptance_record: false,
  };

  if (manifest) {
    try {
      const parsed = JSON.parse(manifest);
      checks.acceptance_record = parsed.objective_id === objective && typeof parsed.acceptance_record === "string";
    } catch {
      checks.acceptance_record = false;
    }
  }
  return checks;
}

export function classifyCleanupPath({ pathClass, newerThanRemote }) {
  if (pathClass === "canonical_state" && newerThanRemote) return "preserve_for_bookkeeping_repair";
  if (pathClass === "accepted_evidence") return "restore_historical_evidence";
  if (pathClass === "ephemeral_artifact") return "discard_ephemeral_artifact";
  return "preserve";
}

export function verifyAcceptanceDurability({ objective, acceptanceCommit, ref, mode = "local" }) {
  const manifestPath = `docs/evidence/${objective}/manifest.json`;
  const current = readAtRef(ref, CANONICAL_STATE_PATHS[0]);
  const horizon = readAtRef(ref, CANONICAL_STATE_PATHS[1]);
  const history = readAtRef(ref, CANONICAL_STATE_PATHS[2]);
  const timing = readAtRef(ref, CANONICAL_STATE_PATHS[3]);
  const manifest = readAtRef(ref, manifestPath);
  const checks = validateCanonicalAcceptanceState({ objective, current, horizon, history, timing, manifest });

  let acceptanceRecordPath = null;
  if (manifest) {
    try { acceptanceRecordPath = JSON.parse(manifest).acceptance_record ?? null; } catch { acceptanceRecordPath = null; }
  }
  if (acceptanceRecordPath) checks.acceptance_record = readAtRef(ref, acceptanceRecordPath) !== null;

  let remoteContainsAcceptance = true;
  if (mode === "remote") {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", acceptanceCommit, ref], { stdio: "ignore" });
    } catch {
      remoteContainsAcceptance = false;
    }
  }

  let changedBookkeepingCommitted = true;
  if (mode === "local") {
    const dirty = git(["status", "--porcelain", "--", ...CANONICAL_STATE_PATHS]);
    changedBookkeepingCommitted = dirty.length === 0;
  }

  const stateValid = Object.values(checks).every(Boolean);
  let failureClass = null;
  if (mode === "local" && (!changedBookkeepingCommitted || !stateValid)) failureClass = "MISSING_ACCEPTANCE_BOOKKEEPING";
  else if (mode === "remote" && !remoteContainsAcceptance) failureClass = "REMOTE_DURABILITY_MISSING";
  else if (mode === "remote" && !stateValid) failureClass = "REMOTE_STATE_STALE";

  return {
    status: failureClass ? "FAIL" : "PASS",
    failure_class: failureClass,
    mode,
    objective,
    acceptance_commit: acceptanceCommit,
    ref,
    changed_bookkeeping_committed: changedBookkeepingCommitted,
    remote_contains_acceptance: remoteContainsAcceptance,
    state_valid: stateValid,
    checks,
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1]?.endsWith("verify-acceptance-durability.mjs")) {
  const objective = arg("--objective");
  const acceptanceCommit = arg("--commit") ?? "HEAD";
  const mode = arg("--mode") ?? "local";
  const ref = arg("--ref") ?? (mode === "remote" ? "origin/main" : acceptanceCommit);
  if (!objective) {
    console.error("Usage: verify-acceptance-durability.mjs --objective <id> [--commit <sha>] [--mode local|remote] [--ref <ref>]");
    process.exit(2);
  }
  const result = verifyAcceptanceDurability({ objective, acceptanceCommit, ref, mode });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
}
