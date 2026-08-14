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

/**
 * The foundation scenario — identical fixture used by the headless
 * runner and browser composition.  Loaded from the versioned JSON
 * at eval/scenarios/foundation-move-and-roll.v1.json.
 *
 * The inputProgram from the fixture is preserved as-is.
 */
export const FOUNDATION_SCENARIO: ScenarioDefinition =
  foundationScenarioJson as unknown as ScenarioDefinition;
