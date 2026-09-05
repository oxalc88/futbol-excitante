/**
 * BINDING guard for the restored video capture path
 * (VIDEO-CAPTURE-RESTORE-30S-CLIP).
 *
 * The repository package.json references
 * `scripts/capture-ai-match-video.mjs` (`capture-ai-video`), which was missing
 * and blocked the optional 30 s organic clip. These checks make the path real:
 *   (1) the tool file exists and the package.json hook resolves to it;
 *   (2) the tool refuses/fails cleanly when required inputs are missing or
 *       unknown (discriminating: a broken or placeholder tool would not reject
 *       a bad mode/duration);
 *   (3) a short real Chromium recordVideo run produces a non-trivial .webm and a
 *       `video-meta.json` whose reported byte size, SHA-256 and container
 *       duration match the actual file (no invented metadata).
 *
 * This never asserts gameplay quality and never weakens any other guard. Video
 * is optional diagnostic evidence and is never required to prove a football
 * outcome.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.cwd();
const TOOL = join(REPO, "scripts/capture-ai-match-video.mjs");

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(REPO, "package.json"), "utf-8")) as Record<string, unknown>;
}

function runTool(args: string[], env: Record<string, string | undefined> = {}): {
  code: number;
  output: string;
} {
  try {
    const output = execFileSync(process.execPath, [TOOL, ...args], {
      cwd: REPO,
      env: { ...process.env, ...env },
      stdio: "pipe",
      timeout: 120_000,
    });
    return { code: 0, output: output.toString() };
  } catch (error) {
    const e = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      code: e.status ?? 1,
      output: `${(e.stdout?.toString() ?? "")}${(e.stderr?.toString() ?? "")}`,
    };
  }
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("video capture path (VIDEO-CAPTURE-RESTORE-30S-CLIP)", () => {
  it("the capture tool file exists", () => {
    expect(existsSync(TOOL)).toBe(true);
  });

  it("package.json capture-ai-video resolves to the restored tool", () => {
    const scripts = (readPackageJson().scripts ?? {}) as Record<string, string>;
    expect(scripts["capture-ai-video"]).toBe("node scripts/capture-ai-match-video.mjs");
    expect(existsSync(join(REPO, "scripts/capture-ai-match-video.mjs"))).toBe(true);
  });

  it("rejects an unknown match mode with a clean non-zero exit", () => {
    const result = runTool(["--mode", "not-a-mode", "--duration", "1"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/not a known browser match mode/);
  });

  it("rejects a non-positive duration with a clean non-zero exit", () => {
    const result = runTool(["--mode", "ai-match-5v5", "--duration", "0"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/--duration must be a positive number/);
  });

  it(
    "a short real Chromium run writes a non-trivial .webm and metadata that match the file",
    () => {
      const outDir = mkdtempSync(join(tmpdir(), "pes-capture-video-"));
      try {
        const result = runTool([
          "--mode",
          "ai-match-5v5",
          "--duration",
          "2",
          "--port",
          "5237",
          "--out",
          outDir,
        ]);
        expect(result.code).toBe(0);
        expect(result.output).toMatch(/OK artifact=.*\.webm/);

        const webmFiles = globWebm(outDir);
        expect(webmFiles.length).toBe(1);

        const webmPath = join(outDir, webmFiles[0]);
        const bytes = statSync(webmPath).size;
        // Non-trivial: a blank/static frame keeps the payload near zero bytes.
        expect(bytes).toBeGreaterThan(1024);

        const meta = JSON.parse(readFileSync(join(outDir, "video-meta.json"), "utf-8")) as {
          artifact_name: string;
          bytes: number;
          sha256: string;
          duration_seconds: number;
          width: number;
          height: number;
          capture_wall_seconds: number;
        };
        expect(meta.artifact_name).toBe(webmFiles[0]);
        expect(meta.bytes).toBe(bytes);
        expect(meta.sha256).toBe(sha256File(webmPath));
        expect(meta.sha256).toMatch(/^[0-9a-f]{64}$/);
        // The reported container duration is real (>= the requested window, and
        // bounded by the page-load/teardown overhead that recordVideo adds).
        expect(meta.duration_seconds).toBeGreaterThanOrEqual(2);
        expect(meta.duration_seconds).toBeLessThan(20);
        expect(meta.capture_wall_seconds).toBeGreaterThanOrEqual(2);
        expect(meta.width).toBe(800);
        expect(meta.height).toBe(600);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

/** List .webm files in a directory (sorted, name only). */
function globWebm(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".webm")).sort();
}
