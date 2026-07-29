import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DXF_PAPER_MARGIN_MM,
  dxfEntityBounds,
  findDxfCollisions,
  unionDxfEntityBounds
} from '../src/core/dxfGeometry.js';
import {
  circle,
  line,
  rectPolyline,
  solidTriangle,
  text
} from '../src/core/exportFramingDxf.js';

test('SPEC-R9-A: la caja del círculo incluye todo el radio', () => {
  assert.deepEqual(
    dxfEntityBounds(circle('ETIQUETAS', 100, 200, 25)),
    { xMin: 75, xMax: 125, yMin: 175, yMax: 225 }
  );
});

test('SPEC-R9-A: un texto a 90 grados crece hacia X negativo y mantiene caja finita', () => {
  const bounds = dxfEntityBounds(text('COTAS', 100, 200, 20, '2400', 90));
  assert.ok(bounds.xMin < 100, `xMin=${bounds.xMin}`);
  assert.ok(bounds.xMax <= 100 + 1e-9, `xMax=${bounds.xMax}`);
  assert.ok(bounds.yMax > 200, `yMax=${bounds.yMax}`);
  assert.ok(Object.values(bounds).every(Number.isFinite));
});

test('SPEC-R9-A: LINE, SOLID y POLYLINE producen cajas completas', () => {
  assert.deepEqual(
    dxfEntityBounds(line('EJES', -10, 5, 30, 40)),
    { xMin: -10, xMax: 30, yMin: 5, yMax: 40 }
  );
  assert.deepEqual(
    dxfEntityBounds(solidTriangle('ETIQUETAS', [0, 10], [-5, 20], [8, 30])),
    { xMin: -5, xMax: 8, yMin: 10, yMax: 30 }
  );
  assert.deepEqual(
    dxfEntityBounds(rectPolyline('MONTANTES', -4, -3, 12, 18)),
    { xMin: -4, xMax: 12, yMin: -3, yMax: 18 }
  );
});

test('SPEC-R9-A: el margen se expresa en papel y se convierte por la escala', () => {
  const bounds = unionDxfEntityBounds(
    [line('EJES', 0, 0, 1000, 500)],
    { paperMargin: DXF_PAPER_MARGIN_MM, scale: 100 }
  );
  assert.deepEqual(bounds, {
    xMin: -300,
    xMax: 1300,
    yMin: -300,
    yMax: 800
  });
});

test('SPEC-R9-A: el analizador reporta texto-texto y círculo-círculo', () => {
  const collisions = findDxfCollisions([
    text('ETIQUETAS', 0, 0, 100, 'ABC'),
    text('ETIQUETAS', 50, 0, 100, 'DEF'),
    circle('ETIQUETAS', 1000, 1000, 250),
    circle('ETIQUETAS', 1300, 1000, 250)
  ]);
  assert.equal(collisions.filter((item) => item.kind === 'text-text').length, 1);
  assert.equal(collisions.filter((item) => item.kind === 'circle-circle').length, 1);
});
