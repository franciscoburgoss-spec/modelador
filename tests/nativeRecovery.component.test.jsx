import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let act;
let cleanup;
let fireEvent;
let render;
let screen;
let waitFor;
let AutosaveBanner;
let LegacyProjectMigrationBanner;
let ModelImportBanner;
let useAutosave;
let useLegacyProjectMigration;
let useModelStore;
let createProjectDocument;
let serializeAutosave;
let parseAutosave;
let LEGACY_PROJECT_STORAGE_KEY;
let dom;

function installDom() {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'tauri://localhost/'
  });
  for (const name of [
    'document',
    'Element',
    'Event',
    'HTMLElement',
    'HTMLButtonElement',
    'MouseEvent',
    'MutationObserver',
    'Node',
    'navigator',
    'window'
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: name === 'document' ? dom.window.document
        : name === 'navigator' ? dom.window.navigator
          : name === 'window' ? dom.window
            : dom.window[name],
      writable: true
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

function model(probe = 'initial') {
  return {
    modelVersion: 2,
    grid: {
      xAxes: [{ id: 'X0', position: 0 }],
      yAxes: [],
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
    projectInfo: {},
    roofSystems: [],
    roofPlanes: [],
    currentZLevelId: 'Z0',
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    viewMode: 'plan',
    persistenceProbe: probe
  };
}

function resetStore({ path = null } = {}) {
  useModelStore.setState({
    model: model(),
    projectDocument: createProjectDocument({ path }),
    modelImportFeedback: null,
    past: [],
    future: []
  });
}

function RecoveryHarness({ runtime }) {
  const autosave = useAutosave(runtime, { debounceMs: 5 });
  const feedback = useModelStore((state) => state.modelImportFeedback);
  return (
    <>
      <AutosaveBanner
        pending={autosave.pending}
        onRestore={autosave.restore}
        onDismiss={autosave.dismiss}
      />
      <ModelImportBanner feedback={feedback} onDismiss={() => {}} />
    </>
  );
}

function MigrationHarness({ runtime }) {
  const migration = useLegacyProjectMigration(runtime);
  const feedback = useModelStore((state) => state.modelImportFeedback);
  return (
    <>
      <LegacyProjectMigrationBanner
        candidates={migration.candidates}
        pendingId={migration.pendingId}
        onMigrate={migration.migrate}
        onDismiss={migration.dismiss}
      />
      <ModelImportBanner feedback={feedback} onDismiss={() => {}} />
    </>
  );
}

before(async () => {
  installDom();
  ({ act, cleanup, fireEvent, render, screen, waitFor } = await import(
    '@testing-library/react'
  ));
  ({ default: AutosaveBanner } = await import('../src/components/AutosaveBanner.jsx'));
  ({ default: LegacyProjectMigrationBanner } = await import(
    '../src/components/LegacyProjectMigrationBanner.jsx'
  ));
  ({ default: ModelImportBanner } = await import('../src/components/ModelImportBanner.jsx'));
  ({ useAutosave } = await import('../src/core/useAutosave.js'));
  ({ useLegacyProjectMigration } = await import(
    '../src/core/useLegacyProjectMigration.js'
  ));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
  ({ createProjectDocument } = await import('../src/core/projectDocument.js'));
  ({ serializeAutosave, parseAutosave } = await import('../src/core/autosave.js'));
  ({ LEGACY_PROJECT_STORAGE_KEY } = await import(
    '../src/core/legacyProjectMigration.js'
  ));
});

beforeEach(() => {
  resetStore();
  delete globalThis.localStorage;
});

afterEach(() => {
  cleanup();
  delete globalThis.localStorage;
});

after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('SPEC-004-D: recovery nativo se ofrece y restaura su ruta como documento sucio', async () => {
  const runtime = {
    loadRecoverySnapshot: async () => serializeAutosave(
      model('recovered'),
      1700000000000,
      '/p/recuperado.modelador.json'
    ),
    saveRecoverySnapshot: async () => {},
    clearRecoverySnapshot: async () => {}
  };

  render(<RecoveryHarness runtime={runtime} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar' }));

  const state = useModelStore.getState();
  assert.equal(state.model.persistenceProbe, 'recovered');
  assert.equal(state.projectDocument.path, '/p/recuperado.modelador.json');
  assert.equal(state.projectDocument.dirty, true);
  assert.deepEqual(state.past, []);
  assert.deepEqual(state.future, []);
});

test('SPEC-004-D: sólo dirty autoguarda y guardar correctamente limpia recovery', async () => {
  resetStore({ path: '/p/casa.modelador.json' });
  const saved = [];
  let cleared = 0;
  const runtime = {
    loadRecoverySnapshot: async () => null,
    saveRecoverySnapshot: async (content) => { saved.push(content); },
    clearRecoverySnapshot: async () => { cleared += 1; }
  };
  render(<RecoveryHarness runtime={runtime} />);
  await waitFor(() => assert.equal(screen.queryByText(/sesión sin guardar/), null));

  act(() => useModelStore.getState().addXAxis(1000, 'X1'));
  await waitFor(() => assert.equal(saved.length, 1));
  const snapshot = parseAutosave(saved[0]);
  assert.equal(snapshot.projectPath, '/p/casa.modelador.json');
  assert.equal(snapshot.model.grid.xAxes.length, 2);

  await act(async () => {
    await useModelStore.getState().saveProjectToPath({
      readText: async () => '',
      writeTextAtomic: async () => {}
    });
  });
  await waitFor(() => assert.equal(cleared, 1));
});

test('SPEC-004-D: recovery corrupto queda como error visible sin mutar el modelo', async () => {
  const runtime = {
    loadRecoverySnapshot: async () => '{broken',
    saveRecoverySnapshot: async () => {},
    clearRecoverySnapshot: async () => {}
  };
  const before = structuredClone(useModelStore.getState().model);

  render(<RecoveryHarness runtime={runtime} />);
  const alert = await screen.findByRole('alert');

  assert.match(alert.textContent, /JSON inválido/);
  assert.equal(useModelStore.getState().modelImportFeedback.code, 'AUTOSAVE_INVALID_JSON');
  assert.deepEqual(useModelStore.getState().model, before);
});

test('SPEC-004-D: una apertura limpia durante lectura descarta el recovery tardío', async () => {
  let releaseRead;
  let cleared = 0;
  const delayed = new Promise((resolve) => { releaseRead = resolve; });
  const runtime = {
    loadRecoverySnapshot: async () => delayed,
    saveRecoverySnapshot: async () => {},
    clearRecoverySnapshot: async () => { cleared += 1; }
  };

  render(<RecoveryHarness runtime={runtime} />);
  act(() => useModelStore.getState().newModel());
  releaseRead(serializeAutosave(model('stale'), 1, '/p/viejo.json'));

  await waitFor(() => assert.equal(cleared, 1));
  assert.equal(screen.queryByRole('button', { name: 'Recuperar' }), null);
  assert.notEqual(useModelStore.getState().model.persistenceProbe, 'stale');
});

test('SPEC-004-D: migración guarda y reabre antes de retirar la clave legacy', async () => {
  const events = [];
  const values = new Map([
    [LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(model('legacy'))]
  ]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      events.push('remove');
      values.delete(key);
    }
  };
  let persisted = null;
  const runtime = {
    fileSystem: {
      writeTextAtomic: async (_path, content) => {
        events.push('write');
        persisted = content;
      },
      readText: async () => {
        events.push('read');
        return persisted;
      }
    },
    chooseSavePath: async () => '/p/migrado.modelador.json',
    saveRecentPaths: async () => {}
  };

  render(<MigrationHarness runtime={runtime} />);
  fireEvent.click(await screen.findByRole('button', {
    name: 'Guardar Copia guardada en el navegador…'
  }));
  await waitFor(() => {
    assert.equal(useModelStore.getState().projectDocument.path, '/p/migrado.modelador.json');
  });

  assert.deepEqual(events.slice(0, 3), ['write', 'read', 'remove']);
  assert.equal(useModelStore.getState().model.persistenceProbe, 'legacy');
  assert.equal(useModelStore.getState().projectDocument.dirty, false);
  assert.equal(values.has(LEGACY_PROJECT_STORAGE_KEY), false);
  assert.equal(screen.queryByText(/datos del navegador/), null);
});

test('SPEC-004-D: cancelar destino conserva clave, modelo y documento', async () => {
  const values = new Map([
    [LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(model('legacy'))]
  ]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key)
  };
  const runtime = {
    fileSystem: {
      writeTextAtomic: async () => assert.fail('no debe escribir'),
      readText: async () => assert.fail('no debe leer')
    },
    chooseSavePath: async () => null
  };
  const beforeModel = structuredClone(useModelStore.getState().model);
  const beforeDocument = structuredClone(useModelStore.getState().projectDocument);

  render(<MigrationHarness runtime={runtime} />);
  fireEvent.click(await screen.findByRole('button', {
    name: 'Guardar Copia guardada en el navegador…'
  }));
  await waitFor(() => assert.equal(
    screen.getByRole('button', { name: 'Guardar Copia guardada en el navegador…' }).disabled,
    false
  ));

  assert.equal(values.has(LEGACY_PROJECT_STORAGE_KEY), true);
  assert.deepEqual(useModelStore.getState().model, beforeModel);
  assert.deepEqual(useModelStore.getState().projectDocument, beforeDocument);
});
