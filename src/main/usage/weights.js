// Plan-consumption proxy: list-price ratios between token kinds and model families.
const FACTOR = { opus: 5, sonnet: 3, haiku: 1, other: 3 };

export function modelFamily(model = '') {
  const m = String(model).toLowerCase();
  return m.includes('opus') ? 'opus' : m.includes('sonnet') ? 'sonnet' : m.includes('haiku') ? 'haiku' : 'other';
}

const n = (v) => (typeof v === 'number' && v > 0 ? v : 0);

export function unitsFor(u = {}, model) {
  const raw = n(u.input_tokens) + 1.25 * n(u.cache_creation_input_tokens) + 0.1 * n(u.cache_read_input_tokens) + 5 * n(u.output_tokens);
  return Math.round(raw * FACTOR[modelFamily(model)]);
}

export function cacheCreateUnits(u = {}, model) {
  return Math.round(1.25 * n(u.cache_creation_input_tokens) * FACTOR[modelFamily(model)]);
}

export const contextOf = (u = {}) => n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens);
