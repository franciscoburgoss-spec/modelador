import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeStructuralProposalLocatorState,
  fitStructuralProposalLocatorState,
  openStructuralProposalLocatorState,
  requestStructuralProposalLocationState
} from '../src/core/structuralProposalLocator.js';

function state() {
  return {
    model: {
      viewMode: 'elevation-x-1', currentZLevelId: 7, selectedElementId: 9,
      selectedRoofSystemId: null, selectedRoofPlaneId: null,
      structuralIntent: { schema: 'structural-intent-v1.0' },
      structuralIntentTrace: { schema: 'structural-intent-trace-v1.0', events: [] },
      structuralProposalReviews: { schema: 'structural-proposal-review-log-v1.0', events: [] }
    },
    layout: 'single', view: { scale: 1, offsetX: 2, offsetY: 3 },
    viewB: { scale: 2, offsetX: 4, offsetY: 5 }, viewModeB: 'plan',
    past: [{ old: true }], future: []
  };
}

test('localizar encuadra de forma temporal y restaura vista/selección', () => {
  const original = state();
  const opened = openStructuralProposalLocatorState(original, {
    entity: { kind: 'element', id: 42 },
    preview: { bounds: { xMin: 0, xMax: 1000, yMin: 0, yMax: 100 } }
  });
  const fitted = fitStructuralProposalLocatorState(opened, 800, 600);
  assert.equal(fitted.model.viewMode, 'plan');
  assert.notEqual(fitted.view.scale, original.view.scale);
  const requested = requestStructuralProposalLocationState(fitted, { kind: 'element', id: 42 });
  assert.deepEqual(requested.structuralProposalLocator.requested, { kind: 'element', id: 42 });
  const closed = closeStructuralProposalLocatorState(requested);
  assert.equal(closed.model.viewMode, original.model.viewMode);
  assert.equal(closed.model.selectedElementId, original.model.selectedElementId);
  assert.deepEqual(closed.view, original.view);
  assert.deepEqual(closed.model.structuralIntent, original.model.structuralIntent);
  assert.deepEqual(closed.model.structuralIntentTrace, original.model.structuralIntentTrace);
  assert.deepEqual(closed.model.structuralProposalReviews, original.model.structuralProposalReviews);
});

test('REV8 Localizar transversal conserva intención, trace, review, historia y selección', () => {
  for (const entity of [
    { kind: 'structuralInterface', id: 'if:1' },
    { kind: 'structuralRegion', id: 'region:1' },
    { kind: 'structuralRelation', id: 'rel:1' }
  ]) {
    const original = state();
    original.model.structuralIntent = { schema: 'structural-intent-v1.1', interfaceIntents: [], relationIntents: [] };
    const opened = openStructuralProposalLocatorState(original, {
      entity,
      preview: { bounds: { xMin: 100, xMax: 500, yMin: 200, yMax: 800 } }
    });
    const requested = requestStructuralProposalLocationState(opened, entity);
    const closed = closeStructuralProposalLocatorState(requested);
    assert.deepEqual(closed.model.structuralIntent, original.model.structuralIntent);
    assert.deepEqual(closed.model.structuralIntentTrace, original.model.structuralIntentTrace);
    assert.deepEqual(closed.model.structuralProposalReviews, original.model.structuralProposalReviews);
    assert.deepEqual(closed.past, original.past);
    assert.deepEqual(closed.future, original.future);
    assert.equal(closed.model.selectedElementId, original.model.selectedElementId);
  }
});
