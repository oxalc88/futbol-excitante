import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key?.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) { args.set(key.slice(2), next); i += 1; }
}
const milestone = args.get("milestone");
const objectiveList = (args.get("objectives") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (!milestone || objectiveList.length === 0) {
  console.error("usage: pnpm run gauntlet:milestone:bundle -- --milestone <id> --objectives OBJ1,OBJ2");
  process.exit(2);
}
const safeMilestone = milestone.replace(/[^A-Za-z0-9_-]/g, "_");
const outDir = path.join(repoRoot, "docs/evidence/milestones", safeMilestone);
await mkdir(outDir, { recursive: true });

const sources: Array<Record<string, unknown>> = [];
for (const objective of objectiveList) {
  const manifestPath = path.join(repoRoot, "docs/evidence", objective, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as any;
  if (manifest.objective_id !== objective) throw new Error(`manifest objective mismatch for ${objective}`);
  const copied: string[] = [];
  const screenshot = manifest.evidence?.screenshots?.[0]?.path as string | undefined;
  const sequencePath = manifest.evidence?.semantic_sequence?.artifact?.path as string | undefined;
  const trajectoryPath = manifest.evidence?.trajectory?.path as string | undefined;
  const videoPath = manifest.evidence?.video?.artifact?.path as string | undefined;
  for (const [kind, sourcePath] of [["screenshot", screenshot], ["sequence", sequencePath], ["trajectory", trajectoryPath], ["video-reference", videoPath]] as const) {
    if (!sourcePath) continue;
    const extension = path.extname(sourcePath) || ".json";
    const targetName = `${objective}-${kind}${extension}`;
    await copyFile(path.join(repoRoot, sourcePath), path.join(outDir, targetName));
    copied.push(targetName);
  }
  sources.push({
    objective_id: objective,
    candidate_commit: manifest.candidate_commit,
    accepted_at: manifest.accepted_at,
    source_manifest: path.relative(repoRoot, manifestPath).replaceAll(path.sep, "/"),
    copied,
    metrics: manifest.evidence?.metrics ?? [],
  });
}

const bundle = {
  schema_version: 1,
  milestone_id: milestone,
  generated_at: new Date().toISOString(),
  source_objectives: sources,
  preservation_policy: "source objective evidence is immutable; bundle files are derived copies",
};
const manifestOut = path.join(outDir, "manifest.json");
await writeFile(manifestOut, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(manifestOut);
