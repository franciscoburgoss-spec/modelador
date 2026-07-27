// lab/roofPlane/tests/polygonDetect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeOverlapOnPerp } from '../src/core/polygonClip.js';

// L con canaleta en y=0 (run x 0..14449). Borde alto escalonado: y=1099 para x 0..12800,
// y=1899 para x 12800..14449.
const ele = [
  { x: 0, y: 0 }, { x: 14449, y: 0 },
  { x: 14449, y: 1899 }, { x: 12800, y: 1899 },
  { x: 12800, y: 1099 }, { x: 0, y: 1099 }
];

test('borde alto del brazo corto: solape completo en y=1099 para x 0..12800', () => {
  const ov = edgeOverlapOnPerp(ele, 'x', 1099, 0, 12800);
  assert.ok(ov > 12000, `solape ~12800: ${ov}`);
});

test('borde alto del brazo largo: solape en y=1899 solo para x 12800..14449', () => {
  const ov = edgeOverlapOnPerp(ele, 'x', 1899, 12800, 14449);
  assert.ok(ov > 1600, `solape ~1649: ${ov}`);
});

test('muro vecino a y=1899 pero en x 0..12800 (fuera del borde real) -> solape 0', () => {
  // un muro paralelo de OTRO faldón, a la misma perpendicular alta del brazo largo pero en el
  // rango del brazo corto: NO forma parte del contorno del brazo largo -> no debe capturarse.
  const ov = edgeOverlapOnPerp(ele, 'x', 1899, 0, 12000);
  assert.equal(ov, 0, `no coincide con el borde real: ${ov}`);
});

test('muro a una perpendicular intermedia (y=1500) que no es borde -> solape 0', () => {
  const ov = edgeOverlapOnPerp(ele, 'x', 1500, 0, 14449);
  assert.equal(ov, 0);
});

test('tolerancia perpendicular: un muro 1mm desviado del borde igual solapa', () => {
  const ov = edgeOverlapOnPerp(ele, 'x', 1098, 0, 12800, 2);
  assert.ok(ov > 12000, `dentro de tolerancia: ${ov}`);
});
