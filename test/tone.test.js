import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tone } from '../src/shared/tone.js';

test('tone hits the three spec stops', () => {
  assert.equal(tone(100).base, '#b6ff00');
  assert.equal(tone(50).base, '#ffd84b');
  assert.equal(tone(0).base, '#ff5a4e');
});
test('tone clamps out-of-range input', () => {
  assert.deepEqual(tone(150), tone(100));
  assert.deepEqual(tone(-5), tone(0));
});
test('tone interpolates between stops', () => {
  assert.equal(tone(75).base, '#dbec26');
});
