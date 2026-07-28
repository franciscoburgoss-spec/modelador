import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let act;
let cleanup;
let fireEvent;
let render;
let screen;
let ElementInventoryModal;
let MenuBar;
let PropertiesPanel;
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
    'HTMLButtonElement',
    'HTMLInputElement',
    'HTMLSelectElement',
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

function wall(id, wallTypeId = null) {
  return {
    id,
    type: 'wall',
    direction: 'x',
    xStart: 'X0',
    xEnd: 'X1',
    yStart: 'Y0',
    yEnd: 'Y0',
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    ...(wallTypeId == null ? {} : { wallTypeId }),
    openings: [],
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
    grid: {
      xAxes: [
        { id: 'X0', label: 'X0', position: 0 },
        { id: 'X1', label: 'X1', position: 4000 }
      ],
      yAxes: [{ id: 'Y0', label: 'Y0', position: 0 }],
      zLevels: [
        { id: 'Z0', label: 'N0', elevation: 0 },
        { id: 'Z1', label: 'N1', elevation: 2400 }
      ]
    },
    elements: [wall('W1'), wall('W2'), wall('W3', 'T1')],
    wallTypes: [{
      id: 'T1',
      name: 'Tabique 60',
      role: 'tabique',
      metalconDefaults: {
        spacing: 400,
        studProfileId: 'C60',
        trackProfileId: 'U60',
        materialId: null
      },
      osbDefaults: {
        panelWidth: 1220,
        panelHeight: 2440,
        minPanelWidth: 200,
        gap: 5
      }
    }],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      metalconProfiles: [
        { id: 'C60', shape: 'C' },
        { id: 'U60', shape: 'U' }
      ],
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
    viewMode: 'plan'
  };
}

function resetStore() {
  useModelStore.setState({
    model: model(),
    modelImportFeedback: null,
    past: [],
    future: [],
    layout: 'single',
    viewModeB: 'plan',
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true }
  });
}

before(async () => {
  installDom();
  ({ act, cleanup, fireEvent, render, screen } = await import('@testing-library/react'));
  ({ default: ElementInventoryModal } = await import(
    '../src/components/modals/ElementInventoryModal.jsx'
  ));
  ({ default: MenuBar } = await import('../src/components/MenuBar.jsx'));
  ({ default: PropertiesPanel } = await import('../src/components/PropertiesPanel.jsx'));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
});

beforeEach(resetStore);

afterEach(() => cleanup());

after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  delete globalThis.confirm;
});

test('SPEC-R5-D: menú expone listado y contador de muros sin tipo', () => {
  const opened = [];
  render(<MenuBar onOpenModal={(name) => opened.push(name)} canvasSize={{ width: 800, height: 600 }} />);

  fireEvent.click(screen.getByRole('button', { name: /Elementos/ }));
  fireEvent.click(screen.getByRole('button', {
    name: 'Listado de elementos del proyecto… (2 sin tipo)'
  }));

  assert.deepEqual(opened, ['elementInventory']);
});

test('SPEC-R5-D: listado filtra y asigna todos los muros seleccionados en un paso', () => {
  const edits = [];
  render(
    <ElementInventoryModal
      open
      onClose={() => {}}
      onEdit={(...args) => edits.push(args)}
      canvasSize={{ width: 800, height: 600 }}
    />
  );

  assert.match(screen.getByText('2 muros sin tipo / rol').textContent, /^2 /);
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar los 2 sin tipo' }));
  assert.equal(screen.getAllByRole('checkbox', { name: /Seleccionar muro/ }).length, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Editar muro W1' }));
  assert.deepEqual(edits, [['wall', 'W1', null]]);

  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar muros filtrados' }));
  fireEvent.change(screen.getByLabelText('Tipo para selección'), {
    target: { value: 'T1' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 2 muros' }));

  const state = useModelStore.getState();
  assert.equal(state.model.elements[0].wallTypeId, 'T1');
  assert.equal(state.model.elements[1].wallTypeId, 'T1');
  assert.equal(state.past.length, 1);
});

test('SPEC-R5-D: tipo se edita directamente por fila sin abrir geometría', () => {
  render(
    <ElementInventoryModal
      open
      onClose={() => {}}
      onEdit={() => {}}
      canvasSize={{ width: 800, height: 600 }}
    />
  );

  fireEvent.change(screen.getByLabelText('Tipo y rol del muro W1'), {
    target: { value: 'T1' }
  });

  const state = useModelStore.getState();
  assert.equal(state.model.elements[0].wallTypeId, 'T1');
  assert.equal(state.model.elements[1].wallTypeId, undefined);
  assert.equal(state.past.length, 1);
});

test('SPEC-R5-D: inspector se arrastra y queda acotado al viewport', () => {
  act(() => useModelStore.getState().selectElement('W1'));
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  render(<PropertiesPanel onEdit={() => {}} />);

  const panel = screen.getByTestId('properties-floating-panel');
  panel.getBoundingClientRect = () => ({
    left: 456,
    top: 80,
    width: 320,
    height: 300,
    right: 776,
    bottom: 380
  });
  const handle = screen.getByTestId('properties-floating-handle');

  fireEvent.mouseDown(handle, { clientX: 500, clientY: 100 });
  fireEvent.mouseMove(window, { clientX: 1200, clientY: 900 });
  fireEvent.mouseUp(window);

  assert.equal(panel.style.left, '472px');
  assert.equal(panel.style.top, '292px');
  assert.match(screen.getByText('Tipo y rol').parentElement.textContent, /Sin tipo \/ rol/);
});
