/**
 * @module @pes/adapters/renderer-three/renderer
 *
 * Three.js renderer adapter — consumes immutable PresentationSnapshot
 * and produces a visual output without mutating simulation state.
 *
 * Responsibilities:
 *  - Create and manage the Three.js scene, camera, and renderer.
 *  - Render pitch with restrained markings.
 *  - Render one clearly oriented primitive player (box + direction indicator).
 *  - Render independent sphere ball at truthful position and radius.
 *  - Render grounded ball shadow/contact cue (dark circle on pitch plane).
 *  - Render kit-independent controlled-player marker (ring above head).
 *  - Interpolate between previous and current snapshots for smooth visual.
 *
 * Constraints:
 *  - Renderer consumes PresentationSnapshot ONLY.
 *  - Camera, scene graph, interpolation, and renderer objects MUST NOT
 *    mutate the world or alter state hashes.
 *  - No animation mixer, LOD, particles, temporal postprocessing,
 *    asset pipeline, dynamic camera, or perceptual gate.
 *  - Ball is an independent 3D entity — never parented to a player.
 *
 * No Math.random, Date, DOM (except Three.js canvas), or Node I/O
 * in the simulation core.  This module is an adapter — it lives outside
 * the simulation boundary.
 */

import * as THREE from "three";
import type { PresentationSnapshot } from "../../contracts/presentation.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Renderer configuration for the bootstrap visual baseline.
 *
 * All values are provisional and versioned.  No PES fidelity claim.
 */
export interface RendererConfig {
  /** Pitch half-length (metres). */
  pitchHalfLength: number;
  /** Pitch half-width (metres). */
  pitchHalfWidth: number;
  /** Ball radius (metres). */
  ballRadius: number;
  /** Player visual height (metres). */
  playerHeight: number;
  /** Player visual width (metres). */
  playerWidth: number;
  /** Player visual depth (metres). */
  playerDepth: number;
  /** Camera position. */
  cameraPosition: { x: number; y: number; z: number };
  /** Camera look-at target. */
  cameraTarget: { x: number; y: number; z: number };
  /** Camera FOV (degrees). */
  cameraFov: number;
  /** Near clipping plane. */
  cameraNear: number;
  /** Far clipping plane. */
  cameraFar: number;
  /** Background color. */
  backgroundColor: number;
  /** Pitch surface color. */
  pitchColor: number;
  /** Pitch line color. */
  lineColor: number;
  /** Player color (team A). */
  playerColorA: number;
  /** Player color (team B). */
  playerColorB: number;
  /** Ball color. */
  ballColor: number;
  /** Controlled-player marker color. */
  markerColor: number;
}

/**
 * Default renderer configuration — provisional bootstrap baseline.
 */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  pitchHalfLength: 52.5,
  pitchHalfWidth: 34,
  ballRadius: 0.11,
  playerHeight: 1.8,
  playerWidth: 0.5,
  playerDepth: 0.5,
  cameraPosition: { x: 0, y: 30, z: 40 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraFov: 50,
  cameraNear: 0.1,
  cameraFar: 500,
  backgroundColor: 0x2d5a27,
  pitchColor: 0x3a7a33,
  lineColor: 0xffffff,
  playerColorA: 0x2266cc,
  playerColorB: 0xcc3333,
  ballColor: 0xffffff,
  markerColor: 0xffcc00,
};

// ---------------------------------------------------------------------------
// Presentation Session (deterministic, test-compatible)
// ---------------------------------------------------------------------------

/**
 * Interpolation state for smooth visual transitions.
 */
interface InterpolationState {
  /** Previous snapshot (for interpolation). */
  previous: PresentationSnapshot | null;
  /** Current snapshot. */
  current: PresentationSnapshot | null;
  /** Interpolation alpha [0..1]. */
  alpha: number;
}

/**
 * Deterministic presentation session — owns scene state, resets
 * deterministically, and advances from exact snapshots.
 *
 * The session does not own the simulation.  It is a non-authoritative
 * consumer of PresentationSnapshot.
 */
export interface PresentationSession {
  /**
   * Reset the session — clear all scene objects, camera, interpolation,
   * and reload only local primitives.
   *
   * @returns A ready receipt (promise resolves when scene is ready).
   */
  reset(): Promise<void>;

  /**
   * Advance the presentation from exact snapshots with interpolation.
   *
   * @param previous - The previous committed snapshot.
   * @param current - The current committed snapshot.
   * @param interpolation - Rational interpolation factor { numerator, denominator }.
   */
  advance(
    previous: PresentationSnapshot,
    current: PresentationSnapshot,
    interpolation: { numerator: number; denominator: number },
  ): void;

