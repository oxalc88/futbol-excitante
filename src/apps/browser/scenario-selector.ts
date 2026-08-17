/**
 * @module apps/browser/scenario-selector
 *
 * Pure selector: decides which scenario fixture to load based on URL query
 * parameters.  No DOM, no side effects — safe to call in tests.
 *
 * Supported queries:
 *  - `?mode=2v2-ai`                → returns the 2v2 AI match scenario (shorthand)
 *  - `?mode=ai-match&scenario=2v2` → returns the 2v2 AI match scenario
 *  - `?mode=ai-match`              → returns the AI-vs-AI match scenario (all CPU)
 *  - `?mode=ai-match-5v5`          → returns the 5v5 AI match scenario
 *  - `?mode=human-vs-ai`           → returns the human-vs-CPU scenario (slot-1 keyboard, rest CPU)
 *  - `?mode=human-vs-ai-3v3`       → returns the 3v3 human-vs-CPU scenario (slot-1 keyboard, slots 2-6 CPU)
 *  - `?mode=human-vs-ai-5v3`       → returns the 5v3 human-vs-CPU scenario (slot-1 keyboard, slots 2-10 CPU)
 *  - `?mode=2v2`                   → returns the 2v2 keyboard scenario (slot-1 keyboard, slots 2-4 CPU)
 *  - `?scenario=two-player`        → returns the two-player duel scenario
 *  - `?slots=2` (alias)            → same as above
 *  - All other values (including empty search) → returns the foundation
 *    one-player scenario.
 */

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import { FOUNDATION_SCENARIO } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_TWO_PLAYER } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_2V2 } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_2V2_KEYBOARD } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_3V3 } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_5V5 } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3 } from "./foundation-scenario.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3 } from "./foundation-scenario.js";

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
    if (scenarioParam === "3v3-fixture") {
      return FOUNDATION_SCENARIO_3V3;
    }
    if (scenarioParam === "5v5-fixture") {
      return FOUNDATION_SCENARIO_5V5;
    }
    return FOUNDATION_SCENARIO_AI_VS_AI;
  }

  if (mode === "human-vs-ai") {
    return FOUNDATION_SCENARIO_HUMAN_VS_CPU;
  }

  if (mode === "human-vs-ai-3v3") {
    return FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3;
  }

  if (mode === "human-vs-ai-5v3") {
    return FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3;
  }

  if (mode === "2v2-ai") {
    return FOUNDATION_SCENARIO_2V2;
  }

  if (mode === "ai-match-3v3") {
    return FOUNDATION_SCENARIO_3V3;
  }

  if (mode === "ai-match-5v5") {
    return FOUNDATION_SCENARIO_5V5;
  }

  if (mode === "2v2") {
    return FOUNDATION_SCENARIO_2V2_KEYBOARD;
  }

  if (scenarioParam === "two-player" || scenarioParam === "2") {
    return FOUNDATION_SCENARIO_TWO_PLAYER;
  }

  if (scenarioParam === "2v2") {
    return FOUNDATION_SCENARIO_2V2;
  }

  return FOUNDATION_SCENARIO;
}