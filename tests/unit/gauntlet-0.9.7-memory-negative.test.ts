import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { digestRepositoryFiles } from "../../gauntlet/runtime/digest.js";
import { validateMemory } from "../../gauntlet/runtime/memory.js";

it("rejects duplicate, unsafe, oversized, unresolved, and malformed memory topics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gauntlet-097-memory-negative-"));
  await mkdir(path.join(root, "memory", "patterns"), { recursive: true });
  await mkdir(path.join(root, "specs"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "specs", "canonical.md"), "canonical\n");
  await writeFile(path.join(root, "src", "implementation.ts"), "export {};\n");
  const digest = await digestRepositoryFiles(root, ["specs/canonical.md"]);
  const validTopic = `---
schema_version: 1
topic_key: topic/duplicate
type: pattern
status: active
summary: "Stable continuation knowledge."
canonical_refs:
  - specs/canonical.md
evidence:
  - src/implementation.ts
supersedes: []
source_digest: "${digest}"
updated_at: "2026-09-05"
---

A concise implementation location and retrieval hint.
`;
  const invalidTopic = `---
schema_version: 1
topic_key: topic/duplicate
type: invalid
status: superseded
summary: "${"x".repeat(601)}"
canonical_refs:
  - missing/spec.md
evidence:
  - missing/evidence.ts
supersedes: []
superseded_by: ""
source_digest: "not-a-digest"
updated_at: "today"
---

raw transcript
api_key: exposed-placeholder
Memory is authoritative.
`;
  await writeFile(path.join(root, "memory", "patterns", "valid.md"), validTopic);
  await writeFile(path.join(root, "memory", "patterns", "invalid.md"), invalidTopic);

  const result = await validateMemory(root);
  const codes = result.issues.map((issue) => issue.code);
  expect(result.valid).toBe(false);
  expect(codes).toEqual(expect.arrayContaining([
    "DUPLICATE_TOPIC_KEY",
    "TYPE",
    "SUMMARY_BOUNDS",
    "SOURCE_DIGEST_FORMAT",
    "UPDATED_AT",
    "MISSING_CANONICAL_REF",
    "MISSING_EVIDENCE",
    "SUPERSESSION_REPLACEMENT",
    "RAW_TRANSCRIPT",
    "CREDENTIAL",
    "AUTHORITY_CLAIM",
  ]));
});
