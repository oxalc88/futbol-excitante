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
import type { DifficultyLevel } from "../../adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../adapters/input-browser/team-decision-profile.js";
import {
  closeControlsOverlay,
  initControlsLegendUi,
  setControlsHintText,
} from "./controls-legend-ui.js";

// ---------------------------------------------------------------------------
// Match mode configuration (for setup menu)
// ---------------------------------------------------------------------------

interface MatchModeEntry {
  /** Menu option value — matches the <option value="..."> in index.html. */
  modeId: string;
  /** The scenario to load. */
  scenario: ScenarioDefinition;
  /** The URL_MODE value that controls adapter wiring. */
  urlMode: string;
  /** Controls hint text shown during the match. */
  hint: string;
}

/**
 * Registry of all selectable match modes.
 * Imported scenarios are re-used from foundation-scenario.ts.
 */
import {
  FOUNDATION_SCENARIO,
  FOUNDATION_SCENARIO_AI_VS_AI,
  FOUNDATION_SCENARIO_2V2,
  FOUNDATION_SCENARIO_3V3,
  FOUNDATION_SCENARIO_5V5,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5,
  FOUNDATION_SCENARIO_HUMAN_VS_CPU_1V1,
} from "./foundation-scenario.js";

const MATCH_MODES: MatchModeEntry[] = [
  { modeId: "ai-match-5v5",     scenario: FOUNDATION_SCENARIO_5V5,             urlMode: "ai-match-5v5",     hint: "5v5 AI Match — fully autonomous" },
  { modeId: "human-vs-ai-5v5",  scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5, urlMode: "human-vs-ai-5v5",  hint: "5v5 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle" },
  { modeId: "human-vs-ai-5v3",  scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3, urlMode: "human-vs-ai-5v3",  hint: "5v3 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle" },
  { modeId: "ai-match-3v3",     scenario: FOUNDATION_SCENARIO_3V3,             urlMode: "ai-match-3v3",     hint: "3v3 AI Match — fully autonomous" },
  { modeId: "human-vs-ai-3v3",  scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3, urlMode: "human-vs-ai-3v3",  hint: "3v3 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle" },
  { modeId: "human-vs-ai",      scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU,    urlMode: "human-vs-ai",       hint: "2v2 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle" },
  { modeId: "2v2-ai",           scenario: FOUNDATION_SCENARIO_2V2,             urlMode: "2v2-ai",            hint: "2v2 AI Match — fully autonomous" },
  { modeId: "human-vs-ai-1v1",  scenario: FOUNDATION_SCENARIO_HUMAN_VS_CPU_1V1, urlMode: "human-vs-ai-1v1",  hint: "1v1 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle" },
  { modeId: "ai-match",         scenario: FOUNDATION_SCENARIO_AI_VS_AI,        urlMode: "ai-match",          hint: "1v1 AI Match — fully autonomous" },
];

/**
 * Look up a match mode entry by its modeId.
 * Falls back to the first entry if the id is not found.
 */
function resolveMatchMode(modeId: string): MatchModeEntry {
  return MATCH_MODES.find((m) => m.modeId === modeId) ?? MATCH_MODES[0];
}

// ---------------------------------------------------------------------------
// Module-level state (match lifecycle)
// ---------------------------------------------------------------------------

/** Active animation-frame handle for the running game loop (null when stopped). */
let activeFrameId: number | null = null;

/** Whether a match is currently running. */
let matchRunning = false;

// ---------------------------------------------------------------------------
// DOM elements — setup menu
// ---------------------------------------------------------------------------

const setupMenu = document.getElementById("setup-menu");
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement | null;
const teamANameInput = document.getElementById("team-a-name") as HTMLInputElement | null;
const teamBNameInput = document.getElementById("team-b-name") as HTMLInputElement | null;
const startButton = document.getElementById("start-button");
const backToMenuButton = document.getElementById("back-to-menu");
const difficultySelect = document.getElementById("difficulty-select") as HTMLSelectElement | null;

// ---------------------------------------------------------------------------
// Match stats accumulator
// ---------------------------------------------------------------------------

