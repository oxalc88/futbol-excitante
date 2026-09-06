/**
 * @module tests/unit/eval/restart-rules-serialization
 *
 * RESTART-RULES-CONFORMANCE serialization guards for the gated
 * `serializeRestartFacts` observation extension in eval/runners/headless-match.ts.
 *
 * Verifies:
 *   - when the gate is ON the per-tick observation stream carries the runner-
 *     injected `core-match-phase` facts (post-step phase + matchTimer) and the
 *     committed restart-executed events, so the restart-AWARD / TIMER-FREEZE
 *     criteria become honestly measurable;
 *   - when the gate is OFF (the default) the observation stream is untreated
 *     (no `core-match-phase`, no injected restart-executed) and byte-identical
 *     to the non-gated shape;
 *   - the extension provably cannot affect inputs / steps / state hashes: the
 *     two runs produce IDENTICAL stateHash chains (the injection is post-loop,
 *     after every hash is committed).
 *
 * Node I/O is used to read the accepted restart fixture; it never touches the
 * simulation core.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const FIXTURE = resolve("eval/scenarios/5v5-restart-throwin.v1.json");
const TICKS = 300;

function loadFixture(): ScenarioDefinition {
  return JSON.parse(readFileSync(FIXTURE, "utf-8")) as ScenarioDefinition;
}

function countKind(
  observations: Run["observations"],
  kind: string,
): number {
  let n = 0;
  for (const o of observations) for (const ev of o.events) if (ev.kind === kind) n++;
  return n;
}

function runGated(gated: boolean): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadFixture(),
    maxTicks: TICKS,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    serializeRestartFacts: gated,
  });
}

type Run = ReturnType<typeof runHeadlessMatch>;

describe("RESTART-RULES-CONFORMANCE serialization guards", () => {
  it(
    "gate ON: the observation stream carries the core-match-phase facts and the committed restart-executed event",
    { timeout: 30000 },
    () => {
      const gated = runGated(true);
      expect(countKind(gated.observations, "core-match-phase")).toBe(TICKS);
      expect(countKind(gated.observations, "throw-in-executed")).toBeGreaterThan(0);
      // The phase facts carry a frozen set-piece phase so the timer freeze is
      // adjudicable (the throw-in fixture opens a throw-in window).
      const phases = new Set<string>();
      for (const o of gated.observations) {
        for (const ev of o.events) {
          if (ev.kind !== "core-match-phase") continue;
          const p = ev.payload as { matchPhase?: string } | undefined;
          if (typeof p?.matchPhase === "string") phases.add(p.matchPhase);
        }
      }
      expect(phases.has("playing")).toBe(true);
      expect(phases.has("throw-in") || phases.has("goal")).toBe(true);
    },
  );

  it(
    "full-match fixture gate ON: the stream carries the halftime / fulltime phase facts and the stashed control is hash-identical",
    { timeout: 60000 },
    () => {
      const scenario = JSON.parse(
        readFileSync(resolve("eval/scenarios/5v5-full-match-timing.v1.json"), "utf-8"),
      ) as ScenarioDefinition;
      const gated = runHeadlessMatch({
        scenario,
        maxTicks: 800,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: true,
      });
      const stashed = runHeadlessMatch({
        scenario,
        maxTicks: 800,
        cpuAntiHuddle: true,
        lifecyclePhaseSync: "core-owned",
        serializeRestartFacts: false,
      });
      // Hash-neutral: the injection is post-loop, so the committed hash chains match.
      expect(JSON.stringify(stashed.stateHashes)).toBe(JSON.stringify(gated.stateHashes));
      expect(countKind(stashed.observations, "core-match-phase")).toBe(0);
      expect(countKind(gated.observations, "core-match-phase")).toBe(800);

      // The gated stream carries the genuine timer-driven halftime and fulltime
      // transitions so the timing/phase cluster is adjudicable.
      const phases = new Set<string>();
      for (const o of gated.observations) {
        for (const ev of o.events) {
          if (ev.kind !== "core-match-phase") continue;
          const p = ev.payload as { matchPhase?: string } | undefined;
          if (typeof p?.matchPhase === "string") phases.add(p.matchPhase);
        }
      }
      expect(phases.has("halftime")).toBe(true);
      expect(phases.has("fulltime")).toBe(true);
    },
  );

  it(
    "gate OFF: the observation stream is untreated and the state-hash chain is identical to the gated run",
    { timeout: 30000 },
    () => {
      const gated = runGated(true);
      const ungated = runGated(false);
      // The state-hash chains are byte-identical: the injection is post-loop, so
      // it provably cannot affect inputs, steps, or committed hashes.
      expect(JSON.stringify(ungated.stateHashes)).toBe(JSON.stringify(gated.stateHashes));
      // Non-gated stream carries no injected facts.
      expect(countKind(ungated.observations, "core-match-phase")).toBe(0);
      expect(countKind(ungated.observations, "throw-in-executed")).toBe(0);
    },
  );

  it(
    "gate ON makes the restart-AWARD and TIMER-FREEZE criteria honestly measurable through the rules suite",
    { timeout: 30000 },
    () => {
      const gated = runGated(true);
      const suite = evaluateSuite("rules", gated.observations);
      const outcomes: Record<string, string> = {};
      for (const t of suite.tests) for (const c of t.criteria) outcomes[c.criterion_id] = c.outcome;
      // The driven throw-in window yields a real award verdict and a real
      // timer-freeze verdict (previously NOT_EVALUATED on the committed stream).
      expect(outcomes["MATCH-THROW-IN-AWARD"]).toBe("PASS");
      expect(outcomes["MATCH-TIMER-FREEZE"]).toBe("PASS");
    },
  );
});
