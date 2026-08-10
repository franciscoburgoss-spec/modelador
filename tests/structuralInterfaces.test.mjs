import test from 'node:test';
import assert from 'node:assert/strict';
import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import {
  STRUCTURAL_INTENT_SCHEMA,
  applyStructuralInterfaceTransaction,
  checkStructuralIntentBeforeMerge,
  migrateStructuralIntentSchema,
  reconcileStructuralIntentAfterGeometryChange,
  reconcileStructuralIntentAfterSplit,
  removeElementAndStructuralReferences,
  structuralInterfaceStates
} from '../src/core/structuralIntent.js';
import {
  StructuralInterfaceError,
  buildInterfaceIntent,
  buildRelationIntent,
  interfaceIdFor,
  relationIdFor,
  roofBoundaryLongitudinalRange,
  roofBoundarySegmentForLocator
} from '../src/core/structuralInterfaces.js';
import { canonicalizeRoofBoundaries } from '../src/core/roofStructuralIntent.js';
import { loadFx008Model, FX008_FRONTON_ID } from './helpers/spec015d.mjs';

function syntheticGeometry(reverse = false) {
  const start = { x: 10, y: 20, z: 30 };
  const end = { x: 110, y: 20, z: 30 };
  return {
    schema: 'agnostic-geometry-v1.0',
    units: { length: 'millimeter' },
    coordinates: { type: 'cartesian', handedness: 'right-handed', axes: { x: 'plan', y: 'plan', z: 'vertical-up' } },
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [{
      id: 1,
      type: 'wall',
      prism: {
        kind: 'oriented-prism',
        start: reverse ? end : start,
        end: reverse ? start : end,
        thickness: 100,
        height: 200
      },
      openings: []
    }],
    roofGeometry: []
  };
}

test('REV8: migración structural-intent-v1.0→v1.1 es vacía e idempotente', () => {
  const legacy = {
    schema: 'structural-intent-v1.0',
    elementIntents: [], roofIntents: [], intersectionIntents: [], supportIntents: [],
    diaphragmIntents: [], overrides: []
  };
  const once = migrateStructuralIntentSchema(legacy);
  const twice = migrateStructuralIntentSchema(once);
  assert.equal(once.schema, STRUCTURAL_INTENT_SCHEMA);
  assert.deepEqual(once.interfaceIntents, []);
  assert.deepEqual(once.relationIntents, []);
  assert.deepEqual(twice, once);
  assert.equal('interfaceIntents' in legacy, false);
});

test('REV8: identidad de cara/extremo es canónica ante inversión equivalente', () => {
  const locatorFace = { kind: 'face', side: 'positiveN', sRange: [10, 110], zRange: [30, 230] };
  const locatorEnd = { kind: 'end', end: 'lowS', zRange: [30, 230] };
  const forwardFace = buildInterfaceIntent(syntheticGeometry(false), { ownerRef: { kind: 'element', id: 1 }, locator: locatorFace });
  const reverseFace = buildInterfaceIntent(syntheticGeometry(true), { ownerRef: { kind: 'element', id: 1 }, locator: locatorFace });
  const forwardEnd = buildInterfaceIntent(syntheticGeometry(false), { ownerRef: { kind: 'element', id: 1 }, locator: locatorEnd });
  const reverseEnd = buildInterfaceIntent(syntheticGeometry(true), { ownerRef: { kind: 'element', id: 1 }, locator: locatorEnd });
  assert.equal(forwardFace.interfaceId, reverseFace.interfaceId);
  assert.equal(forwardFace.hostGeometryFingerprint, reverseFace.hostGeometryFingerprint);
  assert.equal(forwardEnd.interfaceId, reverseEnd.interfaceId);
  assert.equal(forwardEnd.hostGeometryFingerprint, reverseEnd.hostGeometryFingerprint);
});

