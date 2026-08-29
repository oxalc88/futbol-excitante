/**
 * @module tests/unit/eval/CORE-EVENT-TYPE-UNION-FIX-binding.test.ts
 *
 * Binding/verification test for objective CORE-EVENT-TYPE-UNION-FIX:
 * the simulation emits `slot-switch` and `slot-wiring-violation` events,
 * so both values MUST be members of `SimulationEvent["kind"]` in
 * `src/contracts/scenario.ts`.
 *
 * Verifies:
 *  1. Compile-guard: the two literals are members of the kind union.
 *     Removing either member from the union makes this file fail to
 *     type-check (discriminating failure), and independently the typed
 *     emit sites in src/simulation/loop/simulation.ts fail `typecheck`.
 *  2. Discriminated-union narrowing: a kind type-guard narrows a
 *     `SimulationEvent` to a `kind: "slot-switch"` event.
 *  3. Runtime emission of `slot-switch` with id/tick/sequence payload
 *     fields when SWITCH_PLAYER_BIT is pressed.
 *  4. Runtime emission of `slot-wiring-violation` when slot wiring is
 *     broken through the public `setControlledPlayer` API.
 *  5. Negative controls (no spurious emissions) and determinism
 *     (same inputs => identical event streams and state hash).
 *
 * Deterministic only: no Math.random, no Date, no wall clock in the
 * simulated paths.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition, SimulationEvent } from "../../../src/contracts/scenario.js";
import { SWITCH_PLAYER_BIT } from "../../../src/contracts/input.js";
import type { InputFrame } from "../../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Compile-guard: the two emitted kinds MUST stay in the SimulationEvent union.
//
// This assignment only type-checks while both `"slot-switch"` and
// `"slot-wiring-violation"` are members of `SimulationEvent["kind"]`.
// Removing either member from src/contracts/scenario.ts is a TS2322 error
// here (and at the typed emit sites in src/simulation/loop/simulation.ts).
// ---------------------------------------------------------------------------
const _slotEventKindChecks: SimulationEvent["kind"][] = [
  "slot-switch",
  "slot-wiring-violation",
];

/**
 * Discriminated-union narrowing helper: narrows a SimulationEvent by kind.
 * Only compiles because `"slot-switch"` is a member of the kind union.
 */
function isSlotSwitchEvent(
  ev: SimulationEvent,
): ev is SimulationEvent & { kind: "slot-switch" } {
  return ev.kind === "slot-switch";
}

// ---------------------------------------------------------------------------
// Fixtures (deterministic)
// ---------------------------------------------------------------------------

function makeFrame(
  tick: number,
  controlSlot = "slot-1",
  opts?: Partial<InputFrame>,
): InputFrame {
  return {
    tick,
    sourceId: opts?.sourceId ?? "test-source",
    controlSlot,
    moveX: opts?.moveX ?? 0,
    moveY: opts?.moveY ?? 0,
    sprint: opts?.sprint ?? 0,
    heldButtons: opts?.heldButtons ?? 0,
    pressedButtons: opts?.pressedButtons ?? 0,
    releasedButtons: opts?.releasedButtons ?? 0,
  };
}

