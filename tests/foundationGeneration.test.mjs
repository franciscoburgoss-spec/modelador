// tests/foundationGeneration.test.mjs — Sesión 12 (Fundaciones B: generación automática)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFoundationsFromWalls } from '../src/core/foundationGeneration.js';

const grid = {
  xAxes: [{ id: 1, position: 0, label: 'A' }, { id: 2, position: 5000, label: 'B' }, { id: 3, position: 9000, label: 'C' }],
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 4000, label: '2' }],
  zLevels: [{ id: 100, elevation: 0, label: 'NPT' }, { id: 200, elevation: 2400, label: 'Piso 2' }]
};

// Proyecto tipo Casablanca: muros en L (A-B y B-C colineales en y=0, se fusionan) + T (C, en x=C).
const wallAB = { id: 'wAB', type: 'wall', direction: 'x', xStart: 1, xEnd: 2, yStart: 11, yEnd: 11, bottomZ: 100, topZ: 200, thickness: 90 };
const wallBC = { id: 'wBC', type: 'wall', direction: 'x', xStart: 2, xEnd: 3, yStart: 11, yEnd: 11, bottomZ: 100, topZ: 200, thickness: 90 };
const wallC  = { id: 'wC',  type: 'wall', direction: 'y', xStart: 3, xEnd: 3, yStart: 11, yEnd: 12, bottomZ: 100, topZ: 200, thickness: 90 };
// Muro de segundo piso: NO debe generar fundación.
const wallPiso2 = { id: 'wP2', type: 'wall', direction: 'x', xStart: 1, xEnd: 2, yStart: 12, yEnd: 12, bottomZ: 200, topZ: 200, thickness: 90 };
// Pilar en B-2, sin muro encima: candidato a poyo aislado.
const colB2 = { id: 'colB2', type: 'column', axisXId: 2, axisYId: 12, bottomZ: 100, topZ: 200, widthX: 300, widthY: 300 };
// Pilar sobre el muro C (cubierto): NO debe generar poyo.
const colC1 = { id: 'colC1', type: 'column', axisXId: 3, axisYId: 11, bottomZ: 100, topZ: 200, widthX: 300, widthY: 300 };

const baseModel = () => ({
  grid,
  elements: [wallAB, wallBC, wallC, wallPiso2, colB2, colC1],
  library: { foundationSections: [{ id: 9, itemType: 'cimiento', name: 'C 40/60', width: 400, depth: 600 }] },
  projectParams: []
});

test('fusiona tramos colineales contiguos (A-B + B-C -> un solo cimiento A-C)', () => {
  const out = generateFoundationsFromWalls(baseModel(), { defaultSectionId: 9 });
  const corridas = out.created.filter((f) => f.foundationType === 'corrida');
  assert.equal(corridas.length, 2); // A-C fusionado + tramo en Y (C)
  const fusionado = corridas.find((f) => f.direction === 'x');
  assert.equal(fusionado.startAxisId, 1);
  assert.equal(fusionado.endAxisId, 3);
  assert.equal(fusionado.fixedAxisId, 11);
  assert.equal(fusionado.cimiento.width, 400);
  assert.equal(out.errors.length, 0);
});

test('no genera fundación bajo muros de nivel superior (bottomZ != nivel base)', () => {
  const out = generateFoundationsFromWalls(baseModel(), { defaultSectionId: 9 });
  const cubreY12 = out.created.some((f) => f.foundationType === 'corrida' && f.fixedAxisId === 12);
  assert.equal(cubreY12, false);
});

test('segunda ejecución no duplica (idempotente)', () => {
  const model = baseModel();
  const first = generateFoundationsFromWalls(model, { defaultSectionId: 9 });
  const withGenerated = { ...model, elements: [...model.elements, ...first.created.map((f, i) => ({ ...f, id: `gen${i}` }))] };
  const second = generateFoundationsFromWalls(withGenerated, { defaultSectionId: 9 });
  assert.equal(second.created.filter((f) => f.foundationType === 'corrida').length, 0);
  assert.equal(second.skipped.length, first.created.filter((f) => f.foundationType === 'corrida').length);
});

test('poyo aislado bajo pilar sin muro encima (flag), no duplica bajo pilar ya cubierto por muro', () => {
  const out = generateFoundationsFromWalls(baseModel(), { defaultSectionId: 9, includeIsolatedUnderColumns: true });
  const poyos = out.created.filter((f) => f.foundationType === 'aislada');
  assert.equal(poyos.length, 1);
  assert.equal(poyos[0].axisXId, 2);
  assert.equal(poyos[0].axisYId, 12);
  assert.equal(poyos[0].columnId, 'colB2');
});

test('sin flag de poyos, no genera aisladas', () => {
  const out = generateFoundationsFromWalls(baseModel(), { defaultSectionId: 9 });
  assert.equal(out.created.filter((f) => f.foundationType === 'aislada').length, 0);
});

test('sin nivel base (elevation 0) definido: reporta error y no genera nada', () => {
  const model = baseModel();
  model.grid = { ...grid, zLevels: [{ id: 300, elevation: 3000, label: 'Piso raro' }] };
  const out = generateFoundationsFromWalls(model, { defaultSectionId: 9 });
  assert.equal(out.created.length, 0);
  assert.ok(out.errors.length > 0);
});

test('un undo revierte todo: created son elementos planos listos para addElements (sin id)', () => {
  const out = generateFoundationsFromWalls(baseModel(), { defaultSectionId: 9, includeIsolatedUnderColumns: true });
  for (const el of out.created) assert.equal(el.id, undefined);
});