test('REV8: caras opuestas no se deduplican y face no implica lateral', () => {
  const ownerRef = { kind: 'element', id: 1 };
  const positive = buildInterfaceIntent(syntheticGeometry(), {
    ownerRef,
    locator: { kind: 'face', side: 'positiveN', sRange: [10, 110], zRange: [30, 230] }
  });
  const negative = buildInterfaceIntent(syntheticGeometry(), {
    ownerRef,
    locator: { kind: 'face', side: 'negativeN', sRange: [10, 110], zRange: [30, 230] }
  });
  assert.notEqual(positive.interfaceId, negative.interfaceId);
  assert.equal('actionFamily' in positive, false);
  assert.equal('actionFamily' in negative, false);
});

test('BUG-015-D-028: roofBoundary contiene sRange parcial y preserva identidad del borde completo', async () => {
  const source = await loadFx008Model();
  const geometry = projectAgnosticGeometry(source);
  const roofId = 1785161146258;
  const expectedBoundaryId = 'roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c';
  const roof = geometry.roofGeometry.find((item) => item.id === roofId);
  const boundary = canonicalizeRoofBoundaries(roof).find((item) => item.boundaryId === expectedBoundaryId);
  assert.ok(boundary, 'debe resolver el borde real C/6→11A de la cubierta norte');
  assert.deepEqual(roofBoundaryLongitudinalRange(boundary), [12800, 23200]);

  const ownerRef = { kind: 'roofBoundary', roofGeometryId: roofId, boundaryId: expectedBoundaryId };
  const full = buildInterfaceIntent(geometry, { ownerRef, locator: { kind: 'boundary' } });
  assert.deepEqual(full.locator, { kind: 'boundary' });
  assert.equal(full.interfaceId, 'iface:sha256:e00c3bcf33140ad52e78d56eebb0567350bce1749e0efbde0965ca1530e9dc8a');

  const partial = buildInterfaceIntent(geometry, { ownerRef, locator: { kind: 'boundary', sRange: [12800, 14500] } });
  const reversed = buildInterfaceIntent(geometry, { ownerRef, locator: { kind: 'boundary', sRange: [14500, 12800] } });
  assert.deepEqual(partial.locator.sRange, [12800, 14500]);
  assert.equal(partial.interfaceId, 'iface:sha256:db60ba9dd5b8c32bc2513294aee9d7feedbb065efe43a216db047f73b328a493');
  assert.equal(reversed.interfaceId, partial.interfaceId);
  assert.notEqual(partial.interfaceId, full.interfaceId);

  const explicitFull = buildInterfaceIntent(geometry, { ownerRef, locator: { kind: 'boundary', sRange: [12800, 23200] } });
  assert.deepEqual(explicitFull.locator.sRange, [12800, 23200]);

  const segment = roofBoundarySegmentForLocator(boundary, partial.locator);
  assert.deepEqual(segment, {
    start: { x: 12800, y: 2000, z: 3650 },
    end: { x: 14500, y: 2000, z: 3650 }
  });
});

test('BUG-015-D-028: roofBoundary rechaza sRange inválido o fuera del borde antes de mutar', async () => {
  const source = await loadFx008Model();
  const geometry = projectAgnosticGeometry(source);
  const ownerRef = {
    kind: 'roofBoundary',
    roofGeometryId: 1785161146258,
    boundaryId: 'roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c'
  };
  const badRanges = [
    null,
    [12799.9, 14500],
    [12800, 23200.1],
    [14500, 14500],
    [12800, Number.NaN],
    [12800, Number.POSITIVE_INFINITY]
  ];
  for (const sRange of badRanges) {
    assert.throws(
      () => buildInterfaceIntent(geometry, { ownerRef, locator: { kind: 'boundary', sRange } }),
      (error) => error instanceof StructuralInterfaceError
        && error.code === 'SI-INTERFACE-VALIDATION-FAILED'
        && error.details.some((issue) => ['SI-INTERFACE-RANGE-INVALID', 'SI-INTERFACE-LOCATOR-NOT-RESOLVABLE'].includes(issue.code)),
      `debe rechazar ${String(sRange)}`
    );
  }

  const before = structuredClone(source);
  assert.throws(() => applyStructuralInterfaceTransaction(source, {
    interfaces: [{ ownerRef, locator: { kind: 'boundary', sRange: [12799.9, 14500] } }]
  }), (error) => error.code === 'SI-INTERFACE-VALIDATION-FAILED');
  assert.deepEqual(source, before);
});

