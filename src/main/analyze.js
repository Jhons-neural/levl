// "Analisar com o Claude": runs the installed Claude Code CLI headless with a slim context.
import { spawn } from 'node:child_process';

// No user settings/hooks/MCP/skills/session file: keeps the base context ~4k tokens instead of ~45k.
export const CLAUDE_ARGS = [
  '-p', '--output-format', 'json', '--setting-sources', '', '--strict-mcp-config',
  '--disable-slash-commands', '--no-session-persistence', '--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch,WebFetch',
];

export function buildPrompt(summary) {
  return [
    'Você é um consultor de eficiência no uso do Claude Code (plano de assinatura).',
    'Abaixo está um resumo do consumo deste usuário (só números e nomes de pastas de projeto).',
    '"consumoEstimado" é tokens ponderados por preço, um indicador do quanto do plano foi gasto.',
    '',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    '',
    'Responda em português do Brasil, em Markdown, curto e prático, com estas seções:',
    '## O que está pesando — 2 a 4 frases, citando projetos e números do resumo.',
    '## O que fazer — 3 a 6 ações numeradas, da que mais economiza para a que menos, cada uma com o ganho esperado.',
    '## Ferramentas no GitHub — pesquise na web e liste até 5 repositórios ou ferramentas atuais que ajudem a medir ou reduzir consumo do Claude Code, cada um com link https e uma linha do porquê. Só inclua links que você verificou.',
    'Não invente números que não estão no resumo.',
  ].join('\n');
}

export function runAnalysis({ prompt, model = 'sonnet', spawnImpl = spawn, timeoutMs = 180_000, cwd, claudeCmd = 'claude' }) {
  return new Promise((resolve) => {
    let out = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    let child;
    try {
      child = spawnImpl(claudeCmd, [...CLAUDE_ARGS, '--model', model], { cwd, windowsHide: true });
    } catch (e) {
      return finish({ ok: false, reason: 'not-found', detail: e.message });
    }
    const timer = setTimeout(() => { child.kill?.(); finish({ ok: false, reason: 'timeout' }); }, timeoutMs);
    child.on('error', (e) => finish({ ok: false, reason: e.code === 'ENOENT' ? 'not-found' : 'failed', detail: e.message }));
    child.stdout?.on('data', (d) => { out += d; });
    child.on('close', () => {
      let j;
      try { j = JSON.parse(out); } catch { return finish({ ok: false, reason: 'bad-output' }); }
      if (j.is_error || typeof j.result !== 'string') return finish({ ok: false, reason: 'failed', detail: String(j.result ?? '') });
      finish({ ok: true, markdown: j.result });
    });
    child.stdin?.end(prompt);
  });
}
