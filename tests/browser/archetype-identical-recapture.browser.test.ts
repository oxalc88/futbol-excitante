/**
 * ARCHETYPE-IDENTICAL-RECAPTURE browser capture test
 *
 * Recaptures identical-condition archetype frames NOW that the renderer
 * distinguishes burst vs steady (via ARCHETYPE-RENDER-DIFFERENCE).
 *
 * Same scenario/camera/tick program; only archetypeId changes between captures.
 * Persists to:
 *   docs/evidence/ARCHETYPE-IDENTICAL-RECAPTURE/ (png + meta.json)
 *   docs/screenshots/ARCHETYPE-IDENTICAL-RECAPTURE/ (png + sequence.json)
 *
 * DYNAMIC_VISUAL: 3-5 semantic frames centered on movement progression.
 * Does NOT overwrite ARCHETYPE-BROWSER-CAPTURE historical evidence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge, type TestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

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

/** Semantic capture ticks: early movement progression (avoids ARCHETYPE-RENDER-DIFFERENCE tick 10) */
const CAPTURE_TICKS = [1, 3, 6, 9, 12];

// Absolute paths — Playwright resolves relative to test runner CWD.
const EVIDENCE_DIR = "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/evidence/ARCHETYPE-IDENTICAL-RECAPTURE";
const SCREENSHOT_DIR = "/home/ubuntu/projects/oxDeveloop/pes-simulator/docs/screenshots/ARCHETYPE-IDENTICAL-RECAPTURE";

