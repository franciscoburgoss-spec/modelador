import test from 'node:test';
import assert from 'node:assert/strict';

import {
  StructuralIntentError,
  checkStructuralIntentBeforeMerge,
  clearStructuralIntent,
  createEmptyStructuralIntent,
  reconcileStructuralIntentAfterSplit,
  removeElementAndStructuralReferences,
  removeElementIntent,
  setElementIntent,
  validateStructuralIntent
} from '../src/core/structuralIntent.js';

function model(overrides = {}) {
  return {
    modelVersion: 3,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [
      { id: 10, type: 'wall', wallTypeId: 'MP1' },
      { id: 20, type: 'wall', wallTypeId: 'TAB' },
      { id: 30, type: 'column' }
    ],
    wallTypes: [
      { id: 'MP1', role: 'MP1', metalconDefaults: { spacing: 400 } },
      { id: 'TAB', role: 'tabique', osbDefaults: { panelWidth: 1220 } }
    ],
    structuralIntent: createEmptyStructuralIntent(),
    ...overrides
  };
}

test('SPEC-015-A: crea, actualiza, ordena y elimina intención sin tocar geometría ni Metalcon', () => {
  const source = model();
  const geometry = structuredClone(source.elements);
  const wallTypes = structuredClone(source.wallTypes);
  const first = setElementIntent(source, 20, {
    participation: 'secondary',
    functions: ['stabilization', 'spaceDivision'],
    secondaryInteraction: 'floating',
    notes: 'Tabique desacoplado'
  });
  const second = setElementIntent(first.model, 10, {
    participation: 'resistant',
    functions: ['inPlaneLateralResistance', 'gravityResistance'],
    secondaryInteraction: 'notApplicable'
  });
  assert.deepEqual(second.model.elements, geometry);
  assert.deepEqual(second.model.wallTypes, wallTypes);
  assert.deepEqual(
    second.model.structuralIntent.elementIntents.map((intent) => intent.elementId),
    [10, 20]
  );
  assert.deepEqual(second.model.structuralIntent.elementIntents[0].functions, [
    'gravityResistance',
    'inPlaneLateralResistance'
  ]);
  assert.deepEqual(second.affectedElementIds, [10]);
  assert.deepEqual(second.invalidatedStructuralDerivatives, []);
  const removed = removeElementIntent(second.model, 10);
  assert.deepEqual(removed.model.structuralIntent.elementIntents.map((intent) => intent.elementId), [20]);
  const cleared = clearStructuralIntent(removed.model);
  assert.deepEqual(cleared.model.structuralIntent, createEmptyStructuralIntent());
});

test('SPEC-015-A: undetermined es válido y no se deriva desde wallType.role', () => {
  const source = model();
  assert.deepEqual(source.structuralIntent.elementIntents, []);
  const changed = setElementIntent(source, 10, {
    participation: 'undetermined',
    functions: [],
    secondaryInteraction: 'notApplicable'
  });
  assert.equal(changed.model.structuralIntent.elementIntents[0].participation, 'undetermined');
  assert.equal(changed.model.structuralIntent.elementIntents.length, 1);
  assert.equal(source.structuralIntent.elementIntents.length, 0);
});

test('SPEC-015-A: referencias, duplicados y combinaciones inválidas fallan antes de mutar', () => {
  const source = model();
  const before = structuredClone(source);
  const invalidInputs = [
    [999, { participation: 'resistant', functions: ['support'] }],
    [10, { participation: 'resistant', functions: ['spaceDivision'] }],
    [10, { participation: 'secondary', functions: ['gravityResistance'], secondaryInteraction: 'solidary' }],
    [10, { participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'notApplicable' }],
    [10, { participation: 'resistant', functions: ['support', 'support'] }],
    [10, { participation: 'resistant', functions: ['invented'] }]
  ];
  for (const [elementId, input] of invalidInputs) {
    assert.throws(
      () => setElementIntent(source, elementId, input),
      (error) => error instanceof StructuralIntentError
    );
    assert.deepEqual(source, before);
  }
  const duplicateRoot = {
    ...createEmptyStructuralIntent(),
    elementIntents: [
      {
        intentId: 'intent:element:10', elementId: 10, participation: 'resistant',
        functions: ['support'], secondaryInteraction: 'notApplicable', status: 'declared',
        source: 'userDeclared', notes: null
      },
      {
        intentId: 'intent:element:10', elementId: 10, participation: 'resistant',
        functions: ['support'], secondaryInteraction: 'notApplicable', status: 'declared',
        source: 'userDeclared', notes: null
      }
    ]
  };
  const issues = validateStructuralIntent(duplicateRoot, source.elements);
  assert.ok(issues.some((issue) => issue.code === 'SI-DUPLICATE-INTENT-ID'));
  assert.ok(issues.some((issue) => issue.code === 'SI-DUPLICATE-ELEMENT-INTENT'));
});

