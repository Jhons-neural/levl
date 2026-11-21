// Liquid colour by remaining %: 100 lime → 50 yellow → 0 red (spec §6, option 2).
const G = [0xb6, 0xff, 0x00], Y = [0xff, 0xd8, 0x4b], R = [0xff, 0x5a, 0x4e];
const WHITE = [0xff, 0xff, 0xff], CREAM = [0xff, 0xec, 0xb0];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

export function tone(remaining) {
  const p = Math.min(100, Math.max(0, Number(remaining) || 0));
  const base = p >= 50 ? mix(Y, G, (p - 50) / 50) : mix(R, Y, p / 50);
  const hi = mix(base, p > 50 ? WHITE : CREAM, 0.35);
  return { base: hex(base), hi: hex(hi) };
}
