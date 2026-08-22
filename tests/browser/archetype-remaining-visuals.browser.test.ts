/**
 * ARCHETYPE-REMAINING-VISUALS: Real Three.js renderer capture of
 * the three remaining archetype visual mappings (technical, power,
 * agility) under identical conditions. Burst and steady already have
 * distinct mappings; this test captures the newly added ones.
 *
 * Uses createTestBridge with ONE shared scenario/camera/tick program.
 * Only the player archetypeId changes between captures — positions,
 * inputs, camera, and tick are identical.
 *
 * After the renderer visual registry update, each archetype should
 * produce a unique SHA-256 from the real WebGL frame.
 *
 * Output goes to docs/screenshots/ARCHETYPE-REMAINING-VISUALS/ via
 * node:fs (browser mode with Node integration).
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

/** The three remaining archetypes that need distinct visual mappings. */
const REMAINING_ARCHETYPES: readonly string[] = [
  "archetype-technical-v1",
  "archetype-power-v1",
  "archetype-agility-v1",
];

const TICK = 5;
const SECTION = "ARCHETYPE-REMAINING-VISUALS";

// ---------------------------------------------------------------------------
// Shared scenario — identical for all archetype captures.
// ---------------------------------------------------------------------------

/**
 * Build a scenario that is identical across all archetype captures.
 * The ONLY difference between captures is the archetypeId on the
 * team-a player. Positions, inputs, camera, tick are all shared.
 */
function sharedScenario(archetypeId: string): ScenarioDefinition {
  return {
    ...FOUNDATION_SCENARIO,
    id: "archetype-remaining-visuals-v1",
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

describe("ARCHETYPE-REMAINING-VISUALS", () => {
  it(
    "captures real Three.js frames for technical, power, agility under identical conditions",
    async () => {
      const capturedFrames: Array<{
        archetypeId: string;
        sha256: string;
        stateHash: string;
        tick: number;
        pngBase64: string;
      }> = [];

      for (const archetypeId of REMAINING_ARCHETYPES) {
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

      // Verify all3 frames captured
      expect(capturedFrames.length).toBe(3);

      // Verify all SHA-256 hashes are unique — each archetype should produce
      // distinct renderer output now that the visual registry has unique mappings.
      const shaSet = new Set(capturedFrames.map((f) => f.sha256));
      // Log the hashes for evidence collection
      const hashes = capturedFrames.map((f) => `${f.archetypeId}: ${f.sha256.slice(0, 16)}...`);
      console.log(`[remaining-visuals] SHA-256 hashes: ${hashes.join(", ")}`);

      // All3 should be unique (distinct visual mappings → distinct pixels → distinct SHA)
      expect(shaSet.size).toBe(3);

      // --- Persist evidence: try node:fs, fall back to stdout ---
      const SCREENSHOT_DIR = `docs/screenshots/${SECTION}`;

      try {
        const fs = await import("node:fs");
        if (typeof fs.mkdirSync === "function") {
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

          for (const frame of capturedFrames) {
            const baseName = frame.archetypeId.replace(/-v\d+$/, "");
            const tickStr = frame.tick.toString().padStart(3, "0");
            const pngFileName = `${baseName}-frame-${tickStr}.png`;
            const metaFileName = `${baseName}-frame-${tickStr}.meta.json`;

            const pngBuf = Buffer.from(frame.pngBase64, "base64");
            fs.writeFileSync(`${SCREENSHOT_DIR}/${pngFileName}`, pngBuf);

            fs.writeFileSync(`${SCREENSHOT_DIR}/${metaFileName}`, JSON.stringify({
              archetypeId: frame.archetypeId,
              perceptualHash: frame.sha256,
              stateHash: frame.stateHash,
              sha256: frame.sha256,
              tick: frame.tick,
              width: 800,
              height: 600,
              captureVersion: "archetype-remaining-visuals-v1",
              renderer: "three.js-via-test-bridge",
              identicalConditions: true,
            }, null, 2) + "\n");
          }

          // sequence.json
          const sequence = capturedFrames.map((frame) => ({
            label: `${frame.archetypeId}`,
            path: `${frame.archetypeId.replace(/-v\d+$/, "")}-frame-${frame.tick.toString().padStart(3, "0")}.png`,
            tick: frame.tick,
            sha256: frame.sha256,
          }));
          fs.writeFileSync(`${SCREENSHOT_DIR}/sequence.json`, JSON.stringify({
            schema_version: 1,
            objective_id: SECTION,
            description: "Real Three.js renderer frames for remaining archetypes (technical, power, agility) captured under identical conditions. Only archetypeId varies. Each frame has a unique SHA-256.",
            frames: sequence,
          }, null, 2) + "\n");

          console.log(`[${SECTION}] Wrote ${capturedFrames.length} frames to ${SCREENSHOT_DIR}/`);
          return;
        }
      } catch {
        // node:fs not available — fall through to stdout
      }

      // Fallback: log base64 to stdout for harvest script
      for (const frame of capturedFrames) {
        const baseName = frame.archetypeId.replace(/-v\d+$/, "");
        const tickStr = frame.tick.toString().padStart(3, "0");
        const pngFileName = `${baseName}-frame-${tickStr}.png`;

        console.log(`[capture-wip:${pngFileName}:base64]${frame.pngBase64}`);

        const metaJson = JSON.stringify({
          archetypeId: frame.archetypeId,
          perceptualHash: frame.sha256,
          stateHash: frame.stateHash,
          sha256: frame.sha256,
          tick: frame.tick,
          width: 800,
          height: 600,
          captureVersion: "archetype-remaining-visuals-v1",
          renderer: "three.js-via-test-bridge",
          identicalConditions: true,
        });
        console.log(`[capture-wip:${baseName}-meta:${tickStr}]${metaJson}`);
      }

      const sequence = capturedFrames.map((frame) => ({
        label: frame.archetypeId,
        path: `${frame.archetypeId.replace(/-v\d+$/, "")}-frame-${frame.tick.toString().padStart(3, "0")}.png`,
        tick: frame.tick,
        sha256: frame.sha256,
      }));
      console.log(`[capture-wip:sequence]${JSON.stringify({
        schema_version: 1,
        objective_id: SECTION,
        description: "Remaining archetype frames captured under identical conditions. Each has unique SHA-256.",
        frames: sequence,
      })}`);
    },
  );
});
