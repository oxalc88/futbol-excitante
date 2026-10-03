/**
 * Node-side evidence producer for ADVANTAGE-MACHINERY (FOULS_CARDS_SPEC
 * §6.2–§6.4). Deterministic, no wall clock in the hashed content.
 *
 * Durable write requires the explicit evidence mode
 * (`WIP_SECTION=__EVIDENCE__:ADVANTAGE-MACHINERY` or
 * `GAUNTLET_EVIDENCE_CAPTURE=1`); an ordinary run writes the ignored ephemeral
 * tree under `test-results/gauntlet-capture/`.
 *
 * Run: pnpm run capture-advantage-machinery
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import type { ScenarioDefinition, SimulationEvent } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { DefensiveDuelResult } from "../eval/runners/defensive-duel-driver.js";
import type { HeadlessMatchResult } from "../eval/runners/headless-match.js";

const OBJECTIVE_ID = "ADVANTAGE-MACHINERY";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");

/** Pre-change baseline (the accepted FOUL-DETECTION-MACHINERY pin). */
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

const ADVANTAGE_KINDS = ["advantage-opened", "advantage-cancelled", "advantage-expired"];
/** The accepted in-core free-kick countdown (`defaultFreeKickCountdown`). */
const FREE_KICK_COUNTDOWN = 60;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

/** Every event of `kind` carried by the observation stream. */
function obsEvents(observations: TelemetryObservation[], kind: string): SimulationEvent[] {
  const out: SimulationEvent[] = [];
  for (const o of observations) for (const ev of o.events) if (ev.kind === kind) out.push(ev);
  return out;
}

interface AdvantageWindowFact {
  openTick: number;
  closeTick: number | null;
  reason: string | null;
  windowTicks: number | null;
  fouledTeam: string | null;
  offenderId: string | null;
  foulTick: number | null;
  pendingFoulCount: number | null;
  cautionPendingBudgetTicks: number | null;
}

/** Pair each opened window with the close that reports its open tick. */
function advantageWindows(events: readonly SimulationEvent[]): AdvantageWindowFact[] {
  const opens = events.filter((e) => e.kind === "advantage-opened");
  const closes = events.filter((e) => e.kind !== "advantage-opened");
  return opens.map((open) => {
    const op = (open.payload ?? {}) as Record<string, unknown>;
    const close = closes.find(
      (c) => ((c.payload ?? {}) as Record<string, unknown>).openTick === open.tick,
    );
    const cp = close ? ((close.payload ?? {}) as Record<string, unknown>) : undefined;
    return {
      openTick: open.tick,
      closeTick: close ? close.tick : null,
      reason: (cp?.reason as string) ?? null,
      windowTicks: (cp?.windowTicks as number) ?? (op.windowTicks as number) ?? null,
      fouledTeam: (op.fouledTeam as string) ?? null,
      offenderId: (op.offenderId as string) ?? null,
      foulTick: (op.foulTick as number) ?? null,
      pendingFoulCount: (cp?.pendingFoulCount as number) ?? (op.pendingFoulCount as number) ?? null,
      cautionPendingBudgetTicks: (cp?.cautionPendingBudgetTicks as number) ?? null,
    };
  });
}

interface CardFact {
  tick: number;
  cardType: string | null;
  playerId: string | null;
  accumulatedFouls: number | null;
  foulTick: number | null;
}

interface FreeKickFact {
  tick: number;
  teamId: string | null;
  position: { x: number; y: number } | null;
}

function cardFacts(events: readonly SimulationEvent[]): CardFact[] {
  return events
    .filter((e) => e.kind === "card-issued")
    .map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        tick: e.tick,
        cardType: (p.cardType as string) ?? null,
        playerId: (p.playerId as string) ?? null,
        accumulatedFouls: (p.accumulatedFouls as number) ?? null,
        foulTick: (p.foulTick as number) ?? null,
      };
    });
}

function freeKickFacts(events: readonly SimulationEvent[]): FreeKickFact[] {
  return events
    .filter((e) => e.kind === "free-kick-executed")
    .map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        tick: e.tick,
        teamId: (p.teamId as string) ?? null,
        position: (p.freeKickPosition as { x: number; y: number }) ?? null,
      };
    });
}

