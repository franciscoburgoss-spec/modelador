// lab/roofPlane/tests/polygonClip.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spanIntervalsAt, spanAt, runExtentOf, polygonBounds } from '../core/polygonClip.js';

// Rectángulo simple: canaleta en y=0, alto en y=3000, corrida x 0..8000.
const rect = [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 }];

test('rectángulo: luz constante en toda la corrida', () => {
  for (const x of [100, 4000, 7900]) {
    const s = spanAt(rect, 'x', x, 0, +1);
    assert.equal(s.inside, true);
    assert.equal(Math.round(s.span), 3000);
  }
});

test('rectángulo: fuera de la corrida no hay luz', () => {
  const s = spanAt(rect, 'x', 9000, 0, +1);
  assert.equal(s.inside, false);
});

test('runExtent devuelve la extensión sobre el eje de corrida', () => {
  assert.deepEqual(runExtentOf(rect, 'x'), [0, 8000]);
});

// L: canaleta en y=0 corrida x 0..14449. Brazo corto (x 0..12800) alto en y=1099;
// brazo largo (x 12800..14449) alto en y=1899. Vértices en orden.
const ele = [
  { x: 0, y: 0 }, { x: 14449, y: 0 },        // canaleta (lado bajo)
  { x: 14449, y: 1899 }, { x: 12800, y: 1899 }, // borde alto brazo largo
  { x: 12800, y: 1099 }, { x: 0, y: 1099 }    // escalón + borde alto brazo corto
];

test('L: luz corta antes del quiebre, luz larga después', () => {
  const antes = spanAt(ele, 'x', 6000, 0, +1);
  assert.equal(Math.round(antes.span), 1099, 'brazo corto');
  const despues = spanAt(ele, 'x', 13500, 0, +1);
  assert.equal(Math.round(despues.span), 1899, 'brazo largo');
});

test('L: el paso de cadena no depende de la luz (misma posición, distinta luz)', () => {
  // dos cerchas separadas 1200 caen una en cada brazo, cada una con su luz correcta
  const a = spanAt(ele, 'x', 12000, 0, +1);
  const b = spanAt(ele, 'x', 13200, 0, +1);
  assert.equal(Math.round(a.span), 1099);
  assert.equal(Math.round(b.span), 1899);
});

test('L: intervalos de luz son un solo tramo continuo en cada posición', () => {
  // el polígono es simple: cada rayo cruza el borde exactamente 2 veces (entra y sale)
  assert.equal(spanIntervalsAt(ele, 'x', 6000).length, 1);
  assert.equal(spanIntervalsAt(ele, 'x', 13500).length, 1);
});

test('bounds de la L', () => {
  const b = polygonBounds(ele);
  assert.deepEqual([b.minX, b.maxX, b.minY, b.maxY], [0, 14449, 0, 1899]);
});
