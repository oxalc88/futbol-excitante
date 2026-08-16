import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PromptGateResult {
  name: string;
  pass: boolean;
  detail?: string;
}

interface GateRule {
  name: string;
  file: string;
  mustContain: string[];
}

const RULES: GateRule[] = [
  {
    name: "main prompt preserves acceptance transition and continuation",
    file: "gauntlet/PROMPT.md",
    mustContain: [
      "An accepted active_candidate is stale bookkeeping",
      "clear the accepted objective from `active_candidate`",
      "A successful acceptance commit is not a stopping point",
      "Otherwise continue the loop.",
    ],
  },
  {
    name: "grok orchestrator repairs stale accepted candidates",
    file: ".grok/agents/orchestrator.md",
    mustContain: [
      "An accepted active_candidate is stale bookkeeping",
      "clear the accepted objective from `active_candidate`",
      "A successful acceptance commit is not a stopping point",
      "Horizon exhaustion triggers strategic reassessment and continuation",
    ],
  },
  {
    name: "deepseek pickup cannot resume an accepted candidate",
    file: ".grok/agents/orchestrator-deepseek.md",
    mustContain: [
      "treat it as stale bookkeeping",
      "clear the accepted objective from `active_candidate`",
      "A successful acceptance commit is not a stopping point",
      "Otherwise continue.",
    ],
  },
  {
    name: "gauntlet skill keeps final evidence and continuation gates",
    file: ".grok/skills/gauntlet/SKILL.md",
    mustContain: [
      "Critic ACCEPT alone is never final",
      "clear the accepted objective from `active_candidate`",
      "A successful acceptance commit is not a stopping point",
    ],
  },
  {
    name: "continue skill repairs stale state and keeps running",
    file: ".grok/skills/gauntlet-continue/SKILL.md",
    mustContain: [
      "it is stale bookkeeping",
      "clear the accepted objective from `active_candidate`",
      "A successful acceptance commit is not a stopping point",
      "Horizon exhaustion is a planning boundary, not a stop condition",
    ],
  },
  {
    name: "reviewer fallback remains explicit",
    file: "gauntlet/PROMPT.md",
    mustContain: ["critic-flash", "integration-reviewer-flash"],
  },
];

export async function runPromptGate(repoRoot: string): Promise<PromptGateResult[]> {
  const results: PromptGateResult[] = [];

  for (const rule of RULES) {
    const content = await readFile(path.join(repoRoot, rule.file), "utf8");
    const missing = rule.mustContain.filter((needle) => !content.includes(needle));
    results.push({
      name: rule.name,
      pass: missing.length === 0,
      detail: missing.length ? `missing: ${missing.join(", ")}` : undefined,
    });
  }

  return results;
}
