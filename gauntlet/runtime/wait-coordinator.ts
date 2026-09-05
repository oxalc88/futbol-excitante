export type ChildRuntimeEvent =
  | { kind: "child_started"; childId: string }
  | { kind: "child_progress"; childId: string; status?: string }
  | { kind: "status_heartbeat"; childId: string }
  | { kind: "child_terminal"; childId: string; status: "completed" | "failed" | "cancelled" }
  | { kind: "user_interrupt"; childId: string };

export interface ChildEventDecision {
  wakeParentModel: boolean;
  updateUi: boolean;
  interruptChild: boolean;
  reason: "registered" | "runtime_progress" | "terminal" | "duplicate_terminal" | "user_interrupt";
}

export class ChildWaitCoordinator {
  private readonly states = new Map<string, "running" | "terminal">();

  handle(event: ChildRuntimeEvent): ChildEventDecision {
    if (event.kind === "child_started") {
      this.states.set(event.childId, "running");
      return { wakeParentModel: false, updateUi: true, interruptChild: false, reason: "registered" };
    }
    if (event.kind === "user_interrupt") {
      return { wakeParentModel: false, updateUi: true, interruptChild: true, reason: "user_interrupt" };
    }
    if (event.kind === "child_progress" || event.kind === "status_heartbeat") {
      return { wakeParentModel: false, updateUi: true, interruptChild: false, reason: "runtime_progress" };
    }
    if (this.states.get(event.childId) === "terminal") {
      return { wakeParentModel: false, updateUi: true, interruptChild: false, reason: "duplicate_terminal" };
    }
    this.states.set(event.childId, "terminal");
    return { wakeParentModel: true, updateUi: true, interruptChild: false, reason: "terminal" };
  }

  isRunning(childId: string): boolean {
    return this.states.get(childId) === "running";
  }
}
