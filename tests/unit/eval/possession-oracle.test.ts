/**
 * @module tests/unit/eval/possession-oracle
 *
 * Tests for checkPossessionEvidence — proves pass-backed lastTouchRef
 * changes PASS and event-less lastTouchRef changes FAIL.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { checkPossessionEvidence } from "../../../eval/oracles/possession.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseObs(tick: number, overrides?: Partial<TelemetryObservation>): TelemetryObservation {
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-hash-${tick}`,
    observationCoreHash: `core-hash-${tick}`,
    committedTick: tick,
    inputs: [],
    players: [],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// (a) pass-backed lastTouchRef changes PASS the oracle
// ---------------------------------------------------------------------------

describe("checkPossessionEvidence: pass-backed lastTouchRef", () => {
  it("PASSes when lastTouchRef changes and a 'pass' event is present", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "evt-pass-1",
      },
      events: [
        { id: "evt-pass-1", tick: 1, sequence: 0, kind: "pass", label: "pass" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });

  it("PASSes when lastTouchRef changes and a 'touch' event is present", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "evt-touch-1",
      },
      events: [
        { id: "evt-touch-1", tick: 1, sequence: 0, kind: "touch", label: "touch" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });

  it("PASSes when lastTouchRef changes and a 'ball-touch' event is present", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "evt-bt-1",
      },
      events: [
        { id: "evt-bt-1", tick: 1, sequence: 0, kind: "ball-touch", label: "ball-touch" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });

  it("PASSes when lastTouchRef changes and a 'player-ball-contact' event is present", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "evt-pbc-1",
      },
      events: [
        { id: "evt-pbc-1", tick: 1, sequence: 0, kind: "player-ball-contact", label: "player-ball-contact" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });

  it("PASSes when lastTouchRef changes and a 'shot' event is present", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.5 },
        linearVelocity: { x: 10, y: 0, z: 2 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "airborne",
        lastTouchRef: "evt-shot-1",
      },
      events: [
        { id: "evt-shot-1", tick: 1, sequence: 0, kind: "shot", label: "shot" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (b) event-less lastTouchRef changes FAIL the oracle
// ---------------------------------------------------------------------------

describe("checkPossessionEvidence: event-less lastTouchRef", () => {
  it("FAILs when lastTouchRef changes with no touch event", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "mystery-ref",
      },
      events: [],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0].id).toContain("possession-no-evidence");
  });

  it("FAILs when lastTouchRef changes with unrelated events only", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "sneaky-ref",
      },
      events: [
        { id: "evt-unrelated-1", tick: 1, sequence: 0, kind: "whistle", label: "whistle" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0].id).toContain("possession-no-evidence");
  });

  it("FAILs when lastTouchRef changes to a non-existent event id", () => {
    const obs0 = baseObs(0);
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 2, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: "ghost-ref",
      },
      events: [
        { id: "evt-something", tick: 1, sequence: 0, kind: "whistle", label: "whistle" },
      ],
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    // Should get both a no-evidence fail and an orphan-ref fail.
    expect(fails.length).toBeGreaterThanOrEqual(1);
    expect(fails.some((f) => f.id.includes("orphan-ref"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("checkPossessionEvidence: edge cases", () => {
  it("PASSes when lastTouchRef does not change", () => {
    const obs0 = baseObs(0, {
      ball: {
        position: { x: 0, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: null,
      },
    });
    const obs1 = baseObs(1, {
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 1, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
        lastTouchRef: null,
      },
    });

    const results = checkPossessionEvidence([obs0, obs1]);
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
  });

  it("returns pass for single-observation input (no comparison possible)", () => {
    const results = checkPossessionEvidence([baseObs(0)]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// (c) POSSESSION-ORACLE-REFERENCE-TRIAGE discriminating guards (additive)
// ---------------------------------------------------------------------------

// `ball.lastTouchRef` is a persistent reference to the most recent touch
// event, which may have been emitted on an earlier tick. Full-match maps carry
// a non-null lastTouchRef on the vast majority of ticks while the referenced
// event exists only on the touch tick. Resolving it only against the current
// tick's own events false-fails those persistent-tick references — the same
// defect class fixed in COMMON-FULL-MATCH-INVARIANT-TRIAGE (references.ts).
describe("checkPossessionEvidence: prior-tick lastTouchRef resolution (window-union)", () => {
  function persistentObs(): TelemetryObservation[] {
    return [
      baseObs(0),
      baseObs(1, {
        ball: {
          position: { x: 1, y: 0, z: 0.11 },
          linearVelocity: { x: 2, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
          lastTouchRef: "evt-touch-1",
        },
        events: [
          { id: "evt-touch-1", tick: 1, sequence: 0, kind: "touch", label: "touch" },
        ],
      }),
      baseObs(2, {
        ball: {
          position: { x: 1, y: 0, z: 0.11 },
          linearVelocity: { x: 2, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
          lastTouchRef: "evt-touch-1",
        },
        events: [],
      }),
      baseObs(3, {
        ball: {
          position: { x: 1, y: 0, z: 0.11 },
          linearVelocity: { x: 2, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
          lastTouchRef: "evt-touch-1",
        },
        events: [],
      }),
    ];
  }

  it("a persistent prior-tick lastTouchRef false-fails per-tick and passes with the window union", () => {
    const obs = persistentObs();
    const allEventIds = new Set(obs.flatMap((o) => o.events.map((e) => e.id)));

    // BEFORE (per-tick fallback, no window union): the persistent lastTouchRef
    // on ticks 2-3 is not in those ticks' own events → orphan-ref false FAIL.
    const beforeFails = checkPossessionEvidence(obs).filter((r) => r.status === "fail");
    expect(beforeFails.length).toBeGreaterThan(0);
    expect(beforeFails.some((r) => r.id.includes("orphan-ref"))).toBe(true);

    // AFTER (window-union): the same prior-tick reference resolves → no fail.
    const afterResults = checkPossessionEvidence(obs, allEventIds);
    expect(afterResults.filter((r) => r.status === "fail")).toHaveLength(0);
  });

  it("a reference present nowhere in the window still FAILs (no oracle weakening)", () => {
    const obs = [
      baseObs(0),
      baseObs(1, {
        ball: {
          position: { x: 1, y: 0, z: 0.11 },
          linearVelocity: { x: 2, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
          lastTouchRef: "ghost-nowhere",
        },
        events: [
          { id: "evt-valid-1", tick: 1, sequence: 0, kind: "whistle", label: "whistle" },
        ],
      }),
    ];
    const allEventIds = new Set(obs.flatMap((o) => o.events.map((e) => e.id)));

    const results = checkPossessionEvidence(obs, allEventIds);
    expect(
      results.some((r) => r.id.includes("orphan-ref") && r.status === "fail"),
    ).toBe(true);
  });

  it("a genuine change-without-evidence still FAILs under window-union resolution", () => {
    const obs = [
      baseObs(0),
      baseObs(1, {
        ball: {
          position: { x: 1, y: 0, z: 0.11 },
          linearVelocity: { x: 2, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
          lastTouchRef: "mystery",
        },
        events: [],
      }),
    ];
    const allEventIds = new Set(obs.flatMap((o) => o.events.map((e) => e.id)));

    const results = checkPossessionEvidence(obs, allEventIds);
    expect(
      results.some((r) => r.id.includes("no-evidence") && r.status === "fail"),
    ).toBe(true);
  });
});
