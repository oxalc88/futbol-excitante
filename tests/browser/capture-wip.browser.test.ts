/**
 * Browser-mode evidence capture.
 *
 * Static objectives normally use one frame. Dynamic visual objectives use
 * WIP_FRAMES=3..5 and receive an ordered sequence.json with semantic labels.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import type { TestBridge } from "../../src/apps/browser/test-bridge.js";

const SECTION = process.env.WIP_SECTION || "capture";
const FRAME_COUNT = Math.max(1, Math.min(5, parseInt(process.env.WIP_FRAMES || "1", 10) || 1));
const FRAME_STRIDE = Math.max(1, parseInt(process.env.WIP_FRAME_STRIDE || "30", 10) || 30);

function defaultLabels(count: number): string[] {
  if (count === 1) return ["state"];
  if (count === 2) return ["before", "result"];
  if (count === 3) return ["before", "event", "result"];
  if (count === 4) return ["before", "event", "transition", "result"];
  return ["before", "event", "transition", "result", "after"];
}

const configuredLabels = (process.env.WIP_FRAME_LABELS || "").split(",").map((s) => s.trim()).filter(Boolean);
const FRAME_LABELS = configuredLabels.length === FRAME_COUNT ? configuredLabels : defaultLabels(FRAME_COUNT);

let container: HTMLDivElement;
let bridge: TestBridge;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
  bridge = createTestBridge(container);
});

afterEach(() => {
  try { bridge.getPresentationSession().dispose(); } catch { /* already disposed */ }
  if (container.parentElement) container.parentElement.removeChild(container);
});

describe(`WIP capture: ${SECTION}`, () => {
  it("captures static or semantic frame evidence", async () => {
    if (typeof document === "undefined") throw new Error("capture-wip.browser.test.ts requires browser mode");
    await bridge.reset();

    const sequence: Array<{ label: string; path: string; tick: number }> = [];
    let cumulativeTick = 0;

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      bridge.step(FRAME_STRIDE);
      cumulativeTick += FRAME_STRIDE;
      bridge.renderFrame();
      const capture = await bridge.capture();
      expect(capture.screenshot).toMatch(/^data:image\/png;base64,/);
      const base64Data = capture.screenshot.split(",")[1] ?? "";
      expect(base64Data.length).toBeGreaterThan(100);
      expect(capture.sceneObjectCount).toBeGreaterThanOrEqual(5);
      expect(capture.cameraPosition.z).toBeGreaterThan(0);

      const fileName = `frame-${String(index).padStart(3, "0")}.png`;
      try {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(`docs/screenshots/${SECTION}`, { recursive: true });
        try {
          // @ts-expect-error Buffer may not exist in browser mode.
          writeFileSync(`docs/screenshots/${SECTION}/${fileName}`, Buffer.from(base64Data, "base64"));
        } catch {
          const binary = atob(base64Data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          writeFileSync(`docs/screenshots/${SECTION}/${fileName}`, bytes);
        }
      } catch {
        console.log(`[capture-wip:${fileName}:base64]${base64Data}`);
      }
      sequence.push({ label: FRAME_LABELS[index] ?? `frame-${index}`, path: fileName, tick: cumulativeTick });
    }

    if (FRAME_COUNT > 1) {
      try {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(`docs/screenshots/${SECTION}`, { recursive: true });
        writeFileSync(
          `docs/screenshots/${SECTION}/sequence.json`,
          `${JSON.stringify({ schema_version: 1, objective_id: SECTION, frames: sequence }, null, 2)}\n`,
          "utf8",
        );
      } catch {
        console.log(`[capture-wip:sequence]${JSON.stringify(sequence)}`);
      }
    }
  });
});
