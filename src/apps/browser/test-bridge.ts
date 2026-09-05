/**
 * @module apps/browser/test-bridge
 *
 * Test-only bridge for browser evaluation — provides deterministic
 * control over the simulation and presentation for Vitest Browser Mode.
 *
 * Capabilities:
 *  - reset: recreate simulation and presentation from the foundation scenario.
 *  - step: advance simulation by exact tick count.
 *  - injectInputs: inject normalized InputFrames (bypasses physical keyboard).
 *  - snapshot: return deep-frozen world state.
 *  - stateHash: return deterministic state hash.
 *  - capture: capture presentation state (screenshot via WebGL readPixels).
 *  - presentationSnapshot: return immutable PresentationSnapshot.
 *  - renderFrame: render a single frame without advancing simulation.
 *
 * Constraints:
 *  - Test/replay injection bypasses physical input and uses the same InputFrame contract.
 *  - Camera, scene graph, interpolation, keyboard state, and renderer objects
 *    cannot mutate the world or alter state hashes.
 *  - The bridge is excluded from production authority and uses the same core.
 *
 * No Math.random, Date, or Node I/O in the simulation core.
 */

import { createWorld } from "../../simulation/world/create.js";
import { createSimulation } from "../../simulation/loop/simulation.js";
import { createPresentationSession } from "../../adapters/renderer-three/renderer.js";
import { FOUNDATION_SCENARIO } from "./foundation-scenario.js";
import type { Simulation } from "../../simulation/loop/simulation.js";
import type { PresentationSession } from "../../adapters/renderer-three/renderer.js";
import type { InputFrame } from "../../contracts/input.js";
import type { WorldState } from "../../contracts/state.js";
import type { PresentationSnapshot } from "../../contracts/presentation.js";
import { buildCpuObservation, createCpuAdapter } from "../../adapters/input-browser/cpu-adapter.js";
import type { DifficultyLevel } from "../../adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../adapters/input-browser/team-decision-profile.js";

// ---------------------------------------------------------------------------
// Test bridge interface
// ---------------------------------------------------------------------------

/**
 * Capture result — contains presentation state and screenshot data.
 */
export interface CaptureResult {
  /** Presentation snapshot at capture time. */
  presentationSnapshot: PresentationSnapshot;
  /** Screenshot as a data URL (base64 PNG). */
  screenshot: string;
  /** Scene object count (diagnostics). */
  sceneObjectCount: number;
  /** Camera position (diagnostics). */
  cameraPosition: { x: number; y: number; z: number };
}

/**
 * Test bridge — deterministic control over simulation and presentation.
 */
export interface TestBridge {
  /**
   * Reset the simulation and presentation to the initial state.
   *
   * Creates a fresh world from the foundation scenario, creates a new
   * simulation, and resets the presentation session.  Returns a ready
   * receipt when the scene is initialized.
   */
  reset(): Promise<void>;

  /**
   * Advance the simulation by exact tick count.
   *
   * @param ticks - Number of ticks to advance (must be >= 0).
   * @returns Array of per-tick state hashes.
   */
  step(ticks: number): string[];

  /** Advance with the same per-slot CPU wiring used by the AI-match browser. */
  stepWithCpuControllers(ticks: number): string[];

  /**
   * Inject normalized InputFrames for specific ticks.
   *
   * Frames are buffered and resolved during the next step() that
   * covers their target tick.
   *
   * @param frames - Input frames to inject.
   */
  injectInputs(frames: InputFrame[]): void;

  /**
   * Return a deep-frozen clone of the current world state.
   */
  snapshot(): WorldState;

  /**
   * Return a deterministic hash of the current world state.
   */
  stateHash(): string;

  /**
   * Capture the current presentation state — screenshot + diagnostics.
   *
   * @param presentation - Optional presentation snapshot to render instead of
   *   the simulation's own derived snapshot.  Used for presentation-only
   *   enrichment (e.g. the keeper-role marker); the simulation is untouched.
   * @returns CaptureResult with screenshot and diagnostics.
   */
  capture(presentation?: PresentationSnapshot): Promise<CaptureResult>;

  /**
   * Render a single frame without advancing the simulation.
   *
   * Useful for visual diagnostics after step().
   */
  renderFrame(): void;

  /**
   * Get the underlying simulation (for advanced testing).
   */
  getSimulation(): Simulation;

  /**
   * Get the underlying presentation session (for advanced testing).
   */
  getPresentationSession(): PresentationSession;

  /**
   * Get the Three.js scene for traversal and diagnostics.
   */
  getScene(): import("three").Scene;
}

// ---------------------------------------------------------------------------
// Test bridge implementation
// ---------------------------------------------------------------------------

