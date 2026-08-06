import test from 'node:test';
import assert from 'node:assert/strict';

import {
  StructuralIntentError,
  createEmptyStructuralIntent,
  removeElementIntentsBatch,
  setElementIntent,
  setElementIntentsBatch
} from '../src/core/structuralIntent.js';
import { fingerprintStructuralIntentTarget } from '../src/core/structuralIntentTrace.js';

function model() {
  return {
    modelVersion: 3,
    grid: { xAxes: [], yAxes: [], zLevels: [] }, wallTypes: [],
    elements: [{ id: 2, type: 'wall' }, { id: '2', type: 'wall' }, { id: 1, type: 'wall' }],
    structuralIntent: createEmptyStructuralIntent()
  };
}

function input(overrides = {}) {
  return {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve', ...overrides
  };
}

test('SPEC-015-C batch: conserva IDs tipados, ordena y registra un evento', () => {
  const outcome = setElementIntentsBatch(model(), ['2', 2, 1], input(), { recordUserAction: true });
  assert.deepEqual(outcome.affectedElementIds, [1, 2, '2']);
  assert.equal(outcome.model.structuralIntentTrace.events.length, 1);
  assert.equal(outcome.model.structuralIntentTrace.events[0].operation, 'batchSet');
  assert.deepEqual(
    outcome.model.structuralIntentTrace.events[0].changes.map((change) => change.targetId),
    [1, 2, '2']
  );
});

test('SPEC-015-C batch: preserva o reemplaza notas por objetivo', () => {
  let source = setElementIntent(model(), 1, {
    participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'floating', notes: 'uno'
  }).model;
  source = setElementIntent(source, 2, {
    participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'floating', notes: 'dos'
  }).model;
  const preserved = setElementIntentsBatch(source, [1, 2], input()).model;
  assert.deepEqual(preserved.structuralIntent.elementIntents.map((item) => item.notes), ['uno', 'dos']);
  const replaced = setElementIntentsBatch(source, [1, 2], input({ notesMode: 'replace', notes: 'común' })).model;
  assert.deepEqual(replaced.structuralIntent.elementIntents.map((item) => item.notes), ['común', 'común']);
});

test('SPEC-015-C batch: duplicado, objetivo faltante, candidato inválido y preview stale son atómicos', () => {
  const source = model();
  const before = structuredClone(source);
  const cases = [
    () => setElementIntentsBatch(source, [1, 1], input()),
    () => setElementIntentsBatch(source, [1, 999], input()),
    () => setElementIntentsBatch(source, [1, 2], input({ functions: ['gravityResistance'] })),
    () => setElementIntentsBatch(source, [1], input(), {
      expectedPrevious: [{ elementId: 1, fingerprint: '0'.repeat(64) }]
    })
  ];
  const expected = [
    'SI-BATCH-DUPLICATE-TARGET', 'SI-BATCH-TARGET-NOT-FOUND',
    'SI-BATCH-CANDIDATE-INVALID', 'SI-BATCH-PREVIEW-STALE'
  ];
  cases.forEach((operation, index) => assert.throws(operation, (error) => (
    error instanceof StructuralIntentError && error.code === expected[index]
  )));
  assert.deepEqual(source, before);
});

test('SPEC-015-C batch: expectedPrevious válido, no-op y eliminación masiva', () => {
  const source = setElementIntentsBatch(model(), [1, 2], input()).model;
  const expectedPrevious = [1, 2].map((elementId) => {
    const current = source.structuralIntent.elementIntents.find((intent) => intent.elementId === elementId);
    return { elementId, fingerprint: fingerprintStructuralIntentTarget('element', elementId, current) };
  });
  const noOp = setElementIntentsBatch(source, [2, 1], input(), { expectedPrevious });
  assert.equal(noOp.model, source);
  const removed = removeElementIntentsBatch(source, [2, 1], {
    expectedPrevious, recordUserAction: true
  });
  assert.deepEqual(removed.affectedElementIds, [1, 2]);
  assert.deepEqual(removed.model.structuralIntent.elementIntents, []);
  assert.equal(removed.model.structuralIntentTrace.events[0].operation, 'batchRemove');
});
