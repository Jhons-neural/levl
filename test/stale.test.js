import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleText } from '../src/shared/stale.js';

test('staleText explains each failure in plain Portuguese', () => {
  assert.equal(staleText('http-429'), 'muitas consultas · volto em 10 min');
  assert.equal(staleText('network'), 'sem internet · tentando de novo');
  assert.equal(staleText('loading'), 'carregando…');
  assert.equal(staleText('expired'), 'abra o Claude Code para atualizar');
  assert.equal(staleText('http-500'), 'abra o Claude Code para atualizar');
});
