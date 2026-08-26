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
import scenario2v2Json from "@pes/eval/scenarios/2v2-duel.v1.json";
import humanVsCpuJson from "@pes/eval/scenarios/human-vs-cpu.v1.json";
import scenario2v2KeyboardJson from "@pes/eval/scenarios/2v2-with-keyboard.v1.json";
import scenario3v3Json from "@pes/eval/scenarios/3v3-fixture.v1.json";
import scenario5v5Json from "@pes/eval/scenarios/5v5-fixture-v1.json";
import humanVsCpu3v3Json from "@pes/eval/scenarios/human-vs-cpu-3v3.v1.json";
import humanVsCpu5v3Json from "@pes/eval/scenarios/human-vs-cpu-5v3.v1.json";
import humanVsCpu5v5Json from "@pes/eval/scenarios/5v5-human-vs-cpu.v1.json";
import humanVsCpu1v1Json from "@pes/eval/scenarios/human-vs-cpu-1v1.v1.json";

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

/**
 * AI-vs-AI 2v2 match scenario — 4 CPU-controlled players, 2 per team.
 * Both teams have two AI_FALLBACK slots for fully autonomous CPU-vs-CPU play.
 * Loaded from the versioned JSON at eval/scenarios/2v2-duel.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_2V2: ScenarioDefinition =
  scenario2v2Json as unknown as ScenarioDefinition;

/**
 * Human-vs-CPU 2v2 scenario — 4 players, slot-1 is keyboard-controlled
 * (HUMAN), slots 2–4 are AI_FALLBACK.  Provides a standalone
 * human-vs-CPU match experience in the browser.
 * Loaded from the versioned JSON at eval/scenarios/human-vs-cpu.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_HUMAN_VS_CPU: ScenarioDefinition =
  humanVsCpuJson as unknown as ScenarioDefinition;

/**
 * 2v2 keyboard scenario — 4 players (2v2 layout), slot-1 is keyboard-controlled
 * (HUMAN), slots 2–4 are AI_FALLBACK.  Provides a standalone 2v2 match
 * experience with keyboard override for the first player.
 * Loaded from the versioned JSON at eval/scenarios/2v2-with-keyboard.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_2V2_KEYBOARD: ScenarioDefinition =
  scenario2v2KeyboardJson as unknown as ScenarioDefinition;

/**
 * 3v3 fixture scenario — 6 CPU-controlled players, 3 per team.
 * Both teams have three AI_FALLBACK slots for fully autonomous CPU-vs-CPU play.
 * Loaded from the versioned JSON at eval/scenarios/3v3-fixture.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_3V3: ScenarioDefinition =
  scenario3v3Json as unknown as ScenarioDefinition;

/**
 * 5v5 fixture scenario — 10 CPU-controlled players, 5 per team.
 * Both teams have five AI_FALLBACK slots for fully autonomous CPU-vs-CPU play.
 * Loaded from the versioned JSON at eval/scenarios/5v5-fixture-v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_5V5: ScenarioDefinition =
  scenario5v5Json as unknown as ScenarioDefinition;

/**
 * Human-vs-CPU 3v3 scenario — 6 players (3 per team), slot-1 is keyboard-controlled
 * (HUMAN) for player-1 on team-a, slots 2–6 are AI_FALLBACK.
 * Provides a standalone 3v3 match with one human player and 5 CPU teammates/opponents.
 * Loaded from the versioned JSON at eval/scenarios/human-vs-cpu-3v3.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3: ScenarioDefinition =
  humanVsCpu3v3Json as unknown as ScenarioDefinition;

/**
 * Human-vs-CPU 5v3 scenario — 10 players (5 per team), slot-1 is keyboard-controlled
 * (HUMAN) for player-1 on team-a, slots 2–10 are AI_FALLBACK.
 * Provides a standalone 5v3 match with one human player and 4 CPU teammates + 5 CPU opponents.
 * Loaded from the versioned JSON at eval/scenarios/human-vs-cpu-5v3.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3: ScenarioDefinition =
  humanVsCpu5v3Json as unknown as ScenarioDefinition;

/**
 * Human-vs-CPU 5v5 scenario — 10 players (5 per team), slot-1 is keyboard-controlled
 * (HUMAN) for player-1 on team-a, slots 2–10 are AI_FALLBACK.
 * Provides a standalone 5v5 small-sided match with one human player controlling
 * team-a via keyboard + Tab switching, and 4 CPU teammates + 5 CPU opponents.
 * Loaded from the versioned JSON at eval/scenarios/5v5-human-vs-cpu.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5: ScenarioDefinition =
  humanVsCpu5v5Json as unknown as ScenarioDefinition;

/**
 * Human-vs-CPU 1v1 scenario — 2 players, slot-1 is keyboard-controlled
 * (HUMAN) for player-1 on team-a, slot-2 is AI_FALLBACK.
 * Provides a standalone 1v1 match with one human player vs one CPU opponent.
 * Loaded from the versioned JSON at eval/scenarios/human-vs-cpu-1v1.v1.json.
 * Duration is 5400 ticks (90 seconds at 60 Hz).
 */
export const FOUNDATION_SCENARIO_HUMAN_VS_CPU_1V1: ScenarioDefinition =
  humanVsCpu1v1Json as unknown as ScenarioDefinition;
