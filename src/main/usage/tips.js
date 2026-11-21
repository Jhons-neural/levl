// Free, rule-based tips shown before (or without) the Claude analysis.
import { hourMs, sumRange } from './compare.js';

const LONG_CTX = 300_000;

export function localTips(rows, start, end) {
  const inRange = rows.filter((r) => { const t = hourMs(r); return t >= start && t < end; });
  const total = sumRange(inRange, start, end);
  if (!total) return [];
  const tips = [];

  const maxCtx = new Map();
  for (const r of inRange) maxCtx.set(r.project, Math.max(maxCtx.get(r.project) ?? 0, r.ctx));
  const long = [...maxCtx].filter(([p, c]) => c > LONG_CTX && p !== 'Outros').sort((a, b) => b[1] - a[1]);
  if (long.length) {
    const named = long.slice(0, 3).map(([p, c]) => `${p} (${Math.round(c / 1000)}k)`).join(', ');
    const more = long.length > 3 ? ` e mais ${long.length - 3}` : '';
    tips.push(`Conversas muito longas em ${named}${more}: use /clear ou /compact entre tarefas.`);
  }

  const opus = Math.round((sumRange(inRange.filter((r) => r.family === 'opus'), start, end) / total) * 100);
  if (opus > 60) tips.push(`${opus}% do consumo foi no Opus: use o Sonnet para tarefas simples.`);

  const cc = Math.round((sumRange(inRange, start, end, (r) => r.cc) / total) * 100);
  if (cc > 50) tips.push(`${cc}% do consumo foi recarregando contexto: evite reabrir ou trocar de sessão no meio de tarefas longas.`);

  return tips;
}
