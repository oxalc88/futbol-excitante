import { execFileSync } from 'node:child_process';
import { validateUnitBatch } from '../../../gauntlet/runtime/execution-dag.mjs';
import fs from "node:fs";
import path from "node:path";

const MAX_IMPLEMENTATION_WORKERS = 5;
const ADMISSION_SCHEMA = "gauntlet-parallel-admission-v1";
const MARKER = /\[gauntlet-objective:([^\]]+)\]/;
const BUILDERS = new Set(["builder-gameplay", "builder-structured"]);

function getTasks(input) {
  return Array.isArray(input?.tasks) ? input.tasks : [];
}

export default function gauntletParallelIssueGate(pi) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "task") return;

    const tasks = getTasks(event.input);
    const builderTasks = tasks.filter((task) => BUILDERS.has(task.agent ?? ""));

    if (builderTasks.length > MAX_IMPLEMENTATION_WORKERS) {
      return {
        block: true,
        reason: `Gauntlet allows at most ${MAX_IMPLEMENTATION_WORKERS} parallel implementation workers.`,
      };
    }

    // One product issue may own several temporary units. Canonical readiness
    // and settlement are read through core, never trusted from local admission.
    if (builderTasks.some(t => /\[gauntlet-unit:/.test(String(t.task ?? "")))) {
      try {
        const tasks = builderTasks.map(t => ({
          unit_id: String(t.task).match(/\[gauntlet-unit:([^\]]+)\]/)?.[1],
          objective_id: String(t.task).match(MARKER)?.[1], agent: t.agent, isolated: t.isolated,
        }));
        const parent = tasks[0].objective_id;
        if (!parent || tasks.some(t => t.objective_id !== parent)) throw new Error("one integrated product parent required");
        const state = JSON.parse(execFileSync(process.execPath, ['--import','tsx','scripts/gauntlet/control.ts','execution','--objective',parent], {cwd:ctx.cwd,encoding:'utf8'}));
        if (!state) throw new Error("canonical execution plan missing");
        validateUnitBatch(state.plan,tasks,state.completed);
        return;
      } catch (error) { return {block:true,reason:String(error)}; }
    }

    if (builderTasks.length <= 1) return;

    const admissionPath = path.join(ctx.cwd, "artifacts", "gauntlet", "parallel-admission.json");
    if (!fs.existsSync(admissionPath)) {
      return {
        block: true,
        reason: "Parallel builders require a synchronized READY GitHub issue. Run gauntlet:parallel:sync first.",
      };
    }

    const admission = JSON.parse(fs.readFileSync(admissionPath, "utf8"));
    if (admission.schema_version !== ADMISSION_SCHEMA) {
      return { block: true, reason: "Parallel admission file has an unsupported schema." };
    }

    const byId = new Map((admission.objectives ?? []).map((item) => [item.objective_id, item]));
    const seen = new Set();

    for (const task of builderTasks) {
      const prompt = String(task.task ?? "");
      const match = prompt.match(MARKER);
      if (!match) {
        return {
          block: true,
          reason: "Each parallel builder task must include [gauntlet-objective:OBJECTIVE_ID].",
        };
      }

      const objectiveId = match[1];
      if (seen.has(objectiveId)) {
        return { block: true, reason: `Duplicate parallel objective: ${objectiveId}` };
      }
      seen.add(objectiveId);

      const entry = byId.get(objectiveId);
      if (!entry || entry.execution_state !== "READY" || !entry.issue_number) {
        return {
          block: true,
          reason: `${objectiveId} does not have a synchronized READY GitHub issue.`,
        };
      }

      if (task.isolated !== true) {
        return {
          block: true,
          reason: `${objectiveId} must use isolated=true for parallel implementation.`,
        };
      }

      if ((task.agent ?? "") !== entry.gauntlet_role) {
        return {
          block: true,
          reason: `${objectiveId} must use Gauntlet role ${entry.gauntlet_role}.`,
        };
      }
    }
  });
}

export { MAX_IMPLEMENTATION_WORKERS };
