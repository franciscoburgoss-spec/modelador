import test from 'node:test';
import assert from 'node:assert/strict';

import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';

function point(axis, s, fixed, z = 0) {
  return axis === 'x' ? { x: s, y: fixed, z } : { x: fixed, y: s, z };
}

function wall(id, {
  axis = 'x', fixed = 0, s0 = 0, s1 = 1000, z0 = 0, height = 1000,
  thickness = 90, openings = [], extra = {}
} = {}) {
  return {
    id,
    type: 'wall',
    ...extra,
    prism: {
      kind: 'oriented-prism',
      start: point(axis, s0, fixed, z0),
      end: point(axis, s1, fixed, z0),
      thickness,
      height
    },
    openings
  };
}

function opening(id, hostWallId, {
  axis = 'x', fixed = 0, s0 = 200, s1 = 400, z0 = 500,
  height = 1000, thickness = 90, kind = 'window'
} = {}) {
  return {
    id,
    kind,
    hostWallId,
    void: {
      kind: 'oriented-prism',
      start: point(axis, s0, fixed, z0),
      end: point(axis, s1, fixed, z0),
      thickness,
      height
    }
  };
}

function input(elements) {
  return {
    schema: 'agnostic-geometry-v1.0',
    grid: {
      xAxes: [{ id: 'X0', x: 0 }],
      yAxes: [{ id: 'Y0', y: 0 }],
      zLevels: [{ id: 'Z0', z: 0 }]
    },
    elements,
    roofGeometry: []
  };
}

function relationsOf(result, prefix) {
  return result.relations.filter(({ type }) => type.startsWith(prefix));
}

function byType(result, type) {
  return result.relations.find((relation) => relation.type === type);
}

test('SPEC-014-B R3: exacto, parcial, overlap y gap conservan métricas, simetría y findings reglados', () => {
  const result = recognizeStructuralTopology(input([
    wall('E0', { fixed: 0, z0: 0, height: 1000 }),
    wall('E1', { fixed: 0, z0: 1000, height: 1000 }),
    wall('P0', { fixed: 2000, s0: 0, s1: 1000, z0: 0, height: 1000 }),
    wall('P1', { fixed: 2000, s0: 400, s1: 1200, z0: 1000, height: 1000 }),
    wall('O0', { fixed: 4000, z0: 0, height: 1200 }),
    wall('O1', { fixed: 4000, z0: 1000, height: 1000 }),
    wall('G0', { fixed: 6000, z0: 0, height: 1000 }),
    wall('G1', { fixed: 6000, z0: 1100, height: 1000 })
  ]));
  const stacked = relationsOf(result, 'STACKED_');

  assert.deepEqual(stacked.map(({ type }) => type), [
    'STACKED_EXACT', 'STACKED_GAP', 'STACKED_OVERLAP', 'STACKED_PARTIAL'
  ]);
  assert.deepEqual(byType(result, 'STACKED_EXACT').evidence, {
    supportLineId: 'axis=x|fixed=0.000',
    lowerWallId: 'E0',
    upperWallId: 'E1',
    overlapS: 1000,
    commonS: [0, 1000],
    gapZ: 0,
    zOverlap: null,
    linearTolerance: 0.1,
    levelTolerance: 0.1,
    minimumOverlap: 0.1
  });
  assert.deepEqual(byType(result, 'STACKED_PARTIAL').evidence.commonS, [400, 1000]);
  for (const wallId of ['P0', 'P1']) {
    const participant = result.walls.find(({ id }) => id === wallId);
    const positions = participant.nodeIds.map((nodeId) => (
      result.nodes.find(({ id }) => id === nodeId).global.x
    ));
    assert.ok(positions.includes(400));
    assert.ok(positions.includes(1000));
  }
  assert.notEqual(
    result.walls.find(({ id }) => id === 'P0').nodeIds.find((id) => id.endsWith('400.000')),
    result.walls.find(({ id }) => id === 'P1').nodeIds.find((id) => id.endsWith('0.000'))
  );
  assert.equal(byType(result, 'STACKED_OVERLAP').evidence.gapZ, -200);
  assert.deepEqual(byType(result, 'STACKED_OVERLAP').evidence.zOverlap, [1000, 1200]);
  assert.equal(byType(result, 'STACKED_GAP').certainty, 'candidate');
  assert.equal(byType(result, 'STACKED_GAP').evidence.gapZ, 100);
  assert.deepEqual(
    result.findings.filter(({ code }) => [
      'RT-VERTICAL-LOAD-PATH-GAP', 'RT-WALL-VOLUME-OVERLAP'
    ].includes(code)).map(({ code, ids }) => ({ code, ids })),
    [
      { code: 'RT-VERTICAL-LOAD-PATH-GAP', ids: ['G0', 'G1'] },
      { code: 'RT-WALL-VOLUME-OVERLAP', ids: ['O0', 'O1'] }
    ]
  );
  assert.equal(result.findings.filter(({ code }) => code === 'RT-COLLINEAR-DUPLICATE').length, 1);
  for (const relation of stacked) {
    for (const wallId of relation.wallIds) {
      assert.ok(result.walls.find(({ id }) => id === wallId).relationIds.includes(relation.id));
    }
  }

  const disjoint = recognizeStructuralTopology(input([
    wall('D0', { s0: 0, s1: 100, z0: 0 }),
    wall('D1', { s0: 200, s1: 300, z0: 1000 })
  ]));
  assert.equal(relationsOf(disjoint, 'STACKED_').length, 0);
});

