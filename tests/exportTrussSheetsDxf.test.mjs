// tests/exportTrussSheetsDxf.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTrussSheets } from '../src/core/exportSheetsDxf.js';
import { computeRoofSystemLayout } from '../src/core/trussLayout.js';

// Mismo fixture que tests/trussLayout.test.mjs / tests/takeoff.test.mjs.
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

const modelWithSystems = (nSystems = 1) => {
  const { grid, elements } = systemFixture();
  const config = {
    wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, gutterNotchWidth: 300,
    trussSpacing: 1200, postSpacing: 600, purlinProfile: '35OMA085', purlinSpacing: 800,
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' }
  };
  const layout = computeRoofSystemLayout(config, grid, {}, {}, elements);
  const roofSystems = Array.from({ length: nSystems }, (_, i) => ({
    id: 100 + i, ...config,
    span: layout.span, supportElevation: layout.supportElevation, runAxis: layout.runAxis,
    spanDir: layout.spanDir, trussPositions: layout.trussPositions, trussGeometry: layout.trussGeometry
  }));
  return {
    grid, elements, roofSystems,
    library: { metalconProfiles: [
      { code: '90CA085', H: 90, B: 38 }, { code: '40CA085', H: 40, B: 40 },
      { code: '60CA085', H: 60, B: 38 }, { code: '35OMA085', H: 35, B: 40 }
    ] },
    projectParams: []
  };
};

test('exportSheetsDxf (cerchas): sin sistemas resueltos → sin láminas', () => {
  const { grid, elements } = systemFixture();
  const model = { grid, elements, roofSystems: [], library: { metalconProfiles: [] }, projectParams: [] };
  assert.deepEqual(generateTrussSheets(model), []);
});

test('exportSheetsDxf (cerchas): un sistema genera una lámina con nombre correcto y contenido de cercha', () => {
  const model = modelWithSystems(1);
  const sheets = generateTrussSheets(model);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].filename, 'cerchas_A1_lamina1.dxf');
  assert.match(sheets[0].content, /SECTION\n2\nENTITIES/);
  assert.match(sheets[0].content, /CERCHA TIPO - SISTEMA 1/);
  assert.match(sheets[0].content, /Lamina1/);
});

test('exportSheetsDxf (cerchas): leyenda variant "truss" incluye las capas propias de cercha', () => {
  const model = modelWithSystems(1);
  const sheets = generateTrussSheets(model);
  const content = sheets[0].content;
  assert.match(content, /CERCHA-CUERDAS/);
  assert.match(content, /CERCHA-ENTRAMADO/);
  assert.match(content, /COSTANERAS/);
  assert.match(content, /MURO-REF/);
});

test('exportSheetsDxf (cerchas): dos sistemas -> dos vistas D1/D2 en el cuadro de vistas', () => {
  const model = modelWithSystems(2);
  const sheets = generateTrussSheets(model);
  assert.equal(sheets.length, 1);
  const content = sheets[0].content;
  assert.match(content, /D1 = SISTEMA 1/);
  assert.match(content, /D2 = SISTEMA 2/);
  assert.match(content, /CERCHA TIPO - SISTEMA 1/);
  assert.match(content, /CERCHA TIPO - SISTEMA 2/);
});
