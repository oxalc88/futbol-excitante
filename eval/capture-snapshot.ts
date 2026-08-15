/**
 * @module eval/capture-snapshot
 *
 * Test helper for saving browser-captured screenshots to disk.
 *
 * Integrates with the existing test-bridge.capture() pipeline (WebGL
 * readPixels → base64 PNG).  Provides a single function that builders
 * can call from browser tests to persist screenshots for evidence.
 *
 * Usage in a browser test:
 *   ```ts
 *   import { saveCapture } from "../../eval/capture-snapshot.js";
 *   import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
 *
 *   const bridge = createTestBridge(container);
 *   await bridge.reset();
 *   bridge.renderFrame();
 *   const capture = await bridge.capture();
 *   await saveCapture(capture, "docs/screenshots/my-section/ball-swipe.png");
 *   ```
 *
 * This writes the base64 PNG data from the capture to disk.
 * Also writes a JSON metadata file alongside:
 *   <path>.meta.json  — tick, stateHash, player/ball positions, camera
 *
 * No Math.random, Date, DOM, or Node I/O outside the helper.
 * Node I/O (writeFileSync) is allowed in the eval layer for artifact writing.
 * In browser tests the helper serializes metadata to a plain object
 * that the builder script can pick up via window.__captureMeta.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Metadata captured alongside a screenshot.
 */
export interface CaptureMeta {
  tick: number;
  stateHash: string;
  playerCount: number;
  ballPosition: { x: number; y: number; z: number };
  cameraPosition: { x: number; y: number; z: number };
  sceneObjectCount: number;
  timestamp: string; // ISO string, set by builder script (not by simulation)
}

/**
 * Browser-side metadata (no Node I/O).  Serializes to CaptureMeta
 * when saved by the builder script.
 */
export interface BrowserCaptureMeta {
  tick: number;
  stateHash: string;
  playerCount: number;
  ballPosition: { x: number; y: number; z: number };
  cameraPosition: { x: number; y: number; z: number };
  sceneObjectCount: number;
}

// ---------------------------------------------------------------------------
// Browser helper
// ---------------------------------------------------------------------------

/**
 * Build metadata from a CaptureResult.
 * Call this before saving to disk.
 */
export function buildCaptureMeta(
  capture: {
    presentationSnapshot: {
      tick: number;
      players: Array<{ groundPosition: { x: number; y: number } }>;
      ball: { position: { x: number; y: number; z: number } };
    };
    cameraPosition: { x: number; y: number; z: number };
    sceneObjectCount: number;
  },
  stateHash: string,
): BrowserCaptureMeta {
  const ball = capture.presentationSnapshot.ball;
  return {
    tick: capture.presentationSnapshot.tick,
    stateHash,
    playerCount: capture.presentationSnapshot.players.length,
    ballPosition: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
    cameraPosition: capture.cameraPosition,
    sceneObjectCount: capture.sceneObjectCount,
  };
}

// ---------------------------------------------------------------------------
// Convenience: one-call save
// ---------------------------------------------------------------------------

/**
 * Save a capture result to disk in one call.
 * Writes the screenshot PNG and metadata JSON.
 *
 * @param capture — CaptureResult from test-bridge.capture()
 * @param stateHash — current simulation state hash
 * @param outputPath — file path for the PNG (e.g. "docs/screenshots/section/frame-000.png")
 */
export async function saveCapture(
  capture: {
    presentationSnapshot: {
      tick: number;
      players: Array<{ groundPosition: { x: number; y: number } }>;
      ball: { position: { x: number; y: number; z: number } };
    };
    cameraPosition: { x: number; y: number; z: number };
    sceneObjectCount: number;
    screenshot: string;
  },
  stateHash: string,
  outputPath: string,
): Promise<void> {
  await decodeAndWriteBase64(capture.screenshot, outputPath);
  const meta = buildCaptureMeta(capture, stateHash);
  await writeMetaJson({ ...meta, timestamp: new Date().toISOString() }, outputPath);
}

// ---------------------------------------------------------------------------
// Node helper (builder script)
// ---------------------------------------------------------------------------

/**
 * Decode a base64 data URL and write to disk.
 *
 * @param dataUrl — base64 PNG data URL from capture.screenshot
 * @param outputPath — file path to write to
 *
 * This function runs in Node (builder scripts). In browser tests,
 * the helper is called from a node-side script via vitest browser mode.
 */
export async function decodeAndWriteBase64(
  dataUrl: string,
  outputPath: string,
): Promise<void> {
  // Strip the data:image/png;base64, prefix.
  const base64Data = dataUrl.split(",")[1] ?? "";
  const { writeFileSync } = await import("node:fs");

  const buffer = Buffer.from(base64Data, "base64");
  writeFileSync(outputPath, buffer);
}

/**
 * Write metadata JSON alongside a screenshot.
 *
 * @param meta — metadata object (BrowserCaptureMeta or CaptureMeta)
 * @param outputPath — base path without extension (the .png path)
 */
export async function writeMetaJson(
  meta: BrowserCaptureMeta | CaptureMeta,
  outputPath: string,
): Promise<void> {
  const { writeFileSync } = await import("node:fs");

  const metaFile = outputPath.replace(/\.\w+$/, ".meta.json");
  const jsonMeta = {
    ...meta,
    timestamp: "timestamp" in meta
      ? meta.timestamp
      : new Date().toISOString(),
  };
  writeFileSync(metaFile, JSON.stringify(jsonMeta, null, 2));
}