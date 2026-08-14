/**
 * CORE-BOUNDARY-001 — Architecture boundary test.
 *
 * Scans every .ts file under src/contracts/** and src/simulation/**
 * using a regex-based source scan after stripping comments to reject
 * forbidden imports and global calls.
 *
 * Forbidden patterns:
 * - Math.random() in source code
 * - Date.now(), Date(), Date constructor calls
 * - performance.now(), performance references
 * - window, document global references
 * - process, Buffer, require() Node globals
 * - fs, fs/promises, child_process, net, http, https, os, path, os,
 *   url, util, stream, zlib, crypto, dns, tls, cluster imports
 * - fetch, XMLHttpRequest, WebSocket global calls
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectTsFiles(baseDir: string): string[] {
  const files: string[] = [];
  const base = join(root, baseDir);
  if (!existsSync(base)) return files;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".ts")) {
        files.push(full);
      }
    }
  }

  walk(base);
  return files;
}

// ---------------------------------------------------------------------------
// Strip comments — naive but sufficient for boundary scanning
// ---------------------------------------------------------------------------

function stripComments(src: string): string {
  return src
    .replace(/\/\/.*$/gm, "")       // single-line
    .replace(/\/\*[\s\S]*?\*\//g, ""); // multi-line
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("CORE-BOUNDARY-001: no forbidden APIs in contracts or simulation", () => {
  it("contracts and simulation contain no forbidden imports or calls", () => {
    const files = [
      ...collectTsFiles("src/contracts"),
      ...collectTsFiles("src/simulation"),
    ];

    if (files.length === 0) {
      expect.fail("No TypeScript files found under src/contracts or src/simulation");
    }

    // Forbidden patterns — each must NOT appear in any stripped source line.
    const forbidden: Array<{ pattern: RegExp; description: string }> = [
      // Math.random is the ultimate sin in simulation core
      { pattern: /\bMath\.random\s*\(/, description: "Math.random() call" },

      // Date usage (wall-clock)
      { pattern: /\bnew\s+Date\s*\(/, description: "new Date() call" },
      { pattern: /\bDate\.now\s*\(/, description: "Date.now() call" },
      { pattern: /\bDate\.parse\s*\(/, description: "Date.parse() call" },
      { pattern: /\bDate\.UTC\s*\(/, description: "Date.UTC() call" },
      { pattern: /\bDate\.toUTCString\s*\(/, description: "Date.toUTCString() call" },
      { pattern: /\bDate\.toISOString\s*\(/, description: "Date.toISOString() call" },

      // Performance API (monotonic clock — forbidden in core)
      { pattern: /\bperformance\s*\./, description: "performance.* reference" },
      { pattern: /\bperformance\s*\(/, description: "performance() call" },

      // Browser globals
      { pattern: /\bwindow\s*\./, description: "window.* reference" },
      { pattern: /\bwindow\s*\[/, description: "window[] access" },
      { pattern: /\bdocument\s*\./, description: "document.* reference" },
      { pattern: /\bdocument\s*\[/, description: "document[] access" },
      { pattern: /\bHTMLElement/, description: "HTMLElement reference" },
      { pattern: /\bHTMLCanvasElement/, description: "HTMLCanvasElement reference" },

      // Node.js globals and I/O
      { pattern: /\bprocess\s*\./, description: "process.* reference" },
      { pattern: /\bprocess\s*\[/, description: "process[] access" },
      { pattern: /\bprocess\b(?!\w)/, description: "process identifier" },
      { pattern: /\bBuffer\s*\./, description: "Buffer.* reference" },
      { pattern: /\bBuffer\s*\(/, description: "Buffer() call" },
      { pattern: /\brequire\s*\(/, description: "require() call" },

      // Node.js imports (fs, path, child_process, etc.)
      { pattern: /from\s+["']node:(fs|fs\/promises|child_process|net|http|https|os|path|crypto|dns|tls|stream|zlib|url|util|cluster|readline|events|buffer|vm|querystring|assert|constants|domain|module|string_decoder|timers|tty|readline|inspector)/, description: "node: import" },
      { pattern: /from\s+["'](fs|path|child_process|net|http|https|os|crypto|dns|tls|stream|zlib|url|util|cluster|readline|events|buffer|vm|querystring|assert|constants|domain|module|string_decoder|timers|tty|inspector)["']/, description: "Node module import" },

      // Network / fetch / WebSocket
      { pattern: /\bfetch\s*\(/, description: "fetch() call" },
      { pattern: /\bXMLHttpRequest/, description: "XMLHttpRequest reference" },
      { pattern: /\bWebSocket/, description: "WebSocket reference" },

      // Timer APIs (forbidden as authoritative clock)
      { pattern: /\bsetInterval\s*\(/, description: "setInterval() call" },
      { pattern: /\bsetTimeout\s*\(/, description: "setTimeout() call" },
      { pattern: /\bclearInterval\s*\(/, description: "clearInterval() call" },
      { pattern: /\bclearTimeout\s*\(/, description: "clearTimeout() call" },
      { pattern: /\brequestAnimationFrame\b/, description: "requestAnimationFrame reference" },
    ];

    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      const content = stripComments(src);
      for (const { pattern, description } of forbidden) {
        if (pattern.test(content)) {
          violations.push(`${file}: forbidden ${description} — matched /${pattern.source}/`);
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `Core boundary violations found in ${violations.length} location(s):\n${violations.join("\n")}\n\n` +
        "Remove all references to DOM, Node.js, browser globals, wall-clock time, " +
        "network I/O, and Math.random from src/contracts/** and src/simulation/**.",
      );
    }

    // Also verify that the files were actually scanned
    expect(files.length).toBeGreaterThan(0);
  });
});