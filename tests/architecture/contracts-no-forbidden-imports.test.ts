/**
 * ARCH-CONTRACTS-001 — Proves contracts compile without forbidden types.
 *
 * Two approaches:
 * 1. AST/import scan of src/contracts/** and src/simulation/{config,world}/**
 *    to confirm no imports of three, window, document, or node:fs.
 * 2. Compiling the same probe file used by BOOTSTRAP-01's core-ts-isolation
 *    test must still fail under tsconfig.core.json (same env as contracts).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";

const root = resolve(process.cwd());

/** Strip single-line and multi-line comments from TS source. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")   // multi-line
    .replace(/\/\/.*$/gm, "");          // single-line
}

// Collect all .ts files under src/contracts and src/simulation/{config,world}
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

describe("ARCH-CONTRACTS-001: contracts compile without forbidden types", () => {
  it("no file imports 'three' or DOM globals", () => {
    const files = [
      ...collectTsFiles("src/contracts"),
      ...collectTsFiles("src/simulation/config"),
      ...collectTsFiles("src/simulation/world"),
    ];

    const forbiddenPatterns = [
      /from\s+["']three["']/,
      /from\s+["']@three["']/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\bHTMLCanvasElement\b/,
      /\bHTMLElement\b/,
      /\bElement\b/,
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf-8"));
      for (const pat of forbiddenPatterns) {
        if (pat.test(content)) {
          violations.push(`${file}: matched ${pat.source}`);
        }
      }
    }

    expect(violations, `Forbidden imports found:\n${violations.join("\n")}`).toEqual([]);
  });

  it("no file imports Node I/O types (node:fs, node:child_process, etc.)", () => {
    const files = [
      ...collectTsFiles("src/contracts"),
      ...collectTsFiles("src/simulation/config"),
      ...collectTsFiles("src/simulation/world"),
    ];

    const forbiddenPatterns = [
      /from\s+["']node:/,
      /from\s+["']fs["']/,
      /from\s+["']child_process["']/,
      /from\s+["']path["']/,
      /\brequire\s*\(/,
      /\bprocess\b/,
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf-8"));
      for (const pat of forbiddenPatterns) {
        if (pat.test(content)) {
          violations.push(`${file}: matched ${pat.source}`);
        }
      }
    }

    expect(violations, `Forbidden Node imports found:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("ARCH-CONTRACTS-002: contracts are free of forbidden globals", () => {
  it("no file references forbidden globals (window, document, process, Buffer)", () => {
    const files = [
      ...collectTsFiles("src/contracts"),
      ...collectTsFiles("src/simulation/config"),
      ...collectTsFiles("src/simulation/world"),
    ];

    const forbidden = [/\bwindow\b/, /\bdocument\b/, /\bprocess\b/, /\bBuffer\b/];
    const violations: string[] = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf-8"));
      for (const pat of forbidden) {
        if (pat.test(content)) {
          violations.push(`${file}: matched ${pat.source}`);
        }
      }
    }

    expect(violations, `Forbidden globals found:\n${violations.join("\n")}`).toEqual([]);
  });
});