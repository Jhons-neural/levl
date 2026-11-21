const $ = (id) => document.getElementById(id);
const BOOLS = ['showLabel', 'onTop', 'clickThrough', 'locked', 'autostart', 'alertLow', 'alertRefill', 'digest', 'paceAlert'];
for (let h = 6; h <= 23; h++) $('digestHour').append(new Option(`${String(h).padStart(2, '0')}:00`, String(h)));
let cur = null;

async function save(partial) {
  const r = await window.levl.setSettings(partial);
  for (const k of ['hotkey', 'clickHotkey']) $(`${k}Err`).textContent = r.errors?.[k] ?? '';
  paint(r.settings);
}

function paint(s) {
  cur = s;
  document.querySelectorAll('.look').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.look === s.look)));
  $('opacity').value = Math.round(s.opacity * 100);
  $('opacityOut').textContent = `${Math.round(s.opacity * 100)}%`;
  $('length').value = s.length;
  $('lengthOut').textContent = `${s.length}px`;
  for (const k of BOOLS) $(k).checked = s[k];
  $('digestHour').value = String(s.digestHour);
  $('analysisModel').value = s.analysisModel;
  for (const k of ['hotkey', 'clickHotkey']) if (!$(k).classList.contains('rec')) $(k).value = s[k].replace('Control', 'Ctrl');
}

window.levl.onState((st) => {
  $('about').textContent = `Levl v${st.version} · by JHON`;
  if (!cur || JSON.stringify(cur) !== JSON.stringify(st.settings)) paint(st.settings);
});

document.querySelectorAll('.look').forEach((b) => b.addEventListener('click', () => save({ look: b.dataset.look })));
$('opacity').addEventListener('input', (e) => save({ opacity: e.target.value / 100 }));
$('length').addEventListener('change', (e) => save({ length: Number(e.target.value) }));
$('length').addEventListener('input', (e) => { $('lengthOut').textContent = `${e.target.value}px`; });
for (const k of BOOLS) $(k).addEventListener('change', (e) => save({ [k]: e.target.checked }));
$('digestHour').addEventListener('change', (e) => save({ digestHour: Number(e.target.value) }));
$('analysisModel').addEventListener('change', (e) => save({ analysisModel: e.target.value }));

// Hotkey capture: needs at least one modifier plus a key; Esc cancels.
for (const k of ['hotkey', 'clickHotkey']) {
  const el = $(k);
  el.addEventListener('focus', () => { el.classList.add('rec'); el.value = 'aperte o atalho…'; });
  el.addEventListener('blur', () => { el.classList.remove('rec'); paint(cur); });
  el.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Escape') return el.blur();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
    if (!mods.length) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    el.classList.remove('rec');
    save({ [k]: [...mods, key].join('+') }).then(() => el.blur());
  });
}

$('check').addEventListener('click', async () => {
  $('checkOut').textContent = 'procurando…';
  const r = await window.levl.checkUpdate();
  $('checkOut').textContent = {
    dev: 'só no app instalado',
    off: 'atualização automática ainda não ativada',
    available: `versão ${r.version} baixando — aparece um ponto no medidor`,
    current: 'você já está na versão mais recente',
    error: 'não deu para verificar agora',
  }[r.status];
});
$('close').addEventListener('click', () => window.levl.closeWindow());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.activeElement.classList.contains('key')) window.levl.closeWindow();
});
window.levl.ready();