test('SPEC-014-B R4: A=X/B=Y clasifica esquina, ambas T y cruce bajo permutación', () => {
  const elements = [
    wall('AX-C', { axis: 'x', fixed: 0, s0: 0, s1: 1000 }),
    wall('BY-C', { axis: 'y', fixed: 0, s0: 0, s1: 1000 }),
    wall('AX-TE', { axis: 'x', fixed: 2000, s0: 0, s1: 1000 }),
    wall('BY-TE', { axis: 'y', fixed: 1000, s0: 1500, s1: 2500 }),
    wall('AX-TM', { axis: 'x', fixed: 4000, s0: 0, s1: 1000 }),
    wall('BY-TM', { axis: 'y', fixed: 500, s0: 3000, s1: 4000 }),
    wall('AX-X', { axis: 'x', fixed: 6000, s0: 0, s1: 1000 }),
    wall('BY-X', { axis: 'y', fixed: 500, s0: 5500, s1: 6500 })
  ];
  const result = recognizeStructuralTopology(input(elements));
  const intersections = result.relations.filter(({ phase }) => phase === 'R4');

  assert.deepEqual(intersections.map(({ type }) => type), [
    'CORNER_END_END', 'CROSS_MID_MID', 'T_END_MID', 'T_MID_END'
  ]);
  assert.deepEqual(byType(result, 'CORNER_END_END').evidence, {
    point: { x: 0, y: 0 }, stateA: 'START', stateB: 'START',
    sA: 0, sB: 0, localSA: 0, localSB: 0,
    linearTolerance: 0.1, minimumOverlap: 0.1
  });
  assert.deepEqual(
    [byType(result, 'T_END_MID').evidence.stateA, byType(result, 'T_END_MID').evidence.stateB],
    ['END', 'MID']
  );
  assert.deepEqual(
    [byType(result, 'T_MID_END').evidence.stateA, byType(result, 'T_MID_END').evidence.stateB],
    ['MID', 'END']
  );
  assert.deepEqual(
    [byType(result, 'CROSS_MID_MID').evidence.stateA, byType(result, 'CROSS_MID_MID').evidence.stateB],
    ['MID', 'MID']
  );
  for (const relation of intersections) {
    assert.equal(result.walls.find(({ id }) => id === relation.wallAId).axis, 'x');
    assert.equal(result.walls.find(({ id }) => id === relation.wallBId).axis, 'y');
    assert.deepEqual(relation.zOverlap, [0, 1000]);
    assert.equal(relation.verticalContactType, 'FULL_BOTH');
  }
  const cross = byType(result, 'CROSS_MID_MID');
  assert.equal(cross.certainty, 'ambiguous');
  assert.equal(cross.ambiguous, true);
  assert.deepEqual(
    result.findings.filter(({ code }) => code === 'RT-CROSS-STRUCTURAL-INTENT-REQUIRED'),
    [{
      code: 'RT-CROSS-STRUCTURAL-INTENT-REQUIRED',
      severity: 'blocking',
      ids: ['AX-X', 'BY-X'],
      rule: 'R-INT-04',
      evidence: { relationId: cross.id }
    }]
  );
  assert.deepEqual(
    recognizeStructuralTopology(input([...elements].reverse())),
    result
  );

  const outside = recognizeStructuralTopology(input([
    wall('OUT-A', { axis: 'x', fixed: 0, s0: 0, s1: 100 }),
    wall('OUT-B', { axis: 'y', fixed: 100.2, s0: -100, s1: 100 })
  ]));
  const threshold = recognizeStructuralTopology(input([
    wall('Z-A', { axis: 'x', fixed: 1000, s0: 0, s1: 100, z0: 0, height: 1000 }),
    wall('Z-B', { axis: 'y', fixed: 0, s0: 900, s1: 1100, z0: 999.9, height: 1000 })
  ]));
  assert.equal(outside.relations.filter(({ phase }) => phase === 'R4').length, 0);
  assert.equal(threshold.relations.filter(({ phase }) => phase === 'R4').length, 0);
});

