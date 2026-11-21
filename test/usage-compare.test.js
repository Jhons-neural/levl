import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRange, weekCompare, dayCompare, topProjects } from '../src/main/usage/compare.js';
import { localTips } from '../src/main/usage/tips.js';
import { shouldDigest, shouldPaceAlert, digestMessage } from '../src/main/usage/digest.js';
import { buildSummary } from '../src/main/usage/summary.js';

const H = 3_600_000, D = 24 * H;
const row = (iso, units, extra = {}) => ({ hour: iso.slice(0, 13), project: 'ALPHA', family: 'sonnet', units, ctx: 1000, cc: 0, ...extra });
const now = Date.parse('2026-11-22T15:30:00Z');
const windowStart = Date.parse('2026-11-19T08:00:00Z');

test('compareRange: delta vs previous range', () => {
  const rows = [row('2026-11-20T10', 150), row('2026-11-13T10', 100)];
  const r = compareRange(rows, Date.parse('2026-11-20T00:00Z'), Date.parse('2026-11-21T00:00Z'), Date.parse('2026-11-13T00:00Z'), Date.parse('2026-11-14T00:00Z'));
  assert.deepEqual(r, { a: 150, b: 100, deltaPct: 50 });
});
test('compareRange: no previous data → deltaPct null (never Infinity)', () => {
  const r = compareRange([row('2026-11-20T10', 150)], 0, now, 0, 1);
  assert.equal(r.deltaPct, null);
});
test('weekCompare uses the same offset inside the previous window', () => {
  const rows = [row('2026-11-20T10', 300), row('2026-11-13T10', 200), row('2026-11-15T16', 999)]; // last one is after the offset
  const w = weekCompare(rows, windowStart, now);
  assert.equal(w.a, 300);
  assert.equal(w.b, 200);
  assert.equal(w.deltaPct, 50);
});
test('dayCompare: today so far vs same weekday last week up to same hour', () => {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  const rows = [row(new Date(t + H).toISOString(), 80), row(new Date(t - 7 * D + H).toISOString(), 40), row(new Date(now - 7 * D + 2 * H).toISOString(), 500)];
  const d = dayCompare(rows, now);
  assert.equal(d.a, 80);
  assert.equal(d.b, 40);
  assert.equal(d.deltaPct, 100);
});
test('topProjects ranks with share', () => {
  const rows = [row('2026-11-20T10', 300), row('2026-11-20T11', 100, { project: 'BETA' })];
  assert.deepEqual(topProjects(rows, windowStart, now, 5), [
    { project: 'ALPHA', units: 300, pct: 75 }, { project: 'BETA', units: 100, pct: 25 },
  ]);
});
test('localTips flags long contexts, heavy Opus share and cache churn', () => {
  const rows = [
    row('2026-11-20T10', 700, { family: 'opus', ctx: 420_000, cc: 600 }),
    row('2026-11-20T11', 300, { project: 'BETA' }),
  ];
  const tips = localTips(rows, windowStart, now);
  assert.ok(tips.some((t) => t.includes('ALPHA') && t.includes('420k')));
  assert.ok(tips.some((t) => t.includes('70%') && t.includes('Opus')));
  assert.ok(tips.some((t) => t.includes('60%')));
  assert.deepEqual(localTips([row('2026-11-20T10', 10)], windowStart, now), []);
  const many = ['P1', 'P2', 'P3', 'P4', 'P5'].map((p, k) => row('2026-11-20T10', 10, { project: p, ctx: 400_000 + k * 1000 }));
  const long = localTips(many, windowStart, now).filter((t) => t.startsWith('Conversas muito longas'));
  assert.equal(long.length, 1, 'one combined tip');
  assert.match(long[0], /P5 \(404k\), P4 \(403k\), P3 \(402k\) e mais 2/);
  assert.deepEqual(localTips([row('2026-11-20T10', 10, { project: 'Outros', ctx: 500_000 })], windowStart, now), [], 'Outros is not actionable');
});
test('shouldDigest once per day after the hour and only with usage', () => {
  const at19 = new Date(now); at19.setHours(19, 0, 0, 0);
  const at10 = new Date(now); at10.setHours(10, 0, 0, 0);
  const today = at19.toDateString();
  assert.equal(shouldDigest(at19.getTime(), null, 18, true), true);
  assert.equal(shouldDigest(at19.getTime(), today, 18, true), false);
  assert.equal(shouldDigest(at10.getTime(), null, 18, true), false);
  assert.equal(shouldDigest(at19.getTime(), null, 18, false), false);
});
test('shouldPaceAlert once per window above threshold', () => {
  assert.equal(shouldPaceAlert(35, 'w2', 'w1', 30), true);
  assert.equal(shouldPaceAlert(35, 'w2', 'w2', 30), false);
  assert.equal(shouldPaceAlert(10, 'w2', 'w1', 30), false);
  assert.equal(shouldPaceAlert(null, 'w2', 'w1', 30), false);
});
test('digestMessage reads naturally', () => {
  const m = digestMessage({ weekUsedPct: 66, resetLabel: 'qui 04:59', day: { deltaPct: 18 }, week: { deltaPct: -5 }, top: 'ALPHA', now });
  assert.equal(m.title, 'Levl · semana em 66%');
  assert.match(m.body, /^Volta qui 04:59\. Hoje \+18% vs \w+ passad[oa] · semana −5% · ALPHA lidera$/);
  const none = digestMessage({ weekUsedPct: 10, resetLabel: 'qui', day: { deltaPct: null }, week: { deltaPct: null }, top: null, now });
  assert.equal(none.body, 'Volta qui. Sem dados da semana passada para comparar.');
});
test('buildSummary carries numbers and project names only', () => {
  const rows = [row('2026-11-20T10', 700, { family: 'opus', ctx: 420_000 }), row('2026-11-13T10', 350)];
  const s = buildSummary({ rows, windowStart, now, plan: 'Pro', limits: [{ id: 'seven_day', label: 'semana', remaining: 34, resetsAt: '2026-11-26T08:00:00.000Z' }] });
  assert.equal(s.plano, 'Pro');
  assert.equal(s.semana.vsSemanaPassadaPct, 100);
  assert.equal(s.projetos[0].projeto, 'ALPHA');
  assert.equal(s.modelos.opus, 100);
  assert.ok(!JSON.stringify(s).includes(':\\'), 'no Windows paths');
});
