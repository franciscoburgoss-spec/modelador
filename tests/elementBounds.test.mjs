import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveElementWorldBounds } from '../src/core/elementBounds.js';

function baseGrid() {
  return {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 4000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 2400 }]
  };
}

test('elementBounds: columna devuelve envolvente centrada en el eje con su rango de altura', () => {
  const grid = baseGrid();
  const column = { type: 'column', axisXId: 'x0', axisYId: 'y0', bottomZ: 'z0', topZ: 'z1', widthX: 300, widthY: 300 };
  const b = resolveElementWorldBounds(column, null, grid, {}, {});
  assert.equal(b.xMin, -150);
  assert.equal(b.xMax, 150);
  assert.equal(b.zMin, 0);
  assert.equal(b.zMax, 2400);
});

test('elementBounds: muro X0→X1 devuelve rango completo en X y Z', () => {
  const grid = baseGrid();
  const wall = { type: 'wall', direction: 'x', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', bottomZ: 'z0', topZ: 'z1', thickness: 90 };
  const b = resolveElementWorldBounds(wall, null, grid, {}, {});
  assert.equal(b.xMin, 0);
  assert.equal(b.xMax, 4000);
  assert.equal(b.zMin, 0);
  assert.equal(b.zMax, 2400);
});

test('elementBounds: vano (ventana) en muro X → rango angosto en X centrado en position, con sillHeight', () => {
  const grid = baseGrid();
  const wall = { type: 'wall', direction: 'x', xStart: 'x0', xEnd: 'x1', yStart: 'y0', yEnd: 'y0', bottomZ: 'z0', topZ: 'z1', thickness: 90 };
  const window = { id: 'o1', axisType: 'x', position: 2000, width: 1200, height: 1200, sillHeight: 900 };
  const b = resolveElementWorldBounds(window, wall, grid, {}, {});
  assert.equal(b.xMin, 1400);
  assert.equal(b.xMax, 2600);
  assert.equal(b.zMin, 900);
  assert.equal(b.zMax, 2100);
});

test('elementBounds: elemento sin geometría resoluble devuelve null', () => {
  const grid = baseGrid();
  const column = { type: 'column', axisXId: 'no-existe', axisYId: 'y0', bottomZ: 'z0', topZ: 'z1', widthX: 300, widthY: 300 };
  assert.equal(resolveElementWorldBounds(column, null, grid, {}, {}), null);
});
