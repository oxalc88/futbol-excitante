/**
 * Restored repository AI-match video capture tool.
 *
 * Wires a real 5v5 CPU-vs-CPU anti-huddle match (the browser composition root's
 * `ai-match-5v5` mode, `cpuAntiHuddle: true`) to Playwright Chromium's native
 * `recordVideo` so a ~30 s organic clip is produced WITHOUT any system ffmpeg
 * (Playwright records .webm with a bundled codec). System ffmpeg is only used if
 * it is actually available and `--mp4` is requested.
 *
 * Capture hygiene (0.9.2+):
 *   - Ordinary runs (`pnpm run capture-ai-video`, no WIP_SECTION) write the
 *     binary .webm and a `video-meta.json` under the ignored
 *     `test-results/gauntlet-capture/VIDEO-CAPTURE-RESTORE-30S-CLIP/**` tree and
 *     leave `docs/` byte-identical.
 *   - Durable metadata is entered only through
 *     `WIP_SECTION=__EVIDENCE__:VIDEO-CAPTURE-RESTORE-30S-CLIP pnpm run capture-ai-video`,
 *     which writes `video-meta.json` under
 *     `docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/`. The binary .webm stays in
 *     `test-results/gauntlet-capture/**` (binary video is optional/ephemeral and
 *     is never committed).
 *   - If the objective already has a `manifest.json`, the durable gate refuses to
 *     touch accepted evidence.
 *
 * Video is OPTIONAL diagnostic evidence. It never replaces a required
 * trajectory or semantic frame sequence and never becomes gameplay evidence.
 *
 * Usage:
 *   mise exec -- pnpm run capture-ai-video
 *   mise exec -- pnpm run capture-ai-video -- --duration 30 --mode ai-match-5v5
 *   WIP_SECTION=__EVIDENCE__:VIDEO-CAPTURE-RESTORE-30S-CLIP \
 *     mise exec -- pnpm run capture-ai-video -- --duration 30 --mode ai-match-5v5
 *
 * Flags:
 *   --mode <mode>        Browser match mode (default ai-match-5v5).
 *   --duration <sec>     Wall-clock capture window in seconds (default 30, > 0).
 *   --out <dir>          Write BOTH the .webm and video-meta.json under <dir>
 *                        (used by tests; bypasses the WIP_SECTION gate).
 *   --viewport <WxH>     Viewport size (default 800x600).
 *   --port <n>           Vite dev-server port (default 5199).
 *   --artifact-id <id>   Deterministic provider artifact id.
 *   --mp4                Convert webm -> mp4, but ONLY if system ffmpeg exists.
 *
 * Exit codes: 0 success; 2 bad inputs; 1 any real capture/rendering failure.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const OBJECTIVE_ID = "VIDEO-CAPTURE-RESTORE-30S-CLIP";
const DURABLE_MARKER = `__EVIDENCE__:${OBJECTIVE_ID}`;

/** The browser composition root's match-mode ids (src/apps/browser/main.ts). */
const ALLOWED_MODES = new Set([
  "ai-match-5v5",
  "ai-match-3v3",
  "ai-match",
  "2v2-ai",
  "human-vs-ai-5v5",
  "human-vs-ai-5v3",
  "human-vs-ai-3v3",
  "human-vs-ai",
  "human-vs-ai-1v1",
]);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { mode: "ai-match-5v5", duration: 30, viewport: "800x600", port: 5199, out: null, artifactId: null, mp4: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? next : "true";
    if (next && !next.startsWith("--")) i += 1;
    switch (key.slice(2)) {
      case "mode": args.mode = value; break;
      case "duration": args.duration = Number(value); break;
      case "viewport": args.viewport = value; break;
      case "port": args.port = Number(value); break;
      case "out": args.out = value; break;
      case "artifact-id": args.artifactId = value; break;
      case "mp4": args.mp4 = true; break;
      default: fail(`unknown flag --${key.slice(2)}`);
    }
  }
  return args;
}

function validateArgs(args) {
  if (!Number.isFinite(args.duration) || args.duration <= 0) {
    console.error(`ERROR: --duration must be a positive number, got "${args.duration}"`);
    process.exit(2);
  }
  if (!ALLOWED_MODES.has(args.mode)) {
    console.error(`ERROR: --mode "${args.mode}" is not a known browser match mode. Allowed: ${[...ALLOWED_MODES].join(", ")}`);
    process.exit(2);
  }
  if (!/^\d+x\d+$/.test(args.viewport)) {
    console.error(`ERROR: --viewport must be <width>x<height>, got "${args.viewport}"`);
    process.exit(2);
  }
  if (!Number.isInteger(args.port) || args.port <= 0) {
    console.error(`ERROR: --port must be a positive integer, got "${args.port}"`);
    process.exit(2);
  }
}

