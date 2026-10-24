import test from 'node:test';
import assert from 'node:assert/strict';
import { cardAlert, CARD_ALERT_TICKS } from '../src/browser/card-alert';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';

const state = new Simulation(createConfig(), [makeTeam(0), makeTeam(1)]).presentation();
const player = state.players[0];
const red = { id: 'card', tick: 1, type: 'red-card', playerId: player.id, team: player.team };
const identity = `${player.number} · ${player.name} · ${state.teams[player.team].name}`;
test('direct red names player and team without mutating presentation', () => {
  const before = structuredClone(state);
  assert.equal(cardAlert([red], state), `EXPULSIÓN · ROJA DIRECTA\n${identity}`);
  assert.deepEqual(state, before);
  assert.equal(CARD_ALERT_TICKS, 100);
});
test('second yellow prioritizes dismissal over simultaneous yellow', () => {
  assert.equal(cardAlert([{...red, type:'yellow-card'}, {...red, data:{secondYellow:true}}], state), `EXPULSIÓN · SEGUNDA AMARILLA\n${identity}`);
});
test('yellow names player and team', () => {
  assert.equal(cardAlert([{...red, type:'yellow-card'}], state), `AMARILLA\n${identity}`);
});
test('unknown player and missing team have explicit fallbacks', () => {
  assert.equal(cardAlert([{...red, playerId:'missing'}], state), `EXPULSIÓN · ROJA DIRECTA\nJugador desconocido · ${state.teams[player.team].name}`);
  assert.equal(cardAlert([{...red, playerId:undefined, team:undefined}], state), 'EXPULSIÓN · ROJA DIRECTA\nJugador desconocido · Equipo desconocido');
  assert.equal(cardAlert([], state), null);
});
