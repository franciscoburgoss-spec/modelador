import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createProjectDocument } from '../src/core/projectDocument.js';
import { useModelStore } from '../src/store/useModelStore.js';

function validModel(overrides = {}) {
  return {
    modelVersion: 2,
    grid: {
      xAxes: [{ id: 'X0', position: 0 }],
      yAxes: [{ id: 'Y0', position: 0 }],
      zLevels: [{ id: 'Z0', elevation: 0 }]
    },
    elements: [],
    wallTypes: [],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      metalconProfiles: [],
      materials: [],
      trussTemplates: []
    },
    projectParams: [],
    dimensions: [],
    roofSystems: [],
    roofPlanes: [],
    currentZLevelId: 'Z0',
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    viewMode: 'plan',
    ...overrides
  };
}

function resetStore(overrides = {}) {
  useModelStore.setState({
    model: validModel(),
    projectDocument: createProjectDocument(),
    modelImportFeedback: null,
    past: [],
    future: [],
    ...overrides
  });
}

function fileSystem({ raw = JSON.stringify(validModel()), write } = {}) {
  return {
    readText: async () => raw,
    writeTextAtomic: write ?? (async () => {})
  };
}

function activeSnapshot() {
  const state = useModelStore.getState();
  return {
    model: state.model,
    projectDocument: state.projectDocument,
    past: state.past,
    future: state.future
  };
}

beforeEach(() => resetStore());

test('SPEC-004-B: historial ensucia; navegación y estado transitorio no', () => {
  const actions = useModelStore.getState();
  actions.selectElement(null);
  actions.setCurrentZLevel('Z0');
  actions.setViewMode('plan');
  actions.zoomIn(800, 600);
  actions.toggleFilterPanel();
  assert.equal(useModelStore.getState().projectDocument.dirty, false);

  actions.addXAxis(1000, 'X1');
  assert.equal(useModelStore.getState().projectDocument.dirty, true);
  actions.undo();
  assert.equal(useModelStore.getState().projectDocument.dirty, true);
  actions.redo();
  assert.equal(useModelStore.getState().projectDocument.dirty, true);
});

test('SPEC-004-B: nuevo proyecto limpia modelo/historial/ruta y conserva recientes', () => {
  resetStore({
    projectDocument: createProjectDocument({
      path: '/p/casa.json',
      dirty: true,
      recentPaths: ['/p/casa.json']
    }),
    past: [validModel({ persistenceProbe: 'past' })],
    future: [validModel({ persistenceProbe: 'future' })]
  });
  useModelStore.getState().newModel();
  const state = useModelStore.getState();
  assert.equal(state.model.elements.length, 0);
  assert.equal(state.projectDocument.path, null);
  assert.equal(state.projectDocument.title, 'Sin título');
  assert.equal(state.projectDocument.dirty, false);
  assert.deepEqual(state.projectDocument.recentPaths, ['/p/casa.json']);
  assert.deepEqual(state.past, []);
  assert.deepEqual(state.future, []);
});

test('SPEC-004-B: una apertura inválida conserva atómicamente documento, modelo e historial', async () => {
  resetStore({
    projectDocument: createProjectDocument({
      path: '/p/vigente.json',
      dirty: true,
      recentPaths: ['/p/vigente.json']
    }),
    past: [validModel({ persistenceProbe: 'past' })],
    future: [validModel({ persistenceProbe: 'future' })]
  });
  const before = structuredClone(activeSnapshot());

  const result = await useModelStore.getState().openProjectFromPath(
    fileSystem({ raw: '{"grid":' }),
    '/p/roto.json'
  );

  assert.equal(result.ok, false);
  assert.deepEqual(activeSnapshot(), before);
  assert.equal(useModelStore.getState().modelImportFeedback.severity, 'error');
  assert.equal(useModelStore.getState().modelImportFeedback.code, 'INVALID_JSON');
});

test('SPEC-004-B: abrir aplica modelo/documento y limpia ambos historiales en un commit', async () => {
  resetStore({
    projectDocument: createProjectDocument({
      path: '/p/anterior.json',
      dirty: true,
      recentPaths: ['/p/anterior.json']
    }),
    past: [validModel()],
    future: [validModel()]
  });
  const openedModel = validModel({ modelVersion: 1, persistenceProbe: 'opened' });

  const result = await useModelStore.getState().openProjectFromPath(
    fileSystem({ raw: JSON.stringify(openedModel) }),
    '/p/nuevo.modelador.json'
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.appliedMigrations, ['1->2']);
  assert.equal(result.warnings[0].code, 'LEGACY_MODEL_MIGRATED');
  const state = useModelStore.getState();
  assert.equal(state.model.persistenceProbe, 'opened');
  assert.deepEqual(state.projectDocument, {
    path: '/p/nuevo.modelador.json',
    title: 'nuevo.modelador.json',
    dirty: false,
    recentPaths: ['/p/nuevo.modelador.json', '/p/anterior.json']
  });
  assert.deepEqual(state.past, []);
  assert.deepEqual(state.future, []);
  assert.equal(state.modelImportFeedback.severity, 'warning');
  assert.equal(state.modelImportFeedback.code, 'LEGACY_MODEL_MIGRATED');
});

test('SPEC-004-B: guardar exige ruta y un fallo no altera la sesión activa', async () => {
  const actions = useModelStore.getState();
  const beforeMissing = structuredClone(activeSnapshot());
  const missing = await actions.saveProjectToPath(fileSystem());
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'PROJECT_PATH_REQUIRED');
  assert.deepEqual(activeSnapshot(), beforeMissing);

  resetStore({
    projectDocument: createProjectDocument({
      path: '/p/vigente.json',
      dirty: true,
      recentPaths: ['/p/vigente.json']
    })
  });
  const beforeFailure = structuredClone(activeSnapshot());
  const failed = await useModelStore.getState().saveProjectToPath(fileSystem({
    write: async () => { throw new Error('ENOSPC'); }
  }));
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'PROJECT_WRITE_FAILED');
  assert.deepEqual(activeSnapshot(), beforeFailure);
});

test('SPEC-004-B: guardar como registra ruta y sólo limpia el snapshot que terminó', async () => {
  useModelStore.getState().addXAxis(1000, 'X1');
  const writes = [];
  const saved = await useModelStore.getState().saveProjectToPath(fileSystem({
    write: async (...args) => { writes.push(args); }
  }), '/p/guardado-como.json');
  assert.equal(saved.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(useModelStore.getState().projectDocument.path, '/p/guardado-como.json');
  assert.equal(useModelStore.getState().projectDocument.dirty, false);

  let releaseWrite;
  const delayed = fileSystem({
    write: () => new Promise((resolve) => { releaseWrite = resolve; })
  });
  useModelStore.getState().addYAxis(1000, 'Y1');
  const pending = useModelStore.getState().saveProjectToPath(delayed, '/p/lento.json');
  await new Promise((resolve) => setTimeout(resolve, 0));
  useModelStore.getState().addXAxis(2000, 'X2');
  releaseWrite();
  assert.equal((await pending).ok, true);
  assert.equal(useModelStore.getState().projectDocument.path, '/p/lento.json');
  assert.equal(useModelStore.getState().projectDocument.dirty, true);
});
