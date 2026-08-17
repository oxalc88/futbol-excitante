import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
const manifestOut = path.join(outDir, "manifest.json");
await mkdir(outDir, { recursive: true });
try {
  await access(manifestOut);
  throw new Error(`milestone bundle already exists: ${path.relative(repoRoot, manifestOut)}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const situationsRegistryPath = path.join(repoRoot, "gauntlet/gameplay-situations.json");
const situationsRegistry = JSON.parse(await readFile(situationsRegistryPath, "utf8")) as {
  registry_version?: string;
  situations?: Array<{ situation_id: string; first_testable_milestone?: string | null; integrated_playtest_milestone?: string | null; [key: string]: unknown }>;
};
const applicableSituations = (situationsRegistry.situations ?? []).filter((s) =>
  s.first_testable_milestone === milestone || s.integrated_playtest_milestone === milestone,
);

const playtestPlanPath = path.join(repoRoot, "gauntlet/playtests", `${safeMilestone}.json`);
let playtestPlan: Record<string, unknown> | null = null;
try { playtestPlan = JSON.parse(await readFile(playtestPlanPath, "utf8")) as Record<string, unknown>; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

const playtestResultPath = path.join(outDir, "playtest-result.json");
let playtestResult: Record<string, unknown> | null = null;
try { playtestResult = JSON.parse(await readFile(playtestResultPath, "utf8")) as Record<string, unknown>; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

const sources: Array<Record<string, unknown>> = [];
for (const objective of objectiveList) {
  const manifestPath = path.join(repoRoot, "docs/evidence", objective, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as any;
  if (manifest.objective_id !== objective) throw new Error(`manifest objective mismatch for ${objective}`);

  const copied: Array<{ kind: string; source: string; target: string }> = [];
  const artifacts: Array<[string, string]> = [];
  const screenshots = (manifest.evidence?.screenshots ?? []) as Array<{ path?: string }>;
  screenshots.forEach((shot, index) => { if (shot.path) artifacts.push([`screenshot-${index + 1}`, shot.path]); });
  const sequencePath = manifest.evidence?.semantic_sequence?.artifact?.path as string | undefined;
  const trajectoryPath = manifest.evidence?.trajectory?.path as string | undefined;
  const auditPath = manifest.evidence?.deterministic_audit_artifact?.path as string | undefined;
  const videoPath = manifest.evidence?.video?.artifact?.path as string | undefined;
  if (sequencePath) artifacts.push(["sequence", sequencePath]);
  if (trajectoryPath) artifacts.push(["trajectory", trajectoryPath]);
  if (auditPath) artifacts.push(["audit", auditPath]);
  if (videoPath) artifacts.push(["video-reference", videoPath]);

  for (const [kind, sourcePath] of artifacts) {
    const extension = path.extname(sourcePath) || ".json";
    const targetName = `${objective}-${kind}${extension}`;
    await copyFile(path.join(repoRoot, sourcePath), path.join(outDir, targetName));
    copied.push({ kind, source: sourcePath, target: targetName });
  }

  sources.push({
    objective_id: objective,
    candidate_commit: manifest.candidate_commit,
    accepted_at: manifest.accepted_at,
    evidence_class: manifest.evidence_class,
    source_manifest: path.relative(repoRoot, manifestPath).replaceAll(path.sep, "/"),
    copied,
    metrics: manifest.evidence?.metrics ?? [],
    reviews: manifest.reviews ?? null,
  });
}

const bundle = {
  schema_version: 2,
  record_type: "milestone_evidence_bundle",
  milestone_id: milestone,
  generated_at: new Date().toISOString(),
  gameplay_situation_registry_version: situationsRegistry.registry_version ?? null,
  applicable_gameplay_situations: applicableSituations,
  playtest_plan: playtestPlan,
  playtest_result: playtestResult,
  source_objectives: sources,
  preservation_policy: "source objective evidence is immutable; bundle files are derived copies and this bundle is write-once",
};
await writeFile(manifestOut, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(manifestOut);
