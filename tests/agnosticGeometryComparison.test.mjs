import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AGNOSTIC_COMPARISON_MODES,
  agnosticPointToThree,
  prepareAgnosticGeometryComparison,
  visibleAgnosticComparisonLayers
} from '../src/core/agnosticGeometryComparison.js';
import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
}

function emptyModel(overrides = {}) {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    projectParams: [],
    roofSystems: [],
    roofPlanes: [],
    ...overrides
  };
}

function wallModel() {
  return emptyModel({
    grid: {
      xAxes: [{ id: 'X0', position: 0 }, { id: 'X1', position: 4000 }],
      yAxes: [{ id: 'Y0', position: 0 }],
      zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
    },
    elements: [{
      id: 'W1', type: 'wall', direction: 'x',
      xStart: 'X0', xEnd: 'X1', yStart: 'Y0', yEnd: 'Y0',
      bottomZ: 'Z0', topZ: 'Z1', thickness: 90,
      openings: [{
        id: 'O1', type: 'window', axisType: 'x', position: 1800,
        width: 1200, height: 1000, sillHeight: 800
      }]
    }]
  });
}

test('SPEC-006-E: prepara snapshots independientes, informe y capas sin mutar el modelo', () => {
  const model = wallModel();
  const before = structuredClone(model);
  const comparison = prepareAgnosticGeometryComparison(model);

  assert.deepEqual(model, before);
  assert.equal(comparison.source.schema, 'agnostic-geometry-v1.0');
  assert.equal(comparison.exported.schema, 'agnostic-geometry-v1.0');
  assert.notEqual(comparison.source, comparison.exported);
  assert.equal(comparison.report.schema, 'agnostic-geometry-audit/v1');
  assert.equal(comparison.report.status, 'pass');
  assert.deepEqual(comparison.failedEntityIds, []);
  assert.equal(comparison.firstDifference, null);
  assert.equal(comparison.layers.source.items[0].openings.length, 1);
  assert.equal(comparison.layers.exported.items[0].openings.length, 1);
});

test('SPEC-006-E: mínimo, casa-L, FX-003 y FX-004 pasan con cantidades idénticas', async () => {
  const cases = [
    [emptyModel(), { elements: 0, walls: 0, openings: 0, foundations: 0, roofs: 0 }],
    [await fixture('casa-L.json'), { walls: 45, openings: 43, foundations: 4, roofs: 2 }],
    [await fixture('fx-003-vivienda-independiente.json'), { walls: 6, openings: 6 }],
    [await fixture('fx-004-cubierta-moderna.json'), { walls: 4, roofs: 1 }]
  ];

  for (const [model, expectedCounts] of cases) {
    const comparison = prepareAgnosticGeometryComparison(model);
    assert.equal(comparison.report.status, 'pass');
    assert.deepEqual(comparison.report.summary.source, comparison.report.summary.exported);
    assert.equal(comparison.report.summary.maximumDeviationMm <= 0.001, true);
    assert.deepEqual(comparison.failedEntityIds, []);
    for (const [name, count] of Object.entries(expectedCounts)) {
      assert.equal(comparison.report.summary.source[name], count, name);
    }
  }
});

test('SPEC-006-E: posición, dimensión e ID alterados fallan con diferencia e IDs resaltables', () => {
  const model = wallModel();
  const mutations = [
    (geometry) => { geometry.elements[0].prism.start.x += 2; },
    (geometry) => { geometry.elements[0].prism.thickness += 2; },
    (geometry) => { geometry.elements[0].id = 'W-ALTERADO'; }
  ];

  for (const mutate of mutations) {
    const comparison = prepareAgnosticGeometryComparison(model, {
      projectGeometry(source) {
        const geometry = projectAgnosticGeometry(source);
        mutate(geometry);
        return geometry;
      }
    });
    assert.equal(comparison.report.status, 'fail');
    assert.ok(comparison.firstDifference);
    assert.ok(comparison.failedEntityIds.length > 0);
    assert.ok(comparison.layers.source.items.some(({ failed }) => failed)
      || comparison.layers.exported.items.some(({ failed }) => failed));
  }
});

test('SPEC-006-E: la frontera cartesiana y los bounds cubren sólidos, vanos y cubiertas', async () => {
  assert.deepEqual(agnosticPointToThree({ x: 11, y: 22, z: 33 }), { x: 11, y: 33, z: 22 });
  const comparison = prepareAgnosticGeometryComparison(await fixture('casa-L.json'));
  for (const point of [comparison.bounds.min, comparison.bounds.max, comparison.bounds.center]) {
    assert.ok(Object.values(point).every(Number.isFinite));
  }
  assert.ok(comparison.bounds.span > 0);
  const types = new Set(comparison.layers.source.items.map(({ type }) => type));
  assert.ok(types.has('wall'));
  assert.ok(types.has('foundation'));
  assert.ok(types.has('roof'));
  assert.ok(comparison.layers.source.items.some((item) => item.openings?.length > 0));
});

test('SPEC-006-E: los modos conservan coordenadas y estilos de las dos autoridades', () => {
  const comparison = prepareAgnosticGeometryComparison(wallModel());
  assert.deepEqual(
    visibleAgnosticComparisonLayers(comparison, AGNOSTIC_COMPARISON_MODES.SOURCE)
      .map(({ name }) => name),
    ['source']
  );
  assert.deepEqual(
    visibleAgnosticComparisonLayers(comparison, AGNOSTIC_COMPARISON_MODES.EXPORTED)
      .map(({ name }) => name),
    ['exported']
  );
  assert.deepEqual(
    visibleAgnosticComparisonLayers(comparison, AGNOSTIC_COMPARISON_MODES.OVERLAY)
      .map(({ name }) => name),
    ['source', 'exported']
  );
  assert.equal(comparison.layers.source.style.representation, 'solid');
  assert.ok(comparison.layers.source.style.opacity < 1);
  assert.equal(comparison.layers.exported.style.representation, 'outline');
  assert.deepEqual(
    comparison.layers.source.items[0].prism.center,
    comparison.layers.exported.items[0].prism.center
  );
  assert.throws(() => visibleAgnosticComparisonLayers(comparison, 'offset'), /desconocido/);
});

test('SPEC-006-E: el comparador no importa build3d ni reconoce fuentes constructivas', async () => {
  const source = await readFile(
    new URL('../src/core/agnosticGeometryComparison.js', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /build3d/);
  assert.doesNotMatch(source, /studs|metalcon|osb|truss|purlin|ledger/i);
  assert.deepEqual(
    prepareAgnosticGeometryComparison(wallModel()).legend.map(({ label }) => label),
    ['Fuente', 'Exportada', 'Diferencia']
  );
});
