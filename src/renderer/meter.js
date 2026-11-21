import { tone } from '../shared/tone.js';
import { staleText } from '../shared/stale.js';

const $ = (id) => document.getElementById(id);
const hit = $('hit'), tube = $('tube'), glass = $('glass'), fill = $('fill'), lbl = $('lbl');
const BULB = { linha: 14, grafite: 22, nevoa: 22 };
let locked = false;

window.levl.onState((s) => {
  const o = s.orientation;
  document.body.className = `look-${s.look} o-${o}` + (s.showLabel ? '' : ' nolabel') + (s.locked ? ' locked' : '');
  locked = s.locked;
  tube.className = `tube ${o}` + (s.stale ? ' stale' : '') + (s.updateReady ? ' update' : '');

  const glassLen = s.length - BULB[s.look];
  glass.style.width = o === 'h' ? `${glassLen}px` : '';
  glass.style.height = o === 'v' ? `${glassLen}px` : '';

  const five = s.limits.find((l) => l.id === 'five_hour');
  const pct = five ? five.remaining : 0;
  const t = tone(pct);
  tube.style.setProperty('--base', t.base);
  tube.style.setProperty('--hi', t.hi);
  lbl.style.setProperty('--base', t.base);
  fill.style.width = o === 'h' ? `${pct}%` : '';
  fill.style.height = o === 'v' ? `${pct}%` : '';
  const out = five && pct <= 0; // limit hit: say so until it resets
  lbl.textContent = !five ? '—' : out ? 'esgotado' : `${pct}%`;
  document.body.classList.toggle('out', !!out);
  hit.setAttribute('aria-valuenow', String(pct));
  hit.title = s.stale ? staleText(s.reason) : out ? 'Limite de 5 horas esgotado' : `5 horas: ${pct}% restante`;
});

// pointer drag vs click: movement under 4 px is a click
let start = null, dragging = false, raf = 0;
hit.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  hit.setPointerCapture(e.pointerId);
  start = { x: e.screenX, y: e.screenY };
  dragging = false;
});
hit.addEventListener('pointermove', (e) => {
  if (!start || locked) return;
  if (!dragging && Math.hypot(e.screenX - start.x, e.screenY - start.y) >= 4) {
    dragging = true;
    window.levl.dragStart();
  }
  if (dragging && !raf) raf = requestAnimationFrame(() => { raf = 0; window.levl.dragMove(); });
});
hit.addEventListener('pointerup', () => {
  if (!start) return;
  if (dragging) window.levl.dragEnd(); else window.levl.togglePopup();
  start = null; dragging = false;
});
hit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.levl.togglePopup(); }
});

window.levl.ready();
