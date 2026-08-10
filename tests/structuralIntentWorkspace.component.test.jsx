import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';

let act;
let cleanup;
let fireEvent;
let render;
let screen;
let MenuBar;
let StructuralIntentWorkspaceDialog;
let useModelStore;
let fixture;
let dom;

function installDom() {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  for (const name of [
    'document', 'Element', 'Event', 'HTMLElement', 'HTMLButtonElement',
    'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement',
    'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'Node', 'navigator', 'window'
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
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

function resetStore() {
  useModelStore.setState({
    model: structuredClone(fixture),
    past: [],
    future: [],
    modelImportFeedback: null,
    layout: 'single',
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewModeB: 'plan',
    structuralIntentLocator: {
      active: false, targetIds: [], activeId: null, hoveredId: null,
      requestedId: null, preview: null, sourceFocusId: null, snapshot: null
    }
  });
}

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir herramienta</button>
      <StructuralIntentWorkspaceDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

before(async () => {
  installDom();
  fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
  ({ act, cleanup, fireEvent, render, screen } = await import('@testing-library/react'));
  ({ default: MenuBar } = await import('../src/components/MenuBar.jsx'));
  ({ default: StructuralIntentWorkspaceDialog } = await import(
    '../src/components/modals/StructuralIntentWorkspaceDialog.jsx'
  ));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
});

beforeEach(resetStore);
afterEach(() => cleanup());
after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

test('SPEC-015-C/D: menú Estructura abre intención y propuestas; topología futura permanece deshabilitada', () => {
  const opened = [];
  render(<MenuBar onOpenModal={(name) => opened.push(name)} canvasSize={{ width: 800, height: 600 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Estructura/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Intención estructural…' }));
  assert.deepEqual(opened, ['structuralIntent']);

  fireEvent.click(screen.getByRole('button', { name: /Estructura/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas y caminos candidatos…' }));
  assert.deepEqual(opened, ['structuralIntent', 'structuralProposals']);

  fireEvent.click(screen.getByRole('button', { name: /Estructura/ }));
  assert.equal(screen.getByRole('button', { name: 'Topología estructural…' }).disabled, true);
});

test('SPEC-015-C: diálogo tiene nombre accesible, foco inicial, Escape y restauración', async () => {
  render(<DialogHarness />);
  const opener = screen.getByRole('button', { name: 'Abrir herramienta' });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Intención estructural' });
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.ok(screen.getByRole('button', { name: 'Cerrar intención estructural' }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'Resumen' }));

  fireEvent.keyDown(dialog, { key: 'Escape' });
  assert.equal(screen.queryByRole('dialog', { name: 'Intención estructural' }), null);
  assert.equal(document.activeElement, opener);
});

test('SPEC-015-C: tabs se recorren por teclado y FX-008 lista siete cubiertas', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  const summary = screen.getByRole('tab', { name: 'Resumen' });
  fireEvent.keyDown(summary, { key: 'End' });
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'Trazabilidad' }));
  fireEvent.keyDown(document.activeElement, { key: 'Home' });
  assert.equal(document.activeElement, summary);
  fireEvent.click(screen.getByRole('tab', { name: 'Techumbre' }));
  assert.match(screen.getByRole('heading', { name: /Cubiertas/ }).textContent, /7/);
});

test('SPEC-015-C: selección local y lote confirmado generan un solo historial', () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: '1784751397992' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar 1784751397992' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar asignación' }));
  assert.ok(screen.getByRole('alertdialog', { name: 'Confirmar asignación masiva' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación a 1 elemento' }));

  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralIntentTrace.events.length, 1);
  assert.equal(state.model.structuralIntentTrace.events[0].operation, 'batchSet');
});

test('SPEC-015-C: cancelar una confirmación masiva produce cero cambios', () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: '1784751397992' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar 1784751397992' }));
  const before = structuredClone(useModelStore.getState().model);
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar asignación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  assert.deepEqual(useModelStore.getState().model, before);
  assert.equal(useModelStore.getState().past.length, 0);
});


test('SPEC-015-C-1: muro FX-008 muestra descriptor, planta, elevación y vanos reales', () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: '1784605101040' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  assert.ok(screen.getByRole('heading', { name: 'Identificación del elemento' }));
  assert.ok(screen.getAllByText(/Muro X · 7→11A @ C/)
    .some((element) => /3 vanos/.test(element.textContent)));
  assert.ok(screen.getByLabelText(/Preview en planta de 1 objetivo/));
  fireEvent.click(screen.getByRole('button', { name: 'Elevación' }));
  assert.ok(screen.getByLabelText(/Elevación de Muro X/));
  assert.equal(document.querySelectorAll('rect[stroke-dasharray="6 3"]').length, 3);
});

