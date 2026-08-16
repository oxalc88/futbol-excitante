import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ArtifactRecord {
  path: string;
  sha256: string;
  git_blob: string | null;
  candidate_commit: string;
  bytes: number;
  committed_with_candidate: boolean;
}

export interface EvidenceManifestInput {
  objective_id: string;
  candidate_commit: string;
  evidence_class?: string;
  deterministic_audit: Record<string, unknown>;
  semantic_audit?: Record<string, unknown> | null;
  critic: Record<string, unknown>;
  integration: Record<string, unknown>;
  metrics?: string[];
}

async function exists(file: string): Promise<boolean> {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function artifact(repoRoot: string, absolutePath: string, candidateCommit: string, requireCommitted = true): Promise<ArtifactRecord> {
  const bytes = await readFile(absolutePath);
  const relative = path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/");
  let committedBlob: string | null = null;
  if (requireCommitted) {
    let localBlob: string;
    try {
      ({ stdout: committedBlob } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", `${candidateCommit}:${relative}`], { encoding: "utf8" }));
      ({ stdout: localBlob } = await execFileAsync("git", ["-C", repoRoot, "hash-object", absolutePath], { encoding: "utf8" }));
    } catch {
      throw new Error(`artifact is not present in candidate commit ${candidateCommit}: ${relative}`);
    }
    committedBlob = committedBlob.trim();
    localBlob = localBlob.trim();
    if (committedBlob !== localBlob) throw new Error(`artifact differs from candidate commit ${candidateCommit}: ${relative}`);
  }
  return {
    path: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    git_blob: committedBlob,
    candidate_commit: candidateCommit,
    bytes: bytes.byteLength,
    committed_with_candidate: requireCommitted,
  };
}

async function screenshotRecords(repoRoot: string, objective: string, candidateCommit: string): Promise<ArtifactRecord[]> {
  const dir = path.join(repoRoot, "docs/screenshots", objective);
  let names: string[] = [];
  try { names = (await readdir(dir)).filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name)).sort(); } catch { return []; }
  return Promise.all(names.map((name) => artifact(repoRoot, path.join(dir, name), candidateCommit)));
}

async function readJsonIfPresent(file: string): Promise<Record<string, unknown> | null> {
  if (!(await exists(file))) return null;
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

export async function buildEvidenceManifest(
  repoRoot: string,
  gauntletVersion: string,
  acceptedAt: string,
  acceptanceRecord: string,
  input: EvidenceManifestInput,
): Promise<Record<string, unknown>> {
  const objective = String(input.objective_id);
  const candidateCommit = String(input.candidate_commit);
  const evidenceDir = path.join(repoRoot, "docs/evidence", objective);
  const screenshotDir = path.join(repoRoot, "docs/screenshots", objective);
  const trajectoryPath = path.join(evidenceDir, "trajectory.json");
  const auditPath = path.join(evidenceDir, "audit.json");
  const sequencePath = path.join(screenshotDir, "sequence.json");
  const videoPath = path.join(evidenceDir, "video-reference.json");

  const screenshots = await screenshotRecords(repoRoot, objective, candidateCommit);
  const trajectory = await exists(trajectoryPath) ? await artifact(repoRoot, trajectoryPath, candidateCommit) : null;
  const auditArtifact = await exists(auditPath) ? await artifact(repoRoot, auditPath, candidateCommit) : null;
  const sequenceArtifact = await exists(sequencePath) ? await artifact(repoRoot, sequencePath, candidateCommit) : null;
  const sequence = await readJsonIfPresent(sequencePath);
  const videoReferenceArtifact = await exists(videoPath) ? await artifact(repoRoot, videoPath, candidateCommit, false) : null;
  const video = await readJsonIfPresent(videoPath);

  if (video) {
    const required = ["objective_id", "artifact_id", "artifact_name", "provider", "created_at", "candidate_commit"];
    for (const key of required) if (!video[key]) throw new Error(`video-reference.json missing field: ${key}`);
    if (!("expires_at" in video)) throw new Error("video-reference.json missing field: expires_at");
    if (video.objective_id !== objective) throw new Error("video-reference objective_id mismatch");
    if (video.candidate_commit !== candidateCommit) throw new Error("video-reference candidate_commit mismatch");
  }

  return {
    schema_version: 1,
    gauntlet_version: gauntletVersion,
    objective_id: objective,
    accepted_at: acceptedAt,
    candidate_commit: candidateCommit,
    evidence_class: input.evidence_class ?? null,
    evidence: {
      screenshots,
      semantic_sequence: sequence ? { metadata: sequence, artifact: sequenceArtifact } : null,
      trajectory,
      deterministic_audit_artifact: auditArtifact,
      video: video ? { metadata: video, artifact: videoReferenceArtifact } : null,
      metrics: input.metrics ?? [],
    },
    reviews: {
      deterministic_audit: input.deterministic_audit,
      semantic_audit: input.semantic_audit ?? null,
      critic: input.critic,
      integration: input.integration,
    },
    acceptance_record: acceptanceRecord.replaceAll(path.sep, "/"),
  };
}

export async function writeEvidenceManifest(repoRoot: string, objective: string, manifest: Record<string, unknown>): Promise<string> {
  const dir = path.join(repoRoot, "docs/evidence", objective);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "manifest.json");
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return file;
}
