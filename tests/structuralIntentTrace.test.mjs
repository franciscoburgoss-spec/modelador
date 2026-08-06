import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  StructuralIntentTraceError,
  appendStructuralIntentUserEvent,
  canonicalizeStructuralIntentTrace,
  createEmptyStructuralIntentTrace,
  fingerprintStructuralIntentTarget,
  validateStructuralIntentTrace
} from '../src/core/structuralIntentTrace.js';
import { createEmptyStructuralIntent, setElementIntent } from '../src/core/structuralIntent.js';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';

function base() {
  return {
    modelVersion: 3,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [{ id: 10, type: 'wall' }],
    wallTypes: [], projectParams: [], dimensions: [], roofSystems: [], roofPlanes: [],
    structuralIntent: createEmptyStructuralIntent()
  };
}

const intent = {
  intentId: 'intent:element:10', elementId: 10, participation: 'resistant',
  functions: ['support', 'gravityResistance'], secondaryInteraction: 'notApplicable',
  status: 'declared', source: 'userDeclared', notes: null
};

test('SPEC-015-C trace: fingerprint canonicaliza y distingue ausencia', () => {
  const reversed = { ...intent, functions: [...intent.functions].reverse() };
  assert.equal(
    fingerprintStructuralIntentTarget('element', 10, intent),
    fingerprintStructuralIntentTarget('element', 10, reversed)
  );
  assert.notEqual(
    fingerprintStructuralIntentTarget('element', 10, intent),
    fingerprintStructuralIntentTarget('element', 10, null)
  );
  assert.match(fingerprintStructuralIntentTarget('element', 10, intent), /^[a-f0-9]{64}$/);
});


test('SPEC-015-C trace: SHA-256 coincide con Node para UTF-8 y orden canónico', () => {
  const unicodeIntent = { ...intent, notes: 'revisión ñ / 日本語' };
  const envelope = {
    targetType: 'element',
    targetId: 10,
    intent: { ...unicodeIntent, functions: ['gravityResistance', 'support'] }
  };
  const expected = createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
  assert.equal(fingerprintStructuralIntentTarget('element', 10, unicodeIntent), expected);
});

test('SPEC-015-C trace: evento determinista y secuencia contigua', () => {
  const first = appendStructuralIntentUserEvent(base(), {
    operation: 'set', targetType: 'element',
    changes: [{ targetId: 10, previousIntent: null, nextIntent: intent }]
  });
  assert.equal(first.structuralIntentTrace.events[0].sequence, 1);
  assert.equal(first.structuralIntentTrace.events[0].changes[0].changeKind, 'created');
  const secondIntent = { ...intent, notes: 'cambio' };
  const second = appendStructuralIntentUserEvent(first, {
    operation: 'set', targetType: 'element',
    changes: [{ targetId: 10, previousIntent: intent, nextIntent: secondIntent }]
  });
  assert.equal(second.structuralIntentTrace.events[1].sequence, 2);
  assert.equal(second.structuralIntentTrace.events[1].changes[0].changeKind, 'modified');
  assert.deepEqual(validateStructuralIntentTrace(second.structuralIntentTrace), []);
});

test('SPEC-015-C trace: no-op e importación sin trace no materializan registro', () => {
  const source = base();
  assert.equal(appendStructuralIntentUserEvent(source, {
    operation: 'set', targetType: 'element',
    changes: [{ targetId: 10, previousIntent: intent, nextIntent: { ...intent } }]
  }), source);
  const prepared = prepareModelImport(source);
  assert.equal(Object.hasOwn(prepared.model, 'structuralIntentTrace'), false);
  assert.equal(JSON.parse(serializeNativeProject(source)).structuralIntentTrace, undefined);
});

test('SPEC-015-C trace: roundtrip v3 conserva registro opcional', () => {
  const changed = setElementIntent(base(), 10, {
    participation: 'resistant', functions: ['support']
  }, { recordUserAction: true }).model;
  const reopened = prepareModelImport(JSON.parse(serializeNativeProject(changed))).model;
  assert.deepEqual(reopened.structuralIntentTrace, changed.structuralIntentTrace);
});

test('SPEC-015-C trace: corpus inválido rechaza secuencia, hash, campos y no-op', () => {
  assert.deepEqual(canonicalizeStructuralIntentTrace(undefined), undefined);
  assert.deepEqual(createEmptyStructuralIntentTrace(), {
    schema: 'structural-intent-trace-v1.0', events: []
  });
  const invalid = {
    schema: 'otro', extra: true,
    events: [{
      sequence: 2, action: 'otro', operation: 'otro', targetType: 'otro', source: 'otro', extra: true,
      changes: [{
        targetType: 'element', targetId: null, changeKind: 'otro',
        previousFingerprint: 'x', nextFingerprint: 'x', extra: true
      }]
    }]
  };
  const codes = new Set(validateStructuralIntentTrace(invalid).map((issue) => issue.code));
  for (const code of [
    'SI-TRACE-UNKNOWN-FIELD', 'SI-TRACE-SCHEMA-INVALID', 'SI-TRACE-SEQUENCE-INVALID',
    'SI-TRACE-ACTION-INVALID', 'SI-TRACE-OPERATION-INVALID', 'SI-TRACE-TARGET-TYPE-INVALID',
    'SI-TRACE-SOURCE-INVALID', 'SI-TRACE-TARGET-TYPE-MISMATCH', 'SI-TRACE-TARGET-ID-INVALID',
    'SI-TRACE-CHANGE-KIND-INVALID', 'SI-TRACE-FINGERPRINT-INVALID', 'SI-TRACE-NO-OP-CHANGE'
  ]) assert.equal(codes.has(code), true, code);
  assert.throws(() => appendStructuralIntentUserEvent(base(), {
    operation: 'invalid', targetType: 'element', changes: [{}]
  }), StructuralIntentTraceError);
});
