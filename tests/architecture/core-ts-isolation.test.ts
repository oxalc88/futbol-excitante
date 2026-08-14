/**
 * CORE-TS-ISOLATION-001 — Core TypeScript configuration isolation test.
 *
 * Proves that compiling a file inside the core include scope
 * (src/simulation/) that directly references forbidden globals
 * (window, document, process, Buffer) FAILS with tsconfig.core.json.
 *
 * The probe file is written under src/simulation/, compiled with
 * `tsc --project tsconfig.core.json --noEmit`, and deleted in a
 * finally block so it never leaks into the tree or other checks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const PROBE_FILE = join(__dirname, "../../src/simulation/_isolation-probe.ts");

/**
 * Minimal forbidden code: references window, document, process, Buffer
 * with zero `declare` statements, zero imports, and zero @types/node.
 * Under tsconfig.core.json (lib: ES2022 only, types: []), these must error.
 */
const PROBE_CODE = `// Forbidden globals used by value — no declares, no imports.
// Under tsconfig.core.json these must produce type errors.
const _w: any = window;
const _d: any = document;
const _p: any = process;
const _b: any = Buffer;
`;

describe("CORE-TS-ISOLATION-001: core tsconfig forbids DOM/Node globals", () => {
  it("compilation of forbidden globals FAILS with tsconfig.core.json", () => {
    // Write the probe file inside the core include scope
    writeFileSync(PROBE_FILE, PROBE_CODE);

    try {
      // Compile ONLY via the project config — no extra positional files.
      execSync(
        "npx tsc --project tsconfig.core.json --noEmit",
        {
          stdio: "pipe",
          encoding: "utf-8",
          cwd: process.cwd(),
        }
      );
      // If the compile succeeded, the core isolation is broken.
      expect.fail(
        "tsconfig.core.json should reject forbidden globals (window/document/process/Buffer)"
      );
    } catch (err: any) {
      // Must fail — now verify the diagnostics actually mention the
      // forbidden identifiers (or are genuine type errors from them).
      const output = (err.stdout || "") + (err.stderr || "");

      // At least one of the forbidden identifiers must appear in the
      // TS diagnostic output, proving the compiler flagged the reference.
      const forbiddenRefs = ["window", "document", "process", "Buffer"];
      const hit = forbiddenRefs.some((id) => output.includes(id));

      expect(
        hit,
        `tsc failed as expected, but diagnostics did not mention forbidden identifiers. Output: ${output}`
      ).toBe(true);

      // Also assert the compiler exit code is non-zero.
      expect(err.status).toBeGreaterThan(0);
    } finally {
      // Always clean up the probe — it must not leak into the tree.
      try {
        unlinkSync(PROBE_FILE);
      } catch {
        /* already removed */
      }
    }
  });

  it("tsconfig.core.json lib does NOT include DOM", () => {
    const coreConfig = JSON.parse(
      readFileSync("tsconfig.core.json", "utf-8")
    );
    const lib = coreConfig.compilerOptions?.lib || [];
    const hasDom = lib.some(
      (l: string) => l.toLowerCase().includes("dom")
    );
    expect(hasDom).toBe(false);
  });

  it("tsconfig.core.json types does NOT include node", () => {
    const coreConfig = JSON.parse(
      readFileSync("tsconfig.core.json", "utf-8")
    );
    const types = coreConfig.compilerOptions?.types || [];
    const hasNode = types.some(
      (t: string) => t.toLowerCase().includes("node")
    );
    expect(hasNode).toBe(false);
  });

  it("tsconfig.node.json DOES include node types", () => {
    const nodeConfig = JSON.parse(
      readFileSync("tsconfig.node.json", "utf-8")
    );
    const types = nodeConfig.compilerOptions?.types || [];
    const hasNode = types.some(
      (t: string) => t.toLowerCase().includes("node")
    );
    expect(hasNode).toBe(true);
  });

  it("tsconfig.browser.json DOES include DOM lib", () => {
    const browserConfig = JSON.parse(
      readFileSync("tsconfig.browser.json", "utf-8")
    );
    const lib = browserConfig.compilerOptions?.lib || [];
    const hasDom = lib.some(
      (l: string) => l.toLowerCase().includes("dom")
    );
    expect(hasDom).toBe(true);
  });
});