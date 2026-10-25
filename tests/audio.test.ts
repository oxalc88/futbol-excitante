import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchAudio, soundCues } from '../src/browser/audio';
import type { Presentation } from '../src/contracts/types';

const state = (tick: number, phase: Presentation['phase'] = 'playing', types: string[] = [], score: [number, number] = [0, 0]) => ({
  tick, phase, score, events: types.map((type, i) => ({ id: `${tick}:${i}`, tick, type })),
});
function fakeAudio() {
  const calls = { created: 0, resumed: 0, started: 0, stopped: 0, loops: 0 };
  const param = () => ({ value: 0, setValueAtTime(value: number) { this.value = value; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const gains: ReturnType<typeof node>[] = [];
  function node() { return { connect() {}, disconnect() {}, gain: param(), frequency: param(), start() { calls.started++; }, stop() { calls.stopped++; } }; }
  const context = {
    state: 'suspended', currentTime: 0, sampleRate: 100,
    destination: {},
    resume() { calls.resumed++; this.state = 'running'; return Promise.resolve(); },
    createGain() { const gain = node(); gains.push(gain); return gain; },
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() { return { ...node(), set loop(value: boolean) { if (value) calls.loops++; } }; },
    createBiquadFilter: node, createOscillator: node,
  };
  return { calls, gains, create: () => { calls.created++; return context as unknown as AudioContext; } };
}
const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; };

test('sound cues map kicks, match whistles, and a goal to net and crowd', () => {
  for (const action of ['pass', 'shoot', 'cross', 'through-pass', 'lob', 'header']) assert.deepEqual(soundCues(state(1), state(2, 'playing', [action])), ['kick']);
  assert.deepEqual(soundCues(state(1, 'kickoff'), state(2)), ['whistle']);
  for (const phase of ['halftime', 'fulltime'] as const) assert.deepEqual(soundCues(state(1), state(2, phase)), ['whistle']);
  assert.deepEqual(soundCues(state(1), state(2, 'goal', ['goal'], [1, 0])), ['net', 'cheer']);
  assert.deepEqual(soundCues(state(1), state(4, 'goal', [], [0, 1])), ['net', 'cheer']);
});
test('sound mapping is pure and ignores repeated, stale, and unrelated snapshots', () => {
  const previous = state(2, 'playing', ['pass']);
  const next = { ...state(3), events: previous.events };
  const before = structuredClone([previous, next]);
  assert.deepEqual(soundCues(previous, next), []);
  assert.deepEqual(soundCues(previous, previous), []);
  assert.deepEqual(soundCues(previous, state(1)), []);
  assert.deepEqual(soundCues(previous, state(3, 'playing', ['yellow-card'])), []);
  assert.deepEqual([previous, next], before);
});
test('context and crowd start only after a gesture; cues use synthesized nodes', () => {
  const fake = fakeAudio(), audio = new MatchAudio(fake.create);
  audio.setActive(true); audio.setVolume(.7); audio.setMuted(false); audio.play(['kick']);
  assert.equal(fake.calls.created, 0);
  audio.gesture(); audio.gesture();
  assert.equal(fake.calls.created, 1); assert.equal(fake.calls.resumed, 1); assert.equal(fake.calls.loops, 1);
  assert.equal(fake.gains[1].gain.value, .035);
  audio.play(['kick', 'whistle', 'net', 'cheer']); assert.equal(fake.calls.stopped, 4);
  audio.setMuted(true); audio.play(['kick']); assert.equal(fake.calls.stopped, 4); assert.equal(fake.gains[0].gain.value, 0);
  audio.setMuted(false); audio.setActive(false); assert.equal(fake.gains[0].gain.value, .7); assert.equal(fake.gains[1].gain.value, 0);
});
test('mute and volume persist and volume is bounded', () => {
  const saved = storage(), fake = fakeAudio(), audio = new MatchAudio(fake.create, saved);
  audio.setMuted(true); audio.setVolume(.28);
  const restored = new MatchAudio(fake.create, saved);
  assert.equal(restored.muted, true); assert.equal(restored.volume, .28);
  restored.setVolume(2); assert.equal(restored.volume, 1);
  restored.setVolume(-1); assert.equal(restored.volume, 0);
  restored.setVolume(NaN); assert.equal(restored.volume, 0);
  assert.equal(fake.calls.created, 0);
});
test('missing, blocked, or invalid storage and unavailable audio are safe', () => {
  const blocked = { getItem(): string { throw Error(); }, setItem() { throw Error(); } };
  for (const saved of [undefined, blocked, { getItem: () => 'bad', setItem() {} }]) {
    const audio = new MatchAudio(() => { throw Error('No Web Audio'); }, saved);
    assert.equal(audio.volume, .5); audio.setVolume(.4); audio.setMuted(true); audio.gesture(); audio.play(['net']);
  }
});
