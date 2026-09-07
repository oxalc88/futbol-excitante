/**
 * Node-side evidence producer for HUMAN-BALL-SERVER-DECISION (BOOKKEEPING).
 *
 * Records the DECISION on the deferred literal pass-button ball-server (the
 * human presses pass at the restart window and the human's pass executes the
 * serve). The literal server is deferred behind a disclosed core change: the
 * core's countdown-zero auto-serve (applyThrowIn / applyGoalKick /
 * applyCornerKick) executes unconditionally with no input path, and a pass
 * action requires player-ball contact (contact-system.ts) that cannot exist
 * during an out-of-play window.
 *
 * This is a BOOKKEEPING objective: the decision is RECORDED, not executed.
 * Zero gameplay/source change in src/, src/adapters/, eval/, gauntlet/, specs/.
 * The record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and leave `docs/` byte-identical.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-DECISION`. An ordinary run writes
 * the same artifact under the ignored `test-results/gauntlet-capture/**` tree.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-DECISION \
 *     mise exec -- pnpm exec tsx scripts/capture-human-ball-server-decision.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const OBJECTIVE_ID = "HUMAN-BALL-SERVER-DECISION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const STATE_PATH = resolve(OUTPUT_ROOT, "human-ball-server-decision.json");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(path: string): string {
  return readFileSync(resolve(path), "utf-8");
}

const SIMULATION = "src/simulation/loop/simulation.ts";
const CONTACT_SYSTEM = "src/simulation/contacts/contact-system.ts";
const FOUNDATION = "src/simulation/config/foundation.ts";
const MATCH_RULES_SPEC = "specs/MATCH_RULES_SPEC.md";

// Source-level facts (deterministic; no wall-clock, no simulation).
// Countdown-zero auto-serve branches execute the serve unconditionally.
const throwInBranch = read(SIMULATION).includes(
  "if (state.throwInCountdown <= 0) {",
);
const throwInApply = read(SIMULATION).includes(
  "applyThrowIn();",
);
const goalKickBranch = read(SIMULATION).includes(
  "if (state.goalKickCountdown <= 0) {",
);
const goalKickApply = read(SIMULATION).includes(
  "applyGoalKick();",
);
const cornerKickBranch = read(SIMULATION).includes(
  "if (state.cornerKickCountdown <= 0) {",
);
const cornerKickApply = read(SIMULATION).includes(
  "applyCornerKick();",
);
// A pass action requires player-ball proximity within passRadius.
const passRadiusValue = read(FOUNDATION).match(/passRadius:\s*\{ value: ([0-9.]+)/)?.[1] ?? null;
const passActionRequiresContact = read(CONTACT_SYSTEM).includes(
  "action === \"pass\"",
);
// The pass action is reached only inside the contact-resolution candidate scan,
// i.e. it requires a frame AND a player within the pass radius of the ball.
const contactDistCheck = read(CONTACT_SYSTEM).includes(
  "if (dist <= effectiveRadius) {",
);
// The restart criteria are named in the spec §15 and adjudicate the serve.
const throwInServeCriterion = read(MATCH_RULES_SPEC).includes("MATCH-THROW-IN-SERVE");
const throwInTimerFreezeCriterion = read(MATCH_RULES_SPEC).includes("MATCH-THROW-IN-TIMER-FREEZE");

const sourceHashes: Record<string, string> = {};
for (const file of [SIMULATION, CONTACT_SYSTEM, FOUNDATION, MATCH_RULES_SPEC]) {
  sourceHashes[file] = sha256(read(file));
}

const coreMachinery = {
  countdown_zero_auto_serve: {
    branches: [
      {
        phase: "throw-in",
        branch: "if (state.matchPhase === \"throw-in\") { state.throwInCountdown--; if (state.throwInCountdown <= 0) { applyThrowIn(); state.matchPhase = \"playing\"; ... } }",
        behavior:
          "On countdown zero the core unconditionally calls applyThrowIn(), sets matchPhase to 'playing', and clears the throw-in fields. No input path is consulted at this point; the serve is deterministic (nearest-receiver direction).",
        apply_fn: "applyThrowIn",
      },
      {
        phase: "goal-kick",
        branch: "if (state.matchPhase === \"goal-kick\") { state.goalKickCountdown--; if (state.goalKickCountdown <= 0) { applyGoalKick(); state.matchPhase = \"playing\"; ... } }",
        behavior:
          "On countdown zero the core unconditionally calls applyGoalKick(), sets matchPhase to 'playing', and clears the goal-kick fields. No input path is consulted.",
        apply_fn: "applyGoalKick",
      },
      {
        phase: "corner-kick",
        branch: "if (state.matchPhase === \"corner-kick\") { state.cornerKickCountdown--; if (state.cornerKickCountdown <= 0) { applyCornerKick(); state.matchPhase = \"playing\"; ... } }",
        behavior:
          "On countdown zero the core unconditionally calls applyCornerKick(), sets matchPhase to 'playing', and clears the corner-kick fields. The corner cross target is a fixed penalty-area point.",
        apply_fn: "applyCornerKick",
      },
    ],
    facts_checked: {
      throwInBranch,
      throwInApply,
      goalKickBranch,
      goalKickApply,
      cornerKickBranch,
      cornerKickApply,
    },
  },
  pass_requires_contact: {
    mechanism:
      "A pass action (PASS_BIT) is resolved only inside the contact-system candidate scan: the player must have the frame AND be within passRadius of the ball (and the ball must be in a contactable state under the max-approach check). During an out-of-play window the ball is out of play (set-piece placement, lastTouchRef null, not at the taker), so the contact-system pass path cannot fire as the serve.",
    facts_checked: {
      passRadiusValue,
      passActionRequiresContact,
      contactDistCheck,
    },
  },
  pass_gated_serve_path: {
    shape:
      "At countdown zero, instead of unconditionally calling apply*, check whether the designated taker (state.<restart>TakerId) is human-controlled (its control slot mode === 'HUMAN'). If human-controlled, keep the restart phase open (do NOT set matchPhase='playing'), wait for a human PASS_BIT InputFrame within a bounded window; on the pass, derive the serve direction from the input (moveX/moveY) or the taker bodyHeading and execute the serve, then set matchPhase='playing'. If the taker is CPU (or no pass arrives within the bounded window), the CPU auto-serve fires as today.",
    needed_state:
      "A new closure/world field for the human-gated serve wait (e.g. humanServeWaitCountdown) and a dedicated serve-execution path that consumes the human pass direction — NOT the contact-system pass path.",
    needed_phase:
      "The restart phase must remain a frozen phase during the wait so the timer-freeze / anti-huddle freeze semantics treat it correctly.",
  },
  determinism_implications: {
    auto_serve_is_deterministic:
      "Today the auto-serve fires on a fixed countdown-zero tick for a fixed input program; the accepted pins (manifest SHAs, per-run state_hash_of_hashes) are computed over runs where the countdown completes at that fixed tick.",
    human_gated_serve_wait:
      "A human-gated serve introduces a variable wait tick: the serve tick depends on the tick at which the human's pass InputFrame arrives (bounded by the wait window). For a given input program it remains deterministic (tick-indexed inputs), but the serve tick is now input-timing-dependent rather than countdown-fixed.",
    two_run_attestation:
      "The SUITE-DETERMINISTIC-TWO-RUN attestation runs CPU streams (no human input), so it is unaffected as long as the CPU fallback path stays byte-identical (preserved by the gate). A NEW human-served stream would need its own two-run attestation, and its serve tick is input-timing-dependent.",
    restart_window_machinery:
      "The window-scoped humanWindowTaken marker and the freeze exemption were designed for the receiver-steering realization. A human-gated serve changes when the window closes (the serve fires on the pass, not at countdown zero), affecting the anti-huddle freeze duration, the re-arm timing, and the 'only the taker may break it' first-touch semantics.",
  },
  conformance_implications: {
    criteria_to_reevaluate: [
      "MATCH-THROW-IN-SERVE (and the analogous goal-kick / corner serve criteria): a human-served stream changes the served target/direction (human-chosen). The criterion attests serve legality/quality, not which receiver, so it may still PASS, but the oracle must handle the human-chosen direction.",
      "MATCH-THROW-IN-TIMER-FREEZE / MATCH-GOAL-KICK-TIMER-FREEZE / MATCH-CORNER-KICK-TIMER-FREEZE: the new human-gated wait phase must be treated as a frozen phase.",
      "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / MATCH-KICKOFF-FIRST-TOUCH: the window-close semantics change (the serve fires on the pass; first touch after the serve).",
      "MATCH-TIMER-FREEZE: the new wait phase must not decrement the match clock.",
    ],
    current_coverage:
      "No human-served stream is currently attested. All attested restart streams are CPU-served (or receiver-steered, where the core's countdown-zero auto-serve still fires). Registering a human-served stream requires new oracles/bindings and a re-run of the affected criteria.",
  },
};

const alternatives = [
  {
    id: "receiver-steering-destination-control",
    status: "DELIVERED (HUMAN-RESTART-CONTROL, 5b15992)",
    covers:
      "The human directs WHERE the restart is served by steering a receiving body on the awarding team; the core's nearest-receiver serve re-targets toward the human-steered position. Covers destination/direction control for throw-in and goal-kick (nearest-receiver re-target).",
    does_not_cover:
      "The human being the literal server (pass-button), control over serve timing, serve speed/power, or the corner cross target (a fixed penalty-area point).",
    cost: "No core change; the accepted pins are unchanged.",
  },
  {
    id: "human-gated-serve-wait",
    status: "MINIMAL CORE CHANGE (not implemented)",
    covers:
      "A bounded wait for a human pass at countdown zero, so the human's pass executes the serve. Preserves the CPU fallback.",
    does_not_cover:
      "A genuine pass-reception serving path (the human pass is still consumed as a serve-direction signal, not a full contact-system pass).",
    cost:
      "Still a core change: a wait state field, a new frozen phase, and a changed deterministic serve tick. Requires re-attestation of any human-served stream, a timer-freeze rule extension, and new SERVE/TIMER-FREEZE/FIRST-TOUCH conformance.",
  },
  {
    id: "pass-reception-serving-path",
    status: "FULLER CORE CHANGE (not implemented)",
    covers:
      "A genuine pass-reception serving path where the human's pass (via the contact-system or a dedicated path) executes the serve.",
    does_not_cover:
      "Nothing additional beyond the human-gated serve wait; it is the largest change and the most conformance surface.",
    cost:
      "Largest change; touches the core's restart + contact + input machinery. Highest determinism/pin and conformance cost.",
  },
  {
    id: "do-nothing",
    status: "DEFER INDEFINITELY (not chosen)",
    covers:
      "Keep receiver-steering; never implement the literal ball-server.",
    does_not_cover:
      "The literal pass-button serve.",
    cost: "Lowest cost; but leaves the pass-button realization permanently open.",
  },
];

const decision = {
  verdict: "DEFER",
  reasons: [
    "The delivered receiver-steering realization (HUMAN-RESTART-CONTROL) already covers the meaningful human influence on restart destination/direction for the primary restart types (throw-in, goal-kick via nearest-receiver re-target). It does not cover the literal pass-button serve, serve timing, or serve power, but those are lower-value than the destination/direction control already delivered.",
    "The literal pass-button ball-server requires a core change with real determinism/pin costs: a variable serve wait tick (input-timing-dependent), a new frozen restart-wait phase, and re-attestation of any human-served stream. The CPU fallback must stay byte-identical, and the two-run DETERMINISTIC attestation only covers CPU streams.",
    "There is no registered conformance path for a human-served stream. The SERVE, TIMER-FREEZE, and FIRST-TOUCH criteria would need re-evaluation and new oracles/bindings.",
    "The next horizon item (RELEASE-0.9.7-CONSOLIDATION) has higher value: it consolidates the v29-v32 playable+executable gains. Adding a new core-owned serving path now would expand the conformance surface without a matching near-term gameplay value.",
    "The pass-button realization is NOT left as an open thread: this record documents the exact core change, the determinism/pin cost, the alternatives, and a concrete future objective outline (HUMAN-BALL-SERVER-LITERAL) with its own conformance path, so it can be scheduled when it has higher relative value.",
  ],
  not_a_hedge:
    "The verdict is DEFER, a clear recorded decision with concrete reasons, not an implement-now/not-sure hedge. The implement-now plan is recorded as a future objective outline (below) for scheduling, not as a commitment to implement now.",
};

const future_objective_outline = {
  id: "HUMAN-BALL-SERVER-LITERAL",
  scope:
    "Implement the literal pass-button ball-server: gate the countdown-zero auto-serve on taker human-control; add a bounded human-pass wait; preserve the CPU fallback byte-identical.",
  determinism:
    "Add a two-run attestation for a human-served stream; re-pin any affected accepted stream; confirm the CPU fallback is byte-identical.",
  conformance:
    "Register new oracles for the serve-direction source (human-chosen), the wait-phase timer freeze, and the window-close/first-touch semantics; re-evaluate SERVE / TIMER-FREEZE / FIRST-TOUCH on human-served streams.",
  evidence_class: "MULTI_TICK (trajectory) or DYNAMIC_VISUAL (browser frame of the human's pass serving the restart)",
  claims_not_made:
    "No PES fidelity / no PROMOTION; BLOCKED_MISSING_REFERENCE references stay blocked.",
};

const claimsNotMade = [
  "No implementation: the decision is RECORDED, not executed. Zero gameplay/source change in src/, src/adapters/, eval/, gauntlet/, specs/.",
  "No suite-level PASS claim.",
  "No PROMOTION claim.",
  "No FOUNDATION_LAB_PASS claim.",
  "No PES 2017 fidelity / measured PES envelope claim.",
  "No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE.",
  "No claim that a human ball-server exists or that the human becomes the literal server — the verdict is DEFER with the literal server recorded as a future objective.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "BOOKKEEPING",
  produced_by: "scripts/capture-human-ball-server-decision.ts",
  description:
    "Decision record for the deferred literal pass-button ball-server. Analyzes the core machinery change (countdown-zero auto-serve override; a pass-reception serving path), the determinism/pin implications, and the alternatives, then records a clear verdict: DEFER. Zero gameplay change; the decision is recorded, not executed.",
  decision,
  core_machinery_analysis: coreMachinery,
  alternatives,
  future_objective_outline,
  source_hashes: sourceHashes,
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[human-ball-server-decision] wrote ${STATE_PATH}`);
console.log(`[human-ball-server-decision] record_sha256=${String(record.record_sha256)}`);
console.log(
  `[human-ball-server-decision] verdict=${String((record.decision as { verdict: string }).verdict)} ` +
    `throwInBranch=${throwInBranch} passRadius=${passRadiusValue} throwInServeCriterion=${throwInServeCriterion}`,
);
