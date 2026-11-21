// Week/day comparisons over hourly rows ({ hour: 'YYYY-MM-DDTHH' UTC, project, family, units, ctx, cc }).
const DAY = 86_400_000;
export const hourMs = (r) => Date.parse(`${r.hour}:00:00Z`);

export function sumRange(rows, start, end, pick = (r) => r.units) {
  let s = 0;
  for (const r of rows) {
    const t = hourMs(r);
    if (t >= start && t < end) s += pick(r);
  }
  return s;
}

export function compareRange(rows, aStart, aEnd, bStart, bEnd) {
  const a = sumRange(rows, aStart, aEnd), b = sumRange(rows, bStart, bEnd);
  return { a, b, deltaPct: b > 0 ? Math.round(((a - b) / b) * 100) : null };
}

export const weekCompare = (rows, windowStart, now) =>
  compareRange(rows, windowStart, now, windowStart - 7 * DAY, now - 7 * DAY);

export function dayCompare(rows, now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0); // local midnight
  const start = d.getTime();
  return compareRange(rows, start, now, start - 7 * DAY, now - 7 * DAY);
}

export function topProjects(rows, start, end, n = 5) {
  const by = new Map();
  for (const r of rows) {
    const t = hourMs(r);
    if (t >= start && t < end) by.set(r.project, (by.get(r.project) ?? 0) + r.units);
  }
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([project, units]) => ({ project, units, pct: total ? Math.round((units / total) * 100) : 0 }));
}
