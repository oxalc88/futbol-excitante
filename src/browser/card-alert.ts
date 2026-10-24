import type { MatchEvent, Presentation } from '../contracts/types';

export const CARD_ALERT_TICKS = 100;

/** Format detached presentation data only; red takes priority over a second caution. */
export function cardAlert(events: readonly MatchEvent[], state: Pick<Presentation, 'players' | 'teams'>): string | null {
  const event = events.find(e => e.type === 'red-card') ?? events.find(e => e.type === 'yellow-card');
  if (!event) return null;
  const player = state.players.find(p => p.id === event.playerId);
  const team = event.team ?? player?.team;
  const label = event.type === 'yellow-card' ? 'AMARILLA' : event.data?.secondYellow === true ? 'EXPULSIÓN · SEGUNDA AMARILLA' : 'EXPULSIÓN · ROJA DIRECTA';
  return `${label}\n${player ? `${player.number} · ${player.name}` : 'Jugador desconocido'} · ${team === undefined ? 'Equipo desconocido' : state.teams[team].name}`;
}
