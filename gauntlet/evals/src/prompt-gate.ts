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
    name: "main prompt preserves integration and continuation",
    file: "gauntlet/PROMPT.md",
    mustContain: ["integration-reviewer", "start it directly", "critic-flash"],
  },
  {
    name: "grok orchestrator preserves explicit stop conditions",
    file: ".grok/agents/orchestrator.md",
    mustContain: ["## Stop conditions", "Otherwise continue.", "integration-reviewer-flash"],
  },
  {
    name: "deepseek orchestrator preserves explicit reviewer fallback",
    file: ".grok/agents/orchestrator-deepseek.md",
    mustContain: ["critic-flash", "integration-reviewer-flash", "Stop only"],
  },
  {
    name: "gauntlet skill keeps final evidence gate",
    file: ".grok/skills/gauntlet/SKILL.md",
    mustContain: ["Critic ACCEPT alone is never final", "mandatory-evidence"],
  },
  {
    name: "continue skill keeps persisted horizon",
    file: ".grok/skills/gauntlet-continue/SKILL.md",
    mustContain: ["Do not discard a valid persisted horizon", "orchestrator evidence gate"],
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
