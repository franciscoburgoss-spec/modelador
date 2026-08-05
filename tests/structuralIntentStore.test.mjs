import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyStructuralIntent } from '../src/core/structuralIntent.js';
import { useModelStore } from '../src/store/useModelStore.js';

function model(overrides = {}) {
  return {
    modelVersion: 3,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [{ id: 'W1', type: 'wall', openings: [] }],
    wallTypes: [],
    library: {
      wallSections: [], columnSections: [], beamSections: [], openingTemplates: [],
      foundationSections: [], metalconProfiles: [], materials: [], trussTemplates: []
    },
    projectParams: [],
    dimensions: [],
    roofSystems: [],
    roofPlanes: [],
    structuralIntent: createEmptyStructuralIntent(),
    structuralIntentFindings: [],
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    currentZLevelId: null,
    viewMode: 'plan',
    ...overrides
  };
}

function reset(nextModel = model()) {
  useModelStore.setState({ model: nextModel, past: [], future: [] });
}

test('SPEC-015-A: las mutaciones del store entran al historial y exponen IDs afectados', () => {
  reset();
  const created = useModelStore.getState().setElementIntent('W1', {
    participation: 'resistant',
    functions: ['gravityResistance']
  });
  assert.deepEqual(created.affectedElementIds, ['W1']);
  assert.equal(useModelStore.getState().past.length, 1);
  assert.equal(useModelStore.getState().model.structuralIntent.elementIntents.length, 1);

  const removed = useModelStore.getState().removeElementIntent('W1');
  assert.deepEqual(removed.affectedElementIds, ['W1']);
  assert.equal(useModelStore.getState().past.length, 2);
  assert.deepEqual(useModelStore.getState().model.structuralIntent, createEmptyStructuralIntent());

  useModelStore.getState().setElementIntent('W1', {
    participation: 'undetermined',
    functions: []
  });
  const cleared = useModelStore.getState().clearStructuralIntent();
  assert.deepEqual(cleared.affectedElementIds, ['W1']);
  assert.deepEqual(useModelStore.getState().model.structuralIntent, createEmptyStructuralIntent());
});

test('SPEC-015-A: eliminar desde el store limpia intención y no deja referencias colgantes', () => {
  reset(model({ selectedElementId: 'W1' }));
  useModelStore.getState().setElementIntent('W1', {
    participation: 'resistant',
    functions: ['support']
  });
  useModelStore.getState().deleteSelectedElement();
  const state = useModelStore.getState();
  assert.equal(state.model.elements.length, 0);
  assert.deepEqual(state.model.structuralIntent.elementIntents, []);
  assert.deepEqual(state.model.structuralIntentFindings, []);
});
