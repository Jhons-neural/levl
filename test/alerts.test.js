import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertsToFire } from '../src/main/alerts.js';

const M = 60_000;
const r1 = '2026-11-21T15:00:00Z', r2 = '2026-11-21T20:00:00Z';
const t1 = Date.parse(r1);

test('low fires once per window', () => {
  const a = alertsToFire({ id: 'five_hour', remaining: 15, resetsAt: r1 }, {}, t1 - 60 * M);
  assert.deepEqual(a.fire, ['low']);
  const b = alertsToFire({ id: 'five_hour', remaining: 12, resetsAt: r1 }, a.memory, t1 - 50 * M);
  assert.deepEqual(b.fire, []);
});
test('refill fires once right after a low window resets', () => {
  const a = alertsToFire({ id: 'five_hour', remaining: 15, resetsAt: r1 }, {}, t1 - 60 * M);
  const b = alertsToFire({ id: 'five_hour', remaining: 100, resetsAt: r2 }, a.memory, t1 + 5 * M);
  assert.deepEqual(b.fire, ['refill']);
  const c = alertsToFire({ id: 'five_hour', remaining: 99, resetsAt: r2 }, b.memory, t1 + 7 * M);
  assert.deepEqual(c.fire, []);
});
test('reset noticed hours later (sleep) is dropped silently', () => {
  const a = alertsToFire({ id: 'five_hour', remaining: 15, resetsAt: r1 }, {}, t1 - 60 * M);
  const b = alertsToFire({ id: 'five_hour', remaining: 100, resetsAt: r2 }, a.memory, t1 + 540 * M);
  assert.deepEqual(b.fire, []);
  assert.equal(b.memory.wasLowFor, undefined);
});
test('no alert above 20%', () => {
  assert.deepEqual(alertsToFire({ id: 'x', remaining: 21, resetsAt: r1 }, {}, t1).fire, []);
});
test('a changed resetsAt before the old window ends is not a refill', () => {
  const a = alertsToFire({ id: 'five_hour', remaining: 15, resetsAt: r1 }, {}, t1 - 60 * M);
  const b = alertsToFire({ id: 'five_hour', remaining: 15, resetsAt: '2026-11-21T15:01:00Z' }, a.memory, t1 - 50 * M);
  assert.equal(b.fire.includes('refill'), false);
});
