// Il service worker deve mettere in cache tutto quello che l'app carica, o offline si apre vuota.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];')).matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('every file in the shell exists', () => {
  for (const f of shell) if (f !== './') assert.ok(existsSync(new URL(f, root)), `manca ${f}`);
});

test('every module and demo photo is in the shell', () => {
  for (const f of readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js'))) assert.ok(shell.includes(`js/${f}`), `sw.js non mette in cache js/${f}`);
  for (const f of readdirSync(new URL('demo/', root)).filter((f) => f.endsWith('.jpg'))) assert.ok(shell.includes(`demo/${f}`), `sw.js non mette in cache demo/${f}`);
});
