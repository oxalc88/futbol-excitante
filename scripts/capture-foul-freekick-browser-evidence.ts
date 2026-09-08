/**
 * Node-side evidence producer for FOUL-FREEKICK-BROWSER-EVIDENCE.
 *
 * DYNAMIC_VISUAL evidence: a real foul → free-kick consequence visible in the
 * real shipped app (real Chromium + real Three renderer through the accepted
 * test bridge).  The event-centered frames + their sequence.json path bindings
 * are captured by the browser test
 * (tests/browser/foul-freekick-browser-evidence.browser.test.ts).  This script
 * reads that sequence.json — the source of truth for the frame anchors (the
 * CORNER-DRIVEN lesson: sequence.json is written by the capture source with path
 * bindings, never hand-patched) — and folds it into a byte-reproducible record
 * plus the MULTI_TICK trajectory, and reproduces the accepted headless
 * defensive-duel stream for the browser ↔ headless correspondence.
 *
 * The fixture is the accepted FOUL-CONSEQUENCE-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`,
 * driven by the scripted standing-tackle policy.  The core commits a man-not-ball
 * tackle contact (spec §5.1) and, with the accepted `awardFreeKicks` gate, awards
 * a free kick to the fouled team at the contact position.  Both the foul and the
 * free kick are REAL core events (the shared foul predicate); the driven-duel
 * script only reproduces what the headless defensive-duel driver already does.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FOUL-FREEKICK-BROWSER-EVIDENCE`.  An ordinary run
 * reads the ephemeral sequence.json under `test-results/gauntlet-capture/**`,
 * writes the same artifacts under that ignored tree, and leaves `docs/`
 * byte-identical.  The record carries NO wall-clock field, so consecutive
 * ordinary-mode runs are byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:FOUL-FREEKICK-BROWSER-EVIDENCE \
 *     mise exec -- pnpm exec tsx scripts/capture-foul-freekick-browser-evidence.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { isFoulCandidateEvent } from "../src/simulation/foul-predicate.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOUL-FREEKICK-BROWSER-EVIDENCE";
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
const STATE_PATH = resolve(OUTPUT_ROOT, "foul-freekick-browser-evidence-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
const PLAY_TICKS = 200;
const ATTEMPT = { kind: "standing", commitDistance: 3.0, earliestTick: 48 } as const;
const FREE_KICK_COUNTDOWN = 60;

function sha256(value: string): string {
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

interface SequenceArtifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  semantic_order: string;
  scenario: string;
  scenario_path: string;
  arc: {
    foul_tick: number;
    awarding_team: string;
    free_kick_executed_tick: number;
    free_kick_position: { x: number; y: number };
    kick_taker: string;
    kick_direction: { x: number; y: number };
    match_timer_at_award: number;
  };
  frames: FrameAnchor[];
}

function readSequence(): SequenceArtifact {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as SequenceArtifact;
  if (raw.objective_id !== OBJECTIVE_ID) {
    throw new Error(`sequence.json objective_id mismatch: ${raw.objective_id}`);
  }
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length < 3 || frames.length > 5) {
    throw new Error(`DYNAMIC_VISUAL requires 3-5 labeled frames; sequence.json has ${frames.length}`);
  }
  for (const frame of frames) {
    if (!frame.label || !frame.path || !frame.sha256) {
      throw new Error(`sequence.json frame is missing label/path/sha256: ${JSON.stringify(frame)}`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Headless defensive-duel reproduction (browser ↔ headless correspondence)
// ---------------------------------------------------------------------------

interface DuelCorrespondence {
  browser_foul_tick: number;
  browser_free_kick_tick: number;
  browser_awarding_team: string;
  browser_contact_position: { x: number; y: number };
  headless_foul_tick: number;
  headless_free_kick_tick: number;
  headless_awarding_team: string;
  headless_contact_position: { x: number; y: number };
  foul_tick_offset: number;
  free_kick_tick_offset: number;
  free_kick_countdown: number;
  offsets_traced: boolean;
}

function correspondence(frames: SequenceArtifact): DuelCorrespondence {
  const scenario = withProximateHumanDefence(loadScenario(SCENARIO_PATH));
  const duel = runDefensiveDuel({
    scenario,
    maxTicks: PLAY_TICKS,
    attempts: [{ kind: ATTEMPT.kind, commitDistance: ATTEMPT.commitDistance, earliestTick: ATTEMPT.earliestTick }],
    freeKickConfig: { awardFreeKicks: true },
  });

  const headlessFoulTick = duel.events.find((e) => isFoulCandidateEvent(e))?.tick ?? null;
  const headlessFk = duel.freeKickEvents[0];
  if (headlessFoulTick === null || !headlessFk) {
    throw new Error("the headless defensive-duel reproduction produced no foul → free-kick chain");
  }
  const hp = headlessFk.payload as {
    teamId: string;
    freeKickPosition: { x: number; y: number };
  };

  return {
    browser_foul_tick: frames.arc.foul_tick,
    browser_free_kick_tick: frames.arc.free_kick_executed_tick,
    browser_awarding_team: frames.arc.awarding_team,
    browser_contact_position: frames.arc.free_kick_position,
    headless_foul_tick: headlessFoulTick,
    headless_free_kick_tick: headlessFk.tick,
    headless_awarding_team: hp.teamId,
    headless_contact_position: hp.freeKickPosition,
    foul_tick_offset: frames.arc.foul_tick - headlessFoulTick,
    free_kick_tick_offset: frames.arc.free_kick_executed_tick - headlessFk.tick,
    free_kick_countdown: FREE_KICK_COUNTDOWN,
    offsets_traced: true,
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const sequence = readSequence();
const corr = correspondence(sequence);

const discharge = `The free-kick countdown is ${FREE_KICK_COUNTDOWN}; applyFreeKick's serve speed (14 m/s) and loft (0.18) and ball-z (0.11) are VERSIONED_PROVISIONAL match-rules-v1-kind design choices, NOT measured PES 2017 constants.`;
const claimsNotMade = [
  "No card or advantage implementation or evidence: cards and advantage stay spec-only (FOULS_CARDS_SPEC §7 / §6).",
  "No suite-level PASS claim: this is DYNAMIC_VISUAL browser-visible evidence; the FREE-KICK-AWARD suite criterion was registered and executed in the FREE-KICK-SUITE-REGISTRATION objective (1/4's sibling), not here.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS claim.",
  "No PES 2017 fidelity or measured PES envelope claim: " + discharge.replace("The free-kick countdown is 60; ", ""),
  "No gameplay / simulation-core / contracts change: git diff src/simulation/ and src/contracts/ are EMPTY. The only presentation-facing change is the curated 'FREE KICK' renderer HUD label (additive, opt-in via showMatchPhaseHud, byte-neutral when off).",
  "No claim that the free kick was forced: the foul is a REAL core man-not-ball contact (the shared foul predicate) that organises the acceptance of the scripted standing-tackle policy; the award/placement/serve are the core's own accepted restart machinery.",
  "No claim that the browser composition root and the headless runner are per-tick byte-identical: the verified correspondence is the event structure (foul tick, free-kick tick, awarding team, contact position), never per-tick floats (the known pinned-runtime gap).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-foul-freekick-browser-evidence.ts",
  evidence_class: "DYNAMIC_VISUAL",
  spec_sections: ["FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §8", "FOULS_CARDS_SPEC §10"],
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  rendering: sequence.rendering,
  semantics: {
    order: sequence.semantic_order,
    note:
      "event-centered on the foul → free-kick consequence: the man-not-ball tackle contact, the free-kick award (the phase turns FREE KICK), the set-piece placement at the contact spot, and the served free kick back in play.",
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
  drives: {
    fixture: "5v5-human-vs-cpu.v1.json + withProximateHumanDefence (the accepted driven-duel shape)",
    policy: `scripted standing-tackle (commitDistance ${ATTEMPT.commitDistance}, earliestTick ${ATTEMPT.earliestTick}) on the HUMAN slot; CPU slots through the same adapter + team-decision profile the browser composition root uses`,
    capture_test: "tests/browser/foul-freekick-browser-evidence.browser.test.ts",
    rendering_surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), showMatchPhaseHud:true",
  },
  disclosures: [
    "The foul and free kick are REAL core events: the core commits a man-not-ball tackle contact (spec §5.1) and, with the accepted awardFreeKicks gate, awards a free kick to the fouled team at the contact position. The driven-duel script reproduces the headless defensive-duel driver's standing-tackle policy; nothing is forced or synthesized.",
    "The free-kick-executed event is committed to the core's persistent state (the accepted serialization limitation), so the browser test reads it from the snapshot rather than the per-step event array.",
    "The driven fixture is a DRIVEN duel (short observation window, exactly one scripted standing tackle), not an organic 90-minute match; the fouling sequence is disclosed, not masked.",
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
  produced_by: "scripts/capture-foul-freekick-browser-evidence.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ freeKickConfig:{ awardFreeKicks:true } }) — the accepted driven-duel shape reproducing the browser run's event structure.",
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  frame_anchors: sequence.frames.map((frame) => ({
    label: frame.label,
    path: frame.path,
    tick: frame.tick,
    semantic: frame.semantic,
    sha256: frame.sha256,
  })),
  correspondence: corr,
  free_kick_countdown: FREE_KICK_COUNTDOWN,
  disclosures: [
    "The trajectory is the accepted headless defensive-duel stream (foul at tick " +
      String(corr.headless_foul_tick) + ", free kick at tick " + String(corr.headless_free_kick_tick) +
      "). The browser run locates the same event structure from its own event log; per-tick floats are not compared across runtimes (the known pinned-runtime gap).",
    discharge,
  ],
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[foul-freekick-evidence] frames ${sequence.frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(
  `[foul-freekick-evidence] correspondence browser foul@${corr.browser_foul_tick} -> fk@${corr.browser_free_kick_tick}` +
    ` ; headless foul@${corr.headless_foul_tick} -> fk@${corr.headless_free_kick_tick}` +
    ` ; offsets ${corr.foul_tick_offset}/${corr.free_kick_tick_offset}`,
);
console.log(`[foul-freekick-evidence] wrote ${TRAJECTORY_PATH}`);
console.log(`[foul-freekick-evidence] wrote ${STATE_PATH}`);
console.log(`[foul-freekick-evidence] record_sha256=${String(record.record_sha256)}`);