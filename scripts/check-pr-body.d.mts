/** Types for scripts/check-pr-body.mjs, used by the TypeScript tests. */
export const SECTIONS: readonly string[];
export function verifySteps(script: string): string[];
export function sections(body: string | null | undefined): Record<string, string>;
export function checkPrBody(body: string | null | undefined, steps: readonly string[]): { ok: boolean; errors: string[] };
