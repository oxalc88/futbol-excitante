/**
 * Node-side evidence producer for EVAL-HYGIENE-CONSOLIDATION (BOOKKEEPING).
 *
 * Consolidates the four reviewer non-binding cleanups with guards:
 *   (1) dead `chasers` variable in `checkRestartNearestOnly` dropped;
 *   (2) the conservative mirror-offset disclosure tightened in the
 *       serializeRestartFacts designation comment;
 *   (3) the `_keeperPressExclusions` gated-run/counter-read interaction
 *       documented (no test — documentation-only);
 *   (4) the HUD ortho camera resize re-anchoring (presentation-only,
 *       draw-only, no football-outcome change) with a browser-test guard.
 *
 * The record is a deterministic state/tooling audit: it asserts the source-level
 * presence of each cleanup (dead variable absent, comments present, ResizeObserver
 * present) and pins the SHA-256 of every touched source file. It carries NO
 * wall-clock field, so consecutive ordinary-mode runs are byte-identical and
 * leave `docs/` byte-identical.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:EVAL-HYGIENE-CONSOLIDATION`. An ordinary run writes
 * the same artifact under the ignored `test-results/gauntlet-capture/**` tree.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:EVAL-HYGIENE-CONSOLIDATION \
 *     mise exec -- pnpm exec tsx scripts/capture-eval-hygiene-consolidation.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const OBJECTIVE_ID = "EVAL-HYGIENE-CONSOLIDATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const STATE_PATH = resolve(OUTPUT_ROOT, "eval-hygiene-consolidation.json");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(path: string): string {
  return readFileSync(resolve(path), "utf-8");
}

const RULES_RESTART = "eval/oracles/rules-restart.ts";
const HEADLESS_MATCH = "eval/runners/headless-match.ts";
const GOALKEEPER_ROLE = "src/adapters/input-browser/goalkeeper-role.ts";
const RENDERER = "src/adapters/renderer-three/renderer.ts";

// Source-level presence checks (deterministic; no wall-clock, no simulation).
const deadChasersAbsent = !read(RULES_RESTART).includes("const chasers = new Set<string>()");
const mirrorOffsetDisclosed = read(HEADLESS_MATCH).includes("MIRROR OFFSET (conservative, disclosed)");
const counterHygieneDoc = read(GOALKEEPER_ROLE).includes("COUNTER HYGIENE (EVAL-HYGIENE-CONSOLIDATION)");
const counterHygieneCallDoc = read(HEADLESS_MATCH).includes("COUNTER HYGIENE (EVAL-HYGIENE-CONSOLIDATION)");
const hudResizeObserver = read(RENDERER).includes("new ResizeObserver(() => handleResize())");
const hudResizeHandle = read(RENDERER).includes("function handleResize()");
const hudResizeDisposed = read(RENDERER).includes("resizeObserver.disconnect()");

const sourceHashes: Record<string, string> = {};
for (const file of [RULES_RESTART, HEADLESS_MATCH, GOALKEEPER_ROLE, RENDERER]) {
  sourceHashes[file] = sha256(read(file));
}

const cleanups = [
  {
    id: "dead-chasers-variable",
    file: RULES_RESTART,
    change:
      "Dropped the dead `chasers` Set in checkRestartNearestOnly. It was computed from the per-team designated chaser but never read; the enforced falsifier for the §12 rule 2 'only one designated chaser converges' criterion is the clump count (a team clump >2 bodies within the huddle radius FAILs).",
    verdict_change: false,
    source_check: { dead_chasers_absent: deadChasersAbsent },
    guard: "No new test — the existing rules gate must stay green (173/173).",
  },
  {
    id: "mirror-offset-disclosure",
    file: HEADLESS_MATCH,
    change:
      "Tightened the serializeRestartFacts designation comment to state precisely that the designation mirror pairs the exact adapter phase (`coreMatchPhases[i]`) with the POST-STEP ball reference (`observations[i].ball.lastTouchRef`), a conservative one-tick offset that can only shorten a restart window or false-fail the anti-huddle criteria — never fabricate a PASS.",
    verdict_change: false,
    source_check: { mirror_offset_disclosed: mirrorOffsetDisclosed },
    guard: "Comment-only; no runtime change. The rules gate must stay green.",
  },
  {
    id: "keeper-press-exclusions-counter-hygiene",
    file: GOALKEEPER_ROLE,
    change:
      "Documented the gated-run/counter-read interaction: the post-loop serializeRestartFacts designation serialization calls `assignChaseRoles` → `designatePresser`, which increments `_keeperPressExclusions`. Never combine a gated designation run with a `getKeeperPressExclusionActivations()` read in one process (reset via `resetKeeperMechanismCounters()` between them, or read in a fresh process).",
    verdict_change: false,
    source_check: {
      counter_hygiene_doc: counterHygieneDoc,
      counter_hygiene_call_doc: counterHygieneCallDoc,
    },
    guard: "Documentation-only; no test required. This is a diagnostics counter, not a gameplay value.",
  },
  {
    id: "hud-ortho-camera-resize-re-anchoring",
    file: RENDERER,
    change:
      "Added a container resize re-anchor (ResizeObserver) for the opt-in match-phase HUD ortho camera + top-left sprite, plus the renderer canvas + main camera aspect. Presentation-only and draw-only; never reads or writes a football outcome.",
    verdict_change: false,
    source_check: {
      hud_resize_observer: hudResizeObserver,
      hud_resize_handle: hudResizeHandle,
      hud_resize_disposed: hudResizeDisposed,
    },
    guard: "Browser-test guard (tests/browser/hud-ortho-resize.browser.test.ts): frustum re-anchor, canvas follows container, HUD present at top-left, null HUD camera when not enabled.",
  },
];

const claimsNotMade = [
  "Zero verdict changes: the dead variable was unread, the mirror-offset change is a comment, the counter-hygiene change is documentation-only, and the HUD change is presentation-only/draw-only.",
  "No suite-level PASS claim.",
  "No PROMOTION claim.",
  "No FOUNDATION_LAB_PASS claim.",
  "No PES 2017 fidelity / measured PES envelope claim.",
  "No invented reference envelope or tolerance.",
  "No accepted evidence record mutation; no core/simulation/contracts change (the renderer HUD change is presentation-layer).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "BOOKKEEPING",
  produced_by: "scripts/capture-eval-hygiene-consolidation.ts",
  description:
    "Consolidation of the four reviewer non-binding cleanups with guards. Zero verdict changes anywhere: every oracle check's semantics are byte-identical post-cleanup; the HUD re-anchoring changes only presentation at resize.",
  cleanups,
  source_hashes: sourceHashes,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[eval-hygiene] wrote ${STATE_PATH}`);
console.log(`[eval-hygiene] record_sha256=${String(record.record_sha256)}`);
console.log(`[eval-hygiene] dead_chasers_absent=${deadChasersAbsent} mirror_offset_disclosed=${mirrorOffsetDisclosed} counter_hygiene=${counterHygieneDoc} hud_resize=${hudResizeObserver}`);