test('SPEC-015-C-1: Localizar conserva selección, historial y trace y puede restaurar vista', async () => {
  useModelStore.setState((state) => ({
    model: { ...state.model, selectedElementId: 1784600403613, viewMode: 'elevation-x' },
    view: { ...state.view, scale: 0.08, offsetX: 111, offsetY: 222 }
  }));
  const originalView = structuredClone(useModelStore.getState().view);
  const originalTrace = structuredClone(useModelStore.getState().model.structuralIntentTrace ?? null);
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: '1784605101040' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Localizar' }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  assert.ok(screen.getByRole('dialog', { name: 'Localizador de intención estructural' }));
  const located = useModelStore.getState();
  assert.equal(located.model.selectedElementId, 1784600403613);
  assert.equal(located.past.length, 0);
  assert.deepEqual(located.model.structuralIntentTrace ?? null, originalTrace);
  assert.equal(located.model.viewMode, 'plan');
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar vista' }));
  assert.deepEqual(useModelStore.getState().view, originalView);
  assert.equal(useModelStore.getState().model.selectedElementId, 1784600403613);
  assert.ok(screen.getByRole('dialog', { name: 'Intención estructural' }));
});

test('SPEC-015-C-1: lote real S1…S3 se previsualiza antes de confirmar', () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  for (const id of ['1784751397992', '1784752583321', '1784752639636']) {
    fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: id } });
    fireEvent.click(screen.getByRole('checkbox', { name: `Seleccionar ${id}` }));
  }
  assert.match(screen.getByText(/3 objetivos S1…S3/).textContent, /3 objetivos/);
  assert.ok(screen.getAllByText('S1').length >= 1);
  assert.ok(screen.getAllByText('S2').length >= 1);
  assert.ok(screen.getAllByText('S3').length >= 1);
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar asignación' }));
  assert.ok(screen.getByRole('heading', { name: 'Preview masiva verificable' }));
});

