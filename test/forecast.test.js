import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast } from '../src/main/forecast.js';

const M = 60_000, now = 1_000_000_000;
const ramp = [0, 10, 20, 30].map((m) => ({ t: now - (30 - m) * M, used: 10 + m }));

test('runs out before reset → endsAt and lasts=false', () => {
  const f = forecast(ramp, now + 240 * M, now, 30 * M);
  assert.equal(f.lasts, false);
  assert.ok(Math.abs(f.endsAt - (now + 60 * M)) < M);
});
test('lasts until reset when reset comes first', () => {
  const f = forecast(ramp, now + 20 * M, now, 30 * M);
  assert.equal(f.lasts, true);
});
test('fewer than 3 samples → null', () => {
  assert.equal(forecast(ramp.slice(2), now + 240 * M, now, 30 * M), null);
});
test('flat usage → null', () => {
  const flat = ramp.map((s) => ({ ...s, used: 40 }));
  assert.equal(forecast(flat, now + 240 * M, now, 30 * M), null);
});
test('samples outside the window are ignored', () => {
  const old = [{ t: now - 120 * M, used: 0 }, ...ramp.slice(2)];
  assert.equal(forecast(old, now + 240 * M, now, 30 * M), null);
});
