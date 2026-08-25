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

declare module "@pes/eval/scenarios/ai-vs-ai-duel.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}

declare module "@pes/eval/scenarios/2v2-duel.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}

declare module "@pes/eval/scenarios/human-vs-cpu.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}

declare module "@pes/eval/scenarios/2v2-with-keyboard.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}

declare module "@pes/eval/scenarios/3v3-press-scenario.v1.json" {
  const value: Record<string, unknown>;
  export default value;
}