interface MatchStats {
  /** Possession ticks per team (indexed by teamId). */
  possessionTicks: Record<string, number>;
  /** Completed passes per team. */
  passes: Record<string, number>;
  /** Shots per team. */
  shots: Record<string, number>;
  /** Goals per team. */
  goals: Record<string, number>;
  /** Last team that touched the ball (for possession tracking). */
  lastPossessionTeamId: string | null;
  /** Total ticks with a known possession holder (for % calculation). */
  totalPossessionTicks: number;
}

function createEmptyStats(): MatchStats {
  return {
    possessionTicks: {},
    passes: {},
    shots: {},
    goals: {},
    lastPossessionTeamId: null,
    totalPossessionTicks: 0,
  };
}

/** Event kinds that indicate ball possession by a team. */
const POSSESSION_EVENTS = new Set([
  "player-ball-contact",
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
]);

/** Event kinds that count as passes completed. */
const PASS_EVENTS = new Set(["pass", "lofted-pass", "through-ball"]);

function processStatsEvent(stats: MatchStats, evt: import("../../contracts/scenario.js").SimulationEvent): void {
  const payload = evt.payload as Record<string, unknown>;
  const teamId = payload.teamId as string | undefined;

  // Track possession from ball-touching events.
  if (POSSESSION_EVENTS.has(evt.kind) && teamId) {
    stats.lastPossessionTeamId = teamId;
  }

  // Count passes.
  if (PASS_EVENTS.has(evt.kind) && teamId) {
    stats.passes[teamId] = (stats.passes[teamId] ?? 0) + 1;
  }

  // Count shots.
  if (evt.kind === "shot" && teamId) {
    stats.shots[teamId] = (stats.shots[teamId] ?? 0) + 1;
  }

  // Count goals — goalIndex 0 = team-a, 1 = team-b.
  if (evt.kind === "goal") {
    const goalIndex = (payload.goalIndex as number) ?? -1;
    const goalTeam = goalIndex === 0 ? "team-a" : "team-b";
    stats.goals[goalTeam] = (stats.goals[goalTeam] ?? 0) + 1;
  }
}

function tickPossession(stats: MatchStats): void {
  if (stats.lastPossessionTeamId) {
    const tid = stats.lastPossessionTeamId;
    stats.possessionTicks[tid] = (stats.possessionTicks[tid] ?? 0) + 1;
    stats.totalPossessionTicks++;
  }
}

// ---------------------------------------------------------------------------
// DOM elements — HUD / scoreboard (always exist in HTML)
// ---------------------------------------------------------------------------

const tickDisplay = document.getElementById("tick-display");
const hashDisplay = document.getElementById("hash-display");
const scoreboardClock = document.getElementById("scoreboard-clock");
const scoreboardScoreA = document.getElementById("scoreboard-score-a");
const scoreboardScoreB = document.getElementById("scoreboard-score-b");
const scoreboardNameA = document.getElementById("scoreboard-name-a");
const scoreboardNameB = document.getElementById("scoreboard-name-b");
const scoreboardEl = document.getElementById("scoreboard");
const scoreboardHalf = document.getElementById("scoreboard-half");
const hudEl = document.getElementById("hud");
const controlsHintEl = document.getElementById("controls-hint");
const gameContainerEl = document.getElementById("game-container");

// ---------------------------------------------------------------------------
// Match stats display (created once, reused across matches)
// ---------------------------------------------------------------------------

