/**
 * @module apps/browser/scenario-selector
 *
 * Pure selector: decides which scenario fixture to load based on URL query
 * parameters.  No DOM, no side effects — safe to call in tests.
 *
 * Supported queries:
 *  - `?mode=ai-match&scenario=2v2`  → returns the 2v2 AI match scenario
 *  - `?mode=ai-match`               → returns the AI-vs-AI match scenario (all CPU)
 *  - `?mode=human-vs-ai`            → returns the human-vs-CPU scenario (slot-1 keyboard, rest CPU)
 *  - `?scenario=two-player`         → returns the two-player duel scenario
 *  - `?slots=2` (alias)             → same as above
 *  - All other values (including empty search) → returns the foundation
 *    one-player scenario.
 */

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import { FOUNDATION_SCENARIO } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_TWO_PLAYER } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_2V2 } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU } from "./foundation-scenario.js";

/**
 * Select a scenario from the URL search string.
 *
 * @param search — the raw `search` portion of a URL (e.g. `?scenario=two-player`
 *                 or `""`).
 * @returns the `ScenarioDefinition` to use for the current browser session.
 */
export function selectBrowserScenario(search: string): ScenarioDefinition {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const scenarioParam = params.get("scenario") ?? params.get("slots");

  if (mode === "ai-match") {
    if (scenarioParam === "2v2") {
      return FOUNDATION_SCENARIO_2V2;
    }
    return FOUNDATION_SCENARIO_AI_VS_AI;
  }

  if (mode === "human-vs-ai") {
    return FOUNDATION_SCENARIO_HUMAN_VS_CPU;
  }

  if (scenarioParam === "two-player" || scenarioParam === "2") {
    return FOUNDATION_SCENARIO_TWO_PLAYER;
  }

  if (scenarioParam === "2v2") {
    return FOUNDATION_SCENARIO_2V2;
  }

  return FOUNDATION_SCENARIO;
}