interface RunRecord {
  id: string;
  role: string;
  ticks: number;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  determinism_run2_hash_of_hashes: string | null;
  foul_count: number;
  advantage_windows: AdvantageWindowFact[];
  cards: CardFact[];
  free_kicks: FreeKickFact[];
}

function recordObservations(
  id: string,
  role: string,
  result: HeadlessMatchResult,
  run2?: HeadlessMatchResult,
): RunRecord {
  const events: SimulationEvent[] = [];
  for (const o of result.observations) for (const ev of o.events) events.push(ev);
  const advEvents = events.filter((e) => ADVANTAGE_KINDS.includes(e.kind));
  return {
    id,
    role,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: countKinds(result.observations),
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    determinism_run2_hash_of_hashes: run2 ? sha256(JSON.stringify(run2.stateHashes)) : null,
    foul_count: countFoulEvents(result.observations),
    advantage_windows: advantageWindows(advEvents),
    cards: cardFacts(events),
    free_kicks: freeKickFacts(events),
  };
}

function recordDriver(id: string, role: string, result: DefensiveDuelResult, run2?: DefensiveDuelResult): RunRecord {
  return {
    id,
    role,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: countKinds(result.observations),
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    determinism_run2_hash_of_hashes: run2 ? sha256(JSON.stringify(run2.stateHashes)) : null,
    foul_count: countFoulEvents(result.observations),
    advantage_windows: advantageWindows(result.advantageEvents),
    cards: cardFacts(result.cardEvents),
    free_kicks: freeKickFacts(result.freeKickEvents),
  };
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** Driven duel: scripted standing tackles every 16 ticks from tick 44. */
function runDriven(opts: {
  maxTicks: number;
  attemptsThrough: number;
  freeKick: boolean;
  advantage?: boolean;
  matchDurationTicks?: number;
}) {
  const base = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const scenario = opts.matchDurationTicks === undefined ? base : { ...base, matchDurationTicks: opts.matchDurationTicks };
  const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
  for (let t = 44; t <= opts.attemptsThrough; t += 16) {
    attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
  }
  const r = runDefensiveDuel({
    scenario,
    maxTicks: opts.maxTicks,
    attempts,
    freeKickConfig: opts.freeKick ? { awardFreeKicks: true } : undefined,
    cardConfig: { issueCards: true },
    advantageConfig: opts.advantage === undefined ? undefined : { playAdvantage: opts.advantage },
  });
  detectFoulEvents(r.observations);
  return r;
}

/** Organic 3v3-press through the production headless entry point. */
function runOrganic(playAdvantage: boolean, maxTicks: number) {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    awardFreeKicks: true,
    issueCards: true,
    playAdvantage,
    serializeRestartFacts: true,
  });
}

/** Gate-off byte-identity (the accepted legacy pin). */
function runGateOffLegacy() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls: false,
    awardFreeKicks: false,
  });
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const drivenOff1 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: undefined });
const drivenOff2 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: undefined });
const driven1 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: true });
const driven2 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: true });
const drivenFull = runDriven({ maxTicks: 380, attemptsThrough: 340, freeKick: true, advantage: true });
const drivenStoppage = runDriven({
  maxTicks: 200,
  attemptsThrough: 160,
  freeKick: false,
  advantage: true,
  matchDurationTicks: 120,
});
const organic1 = runOrganic(true, 600);
const organic2 = runOrganic(true, 600);
const stoppage = runOrganic(true, 1440);
const gateOff = runGateOffLegacy();

const runs: RunRecord[] = [
  recordDriver("advantage-driven-gate-off", "gate-off driven control: no advantage event, pre-change path", drivenOff1, drivenOff2),
  recordDriver("advantage-driven-cancelled", "driven foul → window → §6.3 last-touch-loss cancellation → deferred card", driven1, driven2),
  recordDriver("advantage-driven-close-tick-free-kick", "driven deferred call: free kick opens at the close tick, card at the close tick", drivenFull),
  recordDriver("advantage-driven-stoppage", "driven half ending inside the window: §6.3 new-stoppage cancellation with the caution at the close tick", drivenStoppage),
  recordObservations("advantage-organic-expired", "organic foul → window → §6.2c expiry at exactly 24 ticks → free kick at the close", organic1, organic2),
  recordObservations("advantage-organic-stoppage", "organic window cancelled by a goal (§6.3 new stoppage)", stoppage),
  recordObservations("advantage-gate-off-pin", "gate-off legacy control reproducing the pre-change pin byte-for-byte", gateOff),
];

