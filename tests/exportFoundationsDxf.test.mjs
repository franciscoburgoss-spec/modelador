// tests/exportFoundationsDxf.test.mjs — Sesión 13 (lámina A1 de fundaciones)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFoundationSheets, resolveFoundationTypes, resolveFoundationSheetEntries
} from '../src/core/exportFoundationsDxf.js';

// Mismo fixture de la sesión 11: cimiento corrido en L (5 m + 4 m) + un poyo aislado.
const grid = {
  xAxes: [{ id: 1, position: 0, label: 'A' }, { id: 2, position: 5000, label: 'B' }],
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 4000, label: '2' }],
  zLevels: [{ id: 100, elevation: 0, label: 'NPT' }]
};
const corridaX = {
  id: 1, type: 'foundation', foundationType: 'corrida', direction: 'x',
  fixedAxisId: 11, startAxisId: 1, endAxisId: 2, levelZ: 100, topOffset: 0,
  cimiento: { width: 400, depth: 600 },
  sobrecimiento: { width: 200, height: 400, libraryId: null },
  libraryId: null
};
const corridaY = { ...corridaX, id: 2, direction: 'y', fixedAxisId: 1, startAxisId: 11, endAxisId: 12 };
const poyo = {
  id: 3, type: 'foundation', foundationType: 'aislada',
  axisXId: 2, axisYId: 12, levelZ: 100, topOffset: 0,
  aislada: { lengthX: 1000, lengthY: 1200, depth: 500 },
  columnId: null, libraryId: null
};
const model = () => ({
  grid, elements: [corridaX, corridaY, poyo],
  library: { foundationSections: [] }, projectParams: [], roofSystems: []
});

test('tipifica: dos corridas iguales comparten C1, el poyo es Z1', () => {
  const { items, types } = resolveFoundationTypes(model());
  assert.deepEqual(items.map(i => i.tag), ['C1', 'C1', 'Z1']);
  assert.deepEqual(types.map(t => t.tag), ['C1', 'Z1']);
  const c1 = types[0];
  assert.equal(c1.count, 2);
  assert.equal(c1.totalLength, 9000);            // 5 m + 4 m
  assert.equal(c1.dimensions, 'CIM 400x600 / SC 200x400');
  // volumen: (0.4x0.6 + 0.2x0.4) x 9 m = 2.88 m3
  assert.equal(c1.volume, (400 * 600 + 200 * 400) * 9000);
  const z1 = types[1];
  assert.equal(z1.count, 1);
  assert.equal(z1.totalLength, 0);
  assert.equal(z1.dimensions, '1000x1200x500');
  assert.equal(z1.volume, 1000 * 1200 * 500);
});

test('secciones distintas generan tipos distintos', () => {
  const otra = { ...corridaY, id: 4, cimiento: { width: 500, depth: 700 } };
  const { types } = resolveFoundationTypes({ ...model(), elements: [corridaX, otra, poyo] });
  assert.deepEqual(types.map(t => t.tag), ['C1', 'C2', 'Z1']);
});

test('entries: planta + un corte por tipo + cuadro, todos con extent válido', () => {
  const entries = resolveFoundationSheetEntries(model());
  assert.deepEqual(entries.map(e => e.kind), ['plan', 'section', 'section', 'schedule']);
  for (const e of entries) {
    assert.ok(e.extent.xMax > e.extent.xMin, `extent x de ${e.kind}`);
    assert.ok(e.extent.yMax > e.extent.yMin, `extent y de ${e.kind}`);
  }
  // la planta cubre la huella real (5000 x 4000 + medios anchos) más ejes y globos
  const plan = entries[0];
  assert.equal(plan.bounds.xMin, -200);   // eje A menos medio ancho del cimiento en Y
  assert.equal(plan.bounds.xMax, 5500);   // eje B + medio largo del poyo (1000/2)
  assert.equal(plan.bounds.yMin, -200);
  assert.equal(plan.bounds.yMax, 4600);   // eje 2 + medio ancho del poyo (1200/2)
});

