import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export function isSafeObjectiveId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

export function assertRepositoryRelative(relativePath: string): void {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
    throw new Error(`path must stay repository-relative: ${relativePath}`);
  }
}

export async function pathExistsAsFile(repoRoot: string, relativePath: string): Promise<boolean> {
  try {
    assertRepositoryRelative(relativePath);
    return (await stat(path.join(repoRoot, relativePath))).isFile();
  } catch {
    return false;
  }
}

export async function digestRepositoryFiles(repoRoot: string, relativePaths: string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const relativePath of [...new Set(relativePaths)].sort()) {
    assertRepositoryRelative(relativePath);
    const bytes = await readFile(path.join(repoRoot, relativePath));
    hash.update(relativePath);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function approximateTokens(value: unknown): number {
  return Math.ceil(Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8") / 4);
}
