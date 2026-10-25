import { readdir, lstat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const allowLab = process.argv.slice(2).includes('--allow-lab');
const MiB = 1024 * 1024;
const forbidden = new Set(['evidence', 'reference', 'eval', 'research', 'artifacts', 'archive', 'docs', 'fixtures', 'maps', 'media', 'video', 'videos', 'pes']);
let total = 0;
let violations = 0;
const fail = (message) => { console.error(`FAIL: ${message}`); violations++; };
const size = (bytes) => `${bytes} bytes (${(bytes / MiB).toFixed(3)} MiB)`;
for (const arg of process.argv.slice(2)) {
  if (arg !== '--allow-lab') fail(`unknown argument: ${arg}`);
}

async function walk(directory, segments = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const parts = [...segments, entry.name];
    const relative = parts.join('/');
    const filename = path.join(directory, entry.name);
    const stat = await lstat(filename);
    if (forbidden.has(entry.name.toLowerCase())) fail(`${relative}: forbidden path segment`);
    if (stat.isSymbolicLink()) { fail(`${relative}: symbolic link`); continue; }
    if (stat.isDirectory()) { await walk(filename, parts); continue; }
    if (!stat.isFile()) { fail(`${relative}: not a regular file`); continue; }
    total += stat.size;
    console.log(`${relative}: ${size(stat.size)}`);
    if (stat.size > 2 * MiB) fail(`${relative}: exceeds 2 MiB per file`);
    if (!allowLab && /^(?:lab(?:[.-]|$))/i.test(entry.name)) fail(`${relative}: lab output in public build`);
    const allowed = new Set(['.html', '.js', '.css']).has(path.extname(entry.name).toLowerCase());
    if (!allowed) fail(`${relative}: file type not allowed`);
    if (allowed) {
      const source = await readFile(filename, 'utf8');
      const patterns = [
        /\b(?:src|href)\s*=\s*["']\s*\//gi,
        /\b(?:src|href)\s*=\s*\/(?![/*])/gi,
        /url\(\s*["']?\s*\//gi,
        /["'`]\/assets\//g,
        /["'`]\/(?!\/)[^"'`\s]*\.[a-z0-9]{2,5}["'`]/gi,
        /(?:\/\/#|\/\*#)\s*sourceMappingURL\s*=/g,
      ];
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) fail(`${relative}:${match.index}: absolute asset path or source map: ${match[0]}`);
      }
    }
  }
}
try {
  await walk(root);
} catch (error) {
  fail(`cannot inspect dist/: ${error.message}`);
}
console.log(`Total: ${size(total)} (limit 5 MiB; per file 2 MiB)`);
if (total > 5 * MiB) fail('dist/ exceeds 5 MiB total');
console.log(`${violations ? 'FAIL' : 'PASS'}: dist-check (${violations} violations${allowLab ? ', lab allowed' : ', public'})`);
process.exitCode = violations ? 1 : 0;