  /**
   * Render a single frame.
   *
   * This is a presentation-only operation — it does not affect
   * the simulation or state hashes.
   */
  render(): void;

  /**
   * Get the Three.js renderer (for screenshot capture).
   */
  getRenderer(): THREE.WebGLRenderer;

  /**
   * Get the Three.js scene (for diagnostics).
   */
  getScene(): THREE.Scene;

  /**
   * Get the camera (for diagnostics).
   */
  getCamera(): THREE.PerspectiveCamera;

  /**
   * Dispose all GPU resources.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Scene building helpers
// ---------------------------------------------------------------------------

/**
 * Build the pitch plane with restrained markings.
 */
function buildPitch(config: RendererConfig, scene: THREE.Object3D): void {
  // Ground plane
  const pitchGeometry = new THREE.PlaneGeometry(
    config.pitchHalfLength * 2,
    config.pitchHalfWidth * 2,
  );
  const pitchMaterial = new THREE.MeshStandardMaterial({
    color: config.pitchColor,
    roughness: 0.9,
    metalness: 0.0,
  });
  const pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0;
  pitch.name = "pitch";
  scene.add(pitch);

  // Field lines — restrained white lines
  const lineMaterial = new THREE.LineBasicMaterial({
    color: config.lineColor,
    linewidth: 1,
  });

  // Outline rectangle
  const outlinePoints = [
    new THREE.Vector3(-config.pitchHalfLength, 0.01, -config.pitchHalfWidth),
    new THREE.Vector3(config.pitchHalfLength, 0.01, -config.pitchHalfWidth),
    new THREE.Vector3(config.pitchHalfLength, 0.01, config.pitchHalfWidth),
    new THREE.Vector3(-config.pitchHalfLength, 0.01, config.pitchHalfWidth),
    new THREE.Vector3(-config.pitchHalfLength, 0.01, -config.pitchHalfWidth),
  ];
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outline = new THREE.Line(outlineGeometry, lineMaterial);
  outline.name = "pitch-outline";
  scene.add(outline);

  // Halfway line
  const halfwayPoints = [
    new THREE.Vector3(0, 0.01, -config.pitchHalfWidth),
    new THREE.Vector3(0, 0.01, config.pitchHalfWidth),
  ];
  const halfwayGeometry = new THREE.BufferGeometry().setFromPoints(halfwayPoints);
  const halfway = new THREE.Line(halfwayGeometry, lineMaterial);
  halfway.name = "pitch-halfway";
  scene.add(halfway);

  // Centre circle (provisional radius 9.15m)
  const centreCirclePoints: THREE.Vector3[] = [];
  const centreRadius = 9.15;
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    centreCirclePoints.push(
      new THREE.Vector3(
        Math.cos(angle) * centreRadius,
        0.01,
        Math.sin(angle) * centreRadius,
      ),
    );
  }
  const centreCircleGeometry = new THREE.BufferGeometry().setFromPoints(centreCirclePoints);
  const centreCircle = new THREE.Line(centreCircleGeometry, lineMaterial);
  centreCircle.name = "pitch-centre-circle";
  scene.add(centreCircle);

  // Centre spot
  const spotGeometry = new THREE.CircleGeometry(0.15, 16);
  const spotMaterial = new THREE.MeshStandardMaterial({
    color: config.lineColor,
    roughness: 0.9,
  });
  const spot = new THREE.Mesh(spotGeometry, spotMaterial);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.015, 0);
  spot.name = "pitch-centre-spot";
  scene.add(spot);
}

// --- Kick animation duration (ticks) ---
const KICK_ANIMATION_DURATION = 8;

// --- Player animation state ---
const playerLegAnimState = new Map<string, { leftZ: number; rightZ: number }>();

/**
 * Create a primitive player — a multi-part body with head, legs, and
 * direction indicator.  Built from simple Three.js primitives (boxes,
 * cylinders, sphere, cone).  No external animation assets needed.
 *
 * Parts (local coordinates, player faces +X):
 *   body  — BoxGeometry torso at (0, 0.9, 0)
 *   head  — SphereGeometry at (0, 1.6, 0)
 *   leftLeg  — CylinderGeometry at (0, 0.35, -0.12)
 *   rightLeg — CylinderGeometry at (0, 0.35,  0.12)
 *   direction — ConeGeometry at (+X edge, +Y, 0) pointing forward
 */
