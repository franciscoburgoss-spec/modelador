import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFramingSheets } from '../src/core/exportSheetsDxf.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';

function baseGrid(nAxes = 3, nYAxes = 2) {
  return {
    xAxes: Array.from({ length: nAxes }, (_, i) => ({ id: `x${i}`, position: i * 3000, label: String(i + 1) })),
    yAxes: Array.from({ length: nYAxes }, (_, i) => ({ id: `y${i}`, position: i * 4000, label: String.fromCharCode(65 + i) })),
    zLevels: [{ id: 'z0', elevation: 0, label: 'NPT (0 mm)' }, { id: 'z1', elevation: 2400, label: 'CIELO GENERAL' }]
  };
}

function loadedMetalconProfiles() {
  return METALCON_PROFILES.map((p, i) => ({ ...p, id: 9000 + i }));
}

function makeWallWithLayout(grid, id, xStart, xEnd, profiles, openings = [], yAxis = 'y0') {
  const stud = profiles.find(p => p.code === '90CA085');
  const track = profiles.find(p => p.code === '92C085');
  const wallDef = {
    id, type: 'wall', xStart, xEnd, yStart: yAxis, yEnd: yAxis, direction: 'x',
    bottomZ: 'z0', topZ: 'z1', thickness: 90, openings
  };
  const layout = computeStudLayout(wallDef, grid, {}, {}, { spacing: 400 });
  return {
    ...wallDef, studs: layout.studs, headers: layout.headers, studSpacing: 400,
    framingStudProfileId: stud?.id, framingTrackProfileId: track?.id
  };
}

test('exportSheetsDxf: sin muros con despiece generado → sin láminas', () => {
  const grid = baseGrid();
  const model = { grid, elements: [], library: { metalconProfiles: [] }, projectParams: [] };
  assert.deepEqual(generateFramingSheets(model), []);
});

test('exportSheetsDxf: un muro simple genera una lámina con nombre de archivo correcto', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const wall = makeWallWithLayout(grid, 'w1', 'x0', 'x2', profiles);
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };

  const sheets = generateFramingSheets(model);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].filename, 'tabiqueria_A1_lamina1.dxf');
  assert.match(sheets[0].content, /SECTION\n2\nENTITIES/);
  assert.match(sheets[0].content, /Lamina1/);
});

test('exportSheetsDxf: muros que no caben en una lámina generan una segunda (nunca superpuestas)', () => {
  // un muro por eje Y: 60 elevaciones de eje independientes (antes eran 60 muros del mismo eje,
  // que desde la sesión 18 colapsan en UNA sola elevación)
  const grid = baseGrid(2, 60);
  const profiles = loadedMetalconProfiles();
  const elements = [];
  for (let i = 0; i < 60; i++) {
    elements.push(makeWallWithLayout(grid, `w${i}`, 'x0', 'x1', profiles, [], `y${i}`));
  }
  const model = { grid, elements, library: { metalconProfiles: profiles }, projectParams: [] };

  const sheets = generateFramingSheets(model);
  assert.ok(sheets.length >= 2, `esperaba al menos 2 láminas, hubo ${sheets.length}`);
  const filenames = sheets.map(s => s.filename);
  assert.deepEqual(filenames, [...new Set(filenames)]); // nombres únicos, un archivo por lámina
});

test('exportSheetsDxf: cada lámina tiene exactamente un layout de espacio papel (nunca dos láminas en el mismo)', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const wall = makeWallWithLayout(grid, 'w1', 'x0', 'x2', profiles);
  const model = { grid, elements: [wall], library: { metalconProfiles: profiles }, projectParams: [] };
  const sheets = generateFramingSheets(model);

  // debe existir un solo objeto LAYOUT con nombre "Lamina1" (más el layout "Model" fijo de la plantilla)
  const layoutNames = [...sheets[0].content.matchAll(/100\nAcDbLayout\n\s*1\n\s*([^\n]+)/g)].map(m => m[1].trim());
  assert.deepEqual(layoutNames.sort(), ['Lamina1', 'Model']);
});

test('exportSheetsDxf: los viewports quedan a escala exacta 1:50 y no se superponen entre sí', () => {
  const grid = baseGrid();
  const profiles = loadedMetalconProfiles();
  const wallA = makeWallWithLayout(grid, 'wA', 'x0', 'x1', profiles, [
    { id: 'w1', axisType: 'x', type: 'window', position: 1500, width: 1200, height: 1200, sillHeight: 900 }
  ]);
  const wallB = makeWallWithLayout(grid, 'wB', 'x1', 'x2', profiles, [], 'y1'); // otro eje = otra elevación
  const model = { grid, elements: [wallA, wallB], library: { metalconProfiles: profiles }, projectParams: [] };
  const sheets = generateFramingSheets(model);
  const content = sheets[0].content;

  // extraer los VIEWPORT de contenido (69 != 1) con su width(40)/height(41)/view_height(45)
  const viewportBlocks = content.split('0\nVIEWPORT\n').slice(1);
  const contentVps = viewportBlocks
    .map(b => {
      const get = (code) => parseFloat(b.match(new RegExp(`\\n${code}\\n([\\d.]+)`))?.[1]);
      return { id: get(69), w: get(40), h: get(41), viewHeight: get(45), cx: get(10), cy: get(20) };
    })
    .filter(vp => vp.id !== 1);

  assert.equal(contentVps.length, 2);
  for (const vp of contentVps) {
    const scale = vp.h / vp.viewHeight;
    assert.ok(Math.abs(scale - 1 / 50) < 1e-6, `escala esperada 1:50, dio 1:${(1 / scale).toFixed(2)}`);
  }
  // no deben superponerse en papel (cajas [cx-w/2,cx+w/2] x [cy-h/2,cy+h/2])
  const [a, b] = contentVps;
  const overlapX = Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const overlapY = Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  assert.ok(overlapX <= 0 || overlapY <= 0, 'los viewports no deberían superponerse');
});
