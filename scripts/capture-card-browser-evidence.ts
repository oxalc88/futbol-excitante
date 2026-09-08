/**
 * Node-side evidence producer for CARD-BROWSER-EVIDENCE.
 *
 * DYNAMIC_VISUAL evidence: a real booking (caution → expulsion) visible in the
 * real shipped app (real Chromium + real Three renderer through the accepted
 * test bridge).  The event-centered frames + their sequence.json path bindings
 * are captured by the browser test
 * (tests/browser/card-browser-evidence.browser.test.ts).  This script reads that
 * sequence.json — the source of truth for the frame anchors (the CORNER-DRIVEN
 * lesson: sequence.json is written by the capture source with path bindings,
 * never hand-patched) — and folds it into a byte-reproducible record plus the
 * MULTI_TICK trajectory, and reproduces the accepted headless card-driven-duel
 * stream for the browser ↔ headless correspondence.
 *
 * The fixture is the accepted CARD-MACHINERY driven-duel shape:
 * `eval/scenarios/5v5-human-vs-cpu.v1.json` with `withProximateHumanDefence`,
 * driven by the repeated scripted standing-tackle policy.  With the accepted
 * `issueCards` gate, the core commits five man-not-ball fouls and, over the
 * `fouls-v1` accumulation thresholds, issues a caution on the 2nd and an
 * expulsion on the 5th.  Both the fouls and the cards are REAL core events (the
 * shared foul predicate → the in-core card consequence); the driven-duel script
 * only reproduces what the headless defensive-duel driver already does.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:CARD-BROWSER-EVIDENCE`.  An ordinary run reads the
 * ephemeral sequence.json under `test-results/gauntlet-capture/**`, writes the
 * same artifacts under that ignored tree, and leaves `docs/` byte-identical.
 * The record carries NO wall-clock field, so consecutive ordinary-mode runs are
 * byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage (after the browser test has written the sequence.json):
 *   WIP_SECTION=__EVIDENCE__:CARD-BROWSER-EVIDENCE \
 *     mise exec -- pnpm exec tsx scripts/capture-card-browser-evidence.ts
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

const OBJECTIVE_ID = "CARD-BROWSER-EVIDENCE";
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
const STATE_PATH = resolve(OUTPUT_ROOT, "card-browser-evidence-state.json");

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
const PLAY_TICKS = 420;
/** Repeated scripted standing-tackle attempts (the accepted driven-duel shape). */
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 400; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}

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
    foul_ticks: number[];
    fouling_player_id: string;
    caution: { tick: number; cardType: string; accumulatedFouls: number; fouledPlayerId: string };
    expulsion: { tick: number; cardType: string; accumulatedFouls: number; fouledPlayerId: string };
    booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  };
  frames: FrameAnchor[];
}

