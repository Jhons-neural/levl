import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runAnalysis, buildPrompt, CLAUDE_ARGS } from '../src/main/analyze.js';
import { mdToHtml } from '../src/shared/md.js';

function fakeSpawn({ stdout = '', code = 0, error = null, hang = false } = {}) {
  const calls = [];
  const impl = (cmd, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    let input = '';
    child.stdin.on('data', (d) => { input += d; });
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('close', null)); };
    calls.push({ cmd, args, opts, input: () => input });
    setImmediate(() => {
      if (error) return child.emit('error', error);
      if (hang) return;
      child.stdout.end(stdout);
      child.emit('close', code);
    });
    return child;
  };
  return { impl, calls };
}

test('runAnalysis returns the markdown result and passes the prompt on stdin', async () => {
  const f = fakeSpawn({ stdout: JSON.stringify({ is_error: false, result: '# Ok' }) });
  const r = await runAnalysis({ prompt: 'P', model: 'sonnet', spawnImpl: f.impl, cwd: '.' });
  assert.deepEqual(r, { ok: true, markdown: '# Ok' });
  assert.equal(f.calls[0].input(), 'P');
  assert.ok(f.calls[0].args.includes('--model') && f.calls[0].args.includes('sonnet'));
  for (const a of CLAUDE_ARGS) assert.ok(f.calls[0].args.includes(a));
  const allowed = f.calls[0].args.indexOf('--allowedTools');
  assert.equal(f.calls[0].args[allowed + 1], 'WebSearch,WebFetch', 'headless runs cannot prompt, so web tools are pre-approved');
});
test('runAnalysis: CLI missing → not-found', async () => {
  const err = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
  const r = await runAnalysis({ prompt: 'P', spawnImpl: fakeSpawn({ error: err }).impl, cwd: '.' });
  assert.equal(r.reason, 'not-found');
});
test('runAnalysis: not logged in / error result → failed with detail', async () => {
  const f = fakeSpawn({ stdout: JSON.stringify({ is_error: true, result: 'Not logged in' }), code: 1 });
  const r = await runAnalysis({ prompt: 'P', spawnImpl: f.impl, cwd: '.' });
  assert.deepEqual(r, { ok: false, reason: 'failed', detail: 'Not logged in' });
});
test('runAnalysis: garbage output → bad-output', async () => {
  const r = await runAnalysis({ prompt: 'P', spawnImpl: fakeSpawn({ stdout: 'oops' }).impl, cwd: '.' });
  assert.equal(r.reason, 'bad-output');
});
test('runAnalysis: timeout kills the process', async () => {
  const r = await runAnalysis({ prompt: 'P', spawnImpl: fakeSpawn({ hang: true }).impl, timeoutMs: 20, cwd: '.' });
  assert.equal(r.reason, 'timeout');
});
test('buildPrompt embeds the summary and asks for the agreed sections', () => {
  const p = buildPrompt({ plano: 'Pro', projetos: [{ projeto: 'ALPHA' }] });
  assert.match(p, /"projeto": "ALPHA"/);
  for (const w of ['GitHub', 'ações', 'Markdown']) assert.ok(p.includes(w), w);
});
test('mdToHtml renders the safe subset and escapes everything else', () => {
  const h = mdToHtml('# T\n\n- **a** `b`\n- [x](https://github.com/a/b)\n\n1. um\n\n<script>alert(1)</script> [y](javascript:alert(1))');
  assert.ok(h.includes('<h1>T</h1>'));
  assert.ok(h.includes('<ul><li><strong>a</strong> <code>b</code></li>'));
  assert.ok(h.includes('<a href="https://github.com/a/b">x</a>'));
  assert.ok(h.includes('<ol><li>um</li></ol>'));
  assert.ok(h.includes('&lt;script&gt;'));
  assert.ok(!h.includes('javascript:'));
  assert.ok(!/<script/i.test(h));
});
