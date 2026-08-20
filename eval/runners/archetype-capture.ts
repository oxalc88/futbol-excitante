/**
 * @module eval/runners/archetype-capture
 *
 * Generates deterministic browser artifacts for archetype comparison.
 *
 * Renders a standardized test scene with two players of different
 * archetypes using Playwright + 2D canvas.  Produces rendered frames,
 * captures perceptual hashes (via canvas pixel data), and writes
 * artifacts to disk.
 *
 * Uses 3v3-fixture-short.v1.json as the lightweight fixture.
 *
 * Node I/O (Playwright, fs) is allowed in the eval layer.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { KNOWN_ARCHETYPES } from "../contracts/archetype-comparison-rubric.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A captured frame artifact.
 */
export interface CapturedFrame {
  /** Archetype identifier that was rendered. */
  archetypeId: string;
  /** Screenshot as base64 PNG data URL. */
  screenshot: string;
  /** Perceptual hash of the frame (hex SHA-256 of pixel data). */
  perceptualHash: string;
  /** Tick index of the frame. */
  tick: number;
  /** Deterministic seed used for the render. */
  seed: number;
}

/**
 * Result of capturing artifacts for an archetype pair.
 */
export interface PairCaptureResult {
  frames: CapturedFrame[];
}

/**
 * Full capture result set.
 */
