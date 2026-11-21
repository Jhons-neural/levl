// Linear projection of when used% hits 100, from samples inside the look-back window.
export function forecast(samples, resetsAt, now, windowMs) {
  const s = samples.filter((p) => p.t >= now - windowMs && p.t <= now).sort((a, b) => a.t - b.t);
  if (s.length < 3) return null;
  const first = s[0], last = s[s.length - 1];
  const rate = (last.used - first.used) / (last.t - first.t);
  if (!(rate > 0)) return null;
  const endsAt = Math.round(last.t + (100 - last.used) / rate);
  return { endsAt, lasts: endsAt > resetsAt };
}
