import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GauntletIncident } from "../contracts/incident.js";

export async function writeIncident(repoRoot: string, incident: GauntletIncident): Promise<string> {
  const dir = path.join(repoRoot, "gauntlet/evals/artifacts/incidents");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${incident.incident_id}.json`);
  await writeFile(file, `${JSON.stringify(incident, null, 2)}\n`, "utf8");
  return path.relative(repoRoot, file);
}
