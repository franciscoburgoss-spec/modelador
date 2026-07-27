import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { modulateAllWallsMetalcon, modulateAllWallsFull } from '../src/core/batchModulation.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { analyzeWallJunctions } from '../src/core/wallJunctions.js';

const grid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X14', position: 1400 },
    { id: 'X18', position: 1800 },
    { id: 'X2', position: 2000 },
    { id: 'X4', position: 4000 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y2', position: 2000 },
    { id: 'Y4', position: 4000 },
    { id: 'Y6', position: 6000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 2400 }
  ]
};

const axisId = (axis, value) => `${axis.toUpperCase()}${String(value / 1000).replace('.', '')}`;

function wall(id, direction, start, end, overrides = {}) {
  return {
    id,
    type: 'wall',
    direction,
    xStart: axisId('x', start[0]),
    xEnd: axisId('x', end[0]),
    yStart: axisId('y', start[1]),
    yEnd: axisId('y', end[1]),
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    openings: [],
    ...overrides
  };
}

function model(elements) {
  return {
    grid,
    projectParams: [],
    elements,
    library: { metalconProfiles: [] },
    osbDefaults: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap: 5 }
  };
}

const defaults = {
  spacing: 400,
  studProfileId: 'C90',
  trackProfileId: 'U90'
};

function patchesByWall(result) {
  return new Map(result.patches.map(({ wallId, patch }) => [wallId, patch]));
}

function verticalAt(studs, offset) {
  return studs.filter((piece) => (
    piece.role !== 'nogging' && Number.isFinite(piece.offset)
    && Math.abs(piece.offset - offset) < 1
  ));
}

test('R6-B: una L simple genera los dos corner contiguos y ningún backup', () => {
  const horizontal = wall('horizontal', 'x', [0, 0], [4000, 0]);
  const vertical = wall('vertical', 'y', [0, 0], [0, 2000]);
  const result = modulateAllWallsMetalcon(model([vertical, horizontal]), defaults);
  const patches = patchesByWall(result);

  assert.equal(result.blocked.length, 0);
  assert.equal(patches.size, 2);
  assert.deepEqual(verticalAt(patches.get('horizontal').studs, 0).map((piece) => piece.role), ['corner']);
  assert.deepEqual(verticalAt(patches.get('vertical').studs, 0).map((piece) => piece.role), ['corner']);
  assert.equal(
    result.patches.flatMap(({ patch }) => patch.studs).some((piece) => piece.role === 'backup'),
    false
  );
});

test('R6-B: una T reclasifica un stud anfitrión existente sin duplicarlo', () => {
  const host = wall('host', 'x', [0, 0], [4000, 0]);
  const branch = wall('branch', 'y', [2000, 0], [2000, 2000]);
  const result = modulateAllWallsMetalcon(model([host, branch]), defaults);
  const patches = patchesByWall(result);

  assert.equal(result.blocked.length, 0);
  assert.deepEqual(verticalAt(patches.get('host').studs, 2000).map((piece) => piece.role), ['corner']);
  assert.deepEqual(verticalAt(patches.get('branch').studs, 0).map((piece) => piece.role), ['corner']);
});

test('R6-B: una T agrega el corner anfitrión ausente en el offset exacto', () => {
  const host = wall('host', 'x', [0, 0], [4000, 0]);
  const branch = wall('branch', 'y', [1800, 0], [1800, 2000]);
  const result = modulateAllWallsMetalcon(model([branch, host]), defaults);
  const patches = patchesByWall(result);

  assert.equal(result.blocked.length, 0);
  assert.deepEqual(verticalAt(patches.get('host').studs, 1800).map((piece) => piece.role), ['corner']);
});

test('R6-B: una llegada T dentro de vano bloquea todo el batch con ambos wallIds', () => {
  const host = wall('host', 'x', [0, 0], [4000, 0], {
    openings: [{
      id: 'window',
      axisType: 'x',
      type: 'window',
      position: 1800,
      width: 800,
      height: 1000,
      sillHeight: 900
    }]
  });
  const branch = wall('branch', 'y', [1800, 0], [1800, 2000]);
  const independent = wall('independent', 'x', [0, 4000], [4000, 4000]);
  const result = modulateAllWallsMetalcon(model([independent, host, branch]), defaults);

  assert.equal(result.patches.length, 0, 'no puede quedar el muro independiente aplicado parcialmente');
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].reason, 't-support-in-opening');
  assert.deepEqual(result.blocked[0].wallIds, ['branch', 'host']);
});

test('R6-B: una llegada T sobre jamba/piezas incompatibles también bloquea atómicamente', () => {
  const host = wall('host', 'x', [0, 0], [4000, 0], {
    openings: [{
      id: 'window',
      axisType: 'x',
      type: 'window',
      position: 1800,
      width: 800,
      height: 1000,
      sillHeight: 900
    }]
  });
  const branch = wall('branch', 'y', [1400, 0], [1400, 2000]);
  const result = modulateAllWallsMetalcon(model([host, branch]), defaults);

  assert.equal(result.patches.length, 0);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].reason, 't-support-incompatible-piece');
  assert.deepEqual(result.blocked[0].wallIds, ['branch', 'host']);
});

test('R6-B: geometría ambigua bloquea metalcon y el combinado antes de producir patches', () => {
  const duplicateA = wall('a', 'x', [0, 0], [4000, 0]);
  const duplicateB = wall('b', 'x', [0, 0], [2000, 0]);
  const branch = wall('branch', 'y', [0, 0], [0, 2000]);
  const source = model([branch, duplicateB, duplicateA]);
  const topology = analyzeWallJunctions(source);
  const metalcon = modulateAllWallsMetalcon(source, defaults, { topology });
  const full = modulateAllWallsFull(source, {
    metalcon: defaults,
    osb: source.osbDefaults
  }, { topology });

  assert.equal(metalcon.patches.length, 0);
  assert.equal(full.patches.length, 0);
  assert.equal(metalcon.blocked[0].reason, 'overlapping-rays');
  assert.deepEqual(metalcon.blocked[0].wallIds, ['a', 'b', 'branch']);
  assert.equal(metalcon.topology, topology);
  assert.equal(full.topology, topology);
});

test('R6-B: casa-L regenera cero backup y respalda las 26 T directas', async () => {
  const casaL = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const result = modulateAllWallsMetalcon(casaL, casaL.metalconDefaults || {});
  const patches = patchesByWall(result);
  const directT = result.topology.nodes.filter((node) => (
    node.type === 'T' && node.participants.some((participant) => participant.position === 'body')
  ));

  assert.equal(result.blocked.length, 0);
  assert.equal(result.skipped.length, 0);
  assert.equal(patches.size, 45);
  assert.equal(directT.length, 26);
  assert.equal(
    result.patches.flatMap(({ patch }) => patch.studs)
      .filter((piece) => piece.role === 'backup').length,
    0
  );
  for (const node of directT) {
    for (const host of node.participants.filter((participant) => participant.position === 'body')) {
      assert.deepEqual(
        verticalAt(patches.get(host.wallId).studs, host.offset).map((piece) => piece.role),
        ['corner'],
        `respaldo T faltante en muro ${host.wallId} offset ${host.offset}`
      );
    }
  }

  const regenerated = {
    ...casaL,
    elements: casaL.elements.map((element) => (
      patches.has(element.id) ? { ...element, ...patches.get(element.id) } : element
    ))
  };
  const takeoff = computeTakeoff(regenerated);
  assert.ok(takeoff.totalsByType.framing.count > 0);
  assert.ok(takeoff.totalsByType.framing.ml > 0);
});
