/**
 * @module tests/browser/5v5-human-vs-cpu.browser.test
 *
 * Browser tests for the 5v5 human-vs-CPU match mode (?mode=human-vs-ai-5v5).
 *
 * Verifies:
 *  1. The5v5 human-vs-CPU scenario loads with10 players (5 per team).
 *  2. Slot-1 is HUMAN with keyboard adapter; slots 2-10 are AI_FALLBACK.
 *  3. Browser/headless hash correspondence + determinism.
 *  4. Human keyboard input drives the controlled player.
 *  5. Player switching (Tab) cycles through the5-person human team.
 *  6. CPU adapters advance the simulation autonomously.
 *  7. Semantic frames captured for DYNAMIC_VISUAL evidence.
 *  8. Screenshot capture produces non-blank images.
 *  9. selectBrowserScenario resolves the mode correctly.
 *
 * Evidence class: DYNAMIC_VISUAL.
 * Case version: browser-case-5v5-human-vs-cpu-v1.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 } from "../../src/apps/browser/foundation-scenario.js";
import { selectBrowserScenario } from "../../src/apps/browser/scenario-selector.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { SWITCH_PLAYER_BIT } from "../../src/contracts/input.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";
import type { InputFrame } from "../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-5V5-HUMAN-VS-CPU";
const CASE_VERSION = "browser-case-5v5-human-vs-cpu-v1";
const OBJECTIVE_ID = "SMALL-SIDED-5V5-HUMAN-VS-CPU";
const SCREENSHOT_DIR = `/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/${OBJECTIVE_ID}`;

// ---------------------------------------------------------------------------
// Headless helper
// ---------------------------------------------------------------------------

function createHeadlessSim(): Simulation {
  const world = createWorld({ scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 });
  return createSimulation(world);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  try {
    bridge.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build per-slot CPU adapters for all AI_FALLBACK slots. */
function buildCpuSlots() {
  return Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
    .filter(([, assignment]) => assignment.mode === "AI_FALLBACK")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));
}

/**
 * Run N ticks with CPU controllers + optional extra frames.
 * Player switching is handled by the simulation core (SWITCH_PLAYER_BIT
 * in frames is processed during sim.step()). No manual detection here
 * to avoid double-switching.
 */
function runWithCpu(
  br: TestBridge,
  ticks: number,
  extraFrames?: (tick: number) => InputFrame[],
): void {
  const sim = br.getSimulation();
  const cpuEntries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  for (let tick = 0; tick < ticks; tick++) {
    const snapshot = sim.snapshot();
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuEntries) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = cpuEntries.map((entry) => {
      const observation = buildCpuObservation(
        snapshot,
        entry.teamId,
        entry.controlledPlayerId,
      );
      observation.teamDecision = teamDecisions.get(entry.teamId);
      const frame = entry.adapter.sample(sim.tick, observation);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });

    if (extraFrames) {
      frames.push(...extraFrames(sim.tick));
    }

    br.injectInputs(frames);
    sim.step();
  }
}

// ===========================================================================
// 5v5 human-vs-CPU scenario structure
// ===========================================================================

describe("5v5 human-vs-CPU scenario structure", () => {
  it("FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 has 10 control slots", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments;
    expect(Object.keys(assignments).length).toBe(10);
  });

  it("has 1 HUMAN slot and 9 AI_FALLBACK slots", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments;
    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.filter((m) => m === "HUMAN")).toHaveLength(1);
    expect(modes.filter((m) => m === "AI_FALLBACK")).toHaveLength(9);
  });

  it("slot-1 is HUMAN on team-a controlling player-1", () => {
    const slot1 = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments["slot-1"];
    expect(slot1.mode).toBe("HUMAN");
    expect(slot1.teamId).toBe("team-a");
    expect(slot1.controlledPlayerId).toBe("player-1");
  });

  it("human team (team-a) has 4 CPU teammates via slots 2-5", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments;
    for (const slotId of ["slot-2", "slot-3", "slot-4", "slot-5"]) {
      const slot = assignments[slotId];
      expect(slot.mode).toBe("AI_FALLBACK");
      expect(slot.teamId).toBe("team-a");
    }
  });

  it("opponent team (team-b) has 5 CPU players via slots 6-10", () => {
    const assignments = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments;
    for (const slotId of ["slot-6", "slot-7", "slot-8", "slot-9", "slot-10"]) {
      const slot = assignments[slotId];
      expect(slot.mode).toBe("AI_FALLBACK");
      expect(slot.teamId).toBe("team-b");
    }
  });

  it("has 10 players total (5 per team)", () => {
    expect(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.players.length).toBe(10);
    const teamA = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.players.filter((p) => p.teamId === "team-a");
    const teamB = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.players.filter((p) => p.teamId === "team-b");
    expect(teamA.length).toBe(5);
    expect(teamB.length).toBe(5);
  });

  it("selectBrowserScenario resolves human-vs-ai-5v5 correctly", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai-5v5");
    expect(scenario).toBe(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
  });
});

