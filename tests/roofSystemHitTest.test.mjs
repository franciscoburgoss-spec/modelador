// tests/roofSystemHitTest.test.mjs — selección de sistemas de techumbre en planta (sesión 7)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRoofSystemAtPoint } from '../src/core/hitTest.js';
import { computeRoofPlanSegments } from '../src/core/roofSegments.js';

// Sistema mínimo: cerchas en x = 0, 1200, 2400 (runAxis 'x'), luz 4000 hacia +y desde y = 0.
function makeModel(id = 77) {
  return {
    roofSystems: [{
      id,
      runAxis: 'x',
      spanDir: 1,
      span: 4000,
      trussGeometry: { resolved: true },
      trussPositions: [0, 1200, 2400].map(x => ({ offset: x, world: { x, y: 0 } }))
    }]
  };
}

test('computeRoofPlanSegments: un segmento por cercha, etiquetado con systemId', () => {
  const segs = computeRoofPlanSegments(makeModel(77));
  assert.equal(segs.length, 3);
  assert.ok(segs.every(s => s.systemId === 77));
  assert.deepEqual(
    { h1: segs[0].h1, v1: segs[0].v1, h2: segs[0].h2, v2: segs[0].v2 },
    { h1: 0, v1: 0, h2: 0, v2: 4000 }
  );
});

test('findRoofSystemAtPoint: dentro de tolerancia sobre una línea de cercha → id del sistema', () => {
  const model = makeModel(77);
  assert.equal(findRoofSystemAtPoint(model, { x: 1200, y: 2000 }, 100), 77); // sobre la línea
  assert.equal(findRoofSystemAtPoint(model, { x: 1250, y: 2000 }, 100), 77); // 50mm < tol
});

test('findRoofSystemAtPoint: fuera de tolerancia o fuera del largo → null', () => {
  const model = makeModel(77);
  assert.equal(findRoofSystemAtPoint(model, { x: 600, y: 2000 }, 100), null);   // entre cerchas
  assert.equal(findRoofSystemAtPoint(model, { x: 1200, y: 5000 }, 100), null);  // pasado el extremo
  assert.equal(findRoofSystemAtPoint(model, null, 100), null);
});

test('findRoofSystemAtPoint: sistemas sin geometría resuelta no son seleccionables', () => {
  const model = makeModel(77);
  model.roofSystems[0].trussGeometry = { resolved: false };
  assert.equal(findRoofSystemAtPoint(model, { x: 1200, y: 2000 }, 100), null);
  assert.equal(findRoofSystemAtPoint({}, { x: 0, y: 0 }, 100), null);
});