function createFourPlayerWorld(seed: number = 42) {
  const scenario: ScenarioDefinition = {
    id: "core-event-type-union-fix-binding",
    version: "1.0.0",
    family: "control-slot-routing",
    durationTicks: 60,
    seed,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "LABORATORY" as const,
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
    players: [
      {
        playerId: "p-a1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
      {
        playerId: "p-a2",
        teamId: "team-a",
        groundPosition: { x: 2, y: 3 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
      {
        playerId: "p-b1",
        teamId: "team-b",
        groundPosition: { x: 10, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
      {
        playerId: "p-b2",
        teamId: "team-b",
        groundPosition: { x: 8, y: 4 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll" as const,
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "p-a1",
        mode: "HUMAN" as const,
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "p-b1",
        mode: "HUMAN" as const,
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    requestedMetrics: [],
  };
  return createWorld({ scenario });
}

// ---------------------------------------------------------------------------
// 1. Compile-guard reflection + narrowing
// ---------------------------------------------------------------------------

describe("CORE-EVENT-TYPE-UNION-FIX: kind union membership", () => {
  it("both emitted kinds are declared members of SimulationEvent[\"kind\"]", () => {
    // Mirrors the compile-guard at module scope; asserting the exact
    // membership list keeps the guard visible in the runtime test output.
    expect(_slotEventKindChecks).toEqual([
      "slot-switch",
      "slot-wiring-violation",
    ]);
  });

  it("kind narrowing distinguishes slot-switch events at the type level", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);
    sim.applyInputs([
      makeFrame(0, "slot-1", { pressedButtons: SWITCH_PLAYER_BIT }),
    ]);
    const result = sim.step();

    const narrowed = result.events.filter(isSlotSwitchEvent);
    expect(narrowed.length).toBe(1);
    // Narrowed access: kind is the literal "slot-switch".
    expect(narrowed[0].kind).toBe("slot-switch");
  });
});

// ---------------------------------------------------------------------------
// 2. Runtime emission: slot-switch
// ---------------------------------------------------------------------------

describe("CORE-EVENT-TYPE-UNION-FIX: slot-switch emission", () => {
  it("emits a slot-switch event with id/tick/sequence payload fields", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      makeFrame(0, "slot-1", { pressedButtons: SWITCH_PLAYER_BIT }),
    ]);
    const result = sim.step();

    const switchEvents = result.events.filter(isSlotSwitchEvent);
    expect(switchEvents.length).toBe(1);

    const ev = switchEvents[0];
    expect(typeof ev.id).toBe("string");
    expect(ev.id).toMatch(/^slot-switch-slot-1-\d+-\d+$/);
    expect(ev.tick).toBe(1); // the tick the frame is resolved into
    expect(Number.isInteger(ev.sequence)).toBe(true);
    expect(ev.sequence).toBeGreaterThanOrEqual(1);
    // id embeds slot / tick / sequence consistently.
    expect(ev.id).toBe(`slot-switch-slot-1-${ev.tick}-${ev.sequence}`);

    const payload = ev.payload as Record<string, unknown>;
    expect(payload.controlSlot).toBe("slot-1");
    expect(payload.fromPlayer).toBe("p-a1");
    expect(payload.toPlayer).toBe("p-a2");
  });

  it("does not emit slot-switch without a pressed SWITCH_PLAYER_BIT edge", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.5 })]);
    const result = sim.step();

    const switchEvents = result.events.filter(isSlotSwitchEvent);
    expect(switchEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Runtime emission: slot-wiring-violation
// ---------------------------------------------------------------------------

describe("CORE-EVENT-TYPE-UNION-FIX: slot-wiring-violation emission", () => {
  it("emits a slot-wiring-violation event when two slots control one player", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Public control-layer API: re-point slot-2 at p-a1, which slot-1
    // already controls => duplicate control => wiring invariant violation
    // detected on the next step.
    sim.setControlledPlayer("slot-2", "p-a1");
    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 0.5 }),
      makeFrame(0, "slot-2", { moveX: -0.5 }),
    ]);
    const result = sim.step();

    const violationEvents = result.events.filter(
      (e) => e.kind === "slot-wiring-violation",
    );
    expect(violationEvents.length).toBe(1);

    const ev = violationEvents[0];
    expect(typeof ev.id).toBe("string");
    expect(ev.id).toMatch(/^slot-wiring-violation-\d+-\d+$/);
    expect(ev.tick).toBe(1);
    expect(Number.isInteger(ev.sequence)).toBe(true);
    expect(ev.sequence).toBeGreaterThanOrEqual(1);
    expect(ev.id).toBe(`slot-wiring-violation-${ev.tick}-${ev.sequence}`);

    const payload = ev.payload as { violations?: unknown };
    expect(Array.isArray(payload.violations)).toBe(true);
    expect((payload.violations as string[]).length).toBeGreaterThan(0);
    expect(
      (payload.violations as string[]).some((v) => v.includes("multiple slots")),
    ).toBe(true);
  });

  it("does not emit slot-wiring-violation for valid control assignments", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 0.5 }),
      makeFrame(0, "slot-2", { moveX: -0.5 }),
    ]);
    const result = sim.step();

    const violationEvents = result.events.filter(
      (e) => e.kind === "slot-wiring-violation",
    );
    expect(violationEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe("CORE-EVENT-TYPE-UNION-FIX: determinism", () => {
  it("identical switch runs produce identical event streams and state hash", () => {
    function run(): { events: unknown[]; hash: string } {
      const world = createFourPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);
      sim.applyInputs([
        makeFrame(0, "slot-1", { pressedButtons: SWITCH_PLAYER_BIT }),
        makeFrame(0, "slot-2", { moveX: -0.5 }),
      ]);
      const result = sim.step();
      return { events: result.events, hash: sim.stateHash() };
    }

    const a = run();
    const b = run();
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.hash).toBe(b.hash);
  });
});