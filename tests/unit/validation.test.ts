/**
 * VALIDATION-NEG-001 through 010 — Table-driven negative tests for validateWorldState.
 *
 * Each case constructs a fixture that must fail validation for the stated reason.
 */
import { describe, it, expect } from "vitest";
import { validateWorldState } from "../../src/simulation/world/validate.js";
import {
  makeWorldState,
  makeBallState,
  makePlayerState,
  makeSchedulerMemory,
} from "./contracts.fixture.js";
import type { WorldState } from "../../src/contracts/state.js";

// -- Non-finite numbers -------------------------------------------------------

describe("VALIDATION-NEG-001: rejects non-finite numbers (NaN)", () => {
  it("rejects NaN in player groundPosition", () => {
    const ws = makeWorldState();
    (ws.players[0] as any).groundPosition = { x: NaN, y: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("groundPosition") && e.includes("NaN"))).toBe(true);
  });

  it("rejects NaN in ball position", () => {
    const ws = makeWorldState();
    (ws.ball as any).position = { x: NaN, y: 0, z: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("ball.position") && e.includes("NaN"))).toBe(true);
  });

  it("rejects NaN in ball linearVelocity", () => {
    const ws = makeWorldState();
    (ws.ball as any).linearVelocity = { x: NaN, y: 0, z: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("ball.linearVelocity") && e.includes("NaN"))).toBe(true);
  });
});

describe("VALIDATION-NEG-002: rejects non-finite numbers (Infinity)", () => {
  it("rejects Infinity in player bodyHeading", () => {
    const ws = makeWorldState();
    (ws.players[0] as any).bodyHeading = Infinity;
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("bodyHeading"))).toBe(true);
  });

  it("rejects -Infinity in ball z position", () => {
    const ws = makeWorldState();
    (ws.ball as any).position = { x: 0, y: 0, z: -Infinity };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("ball.position") && e.includes("Infinity"))).toBe(true);
  });
});

// -- Duplicate IDs -------------------------------------------------------------

describe("VALIDATION-NEG-003: rejects duplicate player IDs", () => {
  it("rejects two players with same playerId", () => {
    const ws = makeWorldState();
    (ws as any).players = [
      makePlayerState("p1", "team-a"),
      makePlayerState("p1", "team-b"),
    ];
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("duplicate playerId"))).toBe(true);
  });
});

describe("VALIDATION-NEG-004: rejects duplicate event IDs", () => {
  it("rejects two events with same id", () => {
    const ws = makeWorldState({ events: [
      { id: "ev-1", tick: 0, sequence: 0, kind: "scenario-start", label: "start" },
      { id: "ev-1", tick: 0, sequence: 1, kind: "rule", label: "rule" },
    ]});
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes('duplicate event id "ev-1"'))).toBe(true);
  });
});

describe("VALIDATION-NEG-005: rejects unresolved references", () => {
  it("rejects ball.lastTouchRef that does not match any event id", () => {
    const ws = makeWorldState({
      ball: { lastTouchRef: "nonexistent-event" },
      events: [
        { id: "ev-1", tick: 0, sequence: 0, kind: "scenario-start", label: "start" },
      ],
    });
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("unresolved event reference"))).toBe(true);
  });

  it("accepts ball.lastTouchRef that resolves to an event id", () => {
    const ws = makeWorldState({
      ball: { lastTouchRef: "ev-1" },
      events: [
        { id: "ev-1", tick: 0, sequence: 0, kind: "scenario-start", label: "start" },
      ],
    });
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors).toEqual([]);
  });
});

// -- Invalid vector ranges (already tested in non-finite, but test ranges too) --

describe("VALIDATION-NEG-006: rejects invalid vector fields", () => {
  it("rejects null in player position", () => {
    const ws = makeWorldState();
    (ws.players[0] as any).groundPosition = { x: null, y: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("groundPosition"))).toBe(true);
  });

  it("rejects string in player linearVelocity", () => {
    const ws = makeWorldState();
    (ws.players[0] as any).linearVelocity = { x: "fast", y: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("linearVelocity"))).toBe(true);
  });
});

// -- Invalid fixed durations ---------------------------------------------------

describe("VALIDATION-NEG-007: rejects invalid fixed durations", () => {
  it("rejects zero denominator in fixedDt", () => {
    const ws = makeWorldState();
    (ws as any).fixedDt = { numerator: 1, denominator: 0 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("denominator"))).toBe(true);
  });

  it("rejects negative denominator", () => {
    const ws = makeWorldState();
    (ws as any).fixedDt = { numerator: 1, denominator: -60 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("denominator"))).toBe(true);
  });

  it("rejects non-integer numerator", () => {
    const ws = makeWorldState();
    (ws as any).fixedDt = { numerator: 0.5, denominator: 60 };
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("numerator"))).toBe(true);
  });
});

// -- Player count validation (LABORATORY: 1-22) -------------------------------

