// lab/roofPlane/tests/trussChain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrussChain } from '../src/core/trussChain.js';

const spans = r => r.spans.map(s => Math.round(s));

test('eje A: corrida 3050.6->14449.5, paso 1200 desde inicio -> 9 vanos de 1200 + remate 599', () => {
  const r = buildTrussChain({ from: 3050.6, to: 14449.5, spacing: 1200, origin: 'start' });
  // total 11398.9 = 9*1200 + 598.9
  assert.equal(r.positions.length, 11); // 10 cerchas de la cadena + borde final
  assert.equal(r.collapsedShort, false); // 599 > 500, no colapsa
  const s = spans(r);
  assert.deepEqual(s.slice(0, 9), Array(9).fill(1200));
  assert.equal(s[9], 599);
});

test('origen end: el remate salta al inicio', () => {
  const r = buildTrussChain({ from: 3050.6, to: 14449.5, spacing: 1200, origin: 'end' });
  const s = spans(r);
  assert.equal(s[0], 599, 'remate al inicio');
  assert.deepEqual(s.slice(1), Array(9).fill(1200));
});

test('X=12800 (I->O): remate 48.9mm colapsa (umbral 500)', () => {
  // corrida 6650.6->18699.5 = 12048.9 = 10*1200 + 48.9
  const r = buildTrussChain({ from: 6650.6, to: 18699.5, spacing: 1200, origin: 'start', shortSpanThreshold: 500 });
  assert.equal(r.collapsedShort, true);
  const s = spans(r);
  // el último vano de 48.9 se fusiona con el penúltimo (1200) -> combined 1248.9 en 2 vanos ~624
  assert.ok(s.every(v => v >= 500), `todos los vanos >= 500: ${s}`);
  assert.ok(s.every(v => v <= 1200 + 1), `ningún vano > 1200: ${s}`);
  assert.ok(Math.abs(s[s.length - 1] - 624) < 5 && Math.abs(s[s.length - 2] - 624) < 5, `dos vanos ~624: ${s}`);
});

test('umbral no se activa cuando el remate es constructible (599 > 500)', () => {
  const r = buildTrussChain({ from: 0, to: 11398.9, spacing: 1200, shortSpanThreshold: 500 });
  assert.equal(r.collapsedShort, false);
});

test('cercha embebida en muro intermedio se mueve a la cara más cercana', () => {
  // muro intermedio en 6000..6100; una cercha caería en 6000 justo... pongamos paso que la meta dentro
  const r = buildTrussChain({
    from: 0, to: 12000, spacing: 1500, origin: 'start',
    intermediateWalls: [{ oMin: 5950, oMax: 6050, wallId: 999 }]
  });
  // cadena base: 0,1500,3000,4500,6000,7500... -> 6000 cae dentro de 5950..6050
  const shifted = r.positions.find(p => p.kind === 'shifted');
  assert.ok(shifted, 'hay una cercha reubicada');
  assert.equal(shifted.shiftedFromWallId, 999);
  assert.ok(shifted.offset === 5950 || shifted.offset === 6050, `movida a una cara: ${shifted.offset}`);
});

test('corrida exacta múltiplo del paso: sin remate', () => {
  const r = buildTrussChain({ from: 0, to: 6000, spacing: 1200 });
  assert.equal(r.positions.length, 6);
  assert.deepEqual(spans(r), Array(5).fill(1200));
});

test('umbral en mm es configurable: 600 activa el colapso del eje A (599)', () => {
  const r = buildTrussChain({ from: 3050.6, to: 14449.5, spacing: 1200, shortSpanThreshold: 600 });
  assert.equal(r.collapsedShort, true, 'con umbral 600 el remate de 599 sí colapsa');
  const s = spans(r);
  assert.ok(s.every(v => v >= 600), `todos >= 600: ${s}`);
});
