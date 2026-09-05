import { SharedModelBackoff, type WakeEventKind } from "./backoff.js";
import { RollingTpmGovernor, type AdmissionDecision, type AdmissionRequest } from "./governor.js";
import { ChildWaitCoordinator, type ChildRuntimeEvent } from "./wait-coordinator.js";

export class GauntletRuntimeController {
  readonly waits = new ChildWaitCoordinator();

  constructor(
    readonly governor: RollingTpmGovernor,
    readonly backoff: SharedModelBackoff,
  ) {}

  handleChildEvent(event: ChildRuntimeEvent, nowMs: number): {
    wakeParentModel: boolean;
    waitMs: number;
    interruptChild: boolean;
  } {
    const decision = this.waits.handle(event);
    if (!decision.wakeParentModel) return { wakeParentModel: false, waitMs: 0, interruptChild: decision.interruptChild };
    const gated = this.backoff.gateWake(nowMs, "child_terminal");
    return { wakeParentModel: gated.allowed, waitMs: gated.waitMs, interruptChild: false };
  }

  handleWake(kind: WakeEventKind, nowMs: number): { wakeParentModel: boolean; waitMs: number } {
    const gated = this.backoff.gateWake(nowMs, kind);
    return { wakeParentModel: gated.allowed, waitMs: gated.waitMs };
  }

  admitInference(request: AdmissionRequest): AdmissionDecision {
    const backoff = this.backoff.gateWake(request.nowMs, "parent_wakeup");
    if (!backoff.allowed) {
      return {
        admitted: false,
        bucketId: this.governor.bucketId,
        waitMs: backoff.waitMs,
        recentSuccessfulInput: this.governor.snapshot(request.nowMs).rolling60Input,
        reason: "model_backoff",
      };
    }
    return this.governor.reserve(request);
  }
}
