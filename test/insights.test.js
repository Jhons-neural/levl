import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInsights } from '../src/main/usage/insights.js';

const now = Date.parse('2026-11-22T15:30:00Z');
const row = (hour, units, project = 'ALPHA') => ({ hour, project, family: 'sonnet', units, ctx: 0, cc: 0 });

test('computeInsights anchors the week on the weekly reset', () => {
  const limits = [{ id: 'seven_day', remaining: 34, resetsAt: '2026-11-26T08:00:00.000Z' }];
  const i = computeInsights([row('2026-11-20T10', 300), row('2026-11-13T10', 200)], limits, now);
  assert.equal(i.windowStart, Date.parse('2026-11-19T08:00:00.000Z'));
  assert.equal(i.week.deltaPct, 50);
  assert.equal(i.weekUsedPct, 66);
  assert.equal(i.top[0].project, 'ALPHA');
});
test('computeInsights without a weekly limit falls back to the last 7 days', () => {
  const i = computeInsights([], [], now);
  assert.equal(i.windowStart, now - 7 * 86_400_000);
  assert.equal(i.weekUsedPct, null);
  assert.equal(i.week.deltaPct, null);
});
