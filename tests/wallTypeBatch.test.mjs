import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useModelStore } from '../src/store/useModelStore.js';

function wall(id, wallTypeId = null) {
  return {
    id,
    type: 'wall',
    ...(wallTypeId == null ? {} : { wallTypeId }),
    studs: [{ offset: 0 }],
    headers: [],
    osbCourses: [{ panels: [] }],
    osbNoggings: [],
    studsStale: false,
    osbStale: false
  };
}

function model() {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [
      wall('W1'),
      wall('W2'),
      wall('W3', 'T1'),
      { id: 'C1', type: 'column' }
    ],
    wallTypes: [
      { id: 'T1', name: 'Exterior', role: 'MP1' },
      { id: 'T2', name: 'Tabique', role: 'tabique' }
    ],
    library: {},
    projectParams: [],
    dimensions: [],
    roofSystems: [],
    roofPlanes: []
  };
}

beforeEach(() => {
  useModelStore.setState((state) => ({
    ...state,
    model: model(),
    past: [],
    future: []
  }));
});

test('SPEC-R5-D: asignación batch es atómica, invalida todos y crea un solo undo', () => {
  const result = useModelStore.getState().assignWallTypesBatch(['W1', 'W2', 'W1'], 'T2');
  let state = useModelStore.getState();

  assert.deepEqual(result, {
    ok: true,
    changed: true,
    wallIds: ['W1', 'W2']
  });
  assert.equal(state.past.length, 1);
  assert.equal(state.model.elements[0].wallTypeId, 'T2');
  assert.equal(state.model.elements[1].wallTypeId, 'T2');
  assert.equal(state.model.elements[0].studsStale, true);
  assert.equal(state.model.elements[0].osbStale, true);
  assert.equal(state.model.elements[1].studsStale, true);
  assert.equal(state.model.elements[1].osbStale, true);
  assert.equal(state.model.elements[2].studsStale, false);

  useModelStore.getState().undo();
  state = useModelStore.getState();
  assert.equal(Object.hasOwn(state.model.elements[0], 'wallTypeId'), false);
  assert.equal(Object.hasOwn(state.model.elements[1], 'wallTypeId'), false);
  assert.equal(state.model.elements[0].studsStale, false);
  assert.equal(state.model.elements[1].osbStale, false);
});

test('SPEC-R5-D: lote inválido o sin cambios no muta modelo ni historial', () => {
  const before = useModelStore.getState().model;

  assert.throws(
    () => useModelStore.getState().assignWallTypesBatch(['W1', 'missing'], 'T2'),
    /muro missing no existe/i
  );
  assert.throws(
    () => useModelStore.getState().assignWallTypesBatch(['C1'], 'T2'),
    /no existe como muro/i
  );
  assert.throws(
    () => useModelStore.getState().assignWallTypesBatch(['W1'], 'missing'),
    /tipo de muro missing no existe/i
  );
  assert.equal(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);

  assert.deepEqual(
    useModelStore.getState().assignWallTypesBatch(['W3'], 'T1'),
    { ok: true, changed: false, wallIds: [] }
  );
  assert.equal(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);
});
