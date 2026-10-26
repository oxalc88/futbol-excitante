/** Types for scripts/touch-pass-evidence.mjs, used by the TypeScript tests. */

export interface PassTouchSample { id: string; tick: number; playerId: string; point?: { x: number; y: number; z?: number } | null }
export interface PassActionSample { kind: string; start: number; contact: number; end: number; resolved?: boolean }
export interface PassPlayerSample { id: string; x: number; y: number; action: PassActionSample | null }
/** A detached `window.__fe` snapshot: everything the helper reads is plain JSON. */
export interface PassSampleState {
  tick: number;
  passes: { actions: number[]; events: number[] };
  selected: (string | null)[];
  ball: { x: number; y: number; vx: number; vy: number; lastTouch: PassTouchSample | null };
  players: PassPlayerSample[];
}
export interface PassEvidenceContact { tick: number; id: string; playerId: string; point: PassTouchSample['point']; separation: number | null }
export interface PassEvidenceDeparture { kind: 'speed' | 'separation' | 'other-touch'; tick: number; speed?: number; before?: number; separation?: number; playerId?: string }
export interface PassEvidenceState {
  slot: number; passerId: string; pressTick: number;
  passActions: number; passEvents: number; passActionsNow: number; passEventsNow: number;
  lastTouchId: string | null; lastTouchTick: number | null;
  speed: number; separation: number | null;
  passAction: PassActionSample | null;
  contact: PassEvidenceContact | null;
  departure: PassEvidenceDeparture | null;
  samples: number; maxSpeed: number; selectedChanged: boolean;
}
export interface PassEvidenceVerdict {
  ok: boolean; reason: string; passerId: string; pressTick: number;
  passActions: { before: number; after: number };
  passEvents: { before: number; after: number };
  passAction: PassActionSample | null;
  contact: PassEvidenceContact | null;
  departure: PassEvidenceDeparture | null;
  samples: number; selectedChanged: boolean;
  preSpeed: number; maxSpeed: number; preSeparation: number | null;
}
export function beginPassEvidence(state: PassSampleState, slot?: number): PassEvidenceState;
export function recordPassSample(ev: PassEvidenceState, state: PassSampleState): PassEvidenceState;
export function passEvidenceVerdict(ev: PassEvidenceState): PassEvidenceVerdict;
