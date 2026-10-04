import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PromptGateResult { name: string; pass: boolean; detail?: string }
interface GateRule { name: string; file: string; mustContain: string[] }

const RULES: GateRule[] = [
  { name: "quality failures stop and require focused repair", file: "gauntlet/product-quality-contract.md", mustContain: ["stops after the first failed check", "NOT_RUN", "After two identical failures", "REPAIR_PASS", "Equivalent complete PASS checks may be reused", "Only the complete required-plan PASS permits candidate persistence"] },
  { name: "quality recovery is canonical across harnesses", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet:quality --repair", "Do not repeatedly rerun the full battery", "always on in OMP, Grok and OpenCode"] },
  { name: "OMP consumes quality recovery", file: ".omp/skills/gauntlet/SKILL.md", mustContain: ["focused repair flow", "REPAIR_PASS", "Do not repeat the full battery"] },
  { name: "OpenCode consumes quality recovery", file: ".opencode/commands/gauntlet.md", mustContain: ["focused repair flow", "REPAIR_PASS", "Do not repeat the full battery"] },
  { name: "OMP announces the installed Gauntlet version at startup", file: ".omp/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/VERSION.json", "Before any other status prose or delegation", "Gauntlet <version> · <agent-or-role> · <model>", "active session model", "report `unknown`", "when the skill starts or resumes work"] },
  { name: "Horizon success requires normal play and better product outcome", file: "gauntlet/PROMPT.md", mustContain: ["Product outcome is the canonical Horizon success criterion", "normal-play comparison", "ITERATE", "gauntlet:trajectory"] },
  { name: "impact assurance is deterministic and conservative", file: "gauntlet/product-quality-contract.md", mustContain: ["Both critic and integration review are mandatory", "Ambiguous impact runs both", "candidate's actual parent", "source hashes", "NOT_REQUIRED"] },
  { name: "trajectory preserves unavailable and harness-specific measurement", file: "gauntlet/trajectory-contract.md", mustContain: ["UNAVAILABLE", "null, never zero", "Grok cache is a subset", "OMP normalized cache buckets", "append", "Internal objective acceptance alone"] },
  { name: "canonical principles exist", file: "gauntlet/principles.md", mustContain: ["Deterministic audits may invalidate evidence or state", "Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar.", "Provider, transport, quota, authentication, and harness failures are non-progress events", "gauntlet/provider-failure-contract.md"] },
  { name: "provider failures cannot masquerade as completed inference", file: "gauntlet/provider-failure-contract.md", mustContain: ["A completed CLI turn is not sufficient evidence of a successful inference", "HTTP 403: System error, please try again later.", "TRANSIENT_PROVIDER_FAILURE", "bounded exponential backoff with jitter", "maximum attempts: 5", "no state advancement", "same objective resumes"] },
  { name: "provider failure retry policy stays bounded", file: "gauntlet/provider-failure-contract.md", mustContain: ["base delays: 2s, 5s, 10s, 20s, 40s", "jitter: +/- 20%", "Never spin indefinitely", "Do not classify every 403 as transient"] },
  { name: "model capability mismatch is explicit", file: "gauntlet/model-capability-contract.md", mustContain: ["MODEL_CAPABILITY_MISMATCH", "No endpoints found that support image input.", "preserve the same objective and exact pipeline step", "explicitly compatible independent fallback route"] },
  { name: "main gauntlet entrypoint requires explicit allowed stop reason", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["`allowed_stop_reason`", "Tests passing", "execute that action instead of stopping"] },
  { name: "continue entrypoint requires explicit allowed stop reason", file: ".grok/skills/gauntlet-continue/SKILL.md", mustContain: ["`allowed_stop_reason`", "Tests passing", "execute that action instead of stopping"] },
  { name: "glm continue entrypoint requires explicit allowed stop reason", file: ".grok/skills/gcont/SKILL.md", mustContain: ["`allowed_stop_reason`", "Tests passing", "execute that action instead of stopping"] },
  { name: "normal test capture is isolated from durable evidence", file: "package.json", mustContain: ["GAUNTLET_EVIDENCE_CAPTURE=1", "__EVIDENCE__:", "gauntlet:candidate-scope"] },
  { name: "routine eval results are ephemeral by default", file: "gauntlet/evals/src/write-result.ts", mustContain: ["GAUNTLET_EVAL_DURABLE", "test-results/gauntlet-evals", "gauntlet/evals/results"] },
  { name: "acceptance persistence rejects blank screenshots", file: "gauntlet/evals/src/persist-acceptance.ts", mustContain: ["assertScreenshotSanity", "manifestEvidence?.screenshots"] },
  { name: "candidate snapshot has mechanical scope gate", file: ".grok/agents/git-committer.md", mustContain: ["gauntlet:candidate-scope", "expected candidate scope", "docs/screenshots/capture"] },
  { name: "full suite checks worktree and accepted evidence hygiene", file: "scripts/ci/run-validation.mjs", mustContain: ["FULL-SUITE-WORKTREE-HYGIENE", "ACCEPTED-EVIDENCE-IMMUTABLE", "preexisting dirty content/status changed during suite"] },
  { name: "main gauntlet entrypoint uses deterministic impact-required pipeline", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "The critic is mandatory", "gauntlet:quality", "NOT_REQUIRED", "Unknown impact requires both reviews", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "acceptance is durable before claim", file: "gauntlet/PROMPT.md", mustContain: ["manifest.json", "fully accepted", "candidate commit", "Horizon exhaustion triggers strategic reassessment"] },
  { name: "accepted objectives are remotely durable before continuation", file: "gauntlet/PROMPT.md", mustContain: ["acceptance publication mode", "verify the exact final acceptance commit is contained in the remote branch", "Do not delegate or replan past an accepted objective until remote durability is verified"] },
  { name: "replanned horizon delegates without confirmation", file: "gauntlet/PROMPT.md", mustContain: ["delegate it immediately without asking the human for confirmation", "proceed to delegation without asking whether to continue"] },
  { name: "product-first horizon policy is explicit", file: "gauntlet/PROMPT.md", mustContain: ["1–4 objectives", "one player-visible product outcome", "not product-complete", "gauntlet/product-flow-contract.md"] },
  { name: "parallel objective policy is issue-gated", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/parallel-issue-contract.md", "GitHub issues are optional for sequential execution", "Only synchronized `READY` issues may start parallel implementation workers", "gauntlet:parallel:sync", "If issue synchronization cannot complete, serialize the work"] },
  { name: "parallel issue contract cannot regress", file: "gauntlet/parallel-issue-contract.md", mustContain: ["Sequential execution", "Parallel execution", "READY", "BLOCKED", "expected file ownership", "No synchronized `READY` issue means no parallel implementation worker", "GitHub write capability", "five implementation workers", "six NaN requests in flight"] },
  { name: "milestone playtests cannot be inferred from horizon completion", file: "gauntlet/PROMPT.md", mustContain: ["not a milestone verdict", "gauntlet/milestone-playtest-contract.md", "gauntlet/gameplay-situations.json", "gauntlet:milestone:evaluate", "existing independent critic"] },
  { name: "repo-first observability is canonical", file: "gauntlet/observability-contract.md", mustContain: ["repository-first", "no parallel hidden progress database", "read-only", "Remote durability", "gauntlet-regressions"] },
  { name: "regression inbox remains deterministic and non-authoritative", file: "gauntlet/regression-inbox-contract.md", mustContain: ["Agents do not decide whether a regression exists", "gauntlet-regressions", "same OPEN signature -> no write", "Never edit, commit, or mark inbox records RESOLVED", "No LLM or critic participates in this classification"] },
  { name: "gauntlet entrypoints consume regression inbox", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/regression-inbox-contract.md", "origin/gauntlet-regressions", "Never edit or resolve the inbox yourself"] },
  { name: "role-based builder routing is canonical", file: "gauntlet/PROMPT.md", mustContain: ["builder-structured", "builder-gameplay", "Choose the implementation role by responsibility, not by provider/model"] },
  { name: "main skill cannot bypass critic", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "Critic ACCEPT alone is never final", "acceptance publication", "remote containment verification", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "continue skill cannot bypass critic", file: ".grok/skills/gauntlet-continue/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "critic remains mandatory", "remote containment verification", "gauntlet:milestone:evaluate", "immediately delegate its executable next objective", "GAUNTLET_ACCEPTANCE_JSON", "origin/gauntlet-regressions"] },
  { name: "glm continue skill cannot bypass critic", file: ".grok/skills/gcont/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "critic remains mandatory", "remote containment verification", "gauntlet:milestone:evaluate", "immediately delegate its executable next objective", "GAUNTLET_ACCEPTANCE_JSON", "origin/gauntlet-regressions"] },
  { name: "class-based evidence contract cannot regress", file: "gauntlet/evidence-contract.md", mustContain: ["`HEADLESS`", "`BROWSER_VISIBLE`", "`MULTI_TICK`", "`DYNAMIC_VISUAL`", "3–5 semantic frames", "temporal and browser-visible", "centered on that event", "`PRESENTATION`", "`BOOKKEEPING`", "manifest.json", "The critic is mandatory"] },
  { name: "evidence manifest contract exists", file: "gauntlet/evidence-manifest-contract.md", mustContain: ["candidate_commit", "sha256", "sequence.json", "video-reference.json", "milestones", "never silently overwritten"] },
  { name: "semantic audit is bounded and cannot accept", file: "gauntlet/semantic-audit-contract.md", mustContain: ["VALID|INVALID|INSUFFICIENT_CONTEXT", "can never produce objective `ACCEPT`"] },
  { name: "semver system version is declared", file: "gauntlet/VERSION.json", mustContain: ["\"version\": \"0.12.0\"", "\"previous_system_version\": \"0.11.3\"", "\"semver\": true", "provider-failure-resilience", "orchestration-continuity", "evidence-immutability", "worktree-hygiene", "model-capability-routing", "timing-aggregate-consistency", "routing-wrapper-consistency", "equivalent-orchestrator-continuation", "product-first-planning", "parallel-issue-sync", "issue-gated-parallelism", "omp-concurrency-guard"] },
  { name: "reviewer fallback remains explicit", file: "gauntlet/models.json", mustContain: ["gauntlet-models-v9", "critic-qwen", "critic-mimo", "integration-reviewer-qwen", "integration-reviewer-mimo", "mimo-v2.6-flash"] },
  { name: "OpenCode delegates canonical roles and committer", file: ".opencode/agents/orchestrator.md", mustContain: ["\"builder-structured\": allow", "\"builder-gameplay\": allow", "\"git-committer\": allow", "gauntlet/PROMPT.md"] },
  { name: "harness routing is explicit", file: "gauntlet/models.json", mustContain: ["harness_routes", "\"grok\"", "\"omp\"", "\"opencode\"", "harness-contract.md"] },
  { name: "omp adapter is product-local and role-routed", file: ".omp/config.yml", mustContain: ["modelRoleStorage: project", "gauntlet-orchestrator", "nan/glm5.3-flash", "gauntlet-builder-structured", "gauntlet-builder-gameplay", "gauntlet-critic: nan/mimo-v2.6-flash", "gauntlet-critic-glm: nan/glm5.3-flash", "gauntlet-integration", "maxConcurrency: 5", "maxRecursionDepth: 1", "maxInFlightRequests:", "nan: 6", "mode: auto", "enabled: false"] },
  { name: "omp parallel issue gate is mechanical", file: ".omp/hooks/pre/gauntlet-parallel-issue-gate.js", mustContain: ["MAX_IMPLEMENTATION_WORKERS = 5", "gauntlet-parallel-admission-v1", "synchronized READY GitHub issue", "isolated=true", "tool_call"] },
  { name: "omp gauntlet skill requires issue admission", file: ".omp/skills/gauntlet/SKILL.md", mustContain: ["gauntlet:parallel:sync", "parallel-admission.json", "isolated: true", "five implementation workers"] },
  { name: "parallel issue scripts are available", file: "package.json", mustContain: ["gauntlet:parallel:sync", "gauntlet:parallel:state", "gauntlet:parallel:complete", "gauntlet:parallel:test"] },
  { name: "review pipeline uses capability contract", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/model-capability-contract.md", "configured `critic` route and fallbacks from `gauntlet/models.json`", "configured independent `integration-reviewer` route and fallbacks from `gauntlet/models.json`"] },
];

RULES.push(
  { name: "scoped progress cannot replace certification", file: "gauntlet/product-quality-contract.md", mustContain: ["four objectives", "PRODUCT_FAILURE", "HARNESS_ENVIRONMENT", "UNKNOWN", "exact played target", "state audit always executes fresh", "intervening unaccepted source changes", "--stage certification"] },
  { name: "shared recovery stop rule is canonical", file: "gauntlet/product-quality-contract.md", mustContain: ["two canonical repair attempts", "90 minutes", "RECOVERY_BLOCKED", "UNAVAILABLE", "unhandled worker errors", "shared instruction applies automatically"] },
  { name: "canonical prompt stops exhausted recovery", file: "gauntlet/PROMPT.md", mustContain: ["RECOVERY_BLOCKED", "Do not reset the record", "smaller reproductions"] },
  ...[".omp/skills/gauntlet/SKILL.md", ".grok/skills/gauntlet/SKILL.md", ".grok/skills/gauntlet-continue/SKILL.md", ".grok/skills/gcont/SKILL.md", ".opencode/commands/gauntlet.md"].map(file => ({ name: `${file} consumes shared recovery stop rule`, file, mustContain: ["shared recovery budget and stop rule", "RECOVERY_BLOCKED", "Do not reset the recovery record"] })),
);

const WRAPPER_CONTRACTS: Record<string, string> = {
  "orchestrator.md": "gauntlet/PROMPT.md",
  "orchestrator-deepseek.md": "gauntlet/PROMPT.md",
  "orchestrator-glm.md": "gauntlet/PROMPT.md",
  "builder-structured.md": "gauntlet/roles/builder-structured.md",
  "builder-gameplay.md": "gauntlet/roles/builder-gameplay.md",
  "critic.md": "gauntlet/roles/critic.md",
  "critic-qwen.md": "gauntlet/roles/critic.md",
  "critic-mimo.md": "gauntlet/roles/critic.md",
  "integration-reviewer.md": "gauntlet/roles/integration-reviewer.md",
  "integration-reviewer-qwen.md": "gauntlet/roles/integration-reviewer.md",
  "integration-reviewer-mimo.md": "gauntlet/roles/integration-reviewer.md",
};

async function roleWrapperCheck(repoRoot: string): Promise<PromptGateResult> {
  const failures: string[] = [];
  for (const [wrapper, contract] of Object.entries(WRAPPER_CONTRACTS)) {
    try {
      const [wrapperContent] = await Promise.all([
        readFile(path.join(repoRoot, ".grok/agents", wrapper), "utf8"),
        readFile(path.join(repoRoot, contract), "utf8"),
      ]);
      if (!wrapperContent.includes(`\`${contract}\``)) failures.push(`${wrapper} does not reference ${contract}`);
    } catch {
      failures.push(`${wrapper} or ${contract} is missing`);
    }
  }
  return { name: "agent wrappers reference existing canonical role contracts", pass: failures.length === 0, detail: failures.length ? failures.join("; ") : undefined };
}

function frontmatterModel(content: string): string | null { return content.match(/^model:\s*([^\s#]+)\s*$/m)?.[1] ?? null; }

async function modelRoutingCheck(repoRoot: string): Promise<PromptGateResult> {
  const config = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/models.json"), "utf8")) as { roles?: Record<string, { agent?: string; model?: string }> };
  const failures: string[] = [];
  for (const [role, route] of Object.entries(config.roles ?? {})) {
    if (!route.agent || !route.model) continue;
    const agentPath = path.join(repoRoot, ".grok/agents", `${route.agent}.md`);
    try { const model = frontmatterModel(await readFile(agentPath, "utf8")); if (model !== route.model) failures.push(`${role}: models.json=${route.model}, frontmatter=${model ?? "missing"}`); }
    catch { failures.push(`${role}: missing .grok/agents/${route.agent}.md`); }
  }
  return { name: "agent frontmatter models match models.json routing", pass: failures.length === 0, detail: failures.length ? failures.join("; ") : undefined };
}

// opencode.json routes the same roles for the opencode runtime; it must track models.json.
async function opencodeRoutingCheck(repoRoot: string): Promise<PromptGateResult> {
  const failures: string[] = [];
  try {
    const config = JSON.parse(await readFile(path.join(repoRoot, "gauntlet/models.json"), "utf8")) as { roles?: Record<string, { agent?: string; model?: string; provider?: string }> };
    const opencode = JSON.parse(await readFile(path.join(repoRoot, "opencode.json"), "utf8")) as { agent?: Record<string, { model?: string }>; provider?: Record<string, { models?: Record<string, { status?: string }> }> };
    for (const [role, route] of Object.entries(config.roles ?? {})) {
      if (!route.agent || !route.model) continue;
      const expected = `${route.provider ?? "nan"}/${route.model}`;
      const actual = opencode.agent?.[route.agent]?.model;
      try {
        const wrapper = await readFile(path.join(repoRoot, ".opencode/agents", `${route.agent}.md`), "utf8");
        if (frontmatterModel(wrapper) !== expected) failures.push(`${role}: OpenCode wrapper route mismatch`);
        const contract = route.agent.startsWith("orchestrator") ? "gauntlet/PROMPT.md" : route.agent.startsWith("builder-") ? `gauntlet/roles/${route.agent}.md` : route.agent.startsWith("critic") ? "gauntlet/roles/critic.md" : route.agent.startsWith("integration-reviewer") ? "gauntlet/roles/integration-reviewer.md" : null;
        if (contract && !wrapper.includes(contract)) failures.push(`${role}: OpenCode wrapper lacks canonical contract`);
      } catch { failures.push(`${role}: missing OpenCode wrapper`); }
      if (actual !== expected) failures.push(`${role}: models.json=${expected}, opencode.json=${actual ?? "missing"}`);
    }
    const deprecated = new Set(Object.entries(opencode.provider?.nan?.models ?? {}).filter(([, model]) => model.status === "deprecated").map(([id]) => `nan/${id}`));
    for (const [name, agent] of Object.entries(opencode.agent ?? {})) {
      if (agent?.model && deprecated.has(agent.model)) failures.push(`${name} routes to deprecated ${agent.model}`);
    }
  } catch {
    failures.push("opencode.json or gauntlet/models.json is missing");
  }
  return { name: "opencode.json agent routing matches models.json", pass: failures.length === 0, detail: failures.length ? failures.join("; ") : undefined };
}

export async function runPromptGate(repoRoot: string): Promise<PromptGateResult[]> {
  const results: PromptGateResult[] = [];
  for (const rule of RULES) {
    const content = await readFile(path.join(repoRoot, rule.file), "utf8");
    const missing = rule.mustContain.filter((needle) => !content.includes(needle.replace(/\\\"/g, '"')));
    results.push({ name: rule.name, pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined });
  }
  results.push(await roleWrapperCheck(repoRoot));
  results.push(await modelRoutingCheck(repoRoot));
  results.push(await opencodeRoutingCheck(repoRoot));
  return results;
}
