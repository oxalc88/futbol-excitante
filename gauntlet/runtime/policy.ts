import policyJson from "../runtime-policy.json";

export interface RateLimitBucketPolicy {
  provider: string;
  model: string;
  roles: string[];
  rolling_window_ms: number;
  hard_limit_input_tokens: number;
  soft_limit_input_tokens: number;
  reservation_multiplier: number;
  backoff_delays_ms: number[];
  jitter_percent: number;
  maximum_failures: number;
}

export interface BuilderBudgetPolicy {
  context_soft_limit_tokens: number;
  cumulative_input_soft_limit_tokens: number;
  generation_soft_limit: number;
}

export interface RuntimePolicy {
  schema_version: number;
  event_driven_waiting: {
    enabled: boolean;
    model_wake_events: string[];
    runtime_only_events: string[];
    coalesce_terminal_events: boolean;
  };
  rate_limit_buckets: Record<string, RateLimitBucketPolicy>;
  builder_budgets: Record<string, BuilderBudgetPolicy>;
  memory: {
    search_preview_limit: number;
    initial_topic_limit: number;
    summary_max_characters: number;
    body_max_characters: number;
  };
  objective_context: {
    target_min_tokens: number;
    maximum_tokens: number;
    mapper_search_limit: number;
    mapper_file_limit: number;
    small_task_file_limit: number;
  };
  builder_checkpoint: { maximum_tokens: number };
  verification: { failure_excerpt_lines: number };
}

export const RUNTIME_POLICY = policyJson as RuntimePolicy;

export function quotaBucketForRole(role: string, provider: string, model: string): string | null {
  for (const [bucketId, bucket] of Object.entries(RUNTIME_POLICY.rate_limit_buckets)) {
    if (bucket.provider === provider && bucket.model === model && bucket.roles.includes(role)) return bucketId;
  }
  return null;
}
