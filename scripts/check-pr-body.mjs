// Check a pull request description against .github/pull_request_template.md.
// Read only: it reads the body and scripts/verify.sh, prints PASS or FAIL and exits 0 or 1.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECTIONS = ['Capacidad', 'Resultado de verify', 'Evidencia', 'Revisión', 'Checklist'];
const rx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Step names of the full verify, from the order=(...) line of scripts/verify.sh. */
export function verifySteps(script) {
  const m = script.match(/^order=\(([^)]*)\)/m);
  if (!m) throw new Error('scripts/verify.sh has no order=(...) line');
  return m[1].trim().split(/\s+/);
}

/** Text of each "## " section, without HTML comments. */
export function sections(body) {
  const text = String(body ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const out = {}; let name = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { name = h[1]; out[name] = ''; } else if (name) out[name] += `${line}\n`;
  }
  return out;
}

const model = (text, label) => text.match(new RegExp(`^\\s*[-*]?\\s*${label}:\\s*\`?([^\\s\`(]+)`, 'im'))?.[1].toLowerCase() ?? null;

export function checkPrBody(body, steps) {
  const e = []; const s = sections(body);
  for (const n of SECTIONS) if (!s[n]?.trim()) e.push(`section "## ${n}" is missing or empty`);
  const cap = s['Capacidad'] ?? '';
  if (cap.trim() && !/\b(Closes|Refs) #\d+/i.test(cap) && !/^\s*No issue:\s*\S/im.test(cap))
    e.push('Capacidad: add "Closes #N", "Refs #N" or "No issue: <reason>"');
  const v = s['Resultado de verify'] ?? '';
  if (v.trim()) {
    if (!/^\s*mode: full\s*$/m.test(v)) e.push('Resultado de verify: paste the full local summary ("mode: full")');
    for (const st of steps) if (!new RegExp(`^\\s*${rx(st)}: PASS\\s*$`, 'm').test(v)) e.push(`Resultado de verify: no "${st}: PASS" line`);
    for (const m of v.matchAll(/^\s*([\w-]+): FAIL\b/gm)) e.push(`Resultado de verify: ${m[1]} is FAIL`);
  }
  const r = s['Revisión'] ?? '';
  if (r.trim()) {
    const impl = model(r, 'Implement'), rev = model(r, 'Review');
    if (!impl) e.push('Revisión: add "Implement: <model>"');
    if (!rev) e.push('Revisión: add "Review: <model>"');
    if (impl && rev && impl === rev) e.push('Revisión: the writer and the reviewer use the same model');
  }
  const c = s['Checklist'] ?? '';
  if (c.trim()) {
    if (/^\s*- \[ \]/m.test(c)) e.push('Checklist: an item is not checked');
    const done = (c.match(/^\s*- \[[xX]\]/gm) ?? []).length;
    if (done < 4) e.push(`Checklist: ${done} checked items, 4 needed`);
  }
  return { ok: e.length === 0, errors: e };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--file');
  const body = i > 0 ? readFileSync(process.argv[i + 1], 'utf8')
    : process.env.PR_BODY !== undefined ? process.env.PR_BODY : readFileSync(0, 'utf8');
  const steps = verifySteps(readFileSync(new URL('./verify.sh', import.meta.url), 'utf8'));
  const { ok, errors } = checkPrBody(body, steps);
  for (const err of errors) console.error(`- ${err}`);
  console.log(`pr-body: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}
