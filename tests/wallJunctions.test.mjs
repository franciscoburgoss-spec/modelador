import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  resolveWallGeometry,
  resolveWallLocalFrame,
  wallOffsetToWorldPoint
} from '../src/core/elementGeometry.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { computeOsbPanelLayout } from '../src/core/osbModulation.js';
import {
  analyzeWallJunctions,
  compareStableWallIds,
  getWallJunctionView,
  selectLappingWall
} from '../src/core/wallJunctions.js';

const GRID = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X1', position: 2000 },
    { id: 'X2', position: 4000 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y1', position: 2000 },
    { id: 'Y2', position: 4000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 2400 },
    { id: 'Z2', elevation: 3000 },
    { id: 'Z3', elevation: 4800 }
  ]
};

function wall(id, direction, start, end, bottomZ = 'Z0', topZ = 'Z1', overrides = {}) {
  const [xStart, yStart] = start;
  const [xEnd, yEnd] = end;
  const axisId = (axis, position) => `${axis.toUpperCase()}${position / 2000}`;
  return {
    id,
    type: 'wall',
    direction,
    xStart: axisId('x', xStart),
    xEnd: axisId('x', xEnd),
    yStart: axisId('y', yStart),
    yEnd: axisId('y', yEnd),
    bottomZ,
    topZ,
    thickness: 90,
    openings: [],
    ...overrides
  };
}

function model(elements, grid = GRID) {
  return { projectParams: [], grid, elements };
}

function nodeAt(topology, type, x, y) {
  return topology.nodes.find((node) => (
    node.type === type && node.point.x === x && node.point.y === y
  ));
}

test('R6-A: el frame local normaliza X/Y y wallOffsetToWorldPoint acepta offsets extendidos', () => {
  const xForward = wall('xf', 'x', [0, 0], [4000, 0]);
  const xReverse = wall('xr', 'x', [4000, 0], [0, 0]);
  const yForward = wall('yf', 'y', [0, 0], [0, 4000]);
  const yReverse = wall('yr', 'y', [0, 4000], [0, 0]);

  const frame = (candidate) => {
    const geo = resolveWallGeometry(candidate, GRID);
    return {
      frame: resolveWallLocalFrame(candidate, geo),
      at: (offset) => wallOffsetToWorldPoint(candidate, geo, offset)
    };
  };

  assert.deepEqual(frame(xForward).frame, {
    runAxis: 'x',
    origin: { x: 0, y: 0 },
    end: { x: 4000, y: 0 },
    length: 4000,
    declaredStartSide: 'start'
  });
  assert.deepEqual(frame(xReverse).frame, {
    runAxis: 'x',
    origin: { x: 0, y: 0 },
    end: { x: 4000, y: 0 },
    length: 4000,
    declaredStartSide: 'end'
  });
  assert.deepEqual(frame(yForward).frame.origin, { x: 0, y: 0 });
  assert.equal(frame(yForward).frame.declaredStartSide, 'start');
  assert.deepEqual(frame(yReverse).frame.origin, { x: 0, y: 0 });
  assert.equal(frame(yReverse).frame.declaredStartSide, 'end');
  assert.deepEqual(frame(xForward).at(1000), frame(xReverse).at(1000));
  assert.deepEqual(frame(yForward).at(1000), frame(yReverse).at(1000));
  assert.deepEqual(frame(xReverse).at(-45), { x: -45, y: 0 });
  assert.deepEqual(frame(yReverse).at(4045), { x: 0, y: 4045 });
});

test('R6-A: invertir un muro con vano conserva studs, headers, OSB y posiciones mundo', () => {
  const opening = {
    id: 'window',
    axisType: 'x',
    type: 'window',
    position: 2000,
    width: 800,
    height: 1000,
    sillHeight: 900
  };
  const forward = wall('same', 'x', [0, 0], [4000, 0], 'Z0', 'Z1', { openings: [opening] });
  const reverse = wall('same', 'x', [4000, 0], [0, 0], 'Z0', 'Z1', { openings: [opening] });
  const forwardStuds = computeStudLayout(forward, GRID, {}, {}, { spacing: 400 });
  const reverseStuds = computeStudLayout(reverse, GRID, {}, {}, { spacing: 400 });
  const forwardOsb = computeOsbPanelLayout(
    forward, GRID, {}, {}, forwardStuds.studs, { panelWidth: 1220, minPanelWidth: 200 }
  );
  const reverseOsb = computeOsbPanelLayout(
    reverse, GRID, {}, {}, reverseStuds.studs, { panelWidth: 1220, minPanelWidth: 200 }
  );

  assert.deepEqual(reverseStuds.studs, forwardStuds.studs);
  assert.deepEqual(reverseStuds.headers, forwardStuds.headers);
  assert.deepEqual(reverseOsb, forwardOsb);
  const forwardGeo = resolveWallGeometry(forward, GRID);
  const reverseGeo = resolveWallGeometry(reverse, GRID);
  for (const piece of forwardStuds.studs) {
    assert.deepEqual(
      wallOffsetToWorldPoint(reverse, reverseGeo, piece.offset),
      wallOffsetToWorldPoint(forward, forwardGeo, piece.offset)
    );
  }
});

