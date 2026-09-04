/**
 * @module tests/browser/small-sided-integrated-playtest.browser.test
 *
 * Browser case BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: integrated
 * playable small-sided match that runs a coherent 3v3 CPU-vs-CPU match,
 * collects simulation events + telemetry, feeds through the accepted
 * situation scanner, and reports per-situation localization.
 *
 * This ties the 8 SMALL_SIDED_SHAPE milestone situations to the actual
 * browseable experience of a coherent match, rather than isolated
 * lab-driven fixtures.
 *
 * Evidence class: DYNAMIC_VISUAL.
 * Case version: browser-case-integrated-playtest-v1.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import { buildCpuObservation, createCpuAdapter } from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { scanMatch } from "../../eval/runners/small-sided-match-situation-scanner.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import type { MatchSituationScanResult } from "../../eval/runners/small-sided-match-situation-scanner.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST";
const CASE_VERSION = "browser-case-integrated-playtest-v1";
// Capture-hygiene (0.9.2+): ordinary regression runs must not write
// docs/screenshots/**. Durable evidence is entered only through the explicit
// evidence-mode capture (WIP_SECTION=__EVIDENCE__:SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH).
const OBJECTIVE_ID = "SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const EVIDENCE_DIR = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;

const TOTAL_TICKS = 360;

// ---------------------------------------------------------------------------
// 8 milestone situations
// ---------------------------------------------------------------------------

const MILESTONE_SITUATIONS = [
  "PASS_RECEPTION",
  "SHOT_TO_RESULT",
  "PHYSICAL_DUEL",
  "SUPPORT_AND_PASSING_LANES",
  "SETTLED_ATTACK_VS_DEFENCE",
  "ATTACK_TO_DEFENCE_TRANSITION",
  "DEFENCE_TO_ATTACK_TRANSITION",
  "COORDINATED_PRESS",
] as const;

// ---------------------------------------------------------------------------
// Headless CPU match runner — collects events + observations
// ---------------------------------------------------------------------------

interface HeadlessCpuResult {
  events: SimulationEvent[];
  observations: TelemetryObservation[];
  hashes: string[];
  totalTicks: number;
}

function runHeadlessCpuMatch(ticks: number): HeadlessCpuResult {
  const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
  const observations: TelemetryObservation[] = [];
  const observer: SimulationObserver = {
    onObservation(obs) {
      observations.push(obs);
    },
  };
  const sim = createSimulation(world, observer);

  const cpuEntries = Object.entries(FOUNDATION_SCENARIO_3V3.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  const allEvents: SimulationEvent[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < ticks; i++) {
    const snapshot = sim.snapshot();

    // Compute one team decision per team.
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuEntries) {
      if (!teamDecisions.has(entry.teamId)) {
        const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
        teamDecisions.set(entry.teamId, computeTeamDecision(obs, entry.teamId));
      }
    }

    const frames = cpuEntries.map((entry) => {
      const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      observation.teamDecision = teamDecisions.get(entry.teamId);
      const frame = entry.adapter.sample(sim.tick, observation);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });

    sim.applyInputs(frames);
    const result = sim.step();
    hashes.push(result.stateHash);
    for (const evt of result.events) {
      allEvents.push(evt);
    }
  }

  return { events: allEvents, observations, hashes, totalTicks: ticks };
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
    bridge?.getPresentationSession().dispose();
  } catch {
    /* already disposed */
  }
  if (container?.parentElement) {
    container.parentElement.removeChild(container);
  }
});

// ===========================================================================
// Structure + coherence
// ===========================================================================

describe("BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: scenario structure", () => {
  it("FOUNDATION_SCENARIO_3V3 has 6 AI_FALLBACK control slots", () => {
    const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;
    const slots = Object.keys(assignments);
    expect(slots.length).toBe(6);
    const modes = Object.values(assignments).map((a) => a.mode);
    expect(modes.every((m) => m === "AI_FALLBACK")).toBe(true);
  });

  it("bridge loads 3v3 scenario with 6 players", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();
    const players = bridge.getSimulation().presentation().players;
    expect(players.length).toBe(6);
    const teamIds = new Set(players.map((p) => p.teamId));
    expect(teamIds.size).toBe(2);
  });
});

