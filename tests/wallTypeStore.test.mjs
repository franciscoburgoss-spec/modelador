import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';

const library = {
  wallSections: [],
  columnSections: [],
  beamSections: [],
  openingTemplates: [],
  foundationSections: [],
  materials: [],
  trussTemplates: [],
  metalconProfiles: [
    { id: 'C90', shape: 'C' },
    { id: 'U90', shape: 'U' },
    { id: 'C60', shape: 'C' },
    { id: 'U60', shape: 'U' }
  ]
};

const exterior = {
  id: 'T90',
  name: 'Exterior 90',
  role: 'MP1',
  metalconDefaults: {
    spacing: 600,
    studProfileId: 'C90',
    trackProfileId: 'U90',
    materialId: null
  },
  osbDefaults: {
    panelWidth: 1220,
    panelHeight: 2440,
    minPanelWidth: 200,
    gap: 5
  }
};

const tabique = {
  id: 'T60',
  name: 'Tabique 60',
  role: 'tabique',
  metalconDefaults: {
    spacing: 400,
    studProfileId: 'C60',
    trackProfileId: 'U60',
    materialId: null
  },
  osbDefaults: {
    panelWidth: 1200,
    panelHeight: 2400,
    minPanelWidth: 250,
    gap: 3
  }
};

function wall(id, wallTypeId) {
  return {
    id,
    type: 'wall',
    ...(wallTypeId == null ? {} : { wallTypeId }),
    framingStudProfileId: 'C90',
    studSpacing: 500,
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
    elements: [wall('W1', 'T90'), wall('W2', 'T60'), wall('W3', null)],
    wallTypes: [structuredClone(exterior), structuredClone(tabique)],
    library: structuredClone(library),
    projectParams: [],
    dimensions: [],
    roofSystems: [],
    roofPlanes: [],
    osbDefaults: {},
    metalconDefaults: null
  };
}

function resetStore() {
  useModelStore.setState((state) => ({
    ...state,
    model: model(),
    past: [],
    future: []
  }));
}

beforeEach(resetStore);

test('R5-B: crear valida el contrato y entra una sola vez al historial con ID estable', () => {
  const input = {
    name: 'Interior MP3',
    role: 'MP3',
    metalconDefaults: { ...tabique.metalconDefaults },
    osbDefaults: { ...tabique.osbDefaults }
  };
  const result = useModelStore.getState().addWallType(input);
  let state = useModelStore.getState();

  assert.equal(result.ok, true);
  assert.ok(result.wallTypeId != null);
  assert.equal(state.model.wallTypes.length, 3);
  assert.equal(state.model.wallTypes[2].id, result.wallTypeId);
  assert.equal(state.past.length, 1);
  assert.equal(Object.hasOwn(input, 'id'), false, 'el store no muta el formulario');

  useModelStore.getState().undo();
  assert.equal(useModelStore.getState().model.wallTypes.length, 2);
  useModelStore.getState().redo();
  state = useModelStore.getState();
  assert.equal(state.model.wallTypes[2].id, result.wallTypeId);

  const before = state.model;
  const historyLength = state.past.length;
  assert.throws(
    () => useModelStore.getState().addWallType({ ...input, role: 'mp1' }),
    /role/i
  );
  assert.equal(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, historyLength);
});

test('R5-B: renombrar no invalida; rol/defaults invalidan sólo muros usuarios y nunca regeneran', () => {
  useModelStore.getState().updateWallType('T90', { name: 'Exterior principal' });
  let state = useModelStore.getState();
  assert.equal(state.model.wallTypes[0].name, 'Exterior principal');
  assert.ok(state.model.elements.every((item) => item.studsStale === false));
  assert.ok(state.model.elements.every((item) => item.osbStale === false));
  assert.equal(state.past.length, 1);

  useModelStore.getState().undo();
  assert.equal(useModelStore.getState().model.wallTypes[0].name, 'Exterior 90');

  resetStore();
  const beforeStuds = structuredClone(useModelStore.getState().model.elements[0].studs);
  useModelStore.getState().updateWallType('T90', { role: 'MP2' });
  state = useModelStore.getState();
  const [affected, otherType, legacy] = state.model.elements;
  assert.equal(affected.studsStale, true);
  assert.equal(affected.osbStale, true);
  assert.deepEqual(affected.studs, beforeStuds, 'invalidar no regenera ni borra resultados');
  assert.equal(otherType.studsStale, false);
  assert.equal(otherType.osbStale, false);
  assert.equal(legacy.studsStale, false);
  assert.equal(legacy.osbStale, false);

  resetStore();
  useModelStore.getState().updateWallType('T90', {
    metalconDefaults: { spacing: 300 }
  });
  state = useModelStore.getState();
  assert.equal(state.model.wallTypes[0].metalconDefaults.spacing, 300);
  assert.equal(state.model.wallTypes[0].metalconDefaults.studProfileId, 'C90');
  assert.equal(state.model.elements[0].studsStale, true);
  assert.equal(state.model.elements[1].studsStale, false);
});

