// tests/roofZones.test.mjs — sesión 23: zonas de techumbre (system.runRange)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoofSystemLayout, validateRoofSystems } from '../src/core/trussLayout.js';

const near = (a, b, tol = 0.5) => Math.abs(a - b) < tol;

// Dos muros xRun paralelos de 0→6000 en X, separados 4090 en Y, espesor 90 → luz 4000.
const zoneFixture = () => {
  const grid = {
    xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 6000 }],
    yAxes: [{ id: 'Y1', position: 0 }, { id: 'Y2', position: 4090 }],
    zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
  };
  const elements = [
    { id: 1, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 },
    { id: 2, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y2', yEnd: 'Y2', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 }
  ];
  const base = { wallLowId: 1, wallHighId: 2, slopePercent: 20, heelHeight: 100, trussSpacing: 1200, postSpacing: 600 };
  return { grid, elements, base };
};

const persist = (id, base, layout) => ({
  id, ...base,
  span: layout.span, supportElevation: layout.supportElevation, runAxis: layout.runAxis,
  spanDir: layout.spanDir, trussPositions: layout.trussPositions, trussGeometry: layout.trussGeometry
});

test('zonas/23: sin runRange el sistema es idéntico al comportamiento previo (migración)', () => {
  const { grid, elements, base } = zoneFixture();
  const sinCampo = computeRoofSystemLayout(base, grid, {}, {}, elements);
  const conNull = computeRoofSystemLayout({ ...base, runRange: null }, grid, {}, {}, elements);
  const conVacio = computeRoofSystemLayout({ ...base, runRange: { from: null, to: null } }, grid, {}, {}, elements);

  assert.ok(sinCampo.resolved);
  assert.deepEqual(sinCampo.overlapRange, { from: 0, to: 6000 });
  assert.deepEqual(sinCampo.runRange, { from: 0, to: 6000 });
  assert.equal(sinCampo.zoned, false);
  assert.deepEqual(conNull.trussPositions, sinCampo.trussPositions);
  assert.deepEqual(conVacio.trussPositions, sinCampo.trussPositions);
});

test('zonas/23: runRange acota las cerchas al tramo pedido', () => {
  const { grid, elements, base } = zoneFixture();
  const layout = computeRoofSystemLayout({ ...base, runRange: { from: 1000, to: 3400 } }, grid, {}, {}, elements);
  assert.ok(layout.resolved);
  assert.deepEqual(layout.runRange, { from: 1000, to: 3400 });
  assert.deepEqual(layout.overlapRange, { from: 0, to: 6000 });
  assert.equal(layout.zoned, true);
  // 2400mm @1200 → 2 intervalos → 3 cerchas, primera y última en los bordes
  assert.equal(layout.trussPositions.length, 3);
  assert.ok(near(layout.trussPositions[0].offset, 1000));
  assert.ok(near(layout.trussPositions.at(-1).offset, 3400));
  assert.ok(near(layout.span, 4000), 'la luz no cambia: la zona solo acorta la corrida');
});

test('zonas/23: un solo extremo definido usa el borde del solape en el otro', () => {
  const { grid, elements, base } = zoneFixture();
  const soloDesde = computeRoofSystemLayout({ ...base, runRange: { from: 2400, to: null } }, grid, {}, {}, elements);
  assert.deepEqual(soloDesde.runRange, { from: 2400, to: 6000 });
  const soloHasta = computeRoofSystemLayout({ ...base, runRange: { from: null, to: 2400 } }, grid, {}, {}, elements);
  assert.deepEqual(soloHasta.runRange, { from: 0, to: 2400 });
});

test('zonas/23: rango invertido se normaliza y rango fuera del solape se recorta con aviso', () => {
  const { grid, elements, base } = zoneFixture();
  const invertido = computeRoofSystemLayout({ ...base, runRange: { from: 3600, to: 1200 } }, grid, {}, {}, elements);
  assert.deepEqual(invertido.runRange, { from: 1200, to: 3600 });

  const desbordado = computeRoofSystemLayout({ ...base, runRange: { from: -500, to: 9000 } }, grid, {}, {}, elements);
  assert.ok(desbordado.resolved);
  assert.deepEqual(desbordado.runRange, { from: 0, to: 6000 });
  assert.ok(desbordado.warnings.some(w => w.includes('se recortó al solape')));
});