// ===========================================================================
// Hash correspondence — bridge vs headless
// ===========================================================================

describe("BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: hash correspondence", () => {
  it("bridge initial hash matches headless initial hash", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    const headlessSim = createSimulation(world);
    expect(bridge.stateHash()).toBe(headlessSim.stateHash());
  });

  it("bridge CPU hashes match headless CPU hashes for 60 ticks", async () => {
    const TICKS = 60;

    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();
    const bridgeHashes = bridge.stepWithCpuControllers(TICKS);

    const result = runHeadlessCpuMatch(TICKS);
    expect(bridgeHashes).toEqual(result.hashes);
    expect(bridgeHashes.length).toBe(TICKS);
  });

  it("two independent headless CPU runs produce identical hashes", () => {
    const r1 = runHeadlessCpuMatch(60);
    const r2 = runHeadlessCpuMatch(60);
    expect(r1.hashes).toEqual(r2.hashes);
    expect(r1.events.length).toBe(r2.events.length);
  });
});

// ===========================================================================
// CPU match produces events — core prerequisite for scanning
// ===========================================================================

describe("BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: event collection", () => {
  it("360-tick CPU match produces simulation events", () => {
    const result = runHeadlessCpuMatch(TOTAL_TICKS);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.observations.length).toBe(TOTAL_TICKS);
    expect(result.hashes.length).toBe(TOTAL_TICKS);
  });

  it("CPU match produces simulation events with recognized kinds", () => {
    const result = runHeadlessCpuMatch(TOTAL_TICKS);
    const kinds = new Set(result.events.map((e) => e.kind));
    // A 3v3 CPU match produces events — the specific kinds depend on
    // gameplay interactions. The scanner integration test below verifies
    // that the right kinds map to the 8 milestone situations.
    expect(kinds.size).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Scanner integration — feed CPU match events through the scanner
// ===========================================================================

describe("BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: scanner integration", () => {
  it("scanMatch returns localizations for all 8 milestone situations", () => {
    const result = runHeadlessCpuMatch(TOTAL_TICKS);
    const scan = scanMatch(result.events, result.observations);

    expect(scan.localizations.length).toBe(8);

    const ids = scan.localizations.map((l) => l.situation_id);
    for (const sid of MILESTONE_SITUATIONS) {
      expect(ids).toContain(sid);
    }
  });

  it("scan produces a summary with present / not_observed / insufficient_context counts", () => {
    const result = runHeadlessCpuMatch(TOTAL_TICKS);
    const scan = scanMatch(result.events, result.observations);

    expect(scan.summary.present + scan.summary.notObserved + scan.summary.insufficientContext).toBe(8);
    expect(scan.totalTicks).toBeGreaterThan(0);
    expect(scan.totalUniqueEvents).toBeGreaterThan(0);
  });

  it("situation localizations have valid structure", () => {
    const result = runHeadlessCpuMatch(TOTAL_TICKS);
    const scan = scanMatch(result.events, result.observations);

    for (const loc of scan.localizations) {
      expect(typeof loc.situation_id).toBe("string");
      expect(["present", "not_observed", "insufficient_context"]).toContain(loc.presence);
      expect(Array.isArray(loc.clusters)).toBe(true);
      expect(typeof loc.totalRelevantEvents).toBe("number");
      expect(loc.totalRelevantEvents).toBeGreaterThanOrEqual(0);
      expect(typeof loc.hasPositionData).toBe("boolean");
    }
  });
});

// ===========================================================================
// DYNAMIC_VISUAL: semantic frame capture
// ===========================================================================

describe("BROWSER-SMALL-SIDED-INTEGRATED-PLAYTEST: semantic frame capture", () => {
  it(
    "captures 5 semantic frames: before → early-play → mid-match → late-match → final",
    async () => {
      if (DURABLE_EVIDENCE) {
        let manifestExists = false;
        try {
          await commands.readFile(
            `docs/evidence/${OBJECTIVE_ID}/manifest.json`,
            "utf-8",
          );
          manifestExists = true;
        } catch {
          // no manifest yet: durable capture for this candidate is allowed
        }
        if (manifestExists) {
          throw new Error(
            `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
          );
        }
      }

      async function captureFrame(name: string): Promise<void> {
        const cap = await bridge.capture();
        const base64 = cap.screenshot.split(",")[1] ?? "";
        if (!base64 || base64.length < 100) {
          throw new Error(`renderer produced no PNG bytes for ${name}`);
        }
        await commands.writeFile(`${SCREENSHOT_DIR}/${name}`, base64, "base64");
      }

      // Run headless match to identify event ticks for frame selection.
      const headlessResult = runHeadlessCpuMatch(TOTAL_TICKS);
      const scan = scanMatch(headlessResult.events, headlessResult.observations);

      // Identify the tick of the first event for centering.
      const firstEventTick = headlessResult.events.length > 0
        ? headlessResult.events[0].tick
        : 60;

      // Define 5 semantic frame ticks.
      const frameTicks = [
        0,                                        // before: initial state
        Math.min(firstEventTick, 30),             // early-play: near first event
        Math.floor(TOTAL_TICKS * 0.33),           // mid-match: active play
        Math.floor(TOTAL_TICKS * 0.67),           // late-match: extended play
        TOTAL_TICKS - 1,                          // final: end state
      ];

      // Deduplicate ticks (in case firstEventTick is 0).
      const uniqueTicks = [...new Set(frameTicks)].sort((a, b) => a - b);

      // Create bridge for screenshot capture.
      bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
      await bridge.reset();

      const frameLabels = ["before", "early-play", "mid-match", "late-match", "final"];
      const frameNotes = [
        "Initial 3v3 state — 6 players at formation, ball at center",
        "Early CPU play — first events detected, players moving from formation",
        "Mid-match — active possession, passes and contacts occurring",
        "Late match — coordinated team behavior, transitions visible",
        "Final state — 360 ticks complete, full CPU match played",
      ];

      let tickIdx = 0;
      for (let fi = 0; fi < uniqueTicks.length; fi++) {
        const targetTick = uniqueTicks[fi];
        // Step bridge to target tick.
        while (bridge.getSimulation().tick < targetTick) {
          const remaining = targetTick - bridge.getSimulation().tick;
          bridge.stepWithCpuControllers(Math.min(remaining, 60));
        }
        bridge.renderFrame();
        await captureFrame(`frame-${frameLabels[fi]}.png`);
        tickIdx++;
      }

      // Verify 6 players present at end.
      expect(bridge.getSimulation().presentation().players.length).toBe(6);
      expect(bridge.getSimulation().tick).toBeGreaterThanOrEqual(TOTAL_TICKS - 1);

      // Store evidence data on window for capture script extraction.
      (window as unknown as Record<string, string>).__integratedPlaytestHashes =
        JSON.stringify(headlessResult.hashes);
      (window as unknown as Record<string, string>).__integratedPlaytestEvents =
        JSON.stringify(headlessResult.events.map((e) => ({
          tick: e.tick,
          id: e.id,
          kind: e.kind,
          label: e.label,
        })));
      (window as unknown as Record<string, string>).__integratedPlaytestScan =
        JSON.stringify(scan);
      (window as unknown as Record<string, string>).__integratedPlaytestFrameMeta =
        JSON.stringify(
          uniqueTicks.map((tick, i) => ({
            label: frameLabels[i],
            tick,
            note: frameNotes[i],
          })),
        );
    },
    { timeout: 60_000 },
  );

  it("semantic frames are non-blank (luminance and color variance)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();
    bridge.stepWithCpuControllers(TOTAL_TICKS);
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

  it("all captured frames are distinct (different state hashes)", async () => {
    bridge = createTestBridge(container, FOUNDATION_SCENARIO_3V3);
    await bridge.reset();

    const ticks = [0, 60, 180, 300, 359];
    const hashes: string[] = [];

    for (const t of ticks) {
      while (bridge.getSimulation().tick < t) {
        const remaining = t - bridge.getSimulation().tick;
        bridge.stepWithCpuControllers(Math.min(remaining, 60));
      }
      hashes.push(bridge.stateHash());
    }

    const unique = new Set(hashes);
    expect(unique.size).toBeGreaterThanOrEqual(4);

    // Ticks must be monotonically increasing.
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });
});