test('R5-B: editar rechaza ID mutable o configuración inválida de forma atómica', () => {
  const before = useModelStore.getState().model;
  assert.throws(
    () => useModelStore.getState().updateWallType('T90', { id: 'otro' }),
    /id.*inmutable/i
  );
  assert.throws(
    () => useModelStore.getState().updateWallType('T90', {
      osbDefaults: { minPanelWidth: 199 }
    }),
    /número finito|minPanelWidth/i
  );
  assert.throws(
    () => useModelStore.getState().updateWallType('missing', { name: 'Otro' }),
    /tipo.*no existe/i
  );
  assert.throws(
    () => useModelStore.getState().assignWallType('missing', 'T90'),
    /muro.*no existe/i
  );
  assert.deepEqual(useModelStore.getState().removeWallType('missing'), {
    ok: false,
    error: 'El tipo missing no existe.',
    wallIds: []
  });
  assert.equal(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);
});

test('R5-B: asignar, cambiar o quitar tipo invalida sólo ese muro y admite undo/redo', () => {
  const overrides = {
    framingStudProfileId: useModelStore.getState().model.elements[0].framingStudProfileId,
    studSpacing: useModelStore.getState().model.elements[0].studSpacing
  };
  let result = useModelStore.getState().assignWallType('W1', 'T60');
  let state = useModelStore.getState();
  let changed = state.model.elements[0];

  assert.deepEqual(result, { ok: true, changed: true });
  assert.equal(changed.wallTypeId, 'T60');
  assert.equal(changed.studsStale, true);
  assert.equal(changed.osbStale, true);
  assert.equal(changed.framingStudProfileId, overrides.framingStudProfileId);
  assert.equal(changed.studSpacing, overrides.studSpacing);
  assert.equal(state.model.elements[1].studsStale, false);
  assert.equal(state.past.length, 1);

  useModelStore.getState().undo();
  assert.equal(useModelStore.getState().model.elements[0].wallTypeId, 'T90');
  assert.equal(useModelStore.getState().model.elements[0].studsStale, false);
  useModelStore.getState().redo();
  assert.equal(useModelStore.getState().model.elements[0].wallTypeId, 'T60');

  resetStore();
  result = useModelStore.getState().assignWallType('W1', null);
  changed = useModelStore.getState().model.elements[0];
  assert.deepEqual(result, { ok: true, changed: true });
  assert.equal(Object.hasOwn(changed, 'wallTypeId'), false);
  assert.equal(changed.studsStale, true);
  assert.equal(changed.osbStale, true);

  const pastLength = useModelStore.getState().past.length;
  assert.deepEqual(
    useModelStore.getState().assignWallType('W1', null),
    { ok: true, changed: false }
  );
  assert.equal(useModelStore.getState().past.length, pastLength);
  assert.throws(
    () => useModelStore.getState().assignWallType('W1', 'missing'),
    /tipo.*no existe/i
  );
});

test('R5-B: eliminar bloquea tipos usados y borra sólo tipos libres con historial', () => {
  const blocked = useModelStore.getState().removeWallType('T90');
  assert.deepEqual(blocked, {
    ok: false,
    error: 'El tipo T90 está asignado a 1 muro(s).',
    wallIds: ['W1']
  });
  assert.equal(useModelStore.getState().model.wallTypes.length, 2);
  assert.equal(useModelStore.getState().past.length, 0);

  useModelStore.getState().assignWallType('W2', null);
  const historyBeforeRemove = useModelStore.getState().past.length;
  const removed = useModelStore.getState().removeWallType('T60');
  assert.deepEqual(removed, { ok: true, wallTypeId: 'T60' });
  assert.deepEqual(
    useModelStore.getState().model.wallTypes.map((item) => item.id),
    ['T90']
  );
  assert.equal(useModelStore.getState().past.length, historyBeforeRemove + 1);

  useModelStore.getState().undo();
  assert.deepEqual(
    useModelStore.getState().model.wallTypes.map((item) => item.id),
    ['T90', 'T60']
  );
});
