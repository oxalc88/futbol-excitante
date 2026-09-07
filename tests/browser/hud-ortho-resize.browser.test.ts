/**
 * @module tests/browser/hud-ortho-resize.browser.test
 *
 * EVAL-HYGIENE-CONSOLIDATION (HUD ortho camera resize re-anchoring) guard.
 *
 * The opt-in match-phase HUD orthographic camera anchors to
 * `container.clientWidth/Height` at session creation. This guard verifies the
 * presentation layer re-anchors the HUD camera + top-left sprite (and the
 * renderer canvas + main camera aspect) when the container resizes.
 *
 * The change is presentation-only and draw-only — it never reads or writes a
 * football outcome. When the HUD is not enabled (`showMatchPhaseHud: false`)
 * the accessor returns null and no resize re-anchoring is observed.
 *
 * No durable capture is written here; an ordinary browser run writes nothing
 * under `docs/`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import fullMatchTimingJson from "../../eval/scenarios/5v5-full-match-timing.v1.json";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

const SCENARIO = fullMatchTimingJson as unknown as ScenarioDefinition;

let container: HTMLDivElement;
let bridge: TestBridge | null = null;

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
  if (container.parentElement) {
    container.parentElement.removeChild(container);
  }
});

function makeBridge(): TestBridge {
  bridge = createTestBridge(container, SCENARIO, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    showMatchPhaseHud: true,
  });
  return bridge;
}

describe("HUD ortho camera resize re-anchoring (EVAL-HYGIENE-CONSOLIDATION)", () => {
  it("re-anchors the HUD ortho camera frustum when the container resizes", async () => {
    const b = makeBridge();
    await b.reset();

    const hud = b.getPresentationSession().getHudCamera();
    expect(hud).not.toBeNull();
    // Anchored to the initial 800x600 container.
    expect(hud!.left).toBe(-400);
    expect(hud!.right).toBe(400);
    expect(hud!.top).toBe(300);
    expect(hud!.bottom).toBe(-300);

    // Resize the container — the ResizeObserver fires and re-anchors.
    container.style.width = "1200px";
    container.style.height = "800px";
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hud!.left).toBe(-600);
    expect(hud!.right).toBe(600);
    expect(hud!.top).toBe(400);
    expect(hud!.bottom).toBe(-400);
  });

  it("follows the container with the renderer canvas and renders the HUD", async () => {
    const b = makeBridge();
    await b.reset();
    b.stepWithCpuControllers(1);
    b.renderFrame();

    const renderer = b.getPresentationSession().getRenderer();
    expect(renderer.domElement.clientWidth).toBe(800);
    expect(renderer.domElement.clientHeight).toBe(600);

    container.style.width = "1200px";
    container.style.height = "800px";
    await new Promise((resolve) => setTimeout(resolve, 100));
    b.renderFrame();

    // The renderer canvas followed the container (logical CSS size).
    expect(renderer.domElement.clientWidth).toBe(1200);
    expect(renderer.domElement.clientHeight).toBe(800);

    // A render still produces a valid, non-blank frame (the HUD box + label
    // are present in the top-left region).
    const cap = await b.capture();
    const base64 = cap.screenshot.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode screenshot image"));
      img.src = `data:image/png;base64,${base64}`;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    // Top-left region (proportional, so it holds at any device pixel ratio).
    const regionW = Math.floor(img.width * 0.5);
    const regionH = Math.floor(img.height * 0.25);
    let dark = 0;
    let light = 0;
    for (let y = 0; y < regionH; y++) {
      for (let x = 0; x < regionW; x++) {
        const idx = (y * img.width + x) * 4;
        const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (lum < 40) dark++;
        else if (lum > 200) light++;
      }
    }
    expect(dark, "HUD box should render dark pixels at the top-left").toBeGreaterThan(0);
    expect(light, "HUD label should render light pixels at the top-left").toBeGreaterThan(0);
  });

  it("returns a null HUD camera when the HUD is not enabled", async () => {
    const noHud = createTestBridge(container, SCENARIO, undefined, {
      ...DEFAULT_RENDERER_CONFIG,
      showMatchPhaseHud: false,
    });
    await noHud.reset();
    expect(noHud.getPresentationSession().getHudCamera()).toBeNull();
    noHud.getPresentationSession().dispose();
  });
});