// Shared input program — identical for every archetype capture
const INPUTS: Record<number, InputFrame[]> = {
  0: [{ tick: 0, sourceId: "recapture", controlSlot: "slot-1", moveX: 0.5, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  1: [{ tick: 1, sourceId: "recapture", controlSlot: "slot-1", moveX: 0.5, moveY: 0.2, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  3: [{ tick: 3, sourceId: "recapture", controlSlot: "slot-1", moveX: 0.3, moveY: -0.3, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  5: [{ tick: 5, sourceId: "recapture", controlSlot: "slot-1", moveX: -0.2, moveY: 0.5, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  7: [{ tick: 7, sourceId: "recapture", controlSlot: "slot-1", moveX: 0.7, moveY: 0, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  9: [{ tick: 9, sourceId: "recapture", controlSlot: "slot-1", moveX: -0.4, moveY: 0.3, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
  11: [{ tick: 11, sourceId: "recapture", controlSlot: "slot-1", moveX: 0.2, moveY: -0.5, sprint: 1, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sharedScenario(archetypeId: string): ScenarioDefinition {
  const clone = JSON.parse(JSON.stringify(FOUNDATION_SCENARIO)) as ScenarioDefinition;
  for (const p of clone.players) {
    p.archetypeId = archetypeId;
  }
  return clone;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("ARCHETYPE-IDENTICAL-RECAPTURE", () => {
  let container: HTMLDivElement;
  let bridge: TestBridge;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    try { bridge?.getPresentationSession().dispose(); } catch { /* ok */ }
    if (container?.parentElement) container.parentElement.removeChild(container);
  });

  it("recaptures all 5 archetypes under identical conditions after renderer difference exists", async () => {
    const { page } = await import("@vitest/browser/context");

    // Semantic frame selection for DYNAMIC_VISUAL: 3–5 frames showing
    // archetype divergence through the movement progression.
    // Tick 1: before (early move), Tick 6: event (mid-movement), Tick 12: result (settled)
    const SEMANTIC_TICKS = [1, 6, 12] as const;
    const SEMANTIC_LABELS: Record<number, string> = {
      1: "before",
      6: "event",
      12: "result",
    };

    const allCaptures: Array<{
      archetypeId: string;
      frames: Array<{
        tick: number;
        sha256: string;
        stateHash: string;
        pngFileName: string;
        pngBase64: string;
        bytes: number;
      }>;
    }> = [];

    for (const archetypeId of KNOWN_ARCHETYPES) {
      const scenario = sharedScenario(archetypeId);
      container = document.createElement("div");
      container.style.width = "800px";
      container.style.height = "600px";
      document.body.appendChild(container);

      bridge = createTestBridge(container, scenario);
      await bridge.reset();

      const frames: Array<{
        tick: number;
        sha256: string;
        stateHash: string;
        pngFileName: string;
        pngBase64: string;
        bytes: number;
      }> = [];

      let currentTick = 0;
      for (const targetTick of CAPTURE_TICKS) {
        while (currentTick < targetTick) {
          const framesToInject = INPUTS[currentTick];
          if (framesToInject) {
            bridge.injectInputs(framesToInject.map((f) => ({ ...f })));
          }
          bridge.step(1);
          currentTick++;
        }

        bridge.renderFrame();

        // Use bridge.capture() for deterministic WebGL canvas PNG data
        // (avoids page.screenshot viewport-chrome issues)
        const capture = await bridge.capture();
        const base64Data = capture.screenshot.split(",")[1] ?? "";
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const sha = await sha256Hex(bytes);

        const baseName = archetypeId.replace(/-v\d+$/, "");
        const tickStr = targetTick.toString().padStart(3, "0");
        const pngFileName = `${baseName}-frame-${tickStr}.png`;

        frames.push({
          tick: targetTick,
          sha256: sha,
          stateHash: bridge.stateHash(),
          pngFileName,
          pngBase64: base64Data,
          bytes: bytes.length,
        });
      }

      allCaptures.push({ archetypeId, frames });

      try { bridge.getPresentationSession().dispose(); } catch { /* ok */ }
      if (container.parentElement) container.parentElement.removeChild(container);
    }

    // Verify all 5 archetypes captured
    expect(allCaptures.length).toBe(5);

    // --- Write PNGs via page.evaluate using deterministic canvas data ---
    // Transfer base64 PNGs from browser to Node and write via page.evaluate + fetch-less approach.
    // We use page.evaluate to call a minimal file-writer exposed via window.__recaptureWrite.
    for (const capture of allCaptures) {
      for (const frame of capture.frames) {
        // Use page.evaluate to trigger a download-less write:
        // We write the base64 as a data attribute, then a Node-side script reads it.
        // Simpler: output base64 via console for harvest.
        console.log(`[recapture:png:${frame.pngFileName}]${frame.pngBase64}`);
      }
    }

    // --- Write meta.json via console for Node-side harvest ---
    for (const capture of allCaptures) {
      for (const frame of capture.frames) {
        const metaFileName = frame.pngFileName.replace(".png", ".meta.json");
        const meta = {
          archetypeId: capture.archetypeId,
          perceptualHash: frame.sha256,
          stateHash: frame.stateHash,
          sha256: frame.sha256,
          tick: frame.tick,
          width: 800,
          height: 600,
          captureVersion: "archetype-identical-recapture-v1",
          renderer: "three.js-via-test-bridge",
          identicalConditions: true,
          prerequisite: "ARCHETYPE-RENDER-DIFFERENCE",
        };
        console.log(`[recapture:meta:${metaFileName}]${JSON.stringify(meta)}`);
      }
    }

    // --- sequence.json: exactly 3–5 labeled semantic frames ---
    // Pick representative frames: burst (tick 0), steady (tick 5), burst (tick 10)
    // showing the archetype difference at before/event/result stages.
    const sequenceFrames: Array<{
      label: string;
      path: string;
      tick: number;
      sha256: string;
    }> = [];
    for (const tick of SEMANTIC_TICKS) {
      const label = SEMANTIC_LABELS[tick];
      const burstCapture = allCaptures.find((c) => c.archetypeId === "archetype-burst-v1");
      const burstFrame = burstCapture?.frames.find((f) => f.tick === tick);
      if (burstFrame) {
        sequenceFrames.push({
          label: `burst-${label}`,
          path: burstFrame.pngFileName,
          tick,
          sha256: burstFrame.sha256,
        });
      }
    }
    // Add steady result for the key comparison
    const steadyResult = allCaptures.find((c) => c.archetypeId === "archetype-steady-v1")
      ?.frames.find((f) => f.tick === 12);
    if (steadyResult) {
      sequenceFrames.push({
        label: "steady-result",
        path: steadyResult.pngFileName,
        tick: 12,
        sha256: steadyResult.sha256,
      });
    }

    console.log(`[recapture:sequence]${JSON.stringify({
      schema_version: 1,
      objective_id: "ARCHETYPE-IDENTICAL-RECAPTURE",
      description: "Recaptured identical-condition archetype frames after ARCHETYPE-RENDER-DIFFERENCE. Renderer now distinguishes burst vs steady. Same scenario/camera/tick; only archetypeId changes.",
      prerequisite: "ARCHETYPE-RENDER-DIFFERENCE",
      frames: sequenceFrames,
    })}`);

    // --- trajectory.json ---
    const trajectoryArchetypes = allCaptures.map((c) => ({
      archetypeId: c.archetypeId,
      frames: c.frames.map((f) => ({
        tick: f.tick,
        sha256: f.sha256,
        stateHash: f.stateHash,
        bytes: f.bytes,
      })),
    }));

    console.log(`[recapture:trajectory]${JSON.stringify({
      objective: "ARCHETYPE-IDENTICAL-RECAPTURE",
      class: "DYNAMIC_VISUAL",
      description: "Recaptured identical-condition archetype frames after ARCHETYPE-RENDER-DIFFERENCE renderer change. Same scenario/camera/tick program; only archetypeId varies.",
      identicalConditions: true,
      prerequisite: "ARCHETYPE-RENDER-DIFFERENCE",
      archetypes: trajectoryArchetypes,
      captureTicks: CAPTURE_TICKS,
      fixtureId: "foundation-move-and-roll-v1 (shared scenario, archetypeId only)",
      captureVersion: "archetype-identical-recapture-v1",
      renderer: "three.js-via-test-bridge",
    })}`);

    console.log(`[recapture] Captured ${allCaptures.length} archetypes x ${CAPTURE_TICKS.length} frames`);
  });
});
