// tests/foundations.test.mjs — Sesión 11 (Fundaciones A)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFoundation, migrateFoundations, migrateFoundationSections,
  foundationPlanShape, foundationElevationRects, foundationVerticalRange
} from '../src/core/foundationGeometry.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { validateModel } from '../src/core/modelValidation.js';
import { buildFoundationBoxes } from '../src/core/build3d.js';

const grid = {
  xAxes: [{ id: 1, position: 0, label: 'A' }, { id: 2, position: 5000, label: 'B' }],
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 4000, label: '2' }],
  zLevels: [{ id: 100, elevation: 0, label: 'NPT' }]
};

// Cimiento corrido en L: tramo en X (5 m) + tramo en Y (4 m), ambos con sobrecimiento.
const corridaX = {
  id: 1, type: 'foundation', foundationType: 'corrida', direction: 'x',
  fixedAxisId: 11, startAxisId: 1, endAxisId: 2, levelZ: 100, topOffset: 0,
  cimiento: { width: 400, depth: 600 },
  sobrecimiento: { width: 200, height: 400, libraryId: null },
  libraryId: null
};
const corridaY = {
  ...corridaX, id: 2, direction: 'y',
  fixedAxisId: 1, startAxisId: 11, endAxisId: 12
};
const poyo = {
  id: 3, type: 'foundation', foundationType: 'aislada',
  axisXId: 2, axisYId: 12, levelZ: 100, topOffset: 0,
  aislada: { lengthX: 1000, lengthY: 1200, depth: 500 },
  columnId: null, libraryId: null
};
const model = { grid, elements: [corridaX, corridaY, poyo], library: { foundationSections: [] }, projectParams: [], roofSystems: [] };

test('corrida: capas apiladas bajo el NPT y sello = tope − (h sobrec. + prof. cimiento)', () => {
  const f = resolveFoundation(corridaX, grid);
  assert.equal(f.kind, 'corrida');
  assert.equal(f.topElevation, 0);
  assert.equal(f.length, 5000);
  assert.deepEqual(f.layers.map(l => l.name), ['sobrecimiento', 'cimiento']);
  assert.deepEqual(f.layers.map(l => [l.top, l.bottom]), [[0, -400], [-400, -1000]]);
  assert.equal(f.sealElevation, -1000);
  // moldaje sobrecimiento: 2 caras × 5000 × 400
  assert.equal(f.formworkArea, 2 * 5000 * 400);
});

test('corrida sin sobrecimiento: el cimiento arranca en el NPT', () => {
  const f = resolveFoundation({ ...corridaX, sobrecimiento: null }, grid);
  assert.deepEqual(f.layers.map(l => l.name), ['cimiento']);
  assert.equal(f.sealElevation, -600);
  assert.equal(f.formworkArea, 0);
});

test('topOffset desplaza todo el conjunto respecto del NPT', () => {
  const f = resolveFoundation({ ...corridaX, topOffset: 150 }, grid);
  assert.equal(f.topElevation, 150);
  assert.equal(f.sealElevation, -850);
});

test('aislada: se ubica en la intersección de ejes y su volumen es largo×ancho×altura', () => {
  const f = resolveFoundation(poyo, grid);
  assert.equal(f.kind, 'aislada');
  assert.deepEqual(f.center, { x: 5000, y: 4000 });
  assert.equal(f.layers[0].volume, 1000 * 1200 * 500);
  assert.equal(f.sealElevation, -500);
});

test('emplantillado: queda bajo el sello y crece con el sobreancho', () => {
  const f = resolveFoundation({ ...corridaX, emplantillado: { thickness: 50, overhang: 100 } }, grid);
  assert.equal(f.emplantillado.top, -1000);
  assert.equal(f.emplantillado.bottom, -1050);
  assert.equal(f.emplantillado.area, (400 + 200) * 5000); // ancho + 2×100, el largo no crece
  assert.equal(f.emplantillado.volume, (400 + 200) * 5000 * 50);
  assert.equal(foundationVerticalRange({ ...corridaX, emplantillado: { thickness: 50, overhang: 100 } }, grid).bottom, -1050);
});

