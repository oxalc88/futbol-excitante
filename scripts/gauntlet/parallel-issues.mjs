import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PARALLEL_STATES,
  classifyObjectives,
  issueBody,
  issueTitle,
  objectiveMarker,
  validateParallelPlan,
} from "./parallel-policy.mjs";

const STATE_LABELS = {
  READY: "gauntlet:ready",
  BLOCKED: "gauntlet:blocked",
  IN_PROGRESS: "gauntlet:in-progress",
  REVIEW: "gauntlet:review",
  ACCEPTED: "gauntlet:accepted",
};
const ALL_STATE_LABELS = Object.values(STATE_LABELS);
const DEFAULT_ADMISSION = "artifacts/gauntlet/parallel-admission.json";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gh(args, { allowFailure = false } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`gh ${args.join(" ")} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[0] ?? "status",
    plan: null,
    objective: null,
    state: null,
    admission: DEFAULT_ADMISSION,
    dryRun: false,
  };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--plan") args.plan = argv[++i];
    else if (arg === "--objective") args.objective = argv[++i];
    else if (arg === "--state") args.state = argv[++i];
    else if (arg === "--admission") args.admission = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function writeJson(path, value) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function repoName() {
  return gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).stdout;
}

function ensureAuth() {
  const auth = gh(["auth", "status"], { allowFailure: true });
  if (auth.status !== 0) {
    throw new Error("GitHub write capability is unavailable. Run gh auth login, or use sequential execution.");
  }
}

function ensureLabels(repo) {
  const labels = [
    ["gauntlet:ready", "1f883d", "Gauntlet objective admitted for parallel execution"],
    ["gauntlet:blocked", "d73a4a", "Gauntlet objective blocked from execution"],
    ["gauntlet:in-progress", "fbca04", "Gauntlet objective is being implemented"],
    ["gauntlet:review", "0e8a16", "Gauntlet objective is under review"],
    ["gauntlet:accepted", "8250df", "Gauntlet objective is canonically accepted"],
  ];
  for (const [name, color, description] of labels) {
    gh(["label", "create", name, "--repo", repo, "--color", color, "--description", description, "--force"]);
  }
}

function listIssues(repo) {
  const raw = gh([
    "issue", "list",
    "--repo", repo,
    "--state", "all",
    "--limit", "500",
    "--json", "number,title,body,state,labels,url",
  ]).stdout;
  return raw ? JSON.parse(raw) : [];
}

function findIssue(issues, objectiveId) {
  const marker = objectiveMarker(objectiveId);
  return issues.find((issue) => typeof issue.body === "string" && issue.body.includes(marker));
}

function stateLabelNames(issue) {
  return (issue?.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter(Boolean);
}

function setStateLabel(repo, issue, state) {
  const current = new Set(stateLabelNames(issue));
  for (const label of ALL_STATE_LABELS) {
    if (label !== STATE_LABELS[state] && current.has(label)) {
      gh(["issue", "edit", String(issue.number), "--repo", repo, "--remove-label", label]);
    }
  }
  if (!current.has(STATE_LABELS[state])) {
    gh(["issue", "edit", String(issue.number), "--repo", repo, "--add-label", STATE_LABELS[state]]);
  }
}

function syncPlan(plan, admissionPath, dryRun) {
  validateParallelPlan(plan);
  const classified = classifyObjectives(plan);

  if (dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", objectives: classified }, null, 2));
    return;
  }

  ensureAuth();
  const repo = repoName();
  ensureLabels(repo);
  let issues = listIssues(repo);
  const synced = [];

  for (const objective of classified) {
    const title = issueTitle(objective);
    const body = issueBody(objective, plan.horizon_id);
    let issue = findIssue(issues, objective.objective_id);

    if (!issue) {
      const url = gh([
        "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body", body,
        "--label", STATE_LABELS[objective.execution_state],
      ]).stdout;
      const number = Number(url.split("/").at(-1));
      issue = {
        number,
        title,
        body,
        state: "OPEN",
        labels: [{ name: STATE_LABELS[objective.execution_state] }],
        url,
      };
      issues.push(issue);
    } else {
      if (issue.state === "CLOSED" && objective.execution_state !== "ACCEPTED") {
        gh(["issue", "reopen", String(issue.number), "--repo", repo]);
      }
      gh([
        "issue", "edit", String(issue.number),
        "--repo", repo,
        "--title", title,
        "--body", body,
      ]);
      setStateLabel(repo, issue, objective.execution_state);
    }

    synced.push({
      objective_id: objective.objective_id,
      issue_number: issue.number,
      issue_url: issue.url,
      execution_state: objective.execution_state,
      blockers: objective.blockers,
      gauntlet_role: objective.gauntlet_role,
      expected_file_ownership: objective.expected_file_ownership,
    });
  }

  const ready = synced.filter((item) => item.execution_state === "READY");
  const admission = {
    schema_version: "gauntlet-parallel-admission-v1",
    repository: repo,
    horizon_id: plan.horizon_id ?? null,
    plan_sha256: hash(plan),
    max_parallel_implementation_workers: 5,
    nan_max_in_flight_requests: 6,
    accepted_objectives: [...new Set(plan.accepted_objectives ?? [])],
    objectives: synced,
    ready_objectives: ready.map((item) => item.objective_id),
    blocked_objectives: synced.filter((item) => item.execution_state === "BLOCKED").map((item) => item.objective_id),
    parallel_ready: ready.length >= 2,
    plan,
  };
  writeJson(admissionPath, admission);
  console.log(JSON.stringify(admission, null, 2));
}

function updateState(admissionPath, objectiveId, state) {
  if (!PARALLEL_STATES.includes(state)) throw new Error(`invalid state: ${state}`);
  if (!existsSync(resolve(admissionPath))) throw new Error(`missing admission file: ${admissionPath}`);

  const admission = readJson(admissionPath);
  const entry = admission.objectives.find((item) => item.objective_id === objectiveId);
  if (!entry) throw new Error(`objective not found in admission file: ${objectiveId}`);

  ensureAuth();
  const repo = admission.repository || repoName();
  const issues = listIssues(repo);
  const issue = issues.find((candidate) => candidate.number === entry.issue_number);
  if (!issue) throw new Error(`GitHub issue #${entry.issue_number} not found`);

  setStateLabel(repo, issue, state);
  entry.execution_state = state;
  const planObjective = admission.plan?.objectives?.find((item) => item.objective_id === objectiveId);
  if (planObjective) {
    const bodyObjective = {
      ...planObjective,
      execution_state: state,
      blockers: entry.blockers ?? [],
    };
    gh([
      "issue", "edit", String(issue.number),
      "--repo", repo,
      "--body", issueBody(bodyObjective, admission.horizon_id),
    ]);
  }
  admission.ready_objectives = admission.objectives.filter((item) => item.execution_state === "READY").map((item) => item.objective_id);
  admission.blocked_objectives = admission.objectives.filter((item) => item.execution_state === "BLOCKED").map((item) => item.objective_id);
  admission.parallel_ready = admission.ready_objectives.length >= 2;
  writeJson(admissionPath, admission);
  console.log(`${objectiveId} -> ${state} (#${entry.issue_number})`);
}

