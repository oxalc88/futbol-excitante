import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import gauntletParallelIssueGate from "../../.omp/hooks/pre/gauntlet-parallel-issue-gate.js";

function makeHandler() {
  let handler = null;
  const pi = {
    on(event, fn) {
      if (event === "tool_call") handler = fn;
    },
  };
  gauntletParallelIssueGate(pi);
  assert.equal(typeof handler, "function");
  return handler;
}

function task(agent, objectiveId, isolated = true) {
  return {
    name: objectiveId,
    agent,
    task: `[gauntlet-objective:${objectiveId}] implement ${objectiveId}`,
    solutionSpace: "single bounded implementation",
    isolated,
  };
}

const cwd = mkdtempSync(path.join(tmpdir(), "gauntlet-hook-"));
mkdirSync(path.join(cwd, "artifacts", "gauntlet"), { recursive: true });
writeFileSync(
  path.join(cwd, "artifacts", "gauntlet", "parallel-admission.json"),
  JSON.stringify({
    schema_version: "gauntlet-parallel-admission-v1",
    objectives: [
      { objective_id: "A", issue_number: 1, execution_state: "READY", gauntlet_role: "builder-gameplay" },
      { objective_id: "B", issue_number: 2, execution_state: "READY", gauntlet_role: "builder-structured" },
      { objective_id: "C", issue_number: 3, execution_state: "BLOCKED", gauntlet_role: "builder-structured" },
    ],
  }),
);

const handler = makeHandler();

assert.equal(
  await handler({ toolName: "task", input: { context: "ctx", tasks: [task("builder-gameplay", "A"), task("builder-structured", "B")] } }, { cwd }),
  undefined,
);

const missingMarker = await handler(
  { toolName: "task", input: { context: "ctx", tasks: [{ ...task("builder-gameplay", "A"), task: "implement A" }, task("builder-structured", "B")] } },
  { cwd },
);
assert.equal(missingMarker.block, true);

const blocked = await handler(
  { toolName: "task", input: { context: "ctx", tasks: [task("builder-gameplay", "A"), task("builder-structured", "C")] } },
  { cwd },
);
assert.equal(blocked.block, true);

const notIsolated = await handler(
  { toolName: "task", input: { context: "ctx", tasks: [task("builder-gameplay", "A", false), task("builder-structured", "B")] } },
  { cwd },
);
assert.equal(notIsolated.block, true);

const tooMany = await handler(
  {
    toolName: "task",
    input: {
      context: "ctx",
      tasks: Array.from({ length: 6 }, (_, index) => task(index % 2 ? "builder-structured" : "builder-gameplay", `X${index}`)),
    },
  },
  { cwd },
);
assert.equal(tooMany.block, true);

console.log("PASS OMP parallel gate");
