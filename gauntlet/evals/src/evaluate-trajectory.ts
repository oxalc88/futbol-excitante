import type { GauntletEventName } from "../contracts/events.js";

export interface TrajectoryCheck {
  pass: boolean;
  missing?: GauntletEventName;
}

export function containsOrderedTrajectory(
  observed: readonly GauntletEventName[],
  expected: readonly GauntletEventName[],
): TrajectoryCheck {
  let cursor = 0;
  for (const event of observed) {
    if (event === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return { pass: true };
  }

  return { pass: false, missing: expected[cursor] };
}
