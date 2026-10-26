import type { ActionKind, CornerAttack, CornerDefence, PlayerState, SetDirection, TeamIndex, Vec2, World } from '../contracts/types';
import { angleDelta, clamp, distance, segmentPoint } from './math';

// Spatial adjudication for the playable simulation. Thresholds are versioned design
// values, not a claim to reproduce an unseen referee or the PES implementation.
export function inPenaltyArea(w: World, team: TeamIndex, point: Vec2) {
  const goal = -w.teams[team].direction * w.config.pitch.length / 2;
  return Math.abs(point.x - goal) <= 16.5 && Math.abs(point.y) <= 20.16;
}
export function canUseHands(w: World, p: PlayerState) {
  if (!p.keeper || !inPenaltyArea(w, p.team, w.ball)) return false;
  const last = w.ball.lastTouch;
  return !(last?.team === p.team && (last.surface === 'foot' || last.playerId === p.id || w.restartRestriction?.kind === 'throw-in'));
}
export function visibleBall(w: World, p: PlayerState) {
  return !w.players.some(q => !q.sentOff && q.id !== p.id && q.id !== w.ball.lastTouch?.playerId &&
    distance(q, p) > .8 && distance(q, w.ball) > .8 &&
    distance(q, segmentPoint(p, w.ball, q)) < .35 && w.ball.z < 1.8);
}
export function foulCard(w: World, offender: PlayerState, victim: PlayerState, sliding: boolean): 'yellow' | 'red' | null {
  const relativeSpeed = Math.hypot(offender.vx - victim.vx, offender.vy - victim.vy);
  const dir = w.teams[victim.team].direction;
  const ahead = w.players.filter(q => !q.sentOff && q.team === offender.team && q.id !== offender.id && !q.keeper && (q.x - victim.x) * dir > 0);
  const dogso = distance(victim, w.ball) < 2 && victim.x * dir > w.config.pitch.length * .2 && ahead.length === 0 && Math.abs(victim.y) < 15;
  if (sliding && relativeSpeed > 7.5) return 'red';
  if (dogso) return inPenaltyArea(w, offender.team, victim) ? 'yellow' : 'red';
  if (sliding || relativeSpeed > 4.5) return 'yellow';
  return null;
}
// Set-piece helpers of a human restart. They are pure: the engine writes the
// state and only calls them while a human slot owns the restart.

/** Wall of a team: the four outfield players closest to the ball. */
export function wallPlayers(w: World, team: TeamIndex, point: Vec2): PlayerState[] {
  return w.players.filter(p => p.team === team && !p.keeper && !p.sentOff)
    .sort((a, b) => distance(a, point) - distance(b, point) || a.id.localeCompare(b.id)).slice(0, 4);
}

/** Second taker: the teammate closest to the ball that is not the taker. */
export function secondTakerFor(w: World, team: TeamIndex, point: Vec2, taker: string): PlayerState | undefined {
  return w.players.filter(p => p.team === team && !p.keeper && !p.sentOff && p.id !== taker)
    .sort((a, b) => distance(a, point) - distance(b, point) || a.id.localeCompare(b.id))[0];
}

/** Set-piece kick of one button row: □ shoots, ○ lofts the ball high, ✕ keeps it low. */
export function setPiecePower(power: number, action: ActionKind): { speed: number; vz: number } {
  if (action === 'shoot') return { speed: 16 + power * 10, vz: 1 + power * 3 };
  if (action === 'cross') return { speed: 12 + power * 6, vz: 4 + power * 4 };
  return { speed: 8 + power * 8, vz: .3 + power * 1.2 };
}

/** Curl of a set kick: the stick deviation from the facing bends the flight. */
export function setKickCurl(p: PlayerState, aim: Vec2): number {
  return clamp(angleDelta(p.heading, Math.atan2(aim.y, aim.x)), -1, 1) * 5 * p.capabilities.curve;
}

/** One set-piece step of the keeper. On the line of a penalty he only moves sideways. */
export function setKeeperMove(w: World, p: PlayerState, stick: Vec2, onLine: boolean): Vec2 {
  const c = w.config;
  const goal = { x: -w.teams[p.team].direction * c.pitch.length / 2, y: 0 };
  const limitY = onLine ? Math.min(c.goalkeeper.lateral, c.pitch.goalWidth / 2 + 1) : c.goalkeeper.lateral;
  const step = c.goalkeeper.speed * c.dt;
  if (onLine) return { x: p.x, y: clamp(p.y + stick.y * step, -limitY, limitY) };
  const x = p.x + stick.x * step, y = clamp(p.y + stick.y * step, -limitY, limitY);
  // He never walks out of the goal radius that the keeper clamp uses.
  const inside = Math.hypot(p.x - goal.x, p.y - goal.y) <= c.goalkeeper.radius;
  const dx = x - goal.x, dy = y - goal.y, d = Math.hypot(dx, dy);
  if (inside && d > c.goalkeeper.radius) return { x: goal.x + dx / d * c.goalkeeper.radius, y: goal.y + dy / d * c.goalkeeper.radius };
  return { x, y };
}

/** Corner strategies of the dpad. The defence has no down row. */
export const CORNER_ATTACK: Record<SetDirection, CornerAttack | undefined> = { up: 'fast', down: 'near', left: 'line', right: 'far' };
export const CORNER_DEFENCE: Record<SetDirection, CornerDefence | undefined> = { up: 'mixed', left: 'man', right: 'zonal', down: undefined };

export function offsideInterferer(w: World): PlayerState | undefined {
  if (!w.offside) return;
  const candidates = w.players.filter(p => !p.sentOff && w.offside!.candidates.includes(p.id));
  return candidates.find(p => {
    const opponents = w.players.filter(q => !q.sentOff && q.team !== p.team);
    const challenging = distance(p, w.ball) < 1.8 && opponents.some(q => distance(q, w.ball) < 1.8 && distance(p, q) < 1.1);
    const screening = w.ball.flight === 'shot' && opponents.some(g => g.keeper && distance(g, p) < 4 &&
      distance(p, segmentPoint(g, w.ball, p)) < .4 && distance(g, w.ball) > distance(g, p));
    return challenging || screening;
  });
}
