// tests/takeoff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTakeoff } from '../src/core/takeoff.js';
import { computeRoofSystemLayout } from '../src/core/trussLayout.js';

const near = (a, b, tol = 0.5) => Math.abs(a - b) < tol;

// Mismo fixture que tests/trussLayout.test.mjs (dos muros xRun @Y1/Y2, luz 4000mm,
// solapamiento 0..6000 @1200 → 6 cerchas).
const systemFixture = () => {
  const grid = {
    xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 6000 }],
    yAxes: [{ id: 'Y1', position: 0 }, { id: 'Y2', position: 4090 }],
    zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
  };
  const wallLow = { id: 1, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  const wallHigh = { id: 2, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y2', yEnd: 'Y2', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  return { grid, elements: [wallLow, wallHigh] };
};

const modelWithSystem = (overrides = {}) => {
  const { grid, elements } = systemFixture();
  const config = {
    wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, gutterNotchWidth: 300,
    trussSpacing: 1200, postSpacing: 600, purlinProfile: '35OMA085', purlinSpacing: 800,
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    ...overrides
  };
  const layout = computeRoofSystemLayout(config, grid, {}, {}, elements);
  const system = {
    id: 100, ...config,
    span: layout.span, supportElevation: layout.supportElevation, runAxis: layout.runAxis,
    spanDir: layout.spanDir, trussPositions: layout.trussPositions, trussGeometry: layout.trussGeometry,
    supportLedgers: layout.supportLedgers
  };
  return {
    grid, elements, roofSystems: [system],
    library: { metalconProfiles: [
      { code: '90CA085', H: 90, B: 38 }, { code: '40CA085', H: 40, B: 40 },
      { code: '60CA085', H: 60, B: 38 }, { code: '35OMA085', H: 35, B: 40 }
    ] },
    projectParams: []
  };
};

test('takeoff: techumbre — ml de cuerda inferior = span × n_cerchas (perfil agrupado)', () => {
  const model = modelWithSystem();
  const { rows } = computeTakeoff(model);
  const system = model.roofSystems[0];
  const nTrusses = system.trussPositions.length;
  assert.equal(nTrusses, 6);

  const bottom = system.trussGeometry.members.find((m) => m.role === 'bottomChord');
  const bottomLenM = Math.hypot(bottom.x2 - bottom.x1, bottom.y2 - bottom.y1) / 1000;

  const row = rows.find((r) => r.type === 'roof' && r.section === '90CA085');
  assert.ok(row, 'debe existir fila roof/90CA085 (cuerdas superior+inferior comparten perfil)');
  // topChord + bottomChord comparten perfil 90CA085 → se acumulan en la misma fila
  const topLenM = Math.hypot(
    system.trussGeometry.members.find((m) => m.role === 'topChord').x2 -
      system.trussGeometry.members.find((m) => m.role === 'topChord').x1,
    system.trussGeometry.members.find((m) => m.role === 'topChord').y2 -
      system.trussGeometry.members.find((m) => m.role === 'topChord').y1
  ) / 1000;
  assert.ok(near(row.ml, (bottomLenM + topLenM) * nTrusses, 0.01));
});

test('takeoff: techumbre — costaneras: ml = n_purlins × largo de sistema, n piezas = n_purlins', () => {
  const model = modelWithSystem();
  const { rows } = computeTakeoff(model);
  const system = model.roofSystems[0];
  const purlins = system.trussGeometry.purlins;
  assert.ok(purlins.length >= 2);

  const offsets = system.trussPositions.map((p) => p.offset);
  const runLengthM = (Math.max(...offsets) - Math.min(...offsets)) / 1000;
  assert.ok(near(runLengthM, 6, 0.01)); // solapamiento 0..6000mm

  const row = rows.find((r) => r.type === 'roof' && r.section === '35OMA085');
  assert.ok(row);
  assert.equal(row.count, purlins.length);
  assert.ok(near(row.ml, purlins.length * runLengthM, 0.01));
});

test('takeoff: un sistema sin geometría resuelta no aporta filas roof', () => {
  const { grid, elements } = systemFixture();
  // span insuficiente → trussGeometry no resuelve (heelHeight negativo fuerza slope inválido no,
  // usamos wallLowId inexistente para forzar resolved:false directamente en el layout)
  const layout = computeRoofSystemLayout(
    { wallLowId: 1, wallHighId: 999, slopePercent: 30, heelHeight: 200, trussSpacing: 1200, postSpacing: 600 },
    grid, {}, {}, elements
  );
  assert.equal(layout.resolved, false);
  const system = { id: 101, wallLowId: 1, wallHighId: 999, trussPositions: [], trussGeometry: { resolved: false, members: [], purlins: [] } };
  const model = { grid, elements, roofSystems: [system], library: {}, projectParams: [] };
  const { rows } = computeTakeoff(model);
  assert.equal(rows.some((r) => r.type === 'roof'), false);
});

test('takeoff: sin roofSystems no rompe (compatibilidad hacia atrás)', () => {
  const { grid, elements } = systemFixture();
  const model = { grid, elements, library: {}, projectParams: [] };
  const { rows } = computeTakeoff(model);
  assert.equal(rows.some((r) => r.type === 'roof'), false);
});

test('takeoff/17: apoyo lateral — 2 soleras a lo largo del solape (6m c/u) en el perfil dado', () => {
  const model = modelWithSystem({ supportMode: 'lateral', supportProfile: '150CA085' });
  const { rows } = computeTakeoff(model);
  const row = rows.find((r) => r.type === 'roof' && r.section === '150CA085');
  assert.ok(row, 'fila de la solera de apoyo lateral');
  assert.equal(row.count, 2);
  assert.ok(near(row.ml, 12)); // 2 × 6000mm
});

test('takeoff/17: modo coronación no agrega soleras', () => {
  const { rows } = computeTakeoff(modelWithSystem());
  assert.equal(rows.some((r) => r.type === 'roof' && r.section === '150CA085'), false);
});

test('takeoff: el revestimiento OSB se cuenta en PLACAS a comprar, con comparativa contra modular muro por muro', () => {
  const grid = {
    xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 3000 }],
    yAxes: [{ id: 'Y1', position: 0 }],
    zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2440 }]
  };
  const osbWall = (id) => ({
    id, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1',
    bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings: [],
    osbPanelWidth: 1220, osbPanelHeight: 2440,
    osbCourses: [{ zMin: 0, zMax: 2440, height: 2440, panels: [{ start: 0, end: 600, width: 600 }] }]
  });
  const model = { elements: [osbWall(1), osbWall(2)], grid, library: {}, projectParams: [] };

  const { rows, osbPurchase } = computeTakeoff(model);
  const osbRow = rows.find((r) => r.type === 'osb');
  assert.ok(osbRow, 'aparece una fila de placas OSB');
  assert.equal(osbRow.section, 'Placa 1220x2440 mm');
  assert.equal(osbRow.count, 1, 'las dos piezas de 600mm salen de la misma placa');

  assert.equal(osbPurchase.boardCount, 1);
  assert.equal(osbPurchase.baseline.perWallBoards, 2);
  assert.equal(osbPurchase.savings.boards, 1);
  assert.ok(osbPurchase.wastePct > 0 && osbPurchase.wastePct < 100);
  assert.equal(osbPurchase.unplaced.length, 0);
});

