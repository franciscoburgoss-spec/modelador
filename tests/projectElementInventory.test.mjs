import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectElementInventory,
  filterProjectElementRows
} from '../src/core/projectElementInventory.js';

const model = {
  grid: {
    xAxes: [
      { id: 'X0', label: 'X0', position: 0 },
      { id: 'X1', label: 'X1', position: 4000 }
    ],
    yAxes: [{ id: 'Y0', label: 'Y0', position: 0 }],
    zLevels: [
      { id: 'Z0', label: 'N0', elevation: 0 },
      { id: 'Z1', label: 'N1', elevation: 2400 }
    ]
  },
  library: {
    wallSections: [{ id: 'WS', name: 'Muro 90' }],
    columnSections: [{ id: 'CS', name: 'Pilar 90' }],
    beamSections: [],
    openingTemplates: [{ id: 'OT', name: 'Ventana 1000', itemType: 'window' }],
    foundationSections: []
  },
  wallTypes: [{
    id: 'T1',
    name: 'Exterior',
    role: 'MP1'
  }],
  elements: [
    {
      id: 'W1',
      type: 'wall',
      direction: 'x',
      xStart: 'X0',
      xEnd: 'X1',
      yStart: 'Y0',
      yEnd: 'Y0',
      bottomZ: 'Z0',
      topZ: 'Z1',
      libraryId: 'WS',
      studs: [],
      studsStale: true,
      openings: [{
        id: 'O1',
        type: 'window',
        libraryId: 'OT',
        position: 1000,
        width: 1000,
        height: 1200,
        sillHeight: 900
      }]
    },
    {
      id: 'W2',
      type: 'wall',
      wallTypeId: 'T1',
      direction: 'x',
      xStart: 'X0',
      xEnd: 'X1',
      yStart: 'Y0',
      yEnd: 'Y0',
      bottomZ: 'Z0',
      topZ: 'Z1',
      libraryId: 'WS',
      openings: []
    },
    {
      id: 'C1',
      type: 'column',
      axisXId: 'X0',
      axisYId: 'Y0',
      bottomZ: 'Z0',
      topZ: 'Z1',
      libraryId: 'CS'
    }
  ]
};

test('SPEC-R5-D: inventario aplana elementos y vanos con autoridad y estado explícitos', () => {
  const rows = buildProjectElementInventory(model);

  assert.deepEqual(rows.map((row) => row.key), [
    'element:W1',
    'opening:W1:O1',
    'element:W2',
    'element:C1'
  ]);
  assert.deepEqual(
    rows.map(({ id, parentId, type }) => ({ id, parentId, type })),
    [
      { id: 'W1', parentId: null, type: 'wall' },
      { id: 'O1', parentId: 'W1', type: 'window' },
      { id: 'W2', parentId: null, type: 'wall' },
      { id: 'C1', parentId: null, type: 'column' }
    ]
  );

  const legacy = rows[0];
  assert.equal(legacy.wallTypeLabel, 'Sin tipo / rol');
  assert.equal(legacy.status, 'untyped-wall');
  assert.deepEqual(legacy.statuses, ['untyped-wall', 'stale-framing']);
  assert.equal(legacy.levelLabel, 'N0 → N1');
  assert.equal(legacy.sectionLabel, 'Muro 90');

  const typed = rows[2];
  assert.equal(typed.wallTypeLabel, 'Exterior · MP1');
  assert.equal(typed.status, 'complete');

  const opening = rows[1];
  assert.equal(opening.parentId, 'W1');
  assert.equal(opening.levelLabel, 'N0 → N1');
  assert.equal(opening.sectionLabel, 'Ventana 1000');
});

test('SPEC-R5-D: búsqueda y filtros son combinables y no mutan filas', () => {
  const rows = buildProjectElementInventory(model);
  const snapshot = structuredClone(rows);

  assert.deepEqual(
    filterProjectElementRows(rows, { status: 'untyped-wall' }).map((row) => row.id),
    ['W1']
  );
  assert.deepEqual(
    filterProjectElementRows(rows, { type: 'wall', levelId: 'Z1' }).map((row) => row.id),
    ['W1', 'W2']
  );
  assert.deepEqual(
    filterProjectElementRows(rows, { query: 'ventana 1000' }).map((row) => row.id),
    ['O1']
  );
  assert.deepEqual(rows, snapshot);
});
