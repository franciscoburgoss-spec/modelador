// tests/roofPlaneAdapter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from '../src/core/roofPlane.js';
import { roofPlaneToSystems, expandRoofPlanes } from '../src/core/roofPlaneAdapter.js';
import { buildParamsMap } from '../src/core/projectParams.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, '../lab/roofPlane/fixtures/modelo-26.json'), 'utf8'));
const paramsMap = buildParamsMap(model.projectParams || []);
const CG = 1784556741132;

const planeEjeA = {
  id: 'ejeA', canalWallId: 1784600403613, supportLevelId: CG, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 3000, y: 0 }, { x: 14500, y: 0 }, { x: 14500, y: 2000 }, { x: 12800, y: 2000 }, { x: 12800, y: 1200 }, { x: 3000, y: 1200 }]
};

test('adaptador expande el faldón L en 2 sistemas (uno por luz)', () => {
  const resolved = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMap);
  assert.equal(systems.length, 2);
  const luces = systems.map(s => Math.round(s.span)).sort((a, b) => a - b);
  assert.deepEqual(luces, [1099, 1899]);
});

test('cada sistema tiene el shape legacy que consume build3d', () => {
  const resolved = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMap);
  for (const s of systems) {
    assert.ok(s.trussGeometry?.resolved, 'trussGeometry resuelta');
    assert.ok(Array.isArray(s.trussGeometry.members) && s.trussGeometry.members.length > 0, 'tiene members');
    assert.ok(Array.isArray(s.trussPositions) && s.trussPositions.length > 0, 'tiene positions');
    assert.ok(s.trussPositions.every(p => p.world), 'positions con world');
    assert.equal(typeof s.supportElevation, 'number');
    assert.ok(['x', 'y'].includes(s.runAxis));
  }
});

test('la pendiente es única en ambos sistemas (misma slopePercent)', () => {
  const resolved = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMap);
  const slopes = new Set(systems.map(s => s.slopePercent.toFixed(4)));
  assert.equal(slopes.size, 1, 'una sola pendiente en todo el faldón');
});

test('las posiciones de la cadena se reparten entre los tramos sin perderse', () => {
  const resolved = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const { systems } = roofPlaneToSystems(planeEjeA, resolved, paramsMap);
  const totalPos = systems.reduce((n, s) => n + s.trussPositions.length, 0);
  // el borde compartido (x=12800) puede contarse en ambos tramos; la cadena tiene 11 posiciones
  assert.ok(totalPos >= resolved.trussPositions.length, 'no se pierden posiciones');
});

test('costaneras se devuelven a nivel de faldón, no por tramo', () => {
  const resolved = resolveRoofPlane({ model, plane: planeEjeA, paramsMap });
  const { systems, purlinLines } = roofPlaneToSystems(planeEjeA, resolved, paramsMap);
  // ningún sistema trae costaneras propias (evita corte en el quiebre)
  for (const s of systems) assert.equal((s.trussGeometry.purlins || []).length, 0);
  // las costaneras del faldón sí existen
  assert.ok(purlinLines.length > 0);
});

test('expandRoofPlanes procesa un modelo con roofPlanes[]', () => {
  const m2 = { ...model, roofPlanes: [planeEjeA] };
  const resolveFn = (plane) => resolveRoofPlane({ model: m2, plane, paramsMap });
  const { systems, purlinsByPlane } = expandRoofPlanes(m2, resolveFn, paramsMap);
  assert.equal(systems.length, 2);
  assert.equal(purlinsByPlane.length, 1);
  assert.equal(purlinsByPlane[0].planeId, 'ejeA');
});

// ★ B4.7.6 — fusión de tramos colineales redundantes
import { mergeCollinearTramos } from '../src/core/roofPlaneAdapter.js';

