import { mdToHtml } from '../shared/md.js';

const $ = (id) => document.getElementById(id);
let state = null, lastCost = null;

const signed = (n) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : '0%');
const hm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function setDelta(el, n) {
  el.textContent = n == null ? 'sem dados' : signed(n);
  el.className = n > 0 ? 'up' : n < 0 ? 'down' : '';
}

function render() {
  const s = state;
  if (!s) return;
  const i = s.insights;
  const wk = s.limits.find((l) => l.id === 'seven_day');
  $('weekPct').textContent = i?.weekUsedPct != null ? `${i.weekUsedPct}%` : '—';
  if (wk?.resetsAt) {
    const d = new Date(wk.resetsAt);
    $('weekReset').textContent = `volta ${d.toLocaleDateString('pt-BR', { weekday: 'long' })} às ${hm(d)}`;
  }
  const wd = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
  setDelta($('weekDelta'), i?.week.deltaPct ?? null);
  setDelta($('dayDelta'), i?.day.deltaPct ?? null);
  $('dayDeltaSub').textContent = `vs ${wd} ${wd.endsWith('feira') ? 'passada' : 'passado'}, até esta hora`;

  const bars = (i?.top ?? []).map((p) => {
    const li = document.createElement('li');
    const name = Object.assign(document.createElement('span'), { className: 'name', textContent: p.project });
    const pct = Object.assign(document.createElement('span'), { className: 'pct', textContent: `${p.pct}%` });
    const track = Object.assign(document.createElement('span'), { className: 'track' });
    const bar = document.createElement('i');
    bar.style.width = `${p.pct}%`;
    track.append(bar);
    li.append(name, pct, track);
    return li;
  });
  $('bars').replaceChildren(...(bars.length ? bars : [Object.assign(document.createElement('li'), { className: 'empty', textContent: i ? 'Sem uso nesta semana.' : 'Lendo seu histórico…' })]));

  const tips = (i?.tips ?? []).map((t) => Object.assign(document.createElement('li'), { textContent: t }));
  $('tips').replaceChildren(...(tips.length ? tips : [Object.assign(document.createElement('li'), { className: 'empty', textContent: i ? 'Nada fora do normal esta semana.' : '' })]));

  $('analyze').disabled = s.analysisRunning;
  if (s.analysisRunning) $('status').textContent = 'Analisando… leva de 1 a 3 minutos.';
}

function showAnalysis(a) {
  if (!a) return;
  lastCost = a.costPct;
  const d = new Date(a.at);
  const model = a.model === 'opus' ? 'Opus' : 'Sonnet';
  const cost = a.costPct != null ? ` · custou ${a.costPct}% do limite de 5 h` : '';
  $('meta').textContent = `Feita em ${d.toLocaleDateString('pt-BR')} às ${hm(d)} · ${model}${cost}`;
  $('result').innerHTML = mdToHtml(a.markdown); // mdToHtml escapes everything and allows only a safe subset
}

const ERR = {
  'not-found': 'Não encontrei o Claude Code neste PC.',
  timeout: 'O Claude demorou demais. Tente de novo.',
  failed: 'Não consegui falar com o Claude Code.',
  'bad-output': 'O Claude respondeu num formato inesperado.',
  busy: 'Já tem uma análise rodando.',
};

$('analyze').addEventListener('click', () => {
  $('costText').textContent = lastCost != null
    ? `Usa cerca de ${Math.max(1, lastCost)}% do seu limite de 5 horas (medido na última análise). Continuar?`
    : 'Usa uma parte pequena do seu limite de 5 horas (estimativa: 2 a 5%). O Levl mede o custo real ao terminar. Continuar?';
  $('confirm').hidden = false;
  $('go').focus();
});
$('cancel').addEventListener('click', () => { $('confirm').hidden = true; });
$('go').addEventListener('click', async () => {
  $('confirm').hidden = true;
  $('status').textContent = 'Analisando… leva de 1 a 3 minutos.';
  $('analyze').disabled = true;
  const r = await window.levl.runAnalysis();
  $('analyze').disabled = false;
  if (r.ok) { $('status').textContent = ''; showAnalysis(r); }
  else $('status').textContent = ERR[r.reason] + (r.detail ? ` (${r.detail.slice(0, 120)})` : '');
});
$('result').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  window.levl.openLink(a.getAttribute('href'));
});
$('close').addEventListener('click', () => window.levl.closeWindow());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.levl.closeWindow(); });

window.levl.onState((s) => { state = s; render(); });
window.levl.lastAnalysis().then(showAnalysis);
window.levl.ready();