/**
 * Create a test bridge for browser evaluation.
 *
 * @param container - DOM element for the renderer.
 * @param scenario - Optional scenario to load instead of the default
 *   foundation scenario.  When omitted, the bridge uses
 *   `FOUNDATION_SCENARIO`.
 * @param difficulty - Optional difficulty level for CPU adapters.
 * @param rendererConfig - Optional renderer config override.  When omitted,
 *   the bridge uses DEFAULT_RENDERER_CONFIG (camera position (0,30,40),
 *   fov 50).  Passing a custom config changes only the presentation layer
 *   (camera, colours, etc.) and does NOT affect football outcomes.
 * @returns A TestBridge instance.
 */
export function createTestBridge(
  container: HTMLElement,
  scenario?: import("../../contracts/scenario.js").ScenarioDefinition,
  difficulty?: DifficultyLevel,
  rendererConfig?: import("../../adapters/renderer-three/renderer.js").RendererConfig,
): TestBridge {
  let sim: Simulation;
  let session: PresentationSession;

  /**
   * Initialize the simulation and presentation from the foundation scenario.
   */
  function initSimulation(): void {
    const world = createWorld({ scenario: scenario ?? FOUNDATION_SCENARIO });
    sim = createSimulation(world);
    session = createPresentationSession(container, rendererConfig);
  }

  // Initialize on creation.
  initSimulation();

  const cpuEntries = Object.entries((scenario ?? FOUNDATION_SCENARIO).controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId,
      adapter: createCpuAdapter(),
    }));

  const bridge: TestBridge = {
    async reset(): Promise<void> {
      // Dispose existing presentation session.
      if (session) {
        session.dispose();
      }

      // Create fresh simulation and presentation.
      initSimulation();

      // Reset presentation — clear scene, await ready.
      await session.reset();

      // Render initial state.
      const initialPresentation = sim.presentation();
      session.advance(
        initialPresentation,
        initialPresentation,
        { numerator: 0, denominator: 1 },
      );
      session.render();
    },

    step(ticks: number): string[] {
      const hashes: string[] = [];

      for (let i = 0; i < ticks; i++) {
        const result = sim.step();
        hashes.push(result.stateHash);
      }

      return hashes;
    },

    stepWithCpuControllers(ticks: number): string[] {
      const hashes: string[] = [];
      for (let i = 0; i < ticks; i++) {
        const snapshot = sim.snapshot();

        // Compute one team decision per team from any observation on that team.
        const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
        for (const entry of cpuEntries) {
          if (!teamDecisions.has(entry.teamId)) {
            const teamObs = buildCpuObservation(
              snapshot,
              entry.teamId,
              entry.controlledPlayerId,
            );
            if (difficulty) teamObs.difficulty = difficulty;
            teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
          }
        }

        const frames = cpuEntries.map((entry) => {
          const observation = buildCpuObservation(
            snapshot,
            entry.teamId,
            entry.controlledPlayerId,
          );
          if (difficulty) observation.difficulty = difficulty;
          observation.teamDecision = teamDecisions.get(entry.teamId);
          const frame = entry.adapter.sample(sim.tick, observation);
          frame.controlSlot = entry.controlSlot;
          return frame;
        });
        sim.applyInputs(frames);
        hashes.push(sim.step().stateHash);
      }
      return hashes;
    },

    injectInputs(frames: InputFrame[]): void {
      sim.applyInputs(frames);
    },

    snapshot(): WorldState {
      return sim.snapshot();
    },

    stateHash(): string {
      return sim.stateHash();
    },

    async capture(presentation?: PresentationSnapshot): Promise<CaptureResult> {
      // Render the current state (or the provided presentation-only override).
      const view = presentation ?? sim.presentation();
      session.advance(
        view,
        view,
        { numerator: 0, denominator: 1 },
      );
      session.render();

      // Capture screenshot via WebGL readPixels.
      const renderer = session.getRenderer();
      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Convert to data URL via canvas.
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imageData = ctx.createImageData(width, height);
        // WebGL readPixels returns bottom-up, canvas is top-down — flip.
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = ((height - 1 - y) * width + x) * 4;
            const dstIdx = (y * width + x) * 4;
            imageData.data[dstIdx] = pixels[srcIdx];
            imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
            imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
            imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      const screenshot = canvas.toDataURL("image/png");

      // Diagnostics.
      const scene = session.getScene();
      const camera = session.getCamera();

      return {
        presentationSnapshot: view,
        screenshot,
        sceneObjectCount: scene.children.length,
        cameraPosition: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
      };
    },

    renderFrame(): void {
      const presentation = sim.presentation();
      session.advance(
        presentation,
        presentation,
        { numerator: 0, denominator: 1 },
      );
      session.render();
      // Flush the GPU pipeline so the canvas reflects the current tick
      // before any subsequent screenshot or readPixels call.
      try {
        const gl = session.getRenderer().getContext();
        gl.finish();
      } catch {
        /* WebGL context unavailable — no-op */
      }
    },

    getSimulation(): Simulation {
      return sim;
    },

    getPresentationSession(): PresentationSession {
      return session;
    },

    getScene(): import("three").Scene {
      return session.getScene();
    },
  };

  return bridge;
}