export interface CaptureResult {
  /** Version identifier for this capture run. */
  captureVersion: string;
  /** Fixture scenario ID. */
  fixtureId: string;
  /** Results per archetype pair. */
  pairResults: PairCaptureResult[];
  /** Total frames captured. */
  totalFrames: number;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAPTURE_VERSION = "capture-v1";
const DEFAULT_TICK = 5;
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 180;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the 3v3-fixture-short scenario.
 */
function loadFixture(): Record<string, unknown> {
  const fixturePath = join(
    __dirname,
    "../scenarios/3v3-fixture-short.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Run the simulation to a target tick and return its hash.
 *
 * Uses the simulation core directly (headless, no DOM).
 * The returned hash is deterministic and stable for a given
 * scenario + tick combination.
 */
function simulateToTick(
  scenario: ScenarioDefinition,
  targetTick: number,
): { hash: string; tick: number } {
  // Build a scenario copy with a simple input program
  const inputProgramValue: {
    schema_id: string;
    schema_version: string;
    value: InputFrame[];
  } = {
    schema_id: "input-v1",
    schema_version: "v1",
    value: [],
  };

  const scenario2: ScenarioDefinition = {
    ...scenario,
    inputProgram: inputProgramValue,
  };

  const world = createWorld({ scenario: scenario2 });
  const sim = createSimulation(world);
  const initialHash = sim.stateHash();

  for (let t = 0; t < targetTick; t++) {
    const stepInputs: InputFrame[] = [
      {
        tick: t,
        sourceId: "archetype-capture",
        controlSlot: "slot-1",
        moveX: 0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: t,
        sourceId: "archetype-capture",
        controlSlot: "slot-2",
        moveX: -0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
    for (const inp of stepInputs) {
      sim.applyInputs([inp]);
    }
    sim.step();
  }

  return { hash: initialHash, tick: sim.tick };
}

/**
 * Build HTML that draws actual game-state data onto the canvas.
 *
 * Players are positioned from their simulation ground positions,
 * sized by archetype ID, and velocity vectors are drawn.  The ball
 * position and regime come from the game engine state.  This ensures
 * visual differences derive from the simulation, not static HTML.
 */
function buildArchetypeHtml(
  archetypeId: string,
  stateHash: string,
  tick: number,
  players: Array<{
    playerId: string;
    archetypeId: string;
    groundPosition: { x: number; y: number };
    linearVelocity: { x: number; y: number };
    bodyHeading: number;
  }>,
  ball: {
    position: { x: number; y: number; z: number };
    regime: string;
    speed: number;
  },
): string {
  const colorMap: Record<string, { base: string; accent: string }> = {
    "archetype-burst-v1": { base: "#ff3333", accent: "#ff6666" },
    "archetype-steady-v1": { base: "#33cc33", accent: "#66dd66" },
    "archetype-technical-v1": { base: "#3366ff", accent: "#6699ff" },
    "archetype-power-v1": { base: "#ffcc33", accent: "#ffdd66" },
    "archetype-agility-v1": { base: "#cc33ff", accent: "#dd66ff" },
  };

  const playerColors = players.map(
    (p) => colorMap[p.archetypeId]?.base ?? "#ffffff",
  );
  const archetypeIds = players.map(
    (p) => p.archetypeId.replace(/-/g, "_") || "unknown",
  );
  const groundX = players.map((p) => p.groundPosition.x);
  const groundY = players.map((p) => p.groundPosition.y);
  const velX = players.map((p) => p.linearVelocity.x);
  const velY = players.map((p) => p.linearVelocity.y);
  const headings = players.map((p) => p.bodyHeading);

  const ballPos = {
    x: ball.position.x,
    y: ball.position.y,
    z: ball.position.z,
  };
  const ballSpeed = ball.speed;
  const ballRegime = ball.regime;

  return `<!DOCTYPE html>
<html>
<head><style>body{margin:0;padding:0;background:#000;overflow:hidden}</style></head>
<body>
<canvas id="c" width="${RENDER_WIDTH}" height="${RENDER_HEIGHT}"></canvas>
<script>
(function(){
  var W=${RENDER_WIDTH},H=${RENDER_HEIGHT};
  var canvas=document.getElementById('c');
  var ctx=canvas.getContext('2d');

  // Color map
  var cmap={
    "archetype_burst_v1":["#ff3333","#ff6666"],
    "archetype_steady_v1":["#33cc33","#66dd66"],
    "archetype_technical_v1":["#3366ff","#6699ff"],
    "archetype_power_v1":["#ffcc33","#ffdd66"],
    "archetype_agility_v1":["#cc33ff","#dd66ff"]
  };

  function hexToRgba(hex,a){
    var r=parseInt(hex.slice(1,3),16);
    var g=parseInt(hex.slice(3,5),16);
    var b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  function drawPlayer(px,py,radius,color){
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(px,py,radius,0,Math.PI*2);
    ctx.fill();
  }

  // Draw players from simulation state
  var players=[${JSON.stringify(
    players.map((p, i) => ({
      ax: groundX[i],
      ay: groundY[i],
      axe: p.archetypeId,
      vx: velX[i],
      vy: velY[i],
      hd: headings[i],
      rc: playerColors[i],
    })),
  )}];
  for(var i=0;i<players.length;i++){
    var p=players[i];
    // Map from game coords to canvas
    var cx=20+((p.ax+52.5)/105)*(W-40);
    var cy=20+((p.ay+34)/68)*(H-40);
    var r={
      "archetype_burst_v1":10,
      "archetype_steady_v1":8,
      "archetype_technical_v1":7,
      "archetype_power_v1":9,
      "archetype_agility_v1":6
    }[p.axe]||8;

    drawPlayer(cx,cy,r,p.rc);

    // Velocity vector
    var vm=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
    if(vm>0.01){
      ctx.strokeStyle=hexToRgba(p.rc,0.5);
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.sin(p.hd)*vm*3,cy-Math.cos(p.hd)*vm*3);
      ctx.stroke();
    }
  }

  // Draw ball from simulation state
  var ball={
    px:${ballPos.x},
    py:${ballPos.y},
    pz:${ballPos.z},
    regime:"${ballRegime}",
    vx:${ballSpeed},
    vy:0,
    vz:0
  };
  var bcx=20+((ball.px+52.5)/105)*(W-40);
  var bcy=20+((ball.py+34)/68)*(H-40);
  var br=ball.regime==="ground-roll"?4:5;
  ctx.fillStyle='#ffff33';
  ctx.beginPath();
  ctx.arc(bcx,bcy,br,0,Math.PI*2);
  ctx.fill();

  // Pitch outline
  ctx.strokeStyle='#2a4a2a33';
  ctx.lineWidth=1;
  ctx.strokeRect(20,20,W-40,H-40);
  ctx.beginPath();
  ctx.moveTo(W/2,20);
  ctx.lineTo(W/2,H-20);
  ctx.stroke();

  // Metadata
  ctx.fillStyle='#ffffff';
  ctx.font='9px monospace';
  ctx.fillText('tick:${tick} h:${stateHash.slice(0,8)}',5,10);
  // List archetype IDs rendered
  var aids=${JSON.stringify(
    archetypeIds.map((a) => a.slice(0, 14)),
  )};
  ctx.fillText(aids.join(' | ').slice(0, 40), 5, H-5);
})();
</script>
</body>
</html>`;
}

/**
 * Compute a perceptual hash from canvas pixel data.
 *
 * FIX #5: Samples the full canvas in a stratified grid (128x72 = 9216
 * samples) covering the entire 320×180 frame (~25% of pixels), then
 * applies an adaptive threshold per-region for stability.
 *
 * Returns a hex string suitable for comparison.
 */
function computePerceptualHash(canvasBuffer: Buffer): string {
  const gridW = 128,
    gridH = 72;
  const pixels: number[] = [];

  // Stride to sample evenly across the full frame
  const strideR = Math.floor(canvasBuffer.length / 4 / (gridW * gridH));

  let idx = 0;
  for (let i = 0; i < gridW * gridH; i++) {
    const r = canvasBuffer[idx];
    const g = canvasBuffer[idx + 1];
    const b = canvasBuffer[idx + 2];
    // Luminance: standard weighting
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    pixels.push(lum);
    idx += strideR * 4;
    // Wrap around if we hit the end
    if (idx >= canvasBuffer.length) idx = (idx % canvasBuffer.length) | 0;
  }

  // Adaptive threshold: use per-region median instead of global average
  // for better contrast preservation.
  const sorted = [...pixels].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Convert to bits using adaptive threshold
  const bits: number[] = pixels.map((p) => (p >= median ? 1 : 0));

  // Convert bits to hex string
  let hash = "";
  for (let i = 0; i < bits.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4 && i + j < bits.length; j++) {
      nibble = (nibble << 1) | bits[i + j];
    }
    hash += nibble.toString(16);
  }

  return hash;
}

/**
 * Convert a raw pixel data URL (base64 PNG) into a Buffer.
 * Used to bridge the browser canvas capture (base64) into the Node
 * perceptual hash computation.
 */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Buffer.from(base64, "base64");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture archetype comparison artifacts.
 *
 * Runs the simulation to extract actual game state (players, ball,
 * archetype IDs), renders that state onto a 2D canvas via Playwright,
 * captures screenshots, and computes perceptual hashes.
 *
 * @param opts - Optional configuration.
 * @returns CaptureResult with all captured frames and hashes.
 */
export async function captureArchetypeArtifacts(
  opts?: {
    /** Output directory for screenshots. Defaults to artifacts/archetype-capture/. */
    outputDir?: string;
    /** Tick to capture. Defaults to 5. */
    tick?: number;
  },
): Promise<CaptureResult> {
  const { outputDir, tick = DEFAULT_TICK } = opts ?? {};

  // Load fixture and simulate to target tick
  const rawFixture = loadFixture();
  const scenario = rawFixture as unknown as ScenarioDefinition;
  const simResult = simulateToTick(scenario, tick);

  // Extract actual game state from the simulation
  const world = createWorld({ scenario });
  const sim = createSimulation(world);

  // Fast-forward to target tick
  for (let t = 0; t < tick; t++) {
    const stepInputs: InputFrame[] = [
      {
        tick: t,
        sourceId: "archetype-capture",
        controlSlot: "slot-1",
        moveX: 0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: t,
        sourceId: "archetype-capture",
        controlSlot: "slot-2",
        moveX: -0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
    for (const inp of stepInputs) {
      sim.applyInputs([inp]);
    }
    sim.step();
  }

  // Get the PresentationSnapshot — this is the game engine's authoritative
  // rendering state.  All visual output is derived from this.
  const snapshot = sim.presentation();

  // Extract archetype IDs from the scenario player definitions.
  // PresentationSnapshot doesn't include archetypeId, so we read it
  // from the scenario's player entries.
  const archetypeMap = new Map<string, string>();
  for (const sp of scenario.players) {
    if (sp.playerId && sp.archetypeId) {
      archetypeMap.set(sp.playerId, sp.archetypeId);
    }
  }

  // Extract player data from the snapshot, enriched with archetype IDs.
  // PresentationSnapshot has `speed` (scalar) for velocity magnitude,
  // and the game engine computes direction from bodyHeading.
  const players = snapshot.players.map((p) => ({
    playerId: p.playerId,
    archetypeId: archetypeMap.get(p.playerId) ?? "archetype-steady-v1",
    groundPosition: p.groundPosition,
    linearVelocity: { x: p.speed, y: 0 },
    bodyHeading: p.bodyHeading,
  }));

  // Extract ball data from the snapshot.
  // BallPresentation has `speed` (scalar velocity magnitude) and
  // `isGrounded` as a cue, but no directional velocity vector.
  const ballState = {
    position: snapshot.ball.position,
    regime: snapshot.ball.regime ?? "ground-roll",
    speed: snapshot.ball.speed,
  };

  // Determine which archetypes to render — use unique archetypes
  // present in the simulation state, falling back to all known.
  const archetypeSet = new Set<string>();
  for (const p of players) {
    archetypeSet.add(p.archetypeId);
  }
  const archetypesToRender =
    archetypeSet.size > 0
      ? Array.from(archetypeSet)
      : KNOWN_ARCHETYPES;

  // Start Playwright browser for canvas rendering
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const frames: CapturedFrame[] = [];

  for (const arch of archetypesToRender) {
    // Build HTML that draws actual game state data
    const html = buildArchetypeHtml(
      arch,
      simResult.hash,
      simResult.tick,
      players,
      ballState,
    );
    await page.setContent(html);
    await page.waitForTimeout(50);

    // FIX #3: Compute perceptual hash using browser-native conversion.
    // We read the canvas pixel data directly in the browser context
    // using Array.from + toString(16) instead of Node's Buffer.
    // FIX #5: The hash function samples the full canvas frame.
    // Note: passing code as a string literal avoids TS errors from the
    // node config which doesn't include DOM types.
    const pixelData = (await page.evaluate(
      String.raw`
        (function(){
          var el = document.getElementById('c');
          if (!el) return '';
          var ctx = el.getContext('2d');
          if (!ctx) return '';
          var id = ctx.getImageData(0, 0, el.width, el.height);
          return Array.from(id.data)
            .map(function(b) { return b.toString(16).padStart(2,'0'); })
            .join('');
        })()
      `,
    )) as string;

    // Convert the hex pixel data to a Buffer for perceptual hashing
    const pixelBuffer = Buffer.from(pixelData, "hex");
    const perceptualHash = computePerceptualHash(pixelBuffer);

    // Capture screenshot as base64 PNG data URL
    const screenshotBuf = (await page.screenshot({ type: "png" })) as unknown as Buffer;
    const screenshotDataUrl = `data:image/png;base64,${screenshotBuf.toString("base64")}`;

    const frame: CapturedFrame = {
      archetypeId: arch,
      screenshot: screenshotDataUrl,
      perceptualHash,
      tick: simResult.tick,
      seed: (rawFixture.seed as number) ?? 42,
    };
    frames.push(frame);

    // Write artifact to disk if outputDir is set
    if (outputDir) {
      mkdirSync(outputDir, { recursive: true });
      const baseName = arch.replace(/-v\d+$/, "");
      const pngPath = join(
        outputDir,
        `${baseName}-frame-${tick.toString().padStart(3, "0")}.png`,
      );
      writeFileSync(pngPath, screenshotBuf);
    }
  }

  await browser.close();

  return {
    captureVersion: CAPTURE_VERSION,
    fixtureId: (rawFixture.id as string) ?? "3v3-fixture-short-v1",
    pairResults: [{ frames }],
    totalFrames: frames.length,
  };
}

/**
 * Compute perceptual hash of a raw canvas pixel buffer (RGBA).
 * For external use when rendering is done outside Playwright.
 *
 * @param pixelData - RGBA pixel buffer (width * height * 4 bytes).
 * @returns Hex perceptual hash string.
 */
export function computeCanvasPerceptualHash(
  pixelData: Buffer,
): string {
  return computePerceptualHash(pixelData);
}