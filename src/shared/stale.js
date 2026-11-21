// Why the numbers are stale, in words the owner can act on.
const TEXT = {
  'http-429': 'muitas consultas · volto em 10 min',
  network: 'sem internet · tentando de novo',
  loading: 'carregando…',
};
export const staleText = (reason) => TEXT[reason] ?? 'abra o Claude Code para atualizar';
