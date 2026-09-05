/**
 * Stash-identity verifier for GK-5V5-ADAPTER-BEHAVIOR.
 *
 * The keeper role is claimed to be switch-controlled: with `gkBehavior: false` the
 * live tree must produce exactly what the pre-objective tree produced. Reading the
 * durable artifact alone cannot prove that, so this command runs the *recorded
 * stashed configuration* through a real HEAD-of-base checkout and compares the
 * per-tick state hash chains byte-for-byte.
 *
 * It creates a temporary linked worktree under the ignored `.worktrees/**` tree,
 * runs the same scenarios through that tree's own (unmodified) match runner with
 * the same wiring configuration the artifact records, and compares:
 *
 *   • the chain hash-of-hash for every `gk_behavior: false` run, and
 *   • that the live tree's stashed chain equals the base tree's chain exactly.
 *
 * Usage:
 *   mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref <base-commit-ish>
 *
 * Node I/O is confined to this verification tool; no simulation file is executed
 * from a writable copy and nothing under docs/ is modified.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

const repoRoot = process.cwd();
// GK-DISTRIBUTION-BEHAVIOR extends the stash-identity check: every objective
// whose evidence carries a gk_behavior:false control is verified below, so the
// keeper switch stays byte-identical across the adapter and the new release path.
const OBJECTIVE_IDS = ["GK-5V5-ADAPTER-BEHAVIOR", "GK-DISTRIBUTION-BEHAVIOR"];

const refArg = process.argv.find((arg) => arg.startsWith("--ref="));
const refFlagIndex = process.argv.indexOf("--ref");
const baseRef = refArg
  ? refArg.slice("--ref=".length)
  : (refFlagIndex >= 0 ? process.argv[refFlagIndex + 1] : undefined);
if (!baseRef) {
  console.error(`usage: pnpm run gauntlet:verify-gk-stash -- --ref <base-commit-ish>`);
  process.exit(2);
}

const stashedRuns = [];
for (const objectiveId of OBJECTIVE_IDS) {
  const artifactPath = resolve(repoRoot, "docs/evidence", objectiveId, "trajectory.json");
  if (!existsSync(artifactPath)) continue;
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  for (const run of artifact.runs.filter((r) => r.gk_behavior === false)) {
    stashedRuns.push({ objective_id: objectiveId, ...run });
  }
}
if (stashedRuns.length === 0) {
  console.error("no gk_behavior:false runs in the artifacts — nothing to verify");
  process.exit(2);
}

const baseCommit = execFileSync("git", ["rev-parse", baseRef], {
  cwd: repoRoot, encoding: "utf-8",
}).trim();
const worktreeName = `gk-stash-${baseCommit.slice(0, 7)}`;
const worktreePath = resolve(repoRoot, ".worktrees", worktreeName);

console.log(`[gk-stash] base ref ${baseRef} → ${baseCommit}`);
if (!existsSync(worktreePath)) {
  execFileSync("git", ["worktree", "add", "--detach", worktreePath, baseCommit], {
    cwd: repoRoot, stdio: "inherit",
  });
}
if (!existsSync(resolve(worktreePath, "node_modules"))) {
  symlinkSync(resolve(repoRoot, "node_modules"), resolve(worktreePath, "node_modules"), "dir");
}

// The probe runs inside the base checkout and uses that tree's own runner, so the
// chain it produces cannot be influenced by any file in the working tree.
const probePath = resolve(worktreePath, "gk-stash-probe.ts");
writeFileSync(probePath, `import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runHeadlessMatch } from "./eval/runners/headless-match.js";

const requests = JSON.parse(readFileSync(process.argv[2], "utf-8")) as Array<{
  id: string; scenarioPath: string; ticks: number; phaseSync: "legacy" | "core-owned";
}>;
const out = requests.map((request) => {
  const scenario = JSON.parse(readFileSync(request.scenarioPath, "utf-8"));
  const result = runHeadlessMatch({
    scenario,
    maxTicks: request.ticks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    browserParityObservations: true,
    lifecyclePhaseSync: request.phaseSync,
  });
  return {
    id: request.id,
    ticks: result.stateHashes.length,
    state_hash_of_hashes: createHash("sha256").update(JSON.stringify(result.stateHashes)).digest("hex"),
    final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
  };
});
process.stdout.write(JSON.stringify(out) + "\\n");
`, "utf-8");

const requests = stashedRuns.map((run) => ({
  id: run.id,
  scenarioPath: resolve(repoRoot, run.scenario_path),
  ticks: run.ticks,
  phaseSync: run.lifecycle_phase_sync,
}));
const requestsPath = resolve(worktreePath, "gk-stash-requests.json");
writeFileSync(requestsPath, JSON.stringify(requests), "utf-8");

console.log(`[gk-stash] running ${requests.length} stashed configuration(s) through ${relative(repoRoot, worktreePath)} (${baseCommit.slice(0, 7)})`);
const stdout = execFileSync(
  "pnpm",
  ["exec", "tsx", probePath, requestsPath],
  { cwd: worktreePath, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000 },
);
const baseResults = JSON.parse(stdout.trim().split("\n").filter(Boolean).pop() ?? "[]");

let failures = 0;
for (const run of stashedRuns) {
  const base = baseResults.find((entry) => entry.id === run.id);
  // Cross-check the artifact's own per-tick chain only when it stores per_tick;
  // a run without per_tick (e.g. GK-DISTRIBUTION-BEHAVIOR records hash-of-hashes
  // directly) is verified by the base-tree reproduction (baseOk) alone.
  let chainOk = true;
  if (Array.isArray(run.per_tick) && run.per_tick.length > 0) {
    const recordedChain = run.per_tick.map((row) => String(row[row.length - 1]));
    const recordedHashOfHashes = createHash("sha256")
      .update(JSON.stringify(recordedChain)).digest("hex");
    chainOk = recordedHashOfHashes === run.determinism.state_hash_of_hashes;
  }
  const baseOk = !!base && base.state_hash_of_hashes === run.determinism.state_hash_of_hashes;
  const tickOk = !!base && base.ticks === run.ticks;
  const ok = chainOk && baseOk && tickOk;
  if (!ok) failures++;
  console.log(JSON.stringify({
    objective: run.objective_id,
    run: run.id,
    scenario: run.scenario_path,
    ticks: run.ticks,
    artifact_chain_self_consistent: chainOk,
    base_tree_ticks: base?.ticks ?? null,
    base_tree_state_hash_of_hashes: base?.state_hash_of_hashes ?? null,
    artifact_state_hash_of_hashes: run.determinism.state_hash_of_hashes,
    identical_to_base_tree: baseOk,
    verdict: ok ? "PASS" : "FAIL",
  }));
}

rmSync(probePath, { force: true });
rmSync(requestsPath, { force: true });
console.log(
  failures === 0
    ? `[gk-stash] PASS: gkBehavior:false reproduces ${baseCommit.slice(0, 7)} per-tick hash chains for ${stashedRuns.length} run(s)`
    : `[gk-stash] FAIL: ${failures} stashed run(s) do not reproduce the base tree`,
);
process.exit(failures === 0 ? 0 : 1);
