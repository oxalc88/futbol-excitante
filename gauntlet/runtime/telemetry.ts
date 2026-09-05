import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  contextTokens: number;
  durationMs: number;
  retry?: boolean;
  compaction?: boolean;
}

export interface SessionIdentity {
  sessionId: string;
  role: string;
  model: string;
  phase: string;
}

export interface SessionTelemetry extends SessionIdentity {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  generationCount: number;
  contextPeakTokens: number;
  durationMs: number;
  retries: number;
  rateLimitEvents: number;
  compactionCount: number;
  phaseBoundaries: Array<{ from: string; to: string; contextTokens: number }>;
  freshSessionRotations: number;
  mapperInputTokens: number;
  mapperOutputTokens: number;
  memoryTopicsRetrieved: number;
  canonicalFilesSelected: number;
  contextPacketTokens: number | null;
  builderInitialContextTokens: number | null;
  continuationResearchReads: number;
}

export interface RotationTelemetry {
  objectiveId: string;
  oldSessionId: string;
  freshSessionId: string;
  contextAtRotation: number;
  oldSessionCumulativeInput: number;
  freshSessionStartingContext: number;
  checkpointTokens: number;
  fromPhase: string;
  toPhase: string;
}

function newSession(identity: SessionIdentity): SessionTelemetry {
  return {
    ...identity,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    generationCount: 0,
    contextPeakTokens: 0,
    durationMs: 0,
    retries: 0,
    rateLimitEvents: 0,
    compactionCount: 0,
    phaseBoundaries: [],
    freshSessionRotations: 0,
    mapperInputTokens: 0,
    mapperOutputTokens: 0,
    memoryTopicsRetrieved: 0,
    canonicalFilesSelected: 0,
    contextPacketTokens: null,
    builderInitialContextTokens: null,
    continuationResearchReads: 0,
  };
}

export class UsageTelemetryRecorder {
  private readonly sessions = new Map<string, SessionTelemetry>();
  private readonly rotations: RotationTelemetry[] = [];
  private glmRolling60Maximum = 0;
  private glmAdmissionGateWaits = 0;
  private glmRateLimitBackoffEvents = 0;

  startSession(identity: SessionIdentity, initialContextTokens?: number): void {
    if (this.sessions.has(identity.sessionId)) throw new Error(`duplicate telemetry session: ${identity.sessionId}`);
    const session = newSession(identity);
    if (initialContextTokens !== undefined) session.builderInitialContextTokens = initialContextTokens;
    this.sessions.set(identity.sessionId, session);
  }

  recordGeneration(sessionId: string, usage: GenerationUsage): void {
    const session = this.requiredSession(sessionId);
    session.inputTokens += usage.inputTokens;
    session.outputTokens += usage.outputTokens;
    session.cachedInputTokens = usage.cachedInputTokens === undefined || session.cachedInputTokens === null
      ? null
      : session.cachedInputTokens + usage.cachedInputTokens;
    session.generationCount += 1;
    session.contextPeakTokens = Math.max(session.contextPeakTokens, usage.contextTokens);
    session.durationMs += usage.durationMs;
    if (usage.retry) session.retries += 1;
    if (usage.compaction) session.compactionCount += 1;
  }

  recordRateLimit(sessionId: string): void {
    this.requiredSession(sessionId).rateLimitEvents += 1;
    this.glmRateLimitBackoffEvents += 1;
  }

  recordGlmGovernor(rolling60Input: number, waited: boolean): void {
    this.glmRolling60Maximum = Math.max(this.glmRolling60Maximum, rolling60Input);
    if (waited) this.glmAdmissionGateWaits += 1;
  }

  recordPhaseBoundary(sessionId: string, toPhase: string, contextTokens: number): void {
    const session = this.requiredSession(sessionId);
    session.phaseBoundaries.push({ from: session.phase, to: toPhase, contextTokens });
    session.phase = toPhase;
  }

  recordMapping(sessionId: string, metrics: {
    inputTokens: number;
    outputTokens: number;
    topicsRetrieved: number;
    canonicalFilesSelected: number;
    contextPacketTokens: number;
  }): void {
    const session = this.requiredSession(sessionId);
    session.mapperInputTokens += metrics.inputTokens;
    session.mapperOutputTokens += metrics.outputTokens;
    session.memoryTopicsRetrieved += metrics.topicsRetrieved;
    session.canonicalFilesSelected += metrics.canonicalFilesSelected;
    session.contextPacketTokens = metrics.contextPacketTokens;
  }

  recordContinuationResearchRead(sessionId: string, count = 1): void {
    this.requiredSession(sessionId).continuationResearchReads += count;
  }

  recordRotation(rotation: RotationTelemetry): void {
    this.rotations.push({ ...rotation });
    this.requiredSession(rotation.oldSessionId).freshSessionRotations += 1;
  }

  snapshot(): {
    schemaVersion: 1;
    precision: "processed-input-not-billed";
    sessions: SessionTelemetry[];
    rotations: RotationTelemetry[];
    glm: { rolling60InputMaximum: number; admissionGateWaits: number; rateLimitBackoffEvents: number };
  } {
    return {
      schemaVersion: 1,
      precision: "processed-input-not-billed",
      sessions: [...this.sessions.values()].map((session) => structuredClone(session)),
      rotations: structuredClone(this.rotations),
      glm: {
        rolling60InputMaximum: this.glmRolling60Maximum,
        admissionGateWaits: this.glmAdmissionGateWaits,
        rateLimitBackoffEvents: this.glmRateLimitBackoffEvents,
      },
    };
  }

  private requiredSession(sessionId: string): SessionTelemetry {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown telemetry session: ${sessionId}`);
    return session;
  }
}

export async function writeTelemetrySnapshot(
  repoRoot: string,
  recorder: UsageTelemetryRecorder,
  fileName = "latest.json",
): Promise<string> {
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(fileName)) {
    throw new Error("telemetry file name must be a simple .json name");
  }
  const directory = path.join(repoRoot, ".delivery-local", "telemetry");
  await mkdir(directory, { recursive: true });
  const outputPath = path.join(directory, fileName);
  await writeFile(outputPath, `${JSON.stringify(recorder.snapshot(), null, 2)}\n`, "utf8");
  return path.relative(repoRoot, outputPath);
}
