export type TeamIndex = 0 | 1;
export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };
export type ActionKind = 'pass' | 'through' | 'cross' | 'shoot' | 'tackle' | 'slide' | 'lob' | 'header';
export type Phase = 'kickoff' | 'playing' | 'goal' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'offside' | 'penalty' | 'indirect' | 'halftime' | 'fulltime';
export type Formation = '4-3-3' | '4-4-2' | '3-5-2';
/** CPU strength in the menu. Only existing CPU parameters change between levels. */
export type CpuDifficulty = 'easy' | 'normal' | 'hard';
export interface Capabilities {
  speed: number; acceleration: number; braking: number; turnRate: number;
  control: number; passing: number; finishing: number; power: number;
  physical: number; balance: number; stamina: number; tackling: number;
  curve: number; weakFoot: number; keeper: number; heading: number; jump: number;
}
export interface PlayerProfile {
  id: string; name: string; number: number; keeper: boolean;
  foot: 'left' | 'right'; capabilities: Capabilities;
}
export interface Tactics {
  formation: Formation; defensiveLine: number; compactness: number; pressing: number;
  tempo: number; width: number; support: number; buildUp: number;
  counterPress: number; shortPossession: number; tightMarking: number; adaptation: number;
}
export interface TeamProfile { id: string; name: string; shortName: string; players: PlayerProfile[]; tactics: Tactics }
export type KeeperKick = 'punt' | 'high';
/** Dpad direction of a set-piece command. */
export type SetDirection = 'up' | 'down' | 'left' | 'right';
/** Second taker of a set piece: beside the ball (dpad up) or behind it (dpad down). */
export type SecondTaker = 'side' | 'behind';
/** Corner attack strategy of the dpad: fast, near post, in line, far post. */
export type CornerAttack = 'fast' | 'near' | 'line' | 'far';
/** Corner defence strategy of the dpad: mixed, man to man, zonal. */
export type CornerDefence = 'mixed' | 'man' | 'zonal';
export interface InputFrame {
  tick: number; slot: TeamIndex; move: Vec2; aim: Vec2; sprint: boolean; shield: boolean;
  action?: ActionKind; power?: number; switchPlayer?: boolean; switchKeeper?: boolean; tactics?: Partial<Tactics>;
  /** Human keeper only: hold the run-out key without the ball. */
  keeperRush?: boolean;
  /** Human keeper only: release of the volley kick while the ball is held. */
  keeperKick?: KeeperKick;
  /** Human keeper only: R1 with the stick released puts the ball down or picks it up. */
  keeperDrop?: boolean;
  /** Human keeper only: press the pass key before a held kick release to feint. */
  keeperFeint?: boolean;
  /** Foul-dive chord (L1+L2+L3+R3 without R2) of the selected player. */
  simulateDive?: boolean;
  /** Defense only: hold ✕ so the selected player chases the ball carrier. */
  press?: boolean;
  /** Defense only: hold □ for one teammate press, double tap and hold for two. */
  teamPress?: 0|1|2;
  /** Defense only: hold R2 to contain the carrier at low speed. */
  jockey?: boolean;
  /** Defense only: right stick flick switches the cursor toward that direction. */
  switchTarget?: Vec2;
  /** Human set piece only: the kick uses the set-piece rows (stick trajectory, power height and curl). */
  setKick?: boolean;
  /** Set piece only: L1 + dpad up or down places the second taker beside or behind the ball. */
  secondTaker?: SecondTaker;
  /** Set piece only: hold L2 while the kick to play it with the second taker. */
  secondKick?: boolean;
  /** Free-kick feint: press ✕ while the ○ charge is held. No kick leaves the foot. */
  setFeint?: boolean;
  /** Set piece only: L1 + ✕ rolls the ball short along the ground. */
  shortRoll?: boolean;
  /** Penalty only: L1 + □ chips the ball down the middle (panenka). */
  panenka?: boolean;
  /** Free-kick wall of the defending slot: one □ press (no ✕ held) jumps. */
  wallJump?: boolean;
  /** Free-kick wall: power of the held ○ that sends the wall out at the kick. */
  wallCharge?: number;
  /** Free kick: hold △ + stick. Penalty: stick alone. Moves the slot keeper. */
  keeperMove?: Vec2;
  /** Corner only: dpad direction of the attack or defence strategy. */
  cornerSide?: SetDirection;
}
export interface Intent { move: Vec2; aim: Vec2; sprint: boolean; shield: boolean; action?: ActionKind; power: number }
export interface PlayerState extends PlayerProfile, Vec2 {
  // Set only by the keeper switch command. Keep absent for legacy CPU checkpoints.
  manualControl?: boolean;
  // Set only by human keeper commands. Keep absent for CPU-only checkpoints.
  keeperRushing?: boolean;
  // Set only by human defense commands. Keep absent for CPU-only checkpoints.
  pressing?: true;
  jockeying?: true;
  teamPressing?: true;
  keeperDropped?: boolean;
  // Tick until which a free-kick wall player jumps. Absent on CPU-only checkpoints.
  wallJump?: number;
  sentOff: boolean; yellows: number; keeperMode: 'ready' | 'dive' | 'hold' | 'recover'; keeperUntil: number;
  team: TeamIndex; vx: number; vy: number; heading: number; energy: number; stability: number;
  intent: Intent; action: { kind: ActionKind; start: number; contact: number; end: number; aim: Vec2; power: number; resolved: boolean; keeperKick?: KeeperKick } | null;
  touchCooldown: number; recovery: number; travel: number; keeperReaction: number; heldSince: number;
}
export interface Contact { id: string; tick: number; playerId: string; team: TeamIndex; surface: 'foot' | 'head' | 'hand' | 'body'; point: Vec3 }
export interface BallState extends Vec3 { vx: number; vy: number; vz: number; spin: Vec3; lastTouch: Contact | null; freeTicks: number; flight: 'shot' | 'pass' | 'loose' }
export interface TeamState extends TeamProfile {
  direction: 1 | -1; phase: 'attack' | 'defence' | 'to-attack' | 'to-defence'; phaseTick: number;
  assignments: Record<string, { anchor: Vec2; target: Vec2; responsibility: string }>;
  chaser: string | null; memory: { touches: Record<string, number>; flank: [number, number]; lastContact: string | null; focal: string | null; };
}
export interface Restart {
  team: TeamIndex; point: Vec2; taker: string; remaining: number; kind: Phase;
  /** Second taker placed with L1 + dpad; the kick uses him while L2 is held. */
  second?: { id: string; placement: SecondTaker };
  /** Corner strategies chosen with the dpad before the kick. */
  strategy?: { attack?: CornerAttack; defence?: CornerDefence };
}
export interface MatchEvent { id: string; tick: number; type: string; playerId?: string; team?: TeamIndex; data?: Record<string, unknown> }
export interface Stats { shots: number; onTarget: number; passes: number; completed: number; saves: number; tackles: number; fouls: number; possessionTicks: number; corners: number; offsides: number; yellows: number; reds: number; penalties: number }
export interface Config {
  version: string; dt: number; halfSeconds: number; teamSize: number; seed: number;
  human: [boolean, boolean]; pitch: { length: number; width: number; goalWidth: number; goalHeight: number };
  physics: { radius: number; gravity: number; rolling: number; drag: number; restitution: number; spinDecay: number; magnus: number; substeps: number };
  movement: { radius: number; jog: number; turnLoss: number; recoverySeconds: number; sprintDrain: number; recoveryRate: number };
  actions: { reach: number; preparationTicks: number; recoveryTicks: number; touchTicks: number; tackleReach: number; headerHeight: number; error: number };
  ai: { cadence: number; transitionTicks: number; passDistance: number; shotDistance: number; hysteresis: number };
  rules: { restartTicks: number; celebrationTicks: number; halftimeTicks: number; offside: boolean; fouls: boolean; advantageTicks: number; humanRestartTicks: number; cards: boolean };
  goalkeeper: { radius: number; lateral: number; speed: number; reach: number; reactionTicks: number; releaseTicks: number; highReach: number; recoveryTicks: number };
  // Absent means Normal. An absent key keeps the config hash of a Normal match unchanged.
  difficulty?: CpuDifficulty;
}
export interface World {
  advantage: { team: TeamIndex; point: Vec2; until: number; offender: string; card: 'yellow' | 'red' | null } | null;
  pendingCards: { playerId: string; card: 'yellow' | 'red' }[];
  /** Teammate press count held by each human slot. Absent while no hold is
   * active and absent on CPU-only checkpoints. */
  teamPressHold?: [number, number];
  /** Tick of the last pass feint. The feint never restarts `since`. */
  keeperHold: { playerId: string; since: number; feintTick?: number } | null;
  restartRestriction: { taker: string; team: TeamIndex; indirect: boolean; kind: Phase } | null;
  version: string; tick: number; rng: number; config: Config; teams: [TeamState, TeamState]; players: PlayerState[];
  ball: BallState; phase: Phase; half: 1 | 2; played: number; score: [number, number]; stats: [Stats, Stats];
  selected: [string | null, string | null]; restart: Restart | null; countdown: number;
  possession: TeamIndex | null; carrier: string | null; offside: { team: TeamIndex; candidates: string[] } | null;
  pendingPass: { playerId: string; team: TeamIndex } | null; inputs: InputFrame[]; events: MatchEvent[]; eventSeq: number;
}
export interface Presentation {
  tick: number; phase: Phase; half: number; played: number; score: [number, number]; stats: [Stats, Stats];
  selected: [string | null, string | null]; ball: BallState; players: Omit<PlayerState,'manualControl'>[]; events: MatchEvent[];
  /** Player at the ball: in the hands of the keeper or at the feet of a player. */
  carrier: string | null;
  /** Holder of the ball in the keeper's hands, or null. */
  keeperHold: { playerId: string; since: number; feintTick?: number } | null;
  /** Waiting restart (team and kind), or null in play. Read by the set-piece keys. */
  restart?: { team: TeamIndex; kind: Phase } | null;
  teams: [Pick<TeamState, 'id' | 'name' | 'shortName' | 'direction' | 'tactics'>, Pick<TeamState, 'id' | 'name' | 'shortName' | 'direction' | 'tactics'>];
}
export interface Replay { version: 'replay-v2'; engine: string; initial: World; inputs: InputFrame[]; endTick: number; finalHash: string }

/** Presentation consumers cannot write through nested snapshot references. */
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ReadonlyPresentation = DeepReadonly<Presentation>;
