import { requireMilestoneCertificate } from "../../runtime/certification.js";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MilestonePlaytestGateScenario, MilestoneSituationOutcome } from "../contracts/scenario.js";
import { evaluateMilestonePlaytest } from "./evaluate-state.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const next = process.argv[i + 1];
  if (key?.startsWith("--") && next && !next.startsWith("--")) {
    args.set(key.slice(2), next);
    i += 1;
  }
}

const milestone = args.get("milestone");
const inputPath = args.get("input");
if (!milestone || !inputPath) {
  console.error("usage: pnpm run gauntlet:milestone:evaluate -- --milestone <id> --target <certified-sha> --input <json>");
  process.exit(2);
}

const version = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/VERSION.json"), "utf8")).version;
let certificationTarget: string | null = null;
if (Number(version.split(".")[1]) >= 12) {
  const target = args.get("target");
  if (!target) throw new Error("--target required: bind the milestone to a certified repository revision");
  certificationTarget = execFileSync("git",["rev-parse",`${target}^{commit}`],{cwd:repoRoot,encoding:"utf8"}).trim();
  requireMilestoneCertificate(repoRoot, certificationTarget);
}

const safeMilestone = milestone.replace(/[^A-Za-z0-9_-]/g, "_");
const planPath = path.join(repoRoot, "gauntlet/playtests", `${safeMilestone}.json`);
const plan = JSON.parse(await readFile(planPath, "utf8")) as { required_situations?: string[]; playtest_plan_version?: string };
const input = JSON.parse(await readFile(path.resolve(repoRoot, inputPath), "utf8")) as {
  entry_prerequisites_pass?: boolean;
  exit_prerequisites_pass?: boolean;
  situation_outcomes?: Record<string, MilestoneSituationOutcome>;
  critic_verdict?: "ACCEPT" | "RETRY" | "REJECT" | "MISSING";
  evidence?: Record<string, unknown>;
};

if (certificationTarget && input.evidence?.target_commit !== certificationTarget) throw new Error("Playtest evidence must name the exact certified target_commit");
const scenario: MilestonePlaytestGateScenario = {
  id: `MILESTONE-${milestone}`,
  kind: "milestone_playtest_gate",
  input: {
    milestone_id: milestone,
    entry_prerequisites_pass: input.entry_prerequisites_pass === true,
    exit_prerequisites_pass: input.exit_prerequisites_pass === true,
    required_situations: plan.required_situations ?? [],
    situation_outcomes: input.situation_outcomes ?? {},
    critic_verdict: input.critic_verdict ?? "MISSING",
  },
  expect: { decision: "runtime" },
};

const result = evaluateMilestonePlaytest(scenario);
const generatedAt = new Date().toISOString();
const runId = generatedAt.replace(/[:.]/g, "-");
const outDir = path.join(repoRoot, "docs/evidence/milestones", safeMilestone, "playtests");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${runId}.json`);
const output = {
  schema_version: 1,
  certification_target: certificationTarget,
  record_type: "milestone_playtest_result",
  milestone_id: milestone,
  playtest_plan_version: plan.playtest_plan_version ?? null,
  generated_at: generatedAt,
  required_situations: scenario.input.required_situations,
  situation_outcomes: scenario.input.situation_outcomes,
  entry_prerequisites_pass: scenario.input.entry_prerequisites_pass,
  exit_prerequisites_pass: scenario.input.exit_prerequisites_pass,
  critic_verdict: scenario.input.critic_verdict,
  evidence: input.evidence ?? {},
  decision: result.decision,
  milestone_verdict: result.milestone_verdict ?? "NOT_EVALUATED",
  failure_class: result.failure_class ?? null,
};
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(outPath);
if (output.milestone_verdict !== "PASS") process.exitCode = 1;
