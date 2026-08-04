import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AGNOSTIC_GEOMETRY_AUDIT_SCHEMA,
  AGNOSTIC_GEOMETRY_AUDIT_FILENAME,
  AGNOSTIC_GEOMETRY_AUDIT_MIME,
  AgnosticGeometryAuditError,
  DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM,
  auditAgnosticGeometry,
  serializeAgnosticGeometryAudit
} from '../src/core/agnosticGeometryAudit.js';
import {
  downloadAgnosticGeometry,
  downloadAgnosticGeometryAudit,
  projectAgnosticGeometry
} from '../src/core/agnosticGeometry.js';

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

function geometryModel() {
  return emptyModel({
    grid: {
      xAxes: [{ id: 'X0', position: 0 }, { id: 'X1', position: 4000 }],
      yAxes: [{ id: 'Y0', position: 0 }, { id: 'Y1', position: 3000 }],
      zLevels: [
        { id: 'ZF', elevation: -1000 },
        { id: 'Z0', elevation: 0 },
        { id: 'Z1', elevation: 2400 }
      ]
    },
    projectParams: [
      { id: 'P-T', name: 'ESPESOR', value: 90 },
      { id: 'P-H', name: 'ALTO', value: 1200 }
    ],
    elements: [
      {
        id: 'W1', type: 'wall', direction: 'x',
        xStart: 'X0', xEnd: 'X1', yStart: 'Y0', yEnd: 'Y0',
        bottomZ: 'Z0', topZ: 'Z1', thickness: '=ESPESOR',
        openings: [{
          id: 'O1', type: 'window', axisType: 'x', position: 1000,
          width: 1200, height: '=ALTO', sillHeight: 800
        }]
      },
      {
        id: 'C1', type: 'column', axisXId: 'X1', axisYId: 'Y1',
        offsetX: -100, offsetY: 50, bottomZ: 'Z0', topZ: 'Z1',
        widthX: 200, widthY: 300
      },
      {
        id: 'B1', type: 'beam', direction: 'y', fixedAxisId: 'X1',
        startAxisId: 'Y0', endAxisId: 'Y1', levelZ: 'Z1', width: 200, height: 400
      },
      {
        id: 'F1', type: 'foundation', foundationType: 'corrida', direction: 'x',
        fixedAxisId: 'Y0', startAxisId: 'X0', endAxisId: 'X1', levelZ: 'Z0',
        topOffset: 0,
        sobrecimiento: { width: 200, height: 400 },
        cimiento: { width: 500, depth: 600 },
        emplantillado: { thickness: 50, overhang: 100 }
      }
    ]
  });
}

function heterogeneousCrownModel() {
  return emptyModel({
    grid: {
      xAxes: [
        { id: 'X0', position: 0 },
        { id: 'XM', position: 2000 },
        { id: 'X1', position: 4000 }
      ],
      yAxes: [{ id: 'YC', position: 0 }, { id: 'YR', position: 3000 }],
      zLevels: [
        { id: 'Z0', elevation: 0 },
        { id: 'ZC', elevation: 2400 },
        { id: 'ZL', elevation: 3000 },
        { id: 'ZH', elevation: 3300 }
      ]
    },
    elements: [
      {
        id: 'WC', type: 'wall', direction: 'x', xStart: 'X0', xEnd: 'X1',
        yStart: 'YC', yEnd: 'YC', bottomZ: 'Z0', topZ: 'ZC', thickness: 90, openings: []
      },
      {
        id: 'WL', type: 'wall', direction: 'x', xStart: 'X0', xEnd: 'XM',
        yStart: 'YR', yEnd: 'YR', bottomZ: 'Z0', topZ: 'ZL', thickness: 90, openings: []
      },
      {
        id: 'WH', type: 'wall', direction: 'x', xStart: 'XM', xEnd: 'X1',
        yStart: 'YR', yEnd: 'YR', bottomZ: 'Z0', topZ: 'ZH', thickness: 90, openings: []
      }
    ],
    roofPlanes: [{
      id: 'RP1', canalWallId: 'WC', supportLevelId: 'ZC', supportOffset: 0,
      heelHeight: 100, crownClearance: 100,
      polygon: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }]
    }]
  });
}

function findFailure(report, id, pathFragment) {
  return report.checks.find((check) => (
    check.status === 'fail'
    && check.id === id
    && check.path.includes(pathFragment)
  ));
}

