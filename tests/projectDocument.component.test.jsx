import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let act;
let cleanup;
let fireEvent;
let render;
let screen;
let waitFor;
let MenuBar;
let useModelStore;
let createProjectDocument;
let dom;

function installDom() {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/'
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
  globalThis.confirm = () => true;
}

function model(probe = 'initial') {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
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
    persistenceProbe: probe
  };
}

function resetStore() {
  useModelStore.setState({
    model: model(),
    projectDocument: createProjectDocument(),
    modelImportFeedback: null,
    past: [],
    future: []
  });
}

function openFileMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
}

before(async () => {
  installDom();
  ({ act, cleanup, fireEvent, render, screen, waitFor } = await import(
    '@testing-library/react'
  ));
  ({ default: MenuBar } = await import('../src/components/MenuBar.jsx'));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
  ({ createProjectDocument } = await import('../src/core/projectDocument.js'));
});

beforeEach(resetStore);
afterEach(() => cleanup());

after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  delete globalThis.confirm;
});

test('SPEC-004-B: sin runtime nativo conserva flujos web y deshabilita sólo los nativos', () => {
  render(<MenuBar onOpenModal={() => {}} canvasSize={{ width: 800, height: 600 }} />);
  assert.equal(screen.getByLabelText('Documento activo').textContent, 'Sin título');
  openFileMenu();
  assert.equal(screen.getByRole('button', { name: 'Abrir…' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Guardar' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Guardar como…' }).disabled, true);
  assert.ok(screen.getByRole('button', { name: 'Guardar copia en navegador' }));
  assert.ok(screen.getByRole('button', { name: 'Cargar copia del navegador' }));
});

test('SPEC-004-B: menú coordina abrir, dirty, guardar como y recientes', async () => {
  const writes = [];
  const savedRecents = [];
  const saveChoices = ['/p/copia.modelador.json'];
  const runtime = {
    fileSystem: {
      readText: async () => JSON.stringify(model('opened')),
      writeTextAtomic: async (...args) => { writes.push(args); }
    },
    chooseOpenPath: async () => '/p/casa.modelador.json',
    chooseSavePath: async () => saveChoices.shift() ?? null,
    saveRecentPaths: async (recentPaths) => { savedRecents.push(recentPaths); }
  };
  render(
    <MenuBar
      onOpenModal={() => {}}
      canvasSize={{ width: 800, height: 600 }}
      projectRuntime={runtime}
    />
  );

  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir…' }));
  await waitFor(() => {
    assert.equal(screen.getByLabelText('Documento activo').textContent, 'casa.modelador.json');
  });
  assert.equal(useModelStore.getState().model.persistenceProbe, 'opened');

  act(() => useModelStore.getState().addXAxis(1000, 'X1'));
  assert.equal(screen.getByLabelText('Documento activo').textContent, 'casa.modelador.json *');

  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => {
    assert.equal(screen.getByLabelText('Documento activo').textContent, 'casa.modelador.json');
  });

  act(() => useModelStore.getState().addYAxis(1000, 'Y1'));
  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar como…' }));
  await waitFor(() => {
    assert.equal(screen.getByLabelText('Documento activo').textContent, 'copia.modelador.json');
  });
  assert.equal(writes.length, 2);
  assert.equal(useModelStore.getState().projectDocument.dirty, false);

  openFileMenu();
  const recent = screen.getByRole('button', { name: /Recientes \(2\)/ });
  fireEvent.mouseEnter(recent.parentElement);
  assert.ok(screen.getByRole('button', { name: '/p/casa.modelador.json' }));
  assert.ok(screen.getByRole('button', { name: '/p/copia.modelador.json' }));
  fireEvent.click(screen.getByRole('button', { name: '/p/casa.modelador.json' }));
  await waitFor(() => {
    assert.equal(screen.getByLabelText('Documento activo').textContent, 'casa.modelador.json');
  });
  assert.deepEqual(savedRecents.at(-1), [
    '/p/casa.modelador.json',
    '/p/copia.modelador.json'
  ]);
});

test('SPEC-004-B: cancelar un selector no cambia documento ni invoca filesystem', async () => {
  let reads = 0;
  const runtime = {
    fileSystem: {
      readText: async () => { reads += 1; return JSON.stringify(model('unexpected')); },
      writeTextAtomic: async () => {}
    },
    chooseOpenPath: async () => null,
    chooseSavePath: async () => null
  };
  render(
    <MenuBar
      onOpenModal={() => {}}
      canvasSize={{ width: 800, height: 600 }}
      projectRuntime={runtime}
    />
  );
  const before = structuredClone(useModelStore.getState().projectDocument);
  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir…' }));
  await waitFor(() => assert.equal(reads, 0));
  assert.deepEqual(useModelStore.getState().projectDocument, before);
});

test('SPEC-004-B: un fallo del selector queda tipado para el banner visible', async () => {
  const runtime = {
    fileSystem: {
      readText: async () => JSON.stringify(model()),
      writeTextAtomic: async () => {}
    },
    chooseOpenPath: async () => { throw new Error('El selector nativo falló.'); },
    chooseSavePath: async () => null
  };
  render(
    <MenuBar
      onOpenModal={() => {}}
      canvasSize={{ width: 800, height: 600 }}
      projectRuntime={runtime}
    />
  );
  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir…' }));
  await waitFor(() => {
    const feedback = useModelStore.getState().modelImportFeedback;
    assert.equal(feedback.severity, 'error');
    assert.equal(feedback.code, 'PROJECT_OPERATION_FAILED');
    assert.equal(feedback.message, 'El selector nativo falló.');
  });
});
