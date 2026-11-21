import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dock, clampToWorkArea } from '../src/main/dock.js';

const wa = { x: 0, y: 0, width: 1920, height: 1040 };

test('dropped near bottom → horizontal, snapped to bottom', () => {
  const r = dock({ x: 500, y: 1000, width: 240, height: 20 }, wa, 8, 'v');
  assert.equal(r.orientation, 'h');
  assert.equal(r.edge, 'bottom');
  assert.equal(r.y, 1040 - 20 - 8);
  assert.equal(r.x, 500);
});
test('dropped near left → vertical, snapped to left', () => {
  const r = dock({ x: 30, y: 400, width: 20, height: 240 }, wa, 8, 'h');
  assert.equal(r.orientation, 'v');
  assert.equal(r.edge, 'left');
  assert.equal(r.x, 8);
});
test('dropped near top → horizontal at top', () => {
  const r = dock({ x: 700, y: 40, width: 240, height: 20 }, wa, 8, 'v');
  assert.deepEqual([r.orientation, r.edge, r.y], ['h', 'top', 8]);
});
test('dropped mid-screen keeps orientation, no edge', () => {
  const r = dock({ x: 900, y: 500, width: 20, height: 240 }, wa, 8, 'v');
  assert.equal(r.edge, null);
  assert.equal(r.orientation, 'v');
});
test('secondary display offsets are respected', () => {
  const wa2 = { x: 1920, y: 0, width: 1280, height: 1000 };
  const r = dock({ x: 3150, y: 300, width: 20, height: 240 }, wa2, 8, 'h');
  assert.equal(r.edge, 'right');
  assert.equal(r.x, 1920 + 1280 - 8 - r.width);
});
test('clampToWorkArea pulls an off-screen window fully inside', () => {
  const p = clampToWorkArea({ x: 3000, y: -50, width: 240, height: 20 }, wa);
  assert.deepEqual(p, { x: 1920 - 240, y: 0 });
});