test('SPEC-006-D: el informe vacío exacto declara contrato, tolerancia y resumen finito', () => {
  const source = emptyModel();
  const report = auditAgnosticGeometry(source, projectAgnosticGeometry(source));

  assert.equal(report.schema, AGNOSTIC_GEOMETRY_AUDIT_SCHEMA);
  assert.equal(report.schema, 'agnostic-geometry-audit/v1');
  assert.equal(report.status, 'pass');
  assert.equal(report.toleranceMm, DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM);
  assert.equal(report.toleranceMm, 0.001);
  assert.deepEqual(report.summary.source, {
    xAxes: 0, yAxes: 0, zLevels: 0, elements: 0, walls: 0, openings: 0,
    columns: 0, beams: 0, foundations: 0, foundationLayers: 0, roofs: 0
  });
  assert.deepEqual(report.summary.exported, report.summary.source);
  assert.equal(report.summary.failedChecks, 0);
  assert.equal(report.summary.passedChecks, report.summary.checks);
  assert.equal(report.summary.maximumDeviationMm, 0);
  assert.ok(Number.isFinite(report.summary.maximumDeviationMm));
  assert.equal(`${JSON.stringify(report, null, 2)}\n`, serializeAgnosticGeometryAudit(report));
});

test('SPEC-006-D: cada familia pasa y una alteración numérica informa ID, ruta y desviación', () => {
  const source = geometryModel();
  const projected = projectAgnosticGeometry(source);
  const baseline = auditAgnosticGeometry(source, projected);
  assert.equal(baseline.status, 'pass');
  assert.deepEqual(baseline.summary.source, {
    xAxes: 2, yAxes: 2, zLevels: 3, elements: 4, walls: 1, openings: 1,
    columns: 1, beams: 1, foundations: 1, foundationLayers: 3, roofs: 0
  });

  const mutations = [
    ['W1', 'prism.start.x', (value) => { value.elements.find((e) => e.id === 'W1').prism.start.x += 2; }],
    ['W1', 'prism.end.x', (value) => { value.elements.find((e) => e.id === 'W1').prism.end.x += 2; }],
    ['W1', 'prism.thickness', (value) => { value.elements.find((e) => e.id === 'W1').prism.thickness += 2; }],
    ['W1', 'prism.height', (value) => { value.elements.find((e) => e.id === 'W1').prism.height += 2; }],
    ['O1', 'void.start.x', (value) => { value.elements.find((e) => e.id === 'W1').openings[0].void.start.x += 2; }],
    ['C1', 'prism.min.x', (value) => { value.elements.find((e) => e.id === 'C1').prism.min.x += 2; }],
    ['B1', 'prism.end.y', (value) => { value.elements.find((e) => e.id === 'B1').prism.end.y += 2; }],
    ['F1', 'solids', (value) => { value.elements.find((e) => e.id === 'F1').solids[0].prism.min.z += 2; }]
  ];
  for (const [id, path, mutate] of mutations) {
    const altered = structuredClone(projected);
    mutate(altered);
    const report = auditAgnosticGeometry(source, altered);
    const failure = findFailure(report, id, path);
    assert.equal(report.status, 'fail', path);
    assert.ok(failure, path);
    assert.equal(failure.deviationMm, 2);
    assert.equal(typeof failure.expected, 'number');
    assert.equal(typeof failure.observed, 'number');
  }

  const roofSource = heterogeneousCrownModel();
  const roofPayload = projectAgnosticGeometry(roofSource);
  roofPayload.roofGeometry[0].surface.boundary[0].z += 2;
  const roofReport = auditAgnosticGeometry(roofSource, roofPayload);
  assert.ok(findFailure(roofReport, 'RP1', 'surface.boundary'));
});

test('SPEC-006-D: biyección detecta omisiones, duplicados y extras de todas las autoridades', () => {
  const source = geometryModel();
  const projected = projectAgnosticGeometry(source);
  const cases = [
    (value) => { value.grid.xAxes.pop(); },
    (value) => { value.grid.zLevels.push(structuredClone(value.grid.zLevels[0])); },
    (value) => { value.elements.push({ id: 'EXTRA', type: 'wall', prism: {}, openings: [] }); },
    (value) => { value.elements.find((e) => e.id === 'W1').openings = []; },
    (value) => { value.elements.find((e) => e.id === 'F1').solids.push(structuredClone(value.elements.find((e) => e.id === 'F1').solids[0])); }
  ];
  for (const mutate of cases) {
    const altered = structuredClone(projected);
    mutate(altered);
    const report = auditAgnosticGeometry(source, altered);
    assert.equal(report.status, 'fail');
    assert.ok(report.checks.some((check) => check.code === 'ID_BIJECTION' && check.status === 'fail'));
  }

  const unexpected = projectAgnosticGeometry(emptyModel());
  unexpected.grid.extra = true;
  assert.equal(auditAgnosticGeometry(emptyModel(), unexpected).status, 'fail');
  const invalidCollections = projectAgnosticGeometry(emptyModel());
  invalidCollections.elements = null;
  assert.equal(auditAgnosticGeometry(emptyModel(), invalidCollections).status, 'fail');
});

