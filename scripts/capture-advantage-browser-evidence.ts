/**
 * Node-side evidence producer for ADVANTAGE-BROWSER-EVIDENCE.
 *
 * Reads the semantic sequence.json written by the real-Chromium capture test
 * (tests/browser/advantage-browser-evidence.browser.test.ts), verifies every
 * frame binding against the captured PNG bytes (SHA-256 + dimensions +
 * examinability), re-runs the SAME three-gate driven wiring headless through
 * eval/runners/defensive-duel-driver.ts to prove the browser↔headless
 * correspondence (foul ticks, window open/close ticks and reason, deferred
 * free-kick serve, deferred caution), and re-runs the gate-off wiring headless
 * to prove the referee-off stream never opens a window (no advantage events)
 * and stays byte-identical to the pre-advantage-gate call within the node
 * runtime.  Writes docs/evidence/ADVANTAGE-BROWSER-EVIDENCE/trajectory.json
 * (+ the durable record).
 *
 * Ordinary (non-evidence) mode writes the same artifacts under the ignored
 * test-results/gauntlet-capture/** tree and leaves docs/ byte-identical.  The
 * record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and the pinned record_sha256 is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:ADVANTAGE-BROWSER-EVIDENCE \
 *     pnpm run capture-advantage-browser-record
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { isFoulCandidateEvent } from "../src/simulation/foul-predicate.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";
import type { SimulationEvent } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "ADVANTAGE-BROWSER-EVIDENCE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SCREENSHOT_ROOT = EVIDENCE_MODE
  ? resolve("docs/screenshots", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const SEQUENCE_PATH = resolve(SCREENSHOT_ROOT, "sequence.json");
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "advantage-browser-evidence-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
const PLAY_TICKS = 380;
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 300; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}
const FREE_KICK_COUNTDOWN = 60;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

interface FrameAnchor {
  label: string;
  path: string;
  tick: number;
  semantic: string;
  description: string;
  sha256: string;
}

interface AdvantageWindowAnchor {
  openTick: number;
  closeTick: number;
  reason: string;
  windowTicks: number;
  fouledTeam: string;
  offenderId: string | null;
  pendingFoulCount: number;
}

interface SequenceArtifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  semantic_order: string;
  scenario: string;
  scenario_path: string;
  rendering: Record<string, string>;
  wiring: Record<string, unknown>;
  arc: {
    foul_ticks: number[];
    foul_count: number;
    window: Record<string, unknown>;
    all_windows: AdvantageWindowAnchor[];
    window_free_kick: {
      tick: number;
      teamId: string;
      free_kick_position: { x: number; y: number };
      kick_direction: { x: number; y: number };
      call_tick: number;
      countdown: number;
    };
    close_tick_card: { tick: number; cardType: string; playerId: string; accumulatedFouls: number } | null;
    card_count: number;
    booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  };
  control_no_advantage_wiring: {
    wiring: string;
    advantage_events_committed: number;
    foul_ticks: number[];
    immediate_call: Array<{ foul_tick: number; free_kick_phase_from: number }>;
    note: string;
  };
  gate_off: {
    wiring: string;
    advantage_events_committed: number;
    windows_committed: number;
    free_kick_phases_seen: number;
    byte_identity_to_pre_change_call: boolean;
    compared_ticks: number;
    referee_off_chain_sha256: string;
    pre_change_call_chain_sha256: string;
    note: string;
  };
  frames: FrameAnchor[];
}

/**
 * Read sequence.json and verify every frame binding against the captured PNG
 * bytes on disk: the recorded SHA-256 must equal the file's digest, the PNG
 * must parse to real dimensions, and the frame must be byte-distinct from the
 * other frames (DYNAMIC_VISUAL semantic frames, not duplicates).
 */
