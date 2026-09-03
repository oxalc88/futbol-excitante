import { readFileSync, writeFileSync } from "node:fs";

const [basePath, headPath, outPath = "artifacts/ci/pr-classification.json"] = process.argv.slice(2);
if (!basePath || !headPath) throw new Error("usage: classify-pr-validation.mjs <base-report> <head-report> [out]");

const base = JSON.parse(readFileSync(basePath, "utf8"));
const head = JSON.parse(readFileSync(headPath, "utf8"));
const byId = (report) => new Map(report.checks.map((check) => [check.check_id, check]));
const baseChecks = byId(base);
const headChecks = byId(head);
const classifications = [];

function normalizedSummary(check) {
  return [...(check?.summary ?? [])].sort();
}

function sameFailure(baseCheck, headCheck) {
  if (baseCheck?.status !== "FAIL" || headCheck.status !== "FAIL") return false;
  if (baseCheck.signature === headCheck.signature) return true;
  return JSON.stringify(normalizedSummary(baseCheck)) === JSON.stringify(normalizedSummary(headCheck));
}

for (const [checkId, headCheck] of headChecks) {
  const baseCheck = baseChecks.get(checkId);
  let classification;
  if (headCheck.status === "PASS") classification = baseCheck?.status === "FAIL" ? "IMPROVED" : "PASS";
  else if (sameFailure(baseCheck, headCheck)) classification = "PREEXISTING_REGRESSION";
  else classification = "PR_REGRESSION";
  classifications.push({
    check_id: checkId,
    classification,
    base_status: baseCheck?.status ?? "MISSING",
    head_status: headCheck.status,
    base_signature: baseCheck?.signature ?? null,
    head_signature: headCheck.signature ?? null,
    summary: headCheck.summary ?? [],
  });
}

const result = {
  schema_version: "pr-ci-classification-v1",
  base_sha: base.target_sha,
  head_sha: head.target_sha,
  classifications,
  blocker: classifications.some((item) => item.classification === "PR_REGRESSION"),
};
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

for (const item of classifications) console.log(`${item.classification} ${item.check_id}`);
if (result.blocker) process.exitCode = 1;
