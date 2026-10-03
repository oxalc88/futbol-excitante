import policy from '../runtime-policy.json';
// Tunable local safety budgets, not provider limits or claims about current quotas.
export type BuilderBudgetPolicy = typeof policy.builder_budget;
export const RUNTIME_POLICY = policy;
