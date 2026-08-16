import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface StateCheck { name: string; pass: boolean; detail?: string; owner: "orchestrator" }

function yamlValue(content: string, key: string): string | null {
  const m = content.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));
  return m?.[1]?.trim() ?? null;
}

export function latestAcceptedObjective(current: string): string | null {
  const marker = "## Last accepted objective";
  const start = current.indexOf(marker);
  if (start < 0) return null;
  const line = current.slice(start + marker.length).split("\n").map((v) => v.trim()).find(Boolean);
  return line?.split(/\s+—\s+|\s+-\s+/)[0]?.trim() || null;
}

function acceptedSection(current: string): string {
  const start = current.indexOf("accepted:");
  if (start < 0) return "";
  const end = current.indexOf("\nblocked:", start);
  return current.slice(start, end < 0 ? current.length : end);
}

function parseHorizon(horizon: string): { currentIndex: number | null; objectives: Array<{id: string; status: string}> } {
  const index = Number(yamlValue(horizon, "current_index"));
  const objectives: Array<{id: string; status: string}> = [];
  const lines = horizon.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const id = lines[i]?.match(/^\s*- id:\s*([^\s#]+)\s*$/)?.[1];
    if (!id) continue;
    let status = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      const sm = lines[j]?.match(/^\s+status:\s*([^\s#]+)\s*$/);
      if (sm) { status = sm[1] ?? ""; break; }
      if (/^\s*- id:/.test(lines[j] ?? "")) break;
    }
    objectives.push({ id, status });
  }
  return { currentIndex: Number.isFinite(index) ? index : null, objectives };
}

async function acceptanceRecords(repoRoot: string): Promise<Array<Record<string, unknown>>> {
  const root = path.join(repoRoot, "gauntlet/evals/results");
  const records: Array<Record<string, unknown>> = [];
  let days: string[] = [];
  try { days = await readdir(root); } catch { return records; }
  for (const day of days) {
    const dir = path.join(root, day);
    let files: string[] = [];
    try { files = await readdir(dir); } catch { continue; }
    for (const file of files.filter((f) => f.endsWith("-acceptance.json"))) {
      try { records.push(JSON.parse(await readFile(path.join(dir, file), "utf8")) as Record<string, unknown>); } catch { /* malformed record is handled elsewhere */ }
    }
  }
  return records;
}

function rowContains(sectionText: string, objective: string): boolean {
  return sectionText.split("\n").some((line) => line.trimStart().startsWith(`| ${objective} |`));
}

function section(content: string, heading: string, nextHeadingPrefix: string): string {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const after = start + heading.length;
  const next = content.indexOf(`\n${nextHeadingPrefix}`, after);
  return content.slice(after, next < 0 ? content.length : next);
}

export async function runStateChecks(repoRoot: string): Promise<{ objective: string | null; checks: StateCheck[] }> {
  const [current, horizon, timing] = await Promise.all([
    readFile(path.join(repoRoot, "gauntlet/state/CURRENT.md"), "utf8"),
    readFile(path.join(repoRoot, "gauntlet/state/HORIZON.md"), "utf8"),
    readFile(path.join(repoRoot, "gauntlet/state/TIMING.md"), "utf8"),
  ]);
  const objective = latestAcceptedObjective(current);
  const checks: StateCheck[] = [];
  if (!objective) return { objective, checks: [{ name: "latest accepted objective is parseable", pass: false, detail: "CURRENT.md has no Last accepted objective", owner: "orchestrator" }] };

  checks.push({ name: "CURRENT accepted list contains latest accepted", pass: acceptedSection(current).includes(objective), detail: acceptedSection(current).includes(objective) ? undefined : `${objective} missing from CURRENT.accepted`, owner: "orchestrator" });

  const parsed = parseHorizon(horizon);
  const firstPending = parsed.objectives.findIndex((o) => o.status === "pending");
  const expectedIndex = firstPending < 0 ? parsed.objectives.length : firstPending;
  checks.push({ name: "HORIZON current_index matches first pending", pass: parsed.currentIndex === expectedIndex, detail: parsed.currentIndex === expectedIndex ? undefined : `expected ${expectedIndex}, found ${parsed.currentIndex}`, owner: "orchestrator" });
  const inHorizon = parsed.objectives.find((o) => o.id === objective);
  checks.push({ name: "latest accepted horizon entry is not pending", pass: !inHorizon || inHorizon.status === "accepted", detail: !inHorizon || inHorizon.status === "accepted" ? undefined : `${objective} is ${inHorizon.status}`, owner: "orchestrator" });
  const nextObjective = yamlValue(current, "next_objective_id");
  const indexed = parsed.currentIndex !== null ? parsed.objectives[parsed.currentIndex]?.id ?? null : null;
  checks.push({ name: "CURRENT next objective matches HORIZON index", pass: nextObjective === indexed || (indexed === null && nextObjective === null), detail: nextObjective === indexed || (indexed === null && nextObjective === null) ? undefined : `CURRENT=${nextObjective}, HORIZON=${indexed}`, owner: "orchestrator" });

  const markerKeys = ["last_tracked_objective", "usage_aggregates_through", "model_evaluation_through"];
  for (const key of markerKeys) {
    const value = yamlValue(timing, key);
    checks.push({ name: `${key} matches latest accepted`, pass: value === objective, detail: value === objective ? undefined : `expected ${objective}, found ${value ?? "missing"}`, owner: "orchestrator" });
  }
  const usage = section(timing, "## Per-step time and tokens", "## ");
  const grades = section(timing, "### Per-objective grade", "### ");
  const routes = section(timing, "### Reviewer route and catches", "### ");
  checks.push({ name: "TIMING latest per-step row exists", pass: rowContains(usage, objective), detail: rowContains(usage, objective) ? undefined : `${objective} missing from per-step table`, owner: "orchestrator" });
  checks.push({ name: "TIMING latest builder grade exists", pass: rowContains(grades, objective), detail: rowContains(grades, objective) ? undefined : `${objective} missing from grade table`, owner: "orchestrator" });
  checks.push({ name: "TIMING latest reviewer route exists", pass: rowContains(routes, objective), detail: rowContains(routes, objective) ? undefined : `${objective} missing from reviewer table`, owner: "orchestrator" });

  const measuredAt = yamlValue(timing, "measured_at");
  const clockMatch = timing.match(/Measurement:\s*`?(\d{4}-\d{2}-\d{2})/);
  if (measuredAt && clockMatch?.[1]) {
    checks.push({ name: "TIMING clock measurement date matches measured_at", pass: measuredAt.slice(0, 10) === clockMatch[1], detail: measuredAt.slice(0, 10) === clockMatch[1] ? undefined : `measured_at=${measuredAt}, clock=${clockMatch[1]}`, owner: "orchestrator" });
  }

  const records = await acceptanceRecords(repoRoot);
  const v07 = records.filter((r) => r.gauntlet_version === "0.7.0");
  const hasLatest = v07.some((r) => r.objective_id === objective);
  checks.push({ name: "v0.7 acceptance result freshness", pass: v07.length === 0 || hasLatest, detail: v07.length === 0 || hasLatest ? (v07.length === 0 ? "legacy baseline: no v0.7 acceptance records yet" : undefined) : `${objective} has no v0.7 acceptance record`, owner: "orchestrator" });

  return { objective, checks };
}
