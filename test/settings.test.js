import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings, DEFAULTS } from '../src/main/settings.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'levl-set-'));

test('missing file → defaults', () => {
  const s = loadSettings(fresh());
  assert.deepEqual(s, DEFAULTS);
  assert.equal(s.look, 'linha');
  assert.equal(s.hotkey, 'Control+Alt+L');
  assert.equal(s.clickHotkey, 'Control+Alt+K');
});
test('corrupt file → defaults, original kept as settings.bad.json', () => {
  const d = fresh();
  writeFileSync(join(d, 'settings.json'), '{oops');
  assert.deepEqual(loadSettings(d), DEFAULTS);
  assert.equal(readFileSync(join(d, 'settings.bad.json'), 'utf8'), '{oops');
});
test('save merges, persists, drops unknown keys', () => {
  const d = fresh();
  saveSettings(d, { look: 'grafite', evil: 1 });
  const s = loadSettings(d);
  assert.equal(s.look, 'grafite');
  assert.equal(s.onTop, true);
  assert.equal('evil' in s, false);
});
test('values are clamped and enums validated', () => {
  const d = fresh();
  const s = saveSettings(d, { opacity: 0.1, length: 999, look: 'neon' });
  assert.equal(s.opacity, 0.3);
  assert.equal(s.length, 420);
  assert.equal(s.look, 'linha');
  assert.equal(saveSettings(d, { length: 50, opacity: 5 }).length, 120);
  assert.equal(loadSettings(d).opacity, 1);
});
test('save is atomic (no temp file left behind)', () => {
  const d = fresh();
  saveSettings(d, { look: 'nevoa' });
  assert.equal(existsSync(join(d, 'settings.json.tmp')), false);
});
test('a file saved with a UTF-8 BOM still loads', () => {
  const d = fresh();
  writeFileSync(join(d, 'settings.json'), '﻿' + JSON.stringify({ look: 'nevoa' }));
  assert.equal(loadSettings(d).look, 'nevoa');
});
test('save never throws when the file cannot be replaced (locked/antivirus)', () => {
  const d = fresh();
  mkdirSync(join(d, 'settings.json')); // a directory in the way makes rename fail
  let s;
  assert.doesNotThrow(() => { s = saveSettings(d, { look: 'grafite' }); });
  assert.equal(s.look, 'grafite');
});
test('load never throws when the file cannot be read', () => {
  const d = fresh();
  mkdirSync(join(d, 'settings.json'));
  assert.deepEqual(loadSettings(d), DEFAULTS);
});
test('leitor settings: defaults and validation', () => {
  const d = fresh();
  const s = loadSettings(d);
  assert.equal(s.digest, true);
  assert.equal(s.digestHour, 18);
  assert.equal(s.paceAlert, true);
  assert.equal(s.analysisModel, 'sonnet');
  const t = saveSettings(d, { analysisModel: 'gpt', digestHour: 30 });
  assert.equal(t.analysisModel, 'sonnet');
  assert.equal(t.digestHour, 23);
  assert.equal(saveSettings(d, { analysisModel: 'opus' }).analysisModel, 'opus');
});