test('SPEC-014-B R4: las cuatro coberturas verticales producen bandas sin intervalos nulos', () => {
  const result = recognizeStructuralTopology(input([
    wall('A-FB', { axis: 'x', fixed: 0, s0: 0, s1: 100, z0: 0, height: 1000 }),
    wall('B-FB', { axis: 'y', fixed: 0, s0: 0, s1: 100, z0: 0, height: 1000 }),
    wall('A-FA', { axis: 'x', fixed: 2000, s0: 2000, s1: 2100, z0: 0, height: 1000 }),
    wall('B-FA', { axis: 'y', fixed: 2000, s0: 2000, s1: 2100, z0: -500, height: 2000 }),
    wall('A-FB2', { axis: 'x', fixed: 4000, s0: 4000, s1: 4100, z0: -500, height: 2000 }),
    wall('B-FB2', { axis: 'y', fixed: 4000, s0: 4000, s1: 4100, z0: 0, height: 1000 }),
    wall('A-PB', { axis: 'x', fixed: 6000, s0: 6000, s1: 6100, z0: 0, height: 1000 }),
    wall('B-PB', { axis: 'y', fixed: 6000, s0: 6000, s1: 6100, z0: 500, height: 1000 })
  ]));
  const intersections = result.relations.filter(({ phase }) => phase === 'R4');
  const byContact = Object.fromEntries(intersections.map((relation) => [
    relation.verticalContactType,
    relation
  ]));

  assert.deepEqual(Object.keys(byContact).sort(), [
    'FULL_A_PARTIAL_B', 'FULL_BOTH', 'PARTIAL_A_FULL_B', 'PARTIAL_BOTH'
  ]);
  assert.deepEqual(byContact.FULL_BOTH.verticalBands, [
    { z0: 0, z1: 1000, state: 'intersectionActive' }
  ]);
  assert.deepEqual(byContact.FULL_A_PARTIAL_B.verticalBands, [
    { z0: -500, z1: 0, state: 'wallBOnly' },
    { z0: 0, z1: 1000, state: 'intersectionActive' },
    { z0: 1000, z1: 1500, state: 'wallBOnly' }
  ]);
  assert.deepEqual(byContact.PARTIAL_A_FULL_B.verticalBands, [
    { z0: -500, z1: 0, state: 'wallAOnly' },
    { z0: 0, z1: 1000, state: 'intersectionActive' },
    { z0: 1000, z1: 1500, state: 'wallAOnly' }
  ]);
  assert.deepEqual(byContact.PARTIAL_BOTH.verticalBands, [
    { z0: 0, z1: 500, state: 'wallAOnly' },
    { z0: 500, z1: 1000, state: 'intersectionActive' },
    { z0: 1000, z1: 1500, state: 'wallBOnly' }
  ]);
  assert.ok(intersections.every(({ verticalBands }) => (
    verticalBands.every(({ z0, z1 }) => z1 > z0)
  )));
  assert.equal(
    result.findings.filter(({ code }) => code === 'RT-INTERSECTION-PARTIAL-Z').length,
    3
  );
});

