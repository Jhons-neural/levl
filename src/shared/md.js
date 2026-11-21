// Tiny Markdown → HTML for model output: everything escaped first, then a fixed safe subset.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, url) => (url.startsWith('https://') ? `<a href="${url}">${t}</a>` : t));
}

export function mdToHtml(md = '') {
  const out = [];
  let list = null; // 'ul' | 'ol'
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (!line) { close(); continue; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      close();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = /^[-*]\s+(.*)$/.exec(line)) || (m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      const kind = /^\d/.test(line) ? 'ol' : 'ul';
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join('');
}
