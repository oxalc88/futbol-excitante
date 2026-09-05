import type { Capabilities, TeamProfile, Tactics } from '../contracts/types';
export const DEFAULT_TACTICS: Tactics = { formation: '4-3-3', defensiveLine: .52, compactness: .65, pressing: .6, tempo: .65, width: .7, support: .6, buildUp: .55 };
const agile: Capabilities = { speed: 8.6, acceleration: 6.8, braking: 9, turnRate: 5.8, control: .91, passing: .8, finishing: .72, power: 27, physical: 64, balance: .93, stamina: .9, tackling: .6, curve: .8, weakFoot: .75, keeper: .2 };
const strong: Capabilities = { speed: 7.2, acceleration: 4.4, braking: 7.2, turnRate: 3.5, control: .71, passing: .73, finishing: .67, power: 31, physical: 90, balance: .7, stamina: .85, tackling: .86, curve: .5, weakFoot: .6, keeper: .2 };
export const TEAM_CATALOG = [
  { id: 'costa', name: 'Atlético Costa', shortName: 'COS', color: '#f8edcf', shorts: '#273346', accent: '#e04b3f' },
  { id: 'sierra', name: 'Deportivo Sierra', shortName: 'SIE', color: '#2352b3', shorts: '#142749', accent: '#53c2ef' },
  { id: 'selva', name: 'Unión Selva', shortName: 'SEL', color: '#f1ba3f', shorts: '#18372f', accent: '#153f31' },
  { id: 'puerto', name: 'Sport Puerto', shortName: 'PUE', color: '#a92743', shorts: '#f4eade', accent: '#f3d9a4' },
] as const;
const NAMES = ['R. Vega','A. Salas','D. Ríos','M. Torres','J. Luna','E. Vidal','N. Soto','L. Paredes','S. León','P. Montes','I. Cruz'];
export function makeTeam(index: number, size = 11): TeamProfile {
  const t = TEAM_CATALOG[index % TEAM_CATALOG.length];
  return { id: t.id, name: t.name, shortName: t.shortName, tactics: {...DEFAULT_TACTICS, formation: index % 2 ? '4-4-2' : '4-3-3'},
    players: Array.from({length:size}, (_, i) => ({id: `${t.id}-${i.toString().padStart(2,'0')}`, name: NAMES[(i+index*3)%NAMES.length], number: i+1,
      keeper: i===0, foot: i%4===0 ? 'left' : 'right', capabilities: {...(i%3===0 ? strong : agile), keeper: i===0 ? .85 : .2} })) };
}
export function validateTeam(input: unknown): TeamProfile {
  const t = input as TeamProfile;
  if (!t || typeof t.id !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(t.id) || typeof t.name !== 'string' || t.name.length > 80 || typeof t.shortName !== 'string' || t.shortName.length > 6 || !Array.isArray(t.players) || t.players.length < 1 || t.players.length > 11) throw new Error('Equipo inválido: se necesitan nombre, id y entre 1 y 11 jugadores.');
  if (new Set(t.players.map(p=>p.id)).size !== t.players.length || t.players.filter(p=>p.keeper).length !== 1) throw new Error('Cada equipo necesita IDs únicos y exactamente un arquero.');
  for (const p of t.players) {
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || p.name.length > 80 || !Number.isInteger(p.number) || !['left','right'].includes(p.foot)) throw new Error('Perfil de jugador inválido.');
    for (const k of Object.keys(agile) as (keyof Capabilities)[]) {
      const v=p.capabilities?.[k]; const max = ['speed','acceleration','braking','turnRate'].includes(k) ? 15 : k === 'power' ? 40 : k === 'physical' ? 120 : 1;
      if (!Number.isFinite(v) || v < 0 || v > max || (['speed','acceleration','braking','turnRate','power','physical'].includes(k) && v < .1)) throw new Error(`Capacidad inválida: ${k}`);
    }
  }
  if (!t.tactics || !['4-3-3','4-4-2','3-5-2'].includes(t.tactics.formation)) throw new Error('Formación inválida.');
  for (const k of Object.keys(DEFAULT_TACTICS).filter(k=>k!=='formation')) { const v=t.tactics[k as keyof Tactics]; if(typeof v!=='number' || !Number.isFinite(v) || v<0 || v>1) throw new Error('Parámetro táctico inválido.'); }
  return structuredClone(t);
}
