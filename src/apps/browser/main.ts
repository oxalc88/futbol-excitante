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

/**
 * Detect AI-vs-AI match mode from URL: ?mode=ai-match
 *
 * When enabled, all control slots use CPU adapters (no keyboard input).
 * The match runs fully autonomously as a standalone viewer.
 */
const IS_AI_MATCH =
  new URLSearchParams(window.location.search).get("mode") === "ai-match";

/**
 * Detect human-vs-CPU match mode from URL: ?mode=human-vs-ai
 *
 * When enabled, slot-1 gets a keyboard adapter (HUMAN) and all other
 * slots get CPU adapters.  Provides a standalone human-vs-CPU match.
 */
const IS_HUMAN_VS_CPU =
  new URLSearchParams(window.location.search).get("mode") === "human-vs-ai";

/**
 * Detect 2v2 match mode from URL: ?mode=2v2
 *
 * When enabled, slot-1 gets a keyboard adapter (HUMAN) and slots 2-4
 * get CPU adapters.  Provides a 2v2 match with keyboard override for
 * the first player.
 */
const IS_2V2 =
  new URLSearchParams(window.location.search).get("mode") === "2v2";

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
 * DOM elements for scoreboard display.
 */
const scoreboardClock = document.getElementById("scoreboard-clock");
const scoreboardScoreA = document.getElementById("scoreboard-score-a");
const scoreboardScoreB = document.getElementById("scoreboard-score-b");
const scoreboardNameA = document.getElementById("scoreboard-name-a");
const scoreboardNameB = document.getElementById("scoreboard-name-b");

// ---------------------------------------------------------------------------
// Match phase overlay
// ---------------------------------------------------------------------------

/**
 * Half-duration in ticks — derived from the scenario's durationTicks,
 * matching the headless runner's default (Math.floor(durationTicks / 2)).
 */
const HALF_DURATION_TICKS = Math.floor(SCENARIO_DATA.durationTicks / 2);

/**
 * Overlay element for match phase transitions (half-time / full-time).
 * Created once and reused for each phase transition.
 */
const matchPhaseOverlay = document.createElement("div");
matchPhaseOverlay.id = "match-phase-overlay";
Object.assign(matchPhaseOverlay.style, {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: "1000",
  padding: "24px 48px",
  borderRadius: "12px",
  fontSize: "48px",
  fontWeight: "800",
  fontFamily: "system-ui, -apple-system, sans-serif",
  textAlign: "center",
  pointerEvents: "none",
  opacity: "0",
  transition: "opacity 2s ease-out",
  letterSpacing: "4px",
});
document.body.appendChild(matchPhaseOverlay);

/**
 * Goal overlay element — shows "GOAL! {team}" with auto-fade.
 * Created once, reused for each goal.
 */
const goalOverlay = document.createElement("div");
goalOverlay.id = "goal-overlay";
Object.assign(goalOverlay.style, {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: "1100",
  padding: "24px 48px",
  borderRadius: "12px",
  fontSize: "48px",
  fontWeight: "800",
  fontFamily: "system-ui, -apple-system, sans-serif",
  textAlign: "center",
  pointerEvents: "none",
  opacity: "0",
  transition: "opacity 2s ease-out",
  letterSpacing: "4px",
});
document.body.appendChild(goalOverlay);

/** Goal overlay fade timeout handle (for debounce on rapid goals). */
let goalOverlayTimeout: ReturnType<typeof setTimeout> | null = null;

/** Whether the current phase has already shown its overlay. */
let overlayShownForPhase = false;

/**
 * Phase derivation — mirrors the headless runner logic.
 *
 * @returns "halftime" | "fulltime" | null (no transition this tick).
 */
function derivePhase(tick: number): string | null {
  if (tick === HALF_DURATION_TICKS) {
    return "halftime";
  }
  if (tick === 2 * HALF_DURATION_TICKS) {
    return "fulltime";
  }
  return null;
}

/**
 * Show a match-phase overlay and schedule auto-fade.
 *
 * @param text  - overlay text (e.g. "HALF TIME").
 * @param color - text color.
 */
function showPhaseOverlay(text: string, color: string): void {
  matchPhaseOverlay.textContent = text;
  matchPhaseOverlay.style.color = color;
  matchPhaseOverlay.style.background =
    "rgba(0, 0, 0, 0.7)";
  // Force reflow so the transition triggers on each show.
  void matchPhaseOverlay.offsetHeight;
  matchPhaseOverlay.style.opacity = "1";

  // Auto-fade after a short display period.
  setTimeout(() => {
    matchPhaseOverlay.style.opacity = "0";
  }, 1000);
}

