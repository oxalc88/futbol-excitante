/**
 * VALIDATION-NEG-SCEN-001 through 005 — Scenario definition negative tests.
 */
import { describe, it, expect } from "vitest";
import { validateScenario } from "../../src/simulation/world/validate.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import { makeScenario } from "./contracts.fixture.js";

// -- Invalid duration -----------------------------------------------------------

describe("VALIDATION-NEG-SCEN-001: rejects invalid duration", () => {
  it("rejects durationTicks = 0", () => {
    const sc = makeScenario();
    (sc as any).durationTicks = 0;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("durationTicks"))).toBe(true);
  });

  it("rejects negative durationTicks", () => {
    const sc = makeScenario();
    (sc as any).durationTicks = -5;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("durationTicks"))).toBe(true);
  });

  it("rejects non-integer durationTicks", () => {
    const sc = makeScenario();
    (sc as any).durationTicks = 30.5;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("durationTicks"))).toBe(true);
  });
});

// -- Invalid pitch dimensions ---------------------------------------------------

describe("VALIDATION-NEG-SCEN-002: rejects invalid pitch dimensions", () => {
  it("rejects pitchLength = 0", () => {
    const sc = makeScenario();
    (sc as any).pitchLength = 0;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("pitchLength"))).toBe(true);
  });

  it("rejects pitchWidth = -10", () => {
    const sc = makeScenario();
    (sc as any).pitchWidth = -10;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("pitchWidth"))).toBe(true);
  });
});

// -- Missing/invalid players ----------------------------------------------------

describe("VALIDATION-NEG-SCEN-003: rejects invalid players", () => {
  it("rejects empty players array", () => {
    const sc = makeScenario();
    (sc as any).players = [];
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("at least one player"))).toBe(true);
  });

  it("rejects players without playerId", () => {
    const sc = makeScenario();
    (sc.players[0] as any).playerId = null;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("playerId"))).toBe(true);
  });

  it("rejects players without teamId", () => {
    const sc = makeScenario();
    (sc.players[0] as any).teamId = "";
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("teamId"))).toBe(true);
  });

  it("rejects duplicate players", () => {
    const sc = makeScenario();
    (sc as any).players = [
      { playerId: "p1", teamId: "t1", groundPosition: { x: 0, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "p1", teamId: "t2", groundPosition: { x: 1, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
    ];
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("duplicate playerId"))).toBe(true);
  });
});

// -- Control assignment unresolved references -----------------------------------

describe("VALIDATION-NEG-SCEN-004: rejects unresolved control assignments", () => {
  it("rejects controlAssignment referencing non-existent player", () => {
    const sc = makeScenario();
    (sc.controlAssignments["slot-2"] as any) = {
      controlSlot: "slot-2",
      teamId: "team-a",
      controlledPlayerId: "ghost-player",
      mode: "HUMAN" as const,
    };
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("unresolved player reference"))).toBe(true);
  });

  it("accepts valid control assignment", () => {
    const sc = makeScenario();
    // slot-1 already references player-1 which exists
    const errors = validateScenario(sc);
    expect(errors).toEqual([]);
  });
});

// -- Missing ball --------------------------------------------------------------

describe("VALIDATION-NEG-SCEN-005: rejects invalid ball", () => {
  it("rejects missing ball", () => {
    const sc = makeScenario();
    delete (sc as any).ball;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("ball: required"))).toBe(true);
  });

  it("rejects ball with NaN position", () => {
    const sc = makeScenario();
    (sc.ball as any).position = { x: NaN, y: 0, z: 0 };
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("ball.position"))).toBe(true);
  });

  it("rejects ball with invalid regime", () => {
    const sc = makeScenario();
    (sc.ball as any).regime = "nonexistent" as any;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("ball.regime"))).toBe(true);
  });
});

// -- Scenario string fields -----------------------------------------------------

describe("VALIDATION-NEG-SCEN-006: rejects missing string fields", () => {
  it("rejects missing id", () => {
    const sc = makeScenario();
    delete (sc as any).id;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("scenario.id"))).toBe(true);
  });

  it("rejects missing version", () => {
    const sc = makeScenario();
    delete (sc as any).version;
    const errors = validateScenario(sc);
    expect(errors.some((e) => e.includes("scenario.version"))).toBe(true);
  });
});