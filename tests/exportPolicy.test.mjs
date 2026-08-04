import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORT_POLICIES,
  evaluateExportPolicy,
  formatExportBlockMessage,
  guardExport
} from '../src/core/exportPolicy.js';
import { downloadCalculix } from '../src/core/exportCalculix.js';
import { downloadCalculixTruss } from '../src/core/exportCalculixTruss.js';
import { downloadCalculixFoundation } from '../src/core/exportCalculixFoundation.js';
import { generateTakeoffCsv } from '../src/core/takeoff.js';

function model(stale = false) {
  return {
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [{
      id: 'w1',
      type: 'wall',
      studs: [{ offset: 0 }],
      headers: [],
      osbCourses: [{ panels: [] }],
      studsStale: stale,
      osbStale: stale
    }],
    roofSystems: [{
      id: 'r1',
      name: 'Cercha 1',
      trussGeometry: { resolved: true },
      stale
    }]
  };
}

test('el inventario cubre JSON, CSV, todos los DXF y las tres variantes INP', () => {
  assert.deepEqual(Object.keys(EXPORT_POLICIES).sort(), [
    'agnostic-geometry-audit-json',
    'agnostic-geometry-json',
    'calculix-foundation',
    'calculix-global',
    'calculix-truss',
    'dxf-foundation',
    'dxf-framing',
    'dxf-framing-sheets',
    'dxf-osb',
    'dxf-osb-sheets',
    'dxf-plan',
    'dxf-truss',
    'dxf-truss-sheets',
    'takeoff-csv'
  ]);
});

for (const [exporter, policy] of Object.entries(EXPORT_POLICIES)) {
  test(`${exporter}: política verificable para modelo vigente y stale`, () => {
    const current = evaluateExportPolicy(model(false), exporter);
    assert.equal(current.allowed, true);
    assert.equal(current.status, 'current');

    const stale = evaluateExportPolicy(model(true), exporter);
    if (policy.staleBehavior === 'block') {
      assert.equal(stale.allowed, false);
      assert.match(formatExportBlockMessage(stale), /Regenera/i);
    } else if (policy.staleBehavior === 'explicit') {
      assert.equal(stale.allowed, true);
      assert.equal(stale.status, 'stale');
      assert.equal(stale.requiresAnnotation, true);
    } else {
      assert.equal(stale.allowed, true);
      assert.equal(stale.status, 'current');
    }
  });
}

test('ningún INP global, de cercha o fundaciones se autoriza con derivados stale', () => {
  for (const exporter of ['calculix-global', 'calculix-truss', 'calculix-foundation']) {
    const result = evaluateExportPolicy(model(true), exporter);
    assert.equal(result.allowed, false, exporter);
    assert.equal(EXPORT_POLICIES[exporter].format, 'INP');
  }
});

test('las tres funciones de descarga INP abortan antes de tocar el DOM y muestran acción de regenerar', () => {
  const messages = [];
  const previousAlert = globalThis.alert;
  globalThis.alert = (message) => messages.push(message);
  try {
    const stale = model(true);
    assert.equal(downloadCalculix(stale), false);
    assert.equal(downloadCalculixTruss(stale), false);
    assert.equal(downloadCalculixFoundation(stale), false);
  } finally {
    globalThis.alert = previousAlert;
  }
  assert.equal(messages.length, 3);
  assert.ok(messages.every((message) => /Regenera/i.test(message)));
});

test('la guarda informa estado stale explícito en salidas informativas', () => {
  const messages = [];
  const result = guardExport(model(true), 'takeoff-csv', (message) => messages.push(message));
  assert.equal(result.allowed, true);
  assert.equal(result.requiresAnnotation, true);
  assert.match(messages[0], /DERIVADOS_DESACTUALIZADOS/);
  assert.match(generateTakeoffCsv(model(true)), /^Estado general de derivados,DERIVADOS_DESACTUALIZADOS/m);
  assert.match(generateTakeoffCsv(model(false)), /^Estado general de derivados,VIGENTE/m);
});