function createPrimitivePlayer(
  playerId: string,
  teamId: string,
  config: RendererConfig,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `player-${playerId}`;

  const bodyColor =
    teamId === "team-a" ? config.playerColorA : config.playerColorB;

  // Body — torso
  const bodyGeometry = new THREE.BoxGeometry(
    config.playerWidth,
    config.playerHeight * 0.55,
    config.playerDepth * 0.8,
  );
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = config.playerHeight * 0.48;
  body.name = "body";
  group.add(body);

  // Head — sphere
  const headGeometry = new THREE.SphereGeometry(config.playerWidth * 0.38, 12, 8);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = config.playerHeight * 0.85;
  head.name = "head";
  group.add(head);

  // Legs — cylinders
  const legGeometry = new THREE.CylinderGeometry(0.06, 0.07, config.playerHeight * 0.36, 8);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.6,
  });

  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(0, config.playerHeight * 0.18, -config.playerDepth * 0.2);
  leftLeg.name = "left-leg";
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0, config.playerHeight * 0.18, config.playerDepth * 0.2);
  rightLeg.name = "right-leg";
  group.add(rightLeg);

  // Direction indicator — cone pointing forward (+X)
  const coneGeometry = new THREE.ConeGeometry(0.08, 0.25, 8);
  const coneMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.rotation.z = -Math.PI / 2;
  cone.position.set(config.playerWidth / 2 + 0.12, config.playerHeight * 0.7, 0);
  cone.name = "direction";
  group.add(cone);

  return group;
}

/**
 * Animate a player's limbs based on locomotion phase, speed, and
 * contact state.  Mutates only the Three.js scene objects; never
 * touches simulation state.
 *
 * Idle: legs straight down (neutral stance).
 * Running / sprinting / turning: alternating leg swing with vertical bob.
 * Kicking (contactState non-null): left leg extended forward.
 * Braking: leaning slightly forward, short leg swing.
 */
function animatePlayer(
  group: THREE.Group,
  locomotionPhase: string,
  speed: number,
  contactState: string | null,
  tick: number,
  config: RendererConfig,
): void {
  const leftLeg = group.getObjectByName("left-leg") as THREE.Mesh | undefined;
  const rightLeg = group.getObjectByName("right-leg") as THREE.Mesh | undefined;
  const bodyMesh = group.getObjectByName("body") as THREE.Mesh | undefined;

  if (!leftLeg || !rightLeg) return;

  const id = group.name;
  if (!playerLegAnimState.has(id)) {
    playerLegAnimState.set(id, { leftZ: 0, rightZ: 0 });
  }
  const state = playerLegAnimState.get(id)!;

  let leftTargetZ = 0;
  let rightTargetZ = 0;
  let bodyOffsetY = 0;

  const isKicking = contactState != null && contactState.length > 0;

  if (isKicking) {
    // Kicking pose — left leg extended forward
    leftTargetZ = -0.25;
    rightTargetZ = 0.08;
    bodyOffsetY = 0.02;
  } else if (locomotionPhase === "idle" || speed < 0.3) {
    // Idle — neutral standing stance
    leftTargetZ = 0;
    rightTargetZ = 0;
    bodyOffsetY = 0;
  } else if (locomotionPhase === "braking") {
    // Braking — slight lean, small leg movement
    const t = tick * 0.3;
    leftTargetZ = Math.sin(t) * 0.06;
    rightTargetZ = Math.sin(t + Math.PI) * 0.06;
    bodyOffsetY = 0;
  } else {
    // Running / sprinting / turning — alternating leg swing
    const frequency = locomotionPhase === "sprinting" ? 3.5 : 2.5;
    const amplitude = locomotionPhase === "sprinting" ? 0.2 : 0.14;
    const t = tick * frequency;
    leftTargetZ = Math.sin(t) * amplitude;
    rightTargetZ = Math.sin(t + Math.PI) * amplitude;
    bodyOffsetY = Math.abs(Math.sin(t * 2)) * 0.02;
  }

  // Smooth interpolation toward targets
  const lerpFactor = 0.35;
  state.leftZ += (leftTargetZ - state.leftZ) * lerpFactor;
  state.rightZ += (rightTargetZ - state.rightZ) * lerpFactor;

  leftLeg.position.z = -config.playerDepth * 0.2 + state.leftZ;
  rightLeg.position.z = config.playerDepth * 0.2 + state.rightZ;
  leftLeg.position.y = config.playerHeight * 0.18 + Math.abs(state.leftZ) * 0.06;
  rightLeg.position.y = config.playerHeight * 0.18 + Math.abs(state.rightZ) * 0.06;

  if (bodyMesh) {
    bodyMesh.position.y = config.playerHeight * 0.48 + bodyOffsetY;
  }
}

