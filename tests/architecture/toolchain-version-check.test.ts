/**
 * TOOLCHAIN-VERSION-001 — Toolchain version and locked-state checks.
 *
 * Resolves Node and pnpm through mise (not ambient PATH), asserts
 * exact versions, and runs a real `pnpm install --frozen-lockfile`
 * to prove the lockfile is immutable.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

// vitest runs from the repo root, so cwd is the repo root
const root = resolve(process.cwd());

describe("TOOLCHAIN-VERSION-001: mise toolchain is pinned", () => {
  it("mise.toml exists at repository root", () => {
    expect(
      existsSync(join(root, "mise.toml")),
      "mise.toml must exist at repo root"
    ).toBe(true);
  });

  it("Node version in mise.toml is 24.18.0", () => {
    const miseContent = readFileSync(join(root, "mise.toml"), "utf-8");
    expect(miseContent).toContain('node = "24.18.0"');
  });

  it("pnpm version in mise.toml is 11.10.0", () => {
    const miseContent = readFileSync(join(root, "mise.toml"), "utf-8");
    expect(miseContent).toContain('pnpm = "11.10.0"');
  });

  it("mise.lock exists at repository root (committed)", () => {
    expect(
      existsSync(join(root, "mise.lock")),
      "mise.lock must exist and be committed"
    ).toBe(true);
  });

  it("package.json is private type=module", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf-8")
    );
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe("module");
  });

  it("packageManager field is exactly pnpm@11.10.0", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf-8")
    );
    expect(pkg.packageManager).toBe("pnpm@11.10.0");
  });

  it("no .nvmrc file exists", () => {
    expect(existsSync(join(root, ".nvmrc"))).toBe(false);
  });

  it("mise.lock contains expected tool resolutions", () => {
    const miseLock = readFileSync(join(root, "mise.lock"), "utf-8");
    expect(miseLock).toContain("node");
    expect(miseLock).toContain("pnpm");
  });

  it("lockfile=true in mise.toml settings", () => {
    const miseContent = readFileSync(join(root, "mise.toml"), "utf-8");
    expect(miseContent).toContain("lockfile = true");
  });

  it("active Node version via mise is exactly 24.18.0", () => {
    const version = execSync("mise exec -- node --version", {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: root,
    }).trim();
    expect(version).toBe("v24.18.0");
  });

  it("active pnpm version via mise is exactly 11.10.0", () => {
    const version = execSync("mise exec -- pnpm --version", {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: root,
    }).trim();
    expect(version).toBe("11.10.0");
  });

  it("pnpm-lock.yaml exists (lockfile committed)", () => {
    expect(
      existsSync(join(root, "pnpm-lock.yaml")),
      "pnpm-lock.yaml must exist and be committed"
    ).toBe(true);
  });

  it("pnpm install --frozen-lockfile succeeds (lockfile not modified)", () => {
    // Capture the lockfile hash before install.
    const lockfile = join(root, "pnpm-lock.yaml");
    const beforeHash = execSync(`sha256sum "${lockfile}"`, {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: root,
    }).trim();

    // Run frozen install — must succeed and not modify the lockfile.
    execSync("CI=1 pnpm install --frozen-lockfile", {
      stdio: "pipe",
      encoding: "utf-8",
      cwd: root,
    });

    // Re-capture hash and assert it is unchanged.
    const afterHash = execSync(`sha256sum "${lockfile}"`, {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: root,
    }).trim();

    expect(afterHash).toBe(beforeHash);
  });
});