test('REV8: región fuera del host se rechaza antes de persistir', () => {
  assert.throws(() => buildInterfaceIntent(syntheticGeometry(), {
    ownerRef: { kind: 'element', id: 1 },
    locator: { kind: 'region', sRange: [0, 120], zRange: [30, 230] }
  }), (error) => error instanceof StructuralInterfaceError && error.code === 'SI-INTERFACE-VALIDATION-FAILED');
});

test('REV8: relación fuente→destino es determinista e independiente del orden de ports', () => {
  const geometry = syntheticGeometry();
  const input = buildInterfaceIntent(geometry, {
    ownerRef: { kind: 'element', id: 1 },
    locator: { kind: 'face', side: 'positiveN', sRange: [10, 110], zRange: [30, 230] }
  });
  const output = buildInterfaceIntent(geometry, {
    ownerRef: { kind: 'element', id: 1 },
    locator: { kind: 'end', end: 'highS', zRange: [30, 230] }
  });
  const a = buildRelationIntent(geometry, [input, output], {
    ports: [
      { interfaceRef: input.interfaceId, interactionRole: 'receives' },
      { interfaceRef: output.interfaceId, interactionRole: 'delivers' }
    ],
    actionFamily: 'gravity',
    structuralFunction: 'loadTransfer',
    carrierRegions: [{ ownerRef: { kind: 'element', id: 1 }, sRange: [10, 110], zRange: [30, 230] }]
  });
  const b = buildRelationIntent(geometry, [input, output], {
    ports: [...a.ports].reverse(),
    actionFamily: 'gravity',
    structuralFunction: 'loadTransfer',
    carrierRegions: [...a.carrierRegions].reverse()
  });
  assert.equal(a.relationId, b.relationId);
  assert.equal(a.relationId, relationIdFor(a));
});

test('REV8: transacción crea interfaces+relación con un solo trace y sin cambiar geometría agnóstica', async () => {
  const source = await loadFx008Model();
  const beforeGeometry = projectAgnosticGeometry(source);
  const faceLocator = { kind: 'face', side: 'negativeN', sRange: [12800, 14500], zRange: [3250, 4150] };
  const endLocator = { kind: 'end', end: 'lowS', zRange: [3250, 4150] };
  const faceId = interfaceIdFor({ kind: 'element', id: FX008_FRONTON_ID }, faceLocator);
  const endId = interfaceIdFor({ kind: 'element', id: FX008_FRONTON_ID }, endLocator);
  const outcome = applyStructuralInterfaceTransaction(source, {
    interfaces: [
      { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: faceLocator },
      { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: endLocator }
    ],
    relations: [{
      ports: [
        { interfaceRef: faceId, interactionRole: 'receives' },
        { interfaceRef: endId, interactionRole: 'delivers' }
      ],
      actionFamily: 'gravity',
      structuralFunction: 'loadTransfer',
      carrierRegions: [{ ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, sRange: [12800, 14500], zRange: [3250, 4150] }]
    }]
  }, { recordUserAction: true });
  assert.equal(outcome.model.structuralIntent.interfaceIntents.length, 2);
  assert.equal(outcome.model.structuralIntent.relationIntents.length, 1);
  assert.equal(outcome.model.structuralIntentTrace.events.length, 1);
  assert.equal(outcome.model.structuralIntentTrace.events[0].targetType, 'mixed');
  assert.equal(outcome.model.structuralIntentTrace.events[0].changes.length, 3);
  assert.deepEqual(projectAgnosticGeometry(outcome.model), beforeGeometry);
  const states = structuralInterfaceStates(outcome.model);
  assert.ok(states.interfaces.every((item) => item.state === 'fresh'));
  assert.equal(states.relations[0].state, 'fresh');
});