test('R6-A: clasifica L y usa start/end del frame, no el orden declarado', () => {
  const horizontalReverse = wall(10, 'x', [4000, 0], [0, 0]);
  const vertical = wall(2, 'y', [0, 0], [0, 2000]);
  const topology = analyzeWallJunctions(model([horizontalReverse, vertical]));
  const junction = nodeAt(topology, 'L', 0, 0);

  assert.ok(junction);
  assert.equal(junction.lap.wallId, 10, 'el muro más largo debe lapear');
  assert.deepEqual(junction.participants.map((entry) => entry.position), ['start', 'start']);
  const horizontalView = getWallJunctionView(topology, 10);
  assert.equal(horizontalView.start.tipo, 'L');
  assert.equal(horizontalView.start.wallId, 2);
  assert.equal(horizontalView.end, null);
});

test('R6-A: una T extremo-cuerpo informa el offset interior al anfitrión', () => {
  const host = wall('host', 'x', [0, 0], [4000, 0]);
  const branch = wall('branch', 'y', [2000, 0], [2000, 2000]);
  const topology = analyzeWallJunctions(model([host, branch]));
  const junction = nodeAt(topology, 'T', 2000, 0);

  assert.ok(junction);
  assert.deepEqual(
    junction.participants.map((entry) => [entry.wallId, entry.position, entry.offset]),
    [['branch', 'start', 0], ['host', 'body', 2000]]
  );
  assert.deepEqual(getWallJunctionView(topology, 'branch').start.matches, [{
    wallId: 'host',
    tipo: 'T',
    nodeId: junction.id
  }]);
  assert.deepEqual(getWallJunctionView(topology, 'host').interior, [{
    tipo: 'T',
    wallId: 'branch',
    offset: 2000,
    nodeId: junction.id
  }]);
});

test('R6-A: una T sobre anfitrión dividido conserva ambos matches', () => {
  const left = wall('left', 'x', [0, 0], [2000, 0]);
  const right = wall('right', 'x', [2000, 0], [4000, 0]);
  const branch = wall('branch', 'y', [2000, 0], [2000, 2000]);
  const topology = analyzeWallJunctions(model([right, branch, left]));
  const junction = nodeAt(topology, 'T', 2000, 0);

  assert.ok(junction);
  assert.deepEqual(
    getWallJunctionView(topology, 'branch').start.matches.map((match) => match.wallId),
    ['left', 'right']
  );
});

test('R6-A: reconoce straight, terminal, X y ambiguous sin promoverlos a L/T', () => {
  const straight = analyzeWallJunctions(model([
    wall('left', 'x', [0, 0], [2000, 0]),
    wall('right', 'x', [2000, 0], [4000, 0])
  ]));
  assert.ok(nodeAt(straight, 'straight', 2000, 0));
  assert.ok(nodeAt(straight, 'terminal', 0, 0));

  const cross = analyzeWallJunctions(model([
    wall('west', 'x', [0, 2000], [2000, 2000]),
    wall('east', 'x', [2000, 2000], [4000, 2000]),
    wall('south', 'y', [2000, 0], [2000, 2000]),
    wall('north', 'y', [2000, 2000], [2000, 4000])
  ]));
  assert.ok(nodeAt(cross, 'X', 2000, 2000));

  const duplicate = analyzeWallJunctions(model([
    wall('a', 'x', [0, 0], [4000, 0]),
    wall('b', 'x', [0, 0], [2000, 0])
  ]));
  const ambiguous = nodeAt(duplicate, 'ambiguous', 0, 0);
  assert.ok(ambiguous);
  assert.equal(ambiguous.reason, 'overlapping-rays');
});

test('R6-A: las bandas Z separan muros disjuntos y conservan traslape parcial', () => {
  const disjoint = analyzeWallJunctions(model([
    wall('low', 'x', [0, 0], [4000, 0], 'Z0', 'Z1'),
    wall('high', 'y', [0, 0], [0, 2000], 'Z2', 'Z3')
  ]));
  assert.equal(disjoint.nodes.some((node) => node.type === 'L'), false);

  const partial = analyzeWallJunctions(model([
    wall('full', 'x', [0, 0], [4000, 0], 'Z0', 'Z3'),
    wall('low', 'y', [0, 0], [0, 2000], 'Z0', 'Z1')
  ]));
  const atOrigin = partial.nodes.filter((node) => node.point.x === 0 && node.point.y === 0);
  assert.deepEqual(
    atOrigin.map((node) => [node.zMin, node.zMax, node.type]),
    [[0, 2400, 'L'], [2400, 4800, 'terminal']]
  );
});