/**
 * Create the controlled-player marker — a ring above the player's head.
 *
 * Kit-independent: always yellow/gold regardless of team color.
 */
function createControlledMarker(config: RendererConfig): THREE.Mesh {
  const ringGeometry = new THREE.RingGeometry(0.25, 0.35, 16);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: config.markerColor,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.name = "controlled-marker";
  return ring;
}

/**
 * Create the ball — an independent sphere.
 *
 * The ball is NEVER parented to a player.  It is always an
 * independent 3D entity at its truthful position/radius.
 */
function createBall(config: RendererConfig): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(config.ballRadius, 24, 16);
  const material = new THREE.MeshStandardMaterial({
    color: config.ballColor,
    roughness: 0.3,
    metalness: 0.1,
  });
  const ball = new THREE.Mesh(geometry, material);
  ball.name = "ball";
  return ball;
}

/**
 * Create the ball shadow — a dark circle on the pitch plane.
 *
 * This is the grounded contact cue.  It derives from the ball's
 * simulation position and never predicts or delays canonical state.
 */
function createBallShadow(config: RendererConfig): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(config.ballRadius * 1.2, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.name = "ball-shadow";
  return shadow;
}

// ---------------------------------------------------------------------------
// PresentationSession implementation
// ---------------------------------------------------------------------------

/**
 * Create a deterministic PresentationSession backed by Three.js.
 *
 * @param container - The DOM element to render into.
 * @param config - Renderer configuration (optional, uses defaults).
 * @returns A PresentationSession instance.
 */