const statsPanel = document.createElement("div");
statsPanel.id = "match-stats-panel";
Object.assign(statsPanel.style, {
  position: "fixed",
  bottom: "14px",
  left: "14px",
  background: "rgba(0, 0, 0, 0.75)",
  borderRadius: "8px",
  padding: "12px 16px",
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "12px",
  color: "#ffffff",
  zIndex: "100",
  pointerEvents: "none",
  userSelect: "none",
  lineHeight: "1.6",
  minWidth: "200px",
});
statsPanel.innerHTML = `
  <div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Match Stats</div>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;">
        <th style="text-align:left;padding:2px 8px 2px 0;"></th>
        <th style="text-align:center;padding:2px 4px;">HOME</th>
        <th style="text-align:center;padding:2px 4px;">AWAY</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:2px 8px 2px 0;color:rgba(255,255,255,0.6);">Possession</td>
        <td id="stats-poss-a" style="text-align:center;padding:2px 4px;color:#4fc3f7;">0%</td>
        <td id="stats-poss-b" style="text-align:center;padding:2px 4px;color:#ef5350;">0%</td>
      </tr>
      <tr>
        <td style="padding:2px 8px 2px 0;color:rgba(255,255,255,0.6);">Shots</td>
        <td id="stats-shots-a" style="text-align:center;padding:2px 4px;color:#4fc3f7;">0</td>
        <td id="stats-shots-b" style="text-align:center;padding:2px 4px;color:#ef5350;">0</td>
      </tr>
      <tr>
        <td style="padding:2px 8px 2px 0;color:rgba(255,255,255,0.6);">Passes</td>
        <td id="stats-passes-a" style="text-align:center;padding:2px 4px;color:#4fc3f7;">0</td>
        <td id="stats-passes-b" style="text-align:center;padding:2px 4px;color:#ef5350;">0</td>
      </tr>
    </tbody>
  </table>
`;
document.body.appendChild(statsPanel);

const statsPossA = document.getElementById("stats-poss-a");
const statsPossB = document.getElementById("stats-poss-b");
const statsShotsA = document.getElementById("stats-shots-a");
const statsShotsB = document.getElementById("stats-shots-b");
const statsPassesA = document.getElementById("stats-passes-a");
const statsPassesB = document.getElementById("stats-passes-b");

// ---------------------------------------------------------------------------
// Difficulty HUD indicator (BROWSER-DIFFICULTY-SETTING)
// ---------------------------------------------------------------------------

const difficultyHud = document.createElement("div");
difficultyHud.id = "difficulty-hud";
Object.assign(difficultyHud.style, {
  position: "fixed",
  top: "14px",
  right: "14px",
  background: "rgba(0, 0, 0, 0.65)",
  borderRadius: "6px",
  padding: "4px 10px",
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "11px",
  color: "rgba(255, 255, 255, 0.7)",
  zIndex: "100",
  pointerEvents: "none",
  userSelect: "none",
  letterSpacing: "0.5px",
  display: "none",
});
difficultyHud.textContent = "Difficulty: Medium";
document.body.appendChild(difficultyHud);

// ---------------------------------------------------------------------------
// Controls legend — populated from the shared contract (see controls-legend-ui)
// ---------------------------------------------------------------------------

initControlsLegendUi(document);

// ---------------------------------------------------------------------------
// Match phase overlay (created once, reused across matches)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Overlay helpers
// ---------------------------------------------------------------------------

/**
 * Phase derivation — mirrors the headless runner logic.
 */
function derivePhase(tick: number, halfDurationTicks: number): string | null {
  if (tick === halfDurationTicks) return "halftime";
  if (tick === 2 * halfDurationTicks) return "fulltime";
  return null;
}

function showPhaseOverlay(text: string, color: string): void {
  matchPhaseOverlay.textContent = text;
  matchPhaseOverlay.style.color = color;
  matchPhaseOverlay.style.background = "rgba(0, 0, 0, 0.7)";
  void matchPhaseOverlay.offsetHeight;
  matchPhaseOverlay.style.opacity = "1";
  setTimeout(() => { matchPhaseOverlay.style.opacity = "0"; }, 1000);
}

function showGoalOverlay(teamLabel: string): void {
  goalOverlay.textContent = `GOAL! ${teamLabel}`;
  goalOverlay.style.color = "#ffffff";
  goalOverlay.style.background = "rgba(76, 175, 80, 0.9)";
  goalOverlay.style.textShadow = "2px 2px 4px rgba(0,0,0,0.5)";

  const sb = document.getElementById("scoreboard");
  if (sb) {
    sb.classList.add("scoreboard-goal-flash");
    setTimeout(() => { sb.classList.remove("scoreboard-goal-flash"); }, 800);
  }

  void goalOverlay.offsetHeight;
  goalOverlay.style.opacity = "1";
  if (goalOverlayTimeout !== null) clearTimeout(goalOverlayTimeout);
  goalOverlayTimeout = setTimeout(() => { goalOverlay.style.opacity = "0"; goalOverlayTimeout = null; }, 2000);
}

