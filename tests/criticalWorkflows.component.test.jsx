import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let act;
let cleanup;
let fireEvent;
let render;
let screen;
let MenuBar;
let ModelImportBanner;
let ValidationModal;
let AgnosticGeometryComparisonModal;
let projectAgnosticGeometry;
let useModelStore;
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
    'HTMLAnchorElement',
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

function emptyModel(overrides = {}) {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
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
    wallTypes: [],
    projectInfo: {},
    osbDefaults: {
      panelWidth: 1220,
      panelHeight: 2440,
      minPanelWidth: 200,
      gap: 5
    },
    metalconDefaults: null,
    roofSystems: [],
    roofPlanes: [],
    currentZLevelId: null,
    selectedElementId: null,
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    viewMode: 'plan',
    ...overrides
  };
}

function resetStore(model = emptyModel()) {
  useModelStore.setState({
    model,
    modelImportFeedback: null,
    past: [],
    future: [],
    layout: 'single',
    viewModeB: 'plan',
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true }
  });
}

function ImportFeedbackHarness() {
  const feedback = useModelStore((state) => state.modelImportFeedback);
  const dismiss = useModelStore((state) => state.dismissModelImportFeedback);
  return <ModelImportBanner feedback={feedback} onDismiss={dismiss} />;
}

before(async () => {
  installDom();
  ({ act, cleanup, fireEvent, render, screen } = await import('@testing-library/react'));
  ({ default: MenuBar } = await import('../src/components/MenuBar.jsx'));
  ({ default: ModelImportBanner } = await import('../src/components/ModelImportBanner.jsx'));
  ({ default: ValidationModal } = await import(
    '../src/components/modals/ValidationModal.jsx'
  ));
  ({ default: AgnosticGeometryComparisonModal } = await import(
    '../src/components/modals/AgnosticGeometryComparisonModal.jsx'
  ));
  ({ projectAgnosticGeometry } = await import('../src/core/agnosticGeometry.js'));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
});

beforeEach(() => resetStore());

afterEach(() => {
  cleanup();
  delete globalThis.alert;
  delete globalThis.localStorage;
});

after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('SPEC-003-D: un fallo de FileReader queda visible y descartable en el banner', async () => {
  class FailingReader {
    readAsText() {
      this.onerror();
    }
  }

  render(<ImportFeedbackHarness />);
  act(() => {
    useModelStore.getState().importModelFromFile(
      { name: 'modelo.json' },
      { FileReader: FailingReader }
    );
  });

  const alert = await screen.findByRole('alert');
  assert.match(alert.textContent, /No se pudo leer el archivo seleccionado/);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  assert.equal(screen.queryByRole('alert'), null);
});