describe("VALIDATION-NEG-008: rejects out-of-range player count", () => {
  it("rejects 0 players in LABORATORY profile", () => {
    const ws = makeWorldState();
    (ws as any).players = [];
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("LABORATORY"))).toBe(true);
  });

  it("rejects 23 players in LABORATORY profile", () => {
    const ws = makeWorldState();
    (ws as any).players = Array.from({ length: 23 }, (_, i) => makePlayerState(`p-${i}`, "team-a"));
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("LABORATORY") && e.includes("23"))).toBe(true);
  });

  it("rejects empty string playerId", () => {
    const ws = makeWorldState();
    (ws.players[0] as any).playerId = "";
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("playerId"))).toBe(true);
  });
});

// -- Missing ball --------------------------------------------------------------

describe("VALIDATION-NEG-009: rejects missing ball", () => {
  it("rejects null ball", () => {
    const ws = makeWorldState();
    (ws as any).ball = null;
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("ball: required, missing"))).toBe(true);
  });

  it("rejects missing ball property", () => {
    const ws = makeWorldState();
    delete (ws as any).ball;
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("ball"))).toBe(true);
  });
});

// -- Ball parented to a player ------------------------------------------------

describe("VALIDATION-NEG-010: rejects ball parented to a player", () => {
  it("rejects ball with ownerPlayerId field", () => {
    const ws = makeWorldState();
    (ws.ball as any).ownerPlayerId = "player-1";
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("parented"))).toBe(true);
  });
});

// -- Schema/config version validation ------------------------------------------

describe("VALIDATION-NEG-011: rejects incompatible schema/config versions", () => {
  it("rejects empty schemaVersion", () => {
    const ws = makeWorldState();
    (ws as any).schemaVersion = "";
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("schemaVersion"))).toBe(true);
  });

  it("rejects missing configVersion", () => {
    const ws = makeWorldState();
    delete (ws as any).configVersion;
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors.some((e) => e.includes("configVersion"))).toBe(true);
  });
});

// -- InputFrame validation (negative) -----------------------------------------

import { validateInputFrame, validateInputUniqueness } from "../../src/simulation/world/validate.js";

describe("VALIDATION-NEG-012: rejects invalid InputFrame ranges", () => {
  it("rejects moveX > 1", () => {
    const errs: string[] = [];
    validateInputFrame({ tick: 0, sourceId: "s", controlSlot: "slot", moveX: 1.5, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }, "frame", (m) => errs.push(m));
    expect(errs.some((e) => e.includes("moveX"))).toBe(true);
  });

  it("rejects moveX < -1", () => {
    const errs: string[] = [];
    validateInputFrame({ tick: 0, sourceId: "s", controlSlot: "slot", moveX: -1.5, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }, "frame", (m) => errs.push(m));
    expect(errs.some((e) => e.includes("moveX"))).toBe(true);
  });

  it("rejects moveY > 1", () => {
    const errs: string[] = [];
    validateInputFrame({ tick: 0, sourceId: "s", controlSlot: "slot", moveX: 0, moveY: 2, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }, "frame", (m) => errs.push(m));
    expect(errs.some((e) => e.includes("moveY"))).toBe(true);
  });

  it("rejects sprint < 0", () => {
    const errs: string[] = [];
    validateInputFrame({ tick: 0, sourceId: "s", controlSlot: "slot", moveX: 0, moveY: 0, sprint: -1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }, "frame", (m) => errs.push(m));
    expect(errs.some((e) => e.includes("sprint"))).toBe(true);
  });

  it("rejects sprint > 1", () => {
    const errs: string[] = [];
    validateInputFrame({ tick: 0, sourceId: "s", controlSlot: "slot", moveX: 0, moveY: 0, sprint: 1.5, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }, "frame", (m) => errs.push(m));
    expect(errs.some((e) => e.includes("sprint"))).toBe(true);
  });
});

describe("VALIDATION-NEG-013: rejects duplicate input frames", () => {
  it("rejects two frames with same (tick, controlSlot)", () => {
    const errs: string[] = [];
    validateInputUniqueness([
      { tick: 5, sourceId: "s1", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
      { tick: 5, sourceId: "s2", controlSlot: "slot-1", moveX: 1, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
    ], (m) => errs.push(m));
    expect(errs.some((e) => e.includes("duplicate input frame"))).toBe(true);
  });

  it("accepts frames with different controlSlots at same tick", () => {
    const errs: string[] = [];
    validateInputUniqueness([
      { tick: 5, sourceId: "s1", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
      { tick: 5, sourceId: "s2", controlSlot: "slot-2", moveX: 1, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
    ], (m) => errs.push(m));
    expect(errs).toEqual([]);
  });

  it("accepts frames with same controlSlot at different ticks", () => {
    const errs: string[] = [];
    validateInputUniqueness([
      { tick: 5, sourceId: "s1", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
      { tick: 6, sourceId: "s1", controlSlot: "slot-1", moveX: 1, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
    ], (m) => errs.push(m));
    expect(errs).toEqual([]);
  });
});