function completeObjective(admissionPath, objectiveId) {
  if (!existsSync(resolve(admissionPath))) throw new Error(`missing admission file: ${admissionPath}`);
  const admission = readJson(admissionPath);
  const entry = admission.objectives.find((item) => item.objective_id === objectiveId);
  if (!entry) throw new Error(`objective not found in admission file: ${objectiveId}`);

  ensureAuth();
  const repo = admission.repository || repoName();
  const issues = listIssues(repo);
  const issue = issues.find((candidate) => candidate.number === entry.issue_number);
  if (!issue) throw new Error(`GitHub issue #${entry.issue_number} not found`);

  setStateLabel(repo, issue, "ACCEPTED");
  gh([
    "issue", "close", String(entry.issue_number),
    "--repo", repo,
    "--comment", "Canonical Gauntlet acceptance is persisted and remotely durable.",
  ]);

  const plan = admission.plan;
  if (!plan) {
    entry.execution_state = "ACCEPTED";
    writeJson(admissionPath, admission);
    console.log(`${objectiveId} -> ACCEPTED (#${entry.issue_number})`);
    return;
  }

  plan.accepted_objectives = [...new Set([...(plan.accepted_objectives ?? []), objectiveId])];
  syncPlan(plan, admissionPath, false);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "sync") {
    if (!args.plan) fail("usage: parallel-issues.mjs sync --plan <file> [--admission <file>] [--dry-run]");
    syncPlan(readJson(args.plan), args.admission, args.dryRun);
  } else if (args.command === "state") {
    if (!args.objective || !args.state) fail("usage: parallel-issues.mjs state --objective <id> --state <state>");
    updateState(args.admission, args.objective, args.state.toUpperCase());
  } else if (args.command === "complete") {
    if (!args.objective) fail("usage: parallel-issues.mjs complete --objective <id>");
    completeObjective(args.admission, args.objective);
  } else if (args.command === "status") {
    if (!existsSync(resolve(args.admission))) fail(`missing admission file: ${args.admission}`);
    process.stdout.write(readFileSync(resolve(args.admission), "utf8"));
  } else {
    fail(`unknown command: ${args.command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