test('SPEC-014-B R5: unifica eventos dentro de tolerancia y conserva roles, fuentes y cobertura Z', () => {
  const source = input([
    wall('W', {
      axis: 'x', fixed: 0, s0: 0, s1: 1000, z0: 0, height: 2400,
      openings: [opening('O', 'W')],
      extra: { wallType: { role: 'MP1' } }
    }),
    wall('I', { axis: 'y', fixed: 200.05, s0: -500, s1: 500, z0: 0, height: 2400 }),
    wall('U', { axis: 'x', fixed: 0, s0: 400.05, s1: 800, z0: 2400, height: 1000 })
  ]);
  const result = recognizeStructuralTopology(source);
  const plain = structuredClone(source);
  delete plain.elements[0].wallType;

  assert.deepEqual(result, recognizeStructuralTopology(plain));
  assert.deepEqual(result.phasesExecuted, ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
  assert.deepEqual(result.phasesPending, ['R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12']);
  assert.equal(result.eligibleForSpec08, false);

  const wallW = result.walls.find(({ id }) => id === 'W');
  const nodes = wallW.nodeIds.map((nodeId) => result.nodes.find(({ id }) => id === nodeId));
  assert.deepEqual(nodes.map(({ localS }) => localS), [0, 200, 400, 800, 1000]);
  assert.ok(nodes.every(Boolean));
  assert.ok(nodes.every((node, index) => index === 0 || node.localS > nodes[index - 1].localS));

  const openingIntersection = nodes.find(({ localS }) => localS === 200);
  assert.equal(openingIntersection.nodeType, 'openingEdge');
  assert.deepEqual(openingIntersection.roles, ['openingEdge', 'wallIntersection']);
  assert.deepEqual(openingIntersection.openingIds, ['O']);
  assert.equal(openingIntersection.relationIds.length, 1);
  assert.deepEqual(openingIntersection.global, { x: 200, y: 0 });
  assert.deepEqual(openingIntersection.zCoverage, [
    { z0: 0, z1: 2400 },
    { z0: 500, z1: 1500 }
  ]);

  const openingStack = nodes.find(({ localS }) => localS === 400);
  assert.equal(openingStack.nodeType, 'openingEdge');
  assert.deepEqual(openingStack.roles, ['openingEdge', 'stackBoundary']);
  assert.deepEqual(openingStack.openingIds, ['O']);
  assert.equal(openingStack.relationIds.length, 1);

  for (const node of result.nodes) {
    assert.ok(result.walls.some(({ id }) => id === node.wallId));
    assert.ok(node.relationIds.every((id) => result.relations.some((relation) => relation.id === id)));
    assert.ok(node.openingIds.every((id) => result.openings.some((item) => item.id === id)));
  }
  assert.ok(result.walls.every(({ nodeIds }) => (
    nodeIds.every((id) => result.nodes.some((node) => node.id === id))
  )));
});
