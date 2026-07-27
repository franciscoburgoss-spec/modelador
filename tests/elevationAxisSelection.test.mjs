// tests/elevationAxisSelection.test.mjs — sesión 21 (UI B), parte B: doble click a elevación.
// resolveElevationAxisForElement elige el eje de corte que muestra el elemento a lo largo
// (categoría 1 en core/elevation.js), no cualquier corte que lo cruce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveElevationAxisForElement } from '../src/core/elevation.js';

const grid = {
  xAxes: [{ id: 1, position: 0 }, { id: 2, position: 4000 }],
  yAxes: [{ id: 11, position: 0 }, { id: 12, position: 3000 }],
  zLevels: [{ id: 100, elevation: 0 }, { id: 200, elevation: 2400 }]
};

test('muro que corre en X (fijo en Y): eje "y" en el eje de grilla Y correspondiente', () => {
  const wallX = {
    type: 'wall', direction: 'x',
    xStart: 1, xEnd: 2, yStart: 11, yEnd: 11,
    thickness: 150, bottomZ: 100, topZ: 200
  };
  assert.deepEqual(resolveElevationAxisForElement(wallX, grid), { axisType: 'y', axisId: 11 });
});

test('muro que corre en Y (fijo en X): eje "x" en el eje de grilla X correspondiente', () => {
  const wallY = {
    type: 'wall', direction: 'y',
    xStart: 2, xEnd: 2, yStart: 11, yEnd: 12,
    thickness: 150, bottomZ: 100, topZ: 200
  };
  assert.deepEqual(resolveElevationAxisForElement(wallY, grid), { axisType: 'x', axisId: 2 });
});

test('muro fuera de cualquier eje de grilla (ubicado por offset): sin corte de elevación posible', () => {
  const wallOffAxis = {
    type: 'wall', direction: 'x',
    xStart: 1, xEnd: 2, yStart: 11, yEnd: 11,
    thickness: 150, bottomZ: 100, topZ: 200
  };
  const gridSinEjeY = { ...grid, yAxes: [{ id: 99, position: 1500 }] }; // ningún eje Y en 0
  assert.equal(resolveElevationAxisForElement(wallOffAxis, gridSinEjeY), null);
});

test('pilar: eje "x" según su ubicación en el eje X (cualquiera de los dos ejes lo mostraría)', () => {
  const column = { type: 'column', axisXId: 2, axisYId: 12 };
  assert.deepEqual(resolveElevationAxisForElement(column, grid), { axisType: 'x', axisId: 2 });
});

test('fundación aislada: mismo criterio que pilar (eje "x")', () => {
  const pad = { type: 'foundation', foundationType: 'aislada', axisXId: 1, axisYId: 11 };
  assert.deepEqual(resolveElevationAxisForElement(pad, grid), { axisType: 'x', axisId: 1 });
});

test('fundación corrida en X: eje "y" en su eje fijo (fixedAxisId)', () => {
  const corridaX = { type: 'foundation', foundationType: 'corrida', direction: 'x', fixedAxisId: 11, startAxisId: 1, endAxisId: 2 };
  assert.deepEqual(resolveElevationAxisForElement(corridaX, grid), { axisType: 'y', axisId: 11 });
});

test('fundación corrida en Y: eje "x" en su eje fijo (fixedAxisId)', () => {
  const corridaY = { type: 'foundation', foundationType: 'corrida', direction: 'y', fixedAxisId: 2, startAxisId: 11, endAxisId: 12 };
  assert.deepEqual(resolveElevationAxisForElement(corridaY, grid), { axisType: 'x', axisId: 2 });
});

test('elemento sin geometría resoluble (ejes inexistentes): null, no revienta', () => {
  const wallRoto = { type: 'wall', direction: 'x', xStart: 999, xEnd: 2, yStart: 11, yEnd: 11, thickness: 150, bottomZ: 100, topZ: 200 };
  assert.equal(resolveElevationAxisForElement(wallRoto, grid), null);
});
