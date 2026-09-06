import type { PlayerState, TeamIndex, Vec2, World } from '../contracts/types';
import { distance, segmentPoint } from './math';

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