/**
 * Show a goal overlay with team name and auto-fade.
 *
 * @param teamLabel - team name to display (e.g. "HOME" or "AWAY").
 * @param scoreTeamA - whether this was scored by team A (for scoreboard flash).
 */
function showGoalOverlay(
  teamLabel: string,
  scoreTeamA: boolean,
): void {
  goalOverlay.textContent = `GOAL! ${teamLabel}`;
  goalOverlay.style.color = "#ffffff";
  goalOverlay.style.background = "rgba(76, 175, 80, 0.9)";
  goalOverlay.style.textShadow = "2px 2px 4px rgba(0,0,0,0.5)";

  // Flash scoreboard
  const scoreboardEl = document.getElementById("scoreboard");
  if (scoreboardEl) {
    scoreboardEl.classList.add("scoreboard-goal-flash");
    // Remove the flash class after animation
    setTimeout(() => {
      scoreboardEl.classList.remove("scoreboard-goal-flash");
    }, 800);
  }

  // Force reflow so the transition triggers.
  void goalOverlay.offsetHeight;
  goalOverlay.style.opacity = "1";

  // Clear any previous fade timeout.
  if (goalOverlayTimeout !== null) {
    clearTimeout(goalOverlayTimeout);
  }

  // Auto-fade after 2 seconds.
  goalOverlayTimeout = setTimeout(() => {
    goalOverlay.style.opacity = "0";
    goalOverlayTimeout = null;
  }, 2000);
}

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

  // Track keyboard adapters (empty in AI-vs-AI mode).
  type AdapterEntry = { adapter: KeyboardAdapter; config: { controlSlot: string } };
  const adapters: AdapterEntry[] = [];

  // Track per-slot CPU adapters for AI-vs-AI mode.
  type CpuSlotEntry = {
    adapter: ReturnType<typeof createCpuAdapter>;
    controlSlot: string;
    teamId: string;
    controlledPlayerId: string;
  };
  const cpuSlots: CpuSlotEntry[] = [];

  // Legacy single-CPU adapter for mixed HUMAN/AI scenarios.
  let cpuAdapter: ReturnType<typeof createCpuAdapter> | undefined;
  let cpuTeamId: string | undefined;
  let cpuControlledPlayerId: string | undefined;

  if (IS_AI_MATCH) {
    // AI-vs-AI mode: create a CPU adapter for every control slot.
    for (const [slotId, assignment] of Object.entries(SCENARIO_DATA.controlAssignments)) {
      cpuSlots.push({
        adapter: createCpuAdapter(),
        controlSlot: slotId,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
      });
    }
  } else if (IS_HUMAN_VS_CPU || IS_2V2) {
    // Human-vs-CPU / 2v2 mode: keyboard adapter for HUMAN slots, CPU adapters for AI_FALLBACK.
    for (const [slotId, assignment] of Object.entries(SCENARIO_DATA.controlAssignments)) {
      if (assignment.mode === "HUMAN") {
        // First HUMAN slot gets default keyboard config.
        const isFirstHuman = adapters.length === 0;
        adapters.push({
          adapter: createKeyboardAdapter(
            isFirstHuman ? DEFAULT_KEYBOARD_CONFIG : DEFAULT_SLOT2_KEYBOARD_CONFIG,
          ),
          config: isFirstHuman ? DEFAULT_KEYBOARD_CONFIG : DEFAULT_SLOT2_KEYBOARD_CONFIG,
        });
        adapters[adapters.length - 1].adapter.connect(window);
      } else {
        cpuSlots.push({
          adapter: createCpuAdapter(),
          controlSlot: slotId,
          teamId: assignment.teamId,
          controlledPlayerId: assignment.controlledPlayerId ?? "",
        });
      }
    }
  } else {
    // Human mode: create keyboard adapters for HUMAN slots.
    adapters.push({
      adapter: createKeyboardAdapter(DEFAULT_KEYBOARD_CONFIG),
      config: DEFAULT_KEYBOARD_CONFIG,
    });

    if (hasTwoSlots) {
      const slot2Adapter = createKeyboardAdapter(DEFAULT_SLOT2_KEYBOARD_CONFIG);
      adapters.push({ adapter: slot2Adapter, config: DEFAULT_SLOT2_KEYBOARD_CONFIG });
    }

    // Create CPU adapter for any non-HUMAN control slots.
    for (const _slot of Object.keys(SCENARIO_DATA.controlAssignments)) {
      const assignment = SCENARIO_DATA.controlAssignments[_slot];
      if (assignment && assignment.mode !== "HUMAN") {
        cpuAdapter = createCpuAdapter();
        cpuTeamId = assignment.teamId;
        cpuControlledPlayerId = assignment.controlledPlayerId ?? undefined;
        break;
      }
    }

    // 4. Connect all keyboard adapters to window for physical input.
    for (const { adapter } of adapters) {
      adapter.connect(window);
    }
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

  // Scoreboard state — pure derivation from simulation events.
  let scoreA = 0;
  let scoreB = 0;

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

      // Add CPU frames — per-slot adapters in AI-vs-AI, human-vs-CPU, or 2v2 modes.
      if (IS_AI_MATCH || IS_HUMAN_VS_CPU || IS_2V2) {
        for (const { adapter: cpuAd, controlSlot, teamId: tid, controlledPlayerId } of cpuSlots) {
          const obs = buildCpuObservation(sim.snapshot(), tid, controlledPlayerId);
          const cpuFrame = cpuAd.sample(sim.tick, obs);
          // Override controlSlot to match the scenario's slot key so
          // the simulation routes the frame to the correct player.
          cpuFrame.controlSlot = controlSlot;
          allFrames.push(cpuFrame);
        }
      } else if (cpuAdapter) {
        // Legacy single-CPU adapter for mixed HUMAN/AI scenarios.
        const obs = buildCpuObservation(sim.snapshot(), cpuTeamId, cpuControlledPlayerId);
        const cpuFrame = cpuAdapter.sample(sim.tick, obs);
        allFrames.push(cpuFrame);
      }

      sim.applyInputs(allFrames);

      // Advance the simulation by one fixed tick.
      const stepResult = sim.step();
      accumulator -= FIXED_DT;
      stepsThisFrame++;

      // Process goal events from this step.
      for (const evt of stepResult.events) {
        if (evt.kind === "goal") {
          const goalIndex = (evt.payload.goalIndex as number) ?? -1;
          if (goalIndex === 0) {
            scoreA++;
          } else if (goalIndex === 1) {
            scoreB++;
          }
          // Show goal overlay — derive team name from goal index.
          const teamLabel = goalIndex === 0 ? "HOME" : "AWAY";
          showGoalOverlay(teamLabel, goalIndex === 0);
        }
      }

      // Check for match-phase transitions.
      {
        const phase = derivePhase(sim.tick);
        if (phase !== null && !overlayShownForPhase) {
          overlayShownForPhase = true;
          if (phase === "halftime") {
            showPhaseOverlay("HALF TIME", "#ffd700");
          } else if (phase === "fulltime") {
            showPhaseOverlay("FULL TIME", "#ff3333");
          }
        } else if (phase === null) {
          // Reset when we leave a transition tick.
          overlayShownForPhase = false;
        }
      }
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

    // Update scoreboard — match clock derived from tick, scores from events.
    if (scoreboardClock) {
      const totalSeconds = Math.floor(sim.tick * FIXED_DT);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      scoreboardClock.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    if (scoreboardScoreA) {
      scoreboardScoreA.textContent = String(scoreA);
    }
    if (scoreboardScoreB) {
      scoreboardScoreB.textContent = String(scoreB);
    }

    // Continue loop.
    requestAnimationFrame(gameLoop);
  }

  // Start the loop.
  requestAnimationFrame(gameLoop);

  // Update controls hint for AI-vs-AI mode.
  if (IS_AI_MATCH) {
    const hint = document.getElementById("controls-hint");
    if (hint) {
      hint.textContent = "AI-vs-AI Match — fully autonomous";
    }
  }

  // Update controls hint for human-vs-CPU mode.
  if (IS_HUMAN_VS_CPU) {
    const hint = document.getElementById("controls-hint");
    if (hint) {
      hint.textContent = "Human vs CPU — Arrow keys + Space to sprint";
    }
  }

  // Update controls hint for 2v2 mode.
  if (IS_2V2) {
    const hint = document.getElementById("controls-hint");
    if (hint) {
      hint.textContent = "2v2 Match — Arrow keys + Space to sprint";
    }
  }
}

// Initialize when DOM is ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