// ---------------------------------------------------------------------------
// Setup menu visibility
// ---------------------------------------------------------------------------

function showSetupMenu(): void {
  if (setupMenu) setupMenu.classList.remove("hidden");
  if (gameContainerEl) gameContainerEl.style.display = "none";
  if (scoreboardEl) scoreboardEl.classList.add("hidden");
  if (hudEl) hudEl.classList.add("hidden");
  if (controlsHintEl) controlsHintEl.classList.add("hidden");
  if (backToMenuButton) backToMenuButton.classList.add("hidden");
  closeControlsOverlay(document);
  statsPanel.style.display = "none";
  difficultyHud.style.display = "none";
}

function hideSetupMenu(): void {
  if (setupMenu) setupMenu.classList.add("hidden");
  if (gameContainerEl) gameContainerEl.style.display = "";
  if (scoreboardEl) scoreboardEl.classList.remove("hidden");
  if (hudEl) hudEl.classList.remove("hidden");
  if (controlsHintEl) controlsHintEl.classList.remove("hidden");
  if (backToMenuButton) backToMenuButton.classList.remove("hidden");
  statsPanel.style.display = "";
  difficultyHud.style.display = "";
}

// ---------------------------------------------------------------------------
// Match lifecycle
// ---------------------------------------------------------------------------

const FIXED_DT = 1 / 60;
const MAX_CATCHUP_TICKS = 5;

/**
 * Start a match with the given scenario, mode string, and display labels.
 *
 * Creates the world, simulation, adapters, renderer, and runs the
 * real-time game loop. Cancels any previously running match first.
 */
