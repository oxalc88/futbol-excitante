import type { RateLimitBucketPolicy } from "./policy.js";

interface SuccessfulRequest {
  completedAtMs: number;
  inputTokens: number;
}

interface Reservation {
  reservedTokens: number;
}

export interface AdmissionRequest {
  requestId: string;
  role: string;
  estimatedInputTokens: number;
  nowMs: number;
}

export type AdmissionDecision =
  | { admitted: true; bucketId: string; reservedTokens: number; recentSuccessfulInput: number }
  | { admitted: false; bucketId: string; waitMs: number; recentSuccessfulInput: number; reason: "soft_tpm_limit" | "model_backoff" };

export class RollingTpmGovernor {
  private readonly successes: SuccessfulRequest[] = [];
  private readonly reservations = new Map<string, Reservation>();
  private maximumObservedSuccessfulInput = 0;
  private admissionWaits = 0;

  constructor(
    readonly bucketId: string,
    readonly policy: RateLimitBucketPolicy,
  ) {}

  reserve(request: AdmissionRequest): AdmissionDecision {
    if (!this.policy.roles.includes(request.role)) {
      throw new Error(`${request.role} is not assigned to shared bucket ${this.bucketId}`);
    }
    if (!Number.isFinite(request.estimatedInputTokens) || request.estimatedInputTokens <= 0) {
      throw new Error("estimatedInputTokens must be positive");
    }
    if (this.reservations.has(request.requestId)) throw new Error(`duplicate request reservation: ${request.requestId}`);

    this.prune(request.nowMs);
    const recentSuccessfulInput = this.recentSuccessfulInput();
    const pendingInput = [...this.reservations.values()].reduce((sum, item) => sum + item.reservedTokens, 0);
    const reservedTokens = Math.ceil(request.estimatedInputTokens * this.policy.reservation_multiplier);
    if (recentSuccessfulInput + pendingInput + reservedTokens > this.policy.soft_limit_input_tokens) {
      this.admissionWaits += 1;
      return {
        admitted: false,
        bucketId: this.bucketId,
        waitMs: this.waitUntilCapacity(request.nowMs, pendingInput + reservedTokens),
        recentSuccessfulInput,
        reason: "soft_tpm_limit",
      };
    }
    this.reservations.set(request.requestId, { reservedTokens });
    return { admitted: true, bucketId: this.bucketId, reservedTokens, recentSuccessfulInput };
  }

  recordSuccess(requestId: string, actualInputTokens: number, completedAtMs: number): void {
    if (!this.reservations.delete(requestId)) throw new Error(`missing request reservation: ${requestId}`);
    if (!Number.isFinite(actualInputTokens) || actualInputTokens < 0) throw new Error("actualInputTokens must be non-negative");
    this.successes.push({ completedAtMs, inputTokens: actualInputTokens });
    this.prune(completedAtMs);
    this.maximumObservedSuccessfulInput = Math.max(this.maximumObservedSuccessfulInput, this.recentSuccessfulInput());
  }

  cancel(requestId: string): void {
    this.reservations.delete(requestId);
  }

  snapshot(nowMs: number): { rolling60Input: number; rolling60Maximum: number; admissionGateWaits: number; reservations: number } {
    this.prune(nowMs);
    return {
      rolling60Input: this.recentSuccessfulInput(),
      rolling60Maximum: this.maximumObservedSuccessfulInput,
      admissionGateWaits: this.admissionWaits,
      reservations: this.reservations.size,
    };
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - this.policy.rolling_window_ms;
    while (this.successes.length > 0 && this.successes[0]!.completedAtMs <= cutoff) this.successes.shift();
  }

  private recentSuccessfulInput(): number {
    return this.successes.reduce((sum, item) => sum + item.inputTokens, 0);
  }

  private waitUntilCapacity(nowMs: number, requiredTokens: number): number {
    let remaining = this.recentSuccessfulInput();
    for (const request of this.successes) {
      remaining -= request.inputTokens;
      if (remaining + requiredTokens <= this.policy.soft_limit_input_tokens) {
        return Math.max(1, request.completedAtMs + this.policy.rolling_window_ms - nowMs);
      }
    }
    return this.policy.rolling_window_ms;
  }
}