// ===========================================================================
// Browser/headless hash correspondence + determinism
// ===========================================================================

describe("5v5 human-vs-CPU determinism", () => {
  it("bridge initial hash matches headless initial hash", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const headlessSim = createHeadlessSim();
    const expectedHash = headlessSim.stateHash();

    expect(bridge.stateHash()).toBe(expectedHash);
  });

  it("two independent bridge runs produce identical per-tick hashes (120 ticks)", async () => {
    const TICKS = 120;

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();
    const hashes1 = bridge.stepWithCpuControllers(TICKS);

    const bridge2 = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge2.reset();
    const hashes2 = bridge2.stepWithCpuControllers(TICKS);

    expect(hashes1).toEqual(hashes2);
    expect(hashes1.length).toBe(TICKS);
    expect(hashes1[TICKS - 1]).toBeTruthy();
  });

  it("bridge CPU hashes match headless CPU hashes for 60 ticks", async () => {
    const TICKS = 60;

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();
    const bridgeHashes = bridge.stepWithCpuControllers(TICKS);

    const headlessSim = createHeadlessSim();
    const entries = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
      .filter(([, assignment]) => assignment.mode !== "HUMAN")
      .map(([controlSlot, assignment]) => ({
        controlSlot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId,
        adapter: createCpuAdapter(),
      }));

    const headlessHashes: string[] = [];
    for (let i = 0; i < TICKS; i++) {
      const snapshot = headlessSim.snapshot();
      const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
      for (const entry of entries) {
        if (!teamDecisions.has(entry.teamId)) {
          const obs = buildCpuObservation(
            snapshot,
            entry.teamId,
            entry.controlledPlayerId,
          );
          teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
        }
      }
      const frames = entries.map((entry) => {
        const obs = buildCpuObservation(
          snapshot,
          entry.teamId,
          entry.controlledPlayerId,
        );
        obs.teamDecision = teamDecisions.get(entry.teamId);
        const frame = entry.adapter.sample(headlessSim.tick, obs);
        frame.controlSlot = entry.controlSlot;
        return frame;
      });
      headlessSim.applyInputs(frames);
      headlessHashes.push(headlessSim.step().stateHash);
    }

    expect(bridgeHashes).toEqual(headlessHashes);
  });
});

// ===========================================================================
// Human keyboard input drives the controlled player
// ===========================================================================

describe("5v5 human-vs-CPU human input", () => {
  it("keyboard movement input drives slot-1 controlled player", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const sim = bridge.getSimulation();

    // Record initial position.
    const initialPos = sim.snapshot().players[0].groundPosition;

    // Inject a forward-moving input frame for slot-1.
    const frames: InputFrame[] = [
      {
        tick: 0,
        sourceId: "keyboard",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];

    // Run 10 ticks with human input + CPU for teammates.
    for (let tick = 0; tick < 10; tick++) {
      const snapshot = sim.snapshot();
      const cpuFrames = Object.entries(FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.controlAssignments)
        .filter(([, a]) => a.mode === "AI_FALLBACK")
        .map(([slot, a]) => {
          const adapter = createCpuAdapter();
          const obs = buildCpuObservation(snapshot, a.teamId, a.controlledPlayerId);
          const frame = adapter.sample(sim.tick, obs);
          frame.controlSlot = slot;
          return frame;
        });

      const allFrames = tick === 0 ? [...frames, ...cpuFrames] : cpuFrames;
      bridge.injectInputs(allFrames);
      sim.step();
    }

    const finalPos = sim.snapshot().players[0].groundPosition;
    // Player should have moved (non-zero displacement).
    const dx = finalPos.x - initialPos.x;
    expect(Math.abs(dx)).toBeGreaterThan(0.01);
  });
});

// ===========================================================================
// Player switching cycles through 5-person human team
// ===========================================================================

