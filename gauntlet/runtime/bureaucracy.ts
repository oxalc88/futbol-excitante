export type BureaucracyFailureClass = 'PRODUCT_FAILURE' | 'HARNESS_ENVIRONMENT' | 'UNKNOWN';
export type ChangeKind = 'product' | 'verification' | 'mixed' | 'administrative';
export type CurrentVerificationStatus = 'PASS' | 'FAIL' | 'NOT_RUN';

const PRODUCT_INPUT = /^(?:src\/|eval\/)/;
const VERIFICATION_INPUT = /^(?:tests\/|gauntlet\/runtime\/|gauntlet\/evals\/src\/|scripts\/(?:gauntlet|ci)\/|vitest\.config\.[cm]?ts$|package\.json$|pnpm-lock\.yaml$|mise\.(?:toml|lock)$)/;

export interface VerificationMaterial {
  product: boolean;
  verification: boolean;
  administrative_only: boolean;
  paths: string[];
}

export function verificationMaterial(paths: string[]): VerificationMaterial {
  const unique = [...new Set(paths.filter(Boolean))].sort();
  const product = unique.some(path => PRODUCT_INPUT.test(path));
  const verification = unique.some(path => VERIFICATION_INPUT.test(path));
  return { product, verification, administrative_only: !product && !verification, paths: unique };
}

/**
 * An incident owns one verification input state, not a repository boundary
 * forever. Bookkeeping alone cannot manufacture another execution.
 */
export function admitsCurrentVerification(failureClass: BureaucracyFailureClass, paths: string[]): boolean {
  const material = verificationMaterial(paths);
  if (material.administrative_only) return false;
  if (failureClass === 'PRODUCT_FAILURE') return material.product;
  return material.product || material.verification;
}

export interface BurdenCounts {
  mandatory_commands: number;
  canonical_writes: number;
  handoffs: number;
  full_suite_runs: number;
  retries: number;
  human_interventions: number;
  blocking_states: number;
  learning_obligations: number;
}

export interface BureaucracyEvalInput {
  current_verification: CurrentVerificationStatus;
  historical_incident: boolean;
  continuation_stop: boolean;
  deterministic_action_available: boolean;
  safe_product_work_available: boolean;
  change_kind: ChangeKind;
  product_progress_delta: number;
  candidate: BurdenCounts;
  baseline?: BurdenCounts;
}

export interface BureaucracyEvalResult {
  pass: boolean;
  hard_failures: string[];
  burden_delta: Partial<Record<keyof BurdenCounts, number>>;
}

/**
 * No aggregate score: each invariant remains visible so a low-cost metric
 * cannot compensate for a product-blocking regression.
 */
export function evaluateBureaucracy(input: BureaucracyEvalInput): BureaucracyEvalResult {
  const failures: string[] = [];
  if (input.current_verification === 'PASS' && input.continuation_stop) {
    failures.push('GREEN_CURRENT_STATE_MUST_NOT_STOP');
  }
  if (input.historical_incident && input.current_verification === 'PASS' && input.continuation_stop) {
    failures.push('HISTORY_CANNOT_OVERRIDE_CURRENT_PASS');
  }
  if ((input.deterministic_action_available || input.safe_product_work_available) && input.continuation_stop) {
    failures.push('SAFE_ACTION_FORBIDS_HUMAN_STOP');
  }
  if ((input.change_kind === 'verification' || input.change_kind === 'administrative') && input.product_progress_delta !== 0) {
    failures.push('MACHINERY_IS_NOT_PRODUCT_PROGRESS');
  }

  const burden_delta: Partial<Record<keyof BurdenCounts, number>> = {};
  if (input.baseline) {
    for (const key of Object.keys(input.candidate) as Array<keyof BurdenCounts>) {
      burden_delta[key] = input.candidate[key] - input.baseline[key];
    }
  }
  return { pass: failures.length === 0, hard_failures: failures, burden_delta };
}

export const ZERO_BURDEN: BurdenCounts = {
  mandatory_commands: 0,
  canonical_writes: 0,
  handoffs: 0,
  full_suite_runs: 0,
  retries: 0,
  human_interventions: 0,
  blocking_states: 0,
  learning_obligations: 0,
};
