import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';

let cleanup;
let fireEvent;
let render;
let screen;
let useModelStore;
let StructuralProposalWorkspaceDialog;
let context;
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
  dom.window.confirm = () => true;
}

function resetStore() {
  const model = {
    ...structuredClone(context.model),
    structuralIntent: {
      ...structuredClone(context.model.structuralIntent),
      roofIntents: structuredClone(context.roofStructuralIntent)
    }
  };
  useModelStore.setState({
    model,
    past: [],
    future: [],
    layout: 'single',
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewModeB: 'plan',
    structuralProposalLocator: {
      active: false, kind: null, id: null, requested: null, hovered: null,
      snapshot: null, sourceFocusId: null
    }
  });
}

before(async () => {
  installDom();
  context = await buildFx008Spec015dContext();
  ({ cleanup, fireEvent, render, screen } = await import('@testing-library/react'));
  ({ useModelStore } = await import('../src/store/useModelStore.js'));
  ({ default: StructuralProposalWorkspaceDialog } = await import(
    '../src/components/modals/StructuralProposalWorkspaceDialog.jsx'
  ));
});

beforeEach(resetStore);
afterEach(() => cleanup());
after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

test('SPEC-015-D: grafo lateral usa descriptor humano y muestra gap explícito', () => {
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'L→ Lateral' }));
  assert.ok(screen.getAllByText(/Faldón rectangular/).length > 0);
  assert.ok(screen.getAllByText(/Muro X/).length > 0);
  assert.ok(screen.getByText(/gap 571.429 mm/));
  assert.equal(document.body.textContent.includes('Muro 1784606313849'), false);
});

test('SPEC-015-D: Localizar es temporal y no crea historial ni trace', () => {
  const before = structuredClone(useModelStore.getState().model);
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Localizar' })[0]);
  const state = useModelStore.getState();
  assert.equal(state.structuralProposalLocator.active, true);
  assert.equal(state.past.length, 0);
  assert.deepEqual(state.model.structuralIntent, before.structuralIntent);
  assert.deepEqual(state.model.structuralIntentTrace, before.structuralIntentTrace);
  assert.deepEqual(state.model.structuralProposalReviews, before.structuralProposalReviews);
  const locatorDialog = screen.getByRole('dialog', { name: 'Localizador de propuesta estructural' });
  assert.ok(locatorDialog);
  assert.equal(screen.queryByRole('dialog', { name: 'Propuestas estructurales y caminos candidatos' }), null);
  fireEvent.keyDown(locatorDialog, { key: 'Escape' });
  assert.ok(screen.getByRole('dialog', { name: 'Propuestas estructurales y caminos candidatos' }));
});

test('SPEC-015-D: rechazar crea un paso de historial y review sin mutar intención ni trace', () => {
  const beforeIntent = structuredClone(useModelStore.getState().model.structuralIntent);
  const beforeTrace = useModelStore.getState().model.structuralIntentTrace?.events?.length || 0;
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preparar vista previa' }));
  fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.deepEqual(state.model.structuralIntent, beforeIntent);
  assert.equal(state.model.structuralIntentTrace?.events?.length || 0, beforeTrace);
});

test('SPEC-015-D: aceptar crea review y un nuevo evento de trace en un solo undo', () => {
  const beforeTrace = useModelStore.getState().model.structuralIntentTrace?.events?.length || 0;
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  fireEvent.click(screen.getByRole('button', { name: '✓ Aceptar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preparar vista previa' }));
  fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.equal(state.model.structuralIntentTrace.events.length, beforeTrace + 1);
});

