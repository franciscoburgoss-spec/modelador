import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { useModelStore } from '../src/store/useModelStore.js';
import {
  buildStructuralIntentVisualPresentation,
  buildStructuralIntentVisualPreview
} from '../src/core/structuralIntentVisualPresentation.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));

function reset() {
  useModelStore.setState({
    model: structuredClone(fixture),
    view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
    layout: 'split', viewModeB: 'elevation-x', past: [], future: [],
    structuralIntentLocator: {
      active: false, targetIds: [], activeId: null, hoveredId: null,
      requestedId: null, preview: null, sourceFocusId: null, snapshot: null
    }
  });
}

test('SPEC-015-C-1 locator: abrir, hover, seleccionar y encuadrar no crean historial ni trace', () => {
  reset();
  const store = useModelStore.getState();
  store.selectElement(1784600403613);
  const before = useModelStore.getState();
  const intentBefore = structuredClone(before.model.structuralIntent);
  const traceBefore = structuredClone(before.model.structuralIntentTrace);
  const preview = buildStructuralIntentVisualPreview(
    buildStructuralIntentVisualPresentation(before.model),
    [1784751397992, 1784752583321, 1784752639636],
    { activeId: 1784752583321 }
  );

  store.openStructuralIntentLocator({ preview, activeId: 1784752583321, sourceFocusId: 'locate-button' });
  useModelStore.getState().setStructuralIntentLocatorHover(1784751397992);
  useModelStore.getState().requestStructuralIntentLocatorTarget(1784752639636);
  useModelStore.getState().setStructuralIntentLocatorActive(1784752639636);
  useModelStore.getState().fitStructuralIntentLocator(1200, 800);

  const after = useModelStore.getState();
  assert.equal(after.past.length, 0);
  assert.equal(after.future.length, 0);
  assert.deepEqual(after.model.structuralIntent, intentBefore);
  assert.deepEqual(after.model.structuralIntentTrace, traceBefore);
  assert.equal(after.model.selectedElementId, 1784600403613);
  assert.equal(after.structuralIntentLocator.activeId, 1784752639636);
  assert.equal(after.structuralIntentLocator.hoveredId, 1784751397992);
  assert.equal(after.model.viewMode, 'plan');
});

test('SPEC-015-C-1 locator: Restaurar repone navegación y Conservar mantiene encuadre sin tocar selección', () => {
  reset();
  const preview = buildStructuralIntentVisualPreview(
    buildStructuralIntentVisualPresentation(useModelStore.getState().model), [1784605101040]
  );
  useModelStore.getState().selectElement(1784600403613);
  const originalView = structuredClone(useModelStore.getState().view);
  useModelStore.getState().openStructuralIntentLocator({ preview });
  useModelStore.getState().fitStructuralIntentLocator(1000, 700);
  assert.notDeepEqual(useModelStore.getState().view, originalView);
  useModelStore.getState().closeStructuralIntentLocator({ restoreView: true });
  assert.deepEqual(useModelStore.getState().view, originalView);
  assert.equal(useModelStore.getState().model.selectedElementId, 1784600403613);

  useModelStore.getState().openStructuralIntentLocator({ preview });
  useModelStore.getState().fitStructuralIntentLocator(1000, 700);
  const locatedView = structuredClone(useModelStore.getState().view);
  useModelStore.getState().closeStructuralIntentLocator({ restoreView: false });
  assert.deepEqual(useModelStore.getState().view, locatedView);
  assert.equal(useModelStore.getState().model.selectedElementId, 1784600403613);
  assert.equal(useModelStore.getState().structuralIntentLocator.active, false);
});
