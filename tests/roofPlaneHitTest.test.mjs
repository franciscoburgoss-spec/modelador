// tests/roofPlaneHitTest.test.mjs
// ★ B4.7.4c — Selección del faldón desde el lienzo: findRoofPlaneAtPoint resuelve qué faldón
// (model.roofPlanes) cae bajo un punto de mundo (interior del polígono o cerca de una arista).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon } from '../src/core/geometry.js';
import { findRoofPlaneAtPoint } from '../src/core/hitTest.js';

const square = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

test('pointInPolygon: interior sí, exterior no', () => {
  assert.equal(pointInPolygon(500, 500, square), true);
  assert.equal(pointInPolygon(1500, 500, square), false);
  assert.equal(pointInPolygon(-10, -10, square), false);
});

test('pointInPolygon: polígono degenerado (<3 vértices) es falso', () => {
  assert.equal(pointInPolygon(0, 0, [{ x: 0, y: 0 }, { x: 1, y: 1 }]), false);
});

test('findRoofPlaneAtPoint: interior del contorno selecciona el faldón', () => {
  const model = { roofPlanes: [{ id: 'A', polygon: square }] };
  assert.equal(findRoofPlaneAtPoint(model, { x: 500, y: 500 }), 'A');
});

test('findRoofPlaneAtPoint: fuera del contorno y sin arista cercana → null', () => {
  const model = { roofPlanes: [{ id: 'A', polygon: square }] };
  assert.equal(findRoofPlaneAtPoint(model, { x: 5000, y: 5000 }, 100), null);
});

test('findRoofPlaneAtPoint: clic justo sobre la arista (dentro de tolerancia) selecciona', () => {
  const model = { roofPlanes: [{ id: 'A', polygon: square }] };
  // punto a 50mm fuera del borde inferior, tol=100 → cae por arista
  assert.equal(findRoofPlaneAtPoint(model, { x: 500, y: -50 }, 100), 'A');
});

test('findRoofPlaneAtPoint: solape → gana el último dibujado (encima)', () => {
  const model = {
    roofPlanes: [
      { id: 'bajo', polygon: square },
      { id: 'encima', polygon: [{ x: 400, y: 400 }, { x: 600, y: 400 }, { x: 600, y: 600 }, { x: 400, y: 600 }] }
    ]
  };
  assert.equal(findRoofPlaneAtPoint(model, { x: 500, y: 500 }), 'encima');
});

test('findRoofPlaneAtPoint: sin faldones o punto nulo → null', () => {
  assert.equal(findRoofPlaneAtPoint({ roofPlanes: [] }, { x: 0, y: 0 }), null);
  assert.equal(findRoofPlaneAtPoint({ roofPlanes: [{ id: 'A', polygon: square }] }, null), null);
});
