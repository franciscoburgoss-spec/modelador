import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupEntriesByAxis, resolveWallEntries, resolveAxisGroups, axisGroupEntities,
  generateFramingDxf, translateEntities, axisFixedLabel
} from '../src/core/exportFramingDxf.js';
import { generateFramingSheets } from '../src/core/exportSheetsDxf.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';

// Grilla con 4 ejes X (0 / 3000 / 7000 / 12000) y 2 ejes Y — permite armar un eje con muros
// separados por huecos reales.
function baseGrid() {
  return {
    xAxes: [
      { id: 'x0', position: 0, label: '1' },
      { id: 'x1', position: 3000, label: '2' },
      { id: 'x2', position: 7000, label: '3' },
      { id: 'x3', position: 12000, label: '4' }
    ],
    yAxes: [{ id: 'y0', position: 0, label: 'A' }, { id: 'y1', position: 6000, label: 'B' }],
    zLevels: [
      { id: 'z0', elevation: 0, label: 'NPT' },
      { id: 'z1', elevation: 2400, label: 'CIELO GENERAL' },
      { id: 'z2', elevation: 3400, label: 'FRONTON' }
    ]
  };
}

function profiles() {
  return METALCON_PROFILES.map((p, i) => ({ ...p, id: 9000 + i }));
}

function makeWall(grid, prof, id, xStart, xEnd, yAxis = 'y0', topZ = 'z1', openings = []) {
  const stud = prof.find(p => p.code === '90CA085');
  const track = prof.find(p => p.code === '92C085');
  const def = {
    id, type: 'wall', direction: 'x',
    xStart, xEnd, yStart: yAxis, yEnd: yAxis,
    bottomZ: 'z0', topZ, thickness: 90, openings
  };
  const layout = computeStudLayout(def, grid, {}, {}, { spacing: 400 });
  return {
    ...def, studs: layout.studs, headers: layout.headers, studSpacing: 400,
    framingStudProfileId: stud?.id, framingTrackProfileId: track?.id
  };
}

/** Muros 1→2 y 3→4 en el eje A (hueco real de 3000 a 7000) + un muro suelto en el eje B. */
function modelTresMuros() {
  const grid = baseGrid();
  const prof = profiles();
  const elements = [
    makeWall(grid, prof, 'wA1', 'x0', 'x1'),
    makeWall(grid, prof, 'wA2', 'x2', 'x3'),
    makeWall(grid, prof, 'wB1', 'x0', 'x3', 'y1')
  ];
  return { grid, elements, library: { metalconProfiles: prof }, projectParams: [] };
}

test('sesión 18: los muros de un mismo eje forman UNA sola elevación (con los huecos reales)', () => {
  const model = modelTresMuros();
  const groups = groupEntriesByAxis(resolveWallEntries(model), model.grid);

  assert.equal(groups.length, 2, 'esperaba una elevación por eje (A y B), no una por muro');
  const ejeA = groups.find(g => g.axisLabel === 'A');
  assert.equal(ejeA.members.length, 2);
  assert.equal(ejeA.worldMin, 0);
  assert.equal(ejeA.worldMax, 12000);
  // los tramos conservan su coordenada de mundo: el 2do arranca en 7000, no pegado al 1ro
  const [m1, m2] = ejeA.members;
  assert.equal(m1.layout.worldMax, 3000);
  assert.equal(m2.layout.worldMin, 7000);
});

test('sesión 18: un eje con 3 muros independientes produce UNA elevación con los 3', () => {
  const grid = baseGrid();
  const prof = profiles();
  grid.xAxes.push({ id: 'x4', position: 16000, label: '5' });
  const model = {
    grid, projectParams: [], library: { metalconProfiles: prof },
    elements: [
      makeWall(grid, prof, 'w1', 'x0', 'x1'),
      makeWall(grid, prof, 'w2', 'x2', 'x3'),
      makeWall(grid, prof, 'w3', 'x3', 'x4')
    ]
  };
  const groups = resolveAxisGroups(model);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 3);
  assert.equal(groups[0].displayName, 'ELEVACION EJE A');

  // el DXF trae un solo título de eje y las 3 etiquetas de tramo (identificación de pieza)
  const dxf = generateFramingDxf(model);
  assert.equal(dxf.split('ELEVACION EJE A').length - 1, 1);
  assert.equal(dxf.split('@ A (').length - 1, 3);
});

