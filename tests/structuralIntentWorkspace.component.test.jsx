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
    modelImportFeedback: null
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