const planeF3 = {
  id: 'F3', canalWallId: 1784605101040, supportLevelId: CG, supportOffset: 100,
  crownClearance: 200, heelHeight: 300, gutterNotchWidth: 200, trussSpacing: 1200,
  chainOrigin: 'start', shortSpanThreshold: 500, purlinSpacing: 800, purlinProfileH: 35,
  profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
  polygon: [{ x: 12800, y: 2000 }, { x: 23200, y: 2000 }, { x: 23200, y: 8300 },
    { x: 19000, y: 8300 }, { x: 19000, y: 6600 }, { x: 12800, y: 6600 }]
};

test('mergeCollinearTramos: <2 tramos devuelve tal cual', () => {
  assert.deepEqual(mergeCollinearTramos([]).merged, []);
  assert.deepEqual(mergeCollinearTramos(undefined).merged, []);
  const uno = [{ wallHighId: 1, runFrom: 0, runTo: 100, span: 500 }];
  assert.deepEqual(mergeCollinearTramos(uno).merged, uno);
});

test('mergeCollinearTramos: fusiona rangos idénticos con misma luz, une wallHighIds', () => {
  const tramos = [
    { wallHighId: 10, runFrom: 19000, runTo: 23149, span: 6199 },
    { wallHighId: 11, runFrom: 19000, runTo: 23149, span: 6199 },
    { wallHighId: 12, runFrom: 19000, runTo: 23149, span: 6199 }
  ];
  const { merged, warnings } = mergeCollinearTramos(tramos);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].wallHighIds, [10, 11, 12]);
  assert.equal(merged[0].runFrom, 19000);
  assert.equal(merged[0].runTo, 23149);
  assert.equal(warnings.length, 1);
});

test('mergeCollinearTramos: NO fusiona luces distintas', () => {
  const tramos = [
    { wallHighId: 1, runFrom: 0, runTo: 5000, span: 4499 },
    { wallHighId: 2, runFrom: 5000, runTo: 9000, span: 6199 }
  ];
  const { merged } = mergeCollinearTramos(tramos);
  assert.equal(merged.length, 2);
});

test('mergeCollinearTramos: fusiona fragmentos contiguos (hueco ≤ GAP_TOL) y une el rango', () => {
  const tramos = [
    { wallHighId: 1, runFrom: 0, runTo: 3000, span: 6199 },
    { wallHighId: 2, runFrom: 3040, runTo: 6000, span: 6199 }
  ];
  const { merged } = mergeCollinearTramos(tramos);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].runFrom, 0);
  assert.equal(merged[0].runTo, 6000);
});

test('mergeCollinearTramos: NO fusiona si el hueco supera GAP_TOL', () => {
  const tramos = [
    { wallHighId: 1, runFrom: 0, runTo: 3000, span: 6199 },
    { wallHighId: 2, runFrom: 3200, runTo: 6000, span: 6199 }
  ];
  assert.equal(mergeCollinearTramos(tramos).merged.length, 2);
});

test('mergeCollinearTramos: conserva el hiddenBy más restrictivo del grupo', () => {
  const tramos = [
    { wallHighId: 1, runFrom: 0, runTo: 5000, span: 6199, hiddenBy: 120 },
    { wallHighId: 2, runFrom: 0, runTo: 5000, span: 6199, hiddenBy: -30 }
  ];
  assert.equal(mergeCollinearTramos(tramos).merged[0].hiddenBy, -30);
});

test('F3 real: 4 tramos → 2 sistemas, sin cerchas duplicadas', () => {
  const resolved = resolveRoofPlane({ model, plane: planeF3, paramsMap });
  assert.equal(resolved.tramos.length, 4, 'el faldón produce 4 tramos crudos');
  const { systems, warnings } = roofPlaneToSystems(planeF3, resolved, paramsMap);
  assert.equal(systems.length, 2, 'fusionado a 2 sistemas');
  const s6199 = systems.find(s => Math.round(s.span) === 6199);
  assert.equal(s6199.wallHighIds.length, 3, 'el sistema fusionado lista los 3 muros altos');
  assert.ok(warnings.some(w => /fusionados 3 tramos/.test(w)));
});