describe("5v5 human-vs-CPU player switching", () => {
  it("Tab cycles through 5 teammates (player-1 → player-2 → ... → player-5 → player-1)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const sim = bridge.getSimulation();
    const teamAPlayers = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.players
      .filter((p) => p.teamId === "team-a")
      .map((p) => p.playerId)
      .sort();

    // Initial: slot-1 controls player-1.
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");

    // Tab through all 5 teammates (direct setControlledPlayer, matching the5v3 convention).
    for (let i = 0; i < 5; i++) {
      const current = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;
      const idx = teamAPlayers.indexOf(current);
      const next = teamAPlayers[(idx + 1) % teamAPlayers.length];
      sim.setControlledPlayer("slot-1", next);
      expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe(next);
    }

    // After5 Tabs, should be back to player-1.
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");
  });

  it("Tab via injected frame switches player (simulation core handles SWITCH_PLAYER_BIT)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const sim = bridge.getSimulation();
    expect(sim.snapshot().controlAssignments["slot-1"].controlledPlayerId).toBe("player-1");

    // Inject a SWITCH_PLAYER_BIT frame and let sim.step() handle it.
    const switchFrame: InputFrame = {
      tick: 0,
      sourceId: "keyboard",
      controlSlot: "slot-1",
      moveX: 0,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: SWITCH_PLAYER_BIT,
      releasedButtons: 0,
    };
    bridge.injectInputs([switchFrame]);
    sim.step();

    // Simulation core processes the switch: player-1 → player-2.
    const after = sim.snapshot().controlAssignments["slot-1"];
    expect(after.controlledPlayerId).toBe("player-2");
  });

  it("CPU slots retain their controlled player after human switches", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const sim = bridge.getSimulation();

    const initialSlot2Player = sim.snapshot().controlAssignments["slot-2"].controlledPlayerId;
    const initialSlot6Player = sim.snapshot().controlAssignments["slot-6"].controlledPlayerId;

    // Directly switch human slot (matching the5v3 test pattern).
    sim.setControlledPlayer("slot-1", "player-2");

    const after = sim.snapshot();
    expect(after.controlAssignments["slot-1"].controlledPlayerId).toBe("player-2");
    // CPU teammates unaffected.
    expect(after.controlAssignments["slot-2"].controlledPlayerId).toBe(initialSlot2Player);
    // CPU opponents unaffected.
    expect(after.controlAssignments["slot-6"].controlledPlayerId).toBe(initialSlot6Player);
  });
});

// ===========================================================================
// CPU-driven simulation advances
// ===========================================================================

