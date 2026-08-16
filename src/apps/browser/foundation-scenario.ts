/**
 * @module apps/browser/foundation-scenario
 *
 * Shared fixture — imports the foundation scenario from the versioned
 * JSON fixture used by both the headless runner and the browser
 * composition.  This replaces inlined copies of the scenario data.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import foundationScenarioJson from "@pes/eval/scenarios/foundation-move-and-roll.v1.json";
import twoPlayerScenarioJson from "@pes/eval/scenarios/two-player-duel.v1.json";
import aiVsAiScenarioJson from "@pes/eval/scenarios/ai-vs-ai-duel.v1.json";

/**
 * The foundation scenario — identical fixture used by the headless
 * runner and browser composition.  Loaded from the versioned JSON
 * at eval/scenarios/foundation-move-and-roll.v1.json.
 *
 * The inputProgram from the fixture is preserved as-is.
 */
export const FOUNDATION_SCENARIO: ScenarioDefinition =
  foundationScenarioJson as unknown as ScenarioDefinition;

/**
 * Two-player duel scenario — two human players on opposite teams.
 * Loaded from the versioned JSON at eval/scenarios/two-player-duel.v1.json.
 */
export const FOUNDATION_SCENARIO_TWO_PLAYER: ScenarioDefinition =
  twoPlayerScenarioJson as unknown as ScenarioDefinition;

/**
 * AI-vs-AI match scenario — two CPU-controlled players on opposite teams.
 * Both slots use AI_FALLBACK mode for fully autonomous CPU-vs-CPU play.
 * Loaded from the versioned JSON at eval/scenarios/ai-vs-ai-duel.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz) to allow meaningful match play.
 */
export const FOUNDATION_SCENARIO_AI_VS_AI: ScenarioDefinition =
  aiVsAiScenarioJson as unknown as ScenarioDefinition;
