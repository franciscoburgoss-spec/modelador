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

test('SPEC-015-C: menú Estructura abre intención y anuncia funciones futuras deshabilitadas', () => {
  const opened = [];
  render(<MenuBar onOpenModal={(name) => opened.push(name)} canvasSize={{ width: 800, height: 600 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Estructura/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Intención estructural…' }));
  assert.deepEqual(opened, ['structuralIntent']);

  fireEvent.click(screen.getByRole('button', { name: /Estructura/ }));
  assert.equal(screen.getByRole('button', { name: 'Propuestas estructurales…' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Caminos de carga…' }).disabled, true);
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
