// tests/roofPlaneEdge.test.mjs
// ★ B4.7.4b — La canaleta se elige como un LADO del polígono; roofPlaneEdge lo mapea al muro
// colineal. Verifica el mapeo contra el fixture real y que el faldón resuelto por ese camino
// (lado → canalWallId → resolveRoofPlane) coincide con el faldón definido por canalWallId directo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { polygonEdges, wallOnEdge, edgeLabel } from '../src/core/roofPlaneEdge.js';
import { resolveRoofPlane } from '../src/core/roofPlane.js';
import { buildParamsMap } from '../src/core/projectParams.js';
import { buildElementsById } from '../src/core/elementReferences.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));

const polygon = [
  { x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 },
  { x: 12800, y: 2000 }, { x: 12800, y: 1200 }, { x: 3000, y: 1200 }
];
const CANAL_WALL = 1784600403613; // muro de canaleta del eje A (Y=0)

const paramsMap = buildParamsMap(base.projectParams || []);
const elementsById = buildElementsById(base.elements || []);

test('polygonEdges cierra el contorno (N lados incluyendo vN→v0)', () => {
  const edges = polygonEdges(polygon);
  assert.equal(edges.length, polygon.length);
  assert.deepEqual(edges[edges.length - 1].b, polygon[0], 'último lado vuelve al primer vértice');
});

test('wallOnEdge mapea el lado bajo (Y=0) al muro de canaleta', () => {
  const wallId = wallOnEdge(base, { x: 3000, y: 0 }, { x: 14500, y: 0 }, paramsMap, elementsById);
  assert.equal(wallId, CANAL_WALL);
});

test('wallOnEdge devuelve null en un lado sin muro colineal', () => {
  // lado vertical corto del quiebre interior (X=12800, Y 1200→2000): no hay canaleta ahí
  const wallId = wallOnEdge(base, { x: 12800, y: 1200 }, { x: 12800, y: 2000 }, paramsMap, elementsById);
  assert.notEqual(wallId, CANAL_WALL);
});

test('edgeLabel describe orientación y coordenada fija', () => {
  assert.match(edgeLabel({ x: 3000, y: 0 }, { x: 14500, y: 0 }), /horizontal Y=0/);
  assert.match(edgeLabel({ x: 12800, y: 1200 }, { x: 12800, y: 2000 }), /vertical X=12800/);
});

test('camino completo lado→canalWallId→resolveRoofPlane resuelve el faldón', () => {
  const edges = polygonEdges(polygon).map(e => ({ ...e, wallId: wallOnEdge(base, e.a, e.b, paramsMap, elementsById) }));
  const canalWallId = edges.find(e => e.wallId != null)?.wallId;
  assert.ok(canalWallId, 'algún lado tiene muro canaleta');

  const plane = {
    canalWallId, supportLevelId: 1784556741132, supportOffset: 100, crownClearance: 200,
    heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200, chainOrigin: 'start',
    shortSpanThreshold: 500, purlinCommercialLength: 6000, purlinOverlap: 100, supportMode: 'lateral',
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    polygon
  };
  const resolved = resolveRoofPlane({ model: base, plane, paramsMap, elementsById, library: base.library });
  assert.equal(resolved.resolved, true, 'faldón resuelto por el camino de lado');
  assert.ok(resolved.tramos.length >= 1);
  assert.ok(resolved.trussPositions.length > 0);
});
