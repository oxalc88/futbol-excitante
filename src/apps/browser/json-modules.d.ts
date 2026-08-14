/**
 * Type declarations for JSON module imports used by the browser composition.
 *
 * Vite resolves JSON imports at bundling time. This declaration file
 * provides TypeScript with the module type for the scenario fixture
 * so type-checking passes with tsconfig.browser.json (which
 * excludes eval/).
 */
declare module "@pes/eval/scenarios/foundation-move-and-roll.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}

declare module "@pes/eval/scenarios/two-player-duel.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}
