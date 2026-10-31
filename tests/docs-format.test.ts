import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function cells(line: string): number {
  let count = 0;
  let ticks = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '`') ticks = ticks ? 0 : 1;
    else if (c === '|' && !ticks && (i === 0 || line[i - 1] !== '\\')) count++;
  }
  return count - 1;
}

export function tableErrors(text: string, file: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const errors: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith('|')) { i++; continue; }
    const start = i;
    while (i < lines.length && lines[i].startsWith('|')) i++;
    const block = lines.slice(start, i);
    const headerCells = cells(block[0]);
    if (!block[0].endsWith('|')) errors.push(`${file}:${start + 1}: header must end with |`);
    if (block.length < 2) { errors.push(`${file}:${start + 1}: table has no separator row`); continue; }
    if (!/^\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(block[1])) errors.push(`${file}:${start + 2}: invalid separator`);
    else if (cells(block[1]) !== headerCells) errors.push(`${file}:${start + 2}: separator cell count differs from header`);
    for (let j = 2; j < block.length; j++) {
      if (!block[j].endsWith('|')) errors.push(`${file}:${start + j + 1}: row must end with |`);
      if (cells(block[j]) !== headerCells) errors.push(`${file}:${start + j + 1}: row cell count differs from header`);
    }
  }
  return errors;
}

test('Markdown tables in process docs have valid headers, separators and cell counts', () => {
  for (const file of ['AGENTS.md', '.agents/skills/verify-futbol-excitante/SKILL.md', 'docs/TOKENS.md', 'docs/manual-device-test.md']) {
    assert.deepEqual(tableErrors(readFileSync(file, 'utf8'), file), [], file);
  }
});

test('table lint rejects broken blocks and rows', () => {
  for (const fixture of [
    '| A | B |\n| --- | --- |\n\n| x | y |',
    '| A | B |\n| --- | --- |\n| x | y | z |',
    '| A | B |\n| --- | --- |\n| x | y',
    '| A | B |\n| --- | --- |\ntext\n| x | y |',
  ]) assert.ok(tableErrors(fixture, 'fixture.md').length > 0, fixture);
});

const header = /^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) — (?:PR pendiente(?: \(\[#(\d+)\]\(https:\/\/github\.com\/oxalc88\/futbol-excitante\/pull\/\2\)\))?|\[#(\d+)\]\(https:\/\/github\.com\/oxalc88\/futbol-excitante\/pull\/\3\)) · .+$/;
function progressErrors(text: string): string[] {
  const errors: string[] = [];
  const dates: string[] = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.startsWith('## ')) continue;
    const match = line.match(header);
    if (!match) { errors.push(`line ${i + 1}: invalid header`); continue; }
    if (!(/\/issues\/\d+\)/.test(line) || /sin issue/.test(line))) errors.push(`line ${i + 1}: missing issue or sin issue`);
    dates.push(match[1]);
  }
  if (dates.some((d, i) => i > 0 && dates[i - 1] < d)) errors.push('timestamps are not newest first');
  return errors;
}

test('PROGRESS headers include date, PR and issue state, newest first', () => {
  assert.deepEqual(progressErrors(readFileSync('docs/PROGRESS.md', 'utf8')), []);
});

test('PROGRESS lint rejects wrong order and missing issue state', () => {
  const good = '## 2026-10-30 10:00 — [#2](https://github.com/oxalc88/futbol-excitante/pull/2) · New · sin issue\n## 2026-10-29 09:00 — PR pendiente ([#1](https://github.com/oxalc88/futbol-excitante/pull/1)) · Old · sin issue';
  assert.ok(progressErrors(good).length === 0);
  assert.ok(progressErrors(good.replace('2026-10-30 10:00', '2026-10-28 10:00')).some(e => e.includes('newest first')));
  assert.ok(progressErrors(good.replace('· sin issue', '· no issue').split('\n')[0]).some(e => e.includes('missing issue')));
});