test('SPEC-015-D: lote homogéneo acepta dos propuestas en un solo undo/review/trace', () => {
  const beforeTrace = useModelStore.getState().model.structuralIntentTrace?.events?.length || 0;
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  const selectors = screen.getAllByRole('checkbox', { name: /Seleccionar .* para lote/ });
  assert.equal(selectors.length >= 2, true);
  fireEvent.click(selectors[0]);
  fireEvent.click(selectors[1]);
  fireEvent.click(screen.getByRole('button', { name: '✓ Aceptar lote' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preparar vista previa' }));
  fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.equal(state.model.structuralProposalReviews.events[0].decisions.length, 2);
  assert.equal(state.model.structuralIntentTrace.events.length, beforeTrace + 1);
  assert.equal(state.model.structuralIntentTrace.events.at(-1).operation, 'batchSet');
});

test('SPEC-015-D: flechas navegan propuestas y Escape devuelve foco al origen', async () => {
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  const rows = document.querySelectorAll('[data-proposal-row]');
  assert.equal(rows.length >= 2, true);
  rows[0].focus();
  fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
  assert.equal(document.activeElement, rows[1]);

  const reject = screen.getByRole('button', { name: 'Rechazar' });
  reject.focus();
  fireEvent.click(reject);
  assert.equal(document.activeElement, screen.getByRole('textbox', { name: 'Código/motivo' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  assert.equal(document.activeElement, reject);
});


test('SPEC-015-D REV7: relación en planta muestra origen y objetivo en localizador compacto', () => {
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Propuestas' }));
  fireEvent.click(screen.getByRole('button', { name: /Ver relación en planta/ }));
  const state = useModelStore.getState();
  assert.equal(state.structuralProposalLocator.active, true);
  assert.equal(state.structuralProposalLocator.kind, 'relation');
  assert.equal(state.structuralProposalLocator.preview.kind, 'proposal-relation');
  assert.equal(state.structuralProposalLocator.preview.selected.length, 2);
  assert.ok(screen.getByText(/ORIGEN y OBJETIVO/));
  assert.equal(state.past.length, 0);
});

test('SPEC-015-D REV7: estado vacío explica qué falta y abre Techumbre', () => {
  const state = useModelStore.getState();
  useModelStore.setState({
    model: {
      ...state.model,
      structuralIntent: { ...state.model.structuralIntent, roofIntents: [] }
    }
  });
  let requested = false;
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} onOpenStructuralIntent={() => { requested = true; }} />);
  assert.ok(screen.getByText('Falta declarar intención estructural de techumbre.'));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Intención estructural → Techumbre' }));
  assert.equal(requested, true);
});

test('SPEC-015-D REV7: glosario visible explica soporte local de canaleta', () => {
  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Conceptos' }));
  assert.ok(screen.getByText('Soporte local de canaleta'));
  assert.ok(screen.getByText(/No declara apoyo gravitacional de la cubierta/));
});


test('BUG-015-D-031: Gravedad muestra B1 parcial como interacción 1.700 mm y no como borde efectivo 10.400 mm', async () => {
  const { buildFx008Rev8Short } = await import('./helpers/spec015dRev8.mjs');
  const rev8 = await buildFx008Rev8Short({ declareEndpointSupports: false });
  useModelStore.setState({
    model: structuredClone(rev8.model),
    past: [],
    future: [],
    structuralProposalLocator: {
      active: false, kind: null, id: null, requested: null, hovered: null,
      snapshot: null, sourceFocusId: null
    }
  });

  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'G↓ Gravedad' }));

  assert.ok(screen.getByText(
    'Interfaz estructural declarada · B1 · Interacción S 12800→14500 · 1.700 mm · borde físico 10.400 mm · vigente'
  ));
  assert.ok(screen.getAllByText(
    /Borde de cubierta · Faldón poligonal 6–11A entre C–J · B1 · S 12800→14500 → Cara \+N · Muro X · 6→7 @ C/
  ).length >= 1);
});

test('BUG-015-D-034: Gravedad muestra rangos declarados de receptores C/6 y C/7 y conserva caminos completos', async () => {
  const { buildFx008Rev8Short } = await import('./helpers/spec015dRev8.mjs');
  const rev8 = await buildFx008Rev8Short({ declareEndpointSupports: true });
  useModelStore.setState({
    model: structuredClone(rev8.model),
    past: [],
    future: [],
    structuralProposalLocator: {
      active: false, kind: null, id: null, requested: null, hovered: null,
      snapshot: null, sourceFocusId: null
    }
  });

  render(<StructuralProposalWorkspaceDialog open onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'G↓ Gravedad' }));

  assert.ok(screen.getByText(
    'Interfaz estructural declarada · S 1949.45→2050.55 · Z 3250→4150 · vigente'
  ));
  assert.ok(screen.getByText(
    'Interfaz estructural declarada · S 1999.9→2000 · Z 3250→4150 · vigente'
  ));
  assert.equal(document.body.textContent.includes('S 1200→6600 · Z 450→4150'), false);
  assert.equal(document.body.textContent.includes('S 0→2000 · Z 450→4150'), false);
  assert.equal(screen.getAllByText(/G↓ gravedad · completeCandidate · 4 tramos/).length, 4);
  assert.equal(document.body.textContent.includes('SI-EXPLICIT-END-SUPPORT-UNRESOLVED'), false);
});