async function fx008WithFrontonRelation() {
  const source = await loadFx008Model();
  const faceLocator = { kind: 'face', side: 'negativeN', sRange: [12800, 14500], zRange: [3250, 4150] };
  const endLocator = { kind: 'end', end: 'lowS', sRange: [12800, 12800.1], zRange: [3250, 4150] };
  const faceId = interfaceIdFor({ kind: 'element', id: FX008_FRONTON_ID }, faceLocator);
  const endId = interfaceIdFor({ kind: 'element', id: FX008_FRONTON_ID }, endLocator);
  return applyStructuralInterfaceTransaction(source, {
    interfaces: [
      { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: faceLocator },
      { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: endLocator }
    ],
    relations: [{
      ports: [
        { interfaceRef: faceId, interactionRole: 'receives' },
        { interfaceRef: endId, interactionRole: 'delivers' }
      ],
      actionFamily: 'gravity',
      structuralFunction: 'loadTransfer',
      carrierRegions: [{ ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, sRange: [12800, 14500], zRange: [3250, 4150] }]
    }]
  }, { recordUserAction: true }).model;
}

test('REV8: cambiar geometría del mismo host conserva interfaz pero la marca stale', async () => {
  const model = await fx008WithFrontonRelation();
  const next = structuredClone(model);
  const wall = next.elements.find((item) => item.id === FX008_FRONTON_ID);
  wall.thickness = 102.1;
  const reconciled = reconcileStructuralIntentAfterGeometryChange(model, next);
  assert.equal(reconciled.structuralIntent.interfaceIntents.length, 2);
  const states = structuralInterfaceStates(reconciled);
  assert.ok(states.interfaces.every((item) => item.state === 'stale'));
  assert.equal(states.relations[0].state, 'stale');
});

test('REV8: split elimina interfaces/relaciones del host, conserva evidencia y no reasigna a tramos nuevos', async () => {
  const model = await fx008WithFrontonRelation();
  const sourceWall = model.elements.find((item) => item.id === FX008_FRONTON_ID);
  const next = structuredClone(model);
  const index = next.elements.findIndex((item) => item.id === FX008_FRONTON_ID);
  const a = { ...structuredClone(sourceWall), id: 900001, xEnd: sourceWall.xStart ?? sourceWall.xEnd };
  const b = { ...structuredClone(sourceWall), id: 900002 };
  // reconcileStructuralIntentAfterSplit only requires the new element IDs to exist; wallSplitMerge
  // owns the exact geometry planning, so this test focuses on reference semantics.
  next.elements.splice(index, 1, a, b);
  const outcome = reconcileStructuralIntentAfterSplit(model, next, FX008_FRONTON_ID, [a.id, b.id]);
  assert.equal(outcome.model.structuralIntent.interfaceIntents.length, 0);
  assert.equal(outcome.model.structuralIntent.relationIntents.length, 0);
  assert.ok(outcome.finding);
  assert.equal(outcome.finding.originalInterfaceIntents.length, 2);
  assert.equal(outcome.finding.originalRelationIntents.length, 1);
  assert.ok(!outcome.model.structuralIntent.interfaceIntents.some((item) => [a.id, b.id].includes(item.ownerRef.id)));
});

test('REV8: merge queda bloqueado por interfaces aunque no exista elementIntent', async () => {
  const model = await fx008WithFrontonRelation();
  const check = checkStructuralIntentBeforeMerge(model, [FX008_FRONTON_ID, 1784605101040]);
  assert.equal(check.ok, false);
  assert.equal(check.code, 'SI-MERGE-INTENT-DECISION-REQUIRED');
  assert.ok(check.interfaceIds.length >= 2);
});

test('REV8: delete elimina interfaces y relaciones dependientes y registra un solo evento mixto adicional', async () => {
  const model = await fx008WithFrontonRelation();
  const beforeEvents = model.structuralIntentTrace.events.length;
  const outcome = removeElementAndStructuralReferences(model, FX008_FRONTON_ID);
  assert.equal(outcome.model.structuralIntent.interfaceIntents.length, 0);
  assert.equal(outcome.model.structuralIntent.relationIntents.length, 0);
  assert.equal(outcome.model.structuralIntentTrace.events.length, beforeEvents + 1);
  const event = outcome.model.structuralIntentTrace.events.at(-1);
  assert.equal(event.targetType, 'mixed');
  assert.equal(event.operation, 'batchRemove');
  assert.equal(event.changes.length, 3);
});

