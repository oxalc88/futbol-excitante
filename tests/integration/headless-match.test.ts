/**
 * @module headless-match-integration-tests
 *
 * Integration tests for the headless CPU-vs-CPU match runner
 * (HEADLESS-CPU-MATCH).
 *
 * Tests:
 *  - Match runs for the full tick count without errors.
 *  - Events are generated (player-ball contacts, etc.).
 *  - Determinism: two identical runs produce identical state hashes.
 *  - The default AI match scenario fixture is valid and playable.
 *  - Custom scenario with observer integration works.
 *
 * No Math.random, Date, DOM, or Node I/O in the match runner.
 * Node I/O is allowed here in tests (for assertions).
 */

import { describe, it, expect } from "vitest";
import {
  runHeadlessMatch,
  makeAiMatchScenario,
  type HeadlessMatchConfig,
} from "../../eval/runners/headless-match.js";

// ---------------------------------------------------------------------------
// 1. Basic match — runs without error
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-001: match runs for full duration", () => {
  it("runs 600 ticks without error and reports final tick", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(result.tick).toBe(600);
  });

  it("respects custom maxTicks", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 120 });

    expect(result.tick).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// 2. Events are generated
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-002: match produces simulation events", () => {
  it("generates events (contacts, locomotion, etc.)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(result.events.length).toBeGreaterThan(0);
  });

  it("produces at least one player-ball-contact event", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    const hasPlayerBallContact = result.events.some(
      (e) => e.kind === "player-ball-contact",
    );
    expect(hasPlayerBallContact).toBe(true);
  });

  it("events have valid structure (tick, id, kind, label)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    for (const evt of result.events) {
      expect(evt.tick).toBeGreaterThan(0);
      expect(typeof evt.id).toBe("string");
      expect(evt.id.length).toBeGreaterThan(0);
      expect(typeof evt.kind).toBe("string");
      expect(typeof evt.label).toBe("string");
    }
  });

  it("events are ordered by tick (non-decreasing)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    let prevTick = 0;
    for (const evt of result.events) {
      expect(evt.tick).toBeGreaterThanOrEqual(prevTick);
      prevTick = evt.tick;
    }
  });

  it("produces at least one event in a short run (30 ticks)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 30 });

    expect(result.events.length).toBeGreaterThan(0);
  });

  it("produces at least one event in a medium run (300 ticks)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 300 });

    expect(result.events.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism — identical seed produces identical hashes
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-003: determinism", () => {
  it("two runs with same scenario produce identical state hashes", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 200 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 200 });

    expect(r1.stateHashes).toEqual(r2.stateHashes);
    expect(r1.stateHashes.length).toBe(200);
    expect(r2.stateHashes.length).toBe(200);
  });

  it("two runs with same scenario produce identical events", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 200 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 200 });

    expect(r1.events.length).toBe(r2.events.length);
    for (let i = 0; i < r1.events.length; i++) {
      expect(r1.events[i].tick).toBe(r2.events[i].tick);
      expect(r1.events[i].id).toBe(r2.events[i].id);
      expect(r1.events[i].kind).toBe(r2.events[i].kind);
      expect(r1.events[i].label).toBe(r2.events[i].label);
    }
  });

  it("two runs produce identical observations count", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 200 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 200 });

    expect(r1.observations.length).toBe(r2.observations.length);
  });

  it("ball moves from initial position after CPU play", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario });

    // Last observation shows the ball at some position.
    const lastObs = r1.observations[r1.observations.length - 1];
    const ballX = lastObs.ball.position.x;

    // Ball should have moved from its initial position (x=0.5).
    expect(Math.abs(ballX - 0.5)).toBeGreaterThan(0.2);
  });

  it("determinism holds for short runs (100 ticks)", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 100 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 100 });

    expect(r1.stateHashes).toEqual(r2.stateHashes);
  });

  it("determinism holds for medium runs (300 ticks)", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 300 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 300 });

    expect(r1.stateHashes).toEqual(r2.stateHashes);
  });
});

// ---------------------------------------------------------------------------
// 4. State hashes — valid per-tick hashes
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-004: state hashes are valid", () => {
  it("produces one hash per tick", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(result.stateHashes.length).toBe(600);
  });

  it("hashes are non-empty strings", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    for (const hash of result.stateHashes) {
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    }
  });

  it("all state hashes are different (simulation is not stuck)", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    // In a dynamic simulation, state hashes should change each tick.
    // Allow at most a few identical hashes (e.g., settled ball ticks).
    const unique = new Set(result.stateHashes);
    expect(unique.size).toBeGreaterThan(result.stateHashes.length * 0.9);
  });
});

// ---------------------------------------------------------------------------
// 5. Observations are collected
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-005: telemetry observations", () => {
  it("collects one observation per tick", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(result.observations.length).toBe(600);
  });

  it("observations contain player data", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    const lastObs = result.observations[result.observations.length - 1];
    expect(lastObs.players.length).toBe(2);
    const playerIds = lastObs.players.map((p) => p.playerId);
    expect(playerIds).toContain("cpu-a");
    expect(playerIds).toContain("cpu-b");
  });

  it("observations contain ball data", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 200 });

    const lastObs = result.observations[result.observations.length - 1];
    expect(lastObs.ball.position).toBeDefined();
    expect(lastObs.ball.linearVelocity).toBeDefined();
    expect(typeof lastObs.ball.regime).toBe("string");
  });

  it("observations have PRNG hash for determinism verification", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 200 });

    const lastObs = result.observations[result.observations.length - 1];
    expect(lastObs.stateHash).toBeDefined();
    expect(lastObs.prngStateHash).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Custom scenario with observer
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-006: custom scenario with observer", () => {
  it("observer callback receives observations", () => {
    const scenario = makeAiMatchScenario();
    const observerObs: unknown[] = [];
    const customObserver = {
      onObservation(obs: unknown) {
        observerObs.push(obs);
      },
    };

    const result = runHeadlessMatch({
      scenario,
      maxTicks: 200,
      observer: customObserver,
    });

    expect(observerObs.length).toBe(200);
    expect(result.observations.length).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 7. Default scenario fixture — valid and playable
// ---------------------------------------------------------------------------

describe("HEADLESS-MATCH-007: makeAiMatchScenario fixture", () => {
  it("creates scenario with two players", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.players.length).toBe(2);
    expect(scenario.players[0].playerId).toBe("cpu-a");
    expect(scenario.players[1].playerId).toBe("cpu-b");
  });

  it("creates scenario with both AI_FALLBACK slots", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.controlAssignments["slot-a"].mode).toBe("AI_FALLBACK");
    expect(scenario.controlAssignments["slot-b"].mode).toBe("AI_FALLBACK");
    expect(scenario.controlAssignments["slot-a"].teamId).toBe("team-a");
    expect(scenario.controlAssignments["slot-b"].teamId).toBe("team-b");
  });

  it("creates scenario with ball near centre", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.ball.position.x).toBe(0.5);
    expect(scenario.ball.position.y).toBe(0);
    expect(scenario.ball.position.z).toBe(0.11);
  });

  it("creates scenario with correct profile", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.profile).toBe("LABORATORY");
    expect(scenario.pitchLength).toBe(105);
    expect(scenario.pitchWidth).toBe(68);
  });

  it("scenario has correct seed and prng", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.seed).toBe(42);
    expect(scenario.prngAlgorithmId).toBe("mulberry32-v1");
  });

  it("scenario has 600 ticks duration by default", () => {
    const scenario = makeAiMatchScenario();

    expect(scenario.durationTicks).toBe(600);
  });
});