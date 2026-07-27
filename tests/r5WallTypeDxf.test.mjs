import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOsbFramingDxf } from '../src/core/exportOsbDxf.js';
import { generateOsbFramingSheets } from '../src/core/exportSheetsDxf.js';

const grid = {
  xAxes: [{ id: 'X0', position: 0, label: '1' }, { id: 'X1', position: 1200, label: '2' }],
  yAxes: [{ id: 'Y0', position: 0, label: 'A' }],
  zLevels: [{ id: 'Z0', elevation: 0, label: '0' }, { id: 'Z1', elevation: 2400, label: '1' }]
};

function modelFor(wallPatch = {}, gap = 5) {
  return {
    grid,
    projectParams: [],
    osbDefaults: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap },
    elements: [{
      id: 'W1',
      type: 'wall',
      direction: 'x',
      xStart: 'X0',
      xEnd: 'X1',
      yStart: 'Y0',
      yEnd: 'Y0',
      bottomZ: 'Z0',
      topZ: 'Z1',
      thickness: 90,
      openings: [],
      headers: [],
      studs: [{ offset: 0, zMin: 0, zMax: 2400, role: 'edge' }],
      osbCourses: [{
        zMin: 0,
        zMax: 2400,
        height: 2400,
        panels: [
          { start: 0, end: 600, width: 600 },
          { start: 600, end: 1200, width: 600 }
        ]
      }],
      ...wallPatch
    }]
  };
}

test('R5-C: DXF usa osbGap persistido por muro y conserva bytes legacy con fallback global', () => {
  const legacy = generateOsbFramingDxf(modelFor({}, 3));
  const explicitSame = generateOsbFramingDxf(modelFor({ osbGap: 3 }, 5));
  const explicitOther = generateOsbFramingDxf(modelFor({ osbGap: 8 }, 3));

  assert.equal(explicitSame, legacy, 'persistir el mismo gap efectivo no cambia los bytes');
  assert.notEqual(explicitOther, legacy, 'un gap efectivo distinto cambia la geometría emitida');
});

test('R5-C: lámina DXF OSB usa el mismo osbGap efectivo por muro', () => {
  const legacy = generateOsbFramingSheets(modelFor({}, 3));
  const explicitSame = generateOsbFramingSheets(modelFor({ osbGap: 3 }, 5));
  const explicitOther = generateOsbFramingSheets(modelFor({ osbGap: 8 }, 3));
  assert.equal(legacy.length, 1);
  assert.equal(explicitSame[0].content, legacy[0].content);
  assert.notEqual(explicitOther[0].content, legacy[0].content);
});