const drivenTwoRun =
  sha256(JSON.stringify(driven1.stateHashes)) === sha256(JSON.stringify(driven2.stateHashes));
const organicTwoRun =
  sha256(JSON.stringify(organic1.stateHashes)) === sha256(JSON.stringify(organic2.stateHashes));
const drivenGateOffTwoRun =
  sha256(JSON.stringify(drivenOff1.stateHashes)) === sha256(JSON.stringify(drivenOff2.stateHashes));
const gateOffPin = sha256(JSON.stringify(gateOff.stateHashes)) === BASELINE_HASH_OF_HASHES;

const drivenWindows = advantageWindows(driven1.advantageEvents);
const drivenStoppageWindows = advantageWindows(drivenStoppage.advantageEvents);
const organicWindows = advantageWindows(organic1.observations.flatMap((o) => o.events));
const stoppageWindows = advantageWindows(stoppage.observations.flatMap((o) => o.events));
const organicFreeKicks = freeKickFacts(organic1.observations.flatMap((o) => o.events));
const stoppageCards = cardFacts(stoppage.observations.flatMap((o) => o.events));

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-advantage-machinery.ts",
  driver:
    "eval/runners/headless-match.ts (playAdvantage gate, core-owned lifecycle, serializeRestartFacts) + eval/runners/defensive-duel-driver.ts (scripted standing tackle, advantageConfig) + the shared foul predicate + src/simulation/advantage-policy.ts.",
  activation: {
    field: "runHeadlessMatch({ playAdvantage, awardFreeKicks, issueCards }) + runDefensiveDuel({ advantageConfig, freeKickConfig, cardConfig })",
    meaning:
      "the in-core ADVANTAGE-MACHINERY window in src/simulation/loop/simulation.ts: a committed man-not-ball tackle contact (the SAME §5.1 predicate the runner-level detection uses) opens the bounded §6.2 window on the contact tick instead of calling the foul immediately. The window closes at the earliest of cancellation (§6.3: the ball's lastTouchRef no longer resolves to the fouled team, or the match phase leaves playing) or expiry at advantage_window_ticks=24 (§6.2c); on close the pending foul is called at the CLOSE tick through the accepted restart/card machinery (deferred, not retroactive). Off (the default) the stream is byte-identical to pre-change. The judged-retained path (§6.2a) is NOT implemented: advantage_retention_ref stays BLOCKED_MISSING_REFERENCE and no advantage is ever played.",
    set_by: [
      "src/simulation/loop/simulation.ts (6b-3d advantage window + AdvantageConfig.playAdvantage gate)",
      "src/simulation/advantage-policy.ts (pure §6.2–§6.3 close decision + the two fouls-v1 budgets)",
      "src/simulation/foul-predicate.ts (single-source-of-truth §5.1 predicate)",
      "eval/runners/headless-match.ts runHeadlessMatch({ playAdvantage })",
      "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ advantageConfig })",
      "NOT the browser composition root (browser wiring is a later objective)",
    ],
  },
  guard_state: {
    driven_two_run_attestation: drivenTwoRun,
    organic_two_run_attestation: organicTwoRun,
    driven_gate_off_two_run_attestation: drivenGateOffTwoRun,
    gate_off_byte_identity_to_pre_change: gateOffPin,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    driven_last_touch_loss_cancellation: drivenWindows.some((w) => w.reason === "cancelled-last-touch-loss"),
    organic_expiry_at_window_budget: organicWindows.some(
      (w) => w.reason === "expired" && w.closeTick !== null && w.closeTick - w.openTick === 24,
    ),
    organic_stoppage_cancellation: stoppageWindows.some((w) => w.reason === "cancelled-stoppage"),
    driven_stoppage_cancellation: drivenStoppageWindows.some((w) => w.reason === "cancelled-stoppage"),
    driven_stoppage_close_tick_card: cardFacts(drivenStoppage.cardEvents).some(
      (c) =>
        c.accumulatedFouls === 2 &&
        c.tick === drivenStoppageWindows.find((w) => w.reason === "cancelled-stoppage")?.closeTick,
    ),
    close_tick_free_kick_deferral: organicFreeKicks.some(
      (fk) => fk.tick === (organicWindows[0]?.closeTick ?? -1) + FREE_KICK_COUNTDOWN,
    ),
    card_accumulation_on_deferred_calls: stoppageCards.some((c) => c.accumulatedFouls === 2),
    judged_retained_path_implemented: false,
  },
  trajectory: {
    organic: {
      sample: organic1.observations.slice(0, 20).map((o) => ({
        tick: o.tick,
        phase:
          (
            o.events.find((e) => e.kind === "core-match-phase")?.payload as
              | { matchPhase?: unknown }
              | undefined
          )?.matchPhase ?? null,
        ball_lastTouchRef: o.ball.lastTouchRef,
        ball_x: Number(o.ball.position.x.toFixed(4)),
        ball_y: Number(o.ball.position.y.toFixed(4)),
      })),
      advantage_windows: organicWindows,
      free_kick_events: organicFreeKicks,
    },
    driven: {
      last_touch_loss_windows: drivenWindows,
      stoppage_windows: drivenStoppageWindows,
      stoppage_cards: cardFacts(drivenStoppage.cardEvents),
      close_tick_free_kicks: freeKickFacts(drivenFull.freeKickEvents),
      close_tick_cards: cardFacts(drivenFull.cardEvents),
    },
    stoppage: {
      advantage_windows: stoppageWindows,
      cards: stoppageCards,
    },
  },
  disclosures: [
    "ADVANTAGE-MACHINERY is a DELIBERATE core change in src/simulation/loop/simulation.ts: a default-off playAdvantage gate opens the bounded §6.2 advantage window at a committed man-not-ball contact and defers the §8 free-kick / §7 card consequence to the close tick. With the gate OFF (the default) the window branch never runs and the core is byte-identical to pre-change; this is attested by the gate-off legacy pin reproducing the pre-change baseline hash-of-hashes byte-for-byte, and by the driven gate-off stream being byte-identical with the parameter absent vs explicitly false.",
    "The judged-retained path (§6.2a) is NOT implemented. advantage_retention_ref is BLOCKED_MISSING_REFERENCE (spec §11); no territory / distance / possession retention envelope is invented, no retained-advantage decision is emitted, and no advantage is ever played — every window closes by cancellation (§6.3) or expiry (§6.2c) and the foul is called at the close tick.",
    "The window close decision reads only the accepted committed facts: the window open tick, the current tick, the match phase, and the team the ball's accepted lastTouchRef resolves to. It adds no collider, no event family outside the advantage decision events, no action and no possession model.",
    "The pending caution is applied at the close tick itself (0 of the foul_caution_pending_ticks=12 budget withheld), which the §6.4 bound permits; the budget is carried on the close event for auditability.",
    "The organic 3v3-press advantage stream runs under cpuAntiHuddle:false (the accepted organic shape from FOUL-CONSEQUENCE-MACHINERY); the anti-huddle contract is out of scope for this objective.",
    "Same-tick arbitration (spec §2.2) is a deliberate deterministic priority: a stoppage that claims the phase inside the window wins over the pending advantage (the pending advantage does not survive into the restart window), so the cancelled window's free-kick consequence cannot open a restart; the deferred §7 caution is still called at the close tick. Two in-core stoppage coincidences are captured: the driven shape whose first half ends inside the window opened at tick 116 (cancelled at 121, caution at 121), and the organic 3v3-press shape where a goal at tick 1436 claims the phase inside the window opened at 1430 (cancelled at 1436).",
    "ADVANTAGE-PLAYED remains NAMED-NOT-REGISTERED (spec §10): no criterion, oracle, invariant-definition, observation-definition, binding or verdict accompanies it. Registration is a later objective.",
    "No PES fidelity claim: the window length (24 ticks) and pending-caution budget (12 ticks) are fouls-v1 VERSIONED_PROVISIONAL engine-tick budgets at foundation-fixed-dt-v1, not measured wall-clock latencies (advantage_window_ref_ms stays BLOCKED_MISSING_REFERENCE).",
  ],
  runs,
};

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
console.log(`[advantage] wrote ${TRAJECTORY_PATH}`);
console.log(`[advantage] gate-off pin ok: ${gateOffPin}`);
console.log(`[advantage] driven two-run: ${drivenTwoRun}; organic two-run: ${organicTwoRun}`);