test('SPEC-015-A: división elimina la referencia y persiste finding con la intención original', () => {
  const source = setElementIntent(model(), 10, {
    participation: 'resistant',
    functions: ['gravityResistance']
  }).model;
  const next = {
    ...source,
    elements: source.elements.filter((element) => element.id !== 10).concat([
      { id: 11, type: 'wall', wallTypeId: 'MP1' },
      { id: 12, type: 'wall', wallTypeId: 'MP1' }
    ])
  };
  const reconciled = reconcileStructuralIntentAfterSplit(source, next, 10, [12, 11]);
  assert.deepEqual(reconciled.model.structuralIntent.elementIntents, []);
  assert.equal(reconciled.finding.code, 'SI-INTENT-REVIEW-AFTER-SPLIT');
  assert.deepEqual(reconciled.finding.targetElementIds, [11, 12]);
  assert.equal(reconciled.finding.originalIntent.elementId, 10);
  assert.deepEqual(reconciled.model.elements.find((element) => element.id === 11).wallTypeId, 'MP1');
});

test('SPEC-015-A: unión se bloquea si cualquier origen tiene intención y ausencia no inventa una', () => {
  const source = model();
  assert.deepEqual(checkStructuralIntentBeforeMerge(source, [10, 20]), {
    ok: true,
    sourceIntents: []
  });
  const declared = setElementIntent(source, 10, {
    participation: 'resistant',
    functions: ['support']
  }).model;
  const blocked = checkStructuralIntentBeforeMerge(declared, [10, 20]);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'SI-MERGE-INTENT-DECISION-REQUIRED');
  assert.deepEqual(blocked.elementIds, [10]);
});

test('SPEC-015-A: eliminar un elemento elimina intención y referencias de revisión, no otros datos', () => {
  const sourceWithIntent = setElementIntent(model(), 10, {
    participation: 'resistant',
    functions: ['support']
  }).model;
  const splitModel = {
    ...sourceWithIntent,
    elements: sourceWithIntent.elements.filter((element) => element.id !== 10).concat([
      { id: 11, type: 'wall', wallTypeId: 'MP1' },
      { id: 12, type: 'wall', wallTypeId: 'MP1' }
    ])
  };
  const afterSplit = reconcileStructuralIntentAfterSplit(sourceWithIntent, splitModel, 10, [11, 12]).model;
  const removed = removeElementAndStructuralReferences(afterSplit, 11);
  assert.equal(removed.model.elements.some((element) => element.id === 11), false);
  assert.deepEqual(removed.model.structuralIntentFindings, []);
  assert.deepEqual(removed.model.wallTypes, sourceWithIntent.wallTypes);
});

