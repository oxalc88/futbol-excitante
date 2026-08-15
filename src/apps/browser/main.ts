/**
 * @module apps/browser/main
 *
 * Browser composition root — real-time adapter for the PES Simulator.
 *
 * Architecture:
 * - Imports the same simulation core and scenario as the headless runner.
 * - Uses a wall-clock accumulator to request zero or more fixed core steps.
 * - Never enlarges fixedDt or passes elapsed time into gameplay.
 * - Renders via Three.js from immutable PresentationSnapshot.
 * - Keyboard input is sampled into normalized tick-indexed InputFrames.
 *
 * No Math.random or Date in the simulation core.
 * This module is an adapter — it MAY use wall-clock time for pacing only.
 */

import { createWorld } from "../../simulation/world/create.js";
import { createSimulation } from "../../simulation/loop/simulation.js";
import { createPresentationSession } from "../../adapters/renderer-three/renderer.js";
import {
  createKeyboardAdapter,
  DEFAULT_KEYBOARD_CONFIG,
  DEFAULT_SLOT2_KEYBOARD_CONFIG,
  type KeyboardAdapter,
} from "../../adapters/input-browser/keyboard.js";
import { selectBrowserScenario } from "./scenario-selector.js";
import type { ScenarioDefinition } from "../../contracts/scenario.js";
import type { InputFrame } from "../../contracts/input.js";
import type { Simulation } from "../../simulation/loop/simulation.js";
import { createCpuAdapter, buildCpuObservation } from "../../adapters/input-browser/cpu-adapter.js";

// ---------------------------------------------------------------------------
// Scenario loading
// ---------------------------------------------------------------------------

/**
 * The scenario loaded for this browser session.
 *
 * Selected from URL query parameters so that `?scenario=two-player` loads
 * the two-player duel fixture and the default remains the one-player
 * foundation scenario.
 */
const SCENARIO_DATA: ScenarioDefinition = selectBrowserScenario(
  window.location.search,
);

// ---------------------------------------------------------------------------
// Real-time loop
// ---------------------------------------------------------------------------

/**
 * Fixed tick duration in seconds (from foundation config).
 * 1/60 second — never enlarged.
 */
const FIXED_DT = 1 / 60;

/**
 * Maximum accumulator catch-up ticks per frame.
 * Prevents spiral of death. Configurable/TBD.
 */
const MAX_CATCHUP_TICKS = 5;

/**
 * DOM elements for HUD display.
 */
const tickDisplay = document.getElementById("tick-display");
const hashDisplay = document.getElementById("hash-display");

/**
 * Main browser entry point.
 *
 * Creates the simulation, keyboard adapter(s), and renderer, then runs
 * the real-time loop using requestAnimationFrame + wall-clock accumulator.
 *
 * Supports both one-player (foundation) and two-player scenarios.
 * Keyboard adapters are created based on the scenario's controlAssignments.
 */
function main(): void {
  // Detect two-player mode from scenario controlAssignments.
  const hasTwoSlots =
    SCENARIO_DATA.controlAssignments &&
    SCENARIO_DATA.controlAssignments["slot-2"] !== undefined;

  // 1. Create world from the same scenario as headless.
  const world = createWorld({ scenario: SCENARIO_DATA });

  // 2. Create simulation (synchronous, DOM-free core).
  const sim: Simulation = createSimulation(world);

  // 3. Create keyboard adapters based on scenario assignments.
  type AdapterEntry = { adapter: KeyboardAdapter; config: { controlSlot: string } };
  const adapters: AdapterEntry[] = [
    { adapter: createKeyboardAdapter(DEFAULT_KEYBOARD_CONFIG), config: DEFAULT_KEYBOARD_CONFIG },
  ];

  if (hasTwoSlots) {
    const slot2Adapter = createKeyboardAdapter(DEFAULT_SLOT2_KEYBOARD_CONFIG);
    adapters.push({ adapter: slot2Adapter, config: DEFAULT_SLOT2_KEYBOARD_CONFIG });
  }

  // 3.5 Create CPU adapter for any non-HUMAN control slots.
  let cpuAdapter: ReturnType<typeof createCpuAdapter> | undefined;
  for (const _slot of Object.keys(SCENARIO_DATA.controlAssignments)) {
    const assignment = SCENARIO_DATA.controlAssignments[_slot];
    if (assignment && assignment.mode !== "HUMAN") {
      cpuAdapter = createCpuAdapter();
      break;
    }
  }

  // 4. Connect all keyboard adapters to window for physical input.
  for (const { adapter } of adapters) {
    adapter.connect(window);
  }

  // 5. Create presentation session (Three.js renderer).
  const container = document.getElementById("game-container");
  if (!container) {
    throw new Error("Game container element not found");
  }
  const session = createPresentationSession(container);

  // 6. Render initial state.
  session.advance(
    sim.presentation(),
    sim.presentation(),
    { numerator: 0, denominator: 1 },
  );
  session.render();

  // 7. Real-time loop — wall-clock accumulator, fixed core steps.
  let lastTime = performance.now();
  let accumulator = 0;

  function gameLoop(now: number): void {
    // Wall-clock delta (for pacing only — never passed to gameplay).
    const deltaTime = (now - lastTime) / 1000; // seconds
    lastTime = now;

    // Clamp delta to prevent spiral of death on tab-switch.
    accumulator += Math.min(deltaTime, 0.1);

    // Request zero or more fixed core steps.
    let stepsThisFrame = 0;
    while (accumulator >= FIXED_DT && stepsThisFrame < MAX_CATCHUP_TICKS) {
      // Sample all keyboard adapters into normalized InputFrames.
      const allFrames: InputFrame[] = adapters.map(
        ({ adapter, config }) => adapter.sample(sim.tick),
      );

      // Add CPU frame if a CPU adapter is present for AI_FALLBACK slots.
      if (cpuAdapter) {
        const obs = buildCpuObservation(sim.snapshot());
        const cpuFrame = cpuAdapter.sample(sim.tick, obs);
        allFrames.push(cpuFrame);
      }

      sim.applyInputs(allFrames);

      // Advance the simulation by one fixed tick.
      sim.step();
      accumulator -= FIXED_DT;
      stepsThisFrame++;
    }

    // Render from the latest presentation snapshot.
    const presentation = sim.presentation();
    session.advance(presentation, presentation, {
      numerator: 0,
      denominator: 1,
    });
    session.render();

    // Update HUD.
    if (tickDisplay) {
      tickDisplay.textContent = `Tick: ${sim.tick}`;
    }
    if (hashDisplay) {
      hashDisplay.textContent = `Hash: ${sim.stateHash().slice(0, 20)}...`;
    }

    // Continue loop.
    requestAnimationFrame(gameLoop);
  }

  // Start the loop.
  requestAnimationFrame(gameLoop);
}

// Initialize when DOM is ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
