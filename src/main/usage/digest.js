// When to send the daily summary / pace toast, and what it says.
export function shouldDigest(now, lastDate, hour = 18, usedToday = false) {
  const d = new Date(now);
  return usedToday && d.getHours() >= hour && d.toDateString() !== lastDate;
}

export const shouldPaceAlert = (deltaPct, weekKey, lastWeekKey, threshold = 30) =>
  deltaPct != null && deltaPct >= threshold && weekKey !== lastWeekKey;

const signed = (n) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : '0%');

export function digestMessage({ weekUsedPct, resetLabel, day, week, top, now }) {
  const title = `Levl · semana em ${weekUsedPct}%`;
  if (day?.deltaPct == null && week?.deltaPct == null) {
    return { title, body: `Volta ${resetLabel}. Sem dados da semana passada para comparar.` };
  }
  const wd = new Date(now).toLocaleDateString('pt-BR', { weekday: 'long' });
  const passed = wd.endsWith('feira') ? 'passada' : 'passado';
  const parts = [];
  if (day?.deltaPct != null) parts.push(`Hoje ${signed(day.deltaPct)} vs ${wd} ${passed}`);
  if (week?.deltaPct != null) parts.push(`semana ${signed(week.deltaPct)}`);
  if (top) parts.push(`${top} lidera`);
  return { title, body: `Volta ${resetLabel}. ${parts.join(' · ')}` };
}
