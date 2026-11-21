import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { unitsFor, modelFamily } from '../src/main/usage/weights.js';
import { projectsInText, pickProject } from '../src/main/usage/project.js';
import { scanFile, scanAll } from '../src/main/usage/scan.js';

const LOGS = fileURLToPath(new URL('./fixtures/logs/', import.meta.url));

test('modelFamily maps ids', () => {
  assert.equal(modelFamily('claude-opus-5-5'), 'opus');
  assert.equal(modelFamily('claude-sonnet-5-5'), 'sonnet');
  assert.equal(modelFamily('claude-haiku-5-5'), 'haiku');
  assert.equal(modelFamily('<synthetic>'), 'other');
});
test('unitsFor applies spec weights', () => {
  const u = { input_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000, output_tokens: 200 };
  assert.equal(unitsFor(u, 'claude-opus-5-5'), 16750);
  assert.equal(unitsFor({ input_tokens: 10, output_tokens: 100 }, 'claude-sonnet-5-5'), 1530);
  assert.equal(unitsFor({}, 'x'), 0);
});
test('projectsInText finds the three path styles', () => {
  assert.deepEqual(projectsInText(String.raw`{"file_path":"C:\\Projetos\\ALPHA\\a.md"}`), ['ALPHA']); // JSON-escaped
  assert.deepEqual(projectsInText('cd /c/Projetos/BETA-APP && ls'), ['BETA-APP']);
  assert.deepEqual(projectsInText(String.raw`C:\Projetos\GAMMA\x`), ['GAMMA']);
  assert.deepEqual(projectsInText('nothing here'), []);
  assert.deepEqual(projectsInText('see Projetos/A or Projetos/./x'), [], 'one-char and dot names are noise');
});
test('pickProject: most frequent, else cwd basename, else Outros', () => {
  assert.equal(pickProject(new Map([['A', 1], ['B', 3]]), String.raw`C:\x`), 'B');
  assert.equal(pickProject(new Map(), String.raw`C:\Projetos\LEVL`), 'LEVL');
  assert.equal(pickProject(new Map(), undefined), 'Outros');
  assert.equal(pickProject(new Map(), String.raw`C:\Users\x\AppData\Local\Temp\claude\s\scratchpad\A`), 'Outros', 'temp dirs are not projects');
  assert.equal(pickProject(new Map(), String.raw`C:\work\B`), 'Outros', 'one-letter names are noise');
});
test('scanFile dedupes requests, skips broken lines, attributes the project', async () => {
  const { rows } = await scanFile(join(LOGS, 'proj', 's1.jsonl'));
  const total = rows.reduce((a, r) => a + r.units, 0);
  assert.equal(total, 16750 + 1530);
  assert.ok(rows.every((r) => r.project === 'ALPHA'));
  const opus = rows.find((r) => r.family === 'opus');
  assert.equal(opus.hour, '2026-11-16T10');
  assert.equal(opus.ctx, 11100);
  assert.equal(opus.cc, 6250);
});
test('scanAll walks subfolders, uses cwd fallback and reuses cache', async () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  const first = await scanAll({ root: LOGS, now, cache: {}, maxAgeDays: 3650 });
  assert.equal(first.rows.find((r) => r.family === 'haiku').project, 'BETA-APP');
  const keys = Object.keys(first.cache);
  assert.equal(keys.length, 2);
  // poison cached rows: an unchanged file must not be re-read
  for (const k of keys) first.cache[k].rows = [{ hour: 'h', project: 'CACHED', family: 'other', units: 1, ctx: 0, cc: 0 }];
  const second = await scanAll({ root: LOGS, now, cache: first.cache, maxAgeDays: 3650 });
  assert.ok(second.rows.every((r) => r.project === 'CACHED'));
});