export function createPresentationSession(
  container: HTMLElement,
  config: RendererConfig = DEFAULT_RENDERER_CONFIG,
): PresentationSession {
  // --- Three.js core objects ---
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;

  // --- Primitive scene objects ---
  let pitchGroup: THREE.Group | null = null;
  const playerMeshes = new Map<string, THREE.Group>();
  let markerMesh: THREE.Mesh | null = null;
  let ballMesh: THREE.Mesh | null = null;
  let ballShadowMesh: THREE.Mesh | null = null;

  // --- Interpolation state ---
  const interpState: InterpolationState = {
    previous: null,
    current: null,
    alpha: 0,
  };

  // --- Scene graph version (for diagnostics) ---
  let sceneVersion = 0;

  /**
   * Initialize Three.js objects.
   */
  function initScene(): void {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    scene.name = "pes-presentation";

    // Camera — fixed gameplay preset (provisional, experimental)
    camera = new THREE.PerspectiveCamera(
      config.cameraFov,
      container.clientWidth / container.clientHeight,
      config.cameraNear,
      config.cameraFar,
    );
    camera.position.set(
      config.cameraPosition.x,
      config.cameraPosition.y,
      config.cameraPosition.z,
    );
    camera.lookAt(
      config.cameraTarget.x,
      config.cameraTarget.y,
      config.cameraTarget.z,
    );

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting — one directional + ambient (restrained)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(20, 30, 10);
    directionalLight.name = "main-light";
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    ambientLight.name = "ambient-light";
    scene.add(ambientLight);

    // Pitch
    pitchGroup = new THREE.Group();
    pitchGroup.name = "pitch-group";
    buildPitch(config, pitchGroup);
    scene.add(pitchGroup);

    // Ball
    ballMesh = createBall(config);
    scene.add(ballMesh);

    // Ball shadow
    ballShadowMesh = createBallShadow(config);
    scene.add(ballShadowMesh);

    // Controlled-player marker (added when a snapshot arrives)
    markerMesh = createControlledMarker(config);
    markerMesh.visible = false;
    scene.add(markerMesh);

    sceneVersion++;
  }

  /**
   * Update the scene from a presentation snapshot.
   *
   * This reads the snapshot immutably — no mutation of the snapshot
   * or simulation state occurs.
   *
   * @param snapshot - The current committed presentation snapshot.
   * @param alpha - Interpolation factor [0..1].
   * @param prev - Previous snapshot for interpolation (or null).
   */
  function updateFromSnapshot(
    snapshot: PresentationSnapshot,
    alpha: number,
    prev: PresentationSnapshot | null,
  ): void {
    // --- Players ---
    const activePlayerIds = new Set<string>();

    // Reset controlled-player marker visibility each frame so it
    // hides automatically when no human-controlled player exists.
    if (markerMesh) {
      markerMesh.visible = false;
    }

    for (const pp of snapshot.players) {
      activePlayerIds.add(pp.playerId);

      let mesh = playerMeshes.get(pp.playerId);
      if (!mesh) {
        mesh = createPrimitivePlayer(pp.playerId, pp.teamId, config);
        scene.add(mesh);
        playerMeshes.set(pp.playerId, mesh);
      }

      // Interpolate position between previous and current.
      let px = pp.groundPosition.x;
      let pz = pp.groundPosition.y; // simulation Y → render Z
      if (prev) {
        const prevPlayer = prev.players.find((p) => p.playerId === pp.playerId);
        if (prevPlayer) {
          px = prevPlayer.groundPosition.x + (pp.groundPosition.x - prevPlayer.groundPosition.x) * alpha;
          pz = prevPlayer.groundPosition.y + (pp.groundPosition.y - prevPlayer.groundPosition.y) * alpha;
        }
      }

      mesh.position.set(px, 0, pz);
      mesh.rotation.y = -pp.bodyHeading; // rotate to face heading direction

      // Animate limbs based on locomotion phase, speed, and contact state.
      animatePlayer(
        mesh,
        pp.locomotionPhase,
        pp.speed,
        pp.contactState,
        snapshot.tick,
        config,
      );

      // Controlled-player marker — yellow ring above the human-controlled
      // player.  Only HUMAN-slot players have isControlled === true.
      if (pp.isControlled && markerMesh) {
        markerMesh.visible = true;
        markerMesh.position.set(px, config.playerHeight + 0.5, pz);
      }
    }

    // Remove stale player meshes
    for (const [id, mesh] of playerMeshes) {
      if (!activePlayerIds.has(id)) {
        scene.remove(mesh);
        playerMeshes.delete(id);
        playerLegAnimState.delete(`player-${id}`);
      }
    }

    // --- Ball (independent 3D entity, never parented to a player) ---
    if (ballMesh) {
      let bx = snapshot.ball.position.x;
      let by = snapshot.ball.position.y;
      let bz = snapshot.ball.position.z;
      if (prev) {
        bx = prev.ball.position.x + (snapshot.ball.position.x - prev.ball.position.x) * alpha;
        by = prev.ball.position.y + (snapshot.ball.position.y - prev.ball.position.y) * alpha;
        bz = prev.ball.position.z + (snapshot.ball.position.z - prev.ball.position.z) * alpha;
      }
      ballMesh.position.set(bx, bz, by); // simulation (x,y,z) → render (x,z,y)
    }

    // --- Ball shadow (grounded contact cue) ---
    if (ballShadowMesh && ballMesh) {
      ballShadowMesh.position.set(
        ballMesh.position.x,
        0.005,
        ballMesh.position.z,
      );
      // Shadow opacity scales with ball height (closer = darker)
      const ballHeight = ballMesh.position.y;
      const shadowOpacity = Math.max(0.1, 0.4 - ballHeight * 0.05);
      (ballShadowMesh.material as THREE.MeshBasicMaterial).opacity = shadowOpacity;
    }
  }

  /**
   * Initialize the session.
   */
  initScene();

  // --- Public API ---
  const session: PresentationSession = {
    async reset(): Promise<void> {
      // Dispose GPU resources and remove canvas from DOM.
      renderer.dispose();
      container.removeChild(renderer.domElement);

      // Clear all mesh references.
      playerMeshes.clear();
      playerLegAnimState.clear();
      markerMesh = null;
      ballMesh = null;
      ballShadowMesh = null;
      pitchGroup = null;

      // Reset interpolation.
      interpState.previous = null;
      interpState.current = null;
      interpState.alpha = 0;

      // Recreate scene, camera, renderer, and all scene objects.
      initScene();
    },

    advance(
      previous: PresentationSnapshot,
      current: PresentationSnapshot,
      interpolation: { numerator: number; denominator: number },
    ): void {
      interpState.previous = previous;
      interpState.current = current;
      interpState.alpha =
        interpolation.denominator > 0
          ? interpolation.numerator / interpolation.denominator
          : 0;

      // Update scene from snapshot
      updateFromSnapshot(current, interpState.alpha, previous);
    },

    render(): void {
      renderer.render(scene, camera);
    },

    getRenderer(): THREE.WebGLRenderer {
      return renderer;
    },

    getScene(): THREE.Scene {
      return scene;
    },

    getCamera(): THREE.PerspectiveCamera {
      return camera;
    },

    dispose(): void {
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };

  return session;
}
