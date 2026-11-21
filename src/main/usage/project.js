// Sessions mostly start on the Desktop, so the project is inferred from the paths the session touches.
// Matches C:\Projetos\X, JSON-escaped C:\\Projetos\\X and /c/Projetos/X.
const RE = /Projetos(?:\\\\|\\|\/)+([A-Za-z0-9._-]+)/g;

export function projectsInText(text) {
  return [...String(text).matchAll(RE)].map((m) => m[1]).filter((n) => n.length > 1 && !/^[.]+$/.test(n)); // drop noise like "A" or ".."
}

export function pickProject(counts, cwd) {
  let best = null, max = 0;
  for (const [name, c] of counts) if (c > max) { best = name; max = c; }
  if (best) return best;
  if (!cwd || /[\\/]Temp[\\/]/i.test(cwd)) return 'Outros'; // scratch/temp sessions aren't projects
  const base = cwd.split(/[\\/]/).filter(Boolean).pop();
  return base && base.length > 1 ? base : 'Outros';
}
