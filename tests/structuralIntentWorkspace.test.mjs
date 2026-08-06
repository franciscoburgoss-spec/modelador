import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildElementIntentDraft,
  buildRoofIntentDraft,
  buildStructuralIntentWorkspace,
  classifyWorkspaceState,
  prepareElementIntentBatch,
  validateElementDraft,
  validateRoofDraft
} from '../src/core/structuralIntentWorkspace.js';
import { setElementIntent, setRoofIntent } from '../src/core/structuralIntent.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));

test('SPEC-015-C workspace: FX-008 lista 77 elementos, 45 muros y siete cubiertas sin inferir', () => {
  const workspace = buildStructuralIntentWorkspace(fixture);
  assert.equal(workspace.summary.elementsTotal, 77);
  assert.equal(workspace.summary.wallsTotal, 45);
  assert.equal(workspace.summary.foundationsTotal, 32);
  assert.equal(workspace.summary.roofsTotal, 7);
  assert.equal(workspace.summary.elementsDeclared, 0);
  assert.equal(workspace.elementRows.find((row) => row.id === 1784606313849).state, 'undefined');
});

test('SPEC-015-C workspace: B1…B6 siguen recorrido y conservan boundaryId', () => {
  const draft = buildRoofIntentDraft(fixture, 1785030887081);
  assert.deepEqual(draft.boundaryIntents.map((boundary) => boundary.label), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
  assert.equal(new Set(draft.boundaryIntents.map((boundary) => boundary.boundaryId)).size, 6);
  assert.ok(draft.boundaryIntents.every((boundary) => boundary.boundaryId.startsWith('roof:1785030887081:edge:')));
});

test('SPEC-015-C workspace: No definido, undetermined, inválido y referencia rota son distintos', () => {
  assert.equal(classifyWorkspaceState(), 'undefined');
  assert.equal(classifyWorkspaceState({ targetExists: false }), 'brokenReference');
  assert.equal(classifyWorkspaceState({ issues: [{}] }), 'invalid');
  const declared = setElementIntent(fixture, 1784818076062, {
    participation: 'undetermined', functions: [], secondaryInteraction: 'notApplicable'
  }).model;
  const draft = buildElementIntentDraft(declared, 1784818076062);
  assert.equal(draft.state, 'declared');
  assert.equal(draft.participation, 'undetermined');
  const invalid = validateElementDraft(fixture, 1784606313849, {
    participation: 'resistant', functions: [], secondaryInteraction: 'notApplicable', notes: ''
  });
  assert.equal(invalid.state, 'invalid');
  assert.ok(invalid.fields.functions.length > 0);
});


test('SPEC-015-C workspace: un borrador obsoleto queda Referencia rota sin mutar', () => {
  const elementId = 1784606313849;
  const elementDraft = buildElementIntentDraft(fixture, elementId);
  const elementChanged = setElementIntent(fixture, elementId, {
    participation: 'resistant',
    functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable'
  }).model;
  const staleElement = validateElementDraft(elementChanged, elementId, {
    ...elementDraft,
    participation: 'undetermined'
  });
  assert.equal(staleElement.ok, false);
  assert.equal(staleElement.state, 'brokenReference');
  assert.equal(staleElement.issues[0].code, 'SI-DRAFT-STALE');

  const roofId = 1785030887081;
  const roofDraft = buildRoofIntentDraft(fixture, roofId);
  const roofChanged = setRoofIntent(fixture, roofId, {
    loadDistribution: 'oneWay',
    primaryResistanceDirection: { x: 1, y: 0 },
    secondaryResistanceDirection: null,
    diaphragmBehavior: 'undetermined',
    boundaryIntents: roofDraft.boundaryIntents.map(({ boundaryId }) => ({
      boundaryId,
      function: 'undetermined'
    }))
  }).model;
  const staleRoof = validateRoofDraft(roofChanged, roofId, {
    ...roofDraft,
    loadDistribution: 'twoWay'
  });
  assert.equal(staleRoof.ok, false);
  assert.equal(staleRoof.state, 'brokenReference');
  assert.equal(staleRoof.issues[0].code, 'SI-DRAFT-STALE');
});

test('SPEC-015-C workspace: preview masiva informa cambios y fingerprint esperado', () => {
  const preview = prepareElementIntentBatch(fixture, [1784751397992, 1784752583321, 1784752639636], {
    participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'solidary',
    notesMode: 'preserve'
  });
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.effectiveChanges.length, 3);
  assert.equal(preview.expectedPrevious.length, 3);
  assert.ok(preview.expectedPrevious.every((item) => /^[a-f0-9]{64}$/.test(item.fingerprint)));
});
