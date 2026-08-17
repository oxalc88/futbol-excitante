import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [reportPath, repoPath] = process.argv.slice(2);
if (!reportPath || !repoPath) throw new Error("usage: update-regression-inbox.mjs <validation-report> <regression-repo>");

const report = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
const inboxDir = join(resolve(repoPath), "gauntlet", "regressions", "inbox");
mkdirSync(inboxDir, { recursive: true });
let changed = false;

for (const check of report.checks) {
  const recordPath = join(inboxDir, `${check.check_id}.json`);
  const previous = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, "utf8")) : null;

  if (check.status === "FAIL") {
    const sameOpen = previous?.status === "OPEN" && previous?.signature === check.signature;
    if (sameOpen) continue;
    const record = {
      schema_version: "gauntlet-regression-inbox-v1",
      source: "main-ci",
      source_branch: "main",
      check_id: check.check_id,
      status: "OPEN",
      signature: check.signature,
      summary: check.summary,
      first_seen_commit: report.target_sha,
      last_changed_commit: report.target_sha,
      previous_signature: previous?.signature ?? null,
    };
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    changed = true;
    continue;
  }

  if (previous?.status === "OPEN") {
    const record = {
      ...previous,
      status: "RESOLVED",
      resolved_commit: report.target_sha,
      last_changed_commit: report.target_sha,
    };
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    changed = true;
  }
}

console.log(changed ? "REGRESSION_INBOX_CHANGED" : "REGRESSION_INBOX_UNCHANGED");
