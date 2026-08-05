import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { projectAgnosticRoofGeometry } from '../src/core/agnosticGeometry.js';
import {
  ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE,
  StructuralIntentError,
  canonicalizeResistanceDirection,
  canonicalizeRoofBoundaries,
  canonicalizeStructuralIntent,
  createEmptyStructuralIntent,
  reconcileStructuralIntentAfterGeometryChange,
  removeRoofIntent,
  setRoofIntent,
  validateStructuralIntent
} from '../src/core/structuralIntent.js';

async function loadFx008() {
  return JSON.parse(await readFile(new URL('fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
}

function roof(id, boundary) {
  return { id, source: 'test', surface: { kind: 'planar-polygon', boundary } };
}

const square = [
  { x: 0, y: 0, z: 0 },
  { x: 1000, y: 0, z: 0 },
  { x: 1000, y: 500, z: 100 },
  { x: 0, y: 500, z: 100 }
];

function ids(boundaries) {
  return boundaries.map((boundary) => boundary.boundaryId);
}

test('SPEC-015-B: bordes son invariantes a inversión, rotación inicial y cierre duplicado', () => {
  const baseline = canonicalizeRoofBoundaries(roof('R', square));
  const reversed = canonicalizeRoofBoundaries(roof('R', [...square].reverse()));
  const rotated = canonicalizeRoofBoundaries(roof('R', [...square.slice(2), ...square.slice(0, 2)]));
  const closed = canonicalizeRoofBoundaries(roof('R', [...square, square[0]]));
  assert.deepEqual(ids(reversed), ids(baseline));
  assert.deepEqual(ids(rotated), ids(baseline));
  assert.deepEqual(ids(closed), ids(baseline));
});

test('SPEC-015-B: Z no participa en boundaryId y cubiertas distintas no comparten identidad', () => {
  const baseline = canonicalizeRoofBoundaries(roof(1, square));
  const elevated = canonicalizeRoofBoundaries(roof(1, square.map((point) => ({ ...point, z: point.z + 900 }))));
  const otherRoof = canonicalizeRoofBoundaries(roof('1', square));
  assert.deepEqual(ids(elevated), ids(baseline));
  assert.notDeepEqual(ids(otherRoof), ids(baseline));
  assert.notDeepEqual(elevated.map((edge) => edge.zRange), baseline.map((edge) => edge.zRange));
});

test('SPEC-015-B: bordes degenerados, duplicados y números no finitos fallan tipados', () => {
  assert.throws(
    () => canonicalizeRoofBoundaries(roof('D', [square[0], { x: 0.05, y: 0, z: 0 }, square[2]])),
    (error) => error.code === 'SI-ROOF-BOUNDARY-DEGENERATE'
  );
  assert.throws(
    () => canonicalizeRoofBoundaries(roof('X', [square[0], square[1], square[0], square[3]])),
    (error) => error.code === 'SI-ROOF-BOUNDARY-DUPLICATE'
  );
  assert.throws(
    () => canonicalizeRoofBoundaries(roof('N', [{ ...square[0], x: Number.NaN }, ...square.slice(1)])),
    (error) => error.code === 'SI-ROOF-BOUNDARY-NON-FINITE'
  );
});

test('SPEC-015-B: v y -v canonicalizan igual; twoWay paralela y local con dirección se rechazan', () => {
  assert.deepEqual(
    canonicalizeResistanceDirection({ x: 3, y: -4 }),
    canonicalizeResistanceDirection({ x: -3, y: 4 })
  );
  const geometry = [roof('R', square)];
  const base = createEmptyStructuralIntent();
  const parallel = {
    ...base,
    roofIntents: [{
      intentId: 'intent:roof:R', roofGeometryId: 'R', loadDistribution: 'twoWay',
      primaryResistanceDirection: { x: 1, y: 0 },
      secondaryResistanceDirection: { x: -2, y: 0 },
      diaphragmBehavior: 'undetermined', boundaryIntents: [],
      status: 'declared', source: 'userDeclared', notes: null
    }]
  };
  assert.ok(validateStructuralIntent(parallel, [], geometry).some((issue) => issue.code === 'SI-ROOF-DIRECTIONS-PARALLEL'));
  const local = structuredClone(parallel);
  local.roofIntents[0].loadDistribution = 'local';
  local.roofIntents[0].secondaryResistanceDirection = null;
  assert.ok(validateStructuralIntent(local, [], geometry).some((issue) => issue.code === 'SI-ROOF-DIRECTION-COMBINATION-INVALID'));
});

test('SPEC-015-B: setRoofIntent valida pertenencia, ordena bordes y no toca derivados constructivos', async () => {
  const model = await loadFx008();
  const roofs = projectAgnosticRoofGeometry(model, [1785030887081, 1785161146258]);
  const firstEdges = canonicalizeRoofBoundaries(roofs.find((item) => item.id === 1785030887081));
  const otherEdge = canonicalizeRoofBoundaries(roofs.find((item) => item.id === 1785161146258))[0];
  const beforeConstructive = JSON.stringify(model.roofPlanes[0].profiles);
  assert.throws(
    () => setRoofIntent(model, 1785030887081, {
      boundaryIntents: [{ boundaryId: otherEdge.boundaryId, function: 'gravitySupport' }]
    }),
    (error) => error instanceof StructuralIntentError
      && error.details.some((issue) => issue.code === 'SI-ROOF-BOUNDARY-REFERENCE-NOT-FOUND')
  );
  const outcome = setRoofIntent(model, 1785030887081, {
    loadDistribution: 'oneWay',
    primaryResistanceDirection: { x: 0, y: -8 },
    diaphragmBehavior: 'candidate',
    boundaryIntents: [
      { boundaryId: firstEdges[2].boundaryId, function: 'geometricBoundary' },
      { boundaryId: firstEdges[0].boundaryId, function: 'gravitySupport' }
    ]
  });
  assert.deepEqual(outcome.affectedElementIds, []);
  assert.deepEqual(outcome.affectedRoofGeometryIds, [1785030887081]);
  assert.deepEqual(outcome.invalidatedStructuralDerivatives, []);
  assert.deepEqual(
    outcome.model.structuralIntent.roofIntents[0].boundaryIntents.map((item) => item.boundaryId),
    [firstEdges[0].boundaryId, firstEdges[2].boundaryId].sort()
  );
  assert.deepEqual(outcome.model.structuralIntent.roofIntents[0].primaryResistanceDirection, { x: 0, y: 1 });
  assert.equal(JSON.stringify(outcome.model.roofPlanes[0].profiles), beforeConstructive);
});

test('SPEC-015-B: orden mixto número/texto es determinista', () => {
  const common = {
    loadDistribution: 'undetermined', primaryResistanceDirection: null,
    secondaryResistanceDirection: null, diaphragmBehavior: 'undetermined',
    boundaryIntents: [], status: 'declared', source: 'userDeclared', notes: null
  };
  const canonical = canonicalizeStructuralIntent({
    ...createEmptyStructuralIntent(),
    roofIntents: [
      { ...common, intentId: 'intent:roof:2', roofGeometryId: '2' },
      { ...common, intentId: 'intent:roof:10', roofGeometryId: 10 },
      { ...common, intentId: 'intent:roof:2', roofGeometryId: 2 },
      { ...common, intentId: 'intent:roof:10', roofGeometryId: '10' }
    ]
  });
  assert.deepEqual(canonical.roofIntents.map((intent) => [typeof intent.roofGeometryId, intent.roofGeometryId]), [
    ['number', 10], ['number', 2], ['string', '10'], ['string', '2']
  ]);
});

test('SPEC-015-B: desaparición de borde retira sólo la declaración y crea finding sin reasignar por índice', async () => {
  const model = await loadFx008();
  const [geometry] = projectAgnosticRoofGeometry(model, [1785030887081]);
  const bottom = canonicalizeRoofBoundaries(geometry).find((edge) => (
    edge.start.y === 0 && edge.end.y === 0
  ));
  const declared = setRoofIntent(model, 1785030887081, {
    boundaryIntents: [{ boundaryId: bottom.boundaryId, function: 'gravitySupport' }]
  }).model;
  const plane = declared.roofPlanes.find((item) => item.id === 1785030887081);
  const polygon = plane.polygon.flatMap((point, index) => (
    index === 1 ? [point, { x: 9000, y: 0 }] : [point]
  ));
  const next = {
    ...declared,
    roofPlanes: declared.roofPlanes.map((item) => item.id === plane.id ? { ...item, polygon } : item)
  };
  const reconciled = reconcileStructuralIntentAfterGeometryChange(declared, next);
  const intent = reconciled.structuralIntent.roofIntents[0];
  assert.deepEqual(intent.boundaryIntents, []);
  assert.equal(reconciled.structuralIntentFindings.length, 1);
  assert.equal(reconciled.structuralIntentFindings[0].code, ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE);
  assert.deepEqual(reconciled.structuralIntentFindings[0].removedBoundaryIds, [bottom.boundaryId]);
  assert.deepEqual(reconciled.structuralIntentFindings[0].removedBoundaryIntents, [{
    boundaryId: bottom.boundaryId, function: 'gravitySupport', source: 'userDeclared'
  }]);
});

test('SPEC-015-B: cambio constructivo no reconcilia; cubierta irresoluble falla antes de devolver modelo', async () => {
  const model = await loadFx008();
  const declared = setRoofIntent(model, 1785030887081, {}).model;
  const plane = declared.roofPlanes.find((item) => item.id === 1785030887081);
  const constructive = {
    ...declared,
    roofPlanes: declared.roofPlanes.map((item) => item.id === plane.id
      ? { ...item, profiles: { ...item.profiles, topChord: 'TEST' } }
      : item)
  };
  const reconciled = reconcileStructuralIntentAfterGeometryChange(declared, constructive);
  assert.deepEqual(reconciled.structuralIntent, declared.structuralIntent);
  assert.deepEqual(reconciled.structuralIntentFindings, declared.structuralIntentFindings);
  assert.equal(reconciled.roofPlanes.find((item) => item.id === plane.id).profiles.topChord, 'TEST');

  const broken = {
    ...declared,
    roofPlanes: declared.roofPlanes.map((item) => item.id === plane.id
      ? { ...item, supportLevelId: 'missing-level' }
      : item)
  };
  assert.throws(
    () => reconcileStructuralIntentAfterGeometryChange(declared, broken),
    (error) => error.code === 'SI-ROOF-GEOMETRY-UNRESOLVABLE'
  );
  assert.equal(declared.roofPlanes.find((item) => item.id === plane.id).supportLevelId, 1784556741132);
});

test('SPEC-015-B: eliminar cubierta elimina intención y finding; removeRoofIntent conserva cubierta', async () => {
  const model = await loadFx008();
  const declared = setRoofIntent(model, 1785030887081, {}).model;
  const removedIntent = removeRoofIntent(declared, 1785030887081);
  assert.equal(removedIntent.model.structuralIntent.roofIntents.length, 0);
  assert.equal(removedIntent.model.roofPlanes.length, 7);

  const deletedRoof = {
    ...declared,
    roofPlanes: declared.roofPlanes.filter((item) => item.id !== 1785030887081)
  };
  const reconciled = reconcileStructuralIntentAfterGeometryChange(declared, deletedRoof);
  assert.equal(reconciled.structuralIntent.roofIntents.length, 0);
  assert.equal(reconciled.structuralIntentFindings.length, 0);
});
