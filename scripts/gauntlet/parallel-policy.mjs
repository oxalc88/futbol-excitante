import path from "node:path";

export const PARALLEL_STATES = ["READY", "BLOCKED", "IN_PROGRESS", "REVIEW", "ACCEPTED"];

export function normalizeOwnership(pattern) {
  const value = String(pattern ?? "").trim().replaceAll("\\", "/");
  if (!value) return "";
  const wildcard = value.search(/[?*[]/);
  const prefix = wildcard >= 0 ? value.slice(0, wildcard) : value;
  return prefix.replace(/\/+$/, "");
}

export function ownershipOverlaps(a, b) {
  const left = normalizeOwnership(a);
  const right = normalizeOwnership(b);
  if (!left || !right) return true;
  if (left === right) return true;
  const leftDir = left.endsWith("/") ? left : `${left}/`;
  const rightDir = right.endsWith("/") ? right : `${right}/`;
  return leftDir.startsWith(rightDir) || rightDir.startsWith(leftDir);
}

export function validateParallelPlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("parallel plan must be an object");
  if (plan.schema_version !== "gauntlet-parallel-plan-v1") {
    throw new Error("parallel plan schema_version must be gauntlet-parallel-plan-v1");
  }
  if (!Array.isArray(plan.objectives) || plan.objectives.length < 2) {
    throw new Error("parallel plan requires at least two objectives");
  }

  const ids = new Set();
  for (const objective of plan.objectives) {
    const required = [
      "objective_id",
      "title",
      "goal",
      "player_visible_outcome",
      "expected_file_ownership",
      "acceptance_criteria",
      "test_plan",
      "evidence_required",
      "gauntlet_role",
    ];
    for (const field of required) {
      if (objective[field] === undefined || objective[field] === null || objective[field] === "") {
        throw new Error(`${objective.objective_id ?? "<unknown>"}: missing ${field}`);
      }
    }
    if (!Array.isArray(objective.dependencies)) objective.dependencies = [];
    if (!Array.isArray(objective.expected_file_ownership) || objective.expected_file_ownership.length === 0) {
      throw new Error(`${objective.objective_id}: expected_file_ownership must be a non-empty array`);
    }
    if (ids.has(objective.objective_id)) throw new Error(`duplicate objective_id: ${objective.objective_id}`);
    ids.add(objective.objective_id);
  }
  return plan;
}

export function classifyObjectives(plan) {
  validateParallelPlan(plan);
  const accepted = new Set(plan.accepted_objectives ?? []);
  const blockers = new Map(plan.objectives.map((objective) => [objective.objective_id, []]));

  for (const objective of plan.objectives) {
    for (const dependency of objective.dependencies ?? []) {
      if (!accepted.has(dependency)) blockers.get(objective.objective_id).push(`dependency:${dependency}`);
    }
  }

  for (let i = 0; i < plan.objectives.length; i += 1) {
    const a = plan.objectives[i];
    if (accepted.has(a.objective_id)) continue;
    for (let j = i + 1; j < plan.objectives.length; j += 1) {
      const b = plan.objectives[j];
      if (accepted.has(b.objective_id)) continue;
      const overlap = a.expected_file_ownership.some((left) =>
        b.expected_file_ownership.some((right) => ownershipOverlaps(left, right)),
      );
      if (overlap) {
        blockers.get(a.objective_id).push(`file_overlap:${b.objective_id}`);
        blockers.get(b.objective_id).push(`file_overlap:${a.objective_id}`);
      }
    }
  }

  return plan.objectives.map((objective) => {
    if (accepted.has(objective.objective_id)) {
      return {
        ...objective,
        execution_state: "ACCEPTED",
        blockers: [],
      };
    }
    const reasons = [...new Set(blockers.get(objective.objective_id))];
    return {
      ...objective,
      execution_state: reasons.length === 0 ? "READY" : "BLOCKED",
      blockers: reasons,
    };
  });
}

export function objectiveMarker(objectiveId) {
  return `<!-- gauntlet-objective:${objectiveId} -->`;
}

export function issueTitle(objective) {
  return `[Gauntlet] ${objective.objective_id}: ${objective.title}`;
}

export function issueBody(objective, horizonId) {
  const lines = (items) => items.map((item) => `- ${item}`).join("\n") || "- none";
  return `${objectiveMarker(objective.objective_id)}\n\n# Gauntlet objective\n\n` +
    `- Horizon: ${horizonId ?? "unknown"}\n` +
    `- Objective: ${objective.objective_id}\n` +
    `- Role: ${objective.gauntlet_role}\n` +
    `- Execution state: ${objective.execution_state}\n\n` +
    `## Goal\n\n${objective.goal}\n\n` +
    `## Player-visible outcome\n\n${objective.player_visible_outcome}\n\n` +
    `## Dependencies\n\n${lines(objective.dependencies ?? [])}\n\n` +
    `## Expected file ownership\n\n${lines(objective.expected_file_ownership)}\n\n` +
    `## Acceptance criteria\n\n${lines(objective.acceptance_criteria)}\n\n` +
    `## Test plan\n\n${lines(objective.test_plan)}\n\n` +
    `## Evidence required\n\n${lines(objective.evidence_required)}\n\n` +
    `## Blockers\n\n${lines(objective.blockers ?? [])}\n`;
}