test('REV8: relación que consume interfaz stale falla antes de mutar', async () => {
  const model = await fx008WithFrontonRelation();
  const stale = structuredClone(model);
  stale.elements.find((item) => item.id === FX008_FRONTON_ID).thickness = 102.1;
  const input = stale.structuralIntent.interfaceIntents[0];
  const output = stale.structuralIntent.interfaceIntents[1];
  const before = structuredClone(stale);
  assert.throws(() => applyStructuralInterfaceTransaction(stale, {
    relations: [{
      ports: [
        { interfaceRef: input.interfaceId, interactionRole: 'receives' },
        { interfaceRef: output.interfaceId, interactionRole: 'delivers' }
      ],
      actionFamily: 'gravity', structuralFunction: 'loadTransfer', carrierRegions: []
    }]
  }, { recordUserAction: true }), (error) => error.code === 'SI-INTERFACE-STALE');
  assert.deepEqual(stale, before);
});

test('REV8: roundtrip nativo conserva interfaces y relaciones sin materializarlas en geometría agnóstica', async () => {
  const { serializeNativeProject } = await import('../src/core/nativeProjectFile.js');
  const { prepareModelImport } = await import('../src/core/modelSchema.js');
  const model = await fx008WithFrontonRelation();
  const geometryBefore = projectAgnosticGeometry(model);
  const serialized = serializeNativeProject(model);
  const reopened = prepareModelImport(JSON.parse(serialized)).model;
  assert.deepEqual(reopened.structuralIntent.interfaceIntents, model.structuralIntent.interfaceIntents);
  assert.deepEqual(reopened.structuralIntent.relationIntents, model.structuralIntent.relationIntents);
  assert.deepEqual(projectAgnosticGeometry(reopened), geometryBefore);
});

test('REV8: prepareModelImport migra v1.0 sin inventar interfaces ni relaciones', async () => {
  const { prepareModelImport } = await import('../src/core/modelSchema.js');
  const legacy = await loadFx008Model();
  legacy.structuralIntent = {
    schema: 'structural-intent-v1.0',
    elementIntents: legacy.structuralIntent?.elementIntents || [],
    roofIntents: legacy.structuralIntent?.roofIntents || [],
    intersectionIntents: legacy.structuralIntent?.intersectionIntents || [],
    supportIntents: legacy.structuralIntent?.supportIntents || [],
    diaphragmIntents: legacy.structuralIntent?.diaphragmIntents || [],
    overrides: legacy.structuralIntent?.overrides || []
  };
  const prepared = prepareModelImport(structuredClone(legacy)).model;
  assert.equal(prepared.structuralIntent.schema, STRUCTURAL_INTENT_SCHEMA);
  assert.deepEqual(prepared.structuralIntent.interfaceIntents, []);
  assert.deepEqual(prepared.structuralIntent.relationIntents, []);
});

test('REV8: transacciones equivalentes conservan orden canónico ante permutación de entrada', async () => {
  const source = await loadFx008Model();
  const inputs = [
    { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: { kind: 'face', side: 'positiveN', sRange: [12800, 14500], zRange: [3250, 4150] }, notes: 'B' },
    { ownerRef: { kind: 'element', id: FX008_FRONTON_ID }, locator: { kind: 'face', side: 'negativeN', sRange: [12800, 14500], zRange: [3250, 4150] }, notes: 'A' }
  ];
  const a = applyStructuralInterfaceTransaction(source, { interfaces: inputs }).model;
  const b = applyStructuralInterfaceTransaction(source, { interfaces: [...inputs].reverse() }).model;
  assert.deepEqual(a.structuralIntent.interfaceIntents, b.structuralIntent.interfaceIntents);
});
