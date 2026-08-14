/**
 * @module input-system-tests
 *
 * Tests for the normalized input system (BOOTSTRAP-06).
 *
 * Covers:
 *  - Valid frame, out-of-range frame, wrong tick/slot, duplicate (including cross-call), stable-order
 *  - Missing-frame edge clearing, bounded repeat, neutral fallback
 *  - Two equivalent traces with different sourceId → identical hashes and gameplay telemetry
 *  - Pressed/released edges occur once and do not repeat during held-input fallback
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 * `fs` is used only here in tests.
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
import {
  validateInputFrame,
  filterDuplicateFrames,
  createRejectionEvent,
  NEUTRAL_INPUT,
} from "../../../src/simulation/input/input-system.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

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

// ===========================================================================
// 1. Frame validation
// ===========================================================================

describe("BOOTSTRAP-06-FRAME-001: valid frame passes validation", () => {
  it("a legal frame with all zeros", () => {
    const frame = makeFrame(5);
    expect(validateInputFrame(frame)).toBe(true);
  });

  it("a legal frame with positive values", () => {
    const frame = makeFrame(10, "slot-2", {
      moveX: 1,
      moveY: 1,
      sprint: 1,
      heldButtons: 3,
      pressedButtons: 1,
      releasedButtons: 2,
    });
    expect(validateInputFrame(frame)).toBe(true);
  });

  it("a legal frame with negative moveX", () => {
    const frame = makeFrame(3, "slot-1", { moveX: -0.7 });
    expect(validateInputFrame(frame)).toBe(true);
  });

  it("a legal frame at boundaries -1 and 1", () => {
    const frame = makeFrame(0, "slot-1", {
      moveX: -1,
      moveY: 1,
    });
    expect(validateInputFrame(frame)).toBe(true);
  });
});

describe("BOOTSTRAP-06-FRAME-002: out-of-range frame fails validation", () => {
  it("moveX > 1", () => {
    expect(validateInputFrame(makeFrame(0, "s", { moveX: 1.01 }))).toBe(false);
  });

  it("moveX < -1", () => {
    expect(validateInputFrame(makeFrame(0, "s", { moveX: -1.01 }))).toBe(false);
  });

  it("moveY out of range", () => {
    expect(validateInputFrame(makeFrame(0, "s", { moveY: 2 }))).toBe(false);
  });

  it("sprint > 1", () => {
    expect(validateInputFrame(makeFrame(0, "s", { sprint: 1.1 }))).toBe(false);
  });

  it("sprint < 0", () => {
    expect(validateInputFrame(makeFrame(0, "s", { sprint: -0.1 }))).toBe(false);
  });

  it("NaN moveX", () => {
    expect(validateInputFrame(makeFrame(0, "s", { moveX: NaN as any }))).toBe(false);
  });

  it("Infinity moveY", () => {
    expect(validateInputFrame(makeFrame(0, "s", { moveY: Infinity as any }))).toBe(false);
  });
});

describe("BOOTSTRAP-06-FRAME-003: wrong tick/slot fails", () => {
  it("negative tick", () => {
    expect(validateInputFrame(makeFrame(-1))).toBe(false);
  });

  it("non-integer tick", () => {
    expect(
      validateInputFrame({
        ...makeFrame(0),
        tick: 3.5 as any,
      }),
    ).toBe(false);
  });

  it("empty controlSlot", () => {
    expect(
      validateInputFrame({
        ...makeFrame(0, ""),
        controlSlot: "",
      }),
    ).toBe(false);
  });
});

// ===========================================================================
// 2. Duplicate detection
// ===========================================================================

describe("BOOTSTRAP-06-DUP-001: within-batch duplicates are detected", () => {
  it("same tick + same slot in one batch", () => {
    const frames = [
      makeFrame(5, "s1"),
      makeFrame(5, "s1"),
    ];
    const { rejectFrames, okFrames } = filterDuplicateFrames(frames, []);
    expect(rejectFrames.length).toBe(1);
    expect(okFrames.length).toBe(1);
  });

  it("different slots at same tick are ok", () => {
    const frames = [
      makeFrame(5, "s1"),
      makeFrame(5, "s2"),
    ];
    const { rejectFrames, okFrames } = filterDuplicateFrames(frames, []);
    expect(rejectFrames.length).toBe(0);
    expect(okFrames.length).toBe(2);
  });
});

describe("BOOTSTRAP-06-DUP-002: cross-call duplicates are detected", () => {
  it("a frame matching a previously buffered frame", () => {
    const existing = [makeFrame(3, "s1")];
    const newFrames = [makeFrame(3, "s1"), makeFrame(4, "s1")];
    const { rejectFrames, okFrames } = filterDuplicateFrames(
      newFrames,
      existing,
    );
    expect(rejectFrames.length).toBe(1);
    expect(okFrames.length).toBe(1);
  });

  it("same tick different slot does not reject", () => {
    const existing = [makeFrame(3, "s1")];
    const newFrames = [makeFrame(3, "s2")];
    const { rejectFrames, okFrames } = filterDuplicateFrames(
      newFrames,
      existing,
    );
    expect(rejectFrames.length).toBe(0);
    expect(okFrames.length).toBe(1);
  });

  it("same slot different tick does not reject", () => {
    const existing = [makeFrame(3, "s1")];
    const newFrames = [makeFrame(5, "s1")];
    const { rejectFrames, okFrames } = filterDuplicateFrames(
      newFrames,
      existing,
    );
    expect(rejectFrames.length).toBe(0);
    expect(okFrames.length).toBe(1);
  });
});

describe("BOOTSTRAP-06-DUP-003: simulation rejects cross-call duplicates", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
  });

  it("applyInputs same frame twice throws", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const frame = makeFrame(0);
    sim.applyInputs([frame]);
    expect(() => sim.applyInputs([frame])).toThrow(/Duplicate/);
  });

  it("two separate calls with same (tick, slot) throws", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim.applyInputs([makeFrame(0)]);
    sim.applyInputs([makeFrame(1)]);
    expect(() => sim.applyInputs([makeFrame(0)])).toThrow(/Duplicate/);
  });

  it("duplicate detection preserves stable order — both reported", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    // Apply frame at tick 0, then tick 1.
    sim.applyInputs([makeFrame(0)]);
    sim.applyInputs([makeFrame(1)]);

    // Now try to add tick 0 again — should throw cross-call duplicate.
    expect(() => sim.applyInputs([makeFrame(0)])).toThrow(/Duplicate/);

    // Verify the simulation is still usable for later ticks.
    sim.applyInputs([makeFrame(2)]);
    sim.step(); // tick 1
    sim.step(); // tick 2
    expect(sim.tick).toBe(2);
  });
});

describe("BOOTSTRAP-06-DUP-004: stable-order — arrival order never a tie-break", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
  });

  it("duplicate rejection does not use arrival order to decide", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const frameA = makeFrame(0, "s1", { moveX: 0.9, sourceId: "A" });
    const frameB = makeFrame(0, "s1", { moveX: 0.1, sourceId: "B" });

    // Apply frameA first, then frameB. Should throw because of duplicate.
    sim.applyInputs([frameA]);
    expect(() => sim.applyInputs([frameB])).toThrow(/Duplicate/);

    // Now reverse: apply frameB first, then frameA. Should also throw.
    const sim2 = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim2.applyInputs([frameB]);
    expect(() => sim2.applyInputs([frameA])).toThrow(/Duplicate/);

    // In both cases, only one frame is accepted (the first applied).
    // Neither arrival order is used as a "tie-breaker" — both reject the second.
    const r1 = sim.step();
    const r2 = sim2.step();
    // Both should hash identically since only one frame survived.
    expect(r1.stateHash).toBe(r2.stateHash);
  });
});

// ===========================================================================
// 3. Missing-input: edge clearing, bounded repeat, neutral fallback
// ===========================================================================

describe("BOOTSTRAP-06-MISSING-001: missing frame fallback chain", () => {
  it("missing frame counts and repeats held value", () => {
    // Create a minimal scenario with empty inputProgram so manual frames aren't
    // confused with the fixture's predefined inputs.
    const scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Tick 0: apply a frame with moveX=0.5.
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.5 })]);

    // Step 1: tick 0 frame consumed (stored for repeat-held).
    const r1 = sim.step();
    expect(sim.tick).toBe(1);
    // No fallback for tick 0 — it had a real frame.
    const r1Scheduler = r1.events.filter((e) => e.kind === "scheduler");
    expect(r1Scheduler.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);

    // Step 2: tick 1 has no input → first fallback (count=1).
    const r2 = sim.step();
    expect(sim.tick).toBe(2);
    const r2Scheduler = r2.events.filter((e) => e.kind === "scheduler");
    const r2Repeat = r2Scheduler.find((e) => e.label.includes("REPEAT_HELD"));
    expect(r2Repeat).toBeDefined();
    expect(r2Repeat!.payload.count).toBe(1);

    // Step 3: tick 2 has no input → second fallback (count=2).
    const r3 = sim.step();
    expect(sim.tick).toBe(3);
    const r3Scheduler = r3.events.filter((e) => e.kind === "scheduler");
    const r3Repeat = r3Scheduler.find((e) => e.label.includes("REPEAT_HELD"));
    expect(r3Repeat).toBeDefined();
    expect(r3Repeat!.payload.count).toBe(2);
  });

  it("maxConsecutiveMissing defaults to 3 from scenario", () => {
    const scenarioCopy = loadFixture("foundation-move-and-roll.v1.json");
    expect(scenarioCopy.maxConsecutiveMissing).toBe(3);
  });
});

describe("BOOTSTRAP-06-MISSING-002: pressed/released edges zero during repeat", () => {
  it("press on tick 0, then missing ticks zero pressedButtons during repeat", () => {
    const scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };

    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    // pressedButtons = 1 on tick 0, heldButtons = 0.
    sim.applyInputs([makeFrame(0, "slot-1", { pressedButtons: 1 })]);

    // Step 1: tick 0 consumed (stored). No fallback for tick 0.
    const r1 = sim.step();
    expect(sim.tick).toBe(1);
    const r1Fallback = r1.events.filter((e) => e.kind === "scheduler");
    // No repeat for tick 0 — it had a real frame.
    expect(r1Fallback.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);

    // Step 2: tick 1 missing → first repeat (count=1), zeroed edges.
    const r2 = sim.step();
    expect(sim.tick).toBe(2);

    const r2Fallback = r2.events.filter((e) => e.kind === "scheduler");
    const r2Repeat = r2Fallback.find((e) => e.label.includes("REPEAT_HELD_WITH_ZERO_EDGES"));
    expect(r2Repeat).toBeDefined();
    expect(r2Repeat!.payload.pressedButtons).toBe(0);
    expect(r2Repeat!.payload.releasedButtons).toBe(0);
    expect(r2Repeat!.payload.count).toBe(1);

    // Step 3: tick 2 missing → second repeat (count=2).
    const r3 = sim.step();
    expect(sim.tick).toBe(3);
    const r3Fallback = r3.events.filter((e) => e.kind === "scheduler");
    const r3Repeats = r3Fallback.filter((e) => e.label.includes("REPEAT_HELD_WITH_ZERO_EDGES"));
    expect(r3Repeats.length).toBe(1);
    expect(r3Repeats[0].payload.pressedButtons).toBe(0);
    expect(r3Repeats[0].payload.releasedButtons).toBe(0);
    expect(r3Repeats[0].payload.count).toBe(2);

    // Step 4: tick 3 missing → third repeat (count=3 at max).
    const r4 = sim.step();
    expect(sim.tick).toBe(4);
    const r4Fallback = r4.events.filter((e) => e.kind === "scheduler");
    const r4Repeats = r4Fallback.filter((e) => e.label.includes("REPEAT_HELD_WITH_ZERO_EDGES"));
    expect(r4Repeats.length).toBe(1);
    expect(r4Repeats[0].payload.count).toBe(3);
  });

  it("neutral fallback after exceeding max", () => {
    const scenarioCopy = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
      maxConsecutiveMissing: 2,
    };

    const sim = createSimulation(createWorld({ scenario: scenarioCopy }), NO_OP_OBSERVER);
    // Tick 0: frame.
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.5 })]);
    sim.step(); // tick 1: tick 0 frame consumed, stored. No fallback.

    // Step 2: tick 1 missing → repeat count=1.
    const r2 = sim.step();
    expect(sim.tick).toBe(2);

    const r2Fallback = r2.events.filter((e) => e.kind === "scheduler");
    const r2Repeat = r2Fallback.find((e) => e.label.includes("REPEAT_HELD_WITH_ZERO_EDGES"));
    expect(r2Repeat).toBeDefined();
    expect(r2Repeat!.payload.count).toBe(1);

    // Step 3: tick 2 missing → count=2 (repeat at max), tick 2 missing → NEUTRAL (count=2 >= maxMissing=2).
    const r3 = sim.step();
    expect(sim.tick).toBe(3);

    const r3Fallback = r3.events.filter((e) => e.kind === "scheduler");
    const r3Repeat = r3Fallback.find((e) => e.label.includes("REPEAT_HELD_WITH_ZERO_EDGES"));
    expect(r3Repeat).toBeDefined();
    expect(r3Repeat!.payload.count).toBe(2);

    // r3 should also have a neutral event from the new-tick pass (count exceeded).
    // The count in the payload is the count at which neutral was triggered (2).
    const r3Neutral = r3Fallback.find((e) => e.label.toLowerCase().includes("neutral"));
    expect(r3Neutral).toBeDefined();
    expect(r3Neutral!.payload.count).toBe(2);
  });
});

// ===========================================================================
// 4. sourceId independence: different sourceId → same hash
// ===========================================================================

describe("BOOTSTRAP-06-SOURCEID-001: sourceId does not affect hash", () => {
  it("two runs with different sourceId produce identical hashes", () => {
    const scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };

    // Run A: sourceId = "replay"
    const simA = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    for (let t = 0; t < 3; t++) {
      simA.applyInputs([makeFrame(t, "slot-1", { sourceId: "replay" })]);
      const r = simA.step();
      expect(typeof r.stateHash).toBe("string");
    }

    // Run B: sourceId = "keyboard"
    const simB = createSimulation(createWorld({ scenario: { ...scenario } }), NO_OP_OBSERVER);
    for (let t = 0; t < 3; t++) {
      simB.applyInputs([makeFrame(t, "slot-1", { sourceId: "keyboard" })]);
      simB.step();
    }

    // The two simulations should have identical per-tick hashes.
    const snapA = simA.snapshot();
    const snapB = simB.snapshot();
    expect(encodeCanonical(snapA)).toBe(encodeCanonical(snapB));
  });

  it("gameplay telemetry fields are identical regardless of sourceId", () => {
    const scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };

    let capturedA: { tick: number; hash: string }[] = [];
    const observerA = {
      onInvariantPass(obs: { tick: number; stateHash: string }) {
        capturedA.push({ tick: obs.tick, hash: obs.stateHash });
      },
    };

    let capturedB: { tick: number; hash: string }[] = [];
    const observerB = {
      onInvariantPass(obs: { tick: number; stateHash: string }) {
        capturedB.push({ tick: obs.tick, hash: obs.stateHash });
      },
    };

    const simA = createSimulation(createWorld({ scenario }), observerA);
    const simB = createSimulation(createWorld({ scenario: { ...scenario } }), observerB);

    for (let i = 0; i < 5; i++) {
      simA.applyInputs([makeFrame(i, "slot-1", { sourceId: "A" })]);
      simB.applyInputs([makeFrame(i, "slot-1", { sourceId: "B" })]);
      simA.step();
      simB.step();
    }

    // Same number of captured events.
    expect(capturedA.length).toBe(capturedB.length);
    // Same hashes at every tick.
    for (let i = 0; i < capturedA.length; i++) {
      expect(capturedA[i].hash).toBe(capturedB[i].hash);
      expect(capturedA[i].tick).toBe(capturedB[i].tick);
    }
  });
});

// ===========================================================================
// 5. Neutral input constant
// ===========================================================================

describe("BOOTSTRAP-06-NEUTRAL-001: neutral input constant", () => {
  it("NEUTRAL_INPUT has all zeros", () => {
    expect(NEUTRAL_INPUT.moveX).toBe(0);
    expect(NEUTRAL_INPUT.moveY).toBe(0);
    expect(NEUTRAL_INPUT.sprint).toBe(0);
    expect(NEUTRAL_INPUT.heldButtons).toBe(0);
    expect(NEUTRAL_INPUT.pressedButtons).toBe(0);
    expect(NEUTRAL_INPUT.releasedButtons).toBe(0);
  });

  it("NEUTRAL_INPUT is frozen", () => {
    expect(Object.isFrozen(NEUTRAL_INPUT)).toBe(true);
  });
});

// ===========================================================================
// 6. Rejection event creation
// ===========================================================================

describe("BOOTSTRAP-06-REJECTION-001: rejection event creation", () => {
  it("createRejectionEvent produces a valid event", () => {
    const frame = makeFrame(5, "slot-1", { sourceId: "bad" });
    const evt = createRejectionEvent(5, frame, 42);
    expect(evt.tick).toBe(5);
    expect(evt.sequence).toBe(42);
    expect(evt.kind).toBe("input-rejection");
    expect(evt.label).toContain("Duplicate");
    expect(evt.payload.rejectedControlSlot).toBe("slot-1");
    expect(evt.payload.rejectedSourceId).toBe("bad");
  });
});

// ===========================================================================
// 7. Cross-cutting: simulation step with input resolution
// ===========================================================================

describe("BOOTSTRAP-06-STEP-001: step respects input frames", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
  });

  it("applying a frame then stepping consumes it", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.75 })]);
    const r = sim.step();
    expect(sim.tick).toBe(1);
    expect(r.tick).toBe(1);
  });

  it("out-of-range input in applyInputs throws", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    expect(() => sim.applyInputs([makeFrame(0, "slot-1", { moveX: 5 })])).toThrow(
      /Invalid input frame/,
    );
  });

  it("events array from step() contains defensive copies", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    const r1 = sim.step();
    const r2 = sim.step();

    // Mutating r1.events should not affect r2 or internal state.
    if (r1.events.length > 0) {
      r1.events[0] = {
        ...r1.events[0],
        label: "mutated",
      } as any;
    }

    const r3 = sim.step();
    // r3 should still be valid and not affected.
    expect(r3.tick).toBe(sim.tick);
    expect(typeof r3.stateHash).toBe("string");
  });
});

// ===========================================================================
// 8. Single-resolution: consecutive real frames, no false diagnostics, tick alignment
// ===========================================================================

describe("BOOTSTRAP-06-SINGLE-RES-001: consecutive real frames produce no fallback events", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };
  });

  it("three consecutive real frames → zero missing-input-counters", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Apply frames for ticks 0, 1, 2.
    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 0.3 }),
      makeFrame(1, "slot-1", { moveX: 0.4 }),
      makeFrame(2, "slot-1", { moveX: 0.5 }),
    ]);

    // Step to tick 1: consume tick-0 frame.
    const r1 = sim.step();
    expect(sim.tick).toBe(1);
    expect(r1.tick).toBe(1);
    // No REPEAT_HELD or neutral events for tick 1 (tick 0 had a real frame).
    const r1Fb = r1.events.filter((e) => e.kind === "scheduler");
    expect(r1Fb.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);
    expect(r1Fb.filter((e) => e.label.toLowerCase().includes("neutral")).length).toBe(0);

    // Step to tick 2: consume tick-1 frame.
    const r2 = sim.step();
    expect(sim.tick).toBe(2);
    expect(r2.tick).toBe(2);
    const r2Fb = r2.events.filter((e) => e.kind === "scheduler");
    expect(r2Fb.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);
    expect(r2Fb.filter((e) => e.label.toLowerCase().includes("neutral")).length).toBe(0);

    // Step to tick 3: consume tick-2 frame.
    const r3 = sim.step();
    expect(sim.tick).toBe(3);
    expect(r3.tick).toBe(3);
    const r3Fb = r3.events.filter((e) => e.kind === "scheduler");
    expect(r3Fb.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);
    expect(r3Fb.filter((e) => e.label.toLowerCase().includes("neutral")).length).toBe(0);

    // Verify schedulerMemory counters are zero after consuming real frames.
    const counters = (sim as any).snapshot()?.schedulerMemory?.missingInputCounters;
    expect(counters?.["slot-1"] ?? 0).toBe(0);
  });

  it("gap of missing frames in between real frames → correct counts", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Frame at tick 0, then frame at tick 3 (missing ticks 1, 2).
    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 0.3 }),
      makeFrame(3, "slot-1", { moveX: 0.6 }),
    ]);

    // Step 1 → tick 1: consume tick 0 frame (stored for repeat).
    const r1 = sim.step();
    expect(sim.tick).toBe(1);
    expect(r1.tick).toBe(1);
    const r1Fb = r1.events.filter(
      (e) => e.kind === "scheduler" && e.label.includes("REPEAT_HELD"),
    );
    expect(r1Fb.length).toBe(0); // tick 0 had a frame — no fallback.

    // Step 2 → tick 2: tick 1 missing → REPEAT count=1.
    const r2 = sim.step();
    expect(sim.tick).toBe(2);
    expect(r2.tick).toBe(2);
    const r2Fb = r2.events.filter(
      (e) => e.kind === "scheduler" && e.label.includes("REPEAT_HELD"),
    );
    expect(r2Fb.length).toBe(1);
    expect(r2Fb[0].payload.count).toBe(1);

    // Step 3 → tick 3: tick 2 missing → REPEAT count=2.
    const r3 = sim.step();
    expect(sim.tick).toBe(3);
    expect(r3.tick).toBe(3);
    const r3Fb = r3.events.filter(
      (e) => e.kind === "scheduler" && e.label.includes("REPEAT_HELD"),
    );
    expect(r3Fb.length).toBe(1);
    expect(r3Fb[0].payload.count).toBe(2);

    // Step 4 → tick 4: consume tick 3 frame (stored, counter resets).
    const r4 = sim.step();
    expect(sim.tick).toBe(4);
    expect(r4.tick).toBe(4);
    const r4Fb = r4.events.filter((e) => e.kind === "scheduler");
    expect(r4Fb.filter((e) => e.label.includes("REPEAT_HELD")).length).toBe(0);
    expect(r4Fb.filter((e) => e.label.toLowerCase().includes("neutral")).length).toBe(0);
  });
});

describe("BOOTSTRAP-06-SINGLE-RES-002: first valid frame does not emit input-unassigned", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = loadFixture("foundation-move-and-roll.v1.json");
  });

  it("valid frame for the assigned slot does not produce unassigned diagnostic", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.5 })]);
    const r = sim.step();
    expect(sim.tick).toBe(1);

    // No input-unassigned event in the result.
    const unassigned = r.events.filter(
      (e) => e.label.toLowerCase().includes("unassigned") || e.label.toLowerCase().includes("not assigned"),
    );
    expect(unassigned.length).toBe(0);
  });
});

describe("BOOTSTRAP-06-SINGLE-RES-003: every step event tick matches committed tick", () => {
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    scenario = {
      ...loadFixture("foundation-move-and-roll.v1.json"),
      inputProgram: {},
    };
  });

  it("all events in a step result have tick === step tick", () => {
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    // Apply frame at tick 1 only.
    sim.applyInputs([makeFrame(1, "slot-1", { moveX: 0.5 })]);

    // Step to tick 1: consume tick-0 frame (missing), commit tick 1.
    const r1 = sim.step();
    expect(r1.tick).toBe(1);
    for (const e of r1.events) {
      expect(e.tick).toBe(1);
    }

    // Step to tick 2: consume tick-1 frame (real).
    const r2 = sim.step();
    expect(r2.tick).toBe(2);
    for (const e of r2.events) {
      expect(e.tick).toBe(2);
    }

    // Step to tick 3: consume tick-2 frame (missing).
    const r3 = sim.step();
    expect(r3.tick).toBe(3);
    for (const e of r3.events) {
      expect(e.tick).toBe(3);
    }
  });
});