import type { Vec2 } from '../contracts/types';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const length = (v: Vec2) => Math.hypot(v.x, v.y);
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (v: Vec2): Vec2 => { const d = length(v); return d > 1e-8 ? { x: v.x / d, y: v.y / d } : { x: 0, y: 0 }; };
export const delta = (a: Vec2, b: Vec2): Vec2 => ({ x: b.x - a.x, y: b.y - a.y });
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function segmentPoint(a: Vec2, b: Vec2, p: Vec2) {
  const x = b.x - a.x, y = b.y - a.y;
  const t = clamp(((p.x-a.x)*x + (p.y-a.y)*y) / (x*x+y*y || 1), 0, 1);
  return { x: a.x+x*t, y: a.y+y*t, t };
}
export const clone = <T>(value: T): T => structuredClone(value);
export function canonical(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite canonical state');
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function hash(value: unknown): string {
  const s = canonical(value); let h = 2166136261;
  for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8,'0');
}
