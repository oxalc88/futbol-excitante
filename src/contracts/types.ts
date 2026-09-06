export type TeamIndex = 0 | 1;
export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };
export type ActionKind = 'pass' | 'through' | 'cross' | 'shoot' | 'tackle' | 'slide' | 'lob' | 'header';
export type Phase = 'kickoff' | 'playing' | 'goal' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'offside' | 'penalty' | 'indirect' | 'halftime' | 'fulltime';
export type Formation = '4-3-3' | '4-4-2' | '3-5-2';
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
export interface InputFrame {
  tick: number; slot: TeamIndex; move: Vec2; aim: Vec2; sprint: boolean; shield: boolean;
  action?: ActionKind; power?: number; switchPlayer?: boolean; tactics?: Partial<Tactics>;
}
export interface Intent { move: Vec2; aim: Vec2; sprint: boolean; shield: boolean; action?: ActionKind; power: number }
export interface PlayerState extends PlayerProfile, Vec2 {
  sentOff: boolean; yellows: number; keeperMode: 'ready' | 'dive' | 'hold' | 'recover'; keeperUntil: number;
  team: TeamIndex; vx: number; vy: number; heading: number; energy: number; stability: number;
  intent: Intent; action: { kind: ActionKind; start: number; contact: number; end: number; aim: Vec2; power: number; resolved: boolean } | null;
  touchCooldown: number; recovery: number; travel: number; keeperReaction: number; heldSince: number;
}
export interface Contact { id: string; tick: number; playerId: string; team: TeamIndex; surface: 'foot' | 'head' | 'hand' | 'body'; point: Vec3 }
export interface BallState extends Vec3 { vx: number; vy: number; vz: number; spin: Vec3; lastTouch: Contact | null; freeTicks: number; flight: 'shot' | 'pass' | 'loose' }
export interface TeamState extends TeamProfile {
  direction: 1 | -1; phase: 'attack' | 'defence' | 'to-attack' | 'to-defence'; phaseTick: number;
  assignments: Record<string, { anchor: Vec2; target: Vec2; responsibility: string }>;
  chaser: string | null; memory: { touches: Record<string, number>; flank: [number, number]; lastContact: string | null; focal: string | null; };
}
export interface Restart { team: TeamIndex; point: Vec2; taker: string; remaining: number; kind: Phase }
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
}
export interface World {
  advantage: { team: TeamIndex; point: Vec2; until: number; offender: string; card: 'yellow' | 'red' | null } | null;
  pendingCards: { playerId: string; card: 'yellow' | 'red' }[];
  keeperHold: { playerId: string; since: number } | null;
  restartRestriction: { taker: string; team: TeamIndex; indirect: boolean; kind: Phase } | null;
  version: string; tick: number; rng: number; config: Config; teams: [TeamState, TeamState]; players: PlayerState[];
  ball: BallState; phase: Phase; half: 1 | 2; played: number; score: [number, number]; stats: [Stats, Stats];
  selected: [string | null, string | null]; restart: Restart | null; countdown: number;
  possession: TeamIndex | null; carrier: string | null; offside: { team: TeamIndex; candidates: string[] } | null;
  pendingPass: { playerId: string; team: TeamIndex } | null; inputs: InputFrame[]; events: MatchEvent[]; eventSeq: number;
}
export interface Presentation {
  tick: number; phase: Phase; half: number; played: number; score: [number, number]; stats: [Stats, Stats];
  selected: [string | null, string | null]; ball: BallState; players: PlayerState[]; events: MatchEvent[];
  teams: [Pick<TeamState, 'id' | 'name' | 'shortName' | 'direction' | 'tactics'>, Pick<TeamState, 'id' | 'name' | 'shortName' | 'direction' | 'tactics'>];
}
export interface Replay { version: 'replay-v2'; initial: World; inputs: InputFrame[]; endTick: number; finalHash: string }
