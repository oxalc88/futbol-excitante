import type { RateLimitBucketPolicy } from "./policy.js";

export type WakeEventKind = "child_terminal" | "tool_terminal" | "parent_wakeup" | "user_message";

export interface BackoffSnapshot {
  incidentId: string | null;
  failureCount: number;
  blockedUntilMs: number;
  exhausted: boolean;
  queuedWakeKinds: WakeEventKind[];
  backoffEvents: number;
}

type Jitter = (baseDelayMs: number, jitterPercent: number, failureCount: number) => number;

export class SharedModelBackoff {
  private incidentId: string | null = null;
  private failureCount = 0;
  private blockedUntilMs = 0;
  private exhausted = false;
  private backoffEvents = 0;
  private readonly queuedWakeKinds = new Set<WakeEventKind>();

  constructor(
    readonly bucketId: string,
    private readonly policy: RateLimitBucketPolicy,
    private readonly jitter: Jitter = (delay) => delay,
  ) {}

  recordRateLimit(nowMs: number, logicalInferenceId: string): BackoffSnapshot {
    if (this.incidentId === null) this.incidentId = logicalInferenceId;
    this.failureCount += 1;
    this.backoffEvents += 1;
    if (this.failureCount >= this.policy.maximum_failures) {
      this.exhausted = true;
      this.blockedUntilMs = Number.POSITIVE_INFINITY;
      return this.snapshot();
    }
    const baseDelay = this.policy.backoff_delays_ms[Math.min(this.failureCount - 1, this.policy.backoff_delays_ms.length - 1)]!;
    const delay = Math.max(0, this.jitter(baseDelay, this.policy.jitter_percent, this.failureCount));
    this.blockedUntilMs = Math.max(this.blockedUntilMs, nowMs + delay);
    return this.snapshot();
  }

  gateWake(nowMs: number, kind: WakeEventKind): { allowed: boolean; waitMs: number; exhausted: boolean } {
    if (this.exhausted || nowMs < this.blockedUntilMs) {
      this.queuedWakeKinds.add(kind);
      return {
        allowed: false,
        waitMs: this.exhausted ? Number.POSITIVE_INFINITY : this.blockedUntilMs - nowMs,
        exhausted: this.exhausted,
      };
    }
    return { allowed: true, waitMs: 0, exhausted: false };
  }

  recordSuccess(): WakeEventKind[] {
    const queued = [...this.queuedWakeKinds];
    this.incidentId = null;
    this.failureCount = 0;
    this.blockedUntilMs = 0;
    this.exhausted = false;
    this.queuedWakeKinds.clear();
    return queued;
  }

  snapshot(): BackoffSnapshot {
    return {
      incidentId: this.incidentId,
      failureCount: this.failureCount,
      blockedUntilMs: this.blockedUntilMs,
      exhausted: this.exhausted,
      queuedWakeKinds: [...this.queuedWakeKinds],
      backoffEvents: this.backoffEvents,
    };
  }
}