test('R6-A: tolerancia y salida completa son invariantes al orden de elementos', () => {
  const closeGrid = {
    ...GRID,
    xAxes: [...GRID.xAxes, { id: 'X_NEAR', position: 2004 }]
  };
  const elements = [
    wall('host', 'x', [0, 0], [4000, 0]),
    {
      ...wall('branch', 'y', [2000, 0], [2000, 2000]),
      xStart: 'X_NEAR',
      xEnd: 'X_NEAR'
    },
    wall('split', 'x', [2000, 0], [4000, 0])
  ];
  const forward = analyzeWallJunctions(model(elements, closeGrid));
  const reverse = analyzeWallJunctions(model([...elements].reverse(), closeGrid));

  assert.deepEqual(reverse, forward);
  assert.ok(forward.nodes.some((node) => node.point.x >= 2000 && node.point.x <= 2004));
});

test('R6-A: prioridad estable usa entero decimal y luego código Unicode sin depender de locale', () => {
  assert.ok(compareStableWallIds('2', 10) < 0);
  assert.ok(compareStableWallIds('-10', '-2') < 0);
  assert.ok(compareStableWallIds('wall-A', 'wall-B') < 0);
  assert.equal(
    selectLappingWall([
      { wallId: '10', length: 4000, absDx: 4000 },
      { wallId: '2', length: 4000, absDx: 4000 }
    ]).wallId,
    '2'
  );
  assert.equal(
    selectLappingWall([
      { wallId: 'vertical', length: 4000, absDx: 0 },
      { wallId: 'horizontal', length: 4000, absDx: 4000 }
    ]).wallId,
    'horizontal'
  );
  assert.equal(
    selectLappingWall([
      { wallId: 'long', length: 4001, absDx: 0 },
      { wallId: 'short', length: 4000, absDx: 4000 }
    ]).wallId,
    'long'
  );
  assert.equal(
    selectLappingWall([
      { wallId: 'uuid-a', length: 4000, absDx: 4000 },
      { wallId: 'uuid-b', length: 4000, absDx: 4000 }
    ]).wallId,
    'uuid-a'
  );
});

test('R6-A: prioridades L contradictorias entre bandas quedan explícitamente ambiguous', () => {
  const horizontal = wall('shared', 'x', [0, 0], [2000, 0], 'Z0', 'Z3');
  const lowerShort = wall('lower', 'y', [0, 0], [0, 2000], 'Z0', 'Z1');
  const upperLong = wall('upper', 'y', [0, 0], [0, 4000], 'Z1', 'Z3');
  const topology = analyzeWallJunctions(model([upperLong, horizontal, lowerShort]));
  const view = getWallJunctionView(topology, 'shared');

  assert.equal(view.start.tipo, 'L');
  assert.equal(view.start.lapState, 'ambiguous');
  assert.deepEqual(view.start.matches.map((match) => match.wallId), ['lower', 'upper']);
  assert.deepEqual(topology.issues.map((issue) => issue.type), ['ambiguous-lap']);
});

test('R6-A: fixture dedicado cubre muro invertido, L y T', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('./fixtures/r6-wall-junctions.json', import.meta.url),
    'utf8'
  ));
  const topology = analyzeWallJunctions(fixture);

  assert.equal(getWallJunctionView(topology, 10).start.tipo, 'L');
  assert.equal(getWallJunctionView(topology, 'host').interior[0].offset, 2000);
  assert.deepEqual(
    topology.nodes.filter((node) => node.type === 'L' || node.type === 'T')
      .map((node) => node.type),
    ['L', 'T']
  );
});

test('R6-A: casa-L reproduce 80 nodos/bandas y el diagnóstico L/T', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const topology = analyzeWallJunctions(fixture);
  const counts = Object.fromEntries(
    ['L', 'T', 'straight', 'terminal', 'X', 'ambiguous']
      .map((type) => [type, topology.nodes.filter((node) => node.type === type).length])
  );

  assert.equal(topology.unresolved.length, 0);
  assert.equal(topology.nodes.length, 80);
  assert.deepEqual(counts, {
    L: 23,
    T: 35,
    straight: 18,
    terminal: 4,
    X: 0,
    ambiguous: 0
  });
});
