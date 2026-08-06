import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_STRUCTURAL_INTENT_LOCATOR,
  closeStructuralIntentLocatorState,
  fitStructuralIntentLocatorState,
  openStructuralIntentLocatorState,
  requestStructuralIntentLocatorTargetState,
  setStructuralIntentLocatorActiveState,
  setStructuralIntentLocatorHoverState
} from '../src/core/structuralIntentLocator.js';

function state() {
  return {
    model: {
      viewMode: 'elevation-x', currentZLevelId: 'Z1', selectedElementId: 99,
      selectedRoofSystemId: null, selectedRoofPlaneId: null,
      structuralIntent: { schema: 'structural-intent-v1.0' },
      structuralIntentTrace: { events: [] }
    },
    past: [{ sentinel: 'past' }], future: [{ sentinel: 'future' }],
    projectDocument: { dirty: false },
    layout: 'split', viewModeB: 'elevation-y',
    view: { scale: 1, offsetX: 2, offsetY: 3, showAxes: true },
    viewB: { scale: 4, offsetX: 5, offsetY: 6, showAxes: false },
    structuralIntentLocator: { ...EMPTY_STRUCTURAL_INTENT_LOCATOR }
  };
}

const preview = {
  canUse: true, activeId: 2,
  targetBounds: { xMin: 0, xMax: 1000, yMin: 0, yMax: 500, zMin: 0, zMax: 3000 },
  visibleBounds: { xMin: -100, xMax: 1200, yMin: -100, yMax: 700, zMin: 0, zMax: 3000 },
  selected: [{ id: 1, mark: 'S1' }, { id: 2, mark: 'S2' }]
};

test('SPEC-015-C-1 locator puro no toca historia, trace, intención ni selección global', () => {
  const before = state();
  let next = openStructuralIntentLocatorState(before, { preview, sourceFocusId: 'button' });
  next = setStructuralIntentLocatorHoverState(next, 1);
  next = requestStructuralIntentLocatorTargetState(next, 2);
  next = setStructuralIntentLocatorActiveState(next, 2);
  next = fitStructuralIntentLocatorState(next, 1200, 800);
  assert.deepEqual(next.past, before.past);
  assert.deepEqual(next.future, before.future);
  assert.deepEqual(next.model.structuralIntent, before.model.structuralIntent);
  assert.deepEqual(next.model.structuralIntentTrace, before.model.structuralIntentTrace);
  assert.equal(next.model.selectedElementId, 99);
  assert.equal(next.structuralIntentLocator.activeId, 2);
  assert.equal(next.structuralIntentLocator.hoveredId, 1);
  assert.equal(next.model.viewMode, 'plan');
});

test('SPEC-015-C-1 locator restaura o conserva navegación y siempre repone selección', () => {
  const before = state();
  const opened = openStructuralIntentLocatorState(before, { preview });
  const fitted = fitStructuralIntentLocatorState(opened, 1000, 700);
  const restored = closeStructuralIntentLocatorState(fitted, { restoreView: true });
  assert.deepEqual(restored.view, before.view);
  assert.deepEqual(restored.viewB, before.viewB);
  assert.equal(restored.layout, before.layout);
  assert.equal(restored.model.viewMode, before.model.viewMode);
  assert.equal(restored.model.selectedElementId, 99);

  const kept = closeStructuralIntentLocatorState(fitted, { restoreView: false });
  assert.deepEqual(kept.view, fitted.view);
  assert.equal(kept.model.viewMode, 'plan');
  assert.equal(kept.model.selectedElementId, 99);
  assert.equal(kept.structuralIntentLocator.active, false);
});
