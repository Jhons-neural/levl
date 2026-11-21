import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serial } from '../src/main/serial.js';

test('serial: overlapping calls share one run', async () => {
  let runs = 0, release;
  const f = serial(() => { runs++; return new Promise((r) => { release = r; }); });
  const a = f(), b = f();
  release('x');
  assert.deepEqual(await Promise.all([a, b]), ['x', 'x']);
  assert.equal(runs, 1);
  const c = f(); // after it settles a new call starts a new run
  release('y');
  await c;
  assert.equal(runs, 2);
});
test('serial: a rejected run does not block the next one', async () => {
  let n = 0;
  const f = serial(async () => { n++; if (n === 1) throw new Error('boom'); return 'ok'; });
  await assert.rejects(f());
  assert.equal(await f(), 'ok');
});
