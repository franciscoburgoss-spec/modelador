import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import {
  RECOGNIZED_TOPOLOGY_SCHEMA,
  SPEC14_RECOGNITION_DEFAULTS,
  TopologyRecognitionError,
  recognizeStructuralTopology
} from '../src/core/recognizedStructuralTopology.js';

function point(axis, s, fixed, z = 0) {
  return axis === 'x' ? { x: s, y: fixed, z } : { x: fixed, y: s, z };
}

function wall(id, {
  axis = 'x', fixed = 0, s0 = 0, s1 = 1000, z0 = 0, height = 2400,
  thickness = 90, openings = []
} = {}) {
  return {
    id,
    type: 'wall',
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
  axis = 'x', fixed = 0, s0 = 100, s1 = 300, z0 = 800,
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

function input(elements = [wall('W1')]) {
  return {
    schema: 'agnostic-geometry-v1.0',
    grid: {
      xAxes: [{ id: 'X0', x: 0 }, { id: 'X1', x: 1000 }],
      yAxes: [{ id: 'Y0', y: 0 }],
      zLevels: [{ id: 'Z0', z: 0 }, { id: 'Z1', z: 2400 }]
    },
    elements,
    roofGeometry: []
  };
}

function reversePrism(prism) {
  return { ...prism, start: prism.end, end: prism.start };
}

function assertTopologyError(fn, code, path, ids) {
  assert.throws(fn, (error) => (
    error instanceof TopologyRecognitionError
    && error.code === code
    && error.path === path
    && ids.every((id) => error.ids.includes(id))
  ));
}

test('SPEC-014-B: una entrada literal mínima produce R0–R5 sin mutación', () => {
  const source = input();
  const before = structuredClone(source);
  const result = recognizeStructuralTopology(source);

  assert.equal(result.schema, RECOGNIZED_TOPOLOGY_SCHEMA);
  assert.equal(result.schema, 'recognized-structural-topology-v1.0');
  assert.equal(result.sourceSchema, 'agnostic-geometry-v1.0');
  assert.equal(result.specVersion, 'SPEC-14-v0.3');
  assert.deepEqual(result.config, SPEC14_RECOGNITION_DEFAULTS);
  assert.deepEqual(result.phasesExecuted, ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
  assert.deepEqual(result.phasesPending, [
    'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'
  ]);
  assert.equal(result.eligibleForSpec08, false);
  assert.equal(result.walls.length, 1);
  assert.deepEqual(result.walls[0], {
    id: 'W1', axis: 'x', fixed: 0, s0: 0, s1: 1000, z0: 0, z1: 2400,
    length: 1000, height: 2400, thickness: 90,
    supportLineId: 'axis=x|fixed=0.000', relationIds: [],
    nodeIds: [
      'node|wall:s:"W1"|localS:0.000',
      'node|wall:s:"W1"|localS:1000.000'
    ],
    chainId: null
  });
  assert.match(result.canonicalSha256, /^[a-f0-9]{64}$/);
  const withoutHash = { ...result };
  delete withoutHash.canonicalSha256;
  assert.equal(
    result.canonicalSha256,
    createHash('sha256').update(JSON.stringify(withoutHash)).digest('hex')
  );
  assert.deepEqual(source, before);
  assert.deepEqual(recognizeStructuralTopology(source), result);
});

test('SPEC-014-A: muros y vanos invertidos canonicalizan byte a byte igual', () => {
  const forwardWall = wall('W1', {
    s0: 100,
    s1: 900,
    openings: [opening('O1', 'W1', { s0: 250, s1: 600 })]
  });
  const reversedWall = structuredClone(forwardWall);
  reversedWall.prism = reversePrism(reversedWall.prism);
  reversedWall.openings[0].void = reversePrism(reversedWall.openings[0].void);

  assert.deepEqual(
    recognizeStructuralTopology(input([reversedWall])),
    recognizeStructuralTopology(input([forwardWall]))
  );
});

test('SPEC-014-A: R0/R1 rechaza prismas no ortogonales, verticales, nulos y alturas inválidas', () => {
  const cases = [
    ['RT-WALL-DIRECTION-MISMATCH', 'elements[0].prism.end', (value) => {
      value.elements[0].prism.end.y = 10;
    }],
    ['RT-WALL-DIRECTION-MISMATCH', 'elements[0].prism.end', (value) => {
      value.elements[0].prism.end.z = 1000;
    }],
    ['RT-WALL-ZERO-LENGTH', 'elements[0].prism', (value) => {
      value.elements[0].prism.end = { ...value.elements[0].prism.start };
    }],
    ['RT-WALL-Z-INVALID', 'elements[0].prism.height', (value) => {
      value.elements[0].prism.height = 0;
    }],
    ['NON_FINITE_GEOMETRY', 'elements[0].prism.end.x', (value) => {
      value.elements[0].prism.end.x = Infinity;
    }]
  ];
  for (const [code, path, mutate] of cases) {
    const source = input();
    mutate(source);
    assertTopologyError(() => recognizeStructuralTopology(source), code, path, ['W1']);
  }
});

test('SPEC-014-A: R0 aplica unicidad por dominio y referencias host resolubles', () => {
  const crossDomain = input([wall('SHARED', {
    openings: [opening('SHARED', 'SHARED')]
  })]);
  assert.equal(recognizeStructuralTopology(crossDomain).openings.length, 1);

  const duplicate = input();
  duplicate.grid.xAxes.push({ id: 'X0', x: 500 });
  assertTopologyError(
    () => recognizeStructuralTopology(duplicate),
    'RT-REF-DUPLICATE-ID',
    'grid.xAxes[2].id',
    ['X0']
  );

  const duplicateAcrossAxes = input();
  duplicateAcrossAxes.grid.yAxes[0].id = 'X0';
  assertTopologyError(
    () => recognizeStructuralTopology(duplicateAcrossAxes),
    'RT-REF-DUPLICATE-ID',
    'grid.yAxes[0].id',
    ['X0']
  );

  const unresolved = input([wall('W1', {
    openings: [opening('O1', 'MISSING')]
  })]);
  assertTopologyError(
    () => recognizeStructuralTopology(unresolved),
    'RT-REF-NOT-FOUND',
    'elements[0].openings[0].hostWallId',
    ['O1', 'MISSING']
  );

  const unknownKind = input([wall('W1', {
    openings: [opening('O1', 'W1', { kind: 'arch' })]
  })]);
  assertTopologyError(
    () => recognizeStructuralTopology(unknownKind),
    'UNKNOWN_ELEMENT_TYPE',
    'elements[0].openings[0].kind',
    ['O1', 'W1']
  );

  const invalidFoundation = input([
    wall('W1'),
    {
      id: 'F1',
      type: 'foundation',
      solids: [{
        role: 'cimiento',
        prism: {
          kind: 'axis-aligned-prism',
          min: { x: 0, y: 0, z: -500 },
          max: { x: 1000, y: 0, z: 0 }
        }
      }]
    }
  ]);
  assertTopologyError(
    () => recognizeStructuralTopology(invalidFoundation),
    'INVALID_DIMENSION',
    'elements[1].solids[0].prism',
    ['F1']
  );
});

test('SPEC-014-A: vanos globales/locales, contención y solape tridimensional', () => {
  const source = input([wall('W1', {
    s0: 100,
    s1: 1100,
    height: 3000,
    openings: [
      opening('O1', 'W1', { s0: 200, s1: 500, z0: 300, height: 800 }),
      opening('O2', 'W1', { s0: 450, s1: 700, z0: 600, height: 700 }),
      opening('O3', 'W1', { s0: 200, s1: 500, z0: 1800, height: 500 })
    ]
  })]);
  const result = recognizeStructuralTopology(source);

  assert.deepEqual(result.openings[0], {
    id: 'O1', kind: 'window', hostWallId: 'W1', axis: 'x', fixed: 0,
    s0: 200, s1: 500, localS0: 100, localS1: 400,
    z0: 300, z1: 1100, width: 300, height: 800, thickness: 90
  });
  assert.deepEqual(
    result.findings.map(({ code, ids }) => ({ code, ids })),
    [{ code: 'RT-OPENING-OVERLAP', ids: ['O1', 'O2', 'W1'] }]
  );

  const outsideS = input([wall('W1', {
    openings: [opening('OUT-S', 'W1', { s0: -1, s1: 200 })]
  })]);
  assertTopologyError(
    () => recognizeStructuralTopology(outsideS),
    'RT-OPENING-OUTSIDE-WALL',
    'elements[0].openings[0].void',
    ['OUT-S', 'W1']
  );

  const outsideZ = input([wall('W1', {
    openings: [opening('OUT-Z', 'W1', { z0: 2000, height: 500 })]
  })]);
  assertTopologyError(
    () => recognizeStructuralTopology(outsideZ),
    'RT-OPENING-Z-OUTSIDE-WALL',
    'elements[0].openings[0].void',
    ['OUT-Z', 'W1']
  );
});

test('SPEC-014-A: configuración exacta, overrides y rechazo previo de valores incompatibles', () => {
  assert.deepEqual(SPEC14_RECOGNITION_DEFAULTS, {
    linearTolerance: 0.1,
    levelTolerance: 0.1,
    angularToleranceDeg: 0.001,
    minimumOverlap: 0.1,
    minimumSupportOverlap: 38,
    minimumSegmentLength: 0.1,
    openingProximityReviewDistance: 150,
    defaultAssemblyEnvelope: null,
    roundDecimals: 3
  });
  const result = recognizeStructuralTopology(input(), {
    linearTolerance: 0.25,
    minimumOverlap: 0.2,
    roundDecimals: 4
  });
  assert.equal(result.config.linearTolerance, 0.25);
  assert.equal(result.config.minimumOverlap, 0.2);
  assert.equal(result.config.roundDecimals, 4);

  for (const config of [
    { linearTolerance: -1 },
    { minimumOverlap: NaN },
    { angularToleranceDeg: 91 },
    { roundDecimals: 2.5 },
    { unknownTolerance: 1 }
  ]) {
    assertTopologyError(
      () => recognizeStructuralTopology(null, config),
      'INVALID_RECOGNITION_CONFIG',
      'recognitionConfig',
      []
    );
  }
});

test('SPEC-014-A: R2 agrupa líneas, clasifica pares y encadena sin fusionar IDs', () => {
  const source = input([
    wall('A', { fixed: 0, s0: 0, s1: 1000 }),
    wall('B', { fixed: 0.05, s0: 1000.05, s1: 2000 }),
    wall('C', { fixed: 0.08, s0: 2300, s1: 2500 }),
    wall('D', { fixed: 0.09, s0: 500, s1: 800 })
  ]);
  const result = recognizeStructuralTopology(source);
  const relation = (a, b) => result.relations.find(({ wallIds }) => (
    wallIds.includes(a) && wallIds.includes(b)
  ));

  assert.equal(result.supportLines.length, 1);
  assert.equal(result.supportLines[0].id, 'axis=x|fixed=0.000');
  assert.deepEqual(result.supportLines[0].wallIds, ['A', 'D', 'B', 'C']);
  assert.equal(relation('A', 'B').type, 'COLLINEAR_CONTIGUOUS');
  assert.equal(relation('A', 'D').type, 'COLLINEAR_OVERLAP');
  assert.equal(relation('B', 'C').type, 'COLLINEAR_SEPARATED');
  assert.deepEqual(result.chains.map(({ wallIds }) => wallIds), [['A', 'B']]);

  for (const item of result.relations) {
    for (const wallId of item.wallIds) {
      assert.ok(
        result.walls.find(({ id }) => id === wallId).relationIds.includes(item.id),
        `${item.id} debe ser consultable desde ${wallId}`
      );
    }
  }
  assert.deepEqual(result.chains[0].wallIds, ['A', 'B']);
  assert.equal(result.walls.length, 4);
  assert.equal(result.findings.filter(({ code }) => code === 'RT-COLLINEAR-DUPLICATE').length, 1);
});

test('SPEC-014-A: permutar grilla, elementos y vanos conserva salida y hash', () => {
  const source = input([
    wall('W2', { axis: 'y', fixed: 1000, openings: [] }),
    wall('W1', {
      openings: [
        opening('O2', 'W1', { s0: 600, s1: 800 }),
        opening('O1', 'W1', { s0: 100, s1: 300 })
      ]
    })
  ]);
  const permuted = structuredClone(source);
  permuted.grid.xAxes.reverse();
  permuted.grid.yAxes.reverse();
  permuted.grid.zLevels.reverse();
  permuted.elements.reverse();
  permuted.elements.find(({ id }) => id === 'W1').openings.reverse();

  assert.deepEqual(
    recognizeStructuralTopology(permuted),
    recognizeStructuralTopology(source)
  );
});

test('SPEC-014-B: casa-L fija R3–R5, referencias, determinismo y hash de regresión', async () => {
  const model = JSON.parse(await readFile(new URL('fixtures/casa-L.json', import.meta.url), 'utf8'));
  const projected = projectAgnosticGeometry(model);
  const before = structuredClone(projected);
  const result = recognizeStructuralTopology(projected);

  assert.equal(result.walls.length, 45);
  assert.equal(result.openings.length, 43);
  assert.equal(result.relations.filter(({ phase }) => phase === 'R3').length, 0);
  assert.equal(result.relations.filter(({ phase }) => phase === 'R4').length, 60);
  assert.equal(result.nodes.length, 201);
  assert.equal(result.findings.length, 26);
  assert.equal(
    result.findings.filter(({ code }) => code === 'RT-CROSS-STRUCTURAL-INTENT-REQUIRED').length,
    1
  );
  assert.equal(
    result.findings.filter(({ code }) => code === 'RT-INTERSECTION-PARTIAL-Z').length,
    25
  );
  assert.equal(result.findings.filter(({ severity }) => severity === 'error').length, 0);
  assert.ok(result.relations.length > 0);
  assert.equal(new Set(result.relations.map(({ id }) => id)).size, result.relations.length);
  assert.equal(new Set(result.nodes.map(({ id }) => id)).size, result.nodes.length);
  assert.ok(result.relations.every(({ id, wallIds }) => wallIds.every((wallId) => (
    result.walls.find(({ id: candidateId }) => candidateId === wallId).relationIds.includes(id)
  ))));
  assert.ok(result.walls.every(({ nodeIds }) => nodeIds.every((nodeId) => (
    result.nodes.some(({ id }) => id === nodeId)
  ))));
  for (const { nodeIds } of result.walls) {
    const wallNodes = nodeIds.map((nodeId) => result.nodes.find(({ id }) => id === nodeId));
    assert.ok(wallNodes.every((node, index) => (
      index === 0 || node.localS > wallNodes[index - 1].localS
    )));
  }
  assert.equal(result.eligibleForSpec08, false);
  assert.equal(
    result.canonicalSha256,
    'ba783496503c0f9d1da5ebb0cf18a603169e239eba1b07306f02502630cb09e6'
  );
  const permuted = structuredClone(projected);
  permuted.grid.xAxes.reverse();
  permuted.grid.yAxes.reverse();
  permuted.grid.zLevels.reverse();
  permuted.elements.reverse();
  permuted.elements.forEach((element) => element.openings?.reverse());
  permuted.roofGeometry.reverse();
  assert.deepEqual(recognizeStructuralTopology(permuted), result);
  assert.deepEqual(projected, before);
});
