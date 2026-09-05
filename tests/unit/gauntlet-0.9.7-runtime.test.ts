import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SharedModelBackoff } from "../../gauntlet/runtime/backoff.js";
import { createBuilderCheckpoint, seedFreshBuilder, validateBuilderCheckpoint } from "../../gauntlet/runtime/builder-checkpoint.js";
import { decideBuilderRotation } from "../../gauntlet/runtime/builder-rotation.js";
import { GauntletRuntimeController } from "../../gauntlet/runtime/controller.js";
import { mapObjectiveContext } from "../../gauntlet/runtime/context-mapper.js";
import { createContextPacket, validateContextPacket } from "../../gauntlet/runtime/context-packet.js";
import { digestRepositoryFiles } from "../../gauntlet/runtime/digest.js";
import { RollingTpmGovernor } from "../../gauntlet/runtime/governor.js";
import { searchMemory, validateMemory } from "../../gauntlet/runtime/memory.js";
import { RUNTIME_POLICY, quotaBucketForRole } from "../../gauntlet/runtime/policy.js";
import { UsageTelemetryRecorder, writeTelemetrySnapshot } from "../../gauntlet/runtime/telemetry.js";
import { runVerificationBatch } from "../../gauntlet/runtime/verification-batch.js";
import { ChildWaitCoordinator } from "../../gauntlet/runtime/wait-coordinator.js";

const GLM_BUCKET_ID = "nan/glm5.3-flash";
const GLM_POLICY = RUNTIME_POLICY.rate_limit_buckets[GLM_BUCKET_ID]!;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gauntlet-097-"));
  await mkdir(path.join(root, "specs"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "tests"), { recursive: true });
  await mkdir(path.join(root, "memory", "patterns"), { recursive: true });
  await writeFile(path.join(root, "specs", "canonical.md"), "canonical-v1\n");
  await writeFile(path.join(root, "src", "implementation.ts"), "export const value = 1;\n");
  await writeFile(path.join(root, "tests", "implementation.test.ts"), "test placeholder\n");
  await writeFile(path.join(root, "unrelated.md"), "unrelated-v1\n");
  return root;
}

async function writeTopic(root: string, name: string, topicKey = `topic/${name}`): Promise<void> {
  const digest = await digestRepositoryFiles(root, ["specs/canonical.md"]);
  await writeFile(path.join(root, "memory", "patterns", `${name}.md`), `---
schema_version: 1
topic_key: ${topicKey}
type: pattern
status: active
summary: "Stable ball continuation pattern ${name}."
canonical_refs:
  - specs/canonical.md
evidence:
  - src/implementation.ts
supersedes: []
source_digest: "${digest}"
updated_at: "2026-09-05"
---

The current knowledge is enforced by the implementation and its canonical contract.
Retrieval hints: ball continuation ${name}.
`);
}

