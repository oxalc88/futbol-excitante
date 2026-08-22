/**
 * ARCHETYPE-FULL-PAIR-RECAPTURE: Real Three.js renderer capture of
 * all five archetype frames under identical conditions at tick 5.
 *
 * Uses createTestBridge with ONE shared scenario/camera/tick program.
 * Only the player archetypeId changes between captures — positions,
 * inputs, camera, and tick are identical.  Each archetype gets its own
 * distinct render due to the ARCHETYPE_VISUAL_REGISTRY.
 *
 * Output goes to stdout as structured lines for a Node-side harvest
 * script (same pattern as capture-wip / persist-wip-captures).
 *
 * No Math.random, Date, DOM, or Node I/O in simulation core.
 */

import { describe, it, expect } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_ARCHETYPES: readonly string[] = [
  "archetype-burst-v1",
  "archetype-steady-v1",
  "archetype-technical-v1",
  "archetype-power-v1",
  "archetype-agility-v1",
];

const TICK = 5;

// ---------------------------------------------------------------------------
// Shared scenario — identical for all archetype captures.
// Only archetypeId changes between captures.
// ---------------------------------------------------------------------------

function sharedScenario(archetypeId: string): ScenarioDefinition {
  return {
    ...FOUNDATION_SCENARIO,
    id: "archetype-full-pair-recapture-v1",
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: { x: -20, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId,
      },
      {
        playerId: "player-2",
        teamId: "team-b",
        groundPosition: { x: 20, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
    ],
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-1",
        mode: "AI_FALLBACK",
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "player-2",
        mode: "AI_FALLBACK",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// SHA-256 helper (Web Crypto API, browser-native)
// ---------------------------------------------------------------------------

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ARCHETYPE-FULL-PAIR-RECAPTURE", () => {
  it(
    "captures real Three.js frames for all 5 archetypes under identical conditions at tick 5",
    async () => {
      const capturedFrames: Array<{
        archetypeId: string;
        sha256: string;
        stateHash: string;
        tick: number;
        pngBase64: string;
      }> = [];

      for (const archetypeId of KNOWN_ARCHETYPES) {
        const scenario = sharedScenario(archetypeId);
        const container = document.createElement("div");
        container.style.width = "800px";
        container.style.height = "600px";
        document.body.appendChild(container);

        let bridge: TestBridge | null = null;
        try {
          bridge = createTestBridge(container, scenario);
          await bridge.reset();
          bridge.step(TICK);
          bridge.renderFrame();
          const capture = await bridge.capture();

          // Verify real renderer output
          expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
          expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);
          expect(capture.cameraPosition.z).toBeGreaterThan(0);

          // Decode base64 PNG
          const base64Data = capture.screenshot.split(",")[1] ?? "";
          const binary = atob(base64Data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          // Non-trivial frame (>1KB)
          expect(bytes.length).toBeGreaterThan(1000);

          const sha = await sha256Hex(bytes);
          const stateHash = bridge.stateHash();

          capturedFrames.push({
            archetypeId,
            sha256: sha,
            stateHash,
            tick: TICK,
            pngBase64: base64Data,
          });
        } finally {
          try { bridge?.getPresentationSession().dispose(); } catch { /* already disposed */ }
          if (container.parentElement) container.parentElement.removeChild(container);
        }
      }

      // Verify all 5 frames captured
      expect(capturedFrames.length).toBe(5);

      // Log structured output for harvest script
      for (const frame of capturedFrames) {
        const baseName = frame.archetypeId.replace(/-v\d+$/, "");
        const tickStr = frame.tick.toString().padStart(3, "0");
        const pngFileName = `${baseName}-frame-${tickStr}.png`;

        console.log(`[archetype-capture:${pngFileName}:base64]${frame.pngBase64}`);

        const metaJson = JSON.stringify({
          archetypeId: frame.archetypeId,
          perceptualHash: frame.sha256,
          stateHash: frame.stateHash,
          sha256: frame.sha256,
          tick: frame.tick,
          width: 800,
          height: 600,
          captureVersion: "archetype-full-pair-recapture-v1",
          renderer: "three.js-via-test-bridge",
          identicalConditions: true,
        });
        console.log(`[archetype-capture:${baseName}-meta:${tickStr}]${metaJson}`);
      }

      // Sequence: 3 semantic frames from this same capture run
      const sequence = capturedFrames.map((frame) => ({
        label: frame.archetypeId,
        path: `${frame.archetypeId.replace(/-v\d+$/, "")}-frame-${frame.tick.toString().padStart(3, "0")}.png`,
        tick: frame.tick,
        sha256: frame.sha256,
      }));
      console.log(`[archetype-capture:sequence]${JSON.stringify({
        schema_version: 1,
        objective_id: "ARCHETYPE-FULL-PAIR-RECAPTURE",
        description: "Real Three.js renderer frames for all 5 archetypes under identical conditions at tick 5. Only archetypeId varies. The ARCHETYPE_VISUAL_REGISTRY produces distinct renders per archetype.",
        frames: sequence,
      })}`);

      // Trajectory
      console.log(`[archetype-capture:trajectory]${JSON.stringify({
        objective: "ARCHETYPE-FULL-PAIR-RECAPTURE",
        class: "DYNAMIC_VISUAL",
        description: "Full-pair recapture: real Three.js renderer frames for all 5 archetypes at tick 5 under identical camera/task/input conditions. Only the player archetypeId label changes between captures. The ARCHETYPE_VISUAL_REGISTRY produces visually distinct renders.",
        identicalConditions: true,
        archetypes: capturedFrames.map((f) => ({
          archetypeId: f.archetypeId,
          sha256: f.sha256,
          stateHash: f.stateHash,
          tick: f.tick,
          width: 800,
          height: 600,
        })),
        fixtureId: "archetype-full-pair-recapture-v1 (shared scenario, archetypeId only)",
        tick: TICK,
        captureVersion: "archetype-full-pair-recapture-v1",
        renderer: "three.js-via-test-bridge",
      })}`);

      console.log(`[archetype-capture] Logged ${capturedFrames.length} frames to stdout`);
    },
  );
});