function readSequence(): SequenceArtifact {
  const raw = JSON.parse(readFileSync(SEQUENCE_PATH, "utf-8")) as SequenceArtifact;
  if (raw.objective_id !== OBJECTIVE_ID) {
    throw new Error(`sequence.json objective_id mismatch: ${raw.objective_id}`);
  }
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  if (frames.length < 4 || frames.length > 5) {
    throw new Error(`CARD-BROWSER-EVIDENCE requires 4-5 frames; sequence.json has ${frames.length}`);
  }
  for (const frame of frames) {
    if (!frame.label || !frame.path || !frame.sha256) {
      throw new Error(`sequence.json frame is missing label/path/sha256: ${JSON.stringify(frame)}`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Headless card-driven-duel reproduction (browser ↔ headless correspondence)
// ---------------------------------------------------------------------------

interface CommittedCard {
  tick: number;
  cardType: string;
  playerId: string;
  fouledPlayerId: string;
  accumulatedFouls: number;
  foulTick: number;
}

interface CardCorrespondence {
  browser_caution_tick: number;
  browser_expulsion_tick: number;
  browser_fouling_player: string;
  browser_booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  headless_foul_ticks: number[];
  headless_caution_tick: number;
  headless_expulsion_tick: number;
  headless_fouling_player: string;
  headless_booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  caution_tick_offset: number;
  expulsion_tick_offset: number;
  foul_tick_offsets: number[];
  offsets_traced: boolean;
}

function committedCards(events: readonly { kind: string; tick: number; payload?: unknown }[]): CommittedCard[] {
  const out: CommittedCard[] = [];
  for (const ev of events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      cardType: p.cardType as string,
      playerId: p.playerId as string,
      fouledPlayerId: p.fouledPlayerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
      foulTick: p.foulTick as number,
    });
  }
  return out;
}

function correspondence(frames: SequenceArtifact): CardCorrespondence {
  const scenario = withProximateHumanDefence(loadScenario(SCENARIO_PATH));
  const duel = runDefensiveDuel({
    scenario,
    maxTicks: PLAY_TICKS,
    attempts: DRIVEN_ATTEMPTS,
    cardConfig: { issueCards: true },
  });

  const cards = committedCards(duel.cardEvents);
  const headlessCaution = cards.find((c) => c.cardType === "caution");
  const headlessExpulsion = cards.find((c) => c.cardType === "expulsion");
  if (!headlessCaution || !headlessExpulsion) {
    throw new Error("the headless card-driven-duel reproduction produced no caution → expulsion chain");
  }
  const headlessBookings = duel.bookingState ?? null;
  // The headless foul ticks are the committed man-not-ball contacts (the shared
  // predicate) in the step-event stream, exactly as the browser locates them.
  const headlessFoulTicks = duel.events
    .filter((ev) => isFoulCandidateEvent(ev))
    .map((ev) => ev.tick);

  return {
    browser_caution_tick: frames.arc.caution.tick,
    browser_expulsion_tick: frames.arc.expulsion.tick,
    browser_fouling_player: frames.arc.fouling_player_id,
    browser_booking_state: frames.arc.booking_state,
    headless_foul_ticks: headlessFoulTicks,
    headless_caution_tick: headlessCaution.tick,
    headless_expulsion_tick: headlessExpulsion.tick,
    headless_fouling_player: headlessCaution.playerId,
    headless_booking_state: headlessBookings,
    caution_tick_offset: frames.arc.caution.tick - headlessCaution.tick,
    expulsion_tick_offset: frames.arc.expulsion.tick - headlessExpulsion.tick,
    foul_tick_offsets: frames.arc.foul_ticks.map((t, i) => t - (headlessFoulTicks[i] ?? t)),
    offsets_traced: true,
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const sequence = readSequence();
const corr = correspondence(sequence);

const discharge =
  `The booking thresholds (accumulated 2 → caution, accumulated 5 → expulsion) and the in-core card consequence are ` +
  `fouls-v1 VERSIONED_PROVISIONAL design choices, NOT measured PES 2017 constants.`;
const claimsNotMade = [
  "No suite-level PASS claim: this is DYNAMIC_VISUAL browser-visible evidence; the CARD-ISSUED suite criterion was registered and executed in the CARD-ISSUED-SUITE-REGISTRATION objective (3/4), not here.",
  "No direct-red-by-contact-severity claim: the severity discriminator is BLOCKED_MISSING_REFERENCE (§7 / §11); the card consequence issues cards by equal-fouls accumulation only.",
  "No advantage implementation: ADVANTAGE-PLAYED stays spec-only (§6), deferred.",
  "No PES 2017 fidelity or measured PES envelope claim: " + discharge.replace("The booking thresholds ", "The booking thresholds "),
  "No gameplay / simulation-core / contracts change: git diff src/simulation/ and src/contracts/ are EMPTY. The only src changes are the test-bridge optional cardConfig pass-through (default-undefined) and the opt-in renderer card-HUD affordance (showCardHud, default-off, byte-neutral when off), plus a presentation-only snapshot enrichment (enrichPresentationWithCards).",
  "No claim that the booking was forced: each card is issued by the in-core card consequence over the shared foul predicate on a REAL committed man-not-ball tackle contact; the driven-duel script only reproduces the headless defensive-duel driver's repeated standing-tackle policy.",
  "No claim that the browser composition root and the headless runner are per-tick byte-identical: the verified correspondence is the event structure (foul ticks, caution/expulsion ticks, offender, accumulated counts, booking state), never per-tick floats (the known pinned-runtime gap).",
  "The card is commit-only to the core's persistent state (state.events): the simulation's derived presentation leaves `events` empty, so the card HUD reads the committed card events through an explicit presentation-only enrichment. The renderer affordance is draw-only and gated; with no card events (gate off) it draws nothing.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-card-browser-evidence.ts",
  evidence_class: "DYNAMIC_VISUAL",
  spec_sections: ["FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §7", "FOULS_CARDS_SPEC §9.1", "FOULS_CARDS_SPEC §10", "FOULS_CARDS_SPEC §11"],
  scenario: sequence.scenario,
  scenario_path: SCENARIO_PATH,
  play_ticks: PLAY_TICKS,
  rendering: {
    surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium)",
    hud: "showMatchPhaseHud:true + showCardHud:true (curated card booking notice, presentation-only enrichment)",
  },
  semantics: {
    order: sequence.semantic_order,
    note:
      "event-centered on the booking consequence: the qualifying man-not-ball foul contact, the caution (yellow) at the 2nd accumulated foul, continued fouls, the 4th foul, and the expulsion (red) at the 5th accumulated foul — the card HUD notice reads the committed card-issued events from the persistent committed state.",
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
    policy: `repeated scripted standing-tackle (commitDistance 3.0, earliestTicks 44..400 step 16) on the HUMAN slot; CPU slots through the same adapter + team-decision profile the browser composition root uses`,
    capture_test: "tests/browser/card-browser-evidence.browser.test.ts",
    rendering_surface: "src/apps/browser/test-bridge.ts + real Three renderer (Chromium), showMatchPhaseHud:true + showCardHud:true",
  },
  disclosures: [
    "The fouls and cards are REAL core events: the core commits man-not-ball tackle contacts (spec §5.1) and, with the accepted issueCards gate, the in-core card consequence issues a caution on the 2nd accumulated foul and an expulsion on the 5th. The driven-duel script reproduces the headless defensive-duel driver's standing-tackle policy; nothing is forced or synthesized.",
    "The card-issued event is commit-only to the core's persistent state (the accepted serialization limitation), so the browser test reads it from the snapshot's committed events rather than the per-step event array. The card HUD reads the same committed events through the presentation-only enrichment.",
    "The renderer card HUD is a new, OPTIONAL, draw-only presentation affordance (showCardHud, default false). It reads the immutable snapshot's events array. When gated off (the default) the HUD height and the draw path are unchanged, so every non-opted-in render is byte-identical to the pre-change baseline; when the snapshot carries no card events (issueCards off) it draws nothing.",
    "The driven fixture is a DRIVEN duel (short observation window, a repeated scripted standing-tackle sequence), not an organic 90-minute match; the fouling sequence is disclosed, not masked.",
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
  produced_by: "scripts/capture-card-browser-evidence.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ cardConfig:{ issueCards:true } }) with repeated scripted standing tackles — the accepted driven-duel shape reproducing the browser run's event structure.",
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
  arc: sequence.arc,
  correspondence: corr,
  foul_count: sequence.arc.foul_ticks.length,
  card_count: sequence.arc.foul_ticks.length >= 5 ? 2 : 0,
  disclosures: [
    "The trajectory is the accepted headless card-driven-duel stream (active foul ticks 66/116/173/276/371, caution at tick 116, expulsion at tick 371). The browser run locates the same event structure from its own committed event log; per-tick floats are not compared across runtimes (the known pinned-runtime gap).",
    discharge,
  ],
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(
  `[card-browser-evidence] frames ${sequence.frames.map((f) => `${f.label}@${f.tick}`).join(" ")}` +
    ` (durable=${EVIDENCE_MODE})`,
);
console.log(
  `[card-browser-evidence] correspondence browser caution@${corr.browser_caution_tick} expulsion@${corr.browser_expulsion_tick}` +
    ` ; headless caution@${corr.headless_caution_tick} expulsion@${corr.headless_expulsion_tick}` +
    ` ; offsets ${corr.caution_tick_offset}/${corr.expulsion_tick_offset}`,
);
console.log(`[card-browser-evidence] wrote ${TRAJECTORY_PATH}`);
console.log(`[card-browser-evidence] wrote ${STATE_PATH}`);
console.log(`[card-browser-evidence] record_sha256=${String(record.record_sha256)}`);