describe("Gauntlet 0.9.7 runtime efficiency", () => {
  it("does not wake the parent model repeatedly while a child is running", () => {
    const waits = new ChildWaitCoordinator();
    const decisions = [
      waits.handle({ kind: "child_started", childId: "builder-1" }),
      ...Array.from({ length: 26 }, () => waits.handle({ kind: "status_heartbeat" as const, childId: "builder-1" })),
      waits.handle({ kind: "child_progress", childId: "builder-1", status: "testing" }),
      waits.handle({ kind: "child_terminal", childId: "builder-1", status: "completed" }),
      waits.handle({ kind: "child_terminal", childId: "builder-1", status: "completed" }),
    ];
    expect(decisions.filter((decision) => decision.wakeParentModel)).toHaveLength(1);
    expect(decisions.slice(0, -2).every((decision) => !decision.wakeParentModel)).toBe(true);
  });

  it("blocks a GLM request that would exceed the safe rolling TPM ceiling", () => {
    const governor = new RollingTpmGovernor(GLM_BUCKET_ID, GLM_POLICY);
    expect(governor.reserve({ requestId: "parent-1", role: "orchestrator-glm", estimatedInputTokens: 500_000, nowMs: 0 }).admitted).toBe(true);
    governor.recordSuccess("parent-1", 500_000, 1_000);
    const decision = governor.reserve({ requestId: "critic-1", role: "critic", estimatedInputTokens: 180_000, nowMs: 2_000 });
    expect(decision).toMatchObject({ admitted: false, reason: "soft_tpm_limit", recentSuccessfulInput: 500_000 });
    if (!decision.admitted) expect(decision.waitMs).toBe(59_000);
  });

  it("shares one configured GLM governor across parent, critic, and integration roles only", () => {
    expect(GLM_POLICY.roles).toEqual(["orchestrator-glm", "critic", "integration-reviewer"]);
    expect(quotaBucketForRole("orchestrator-glm", "nan", "glm5.3-flash")).toBe(GLM_BUCKET_ID);
    expect(quotaBucketForRole("critic", "nan", "glm5.3-flash")).toBe(GLM_BUCKET_ID);
    expect(quotaBucketForRole("integration-reviewer", "nan", "glm5.3-flash")).toBe(GLM_BUCKET_ID);
    expect(quotaBucketForRole("builder-gameplay", "nan", "qwen3.8-flash")).toBeNull();
    expect(quotaBucketForRole("git-committer", "nan", "gemma4")).toBeNull();
  });

  it("keeps queued wakeups behind global model backoff through deterministic recovery", () => {
    const backoff = new SharedModelBackoff(GLM_BUCKET_ID, GLM_POLICY);
    const governor = new RollingTpmGovernor(GLM_BUCKET_ID, GLM_POLICY);
    const controller = new GauntletRuntimeController(governor, backoff);
    backoff.recordRateLimit(0, "logical-review");
    expect(controller.handleWake("child_terminal", 100)).toEqual({ wakeParentModel: false, waitMs: 1_900 });
    expect(controller.handleWake("tool_terminal", 500)).toEqual({ wakeParentModel: false, waitMs: 1_500 });
    const repeated = backoff.recordRateLimit(2_000, "queued-new-turn");
    expect(repeated.incidentId).toBe("logical-review");
    expect(repeated.failureCount).toBe(2);
    expect(controller.handleWake("parent_wakeup", 6_999).wakeParentModel).toBe(false);
    expect(controller.handleWake("parent_wakeup", 7_000).wakeParentModel).toBe(true);
    expect(backoff.recordSuccess()).toEqual(expect.arrayContaining(["child_terminal", "tool_terminal", "parent_wakeup"]));
    expect(controller.handleWake("user_message", 7_001).wakeParentModel).toBe(true);
  });

  it("bounds the shared rate-limit retry count", () => {
    const backoff = new SharedModelBackoff(GLM_BUCKET_ID, GLM_POLICY);
    for (let attempt = 0; attempt < 5; attempt += 1) backoff.recordRateLimit(attempt * 50_000, `turn-${attempt}`);
    expect(backoff.snapshot()).toMatchObject({ incidentId: "turn-0", failureCount: 5, exhausted: true, backoffEvents: 5 });
    expect(backoff.gateWake(999_999, "user_message")).toMatchObject({ allowed: false, exhausted: true });
  });
});

