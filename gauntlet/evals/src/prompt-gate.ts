import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PromptGateResult { name: string; pass: boolean; detail?: string }
interface GateRule { name: string; file: string; mustContain: string[] }

const RULES: GateRule[] = [
  { name: "canonical principles exist", file: "gauntlet/principles.md", mustContain: ["Deterministic audits may invalidate evidence or state", "Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar."] },
  { name: "main prompt uses deterministic-first critic-always pipeline", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "The critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "acceptance is durable before claim", file: "gauntlet/PROMPT.md", mustContain: ["manifest.json", "fully accepted", "candidate commit", "Horizon exhaustion triggers strategic reassessment"] },
  { name: "accepted objectives are remotely durable before continuation", file: "gauntlet/PROMPT.md", mustContain: ["acceptance publication mode", "verify the exact final acceptance commit is contained in the remote branch", "Do not delegate or replan past an accepted objective until remote durability is verified"] },
  { name: "replanned horizon delegates without confirmation", file: "gauntlet/PROMPT.md", mustContain: ["delegate it immediately without asking the human for confirmation", "proceed to delegation without asking whether to continue"] },
  { name: "milestone playtests cannot be inferred from horizon completion", file: "gauntlet/PROMPT.md", mustContain: ["not a milestone verdict", "gauntlet/milestone-playtest-contract.md", "gauntlet/gameplay-situations.json", "gauntlet:milestone:evaluate", "existing independent critic"] },
  { name: "repo-first observability is canonical", file: "gauntlet/observability-contract.md", mustContain: ["repository-first", "no parallel hidden progress database", "read-only", "Remote durability"] },
  { name: "role-based builder routing is canonical", file: "gauntlet/PROMPT.md", mustContain: ["builder-structured", "builder-gameplay", "Choose the implementation role by responsibility, not by provider/model"] },
  { name: "main skill cannot bypass critic", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "Critic ACCEPT alone is never final", "acceptance publication", "remote containment verification", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "continue skill cannot bypass critic", file: ".grok/skills/gauntlet-continue/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "critic remains mandatory", "remote containment verification", "gauntlet:milestone:evaluate", "immediately delegate its executable next objective", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "class-based evidence contract cannot regress", file: "gauntlet/evidence-contract.md", mustContain: ["`HEADLESS`", "`BROWSER_VISIBLE`", "`MULTI_TICK`", "`DYNAMIC_VISUAL`", "3–5 semantic frames", "temporal and browser-visible", "centered on that event", "`PRESENTATION`", "`BOOKKEEPING`", "manifest.json", "The critic is mandatory"] },
  { name: "evidence manifest contract exists", file: "gauntlet/evidence-manifest-contract.md", mustContain: ["candidate_commit", "sha256", "sequence.json", "video-reference.json", "milestones", "never silently overwritten"] },
  { name: "semantic audit is bounded and cannot accept", file: "gauntlet/semantic-audit-contract.md", mustContain: ["VALID|INVALID|INSUFFICIENT_CONTEXT", "can never produce objective `ACCEPT`"] },
  { name: "semver system version is declared", file: "gauntlet/VERSION.json", mustContain: ["\"version\": \"0.8.1\"", "\"semver\": true"] },
  { name: "reviewer fallback remains explicit", file: "gauntlet/PROMPT.md", mustContain: ["critic-flash", "integration-reviewer-flash"] },
];

const WRAPPER_CONTRACTS: Record<string, string> = {
  "orchestrator.md": "gauntlet/PROMPT.md",
  "orchestrator-deepseek.md": "gauntlet/PROMPT.md",
  "builder-structured.md": "gauntlet/roles/builder-structured.md",
  "builder-gameplay.md": "gauntlet/roles/builder-gameplay.md",
  "critic.md": "gauntlet/roles/critic.md",
  "critic-flash.md": "gauntlet/roles/critic.md",
  "critic-qwen.md": "gauntlet/roles/critic.md",
  "critic-mimo.md": "gauntlet/roles/critic.md",
  "integration-reviewer.md": "gauntlet/roles/integration-reviewer.md",
  "integration-reviewer-flash.md": "gauntlet/roles/integration-reviewer.md",
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

export async function runPromptGate(repoRoot: string): Promise<PromptGateResult[]> {
  const results: PromptGateResult[] = [];
  for (const rule of RULES) {
    const content = await readFile(path.join(repoRoot, rule.file), "utf8");
    const missing = rule.mustContain.filter((needle) => !content.includes(needle.replace(/\\\"/g, '"')));
    results.push({ name: rule.name, pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined });
  }
  results.push(await roleWrapperCheck(repoRoot));
  results.push(await modelRoutingCheck(repoRoot));
  return results;
}