test('zonas/23: rango sin intersección con el solape no resuelve', () => {
  const { grid, elements, base } = zoneFixture();
  const layout = computeRoofSystemLayout({ ...base, runRange: { from: 8000, to: 9000 } }, grid, {}, {}, elements);
  assert.equal(layout.resolved, false);
  assert.ok(layout.warnings.some(w => w.includes('no intersecta el solape')));
  assert.deepEqual(layout.overlapRange, { from: 0, to: 6000 });
});

test('zonas/23: runRange admite fórmula de parámetro de proyecto', () => {
  const { grid, elements, base } = zoneFixture();
  const paramsMap = { LARGO_ZONA: 2400 };
  const layout = computeRoofSystemLayout(
    { ...base, runRange: { from: 0, to: '=LARGO_ZONA' } }, grid, paramsMap, {}, elements
  );
  assert.ok(layout.resolved);
  assert.deepEqual(layout.runRange, { from: 0, to: 2400 });
});

test('zonas/23: solera lateral se acorta a la zona, no al solape completo', () => {
  const { grid, elements, base } = zoneFixture();
  const layout = computeRoofSystemLayout(
    { ...base, supportMode: 'lateral', runRange: { from: 1000, to: 3400 }, profiles: { bottomChord: '90CA085' } },
    grid, {}, {}, elements
  );
  assert.equal(layout.supportLedgers.length, 2);
  for (const led of layout.supportLedgers) {
    assert.ok(near(led.length, 2400));
    assert.ok(near(led.p1.x, 1000) && near(led.p2.x, 3400));
  }
});

test('zonas/23: dos zonas disjuntas sobre los mismos muros no dan huella superpuesta', () => {
  const { grid, elements, base } = zoneFixture();
  const a = computeRoofSystemLayout({ ...base, runRange: { from: 0, to: 2400 } }, grid, {}, {}, elements);
  const b = computeRoofSystemLayout({ ...base, runRange: { from: 3600, to: 6000 } }, grid, {}, {}, elements);
  const model = { grid, elements, roofSystems: [persist(1, base, a), persist(2, base, b)] };
  const findings = validateRoofSystems(model);
  assert.equal(findings.filter(f => f.category === 'overlap').length, 0);
  assert.equal(findings.filter(f => f.category === 'duplicateEdgeTruss').length, 0);

  // control: sin zonas, los mismos dos sistemas sí se superponen
  const full = computeRoofSystemLayout(base, grid, {}, {}, elements);
  const solapados = validateRoofSystems({ grid, elements, roofSystems: [persist(1, base, full), persist(2, base, full)] });
  assert.ok(solapados.some(f => f.category === 'overlap' && f.severity === 'error'));
});

test('zonas/23: zonas contiguas avisan de la cercha duplicada en el borde común', () => {
  const { grid, elements, base } = zoneFixture();
  const a = computeRoofSystemLayout({ ...base, runRange: { from: 0, to: 2400 } }, grid, {}, {}, elements);
  const b = computeRoofSystemLayout({ ...base, runRange: { from: 2400, to: 4800 } }, grid, {}, {}, elements);
  const findings = validateRoofSystems({ grid, elements, roofSystems: [persist(1, base, a), persist(2, base, b)] });
  const dup = findings.find(f => f.category === 'duplicateEdgeTruss');
  assert.ok(dup && dup.severity === 'warning');
  assert.deepEqual(dup.roofSystemIds, [1, 2]);
});

test('zonas/23: zona persistida que ya no cabe en el solape se reporta', () => {
  const { grid, elements, base } = zoneFixture();
  const layout = computeRoofSystemLayout({ ...base, runRange: { from: 4000, to: 6000 } }, grid, {}, {}, elements);
  const sys = { ...persist(1, base, layout), runRange: { from: 4000, to: 6000 } };

  // el muro alto se acorta a 0→3000: la zona queda fuera del nuevo solape
  const elementsCortos = [elements[0], { ...elements[1], xEnd: 'X3' }];
  const gridCorto = { ...grid, xAxes: [...grid.xAxes, { id: 'X3', position: 3000 }] };
  const findings = validateRoofSystems({ grid: gridCorto, elements: elementsCortos, roofSystems: [sys] });
  assert.ok(findings.some(f => f.category === 'zoneOutOfOverlap' && f.severity === 'error'));

  // y si solo la excede parcialmente, es warning de recorte
  const parcial = { ...sys, runRange: { from: 2000, to: 6000 } };
  const findings2 = validateRoofSystems({ grid: gridCorto, elements: elementsCortos, roofSystems: [parcial] });
  assert.ok(findings2.some(f => f.category === 'zoneClamped' && f.severity === 'warning'));
});