test('SPEC-015-C-1: geometría stale bloquea Guardar y Localizar hasta recarga explícita', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: '1784605101040' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Participación prevista'), { target: { value: 'undetermined' } });
  await act(async () => {
    useModelStore.setState((state) => ({
      model: {
        ...state.model,
        elements: state.model.elements.map((element) => element.id === 1784605101040
          ? { ...element, thickness: 120 }
          : element)
      }
    }));
  });
  assert.ok(screen.getByText('SI-VISUAL-PREVIEW-STALE'));
  assert.equal(screen.getByRole('button', { name: 'Declarar' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Localizar' }).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: 'Recargar geometría' }));
  assert.equal(screen.queryByText('SI-VISUAL-PREVIEW-STALE'), null);
  assert.equal(screen.getByRole('button', { name: 'Declarar' }).disabled, false);
});

test('SPEC-015-C-1: intención huérfana permanece visible con referencia rota aunque Sólo muros esté activo', () => {
  useModelStore.setState((state) => ({
    model: {
      ...state.model,
      structuralIntent: {
        ...state.model.structuralIntent,
        elementIntents: [...state.model.structuralIntent.elementIntents, {
          elementId: 'MISSING-015C1', participation: 'undetermined', functions: [],
          secondaryInteraction: 'notApplicable', notes: null, status: 'declared', source: 'user'
        }]
      }
    }
  }));
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Muros y elementos' }));
  fireEvent.change(screen.getByLabelText('Buscar por ID'), { target: { value: 'MISSING-015C1' } });
  assert.ok(screen.getByText('Referencia rota'));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  assert.equal(screen.getByLabelText('Participación prevista').disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Localizar' }).disabled, true);
});

test('SPEC-015-D REV8: pestaña Interfaces declara ubicación separada de acción con un history', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  assert.ok(screen.getByRole('heading', { name: 'Capa de interfaces estructurales' }));
  assert.ok(screen.getByText('No hay interfaces. La migración legacy no inventa ninguna.'));

  fireEvent.change(screen.getByLabelText('Host'), { target: { value: '1784819708086' } });
  fireEvent.change(screen.getByLabelText('Cara canónica'), { target: { value: 'negativeN' } });
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByLabelText('S0'), { target: { value: '12800' } });
  fireEvent.change(screen.getByLabelText('S1'), { target: { value: '14500' } });
  fireEvent.change(screen.getByLabelText('Z0'), { target: { value: '3250' } });
  fireEvent.change(screen.getByLabelText('Z1'), { target: { value: '4150' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar interfaz' }));

  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralIntent.schema, 'structural-intent-v1.1');
  assert.equal(state.model.structuralIntent.interfaceIntents.length, 1);
  assert.equal(state.model.structuralIntent.relationIntents.length, 0);
  const stored = state.model.structuralIntent.interfaceIntents[0];
  assert.equal(stored.locator.kind, 'face');
  assert.equal(stored.locator.side, 'negativeN');
  assert.equal(Object.hasOwn(stored, 'actionFamily'), false);
  assert.ok(screen.getByText('Cara −N'));
});

test('BUG-015-D-019: Techumbre identifica por ejes reales y Localizar es temporal sin mutación estructural', async () => {
  useModelStore.setState((state) => ({
    model: {
      ...state.model,
      viewMode: 'elevation-x',
      selectedElementId: 1784600403613,
      selectedRoofPlaneId: 1785161146258
    },
    view: { ...state.view, scale: 0.08, offsetX: 111, offsetY: 222 }
  }));
  const before = useModelStore.getState();
  const originalView = structuredClone(before.view);
  const originalIntent = structuredClone(before.model.structuralIntent ?? null);
  const originalTrace = structuredClone(before.model.structuralIntentTrace ?? null);

  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Techumbre' }));
  const roofButton = screen.getByRole('button', { name: /Abrir cubierta.*Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C/ });
  assert.doesNotMatch(roofButton.textContent.split('referencia técnica')[0], /1785030887081/);
  fireEvent.click(roofButton);

  assert.ok(screen.getByRole('heading', { name: /Cubierta · Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C/ }));
  const preview = screen.getByLabelText(/Planta contextual de cubierta.*Ejes X: 2 · 6 · 7.*Ejes Y: A · B · C/);
  const axisTexts = [...preview.querySelectorAll('text')].map((node) => node.textContent);
  for (const label of ['2', '6', '7', 'A', 'B', 'C', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6']) {
    assert.ok(axisTexts.includes(label), `falta etiqueta ${label} en preview contextual`);
  }

  fireEvent.click(screen.getByRole('button', { name: 'Localizar cubierta' }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  assert.ok(screen.getByRole('dialog', { name: 'Localizador de intención estructural' }));
  assert.ok(screen.getByRole('heading', { name: 'Localizando cubierta' }));
  const located = useModelStore.getState();
  assert.equal(located.structuralIntentLocator.activeId, 1785030887081);
  assert.equal(located.structuralIntentLocator.preview.selected[0].targetType, 'roof');
  assert.equal(located.past.length, 0);
  assert.deepEqual(located.model.structuralIntent ?? null, originalIntent);
  assert.deepEqual(located.model.structuralIntentTrace ?? null, originalTrace);
  assert.equal(located.model.selectedElementId, 1784600403613);
  assert.equal(located.model.selectedRoofPlaneId, 1785161146258);
  assert.equal(located.model.viewMode, 'plan');

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar vista' }));
  const restored = useModelStore.getState();
  assert.deepEqual(restored.view, originalView);
  assert.equal(restored.model.viewMode, 'elevation-x');
  assert.equal(restored.model.selectedElementId, 1784600403613);
  assert.equal(restored.model.selectedRoofPlaneId, 1785161146258);
  assert.equal(restored.past.length, 0);
  assert.deepEqual(restored.model.structuralIntent ?? null, originalIntent);
  assert.deepEqual(restored.model.structuralIntentTrace ?? null, originalTrace);
  assert.ok(screen.getByRole('dialog', { name: 'Intención estructural' }));
});

test('BUG-015-D-020: Interfaces muestra +N/−N físicamente y Localizar cara no muta autoridad', async () => {
  useModelStore.setState((state) => ({
    model: { ...state.model, viewMode: 'elevation-x', selectedElementId: 1784600403613 },
    view: { ...state.view, scale: 0.08, offsetX: 321, offsetY: 654 }
  }));
  const before = useModelStore.getState();
  const originalView = structuredClone(before.view);
  const originalIntent = structuredClone(before.model.structuralIntent ?? null);
  const originalTrace = structuredClone(before.model.structuralIntentTrace ?? null);

  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  fireEvent.change(screen.getByLabelText('Host'), { target: { value: '1784819708086' } });
  await act(async () => { await Promise.resolve(); });

  assert.ok(screen.getByRole('img', { name: /Vista en orientación de Planta del muro 6→7 @ C.*Seleccionada cara \+N.*\+N corresponde a \+Y y −N a −Y/ }));
  assert.match(screen.getByLabelText(/Contexto geométrico de interfaz.*6→7 @ C/).textContent, /S canónico:\s*crece de 6 hacia 7/);
  assert.match(screen.getByLabelText(/Contexto geométrico de interfaz.*6→7 @ C/).textContent, /\+N = \+Y de Planta · −N = −Y/);

  fireEvent.change(screen.getByLabelText('Cara canónica'), { target: { value: 'negativeN' } });
  assert.ok(screen.getByRole('img', { name: /Seleccionada cara −N/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Localizar cara' }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

  assert.ok(screen.getByRole('dialog', { name: 'Localizador de intención estructural' }));
  assert.ok(screen.getByRole('heading', { name: 'Localizando −N' }));
  const located = useModelStore.getState();
  const selected = located.structuralIntentLocator.preview.selected[0];
  assert.equal(selected.id, 1784819708086);
  assert.equal(selected.mark, '−N');
  assert.equal(selected.interfaceLocation.kind, 'face');
  assert.equal(selected.interfaceLocation.side, 'negativeN');
  assert.equal(located.past.length, 0);
  assert.deepEqual(located.model.structuralIntent ?? null, originalIntent);
  assert.deepEqual(located.model.structuralIntentTrace ?? null, originalTrace);
  assert.equal(located.model.selectedElementId, 1784600403613);

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar vista' }));
  const restored = useModelStore.getState();
  assert.deepEqual(restored.view, originalView);
  assert.equal(restored.model.viewMode, 'elevation-x');
  assert.equal(restored.model.selectedElementId, 1784600403613);
  assert.equal(restored.past.length, 0);
  assert.equal(screen.getByLabelText('Host').value, '1784819708086');

  fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'end' } });
  assert.ok(screen.getByRole('button', { name: 'Localizar extremo' }));
  fireEvent.change(screen.getByLabelText('Extremo canónico'), { target: { value: 'highS' } });
  assert.ok(screen.getByRole('img', { name: /Seleccionada extremo S máximo/ }));

  fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'region' } });
  assert.ok(screen.getByRole('button', { name: 'Localizar región' }));
  assert.match(screen.getByLabelText(/Contexto geométrico de interfaz/).textContent, /Región:\s*S 12800→14500 · Z 3250→4150 mm/);
});


test('BUG-015-D-024: interfaz vigente conserva descriptor humano y Localizar interfaz es temporal', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  fireEvent.change(screen.getByLabelText('Host'), { target: { value: '1784819708086' } });
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByLabelText('Cara canónica'), { target: { value: 'negativeN' } });
  fireEvent.change(screen.getAllByLabelText('Nota')[0], { target: { value: 'Cara del frontón hacia y<C.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar interfaz' }));
  await act(async () => { await Promise.resolve(); });

  const humanLabels = screen.getAllByText(/Cara −N · Muro X · 6→7 @ C/);
  assert.ok(humanLabels.length >= 2, 'descriptor humano debe verse en tarjeta vigente y selector de puertos');
  assert.ok(screen.getAllByText(/CIELO GENERAL 3\.250 → FRONTON GENERAL 4\.150/).length >= 2);
  assert.ok(screen.getAllByText(/S 12800→14500 · Z 3250→4150 · fresh/).length >= 1);
  assert.ok(screen.getByText('Cara del frontón hacia y<C.'));

  const afterCreate = useModelStore.getState();
  const intentAfterCreate = structuredClone(afterCreate.model.structuralIntent ?? null);
  const traceAfterCreate = structuredClone(afterCreate.model.structuralIntentTrace ?? null);
  const reviewAfterCreate = structuredClone(afterCreate.model.structuralProposalReviews ?? null);
  const selectedElementAfterCreate = afterCreate.model.selectedElementId;
  const selectedRoofAfterCreate = afterCreate.model.selectedRoofPlaneId;
  const pastAfterCreate = structuredClone(afterCreate.past);
  const futureAfterCreate = structuredClone(afterCreate.future);
  const locateButton = screen.getByRole('button', { name: /Localizar interfaz Cara −N · Muro X · 6→7 @ C/ });
  fireEvent.click(locateButton);
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

  assert.ok(screen.getByRole('dialog', { name: 'Localizador de intención estructural' }));
  assert.ok(screen.getByRole('heading', { name: 'Localizando −N' }));
  const located = useModelStore.getState();
  assert.equal(located.structuralIntentLocator.preview.selected[0].mark, '−N');
  assert.equal(located.structuralIntentLocator.preview.selected[0].interfaceLocation.side, 'negativeN');
  assert.deepEqual(located.model.structuralIntent ?? null, intentAfterCreate);
  assert.deepEqual(located.model.structuralIntentTrace ?? null, traceAfterCreate);
  assert.deepEqual(located.model.structuralProposalReviews ?? null, reviewAfterCreate);
  assert.equal(located.model.selectedElementId, selectedElementAfterCreate);
  assert.equal(located.model.selectedRoofPlaneId, selectedRoofAfterCreate);
  assert.deepEqual(located.past, pastAfterCreate);
  assert.deepEqual(located.future, futureAfterCreate);

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar vista' }));
  assert.ok(screen.getAllByText(/Cara −N · Muro X · 6→7 @ C/).length >= 2);
  const restored = useModelStore.getState();
  assert.deepEqual(restored.model.structuralIntent ?? null, intentAfterCreate);
  assert.deepEqual(restored.model.structuralIntentTrace ?? null, traceAfterCreate);
  assert.deepEqual(restored.model.structuralProposalReviews ?? null, reviewAfterCreate);
});

test('BUG-015-D-026: Borde canónico usa descriptor humano y relega IDs a Referencia técnica', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  fireEvent.change(screen.getByLabelText('Referente geométrico'), { target: { value: 'roofBoundary' } });

  const boundarySelect = screen.getByLabelText('Borde canónico');
  const b3Option = [...boundarySelect.options].find((option) => (
    option.value.startsWith('1785030887081|') && option.textContent.includes('B3')
  ));
  assert.ok(b3Option, 'debe existir B3 de la cubierta real 1785030887081');
  assert.match(b3Option.textContent, /Cubierta · Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C · B3 · 1\.700 mm/);
  assert.doesNotMatch(b3Option.textContent, /Cubierta 1785030887081/);

  fireEvent.change(boundarySelect, { target: { value: b3Option.value } });
  const context = screen.getByLabelText('Contexto del borde canónico seleccionado');
  const humanContext = context.textContent.split('Referencia técnica')[0];
  assert.match(humanContext, /Cubierta · Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C · B3/);
  assert.match(humanContext, /1\.700 mm/);
  assert.doesNotMatch(humanContext, /1785030887081|643e5fdc/);

  fireEvent.change(screen.getAllByLabelText('Nota')[0], {
    target: { value: 'Borde B3 de cubierta sur hacia cara −N del frontón C/6→7.' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar interfaz' }));
  await act(async () => { await Promise.resolve(); });

  const persistedB3 = useModelStore.getState().model.structuralIntent.interfaceIntents.find((item) => (
    item.ownerRef?.kind === 'roofBoundary'
    && item.ownerRef.roofGeometryId === 1785030887081
    && item.ownerRef.boundaryId === b3Option.value.split('|')[1]
  ));
  assert.ok(persistedB3);
  assert.deepEqual(persistedB3.locator, { kind: 'boundary' }, 'el rango físico completo no debe materializar sRange');

  const titles = screen.getAllByText(/Borde de cubierta · Cubierta · Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C · B3/);
  const card = titles.map((node) => node.closest('article')).find(Boolean);
  assert.ok(card, 'la interfaz persistida debe conservar el descriptor humano de cubierta y B3');
  const visibleCard = card.textContent.split('Referencia técnica')[0];
  assert.match(visibleCard, /B3 · 1\.700 mm/);
  assert.match(visibleCard, /Borde canónico vigente · fresh/);
  assert.match(visibleCard, /Borde B3 de cubierta sur hacia cara −N del frontón C\/6→7\./);
  assert.doesNotMatch(visibleCard, /roof:1785030887081:edge:|643e5fdc/);
});

test('BUG-015-D-028: Borde de cubierta declara sRange parcial y Localizar resalta sólo el subtramo', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  fireEvent.change(screen.getByLabelText('Referente geométrico'), { target: { value: 'roofBoundary' } });

  const boundarySelect = screen.getByLabelText('Borde canónico');
  const northB1 = [...boundarySelect.options].find((option) => (
    option.value === '1785161146258|roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c'
  ));
  assert.ok(northB1, 'debe existir el borde real C/6→11A de la cubierta norte');
  fireEvent.change(boundarySelect, { target: { value: northB1.value } });
  await act(async () => { await Promise.resolve(); });

  const context = screen.getByLabelText('Contexto del borde canónico seleccionado');
  assert.match(context.textContent.split('Referencia técnica')[0], /Borde físico · 10\.400 mm · S 12800→23200/);
  assert.equal(screen.getByLabelText('S0 de borde').value, '12800');
  assert.equal(screen.getByLabelText('S1 de borde').value, '23200');

  fireEvent.change(screen.getByLabelText('S1 de borde'), { target: { value: '14500' } });
  assert.ok(screen.getByText(/Interacción · S 12800→14500 · 1\.700 mm/));
  fireEvent.change(screen.getAllByLabelText('Nota')[0], {
    target: { value: 'Cubierta norte entrega en Cara +N del frontón C/6→7.' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar interfaz' }));
  await act(async () => { await Promise.resolve(); });

  const stateAfterCreate = useModelStore.getState();
  const partial = stateAfterCreate.model.structuralIntent.interfaceIntents.find((item) => (
    item.ownerRef?.kind === 'roofBoundary'
    && item.ownerRef.roofGeometryId === 1785161146258
    && item.ownerRef.boundaryId === 'roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c'
  ));
  assert.ok(partial);
  assert.deepEqual(partial.locator, { kind: 'boundary', sRange: [12800, 14500] });
  assert.equal(partial.interfaceId, 'iface:sha256:db60ba9dd5b8c32bc2513294aee9d7feedbb065efe43a216db047f73b328a493');
  assert.equal('actionFamily' in partial, false);
  assert.equal('structuralFunction' in partial, false);

  const cardTitle = screen.getAllByText(/Borde de cubierta · Cubierta · .* · B1/)
    .find((node) => node.closest('article')?.textContent.includes('Cubierta norte entrega en Cara +N'));
  const card = cardTitle?.closest('article');
  assert.ok(card, 'debe existir la tarjeta de la interfaz parcial');
  assert.match(card.textContent.split('Referencia técnica')[0], /B1 · borde físico 10\.400 mm/);
  assert.match(card.textContent.split('Referencia técnica')[0], /Interacción S 12800→14500 · 1\.700 mm/);

  const intentAfterCreate = structuredClone(stateAfterCreate.model.structuralIntent ?? null);
  const traceAfterCreate = structuredClone(stateAfterCreate.model.structuralIntentTrace ?? null);
  const reviewAfterCreate = structuredClone(stateAfterCreate.model.structuralProposalReviews ?? null);
  const selectedElementAfterCreate = stateAfterCreate.model.selectedElementId;
  const selectedRoofAfterCreate = stateAfterCreate.model.selectedRoofPlaneId;
  const pastAfterCreate = structuredClone(stateAfterCreate.past);
  const futureAfterCreate = structuredClone(stateAfterCreate.future);

  fireEvent.click(screen.getByRole('button', { name: /Localizar interfaz Borde de cubierta · Cubierta · .* · B1/ }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

  const located = useModelStore.getState();
  assert.ok(screen.getByRole('dialog', { name: 'Localizador de intención estructural' }));
  assert.equal(located.structuralIntentLocator.preview.kind, 'proposal-relation');
  assert.deepEqual(located.structuralIntentLocator.preview.boundary, {
    start: { x: 12800, y: 2000, z: 3650 },
    end: { x: 14500, y: 2000, z: 3650 }
  });
  assert.deepEqual(located.structuralIntentLocator.preview.visibleBounds, {
    xMin: 12800, xMax: 14500, yMin: 2000, yMax: 2000
  });
  assert.deepEqual(located.model.structuralIntent ?? null, intentAfterCreate);
  assert.deepEqual(located.model.structuralIntentTrace ?? null, traceAfterCreate);
  assert.deepEqual(located.model.structuralProposalReviews ?? null, reviewAfterCreate);
  assert.equal(located.model.selectedElementId, selectedElementAfterCreate);
  assert.equal(located.model.selectedRoofPlaneId, selectedRoofAfterCreate);
  assert.deepEqual(located.past, pastAfterCreate);
  assert.deepEqual(located.future, futureAfterCreate);

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar vista' }));
  const restored = useModelStore.getState();
  assert.deepEqual(restored.model.structuralIntent ?? null, intentAfterCreate);
  assert.deepEqual(restored.model.structuralIntentTrace ?? null, traceAfterCreate);
  assert.deepEqual(restored.model.structuralProposalReviews ?? null, reviewAfterCreate);
});


test('BUG-015-D-032: interfaz corta C/6 entrega al Canvas sRange y faceSegment sin mutar la geometría', async () => {
  render(<StructuralIntentWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Interfaces' }));
  fireEvent.change(screen.getByLabelText('Host'), { target: { value: '1784753322528' } });
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByLabelText('Cara canónica'), { target: { value: 'negativeN' } });
  fireEvent.change(screen.getByLabelText('S0'), { target: { value: '1949.45' } });
  fireEvent.change(screen.getByLabelText('S1'), { target: { value: '2050.55' } });
  fireEvent.change(screen.getByLabelText('Z0'), { target: { value: '3250' } });
  fireEvent.change(screen.getByLabelText('Z1'), { target: { value: '4150' } });
  fireEvent.change(screen.getAllByLabelText('Nota')[0], { target: { value: 'Receptor declarado en apoyo 6.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar interfaz' }));
  await act(async () => { await Promise.resolve(); });

  const locateButton = screen.getByRole('button', { name: /Localizar interfaz Cara −N · Muro Y · B→I @ 6/ });
  fireEvent.click(locateButton);
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

  const located = useModelStore.getState();
  const selected = located.structuralIntentLocator.preview.selected[0];
  assert.equal(selected.planGeometry.kind, 'interface-location');
  assert.equal(selected.interfaceLocation.kind, 'face');
  assert.equal(selected.interfaceLocation.side, 'negativeN');
  assert.deepEqual(selected.interfaceLocation.sRange, [1949.45, 2050.55]);
  assert.deepEqual(selected.interfaceLocation.zRange, [3250, 4150]);
  assert.equal(selected.interfaceLocation.faceSegment.length, 2);
  assert.equal(located.past.length, 1, 'sólo la creación explícita de la interfaz entra al historial');
});
