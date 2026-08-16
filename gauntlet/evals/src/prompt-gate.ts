import { readFile } from "node:fs/promises";
import path from "node:path";
export interface PromptGateResult { name: string; pass: boolean; detail?: string }
interface GateRule { name: string; file: string; mustContain: string[] }
const RULES: GateRule[] = [
  { name: "canonical principles exist", file: "gauntlet/principles.md", mustContain: ["Deterministic audits may invalidate evidence or state", "Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar."] },
  { name: "main prompt uses deterministic-first critic-always pipeline", file: "gauntlet/PROMPT.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "The critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state"] },
  { name: "0.8 acceptance is durable before claim", file: "gauntlet/PROMPT.md", mustContain: ["manifest.json", "fully accepted", "candidate commit", "Horizon exhaustion triggers strategic reassessment"] },
  { name: "grok orchestrator uses deterministic-first critic-always pipeline", file: ".grok/agents/orchestrator.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state", "manifest.json"] },
  { name: "deepseek orchestrator uses deterministic-first critic-always pipeline", file: ".grok/agents/orchestrator-deepseek.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "critic is mandatory", "GAUNTLET_ACCEPTANCE_JSON", "pnpm run gauntlet:eval:state", "manifest.json"] },
  { name: "main skill cannot bypass critic", file: ".grok/skills/gauntlet/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "REVIEW_REQUIRED", "Critic ACCEPT alone is never final", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "continue skill cannot bypass critic", file: ".grok/skills/gauntlet-continue/SKILL.md", mustContain: ["gauntlet/principles.md", "pnpm run gauntlet:audit", "critic remains mandatory", "GAUNTLET_ACCEPTANCE_JSON"] },
  { name: "class-based evidence contract cannot regress", file: "gauntlet/evidence-contract.md", mustContain: ["`HEADLESS`", "`BROWSER_VISIBLE`", "`MULTI_TICK`", "`DYNAMIC_VISUAL`", "3–5 semantic frames", "`PRESENTATION`", "`BOOKKEEPING`", "manifest.json", "The critic is mandatory"] },
  { name: "evidence manifest contract exists", file: "gauntlet/evidence-manifest-contract.md", mustContain: ["candidate_commit", "sha256", "sequence.json", "video-reference.json", "milestones", "never silently overwritten"] },
  { name: "semantic audit is bounded and cannot accept", file: "gauntlet/semantic-audit-contract.md", mustContain: ["VALID|INVALID|INSUFFICIENT_CONTEXT", "can never produce objective `ACCEPT`"] },
  { name: "semver system version is declared", file: "gauntlet/VERSION.json", mustContain: ["\"version\": \"0.8.0\"", "\"semver\": true"] },
  { name: "reviewer fallback remains explicit", file: "gauntlet/PROMPT.md", mustContain: ["critic-flash", "integration-reviewer-flash"] },
];
export async function runPromptGate(repoRoot: string): Promise<PromptGateResult[]> {
  const results: PromptGateResult[] = [];
  for (const rule of RULES) {
    const content = await readFile(path.join(repoRoot, rule.file), "utf8");
    const missing = rule.mustContain.filter((needle) => !content.includes(needle.replace(/\\"/g, '"')));
    results.push({ name: rule.name, pass: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined });
  }
  return results;
}