test('planta: corrida devuelve segmento con ancho de cimiento; aislada, rectángulo centrado', () => {
  const run = foundationPlanShape(corridaX, grid);
  assert.equal(run.kind, 'corrida');
  assert.deepEqual([run.p1, run.p2], [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
  assert.equal(run.width, 400);

  const pad = foundationPlanShape(poyo, grid);
  assert.deepEqual(pad, { kind: 'aislada', center: { x: 5000, y: 4000 }, lengthX: 1000, lengthY: 1200 });
});

test('elevación: una franja por capa, de arriba hacia abajo', () => {
  // Corte en el eje Y=0 (axis 'x' proyecta Y como horizontal): el tramo en X queda en el plano.
  const rects = foundationElevationRects(corridaX, grid, 'y');
  assert.deepEqual(rects.map(r => r.name), ['sobrecimiento', 'cimiento']);
  assert.deepEqual([rects[0].hMin, rects[0].hMax], [0, 5000]);
  assert.equal(rects[1].vBottom, -1000);
});

test('3D: una caja por capa, con la altura de cada capa', () => {
  const boxes = buildFoundationBoxes(model).filter(b => b.id === 1);
  assert.deepEqual(boxes.map(b => b.layer), ['sobrecimiento', 'cimiento']);
  assert.equal(boxes[0].size.y, 400);
  assert.equal(boxes[1].size.y, 600);
  assert.equal(boxes[1].size.z, 400); // ancho del cimiento en la dirección transversal
  assert.equal(boxes[1].center.y, -700); // punto medio de [-1000, -400]
});

test('metrado: volúmenes de cimiento y sobrecimiento verificados a mano', () => {
  const { rows } = computeTakeoff(model);
  const find = (s) => rows.find(r => r.section === s);

  // Cimiento: (5 m + 4 m) × 0.40 × 0.60 = 2.16 m³
  assert.equal(+find('Cimiento — Personalizado').m3.toFixed(4), 2.16);
  assert.equal(+find('Cimiento — Personalizado').ml.toFixed(3), 9);
  // Sobrecimiento: 9 m × 0.20 × 0.40 = 0.72 m³
  assert.equal(+find('Sobrecimiento — Personalizado').m3.toFixed(4), 0.72);
  // Moldaje: 2 caras × 9 m × 0.40 = 7.2 m²
  assert.equal(+find('Moldaje sobrecimiento').m2.toFixed(3), 7.2);
  // Zapata aislada: 1.0 × 1.2 × 0.5 = 0.6 m³
  assert.equal(+find('Zapata aislada — Personalizado').m3.toFixed(4), 0.6);
  // Excavación informativa: solo las corridas
  assert.equal(+find('Excavación (informativo)').ml.toFixed(3), 9);
});

test('metrado: emplantillado como partida propia (m² y m³)', () => {
  const el = { ...corridaX, emplantillado: { thickness: 50, overhang: 100 } };
  const { rows } = computeTakeoff({ ...model, elements: [el] });
  const emp = rows.find(r => r.section === 'Emplantillado');
  assert.equal(+emp.m2.toFixed(3), 3); // 0.6 m × 5 m
  assert.equal(+emp.m3.toFixed(4), 0.15);
});

test('validación: warning si el tope del sobrecimiento no empata con el NPT', () => {
  const withOffset = { ...corridaX, topOffset: 150 };
  const findings = validateModel({ ...model, elements: [withOffset] });
  const w = findings.filter(f => f.category === 'Fundaciones' && f.severity === 'warning');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /no empata con el NPT/);

  // Con topOffset 0 no debe aparecer.
  const clean = validateModel({ ...model, elements: [corridaX] })
    .filter(f => f.category === 'Fundaciones' && f.severity === 'warning');
  assert.equal(clean.length, 0);
});

test('validación: corrida sin ninguna capa es error', () => {
  const empty = { ...corridaX, cimiento: null, sobrecimiento: null };
  const findings = validateModel({ ...model, elements: [empty] });
  assert.ok(findings.some(f => f.category === 'Fundaciones' && f.severity === 'error'));
});

test('migración: cimiento + sobrecimiento con mismos ejes se fusionan en un elemento', () => {
  const legacy = [
    { id: 1, type: 'foundation', foundationType: 'cimiento', direction: 'x', fixedAxisId: 11, startAxisId: 1, endAxisId: 2, levelZ: 100, width: 400, depth: 600, libraryId: 7 },
    { id: 2, type: 'foundation', foundationType: 'sobrecimiento', direction: 'x', fixedAxisId: 11, startAxisId: 1, endAxisId: 2, levelZ: 100, width: 200, depth: 400, libraryId: 8 },
    { id: 3, type: 'wall' }
  ];
  const out = migrateFoundations(legacy);
  assert.equal(out.length, 2);
  const f = out[0];
  assert.equal(f.foundationType, 'corrida');
  assert.deepEqual(f.cimiento, { width: 400, depth: 600 });
  assert.deepEqual(f.sobrecimiento, { width: 200, height: 400, libraryId: 8 });
  assert.equal(f.width, undefined);
  // idempotente
  assert.deepEqual(migrateFoundations(out), out);
});

test('migración: sobrecimiento huérfano queda como corrida sin cimiento', () => {
  const out = migrateFoundations([
    { id: 9, type: 'foundation', foundationType: 'sobrecimiento', direction: 'y', fixedAxisId: 1, startAxisId: 11, endAxisId: 12, levelZ: 100, width: 200, depth: 400 }
  ]);
  assert.equal(out[0].foundationType, 'corrida');
  assert.equal(out[0].cimiento, null);
  assert.equal(out[0].sobrecimiento.height, 400);
});

test('migración de librería: la altura del sobrecimiento pasa de depth a height', () => {
  const out = migrateFoundationSections([
    { id: 1, itemType: 'sobrecimiento', name: 'SC 20/40', width: 200, depth: 400 },
    { id: 2, itemType: 'cimiento', name: 'C 40/60', width: 400, depth: 600 }
  ]);
  assert.equal(out[0].height, 400);
  assert.equal(out[0].depth, undefined);
  assert.deepEqual(out[1], { id: 2, itemType: 'cimiento', name: 'C 40/60', width: 400, depth: 600 });
});

test('modelos sin fundaciones no cambian al migrar', () => {
  const els = [{ id: 1, type: 'wall' }, { id: 2, type: 'beam' }];
  assert.equal(migrateFoundations(els), els);
});
