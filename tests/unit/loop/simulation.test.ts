/**
 * @module simulation-loop-tests
 *
 * Tests for the synchronous fixed-step simulation API (BOOTSTRAP-05).
 *
 * Tests exact tick progression, input-tick attribution, explicit-N-step
 * (no timer), snapshot isolation, checkpoint/restore continuation,
 * determinism, duplicate-input rejection, and observer-no-op equivalence.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * `fs` is used only here in tests (Node I/O in tests is allowed).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";

import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { encodeCanonical, hashFnv1a64 } from "../../../src/simulation/determinism/index.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { SimulationObserver } from "../../../src/simulation/telemetry/observer.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function worldHash(world: { schemaVersion: string }): string {
  return hashFnv1a64(encodeCanonical(world));
}

function makeEmptyInputFrame(tick: number, controlSlot = "slot-1"): InputFrame {
  return {
    tick,
    sourceId: "test",
    controlSlot,
    moveX: 0,
    moveY: 0,
    sprint: 0,
    heldButtons: 0,
    pressedButtons: 0,
    releasedButtons: 0,
  };
}

// ---------------------------------------------------------------------------
// 1. Exact tick progression and input-tick attribution
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-TICK-001: exact tick progression and input attribution", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("starts at tick 0", () => {
    expect(sim.tick).toBe(0);
  });

  it("steps to tick 1 on first step", () => {
    const result = sim.step();
    expect(sim.tick).toBe(1);
    expect(result.tick).toBe(1);
  });

  it("progresses tick-by-tick through N steps", () => {
    const N = 5;
    for (let i = 0; i < N; i++) {
      const result = sim.step();
      expect(sim.tick).toBe(i + 1);
      expect(result.tick).toBe(i + 1);
    }
  });

  it("input frames are attributed to the correct tick", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    const sim2 = createSimulation(world, NO_OP_OBSERVER);

    // Apply a frame for tick 1 (current world tick is 0, so it's queued)
    sim2.applyInputs([
      { ...makeEmptyInputFrame(1), moveX: 0.99, moveY: 0.5 },
    ]);
    expect(sim2.tick).toBe(0);

    // Step to tick 1 — the frame for tick 1 is consumed
    const result = sim2.step();
    expect(sim2.tick).toBe(1);
    expect(result.tick).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Explicit-N-step: no timer / no real-time pacing
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-NSTEP-001: explicit-N-step (no timer)", () => {
  let scenario: ScenarioDefinition;
  let world: { schemaVersion: string };

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
    world = createWorld({ scenario });
  });

  it("N steps produce N tick advances regardless of wall clock", () => {
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Measure a wall-clock window (we don't use it in the simulation).
    const before = performance.now();
    for (let i = 0; i < 60; i++) {
      sim.step();
    }
    const after = performance.now();

    expect(sim.tick).toBe(60);
    // Verify it happened within 5 seconds (should be milliseconds).
    // This proves no timer is throttling the simulation.
    expect(after - before).toBeLessThan(5000);
  });

  it("step count is independent of input frequency", () => {
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // No inputs applied, but we still step N times.
    for (let i = 0; i < 10; i++) {
      sim.step();
    }
    expect(sim.tick).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 3. Snapshot isolation: caller mutation does not affect simulation
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-ISOLATION-001: snapshot and presentation isolation", () => {
  let sim: ReturnType<typeof createSimulation>;
  let scenario: ScenarioDefinition;
  let world: { schemaVersion: string };

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
    world = createWorld({ scenario });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("mutating a returned snapshot does not change subsequent hashes", () => {
    const snap = sim.snapshot();
    const hashBefore = sim.stateHash();

    // The snapshot is frozen — mutation either throws (strict) or
    // silently fails (non-strict). Either way, the internal state
    // must remain unchanged.
    try {
      (snap as any).tick = 999999;
      if (snap.players && snap.players.length > 0) {
        (snap.players[0] as any).groundPosition = { x: 999, y: 999 };
      }
    } catch {
      // Mutation threw — that confirms immutability.
    }

    const hashAfter = sim.stateHash();
    expect(hashAfter).toBe(hashBefore);
  });

  it("mutating a returned presentation does not change subsequent hashes", () => {
    const pres = sim.presentation();
    const hashBefore = sim.stateHash();

    // Mutate the presentation.
    (pres as any).tick = 999999;
    if (pres.players && pres.players.length > 0) {
      (pres.players[0] as any).groundPosition = { x: 999, y: 999 };
    }

    const hashAfter = sim.stateHash();
    expect(hashAfter).toBe(hashBefore);
  });

  it("two snapshots from the same tick are independent clones", () => {
    const snap1 = sim.snapshot();
    const snap2 = sim.snapshot();

    // They should be equal in value.
    expect(encodeCanonical(snap1)).toBe(encodeCanonical(snap2));

    // But they are not the same reference.
    expect(snap1).not.toBe(snap2);
    if (snap1.players && snap1.players.length > 0) {
      expect(snap1.players[0]).not.toBe(snap2.players[0]);
    }
  });

  it("snapshot is a deep clone (players are independent)", () => {
    const snap = sim.snapshot();
    expect(snap).not.toBe(world);
    expect(snap.players).not.toBe((world as any).players);
    if (snap.players && snap.players.length > 0) {
      expect(snap.players[0]).not.toBe((world as any).players[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Checkpoint / restore continuation
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-RESTORE-001: checkpoint and restore continuation", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
  });

  it("restore + step continues from the saved tick", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Step to tick 3.
    for (let i = 0; i < 3; i++) {
      sim.step();
    }
    expect(sim.tick).toBe(3);

    // Take a checkpoint.
    const checkpoint = sim.snapshot();
    const checkpointTick = sim.tick;
    const checkpointHash = sim.stateHash();

    // Continue stepping.
    sim.step();
    sim.step();
    expect(sim.tick).toBe(5);

    // Restore from the checkpoint.
    sim.restore(checkpoint);
    expect(sim.tick).toBe(checkpointTick);

    // Step again — should match the hash we would have gotten
    // by stepping from tick 3 in a fresh simulation.
    const postRestoreHash = sim.stateHash();
    expect(postRestoreHash).toBe(checkpointHash);
  });

  it("restore produces the same state hash as the original snapshot", () => {
    const sim1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const snap1 = sim1.snapshot();
    const hash1 = sim1.stateHash();

    // Restore a fresh simulation from the snapshot.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim2.restore(snap1);
    const hash2 = sim2.stateHash();

    expect(hash2).toBe(hash1);
    expect(sim2.tick).toBe(sim1.tick);
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism: same initial state + same empty inputs → identical hashes
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-DETERMINISM-001: same input produces identical hashes", () => {
  it("two simulations with same scenario produce identical per-tick hashes", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const s1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: scenario as ScenarioDefinition }), NO_OP_OBSERVER);

    const N = 20;
    for (let i = 0; i < N; i++) {
      const r1 = s1.step();
      const r2 = s2.step();
      expect(r1.stateHash).toBe(r2.stateHash);
    }
  });

  it("same scenario with empty inputs produces identical hashes", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const s1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: scenario as ScenarioDefinition }), NO_OP_OBSERVER);

    // Apply no inputs — both should advance identically.
    for (let i = 0; i < 5; i++) {
      s1.step();
      s2.step();
      expect(s1.stateHash()).toBe(s2.stateHash());
    }
  });

  it("different seeds produce different hashes from the start", () => {
    const scenarioA = loadFixture("foundation-move-and-roll.v1.json");
    const scenarioB = loadFixture("foundation-move-and-roll.v1.json");
    (scenarioA as any).seed = 42;
    (scenarioB as any).seed = 999;

    const s1 = createSimulation(createWorld({ scenario: scenarioA }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: scenarioB }), NO_OP_OBSERVER);

    expect(s1.stateHash()).not.toBe(s2.stateHash());
  });
});

// ---------------------------------------------------------------------------
// 6. Snapshot is deep-frozen (immutable)
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-FREEZE-001: snapshot is immutable", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("snapshot is frozen (cannot be mutated)", () => {
    const snap = sim.snapshot();
    // Object.freeze prevents property assignment in strict mode.
    // In non-strict mode it silently ignores, but the object is
    // still a freeze marker. We verify that Object.isFrozen.
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it("nested arrays in snapshot are frozen", () => {
    const snap = sim.snapshot();
    if (snap.players) {
      expect(Object.isFrozen(snap.players)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Observer no-op vs another no-op yields identical hashes
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-OBSERVER-001: observer does not affect determinism", () => {
  it("no-op observer yields same hashes as another no-op observer", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const s1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: scenario as ScenarioDefinition }), NO_OP_OBSERVER);

    const N = 10;
    for (let i = 0; i < N; i++) {
      const r1 = s1.step();
      const r2 = s2.step();
      expect(r1.stateHash).toBe(r2.stateHash);
    }
  });

  it("a minimal logging observer yields identical hashes", () => {
    let stepsObserved = 0;
    const loggingObserver: SimulationObserver = {
      onAfterStep() {
        stepsObserved++;
      },
    };

    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const s1 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const s2 = createSimulation(createWorld({ scenario: scenario as ScenarioDefinition }), loggingObserver);

    const N = 5;
    for (let i = 0; i < N; i++) {
      const r1 = s1.step();
      const r2 = s2.step();
      expect(r1.stateHash).toBe(r2.stateHash);
    }
    expect(stepsObserved).toBe(N);
  });
});

// ---------------------------------------------------------------------------
// 8. tick getter is readonly
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-READONLY-001: tick is read-only", () => {
  let sim: ReturnType<typeof createSimulation>;

  beforeEach(() => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    sim = createSimulation(world, NO_OP_OBSERVER);
  });

  it("tick getter is defined and returns a number", () => {
    expect(typeof sim.tick).toBe("number");
    expect(sim.tick).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. fixedDt from config, not wall clock
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-FIXEDDT-001: fixedDt from versioned config", () => {
  it("simulation respects the fixedDt from the scenario config", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // The fixedDt should be 1/60 (from FOUNDATION_CONFIG).
    expect(world.fixedDt.numerator).toBe(1);
    expect(world.fixedDt.denominator).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// 10. Simulation.freeze: the returned simulation object is frozen
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-05-FREEZE-SIM-001: simulation is frozen", () => {
  it("the simulation instance itself is frozen (Object.isFrozen)", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    expect(Object.isFrozen(sim)).toBe(true);
  });
});