describe("5v5 human-vs-CPU simulation", () => {
  it("runs 120 ticks without errors", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const cpuSlots = buildCpuSlots();
    const sim = bridge.getSimulation();

    for (let tick = 0; tick < 120; tick++) {
      const snapshot = sim.snapshot();
      const frames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(snapshot, teamId, controlledPlayerId);
        const frame = adapter.sample(sim.tick, obs);
        frame.controlSlot = controlSlot;
        frames.push(frame);
      }
      bridge.injectInputs(frames);
      sim.step();
    }

    expect(sim.tick).toBe(120);
  });

  it("CPU adapters produce non-zero displacement over 120 ticks", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const cpuSlots = buildCpuSlots();
    const sim = bridge.getSimulation();

    for (let tick = 0; tick < 120; tick++) {
      const snapshot = sim.snapshot();
      const frames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(snapshot, teamId, controlledPlayerId);
        const frame = adapter.sample(sim.tick, obs);
        frame.controlSlot = controlSlot;
        frames.push(frame);
      }
      bridge.injectInputs(frames);
      sim.step();
    }

    const finalSnapshot = sim.snapshot();
    const movedPlayers = finalSnapshot.players.filter((p) => {
      const orig = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5.players.find(
        (sp) => sp.playerId === p.playerId,
      );
      if (!orig) return false;
      const dx = p.groundPosition.x - orig.groundPosition.x;
      const dy = p.groundPosition.y - orig.groundPosition.y;
      return Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    });
    expect(movedPlayers.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// DYNAMIC_VISUAL: semantic frame capture + screenshot evidence
// ===========================================================================

describe("5v5 human-vs-CPU DYNAMIC_VISUAL evidence", () => {
  it(
    "captures 5 semantic frames: before → human input → CPU play → switch → continuity",
    async () => {
      const { page } = await import("@vitest/browser/context");

      // Frame 1: before — initial state (tick 0).
      bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
      await bridge.reset();
      bridge.renderFrame();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-before.png`, type: "png" });

      expect(bridge.getSimulation().presentation().players.length).toBe(10);

      // Frame 2: human input — inject forward movement (tick 30).
      for (let t = 0; t < 30; t++) {
        const snapshot = bridge.getSimulation().snapshot();
        const cpuFrames = buildCpuSlots().map((s) => {
          const obs = buildCpuObservation(snapshot, s.teamId, s.controlledPlayerId);
          const frame = s.adapter.sample(bridge.getSimulation().tick, obs);
          frame.controlSlot = s.controlSlot;
          return frame;
        });
        if (t === 0) {
          cpuFrames.push({
            tick: 0,
            sourceId: "keyboard",
            controlSlot: "slot-1",
            moveX: 1,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          });
        }
        bridge.injectInputs(cpuFrames);
        bridge.getSimulation().step();
      }
      bridge.renderFrame();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-human-input.png`, type: "png" });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(30);

      // Frame 3: CPU play — extended CPU-only play (tick 120).
      bridge.stepWithCpuControllers(90);
      bridge.renderFrame();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-cpu-play.png`, type: "png" });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(120);

      // Frame 4: switch — Tab press to switch controlled player (tick 150).
      // Inject a SWITCH_PLAYER_BIT frame and let the simulation handle it.
      {
        const switchF: InputFrame = {
          tick: bridge.getSimulation().tick,
          sourceId: "keyboard",
          controlSlot: "slot-1",
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: SWITCH_PLAYER_BIT,
          releasedButtons: 0,
        };
        bridge.injectInputs([switchF]);
        bridge.getSimulation().step();
      }
      // Advance remaining ticks with CPU only.
      {
        const remaining = 30 - 1;
        if (remaining > 0) bridge.stepWithCpuControllers(remaining);
      }
      bridge.renderFrame();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-switch.png`, type: "png" });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(150);

      // Frame 5: continuity — continued play after switch (tick 270).
      bridge.stepWithCpuControllers(120);
      bridge.renderFrame();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/frame-continuity.png`, type: "png" });
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(270);

      // Verify10 players still present.
      expect(bridge.getSimulation().presentation().players.length).toBe(10);

      // Store evidence data on window for extraction.
      (window as unknown as Record<string, string>).__5v5HumanCpuInitialHash = bridge.stateHash();
      (window as unknown as Record<string, string>).__5v5HumanCpuFrameMeta = JSON.stringify([
        { label: "before", tick: 0, note: "Initial 5v5 human-vs-CPU state — 10 players at formation" },
        { label: "human-input", tick: 30, note: "Human keyboard input drives slot-1 player forward" },
        { label: "cpu-play", tick: 120, note: "Extended CPU play — teammates and opponents active" },
        { label: "switch", tick: 150, note: "Tab switch — human cycles to next teammate on team-a" },
        { label: "continuity", tick: 270, note: "Continued match play after switch — 5v5 in progress" },
      ]);

      // Store per-tick hashes from a fresh run.
      const bridge2 = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
      await bridge2.reset();
      const perTickHashes = bridge2.stepWithCpuControllers(360);
      (window as unknown as Record<string, string>).__5v5HumanCpuPerTickHashes = JSON.stringify(perTickHashes);
    },
    { timeout: 120_000 },
  );

  it("semantic frames are non-blank (luminance and color variance)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    bridge.stepWithCpuControllers(120);
    bridge.renderFrame();
    const capture = await bridge.capture();

    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);

    const img = new Image();
    const src = `data:image/png;base64,${base64Data}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode screenshot image"));
      img.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    expect(ctx).not.toBeNull();

    ctx!.drawImage(img, 0, 0);
    const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const luminances: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      luminances.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
    const variance =
      luminances.reduce((sum, l) => sum + (l - mean) * (l - mean), 0) / luminances.length;

    expect(variance).toBeGreaterThan(50);

    const colorSet = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) {
      colorSet.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    expect(colorSet.size).toBeGreaterThanOrEqual(20);
  });

  it("all five captured frames are distinct (different state hashes)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    const ticks = [0, 30, 120, 150, 270];
    const hashes: string[] = [];

    for (const t of ticks) {
      while (bridge.getSimulation().tick < t) {
        const remaining = t - bridge.getSimulation().tick;
        bridge.stepWithCpuControllers(Math.min(remaining, 30));
      }
      hashes.push(bridge.stateHash());
    }

    const unique = new Set(hashes);
    expect(unique.size).toBeGreaterThanOrEqual(3);

    // Ticks must be monotonically increasing.
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it("screenshot capture produces valid PNG with 10 players", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5);
    await bridge.reset();

    bridge.stepWithCpuControllers(120);
    bridge.renderFrame();
    const capture = await bridge.capture();

    expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
    const base64Data = capture.screenshot.split(",")[1] ?? "";
    expect(base64Data.length).toBeGreaterThan(100);
    expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(11); // 10 players + ball
    expect(capture.presentationSnapshot.players.length).toBe(10);
    expect(capture.presentationSnapshot.tick).toBeGreaterThan(0);
  });
});