test('SPEC-006-D: tolerancia inclusiva, no finitos y tolerancias inválidas', () => {
  const source = geometryModel();
  const within = projectAgnosticGeometry(source);
  within.elements.find((e) => e.id === 'W1').prism.thickness += 0.001;
  assert.equal(auditAgnosticGeometry(source, within).status, 'pass');

  const outside = projectAgnosticGeometry(source);
  outside.elements.find((e) => e.id === 'W1').prism.thickness += 0.0010001;
  assert.equal(auditAgnosticGeometry(source, outside).status, 'fail');

  for (const value of [NaN, Infinity, -Infinity]) {
    const invalid = projectAgnosticGeometry(source);
    invalid.elements.find((e) => e.id === 'W1').prism.thickness = value;
    const report = auditAgnosticGeometry(source, invalid);
    assert.equal(report.status, 'fail');
    assert.equal(findFailure(report, 'W1', 'prism.thickness').code, 'NON_FINITE_NUMBER');
  }
  for (const tolerance of [-1, NaN, Infinity]) {
    assert.throws(() => auditAgnosticGeometry(source, projectAgnosticGeometry(source), { toleranceMm: tolerance }), /tolerancia/i);
  }
});

test('SPEC-006-D: casa-L, FX-003, FX-004 y coronaciones heterogéneas pasan', async () => {
  const cases = [
    [await fixture('casa-L.json'), { walls: 45, openings: 43, foundations: 4, roofs: 2 }],
    [await fixture('fx-003-vivienda-independiente.json'), { walls: 6, openings: 6 }],
    [await fixture('fx-004-cubierta-moderna.json'), { walls: 4, roofs: 1 }],
    [heterogeneousCrownModel(), { walls: 3, roofs: 1 }]
  ];
  for (const [source, counts] of cases) {
    const report = auditAgnosticGeometry(source, projectAgnosticGeometry(source));
    assert.equal(report.status, 'pass');
    for (const [key, count] of Object.entries(counts)) assert.equal(report.summary.source[key], count);
  }
});

test('SPEC-006-D: permutaciones equivalentes serializan igual y el auditor es independiente', async () => {
  const source = geometryModel();
  const payload = projectAgnosticGeometry(source);
  const permutedSource = structuredClone(source);
  permutedSource.grid.xAxes.reverse();
  permutedSource.grid.yAxes.reverse();
  permutedSource.grid.zLevels.reverse();
  permutedSource.elements.reverse();
  const permutedPayload = structuredClone(payload);
  permutedPayload.grid.xAxes.reverse();
  permutedPayload.grid.yAxes.reverse();
  permutedPayload.grid.zLevels.reverse();
  permutedPayload.elements.reverse();
  permutedPayload.elements.find((e) => e.id === 'W1').openings.reverse();
  permutedPayload.elements.find((e) => e.id === 'F1').solids.reverse();

  const first = serializeAgnosticGeometryAudit(auditAgnosticGeometry(source, payload));
  const second = serializeAgnosticGeometryAudit(auditAgnosticGeometry(permutedSource, permutedPayload));
  assert.equal(second, first);

  const auditSource = await readFile(new URL('../src/core/agnosticGeometryAudit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(auditSource, /from ['"]\.\/agnosticGeometry\.js['"]/);
  assert.doesNotMatch(auditSource, /projectAgnosticGeometry\s*\(/);
  assert.doesNotMatch(auditSource, /serializeAgnosticGeometry\s*\(/);
});

test('SPEC-006-D: la geometría bloquea pre-DOM y el informe usa descarga separada', async () => {
  const source = geometryModel();
  const events = [];
  const environment = {
    projectGeometry(model) {
      const geometry = projectAgnosticGeometry(model);
      geometry.elements.find(({ id }) => id === 'W1').prism.thickness += 2;
      return geometry;
    },
    Blob: class { constructor() { events.push('blob'); } },
    document: { createElement() { events.push('element'); } },
    URL: {
      createObjectURL() { events.push('url'); },
      revokeObjectURL() { events.push('revoke'); }
    }
  };
  assert.throws(
    () => downloadAgnosticGeometry(source, environment),
    (error) => error instanceof AgnosticGeometryAuditError
      && error.code === 'AGNOSTIC_GEOMETRY_AUDIT_FAILED'
      && error.path.includes('prism.thickness')
      && error.ids.includes('W1')
  );
  assert.deepEqual(events, []);

  let blob = null;
  let anchor = null;
  let revoked = null;
  const report = downloadAgnosticGeometryAudit(source, {
    Blob,
    document: {
      createElement() {
        anchor = { click() {} };
        return anchor;
      }
    },
    URL: {
      createObjectURL(value) { blob = value; return 'blob:audit'; },
      revokeObjectURL(value) { revoked = value; }
    }
  });
  assert.equal(report.status, 'pass');
  assert.equal(anchor.download, AGNOSTIC_GEOMETRY_AUDIT_FILENAME);
  assert.equal(anchor.download, 'auditoria-geometria-agnostica.json');
  assert.equal(anchor.href, 'blob:audit');
  assert.equal(blob.type, AGNOSTIC_GEOMETRY_AUDIT_MIME);
  assert.equal(blob.type, 'application/json;charset=utf-8');
  assert.equal(revoked, 'blob:audit');
  assert.deepEqual(JSON.parse(await blob.text()), report);
});