test('SPEC-003-D: una exportación stale se bloquea desde el menú sin iniciar descarga', () => {
  resetStore(emptyModel({
    grid: {
      xAxes: [{ id: 'X0', position: 0 }, { id: 'X1', position: 4000 }],
      yAxes: [{ id: 'Y0', position: 0 }],
      zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
    },
    elements: [{
      id: 'W1',
      type: 'wall',
      direction: 'x',
      xStart: 'X0',
      xEnd: 'X1',
      yStart: 'Y0',
      yEnd: 'Y0',
      bottomZ: 'Z0',
      topZ: 'Z1',
      thickness: 90,
      openings: [],
      studs: [{ offset: 0, zMin: 0, zMax: 2400 }],
      studsStale: true
    }]
  }));
  const notices = [];
  let downloadClicks = 0;
  globalThis.alert = (message) => notices.push(message);
  const originalClick = globalThis.HTMLAnchorElement.prototype.click;
  globalThis.HTMLAnchorElement.prototype.click = () => { downloadClicks++; };

  try {
    render(<MenuBar onOpenModal={() => {}} canvasSize={{ width: 800, height: 600 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
    const exportDxf = screen.getByRole('button', { name: /Exportar DXF/ });
    fireEvent.mouseEnter(exportDxf.parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Tabiquería \(elevación\)/ }));

    assert.equal(downloadClicks, 0);
    assert.equal(notices.length, 1);
    assert.match(notices[0], /No se puede exportar tabiquería DXF/);
    assert.match(notices[0], /desactualizados/);
  } finally {
    globalThis.HTMLAnchorElement.prototype.click = originalClick;
  }
});

test('SPEC-006-A/D: el menú separa geometría y auditoría y muestra fallos antes del DOM', async () => {
  resetStore(emptyModel({
    grid: {
      xAxes: [{ id: 'X0', position: 0 }, { id: 'X1', position: 4000 }],
      yAxes: [{ id: 'Y0', position: 0 }],
      zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
    },
    elements: [{
      id: 'W1', type: 'wall', direction: 'x',
      xStart: 'X0', xEnd: 'X1', yStart: 'Y0', yEnd: 'Y0',
      bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings: [],
      studs: [{ role: 'stud', offset: 0 }], studsStale: true, osbStale: true
    }]
  }));
  const notices = [];
  let downloadedAnchor = null;
  let downloadedBlob = null;
  let revoked = null;
  const originalClick = globalThis.HTMLAnchorElement.prototype.click;
  const originalCreate = globalThis.URL.createObjectURL;
  const originalRevoke = globalThis.URL.revokeObjectURL;
  globalThis.alert = (message) => notices.push(message);
  globalThis.HTMLAnchorElement.prototype.click = function click() {
    downloadedAnchor = this;
  };
  globalThis.URL.createObjectURL = (blob) => {
    downloadedBlob = blob;
    return 'blob:agnostic';
  };
  globalThis.URL.revokeObjectURL = (url) => { revoked = url; };

  try {
    render(<MenuBar onOpenModal={() => {}} canvasSize={{ width: 800, height: 600 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
    assert.equal(screen.queryByRole('button', { name: 'Exportar JSON…' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar geometría JSON…' }));

    assert.equal(downloadedAnchor.download, 'geometria-agnostica.json');
    assert.equal(downloadedAnchor.href, 'blob:agnostic');
    assert.equal(downloadedBlob.type, 'application/json;charset=utf-8');
    assert.equal(revoked, 'blob:agnostic');
    assert.equal(notices.length, 0, 'stale no produce advertencias en una salida live');
    const content = await downloadedBlob.text();
    assert.match(content, /"schema": "agnostic-geometry-v1\.0"/);
    assert.match(content, /"elements": \[/);
    assert.match(content, /"type": "wall"/);
    assert.match(content, /"roofGeometry": \[/);
    assert.doesNotMatch(content, /"walls":|"columns":|"beams":|"foundations":|"roofs":/);
    assert.doesNotMatch(content, /studs|studsStale|osbStale/);

    downloadedAnchor = null;
    downloadedBlob = null;
    revoked = null;
    fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar auditoría geométrica…' }));
    assert.equal(downloadedAnchor.download, 'auditoria-geometria-agnostica.json');
    assert.equal(downloadedAnchor.href, 'blob:agnostic');
    assert.equal(downloadedBlob.type, 'application/json;charset=utf-8');
    assert.equal(revoked, 'blob:agnostic');
    const auditContent = await downloadedBlob.text();
    assert.match(auditContent, /"schema": "agnostic-geometry-audit\/v1"/);
    assert.match(auditContent, /"status": "pass"/);
    assert.match(auditContent, /"toleranceMm": 0\.001/);
    assert.equal(notices.length, 0);

    cleanup();
    resetStore(emptyModel({ elements: [{ id: 'BAD', type: 'mesh' }] }));
    downloadedAnchor = null;
    render(<MenuBar onOpenModal={() => {}} canvasSize={{ width: 800, height: 600 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar geometría JSON…' }));
    assert.equal(downloadedAnchor, null);
    assert.equal(notices.length, 1);
    assert.match(notices[0], /tipo desconocido/);

    fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar auditoría geométrica…' }));
    assert.equal(downloadedAnchor, null);
    assert.equal(notices.length, 2);
    assert.match(notices[1], /auditoría geométrica/);
    assert.match(notices[1], /tipo desconocido/);
  } finally {
    globalThis.HTMLAnchorElement.prototype.click = originalClick;
    globalThis.URL.createObjectURL = originalCreate;
    globalThis.URL.revokeObjectURL = originalRevoke;
  }
});

test('SPEC-006-E: Ver conserva Vista 3D y abre el comparador como acción separada', () => {
  const opened = [];
  render(<MenuBar onOpenModal={(name) => opened.push(name)} canvasSize={{ width: 800, height: 600 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Ver/ }));
  const constructive = screen.getByRole('button', { name: 'Vista 3D…' });
  const comparison = screen.getByRole('button', { name: 'Comparar geometría agnóstica…' });
  assert.ok(constructive);
  fireEvent.click(comparison);
  assert.deepEqual(opened, ['agnosticGeometryComparison']);
});

test('SPEC-006-E: el modal muestra PASS, modos e informe y un fallo evita crear escena', () => {
  resetStore(emptyModel());
  function ViewerStub({ mode }) {
    return <canvas aria-label={`Escena comparativa ${mode}`} />;
  }
  const rendered = render(
    <AgnosticGeometryComparisonModal
      open
      onClose={() => {}}
      ViewerComponent={ViewerStub}
    />
  );
  assert.ok(screen.getByText('PASS'));
  assert.match(screen.getByText(/Tolerancia/).parentElement.textContent, /0,001 mm/);
  assert.match(screen.getByText(/Desviación máxima/).parentElement.textContent, /0 mm/);
  assert.ok(screen.getByText('Sin diferencias.'));
  assert.ok(screen.getByRole('button', { name: 'Fuente' }));
  assert.ok(screen.getByRole('button', { name: 'Exportada' }));
  assert.ok(screen.getByRole('button', { name: 'Superposición' }));
  assert.ok(screen.getByLabelText('Escena comparativa overlay'));

  rendered.rerender(
    <AgnosticGeometryComparisonModal
      open
      onClose={() => {}}
      projectGeometry={(model) => {
        const geometry = projectAgnosticGeometry(model);
        geometry.grid.xAxes.push({ id: 'EJE-EXTRA', x: 100 });
        return geometry;
      }}
      ViewerComponent={ViewerStub}
    />
  );
  assert.ok(screen.getByText('FAIL'));
  assert.ok(screen.getByLabelText('Escena comparativa overlay'));

  rendered.rerender(
    <AgnosticGeometryComparisonModal
      open
      onClose={() => {}}
      projectGeometry={() => { throw new Error('proyección inyectada inválida'); }}
      ViewerComponent={ViewerStub}
    />
  );
  assert.match(screen.getByRole('alert').textContent, /proyección inyectada inválida/);
  assert.match(screen.getByRole('alert').textContent, /No se creó una escena parcial/);
  assert.equal(screen.queryByRole('canvas'), null);
  assert.equal(screen.queryByTestId('agnostic-comparison-scene'), null);
});

test('SPEC-003-D: cargar copia del navegador recupera el modelo sin importar el evento React', () => {
  const persisted = emptyModel({
    projectInfo: { name: 'Modelo persistido' }
  });
  resetStore(emptyModel({
    projectInfo: { name: 'Modelo actual' }
  }));
  globalThis.localStorage = {
    getItem: () => JSON.stringify(persisted)
  };

  render(<MenuBar onOpenModal={() => {}} canvasSize={{ width: 800, height: 600 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Archivo/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Cargar copia del navegador' }));

  assert.equal(useModelStore.getState().model.projectInfo.name, 'Modelo persistido');
});

test('SPEC-003-D: revisión visible y descarga comparten el mismo snapshot', async () => {
  let downloadedAnchor = null;
  let downloadedBlob = null;
  let revoked = null;
  const originalClick = globalThis.HTMLAnchorElement.prototype.click;
  const originalCreate = globalThis.URL.createObjectURL;
  const originalRevoke = globalThis.URL.revokeObjectURL;
  globalThis.HTMLAnchorElement.prototype.click = function click() {
    downloadedAnchor = this;
  };
  globalThis.URL.createObjectURL = (blob) => {
    downloadedBlob = blob;
    return 'blob:review';
  };
  globalThis.URL.revokeObjectURL = (url) => { revoked = url; };

  try {
    render(
      <ValidationModal
        open
        onClose={() => {}}
        canvasSize={{ width: 800, height: 600 }}
      />
    );
    assert.match(screen.getByText('Sin problemas detectados.').textContent, /Sin problemas/);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar informe (.md)' }));

    assert.equal(downloadedAnchor.download, 'revision-constructiva.md');
    assert.equal(downloadedAnchor.href, 'blob:review');
    assert.equal(revoked, 'blob:review');
    assert.match(await downloadedBlob.text(), /# Informe de revisión constructiva/);
    assert.match(await downloadedBlob.text(), /Críticos: 0/);
  } finally {
    globalThis.HTMLAnchorElement.prototype.click = originalClick;
    globalThis.URL.createObjectURL = originalCreate;
    globalThis.URL.revokeObjectURL = originalRevoke;
  }
});