describe("Gauntlet 0.9.7 bounded project memory", () => {
  it("validates a concise topic with existing canonical and evidence references", async () => {
    const root = await fixtureRepo();
    await writeTopic(root, "settled-ball");
    await expect(validateMemory(root)).resolves.toMatchObject({ valid: true, topics: 1, issues: [], needsReview: [] });
  });

  it("returns bounded previews instead of concatenated topic contents", async () => {
    const root = await fixtureRepo();
    for (let index = 0; index < 7; index += 1) await writeTopic(root, `ball-${index}`, `gameplay/ball-${index}`);
    const previews = await searchMemory(root, "ball", 99);
    expect(previews).toHaveLength(5);
    expect(previews.every((preview) => !("body" in preview))).toBe(true);
    expect(previews.every((preview) => preview.summary.length <= RUNTIME_POLICY.memory.summary_max_characters)).toBe(true);
  });

  it("invalidates only memory and packet inputs whose canonical digest changed", async () => {
    const root = await fixtureRepo();
    await writeTopic(root, "digest");
    const packet = await createContextPacket(root, {
      objectiveId: "DIGEST-CHECK",
      executiveSummary: "Navigate one canonical input.",
      files: [{ path: "specs/canonical.md", purpose: "Canonical behavior" }],
      decisions: [],
      tests: ["tests/implementation.test.ts"],
      dependencies: [],
      risks: [],
      conflicts: [],
      skillsToLoad: [],
    });
    await writeFile(path.join(root, "unrelated.md"), "unrelated-v2\n");
    await expect(validateContextPacket(root, packet)).resolves.toMatchObject({ valid: true, stale: false });
    await writeFile(path.join(root, "specs", "canonical.md"), "canonical-v2\n");
    await expect(validateContextPacket(root, packet)).resolves.toMatchObject({ valid: false, stale: true });
    const memory = await validateMemory(root);
    expect(memory.valid).toBe(false);
    expect(memory.needsReview).toEqual(["topic/digest"]);
    expect(memory.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOURCE_DIGEST_STALE" })]));
  });
});

describe("Gauntlet 0.9.7 objective context and builder continuation", () => {
  it("enforces the configured context-packet bound", async () => {
    const root = await fixtureRepo();
    const packet = await createContextPacket(root, {
      objectiveId: "TOO-LARGE",
      executiveSummary: "x".repeat(7_000),
      files: [{ path: "specs/canonical.md", purpose: "Canonical behavior" }],
      decisions: [],
      tests: [],
      dependencies: [],
      risks: [],
      conflicts: [],
      skillsToLoad: [],
    });
    const validation = await validateContextPacket(root, packet);
    expect(validation.valid).toBe(false);
    expect(validation.estimatedTokens).toBeGreaterThan(RUNTIME_POLICY.objective_context.maximum_tokens);
    expect(validation.issues).toContain("packet exceeds configured token bound");
  });

  it("rejects objective IDs that could escape local packet or checkpoint directories", async () => {
    const root = await fixtureRepo();
    const packet = await createContextPacket(root, {
      objectiveId: "../escape",
      executiveSummary: "Invalid local path fixture.",
      files: [{ path: "specs/canonical.md", purpose: "Canonical behavior" }],
      decisions: [],
      tests: [],
      dependencies: [],
      risks: [],
      conflicts: [],
      skillsToLoad: [],
    });
    await expect(validateContextPacket(root, packet)).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining(["objectiveId must be a simple repository-safe identifier"]),
    });
    const checkpoint = await createBuilderCheckpoint(root, {
      objectiveId: "../escape",
      builderSessionId: "builder",
      phase: "implementation",
      changedFiles: [],
      implementedBehavior: [],
      testsRun: [],
      remainingFailures: [],
      evidence: [],
      nextAction: "Continue safely.",
      relevantFiles: ["src/implementation.ts"],
    });
    await expect(validateBuilderCheckpoint(root, checkpoint)).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining(["objectiveId must be a simple repository-safe identifier"]),
    });
  });

  it("maps through a bounded read-only view and cannot mutate product state or accept objectives", async () => {
    const root = await fixtureRepo();
    const reads: string[] = [];
    const view = {
      search: async () => ["src/implementation.ts"],
      read: async (relativePath: string) => {
        reads.push(relativePath);
        return readFile(path.join(root, relativePath), "utf8");
      },
    };
    expect("write" in view).toBe(false);
    const result = await mapObjectiveContext(root, view, {
      objectiveId: "MAP-CONTEXT",
      executiveSummary: "Locate the implementation and canonical contract.",
      obviousFiles: [{ path: "specs/canonical.md", purpose: "Canonical behavior" }],
      searches: ["implementation"],
      selectedMemoryTopics: [],
      tests: ["tests/implementation.test.ts"],
      dependencies: [],
      risks: ["Verify canonical source before review."],
      conflicts: [],
      skillsToLoad: [],
    });
    expect(result.metrics).toMatchObject({ searches: 1, filesRead: 2, bypassed: false });
    expect(reads).toEqual(["specs/canonical.md", "src/implementation.ts"]);
    expect(result.packet.nonAuthoritative).toBe(true);
    expect(result.packet).not.toHaveProperty("acceptance");
    expect(result.packet.files.length).toBeLessThanOrEqual(12);
  });

  it("seeds a fresh builder from a valid packet and checkpoint", async () => {
    const root = await fixtureRepo();
    const packet = await createContextPacket(root, {
      objectiveId: "ROTATE",
      executiveSummary: "Continue at broad regression validation.",
      files: [{ path: "src/implementation.ts", purpose: "Persisted implementation" }],
      decisions: [],
      tests: ["tests/implementation.test.ts"],
      dependencies: [],
      risks: [],
      conflicts: [],
      skillsToLoad: [],
    });
    const checkpoint = await createBuilderCheckpoint(root, {
      objectiveId: "ROTATE",
      builderSessionId: "old-session",
      phase: "focused-validation",
      changedFiles: ["src/implementation.ts"],
      implementedBehavior: ["Implementation persisted."],
      testsRun: [{ command: "mise run typecheck", exitCode: 0 }],
      remainingFailures: ["Broad neighbor suite remains."],
      evidence: [],
      nextAction: "Run the batched broad regression suite.",
      relevantFiles: ["src/implementation.ts", "tests/implementation.test.ts"],
    });
    await expect(validateBuilderCheckpoint(root, checkpoint)).resolves.toMatchObject({ valid: true, stale: false });
    const seed = seedFreshBuilder({
      objectiveId: "ROTATE",
      roleContract: "gauntlet/roles/builder-gameplay.md",
      contextPacket: packet,
      checkpoint,
      selectedMemoryTopicPaths: [],
      canonicalRefs: ["specs/canonical.md"],
    });
    expect(seed.previousTranscriptIncluded).toBe(false);
    expect(JSON.stringify(seed)).not.toMatch(/oldTranscript|conversationHistory|raw prompt/i);
    expect(seed.checkpoint.nextAction).toContain("broad regression");
  });

  it("rotates only at a safe persisted phase boundary without mutating objective state", () => {
    const usage = {
      sessionId: "old-session",
      model: "qwen3.8-flash",
      phase: "focused-validation",
      contextTokens: 445_000,
      cumulativeSuccessfulInputTokens: 69_545_469,
      generationCount: 277,
      peakContextTokens: 445_000,
    };
    const before = structuredClone(usage);
    const decision = decideBuilderRotation(usage, {
      safe: true,
      workPersisted: true,
      checkpointValid: true,
      nextPhase: "broad-regression",
      materiallyDifferent: true,
    }, RUNTIME_POLICY.builder_budgets["qwen3.8-flash"]!);
    expect(decision).toMatchObject({ rotate: true, reason: "rotate_at_checkpoint" });
    expect(decision.exceeded).toEqual(["context", "cumulative_input", "generations"]);
    expect(usage).toEqual(before);
    expect(decideBuilderRotation(usage, {
      safe: false,
      workPersisted: true,
      checkpointValid: true,
      nextPhase: "broad-regression",
      materiallyDifferent: true,
    }, RUNTIME_POLICY.builder_budgets["qwen3.8-flash"]!)).toMatchObject({ rotate: false, reason: "unsafe_boundary" });
  });
});

