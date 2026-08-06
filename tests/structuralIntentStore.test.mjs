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

test('SPEC-015-C: no-op individual no crea historial ni traza', () => {
  reset();
  const input = {
    participation: 'undetermined',
    functions: [],
    secondaryInteraction: 'notApplicable'
  };
  useModelStore.getState().setElementIntent('W1', input);
  const afterFirst = useModelStore.getState();
  assert.equal(afterFirst.past.length, 1);
  assert.equal(afterFirst.model.structuralIntentTrace.events.length, 1);

  const outcome = afterFirst.setElementIntent('W1', input);
  const afterNoOp = useModelStore.getState();
  assert.deepEqual(outcome.affectedElementIds, []);
  assert.equal(afterNoOp.past.length, 1);
  assert.equal(afterNoOp.model.structuralIntentTrace.events.length, 1);
});

test('SPEC-015-C: lote confirmado es un paso atómico de historial y traza', () => {
  reset(model({
    elements: [
      { id: 1, type: 'wall', openings: [] },
      { id: 2, type: 'wall', openings: [] },
      { id: '2', type: 'wall', openings: [] }
    ]
  }));
  const original = structuredClone(useModelStore.getState().model);
  const result = useModelStore.getState().setElementIntentsBatch(['2', 2, 1], {
    participation: 'secondary',
    functions: ['spaceDivision'],
    secondaryInteraction: 'solidary',
    notesMode: 'preserve'
  });
  let state = useModelStore.getState();
  assert.deepEqual(result.affectedElementIds, [1, 2, '2']);
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralIntent.elementIntents.length, 3);
  assert.equal(state.model.structuralIntentTrace.events.length, 1);
  assert.equal(state.model.structuralIntentTrace.events[0].operation, 'batchSet');

  state.undo();
  state = useModelStore.getState();
  assert.deepEqual(state.model, original);
  assert.equal(state.future.length, 1);

  state.redo();
  state = useModelStore.getState();
  assert.equal(state.model.structuralIntent.elementIntents.length, 3);
  assert.equal(state.model.structuralIntentTrace.events.length, 1);
  assert.equal(state.past.length, 1);
});

test('SPEC-015-C: lote inválido o stale conserva exactamente el modelo', () => {
  reset(model({
    elements: [
      { id: 'W1', type: 'wall', openings: [] },
      { id: 'W2', type: 'wall', openings: [] }
    ]
  }));
  const before = structuredClone(useModelStore.getState().model);
  assert.throws(() => useModelStore.getState().setElementIntentsBatch(['W1', 'MISSING'], {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve'
  }));
  assert.deepEqual(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);

  assert.throws(() => useModelStore.getState().setElementIntentsBatch(['W1'], {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve'
  }, { expectedPrevious: [{ targetType: 'element', targetId: 'W1', fingerprint: '0'.repeat(64) }] }));
  assert.deepEqual(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);
});