function startMatch(
  scenario: ScenarioDefinition,
  urlMode: string,
  teamALabel: string,
  teamBLabel: string,
  controlsHint: string,
  difficulty: DifficultyLevel = "medium",
): void {
  stopMatch();
  hideSetupMenu();

  // Derive mode flags from the resolved urlMode string.
  const IS_AI_MATCH = urlMode === "ai-match" || urlMode === "2v2-ai";
  const IS_HUMAN_VS_CPU = urlMode === "human-vs-ai";
  const IS_2V2 = urlMode === "2v2";
  const IS_AI_MATCH_3V3 = urlMode === "ai-match-3v3";
  const IS_AI_MATCH_5V5 = urlMode === "ai-match-5v5";
  const IS_HUMAN_VS_CPU_5V3 = urlMode === "human-vs-ai-5v3";
  const IS_HUMAN_VS_CPU_3V3 = urlMode === "human-vs-ai-3v3";
  const IS_HUMAN_VS_CPU_5V5 = urlMode === "human-vs-ai-5v5";
  const IS_HUMAN_VS_CPU_1V1 = urlMode === "human-vs-ai-1v1";

  const HALF_DURATION_TICKS = Math.floor(scenario.durationTicks / 2);

  // Update display labels.
  if (scoreboardNameA) scoreboardNameA.textContent = teamALabel;
  if (scoreboardNameB) scoreboardNameB.textContent = teamBLabel;
  setControlsHintText(document, controlsHint);

  // Update difficulty HUD indicator.
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  difficultyHud.textContent = `Difficulty: ${difficultyLabel}`;

  // 1. Create world from the scenario.
  const world = createWorld({ scenario });

  // 2. Create simulation (synchronous, DOM-free core).
  const sim: Simulation = createSimulation(world);

  // -------------------------------------------------------------------
  // Player switching — handled natively by sim.step() via SWITCH_PLAYER_BIT
  // -------------------------------------------------------------------

  // Track keyboard adapters (empty in AI-vs-AI mode).
  type AdapterEntry = { adapter: KeyboardAdapter; config: { controlSlot: string } };
  const adapters: AdapterEntry[] = [];

  // Track per-slot CPU adapters.
  type CpuSlotEntry = {
    adapter: ReturnType<typeof createCpuAdapter>;
    controlSlot: string;
    teamId: string;
    controlledPlayerId: string;
  };
  const cpuSlots: CpuSlotEntry[] = [];

  let cpuAdapter: ReturnType<typeof createCpuAdapter> | undefined;
  let cpuTeamId: string | undefined;
  let cpuControlledPlayerId: string | undefined;

  if (IS_AI_MATCH || IS_AI_MATCH_3V3 || IS_AI_MATCH_5V5) {
    for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
      cpuSlots.push({
        adapter: createCpuAdapter(),
        controlSlot: slotId,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
      });
    }
  } else if (IS_HUMAN_VS_CPU || IS_2V2 || IS_HUMAN_VS_CPU_5V3 || IS_HUMAN_VS_CPU_3V3 || IS_HUMAN_VS_CPU_5V5 || IS_HUMAN_VS_CPU_1V1) {
    for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
      if (assignment.mode === "HUMAN") {
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
    adapters.push({
      adapter: createKeyboardAdapter(DEFAULT_KEYBOARD_CONFIG),
      config: DEFAULT_KEYBOARD_CONFIG,
    });

    const hasTwoSlots =
      scenario.controlAssignments &&
      scenario.controlAssignments["slot-2"] !== undefined;

    if (hasTwoSlots) {
      const slot2Adapter = createKeyboardAdapter(DEFAULT_SLOT2_KEYBOARD_CONFIG);
      adapters.push({ adapter: slot2Adapter, config: DEFAULT_SLOT2_KEYBOARD_CONFIG });
    }

    for (const _slot of Object.keys(scenario.controlAssignments)) {
      const assignment = scenario.controlAssignments[_slot];
      if (assignment && assignment.mode !== "HUMAN") {
        cpuAdapter = createCpuAdapter();
        cpuTeamId = assignment.teamId;
        cpuControlledPlayerId = assignment.controlledPlayerId ?? undefined;
        break;
      }
    }

    for (const { adapter } of adapters) {
      adapter.connect(window);
    }
  }

  // 5. Create presentation session (Three.js renderer).
  const container = document.getElementById("game-container");
  if (!container) throw new Error("Game container element not found");
  const session = createPresentationSession(container);

  // 6. Render initial state.
  session.advance(sim.presentation(), sim.presentation(), { numerator: 0, denominator: 1 });
  session.render();

  // 7. Real-time loop — wall-clock accumulator, fixed core steps.
  let lastTime = performance.now();
  let accumulator = 0;
  let scoreA = 0;
  let scoreB = 0;
  let overlayShownForPhase = false;
  matchRunning = true;
  const matchStats = createEmptyStats();

  function gameLoop(now: number): void {
    if (!matchRunning) return;

    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    accumulator += Math.min(deltaTime, 0.1);

    let stepsThisFrame = 0;
    while (accumulator >= FIXED_DT && stepsThisFrame < MAX_CATCHUP_TICKS) {
      const allFrames: InputFrame[] = adapters.map(
        ({ adapter }) => adapter.sample(sim.tick),
      );

      // Player switching is handled natively by sim.step() via SWITCH_PLAYER_BIT.

      // CPU frames
      if (IS_AI_MATCH || IS_HUMAN_VS_CPU || IS_2V2 || IS_AI_MATCH_3V3 || IS_AI_MATCH_5V5 || IS_HUMAN_VS_CPU_5V3 || IS_HUMAN_VS_CPU_3V3 || IS_HUMAN_VS_CPU_5V5 || IS_HUMAN_VS_CPU_1V1) {
        const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
        const snapshot = sim.snapshot();
        for (const { teamId: tid, controlledPlayerId } of cpuSlots) {
          if (!teamDecisions.has(tid)) {
            const teamObs = buildCpuObservation(snapshot, tid, controlledPlayerId);
            teamObs.difficulty = difficulty;
            // The press designation the slots act on is decided under the same
            // switch the slots run with (5V5-KICKOFF-ANTI-HUDDLE).
            teamObs.cpuAntiHuddle = true;
            teamDecisions.set(tid, computeTeamDecision(teamObs, tid));
          }
        }

        for (const { adapter: cpuAd, controlSlot, teamId: tid, controlledPlayerId } of cpuSlots) {
          const obs = buildCpuObservation(snapshot, tid, controlledPlayerId);
          obs.difficulty = difficulty;
          obs.teamDecision = teamDecisions.get(tid);
          // This CPU controller exposes the defensive tackle buttons, exactly as
          // the human keyboard binding does (CPU-DEFENSIVE-TACKLE).
          obs.cpuDefensiveTackle = true;
          // Small-sided CPU matches run with the anti-huddle team shape: only
          // the designated chaser converges on the ball, everyone else holds a
          // fixed kickoff home (5V5-KICKOFF-ANTI-HUDDLE).
          obs.cpuAntiHuddle = true;
          const cpuFrame = cpuAd.sample(sim.tick, obs);
          cpuFrame.controlSlot = controlSlot;
          allFrames.push(cpuFrame);
        }
      } else if (cpuAdapter) {
        const obs = buildCpuObservation(sim.snapshot(), cpuTeamId, cpuControlledPlayerId);
        obs.difficulty = difficulty;
        obs.cpuDefensiveTackle = true;
        obs.cpuAntiHuddle = true;
        const cpuFrame = cpuAdapter.sample(sim.tick, obs);
        allFrames.push(cpuFrame);
      }

      sim.applyInputs(allFrames);
      const stepResult = sim.step();
      accumulator -= FIXED_DT;
      stepsThisFrame++;

      // Process events
      for (const evt of stepResult.events) {
        // Stats accumulation (pure derivation from event stream)
        processStatsEvent(matchStats, evt);

        if (evt.kind === "goal") {
          const goalIndex = (evt.payload.goalIndex as number) ?? -1;
          if (goalIndex === 0) scoreA++;
          else if (goalIndex === 1) scoreB++;
          const teamLabel = goalIndex === 0 ? teamALabel : teamBLabel;
          showGoalOverlay(teamLabel);

          // Score bump animation on the scoring team's number
          const scoreEl = goalIndex === 0 ? scoreboardScoreA : scoreboardScoreB;
          if (scoreEl) {
            scoreEl.classList.remove("bump");
            void scoreEl.offsetHeight;
            scoreEl.classList.add("bump");
            setTimeout(() => { scoreEl.classList.remove("bump"); }, 400);
          }
        }
      }

      // Possession tick — each step counts as one tick for the last-touching team.
      tickPossession(matchStats);

      // Match-phase transitions
      {
        const phase = derivePhase(sim.tick, HALF_DURATION_TICKS);
        if (phase !== null && !overlayShownForPhase) {
          overlayShownForPhase = true;
          if (phase === "halftime") showPhaseOverlay("HALF TIME", "#ffd700");
          else if (phase === "fulltime") showPhaseOverlay("FULL TIME", "#ff3333");
        } else if (phase === null) {
          overlayShownForPhase = false;
        }
      }
    }

    // Render
    const presentation = sim.presentation();
    session.advance(presentation, presentation, { numerator: 0, denominator: 1 });
    session.render();

    // HUD
    if (tickDisplay) tickDisplay.textContent = `Tick: ${sim.tick}`;
    if (hashDisplay) hashDisplay.textContent = `Hash: ${sim.stateHash().slice(0, 20)}...`;

    // Scoreboard
    if (scoreboardClock) {
      const totalSeconds = Math.floor(sim.tick * FIXED_DT);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      scoreboardClock.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    if (scoreboardHalf) {
      scoreboardHalf.textContent = sim.tick < HALF_DURATION_TICKS ? "1ST" : "2ND";
    }
    if (scoreboardScoreA) scoreboardScoreA.textContent = String(scoreA);
    if (scoreboardScoreB) scoreboardScoreB.textContent = String(scoreB);

    // Match stats display
    {
      const totalP = matchStats.totalPossessionTicks || 1;
      const pctA = Math.round(((matchStats.possessionTicks["team-a"] ?? 0) / totalP) * 100);
      const pctB = 100 - pctA;
      if (statsPossA) statsPossA.textContent = `${pctA}%`;
      if (statsPossB) statsPossB.textContent = `${pctB}%`;
      if (statsShotsA) statsShotsA.textContent = String(matchStats.shots["team-a"] ?? 0);
      if (statsShotsB) statsShotsB.textContent = String(matchStats.shots["team-b"] ?? 0);
      if (statsPassesA) statsPassesA.textContent = String(matchStats.passes["team-a"] ?? 0);
      if (statsPassesB) statsPassesB.textContent = String(matchStats.passes["team-b"] ?? 0);
    }

    activeFrameId = requestAnimationFrame(gameLoop);
  }

  activeFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Stop the currently running match and clean up resources.
 */
function stopMatch(): void {
  matchRunning = false;
  if (activeFrameId !== null) {
    cancelAnimationFrame(activeFrameId);
    activeFrameId = null;
  }
  // Note: we don't dispose the session here because startMatch creates a new one.
  // The old session will be garbage-collected once the game container is repopulated.
}

// ---------------------------------------------------------------------------
// Back-to-menu handler
// ---------------------------------------------------------------------------

if (backToMenuButton) {
  backToMenuButton.addEventListener("click", () => {
    stopMatch();
    showSetupMenu();
  });
}

// ---------------------------------------------------------------------------
// Setup menu → Start button handler
// ---------------------------------------------------------------------------

if (startButton) {
  startButton.addEventListener("click", () => {
    const modeId = modeSelect?.value ?? "ai-match-5v5";
    const entry = resolveMatchMode(modeId);
    const teamA = teamANameInput?.value?.trim() || "HOME";
    const teamB = teamBNameInput?.value?.trim() || "AWAY";
    const selectedDifficulty = (difficultySelect?.value ?? "medium") as DifficultyLevel;
    startMatch(entry.scenario, entry.urlMode, teamA, teamB, entry.hint, selectedDifficulty);
  });
}

// ---------------------------------------------------------------------------
// URL-parameter auto-start (fallback for headless/replay modes)
// ---------------------------------------------------------------------------

function hasUrlModeParams(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("mode") || params.has("scenario") || params.has("slots");
}

function getScenarioFromUrl(): { scenario: ScenarioDefinition; urlMode: string; hint: string; difficulty: DifficultyLevel } {
  const search = window.location.search;
  const scenario = selectBrowserScenario(search);
  const urlMode = new URLSearchParams(search).get("mode") ?? "";

  // Parse difficulty from URL (case-insensitive; invalid/absent → "medium").
  const rawDifficulty = (new URLSearchParams(search).get("difficulty") ?? "").toLowerCase();
  const difficulty: DifficultyLevel =
    rawDifficulty === "easy" || rawDifficulty === "hard" ? rawDifficulty : "medium";

  // Map URL mode to a display hint.
  const hintMap: Record<string, string> = {
    "ai-match": "1v1 AI Match — fully autonomous",
    "2v2-ai": "2v2 AI Match — fully autonomous",
    "human-vs-ai": "2v2 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
    "2v2": "2v2 Match — Arrow keys + Space to sprint",
    "ai-match-3v3": "3v3 AI Match — fully autonomous",
    "ai-match-5v5": "5v5 AI Match — fully autonomous",
    "human-vs-ai-5v3": "5v3 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
    "human-vs-ai-3v3": "3v3 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
    "human-vs-ai-5v5": "5v5 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
    "human-vs-ai-1v1": "1v1 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
  };

  return { scenario, urlMode, hint: hintMap[urlMode] ?? "", difficulty };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  if (hasUrlModeParams()) {
    // URL params present → auto-start the match (existing behavior).
    if (setupMenu) setupMenu.classList.add("hidden");
    const { scenario, urlMode, hint, difficulty } = getScenarioFromUrl();
    startMatch(scenario, urlMode, "HOME", "AWAY", hint, difficulty);
  } else {
    // No URL params → show the setup menu.
    showSetupMenu();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
