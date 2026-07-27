// tests/levelVisibilityCut.test.mjs — sesión 21 (UI B), parte A: corte estricto en planta.
// Fixture único: muro con ventana + muro frontón con puerta + un sistema de techumbre,
// reutilizado por los tres bloques de test (vanos, techumbre, dibujo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawWallPlan, isPointInWallPlan, findOpeningAtPoint } from '../src/render/wall.js';
import { visibleRoofSystems } from '../src/core/levelVisibility.js';
import { roofSystemVerticalRange } from '../src/core/trussLayout.js';

// ---- fixture -----------------------------------------------------------------------------
const grid = {
  xAxes: [{ id: 'xa', position: 0 }, { id: 'xb', position: 4000 }],
  yAxes: [{ id: 'ya', position: 0 }],
  zLevels: [
    { id: 'z0', elevation: 0 },       // piso
    { id: 'zSill', elevation: 900 },  // antepecho de la ventana (borde inferior)
    { id: 'zMid', elevation: 1500 },  // dentro del vano de la ventana
    { id: 'zTop', elevation: 2100 },  // dintel de la ventana (borde superior)
    { id: 'z1', elevation: 2400 },    // cota de cielo (muro estándar termina acá)
    { id: 'z2', elevation: 3400 }     // cumbrera del frontón
  ]
};

// Muro estándar (piso→cielo) con una ventana: sillHeight 900, alto 1200 → rango [900, 2100].
const wallWithWindow = {
  id: 'w1', type: 'wall', direction: 'x',
  xStart: 'xa', xEnd: 'xb', yStart: 'ya', yEnd: 'ya',
  thickness: 150, bottomZ: 'z0', topZ: 'z1',
  openings: [{ id: 'o1', type: 'window', axisType: 'x', position: 2000, width: 1000, height: 1200, sillHeight: 900 }]
};

// Muro frontón (piso→cumbrera) con una puerta: arranca del piso del muro, sin sillHeight.
const wallFronton = {
  id: 'w2', type: 'wall', direction: 'x',
  xStart: 'xa', xEnd: 'xb', yStart: 'ya', yEnd: 'ya',
  thickness: 150, bottomZ: 'z0', topZ: 'z2',
  openings: [{ id: 'o2', type: 'door', axisType: 'x', position: 2000, width: 900, height: 2100 }]
};

const view = { scale: 1, offsetX: 0, offsetY: 0 };
const canvasH = 1000;

// ---- vanos: ventana (sillHeight) --------------------------------------------------------

test('ventana: no corta en el piso (bajo el antepecho) — muro continuo', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, 'z0'), true);
  assert.equal(findOpeningAtPoint(2000, 0, wallWithWindow, grid, view, canvasH, 12, {}, {}, 'z0'), null);
});

test('ventana: no corta en cota de cielo (por sobre el dintel) — muro continuo', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, 'z1'), true);
  assert.equal(findOpeningAtPoint(2000, 0, wallWithWindow, grid, view, canvasH, 12, {}, {}, 'z1'), null);
});

test('ventana: corta a media altura del vano', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, 'zMid'), false);
  assert.equal(findOpeningAtPoint(2000, 0, wallWithWindow, grid, view, canvasH, 12, {}, {}, 'zMid')?.id, 'o1');
});

test('ventana: borde inclusivo — corta justo en el antepecho y justo en el dintel', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, 'zSill'), false);
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, 'zTop'), false);
});

test('ventana: sin nivel seleccionado (null) no se filtra — comportamiento previo a la sesión 21', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallWithWindow, grid, view, canvasH, 8, {}, {}, null), false);
  assert.equal(findOpeningAtPoint(2000, 0, wallWithWindow, grid, view, canvasH, 12, {}, {}, null)?.id, 'o1');
});

// ---- vanos: puerta (arranca del piso, sin sillHeight) ------------------------------------

test('puerta: corta al nivel del piso (arranca del piso del muro, no del antepecho)', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallFronton, grid, view, canvasH, 8, {}, {}, 'z0'), false);
  assert.equal(findOpeningAtPoint(2000, 0, wallFronton, grid, view, canvasH, 12, {}, {}, 'z0')?.id, 'o2');
});

test('puerta: no corta en la cumbrera del frontón (por sobre el dintel de 2100mm)', () => {
  assert.equal(isPointInWallPlan(2000, 0, wallFronton, grid, view, canvasH, 8, {}, {}, 'z2'), true);
  assert.equal(findOpeningAtPoint(2000, 0, wallFronton, grid, view, canvasH, 12, {}, {}, 'z2'), null);
});

// ---- dibujo: drawWallPlan produce 1 rectángulo (continuo) o 2 (cortado) -----------------

function countFillRects(wall, currentZLevelId) {
  const calls = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    fillRect: (...args) => calls.push(args),
    strokeRect: () => {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}
  };
  drawWallPlan(ctx, wall, grid, view, canvasH, false, null, {}, {}, currentZLevelId);
  return calls.length;
}

test('drawWallPlan: en cota de cielo dibuja el muro como un solo tramo (sin recorte de ventana)', () => {
  assert.equal(countFillRects(wallWithWindow, 'z1'), 1);
});

test('drawWallPlan: a media altura del vano dibuja dos tramos (el hueco real de la ventana)', () => {
  assert.equal(countFillRects(wallWithWindow, 'zMid'), 2);
});

// ---- techumbre: visibleRoofSystems -------------------------------------------------------

function makeRoofSystem(id, supportElevation) {
  return {
    id, supportElevation, purlinProfile: null,
    trussGeometry: { resolved: true, heightLow: 200, heightHigh: 800 } // rango real: [supportElevation+200, supportElevation+800]
  };
}

test('roofSystemVerticalRange: usa heightLow/heightHigh sobre la cota de apoyo (sin costanera)', () => {
  const sys = makeRoofSystem('r1', 2400);
  assert.deepEqual(roofSystemVerticalRange(sys, null), { bottom: 2600, top: 3200 });
});

test('roofSystemVerticalRange: sistema sin geometría resuelta → null (no se oculta silenciosamente)', () => {
  assert.equal(roofSystemVerticalRange({ trussGeometry: { resolved: false } }, null), null);
});

test('visibleRoofSystems: oculta la cercha en el piso, la muestra donde corta su propia altura', () => {
  const model = { grid, currentZLevelId: 'z0', roofSystems: [makeRoofSystem('r1', 2400)] };
  assert.deepEqual(visibleRoofSystems(model, null), []); // piso: fuera del rango [2600,3200]

  model.currentZLevelId = 'z2'; // 3400: también fuera de [2600,3200], pero probamos una cota que sí cae dentro
  model.grid = { ...grid, zLevels: [...grid.zLevels, { id: 'zRoof', elevation: 2800 }] };
  model.currentZLevelId = 'zRoof';
  assert.deepEqual(visibleRoofSystems(model, null).map(s => s.id), ['r1']);
});

test('visibleRoofSystems: sin nivel seleccionado (null) no filtra ningún sistema', () => {
  const model = { grid, currentZLevelId: null, roofSystems: [makeRoofSystem('r1', 2400)] };
  assert.deepEqual(visibleRoofSystems(model, null).map(s => s.id), ['r1']);
});
