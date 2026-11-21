// Compact, path-free summary sent to the Claude analysis (numbers + project folder names only).
import { weekCompare, dayCompare, topProjects, hourMs, sumRange } from './compare.js';
import { localTips } from './tips.js';

export function buildSummary({ rows, windowStart, now, plan, limits = [] }) {
  const week = weekCompare(rows, windowStart, now);
  const day = dayCompare(rows, now);
  const inWeek = rows.filter((r) => { const t = hourMs(r); return t >= windowStart && t < now; });
  const total = sumRange(inWeek, windowStart, now) || 1;
  const modelos = {};
  for (const f of ['opus', 'sonnet', 'haiku', 'other']) {
    const s = sumRange(inWeek.filter((r) => r.family === f), windowStart, now);
    if (s) modelos[f] = Math.round((s / total) * 100);
  }
  const maxCtx = {};
  for (const r of inWeek) maxCtx[r.project] = Math.max(maxCtx[r.project] ?? 0, r.ctx);
  return {
    plano: plan ?? 'desconhecido',
    agora: new Date(now).toISOString(),
    limites: limits.map((l) => ({ nome: l.label, restantePct: l.remaining, voltaEm: l.resetsAt })),
    semana: { inicio: new Date(windowStart).toISOString(), consumoEstimado: week.a, vsSemanaPassadaPct: week.deltaPct },
    dia: { consumoEstimado: day.a, vsMesmoDiaSemanaPassadaPct: day.deltaPct },
    projetos: topProjects(rows, windowStart, now, 8).map((p) => ({
      projeto: p.project, pctDaSemana: p.pct, maiorContextoTokens: maxCtx[p.project] ?? 0,
    })),
    modelos,
    dicasLocais: localTips(rows, windowStart, now),
    observacao: 'consumoEstimado = tokens ponderados por preço (proxy do plano), só Claude Code neste PC.',
  };
}