describe("Gauntlet 0.9.7 verification and telemetry", () => {
  it("batches deterministic verification into one wake while preserving failures", async () => {
    const executed: string[] = [];
    const result = await runVerificationBatch([
      { id: "typecheck", command: ["mise", "run", "typecheck"] },
      { id: "focused", command: ["pnpm", "vitest", "focused"] },
      { id: "build", command: ["mise", "run", "build"] },
    ], {
      run: async (command) => {
        executed.push(command.id);
        return command.id === "focused"
          ? { exitCode: 1, stdout: "FAIL tests/focused.test.ts\nAssertionError expected 1", stderr: "", artifactPath: "artifacts/focused.log" }
          : { exitCode: 0, stdout: "PASS", stderr: "" };
      },
    });
    expect(executed).toEqual(["typecheck", "focused", "build"]);
    expect(result).toMatchObject({ status: "FAIL", modelWakeCount: 1 });
    expect(result.commands[1]).toMatchObject({ exitCode: 1, artifactPath: "artifacts/focused.log" });
    expect(result.commands[1]!.failureExcerpt.join("\n")).toMatch(/FAIL|AssertionError/);
  });

  it("records and persists session context, processed input, rotation, mapping, and GLM controls", async () => {
    const root = await fixtureRepo();
    const telemetry = new UsageTelemetryRecorder();
    telemetry.startSession({ sessionId: "old", role: "builder-gameplay", model: "qwen3.8-flash", phase: "implementation" }, 8_000);
    telemetry.startSession({ sessionId: "fresh", role: "builder-gameplay", model: "qwen3.8-flash", phase: "broad-regression" }, 14_000);
    telemetry.recordGeneration("old", { inputTokens: 445_000, outputTokens: 2_000, cachedInputTokens: 400_000, contextTokens: 445_000, durationMs: 2_500 });
    telemetry.recordPhaseBoundary("old", "focused-validation", 445_000);
    telemetry.recordMapping("fresh", { inputTokens: 2_000, outputTokens: 1_200, topicsRetrieved: 2, canonicalFilesSelected: 8, contextPacketTokens: 1_250 });
    telemetry.recordContinuationResearchRead("fresh", 3);
    telemetry.recordRotation({
      objectiveId: "ROTATE",
      oldSessionId: "old",
      freshSessionId: "fresh",
      contextAtRotation: 445_000,
      oldSessionCumulativeInput: 69_545_469,
      freshSessionStartingContext: 14_000,
      checkpointTokens: 620,
      fromPhase: "focused-validation",
      toPhase: "broad-regression",
    });
    telemetry.recordGlmGovernor(661_227, true);
    telemetry.recordRateLimit("old");
    const snapshot = telemetry.snapshot();
    expect(snapshot.precision).toBe("processed-input-not-billed");
    expect(snapshot.sessions[0]).toMatchObject({ generationCount: 1, contextPeakTokens: 445_000, inputTokens: 445_000, freshSessionRotations: 1 });
    expect(snapshot.sessions[1]).toMatchObject({ builderInitialContextTokens: 14_000, contextPacketTokens: 1_250, memoryTopicsRetrieved: 2, continuationResearchReads: 3 });
    expect(snapshot.rotations[0]).toMatchObject({ checkpointTokens: 620, freshSessionStartingContext: 14_000 });
    expect(snapshot.glm).toMatchObject({ rolling60InputMaximum: 661_227, admissionGateWaits: 1, rateLimitBackoffEvents: 1 });
    const outputPath = await writeTelemetrySnapshot(root, telemetry, "objective-rotate.json");
    const persisted = JSON.parse(await readFile(path.join(root, outputPath), "utf8")) as typeof snapshot;
    expect(persisted).toEqual(snapshot);
  });

  it("keeps all continuation entrypoints on one persisted-state/context contract", async () => {
    const files = [".grok/skills/gauntlet/SKILL.md", ".grok/skills/gauntlet-continue/SKILL.md", ".grok/skills/gcont/SKILL.md"];
    const contents = await Promise.all(files.map((file) => readFile(path.join(process.cwd(), file), "utf8")));
    for (const content of contents) {
      expect(content).toContain("gauntlet/PROMPT.md");
      expect(content).toContain("gauntlet/runtime-efficiency-contract.md");
      expect(content).toContain("objective context packet");
      expect(content).toContain("builder checkpoint");
      expect(content).toContain("previous transcript");
      expect(content).toContain("critic");
      expect(content).toContain("integration");
      expect(content).toContain("remote containment verification");
    }
  });
});
