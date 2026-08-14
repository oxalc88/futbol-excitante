/**
 * CONTRACT-FIXTURE-001 through 004 — Contract type tests.
 *
 * Proves that the contract types are well-formed and that the
 * one-player/one-ball fixtures pass validation.
 */
import { describe, it, expect } from "vitest";
import { validateWorldState } from "../../src/simulation/world/validate.js";
import { validateScenario } from "../../src/simulation/world/validate.js";
import {
  makeWorldState,
  makeScenario,
  makePresentationSnapshot,
  makeTelemetryObservation,
  makeReplayV1,
  makeInputFrame,
  makePlayerState,
  makeBallState,
  makeVec2,
  makeVec3,
} from "./contracts.fixture.js";
import { MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES } from "../../src/contracts/input.js";
import { FOUNDATION_CONFIG } from "../../src/simulation/config/foundation.js";

describe("CONTRACT-FIXTURE-001: Vec2 and Vec3 are correct shape", () => {
  it("Vec2 has x and y", () => {
    const v = makeVec2(1, 2);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
  });

  it("Vec3 has x, y, and z", () => {
    const v = makeVec3(1, 2, 3);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
    expect(v.z).toBe(3);
  });
});

describe("CONTRACT-FIXTURE-002: InputFrame is correctly shaped", () => {
  it("has all required fields with correct types", () => {
    const f = makeInputFrame(5, "slot-1", { moveX: 0.3, moveY: -0.7, sprint: 1, heldButtons: 0, pressedButtons: 1, releasedButtons: 0 });
    expect(f.tick).toBe(5);
    expect(f.sourceId).toBe("test-source");
    expect(f.controlSlot).toBe("slot-1");
    expect(f.moveX).toBe(0.3);
    expect(f.moveY).toBe(-0.7);
    expect(f.sprint).toBe(1);
    expect(f.heldButtons).toBe(0);
    expect(f.pressedButtons).toBe(1);
    expect(f.releasedButtons).toBe(0);
  });

  it("defaults are reasonable", () => {
    const f = makeInputFrame(0, "slot-1");
    expect(f.moveX).toBe(0);
    expect(f.moveY).toBe(0);
    expect(f.sprint).toBe(0);
    expect(f.heldButtons).toBe(0);
    expect(f.pressedButtons).toBe(0);
    expect(f.releasedButtons).toBe(0);
  });
});

describe("CONTRACT-FIXTURE-003: MISSING_INPUT_POLICY constant", () => {
  it("equals the documented policy ID", () => {
    expect(MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES).toBe("REPEAT_HELD_WITH_ZERO_EDGES");
  });
});

describe("CONTRACT-FIXTURE-004: One-player/one-ball WorldState validates", () => {
  it("legal world state passes validation", () => {
    const ws = makeWorldState();
    const errors = validateWorldState(ws, "LABORATORY");
    expect(errors).toEqual([]);
  });

  it("legal world state has correct schema", () => {
    const ws = makeWorldState();
    expect(ws.schemaVersion).toBe("state-v1");
    expect(ws.simulationVersion).toBe("sim-v1");
    expect(ws.configVersion).toBe(FOUNDATION_CONFIG.id);
    expect(ws.tick).toBe(0);
    expect(ws.fixedDt.numerator).toBe(FOUNDATION_CONFIG.fixedDt.numerator);
    expect(ws.fixedDt.denominator).toBe(FOUNDATION_CONFIG.fixedDt.denominator);
    expect(ws.players.length).toBe(1);
    expect(ws.players[0].playerId).toBe("player-1");
    expect(ws.ball).toBeDefined();
  });

  it("PRNG state includes algorithmId and seed", () => {
    const ws = makeWorldState();
    expect(ws.prng.algorithmId).toBe("mulberry32-v1");
    expect(ws.prng.seed).toBe(42);
  });

  it("ball is independent (no ownerPlayerId)", () => {
    const ws = makeWorldState();
    expect("ownerPlayerId" in ws.ball).toBe(false);
  });
});

describe("CONTRACT-FIXTURE-005: ScenarioDefinition validates", () => {
  it("legal scenario passes validation", () => {
    const sc = makeScenario();
    const errors = validateScenario(sc);
    expect(errors).toEqual([]);
  });

  it("scenario declares exactly one player and one ball", () => {
    const sc = makeScenario();
    expect(sc.players.length).toBe(1);
    expect(sc.ball).toBeDefined();
  });

  it("scenario profile is LABORATORY", () => {
    const sc = makeScenario();
    expect(sc.profile).toBe("LABORATORY");
  });
});

describe("CONTRACT-FIXTURE-006: PresentationSnapshot is shaped correctly", () => {
  it("has all required fields", () => {
    const ps = makePresentationSnapshot();
    expect(ps.tick).toBe(0);
    expect(ps.players.length).toBe(1);
    expect(ps.ball).toBeDefined();
    expect(ps.events).toEqual([]);
    expect(ps.controlAssignments).toBeDefined();
  });
});

describe("CONTRACT-FIXTURE-007: TelemetryObservation is shaped correctly", () => {
  it("has all required fields", () => {
    const to = makeTelemetryObservation();
    expect(to.tick).toBe(0);
    expect(to.players.length).toBe(1);
    expect(to.ball).toBeDefined();
    expect(to.events).toEqual([]);
  });
});

describe("CONTRACT-FIXTURE-008: ReplayV1 is shaped correctly", () => {
  it("has all required fields", () => {
    const rv = makeReplayV1();
    expect(rv.header.replayVersion).toBe("replay-v1");
    expect(rv.header.schemaVersion).toBe("state-v1");
    expect(rv.header.simulationVersion).toBe("sim-v1");
    expect(rv.inputs.length).toBeGreaterThan(0);
    expect(rv.hashes.length).toBeGreaterThan(0);
  });
});

describe("CONTRACT-FIXTURE-009: PlayerState and BallState fields", () => {
  it("PlayerState has required identity and kinematic fields", () => {
    const p = makePlayerState("p1", "t1");
    expect(p.playerId).toBe("p1");
    expect(p.teamId).toBe("t1");
    expect(p.groundPosition).toBeDefined();
    expect(p.linearVelocity).toBeDefined();
    expect(p.desiredVelocity).toBeDefined();
    expect(p.bodyHeading).toBeDefined();
    expect(p.desiredHeading).toBeDefined();
  });

  it("BallState has required 3D fields and no owner", () => {
    const b = makeBallState();
    expect(b.position).toBeDefined();
    expect(b.linearVelocity).toBeDefined();
    expect(b.angularVelocity).toBeDefined();
    expect(b.regime).toBeDefined();
    expect("ownerPlayerId" in b).toBe(false);
  });
});

describe("CONTRACT-FIXTURE-010: WorldState has schedulerMemory", () => {
  it("includes missing-input policy and counters", () => {
    const ws = makeWorldState();
    expect(ws.schedulerMemory.missingInputPolicyId).toBe(MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES);
    expect(typeof ws.schedulerMemory.maxConsecutiveMissing).toBe("number");
  });
});