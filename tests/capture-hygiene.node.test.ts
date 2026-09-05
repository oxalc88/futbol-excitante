/**
 * CAPTURE-HYGIENE-ENFORCEMENT: executable guard for the 0.9.2+ capture
 * hygiene rule.
 *
 * Ordinary regression suites (node + browser) may render and capture, but
 * their filesystem output is ephemeral and belongs under the ignored
 * `test-results/gauntlet-capture/**` tree. They must not write into
 * `docs/screenshots/**`, and accepted evidence (`docs/evidence/**`) is
 * immutable.
 *
 * The guard exercises the real browser suites (via a child vitest browser run)
 * rather than reasoning about source text, so a regression that reintroduces
 * an unguarded `docs/screenshots` write on an ordinary run is caught here:
 *   (1) an ordinary run of a formerly-violating suite leaves `docs/screenshots/**`
 *       byte-identical and writes ephemeral output under `test-results/`;
 *   (2) a `WIP_SECTION=__EVIDENCE__:<id>` rerun of an already-accepted objective
 *       is blocked by the immutable-evidence guard and does not overwrite
 *       `docs/screenshots/**`;
 *   (3) every suite that actually renders durable frames into `docs/screenshots`
 *       implements the `DURABLE_EVIDENCE` gate that switches its output root
 *       between `docs/screenshots/<id>` and `test-results/gauntlet-capture/<id>`.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = process.cwd();
const SCREENSHOTS_ROOT = join(REPO, "docs/screenshots");
const TEST_DIR = join(REPO, "tests");

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** SHA-256 of every file under docs/screenshots/**, keyed by repo-relative path. */
function snapshotScreenshots(): string {
  const entries: Array<[string, string]> = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        entries.push([relative(REPO, path), sha256(readFileSync(path))]);
      }
    }
  }
  if (existsSync(SCREENSHOTS_ROOT)) walk(SCREENSHOTS_ROOT);
  return JSON.stringify([...entries].sort());
}

/** Run a browser test file via a child vitest project-browser run. */
function runBrowser(filter: string, env: Record<string, string | undefined>): void {
  const childEnv: Record<string, string | undefined> = { ...process.env, ...env };
  execFileSync(
    "pnpm",
    ["exec", "vitest", "run", filter, "--project", "browser"],
    { cwd: REPO, env: childEnv, stdio: "pipe", timeout: 300_000 },
  );
}

function ordinaryEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.WIP_SECTION;
  return env;
}

function evidenceEnv(probeId: string): Record<string, string | undefined> {
  const env = ordinaryEnv();
  env.WIP_SECTION = `__EVIDENCE__:${probeId}`;
  return env;
}

/**
 * The suites that actually render durable frames into docs/screenshots in a
 * browser run (page.screenshot writers, now gated) plus the established gated
 * reference patterns. Each must implement the durable/vs-ephemeral root switch.
 */
const SCREENSHOT_WRITER_SUITES = [
  "5v5-ai-match.browser.test.ts",
  "3v3-match-screenshots.browser.test.ts",
  "small-sided-001.browser.test.ts",
  "small-sided-coherence-rerun.browser.test.ts",
  "small-sided-readability.browser.test.ts",
  "small-sided-integrated-playtest.browser.test.ts",
  "small-sided-action-event-observability.browser.test.ts",
  "5v5-human-vs-cpu.browser.test.ts",
  "human-action-readability-observability.browser.test.ts",
  "human-action-screenshot-capture.browser.test.ts",
  "duel-control-screenshot-capture.browser.test.ts",
  "cpu-tackle-screenshot-capture.browser.test.ts",
  "anti-huddle-dynamic-evidence.browser.test.ts",
  "human-arc-interaction.browser.test.ts",
];

describe("capture hygiene (0.9.2+): ordinary runs must not write docs/screenshots/**", () => {
  it(
    "an ordinary browser run of a formerly-violating suite leaves docs/screenshots byte-identical",
    () => {
      const before = snapshotScreenshots();
      runBrowser(
        "tests/browser/5v5-ai-match.browser.test.ts",
        ordinaryEnv(),
      );
      // Byte-for-byte identical: the ordinary run must not touch docs/screenshots.
      expect(snapshotScreenshots()).toBe(before);

      // The ephemeral output landed under the ignored test-results tree instead.
      expect(
        existsSync(
          join(REPO, "test-results/gauntlet-capture/BROWSER-5V5-MATCH/frame-000.png"),
        ),
      ).toBe(true);
    },
    300_000,
  );

  it(
    "an evidence-mode rerun of an accepted objective is blocked by the immutable guard and does not overwrite docs/screenshots",
    () => {
      const before = snapshotScreenshots();
      let exitCode = 0;
      try {
        // BROWSER-5V5-MATCH is accepted (manifest exists): the suite's
        // assertEvidenceMutable guard must fire instead of overwriting.
        runBrowser(
          "tests/browser/5v5-ai-match.browser.test.ts",
          evidenceEnv("BROWSER-5V5-MATCH"),
        );
      } catch (error) {
        exitCode = (error as { status?: number }).status ?? 1;
      }
      expect(exitCode).not.toBe(0);
      expect(snapshotScreenshots()).toBe(before);
    },
    300_000,
  );

  it("every docs/screenshots-rendering suite implements the durable/vs-ephemeral output gate", () => {
    for (const fileName of SCREENSHOT_WRITER_SUITES) {
      const source = readFileSync(join(TEST_DIR, "browser", fileName), "utf-8");
      expect(
        source.includes("DURABLE_EVIDENCE"),
        `${fileName} must gate durable capture on DURABLE_EVIDENCE`,
      ).toBe(true);
      expect(
        source.includes("test-results/gauntlet-capture"),
        `${fileName} must route ordinary output under test-results/gauntlet-capture`,
      ).toBe(true);
      expect(
        source.includes("docs/screenshots"),
        `${fileName} must route durable output under docs/screenshots`,
      ).toBe(true);
    }
  });
});
