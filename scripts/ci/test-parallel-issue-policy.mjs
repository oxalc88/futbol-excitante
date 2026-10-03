import assert from "node:assert/strict";
import {
  classifyObjectives,
  ownershipOverlaps,
  validateParallelPlan,
} from "../gauntlet/parallel-policy.mjs";

function objective(id, ownership, dependencies = []) {
  return {
    objective_id: id,
    title: id,
    goal: `goal ${id}`,
    player_visible_outcome: `outcome ${id}`,
    dependencies,
    expected_file_ownership: ownership,
    acceptance_criteria: ["accepted"],
    test_plan_summary: "test",
    evidence_required: ["evidence"],
    gauntlet_role: id.endsWith("A") ? "builder-gameplay" : "builder-structured",
  };
}

assert.equal(ownershipOverlaps("src/referee/**", "src/referee/policy.ts"), true);
assert.equal(ownershipOverlaps("src/referee/**", "scripts/ci/**"), false);

const independent = {
  schema_version: "gauntlet-parallel-plan-v1",
  horizon_id: "test",
  accepted_objectives: [],
  objectives: [
    objective("A", ["src/referee/**"]),
    objective("B", ["scripts/eval/**"]),
  ],
};
validateParallelPlan(independent);
assert.deepEqual(classifyObjectives(independent).map((item) => item.execution_state), ["READY", "READY"]);

const dependencyBlocked = {
  ...independent,
  objectives: [
    objective("A", ["src/referee/**"], ["PRE"]),
    objective("B", ["scripts/eval/**"]),
  ],
};
assert.deepEqual(classifyObjectives(dependencyBlocked).map((item) => item.execution_state), ["BLOCKED", "READY"]);

const overlapBlocked = {
  ...independent,
  objectives: [
    objective("A", ["src/referee/**"]),
    objective("B", ["src/referee/policy.ts"]),
  ],
};
assert.deepEqual(classifyObjectives(overlapBlocked).map((item) => item.execution_state), ["BLOCKED", "BLOCKED"]);


const acceptedDoesNotBlock = {
  ...independent,
  accepted_objectives: ["A"],
  objectives: [
    objective("A", ["src/referee/**"]),
    objective("B", ["src/referee/policy.ts"], ["A"]),
  ],
};
assert.deepEqual(
  classifyObjectives(acceptedDoesNotBlock).map((item) => item.execution_state),
  ["ACCEPTED", "READY"],
);

console.log("PASS parallel issue policy");