test('SPEC-015-A: el corpus adversario cubre forma, campos y findings tipados', async () => {
  const api = await import('../src/core/structuralIntent.js');
  const source = model();
  assert.equal(api.canonicalizeStructuralIntent(null), null);
  assert.equal(api.canonicalizeStructuralIntentFindings(undefined), undefined);
  assert.deepEqual(api.validateStructuralIntent(null, source.elements)[0].code, 'SI-EXPECTED-OBJECT');
  assert.deepEqual(api.validateStructuralIntentFindings({}, source.elements)[0].code, 'SI-EXPECTED-ARRAY');

  const malformedRoot = {
    schema: 'otro',
    elementIntents: [
      null,
      {
        intentId: 'incorrecto',
        elementId: null,
        participation: 'invented',
        functions: 'support',
        secondaryInteraction: 'invented',
        status: 'verified',
        source: 'inferred',
        notes: 42,
        extra: true
      },
      {
        intentId: 'intent:element:999',
        elementId: 999,
        participation: 'secondary',
        functions: ['spaceDivision'],
        secondaryInteraction: 'notApplicable',
        status: 'declared',
        source: 'userDeclared',
        notes: null
      }
    ],
    roofIntents: [{}],
    intersectionIntents: [{}],
    supportIntents: [{}],
    diaphragmIntents: [{}],
    overrides: [{}],
    unknown: []
  };
  const rootCodes = new Set(api.validateStructuralIntent(malformedRoot, source.elements).map((issue) => issue.code));
  for (const code of [
    'SI-UNKNOWN-ROOT-FIELD', 'SI-INVALID-SCHEMA', 'SI-COLLECTION-NOT-ACTIVE',
    'SI-EXPECTED-OBJECT', 'SI-UNKNOWN-FIELD', 'SI-MISSING-ELEMENT-ID',
    'SI-INVALID-INTENT-ID', 'SI-INVALID-PARTICIPATION', 'SI-EXPECTED-ARRAY',
    'SI-INVALID-SECONDARY-INTERACTION', 'SI-INVALID-STATUS', 'SI-INVALID-SOURCE',
    'SI-INVALID-NOTES', 'SI-ELEMENT-REFERENCE-NOT-FOUND', 'SI-SECONDARY-INTERACTION-REQUIRED'
  ]) assert.equal(rootCodes.has(code), true, code);
  assert.throws(() => api.assertValidStructuralIntent(malformedRoot, source.elements), api.StructuralIntentError);

  const findings = [
    null,
    {
      findingId: '', code: 'otro', severity: 'error', status: 'closed', targetElementIds: [],
      originalIntent: null
    },
    {
      findingId: 'F1', code: api.STRUCTURAL_INTENT_SPLIT_REVIEW, severity: 'warning', status: 'open',
      targetElementIds: [10, 999], originalIntent: {}
    },
    {
      findingId: 'F1', code: api.STRUCTURAL_INTENT_SPLIT_REVIEW, severity: 'warning', status: 'open',
      targetElementIds: [10, 20], originalIntent: {}
    }
  ];
  const findingCodes = new Set(api.validateStructuralIntentFindings(findings, source.elements).map((issue) => issue.code));
  for (const code of [
    'SI-EXPECTED-OBJECT', 'SI-INVALID-FINDING-ID', 'SI-INVALID-FINDING-CODE',
    'SI-INVALID-FINDING-STATE', 'SI-INVALID-FINDING-TARGETS',
    'SI-ELEMENT-REFERENCE-NOT-FOUND', 'SI-DUPLICATE-FINDING-ID'
  ]) assert.equal(findingCodes.has(code), true, code);
  assert.equal(api.canonicalizeStructuralIntentFindings(findings).filter(Boolean).at(-1).findingId, 'F1');

  for (const input of [
    null,
    { unknown: true },
    { elementId: 20, participation: 'resistant', functions: ['support'] },
    { intentId: 'otro', participation: 'resistant', functions: ['support'] },
    { status: 'verified', participation: 'resistant', functions: ['support'] },
    { source: 'inferred', participation: 'resistant', functions: ['support'] }
  ]) assert.throws(() => api.setElementIntent(source, 10, input), api.StructuralIntentError);

  const noIntent = api.removeElementIntent(source, 10);
  assert.equal(noIntent.model, source);
  const splitWithoutIntent = {
    ...source,
    elements: source.elements.filter((element) => element.id !== 10).concat([
      { id: 11, type: 'wall' }, { id: 12, type: 'wall' }
    ])
  };
  assert.equal(api.reconcileStructuralIntentAfterSplit(source, splitWithoutIntent, 10, [11, 12]).finding, null);
  assert.throws(
    () => api.reconcileStructuralIntentAfterSplit(source, splitWithoutIntent, 10, [11]),
    api.StructuralIntentError
  );
  assert.throws(() => api.removeElementAndStructuralReferences(source, 999), api.StructuralIntentError);
  assert.throws(() => api.setElementIntent({}, 10, {}), api.StructuralIntentError);
});
