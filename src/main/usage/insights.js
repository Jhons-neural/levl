// Everything the popup, Leitor and digest show, from scanned rows + live plan limits.
import { weekCompare, dayCompare, topProjects } from './compare.js';
import { localTips } from './tips.js';

const WEEK = 7 * 86_400_000;

export function computeInsights(rows, limits, now) {
  const wk = limits.find((l) => l.id === 'seven_day');
  const resetsAt = wk?.resetsAt ? Date.parse(wk.resetsAt) : null;
  const windowStart = resetsAt ? resetsAt - WEEK : now - WEEK;
  return {
    windowStart,
    weekUsedPct: wk ? 100 - wk.remaining : null,
    week: weekCompare(rows, windowStart, now),
    day: dayCompare(rows, now),
    top: topProjects(rows, windowStart, now, 5),
    tips: localTips(rows, windowStart, now),
  };
}
