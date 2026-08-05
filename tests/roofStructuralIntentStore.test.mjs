import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { projectAgnosticRoofGeometry } from '../src/core/agnosticGeometry.js';
import {
  ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE,
  canonicalizeRoofBoundaries
} from '../src/core/structuralIntent.js';
import { useModelStore } from '../src/store/useModelStore.js';

async function loadFx008() {
  return JSON.parse(await readFile(new URL('fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
}

function reset(model) {
  useModelStore.setState({ model, past: [], future: [] });
}

test('SPEC-015-B: store integra set/remove/clear con historial y resultados completos', async () => {
  const model = await loadFx008();
  reset(model);
  const [geometry] = projectAgnosticRoofGeometry(model, [1785030887081]);
  const edge = canonicalizeRoofBoundaries(geometry)[0];
  const created = useModelStore.getState().setRoofIntent(1785030887081, {
    loadDistribution: 'oneWay',
    primaryResistanceDirection: { x: 1, y: 0 },
    boundaryIntents: [{ boundaryId: edge.boundaryId, function: 'gravitySupport' }]
  });
  assert.deepEqual(created, {
    affectedElementIds: [],
    affectedRoofGeometryIds: [1785030887081],
    invalidatedStructuralDerivatives: []
  });
  assert.equal(useModelStore.getState().past.length, 1);

  const removed = useModelStore.getState().removeRoofIntent(1785030887081);
  assert.deepEqual(removed.affectedRoofGeometryIds, [1785030887081]);
  assert.equal(useModelStore.getState().model.structuralIntent.roofIntents.length, 0);

  useModelStore.getState().setRoofIntent(1785030887081, {});
  const cleared = useModelStore.getState().clearStructuralIntent();
  assert.deepEqual(cleared.affectedRoofGeometryIds, [1785030887081]);
  assert.equal(useModelStore.getState().model.structuralIntent.roofIntents.length, 0);
});

test('SPEC-015-B: reconciliación y finding forman un único paso atómico de undo/redo', async () => {
  const model = await loadFx008();
  reset(model);
  const [geometry] = projectAgnosticRoofGeometry(model, [1785030887081]);
  const edge = canonicalizeRoofBoundaries(geometry).find((item) => item.start.y === 0 && item.end.y === 0);
  useModelStore.getState().setRoofIntent(1785030887081, {
    boundaryIntents: [{ boundaryId: edge.boundaryId, function: 'gravitySupport' }]
  });
  const beforeGeometryChange = structuredClone(useModelStore.getState().model);
  const plane = beforeGeometryChange.roofPlanes.find((item) => item.id === 1785030887081);
  const polygon = plane.polygon.flatMap((point, index) => (
    index === 1 ? [point, { x: 9000, y: 0 }] : [point]
  ));
  useModelStore.getState().updateRoofPlane(1785030887081, { polygon });
  let state = useModelStore.getState();
  assert.equal(state.model.structuralIntent.roofIntents[0].boundaryIntents.length, 0);
  assert.equal(state.model.structuralIntentFindings[0].code, ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE);

  state.undo();
  state = useModelStore.getState();
  assert.deepEqual(state.model, beforeGeometryChange);

  state.redo();
  state = useModelStore.getState();
  assert.equal(state.model.structuralIntent.roofIntents[0].boundaryIntents.length, 0);
  assert.equal(state.model.structuralIntentFindings.length, 1);
});

test('SPEC-015-B: quitar cubierta limpia intención y cambiar perfiles no reconcilia', async () => {
  const model = await loadFx008();
  reset(model);
  useModelStore.getState().setRoofIntent(1785030887081, {});
  const intentBefore = structuredClone(useModelStore.getState().model.structuralIntent);
  useModelStore.getState().updateRoofPlane(1785030887081, {
    profiles: { ...model.roofPlanes[0].profiles, topChord: 'TEST' }
  });
  assert.deepEqual(useModelStore.getState().model.structuralIntent, intentBefore);
  assert.deepEqual(useModelStore.getState().model.structuralIntentFindings, []);

  useModelStore.getState().removeRoofPlane(1785030887081);
  assert.equal(useModelStore.getState().model.structuralIntent.roofIntents.length, 0);
  assert.equal(useModelStore.getState().model.structuralIntentFindings.length, 0);
});