test('sesión 18: la cota horizontal es una cadena continua a lo largo de todo el eje', () => {
  const model = modelTresMuros();
  const ejeA = resolveAxisGroups(model).find(g => g.axisLabel === 'A');
  const entities = axisGroupEntities(ejeA, model.grid, 0);

  // los textos de cota son los tramos de la cadena; deben sumar el largo total del eje en cada
  // una de las dos líneas de cota (parcial y entre ejes) — sin saltos ni tramos repetidos.
  const cotaLines = entities.filter(e => e.startsWith('0\nTEXT') && e.includes('\n8\nCOTAS\n'));
  const byY = new Map();
  for (const e of cotaLines) {
    const y = e.match(/\n20\n(-?[\d.]+)/)[1];
    const rot = e.match(/\n50\n([\d.]+)/)[1];
    if (rot !== '0.0') continue; // cotas verticales
    const val = Number(e.split('\n').pop());
    byY.set(y, (byY.get(y) || 0) + val);
  }
  assert.ok(byY.size >= 2, 'esperaba cota parcial + cota entre ejes');
  for (const [, total] of byY) {
    assert.equal(total, 12000, 'la cadena de cota debe cubrir el eje completo (0 a 12000)');
  }
});

test('sesión 18: la elevación exportada coincide con la vista en pantalla (mismos muros, mismo orden)', () => {
  const model = modelTresMuros();
  const ejeA = resolveAxisGroups(model).find(g => g.axisLabel === 'A');
  // la vista en pantalla del eje A muestra los muros que corren en X con yStart en ese eje
  // (core/elevation.js, categoría 1), ordenados por coordenada de mundo.
  const enPantalla = model.elements
    .filter(w => w.yStart === 'y0')
    .map(w => w.id);
  assert.deepEqual(ejeA.members.map(m => m.wall.id), enPantalla);
});

test('sesión 18: muros del mismo eje con distinta altura se dibujan a su cota real', () => {
  const grid = baseGrid();
  const prof = profiles();
  const model = {
    grid, projectParams: [], library: { metalconProfiles: prof },
    elements: [
      makeWall(grid, prof, 'wBajo', 'x0', 'x1', 'y0', 'z1'),  // corona en 2400
      makeWall(grid, prof, 'wAlto', 'x2', 'x3', 'y0', 'z2')   // corona en 3400
    ]
  };
  const group = resolveAxisGroups(model)[0];
  assert.equal(group.baseElevation, 0);
  assert.equal(group.topElevation, 3400);

  const entities = axisGroupEntities(group, grid, 0);
  const soleras = entities.filter(e => e.includes('\n8\nSOLERAS\n'));
  const maxY = Math.max(...soleras.flatMap(e => [...e.matchAll(/\n20\n(-?[\d.]+)/g)].map(m => parseFloat(m[1]))));
  assert.equal(maxY, 3400, 'la coronación del muro alto debe quedar en su cota real dentro del eje');
});

test('sesión 18/22: el cajetín lista los ejes en el título de lámina', () => {
  const model = modelTresMuros();
  const sheets = generateFramingSheets(model);
  assert.equal(sheets.length, 1);
  assert.match(sheets[0].content, /ELEVACIONES POR EJE - EJES A, B/);
});

test('translateEntities mueve puntos sin tocar alturas de texto ni radios', () => {
  const [linea] = translateEntities(['0\nLINE\n8\nEJES\n10\n100.00\n20\n50.00\n11\n200.00\n21\n50.00'], 10, -5);
  assert.match(linea, /\n10\n110\.00\n20\n45\.00\n11\n210\.00\n21\n45\.00/);

  const [txt] = translateEntities(['0\nTEXT\n8\nCOTAS\n10\n0.00\n20\n0.00\n40\n125.00\n50\n0.0\n1\nX'], 0, 300);
  assert.match(txt, /\n20\n300\.00/);
  assert.match(txt, /\n40\n125\.00/); // la altura de texto no se traslada
});

test('axisFixedLabel cae a la coordenada cruda si no hay eje de grilla', () => {
  const grid = baseGrid();
  assert.equal(axisFixedLabel(grid, true, 0), 'A');
  assert.equal(axisFixedLabel(grid, true, 3450), 'Y=3450');
  assert.equal(axisFixedLabel(grid, false, 3000), '2');
});