test('takeoff: un modelo sin despiece OSB no trae reporte de compra (nada cambia respecto de antes)', () => {
  const model = { elements: [], grid: { xAxes: [], yAxes: [], zLevels: [] }, library: {}, projectParams: [] };
  assert.equal(computeTakeoff(model).osbPurchase, null);
});

test('takeoff: tabiquería conserva piezas con perfil o largo no resoluble y las advierte', () => {
  const wall = {
    id: 'w1',
    type: 'wall',
    framingStudProfileId: 'perfil-ausente',
    framingTrackProfileId: 'solera-ausente',
    studs: [
      { role: 'stud', offset: 0, zMin: 0, zMax: 2400 },
      { role: 'nogging', oMin: 100, oMax: Number.NaN, zMin: 1200, zMax: 1238 }
    ],
    headers: [{ role: 'header', oMin: 500, oMax: 1500, z: 2100 }]
  };
  const model = {
    elements: [wall],
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    library: { metalconProfiles: [] },
    projectParams: []
  };
  const { rows, totalsByType } = computeTakeoff(model);
  const framing = rows.filter((row) => row.type === 'framing');

  assert.equal(totalsByType.framing.count, 3, 'ninguna pieza importada se descarta');
  assert.equal(totalsByType.framing.ml, 3.4, 'sólo el largo inválido queda fuera de la suma');
  assert.equal(totalsByType.framing.warnings, 3);
  assert.equal(framing.length, 3);
  assert.ok(framing.every((row) => row.section.startsWith('Personalizado — ')));
});
