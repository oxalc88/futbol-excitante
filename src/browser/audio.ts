import type { Presentation } from '../contracts/types';

export type SoundCue = 'kick' | 'whistle' | 'cheer' | 'net';
type SoundState = Pick<Presentation, 'tick' | 'phase' | 'score' | 'events'>;
export function soundCues(previous: SoundState, next: SoundState): SoundCue[] {
  if (next.tick <= previous.tick) return [];
  const cues: SoundCue[] = [];
  const events = next.events.filter(e => !previous.events.some(p => p.id === e.id));
  if (events.some(e => ['pass', 'shoot', 'cross', 'through-pass', 'lob', 'header'].includes(e.type))) cues.push('kick');
  if ((previous.phase === 'kickoff' && next.phase === 'playing') ||
      (previous.phase !== next.phase && ['halftime', 'fulltime'].includes(next.phase))) cues.push('whistle');
  if (next.score.some((score, i) => score > previous.score[i]) || events.some(e => e.type === 'goal')) cues.push('net', 'cheer');
  return cues;
}

export interface AudioStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class MatchAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private crowd?: GainNode;
  private active = false;
  private mutedValue = false;
  private volumeValue = .5;
  constructor(private readonly createContext: () => AudioContext = () => new AudioContext(), private readonly storage?: AudioStorage) {
    try {
      this.mutedValue = storage?.getItem('fe-audio-muted') === 'true';
      const saved = storage?.getItem('fe-audio-volume');
      if (saved != null && saved.trim() !== '' && Number.isFinite(Number(saved))) this.volumeValue = Math.max(0, Math.min(1, Number(saved)));
    } catch {}
  }
  get muted() { return this.mutedValue; }
  get volume() { return this.volumeValue; }
  setMuted(value: boolean) { this.mutedValue = value; this.save('fe-audio-muted', String(value)); this.updateGain(); }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volumeValue = Math.max(0, Math.min(1, value));
    this.save('fe-audio-volume', String(this.volumeValue)); this.updateGain();
  }
  private save(key: string, value: string) { try { this.storage?.setItem(key, value); } catch {} }
  private updateGain() {
    if (this.master && this.context) this.master.gain.setValueAtTime(this.muted ? 0 : this.volume, this.context.currentTime);
    if (this.crowd && this.context) this.crowd.gain.setValueAtTime(this.active ? .035 : 0, this.context.currentTime);
  }
  gesture() {
    try {
      if (!this.context) {
        const context = this.createContext();
        this.context = context;
        this.master = context.createGain(); this.master.connect(context.destination);
        this.crowd = context.createGain(); this.crowd.connect(this.master);
        const source = context.createBufferSource(); source.buffer = this.noise(3); source.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
        source.connect(filter); filter.connect(this.crowd); source.start(); this.updateGain();
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {}
  }
  setActive(active: boolean) { this.active = active; this.updateGain(); }
  private noise(seconds: number) {
    const context = this.context!;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  play(cues: readonly SoundCue[]) {
    const context = this.context;
    if (!context || context.state !== 'running' || this.muted || this.volume === 0) return;
    for (const cue of cues) {
      const duration = cue === 'cheer' ? 2 : cue === 'whistle' ? .65 : .12;
      const gain = context.createGain(); gain.connect(this.master!);
      const now = context.currentTime;
      gain.gain.setValueAtTime(.001, now);
      gain.gain.linearRampToValueAtTime(cue === 'cheer' ? .22 : .15, now + .015);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      let source: OscillatorNode | AudioBufferSourceNode;
      if (cue === 'cheer' || cue === 'net') {
        const noise = context.createBufferSource(); noise.buffer = this.noise(duration); source = noise;
        const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = cue === 'net' ? 1800 : 700;
        source.connect(filter); filter.connect(gain);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      } else {
        const tone = context.createOscillator(); tone.type = cue === 'kick' ? 'sine' : 'triangle';
        tone.frequency.setValueAtTime(cue === 'kick' ? 160 : 2400, now);
        tone.frequency.exponentialRampToValueAtTime(cue === 'kick' ? 45 : 2100, now + duration);
        source = tone; source.connect(gain);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
      }
      source.start(); source.stop(now + duration);
    }
  }
}
