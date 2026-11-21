import { tone } from '../shared/tone.js';
import { staleText } from '../shared/stale.js';

const $ = (id) => document.getElementById(id);
const tpl = $('meterTpl');
let last = null;

const hm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const wdShort = (d) => d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
// "22:00" today, "qui 04:00" on another day
const when = (d, now) => (d.toDateString() === new Date(now).toDateString() ? hm(d) : `${wdShort(d)} ${hm(d)}`);

function countdown(iso, now) {
  const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm} min`;
}
function forecastText(f, now) {
  if (!f || (!f.lasts && f.endsAt <= now)) return null;
  return f.lasts ? 'dá até a volta' : `acaba ${when(new Date(f.endsAt), now)}`;
}
function ago(at, now) {
  if (!at) return '';
  const m = Math.floor((now - at) / 60_000);
  return m < 1 ? 'agora' : `há ${m} min`;
}
const signed = (n) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : '0%');
const el = (tag, props) => Object.assign(document.createElement(tag), props);

function card(l, now) {
  const n = tpl.content.firstElementChild.cloneNode(true);
  const t = tone(l.remaining);
  const out = l.remaining <= 0; // limit really hit: say so until it resets
  n.style.setProperty('--base', t.base);
  n.style.setProperty('--hi', t.hi);
  n.classList.toggle('out', out);
  n.querySelector('.fill').style.height = `${l.remaining}%`;
  const tube = n.querySelector('.tube');
  tube.setAttribute('aria-valuenow', String(l.remaining));
  tube.setAttribute('aria-label', `${l.label}: ${out ? 'esgotado' : `${l.remaining}% restante`}`);
  n.querySelector('.k').textContent = l.label;
  n.querySelector('.p').textContent = out ? 'esgotado' : `${l.remaining}%`;
  const rows = [];
  const add = (k, v, cls = '') => rows.push(el('dt', { textContent: k }), el('dd', { textContent: v, className: cls }));
  if (l.resetsAt) { add('volta', when(new Date(l.resetsAt), now)); add('faltam', countdown(l.resetsAt, now)); }
  const f = out ? null : forecastText(l.forecast, now);
  if (f) add('ritmo', f, l.forecast.lasts ? 'ok' : 'warn');
  n.querySelector('dl').replaceChildren(...rows);
  return n;
}

function render() {
  const s = last;
  if (!s) return;
  const now = Date.now();
  document.body.className = `look-${s.look}`;
  $('panel').classList.toggle('stale', s.stale);
  $('ago').textContent = s.stale ? staleText(s.reason) : ago(s.at, now); // status lives in the header so the layout never grows
  $('ago').classList.toggle('warn', s.stale);
  $('plan').textContent = s.plan ?? 'Claude';
  $('version').textContent = `v${s.version}`;
  $('update').hidden = !s.updateReady;

  const main = s.limits.filter((l) => l.id === 'five_hour' || l.id === 'seven_day');
  $('pair').replaceChildren(...main.map((l) => card(l, now)));

  const extra = s.limits.filter((l) => !main.includes(l));
  $('extra').hidden = !extra.length;
  $('extra').textContent = extra.map((l) => `${l.label} ${l.remaining}%`).join(' · ');

  const i = s.insights;
  const day = new Date(now);
  const passed = day.toLocaleDateString('pt-BR', { weekday: 'long' }).endsWith('feira') ? 'passada' : 'passado';
  const stats = [];
  if (i?.week.deltaPct != null) stats.push(['Semana vs anterior', i.week.deltaPct]);
  if (i?.day.deltaPct != null) stats.push([`Hoje vs ${wdShort(day)} ${passed}`, i.day.deltaPct]);
  $('insight').replaceChildren(...(stats.length
    ? stats.map(([k, n]) => {
      const st = el('span', { className: 'stat' });
      st.append(el('small', { textContent: k }), el('b', { textContent: signed(n), className: n > 0 ? 'up' : n < 0 ? 'down' : '' }));
      return st;
    })
    : [el('small', { className: 'soft', textContent: i ? 'Sem dados da semana passada' : 'Lendo seu histórico…' })]));
}

window.levl.onState((s) => { last = s; render(); });
setInterval(render, 30_000);
$('gear').addEventListener('click', () => window.levl.openSettings());
$('leitor').addEventListener('click', () => window.levl.openLeitor());
$('update').addEventListener('click', () => window.levl.installUpdate());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.levl.closeWindow(); });
$('panel').focus();
window.levl.ready();