test('lámina generada: sin fundaciones no hay láminas', () => {
  assert.deepEqual(generateFoundationSheets({ ...model(), elements: [] }), []);
});

test('lámina generada: contenido, cotas del corte tipo y solo ASCII', () => {
  const sheets = generateFoundationSheets(model());
  assert.ok(sheets.length >= 1);
  assert.equal(sheets[0].filename, 'fundaciones_A1_lamina1.dxf');
  const all = sheets.map(s => s.content).join('\n');

  assert.ok(all.includes('PLANTA DE FUNDACIONES'));
  assert.ok(all.includes('CORTE TIPO C1'));
  assert.ok(all.includes('CORTE TIPO Z1'));
  assert.ok(all.includes('CUADRO DE FUNDACIONES'));
  assert.ok(all.includes('CIM 400x600 / SC 200x400'));
  assert.ok(all.includes('SELLO -1.00'));           // 0 - 400 - 600 = -1000 mm
  assert.ok(all.includes('TOTAL HORMIGON'));

  // cotas del corte C1: anchos 400 (cimiento) y 200 (sobrecimiento), alturas 400 y 600
  const cotas = all.split('\n').map((l, i, a) => (a[i - 1] === '1' ? l : null)).filter(Boolean);
  for (const v of ['400', '200', '600']) assert.ok(cotas.includes(v), `falta la cota ${v}`);

  // texto DXF solo ASCII imprimible
  assert.equal(/[^\x09\x0A\x0D\x20-\x7E]/.test(all), false);
  // estructura de lámina A1 (plantilla AC1015 intacta)
  assert.ok(all.includes('AC1015'));
  assert.ok(all.includes('CUADRO'));                // etiqueta de viewport en el cajetín
});

// Sesión 16 — Bug 1: orientación de planta. Con ejes Y asimétricos, el orden de los globos de
// eje Y en el DXF debe salir invertido respecto del orden en pantalla (mundo Y-abajo, DXF Y-arriba).
test('planta de fundaciones: orden de globos de eje Y invertido (mundo Y-abajo → papel Y-arriba)', () => {
  const grid2 = {
    xAxes: [{ id: 1, position: 0, label: 'A' }],
    yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 1000, label: '2' }, { id: 13, position: 6000, label: '3' }],
    zLevels: [{ id: 100, elevation: 0, label: 'NPT' }]
  };
  const corridaLong = {
    id: 10, type: 'foundation', foundationType: 'corrida', direction: 'y',
    fixedAxisId: 1, startAxisId: 11, endAxisId: 13, levelZ: 100, topOffset: 0,
    cimiento: { width: 400, depth: 600 }, sobrecimiento: { width: 200, height: 400, libraryId: null },
    libraryId: null
  };
  const m = { grid: grid2, elements: [corridaLong], library: { foundationSections: [] }, projectParams: [], roofSystems: [] };
  const content = generateFoundationSheets(m).map(s => s.content).join('\n');
  const tokens = content.split('\n');
  const ys = [];
  let cur = null;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const [code, value] = [tokens[i], tokens[i + 1]];
    if (code === '0') { cur = { type: value, fields: {} }; continue; }
    if (!cur) continue;
    cur.fields[code] = value;
    if (cur.type === 'CIRCLE' && code === '40') { // último campo de un CIRCLE: cerramos y evaluamos
      if (cur.fields['8'] === 'ETIQUETAS' && Math.abs(parseFloat(cur.fields['10']) - -2600) < 1) {
        ys.push(parseFloat(cur.fields['20']));
      }
      cur = null;
    }
  }
  assert.equal(ys.length, 3);
  assert.ok(ys[0] > ys[1] && ys[1] > ys[2], `esperaba orden descendente en papel, obtuve ${ys}`);
});
