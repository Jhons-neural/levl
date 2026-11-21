// Streams Claude Code's local logs into hourly rows per project + model family.
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { unitsFor, cacheCreateUnits, contextOf, modelFamily } from './weights.js';
import { projectsInText, pickProject } from './project.js';

const CWD_RE = /"cwd":"((?:[^"\\]|\\.)*)"/;

export async function scanFile(path) {
  const counts = new Map();
  const byRequest = new Map();
  let cwd;
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    for (const p of projectsInText(line)) counts.set(p, (counts.get(p) ?? 0) + 1);
    if (!cwd) {
      const m = CWD_RE.exec(line);
      if (m) try { cwd = JSON.parse(`"${m[1]}"`); } catch { /* ignore odd escapes */ }
    }
    if (!line.includes('"usage"')) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; } // partial line of a log still being written
    const u = j?.message?.usage;
    if (j?.type !== 'assistant' || !u || !j.timestamp) continue;
    const key = j.requestId ?? j.message.id ?? j.uuid;
    byRequest.set(key, { t: j.timestamp, model: j.message.model, u });
  }
  const project = pickProject(counts, cwd);
  const agg = new Map();
  for (const { t, model, u } of byRequest.values()) {
    const hour = new Date(t).toISOString().slice(0, 13);
    const family = modelFamily(model);
    const k = `${hour}|${family}`;
    const r = agg.get(k) ?? { hour, project, family, units: 0, ctx: 0, cc: 0 };
    r.units += unitsFor(u, model);
    r.cc += cacheCreateUnits(u, model);
    r.ctx = Math.max(r.ctx, contextOf(u));
    agg.set(k, r);
  }
  return { rows: [...agg.values()] };
}

async function listJsonl(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listJsonl(p)));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

export async function scanAll({ root, now = Date.now(), cache = {}, maxAgeDays = 35 }) {
  const next = {};
  const rows = [];
  for (const p of await listJsonl(root)) {
    const st = await stat(p).catch(() => null);
    if (!st || now - st.mtimeMs > maxAgeDays * 86_400_000) continue;
    const hit = cache[p];
    const entry = hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs
      ? hit
      : { size: st.size, mtimeMs: st.mtimeMs, rows: (await scanFile(p).catch(() => ({ rows: [] }))).rows };
    next[p] = entry;
    rows.push(...entry.rows);
  }
  return { rows, cache: next };
}