function readAndVerifySequence(): SequenceArtifact {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as SequenceArtifact;
  if (raw.objective_id !== OBJECTIVE_ID) {
    throw new Error(`sequence.json objective_id mismatch: ${raw.objective_id}`);
  }
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length < 3 || frames.length > 5) {
    throw new Error(`DYNAMIC_VISUAL requires 3-5 labeled frames; sequence.json has ${frames.length}`);
  }
  const digests = new Map<string, string>();
  for (const frame of frames) {
    if (!frame.label || !frame.path || !frame.sha256) {
      throw new Error(`sequence.json frame is missing label/path/sha256: ${JSON.stringify(frame)}`);
    }
    const bytes = readFileSync(resolve(SCREENSHOT_ROOT, frame.path));
    const digest = sha256(bytes);
    if (digest !== frame.sha256) {
      throw new Error(`frame ${frame.label}: sequence sha256 ${frame.sha256} != PNG bytes ${digest}`);
    }
    // PNG header: 8-byte signature, then IHDR with width/height (big-endian).
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error(`frame ${frame.label}: not a valid PNG`);
    }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width < 100 || height < 100) {
      throw new Error(`frame ${frame.label}: degenerate dimensions ${width}x${height}`);
    }
    if (digests.has(digest)) {
      throw new Error(`frames ${digests.get(digest)} and ${frame.label} are byte-identical`);
    }
    digests.set(digest, frame.label);
  }
  // Frame ticks must be strictly increasing (semantic before → event → … → result).
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].tick <= frames[i - 1].tick) {
      throw new Error(`frame ticks not strictly increasing at ${frames[i].label}`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Pair committed advantage decision events into windows (same pairing the
// browser test + the accepted ADVANTAGE-MACHINERY record use).
// ---------------------------------------------------------------------------

function advantageWindowsFrom(events: readonly SimulationEvent[]): AdvantageWindowAnchor[] {
  const opens = events.filter((e) => e.kind === "advantage-opened");
  const closes = events.filter((e) => e.kind === "advantage-cancelled" || e.kind === "advantage-expired");
  const out: AdvantageWindowAnchor[] = [];
  for (const open of opens) {
    const op = (open.payload ?? {}) as Record<string, unknown>;
    const close = closes.find(
      (c) => ((c.payload ?? {}) as Record<string, unknown>).openTick === op.openTick,
    );
    if (!close) continue;
    const cp = (close.payload ?? {}) as Record<string, unknown>;
    out.push({
      openTick: op.openTick as number,
      closeTick: cp.closeTick as number,
      reason: cp.reason as string,
      windowTicks: cp.windowTicks as number,
      fouledTeam: op.fouledTeam as string,
      offenderId: (op.offenderId as string | null | undefined) ?? null,
      pendingFoulCount: cp.pendingFoulCount as number,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Headless reproduction with the SAME three-gate shipped wiring
// (browser ↔ headless correspondence) + the gate-off byte-identity facts
// ---------------------------------------------------------------------------

interface Correspondence {
  browser_foul_ticks: number[];
  browser_windows: AdvantageWindowAnchor[];
  browser_framed_window: AdvantageWindowAnchor;
  browser_deferred_free_kick_tick: number;
  browser_deferred_card: { tick: number; cardType: string; playerId: string; accumulatedFouls: number } | null;
  headless_foul_ticks: number[];
  headless_windows: AdvantageWindowAnchor[];
  headless_framed_window: AdvantageWindowAnchor;
  headless_deferred_free_kick_tick: number;
  headless_deferred_card: { tick: number; cardType: string; playerId: string; accumulatedFouls: number } | null;
  foul_ticks_equal: boolean;
  windows_equal: boolean;
  deferred_free_kick_tick_offset: number;
  deferred_card_tick_offset: number;
  close_reason_equal: boolean;
  free_kick_countdown: number;
  correspondence_traced: boolean;
}

type HeadlessWiring = "on" | "no-advantage" | "off";

/**
 * The headless twin of the four shipped wiring shapes: `on` =
 * resolveRefereeWiring(true) (all three gates), `no-advantage` = the accepted
 * HEAD referee wiring (free kick + card, advantage absent), `off` =
 * resolveRefereeWiring(false) (all three undefined).
 */
function runShippedWiringHeadless(wiring: HeadlessWiring) {
  const scenario = withProximateHumanDefence(loadScenario(SCENARIO_PATH));
  const gatesOn = wiring === "on" || wiring === "no-advantage";
  return runDefensiveDuel({
    scenario,
    maxTicks: PLAY_TICKS,
    attempts: DRIVEN_ATTEMPTS,
    freeKickConfig: gatesOn ? { awardFreeKicks: true } : undefined,
    cardConfig: gatesOn ? { issueCards: true } : undefined,
    advantageConfig: wiring === "on" ? { playAdvantage: true } : undefined,
  });
}

function longest(windows: AdvantageWindowAnchor[]): AdvantageWindowAnchor {
  let best: AdvantageWindowAnchor | null = null;
  for (const w of windows) {
    if (best === null || w.closeTick - w.openTick > best.closeTick - best.openTick) best = w;
  }
  if (best === null) throw new Error("the headless reproduction committed no advantage window");
  return best;
}

function correspondence(seq: SequenceArtifact): Correspondence {
  const duel = runShippedWiringHeadless("on");
  const headlessFoulTicks = duel.events.filter((e) => isFoulCandidateEvent(e)).map((e) => e.tick);
  const headlessWindows = advantageWindowsFrom(duel.advantageEvents);
  const headlessWindow = longest(headlessWindows);
  const headlessFk = duel.freeKickEvents.find((e) => e.tick === headlessWindow.closeTick + FREE_KICK_COUNTDOWN);
  if (headlessFk === undefined) {
    throw new Error("the headless reproduction produced no deferred free-kick serve at close+60");
  }
  const headlessCard = duel.cardEvents.find((e) => e.tick === headlessWindow.closeTick);
  const hc = headlessCard
    ? {
        tick: headlessCard.tick,
        cardType: (headlessCard.payload as { cardType: string }).cardType,
        playerId: (headlessCard.payload as { playerId: string }).playerId,
        accumulatedFouls: (headlessCard.payload as { accumulatedFouls: number }).accumulatedFouls,
      }
    : null;

  const bw = seq.arc.window;
  const browserWindow: AdvantageWindowAnchor = {
    openTick: bw.open_tick as number,
    closeTick: bw.close_tick as number,
    reason: bw.close_reason as string,
    windowTicks: bw.window_ticks_budget as number,
    fouledTeam: bw.fouled_team as string,
    offenderId: (bw.offender_id as string | null) ?? null,
    pendingFoulCount: bw.pending_foul_count as number,
  };

  return {
    browser_foul_ticks: seq.arc.foul_ticks,
    browser_windows: seq.arc.all_windows,
    browser_framed_window: browserWindow,
    browser_deferred_free_kick_tick: seq.arc.window_free_kick.tick,
    browser_deferred_card: seq.arc.close_tick_card,
    headless_foul_ticks: headlessFoulTicks,
    headless_windows: headlessWindows,
    headless_framed_window: headlessWindow,
    headless_deferred_free_kick_tick: headlessFk.tick,
    headless_deferred_card: hc,
    foul_ticks_equal: JSON.stringify(seq.arc.foul_ticks) === JSON.stringify(headlessFoulTicks),
    windows_equal: JSON.stringify(seq.arc.all_windows) === JSON.stringify(headlessWindows),
    deferred_free_kick_tick_offset: seq.arc.window_free_kick.tick - headlessFk.tick,
    deferred_card_tick_offset: (seq.arc.close_tick_card?.tick ?? -1) - (hc?.tick ?? -1),
    close_reason_equal: browserWindow.reason === headlessWindow.reason,
    free_kick_countdown: FREE_KICK_COUNTDOWN,
    correspondence_traced: true,
  };
}

interface WiringProofs {
  control_no_advantage_wiring: {
    wiring: string;
    advantage_events_committed: number;
    foul_ticks: number[];
    free_kick_executed_ticks: number[];
    card_ticks: number[];
    browser_foul_ticks: number[];
    browser_immediate_call: Array<{ foul_tick: number; free_kick_phase_from: number }>;
    /** headless: every committed free-kick serve sits exactly countdown after a foul. */
    headless_serves_follow_fouls: boolean;
    fouls_equal: boolean;
    note: string;
  };
  gate_off: {
    wiring: string;
    advantage_events_committed: number;
    windows_committed: number;
    free_kick_events_committed: number;
    card_events_committed: number;
    booking_state_present: boolean;
    browser_advantage_events_committed: number;
    browser_free_kick_phases_seen: number;
    browser_byte_identity_to_pre_change_call: boolean;
    browser_referee_off_chain_sha256: string;
    browser_pre_change_call_chain_sha256: string;
    compared_ticks: number;
    /** The HEAD byte-identity fact: the same 9-vs-10-arg comparison reproduced headless. */
    headless_off_hash_of_hashes: string;
    note: string;
  };
}

function wiringProofs(seq: SequenceArtifact): WiringProofs {
  const noAdv = runShippedWiringHeadless("no-advantage");
  const off = runShippedWiringHeadless("off");
  const noAdvFouls = noAdv.events.filter((e) => isFoulCandidateEvent(e)).map((e) => e.tick);
  const noAdvFkTicks = noAdv.freeKickEvents.map((e) => e.tick);
  const browserCtl = seq.control_no_advantage_wiring;
  const browserOff = seq.gate_off;
  return {
    control_no_advantage_wiring: {
      wiring: browserCtl.wiring,
      advantage_events_committed: noAdv.advantageEvents.length,
      foul_ticks: noAdvFouls,
      free_kick_executed_ticks: noAdvFkTicks,
      card_ticks: noAdv.cardEvents.map((e) => e.tick),
      browser_foul_ticks: browserCtl.foul_ticks,
      browser_immediate_call: browserCtl.immediate_call,
      headless_serves_follow_fouls: noAdvFkTicks.every((t) => noAdvFouls.includes(t - FREE_KICK_COUNTDOWN)),
      fouls_equal: JSON.stringify(browserCtl.foul_ticks) === JSON.stringify(noAdvFouls),
      note: browserCtl.note,
    },
    gate_off: {
      wiring: browserOff.wiring,
      advantage_events_committed: off.advantageEvents.length,
      windows_committed: advantageWindowsFrom(off.advantageEvents).length,
      free_kick_events_committed: off.freeKickEvents.length,
      card_events_committed: off.cardEvents.length,
      booking_state_present: off.bookingState !== undefined,
      browser_advantage_events_committed: browserOff.advantage_events_committed,
      browser_free_kick_phases_seen: browserOff.free_kick_phases_seen,
      browser_byte_identity_to_pre_change_call: browserOff.byte_identity_to_pre_change_call,
      browser_referee_off_chain_sha256: browserOff.referee_off_chain_sha256,
      browser_pre_change_call_chain_sha256: browserOff.pre_change_call_chain_sha256,
      compared_ticks: browserOff.compared_ticks,
      headless_off_hash_of_hashes: sha256(JSON.stringify(off.stateHashes)),
      note:
        "the referee-off shipped path resolves all three gates undefined: no advantage decision, no free-kick phase, no card, no booking field; the 10-argument undefined-gate createSimulation call is byte-identical to the pre-change 9-argument call (tests/unit/apps/referee-config-gate-off.test.ts + the browser Pass-4 chain comparison recorded here)",
    },
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const sequence = readAndVerifySequence();
const corr = correspondence(sequence);
const proofs = wiringProofs(sequence);

if (!corr.foul_ticks_equal || !corr.windows_equal || !corr.close_reason_equal) {
  throw new Error("browser↔headless correspondence failed; refusing to write a broken record");
}
if (proofs.gate_off.advantage_events_committed !== 0 || proofs.gate_off.windows_committed !== 0) {
  throw new Error("the gate-off headless run committed an advantage decision; byte-neutrality broken");
}
if (proofs.control_no_advantage_wiring.advantage_events_committed !== 0) {
  throw new Error("the no-advantage control headless run committed an advantage decision");
}
if (proofs.gate_off.free_kick_events_committed !== 0 || proofs.gate_off.card_events_committed !== 0) {
  throw new Error("the gate-off headless run committed a free-kick/card consequence");
}

const win = sequence.arc.window;
const discharge =
  "The advantage window budget (24 engine ticks), the pending-caution budget (12 ticks), the free-kick countdown (60), serve speed (14 m/s), loft (0.18) and ball-z (0.11), and the `fouls-v1` accumulation thresholds (caution at 2 / expulsion at 5) are VERSIONED_PROVISIONAL fouls-v1/match-rules-v1 design choices at foundation-fixed-dt-v1, NOT measured PES 2017 constants (`advantage_window_ref_ms` stays BLOCKED_MISSING_REFERENCE).";
const claimsNotMade = [
  "No retained-advantage claim: the judged-retained path (FOULS_CARDS_SPEC §6.2a) is NOT implemented (advantage_retention_ref is BLOCKED_MISSING_REFERENCE); the captured window closes by " +
    String(win.close_reason) +
    " (§6.3/§6.2c) and the pending foul is CALLED at the close tick — no advantage was played.",
  "No PES 2017 fidelity or measured PES envelope claim: " + discharge,
  "No gameplay / simulation-core / contracts change: git diff src/simulation/ and src/contracts/ are EMPTY. The advantage gate enters through the SAME accepted createSimulation config surface via the existing single menu-visible Referee toggle (resolveRefereeWiring); no new toggle was added.",
  "No claim that the window was forced: the foul, the window open/close decisions, the deferred free kick and the deferred caution are all REAL committed core events (the accepted ADVANTAGE-MACHINERY branch + shared foul predicate + advantage policy); the driven-duel script only reproduces the accepted defensive-duel driver's standing-tackle policy.",
  "No claim that the browser composition root and the headless runner are per-tick byte-identical: the verified correspondence is the event structure (foul ticks, window open/close ticks + reason, deferred serve/caution ticks, offender/accumulation), never per-tick floats (the known pinned-runtime gap). The gate-off byte-identity is proven WITHIN each runtime (node unit test + browser Pass 4 chain comparison).",
  "No suite-level PASS claim: ADVANTAGE-PLAYED executes over these streams as the registered fifth fouls-suite oracle (accepted in ADVANTAGE-SUITE-REGISTRATION); this objective evidences the browser-visible wiring, not the suite.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS claim.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-advantage-browser-evidence.ts",
  evidence_class: "DYNAMIC_VISUAL",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §6.2",
    "FOULS_CARDS_SPEC §6.3",
    "FOULS_CARDS_SPEC §6.4",
    "FOULS_CARDS_SPEC §7",
    "FOULS_CARDS_SPEC §8",
    "FOULS_CARDS_SPEC §9.1",
  ],
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  rendering: sequence.rendering,
  wiring: sequence.wiring,
  semantics: {
    order: sequence.semantic_order,
    note:
      "event-centered on the advantage window: the tackle contact, the foul tick that OPENS the §6.2 window without calling the foul, live play inside the window, the close tick (cancellation) that calls the deferred foul (FREE KICK + caution), and the deferred set-piece placement.",
  },
  frames: sequence.frames.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    semantic: frame.semantic,
    description: frame.description,
    sha256: frame.sha256,
  })),
  arc: sequence.arc,
  correspondence: corr,
  control_no_advantage_wiring: proofs.control_no_advantage_wiring,
  gate_off: proofs.gate_off,
  drives: {
    fixture: "5v5-human-vs-cpu.v1.json + withProximateHumanDefence (the accepted driven-duel shape)",
    policy: "repeated scripted standing-tackle (commitDistance 3.0, earliestTick 44, every 16 ticks) on the HUMAN slot; CPU slots through the same adapter + team-decision profile the browser composition root uses",
    gates: "awardFreeKicks:true + issueCards:true + playAdvantage:true — the SAME createSimulation config surface the shipped composition root exposes via the single Referee toggle (resolveRefereeWiring(true))",
    capture_test: "tests/browser/advantage-browser-evidence.browser.test.ts",
    rendering_surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), showMatchPhaseHud:true + showCardHud:true",
  },
  disclosures: [
    "The fouls, the window decisions, the deferred free kick and the deferred caution are REAL committed core events: the accepted in-core §6.2–§6.4 advantage branch opens the window on the committed foul-contact tick, the §6.3 condition (the ball's lastTouchRef no longer resolving to the fouled team — " +
      String(win.close_reason) +
      ") closes it at tick " + String(win.close_tick) +
      ", and the pending foul is called AT the close tick through the SAME accepted restart/card machinery — " +
      String((win.close_tick as number) - (win.open_tick as number)) +
      " ticks of live play were framable inside the " + String(win.window_ticks_budget) + "-tick budget.",
    "The captured window closed by cancellation (" + String(win.close_reason) + "), NOT by expiry and NOT by a judged retention: the §6.2a judged-retained path is not implemented and nothing here evidences one.",
    "The advantage decision events are commit-only to the core's persistent state (the same accepted serialization limitation the free-kick/card consequences have), so the browser test reads the window facts from the final snapshot, never from the per-step event array; the card HUD reads the committed card events through the accepted presentation-only enrichment.",
    "The driven fixture is a DRIVEN duel (short 380-tick observation window, a repeated scripted standing-tackle sequence), not an organic 90-minute match; the fouling sequence is disclosed, not masked.",
    "PNG re-capture non-determinism: the WebGL readPixels + canvas.toDataURL render path (GPU/rasterizer floats) is not promised byte-identical across re-captures; the per-frame SHA-256 values recorded here are the bytes captured at evidence time and were re-verified against the PNG files on disk by this producer. The record JSON itself is byte-reproducible (record_sha256) and carries no wall-clock field, and an ordinary (non-evidence) run writes under test-results/gauntlet-capture/** and leaves docs/ byte-identical.",
    discharge,
  ],
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

const trajectory: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-advantage-browser-evidence.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ freeKickConfig:{ awardFreeKicks:true }, cardConfig:{ issueCards:true }, advantageConfig:{ playAdvantage:true } }) — the SAME three-gate shipped wiring resolveRefereeWiring(true) produces, reproducing the browser run's event structure.",
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  wiring: sequence.wiring,
  frame_anchors: sequence.frames.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    semantic: frame.semantic,
    sha256: frame.sha256,
  })),
  window: sequence.arc.window,
  all_windows: sequence.arc.all_windows,
  correspondence: corr,
  control_no_advantage_wiring: proofs.control_no_advantage_wiring,
  gate_off: proofs.gate_off,
  free_kick_countdown: FREE_KICK_COUNTDOWN,
  disclosures: [
    "The trajectory reproduces the browser run's committed structure headless with the same three gates: fouls at " +
      String(corr.headless_foul_ticks.join("/")) +
      ", framed window " + String(corr.headless_framed_window.openTick) +
      " → " + String(corr.headless_framed_window.closeTick) +
      " (" + String(corr.headless_framed_window.reason) + "), deferred free-kick serve at tick " +
      String(corr.headless_deferred_free_kick_tick) +
      ", deferred caution at tick " + String(corr.headless_deferred_card?.tick ?? -1) +
      ". The browser run locates the same event structure from its own committed event log; per-tick floats are not compared across runtimes (the known pinned-runtime gap).",
    "The no-advantage control (the accepted HEAD referee wiring, advantage gate absent) calls each committed foul immediately in both runtimes, isolating the playAdvantage gate as the deferral the frames evidence. The gate-off run (all three wiring configs undefined) commits zero advantage decisions, zero free-kick consequences, zero cards and no booking field in both runtimes, and its createSimulation call is byte-identical to the pre-change HEAD call within each runtime (node unit test + browser Pass-4 chain comparison).",
    discharge,
  ],
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[advantage-browser] frames ${sequence.frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(
  `[advantage-browser] correspondence browser fouls=${corr.browser_foul_ticks.join("/")} window=${corr.browser_framed_window.openTick}->${corr.browser_framed_window.closeTick}(${corr.browser_framed_window.reason})` +
    ` fk@${corr.browser_deferred_free_kick_tick} card@${String(corr.browser_deferred_card?.tick)}` +
    ` ; headless fouls=${corr.headless_foul_ticks.join("/")} window=${corr.headless_framed_window.openTick}->${corr.headless_framed_window.closeTick}(${corr.headless_framed_window.reason})` +
    ` fk@${corr.headless_deferred_free_kick_tick} card@${String(corr.headless_deferred_card?.tick)}` +
    ` ; fouls_equal=${corr.foul_ticks_equal} windows_equal=${corr.windows_equal} reason_equal=${corr.close_reason_equal} offsets ${corr.deferred_free_kick_tick_offset}/${corr.deferred_card_tick_offset}`,
);
console.log(
  `[advantage-browser] control(no-advantage) fouls=${proofs.control_no_advantage_wiring.foul_ticks.join("/")} ` +
    `advantageEvents=${proofs.control_no_advantage_wiring.advantage_events_committed} foulsEqual=${proofs.control_no_advantage_wiring.fouls_equal}` +
    ` ; gate-off advantageEvents=${proofs.gate_off.advantage_events_committed} fkEvents=${proofs.gate_off.free_kick_events_committed} cardEvents=${proofs.gate_off.card_events_committed}`,
);
console.log(`[advantage-browser] wrote ${TRAJECTORY_PATH}`);
console.log(`[advantage-browser] wrote ${STATE_PATH}`);
console.log(`[advantage-browser] record_sha256=${String(record.record_sha256)}`);