/** Honest ffmpeg probe: present only if the system binary actually runs. */
function detectFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/** Parse "<Label>: <number>" HUD text into an integer, or null if absent. */
function parseHudNumber(text, label) {
  const match = String(text).match(new RegExp(`^\\s*${label}:\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

/** Resolve where the binary .webm and the durable metadata should land. */
function resolveOutputDirs(args) {
  const durable = process.env.WIP_SECTION === DURABLE_MARKER;
  if (args.out) {
    const dir = resolve(args.out);
    return { artifactDir: dir, metaDir: dir, durable: false };
  }
  // The binary .webm is ephemeral by design (never committed).
  const artifactDir = resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
  // The metadata is durable only on the explicit evidence command.
  const metaDir = durable
    ? resolve("docs/evidence", OBJECTIVE_ID)
    : artifactDir;
  return { artifactDir, metaDir, durable };
}

/** The objective's evidence is immutable once a manifest exists. */
function assertEvidenceMutable(metaDir, durable) {
  if (!durable) return;
  if (existsSync(resolve(metaDir, "manifest.json"))) {
    fail(`Accepted evidence is immutable: ${OBJECTIVE_ID} already has a manifest`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  const ffmpegAvailable = detectFfmpeg();
  console.log(`[capture-ai-video] ffmpeg: ${ffmpegAvailable ? "available" : "absent"} -> recordWebmNative=${!ffmpegAvailable || !args.mp4}`);

  const { artifactDir, metaDir, durable } = resolveOutputDirs(args);
  assertEvidenceMutable(metaDir, durable);
  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(metaDir, { recursive: true });

  const [width, height] = args.viewport.split("x").map(Number);
  const port = args.port;
  const durationMs = args.duration * 1000;
  const artifactName = `${args.mode}-${args.duration}s.webm`;

  const server = await createServer({ server: { port } });
  await server.listen();
  const baseUrl =
    server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  console.log(`[capture-ai-video] vite dev server: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const recordingsDir = resolve(artifactDir, ".recordings");
  mkdirSync(recordingsDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: recordingsDir },
  });
  const page = await context.newPage();

  let startedAt = 0;
  let finalTickText = "";
  let finalHashText = "";
  try {
    console.log(`[capture-ai-video] navigating to ?mode=${args.mode}`);
    await page.goto(`${baseUrl}/src/apps/browser/index.html?mode=${args.mode}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    // The match has started once the HUD tick advances past zero and the setup
    // menu is hidden (the same condition the browser suites use).
    await page.waitForFunction(
      () => {
        const menuHidden =
          document.getElementById("setup-menu")?.classList.contains("hidden") ?? false;
        const tick = document.getElementById("tick-display")?.textContent ?? "";
        return menuHidden && tick !== "" && !/^Tick:\s*0$/.test(tick);
      },
      { timeout: 30000 },
    );
    console.log(`[capture-ai-video] match running; recording ${args.duration}s wall-clock`);
    startedAt = Date.now();
    await page.waitForTimeout(durationMs);
    // Snapshot the HUD the same renderer displays before closing the context.
    finalTickText = await page.$eval("#tick-display", (el) => el.textContent ?? "").catch(() => "");
    finalHashText = await page.$eval("#hash-display", (el) => el.textContent ?? "").catch(() => "");
  } catch (error) {
    console.error(`ERROR: match did not start/run in Chromium: ${error.message}`);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
    fail("browser match capture failed");
  }

  // Closing the recording context finalizes the .webm; the browser stays open
  // so we can demux the container with Chromium's media stack (no ffprobe).
  await context.close();

  const wallSeconds = Math.round(((Date.now() - startedAt) / 1000) * 1000) / 1000;
  const webmFiles = readdirSync(recordingsDir).filter((f) => f.endsWith(".webm"));
  if (webmFiles.length === 0) fail(`no .webm produced in ${recordingsDir}`);
  const sourceWebm = resolve(recordingsDir, webmFiles[0]);
  const finalWebm = resolve(artifactDir, artifactName);
  renameSync(sourceWebm, finalWebm);
  rmSync(recordingsDir, { recursive: true, force: true });

  const bytes = statSync(finalWebm).size;
  if (bytes < 1024) fail(`produced .webm is suspiciously small (${bytes} bytes)`);
  const sha256 = sha256File(finalWebm);

  // Read the real container duration/dimensions from the .webm itself.
  const containerMeta = await measureContainerDuration(browser, finalWebm);

  // mp4 conversion only when a real converter is available (skipped otherwise).
  let container = "webm";
  if (args.mp4 && ffmpegAvailable) {
    const mp4Path = resolve(artifactDir, artifactName.replace(/\.webm$/, ".mp4"));
    execFileSync("ffmpeg", ["-y", "-i", finalWebm, mp4Path], { stdio: "ignore" });
    container = "mp4";
    console.log(`[capture-ai-video] converted webm -> mp4 via system ffmpeg`);
  } else if (args.mp4 && !ffmpegAvailable) {
    console.log("[capture-ai-video] --mp4 requested but system ffmpeg is absent; keeping native .webm");
  }

  await browser.close();
  await server.close();

  const createdAt = new Date().toISOString();
  const artifactId = args.artifactId ?? `anti-huddle-${args.mode}-${args.duration}s`;
  const provider =
    "playwright-chromium native recordVideo (bundled WebM codec; no system ffmpeg)";
  const meta = {
    schema_version: 1,
    objective_id: OBJECTIVE_ID,
    durable_capture: durable,
    artifact_id: artifactId,
    artifact_name: container === "mp4" ? artifactName.replace(/\.webm$/, ".mp4") : artifactName,
    provider,
    created_at: createdAt,
    expires_at: null,
    mode: args.mode,
    scenario: "eval/scenarios/5v5-fixture-v1.json",
    anti_huddle: true,
    viewport: { width, height },
    format: container,
    codec: containerMeta.codec ?? null,
    duration_seconds: containerMeta.duration ?? wallSeconds,
    container_duration_seconds: containerMeta.duration ?? null,
    width: containerMeta.width ?? null,
    height: containerMeta.height ?? null,
    bytes,
    sha256,
    capture_wall_seconds: wallSeconds,
    final_tick: parseHudNumber(finalTickText, "Tick"),
    final_hud_state_hash: finalHashText.replace(/^Hash:\s*/, "") || null,
    ffmpeg: { available: ffmpegAvailable, converter_used: args.mp4 && ffmpegAvailable ? "system ffmpeg" : "none" },
    notes: [
      "duration_seconds is the .webm container duration parsed back through Chromium's media stack (system ffmpeg/ffprobe is absent); capture_wall_seconds is the wall-clock window the match was on screen, which is shorter because recordVideo also spans page load/teardown.",
      "final_hud_state_hash is the HUD-displayed value, which the app truncates to 20 chars; the authoritative per-tick hash chain is in the accepted trajectories, not in a video.",
      "binary .webm is optional/ephemeral; the committed record is this metadata + a video-reference.json written separately after the candidate commit exists.",
      "video is optional diagnostic evidence; it never replaces a trajectory or semantic frame sequence and never becomes gameplay evidence.",
    ],
  };

  const metaPath = resolve(metaDir, "video-meta.json");
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(
    `[capture-ai-video] OK artifact=${finalWebm} bytes=${bytes} sha256=${sha256}` +
      ` containerSeconds=${String(containerMeta.duration)} wallSeconds=${wallSeconds}` +
      ` meta=${metaPath} durable=${durable}`,
  );
}

/**
 * Demux a .webm in Chromium (the only media stack available without system
 * ffmpeg/ffprobe) to read its real duration and dimensions. Returns nulls when
 * the container cannot be parsed; the tool still succeeds because the binary is
 * optional diagnostic evidence and the wall-clock window remains honest.
 */
async function measureContainerDuration(browser, webmPath) {
  const base64 = readFileSync(webmPath).toString("base64");
  const page = await browser.newPage();
  try {
    const meta = await page.evaluate(async (payload) => {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }));
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      const first = await Promise.race([
        new Promise((resolve) => {
          video.onloadedmetadata = () => resolve("loaded");
          video.onerror = () => resolve("error");
        }),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000)),
      ]);
      const result = {
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        codec: video.videoTracks?.[0]?.codec ?? null,
        status: first,
      };
      URL.revokeObjectURL(url);
      return result;
    }, base64);
    return meta;
  } catch {
    return { duration: null, width: null, height: null, codec: null, status: "error" };
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
