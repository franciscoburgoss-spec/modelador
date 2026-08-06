import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  setElementIntent,
  setElementIntentsBatch,
  setRoofIntent
} from '../src/core/structuralIntent.js';
import { buildRoofIntentDraft, buildStructuralIntentWorkspace } from '../src/core/structuralIntentWorkspace.js';
import { serializeAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));
const geometryBefore = serializeAgnosticGeometry(fixture);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('SPEC-015-C FX-008: flujo macro→micro termina con cuatro eventos y geometría idéntica', () => {
  const frontonId = 1784819708086;
  const interiorId = 1784606313849;
  const secondaryIds = [1784751397992, 1784752583321, 1784752639636];
  const roofId = 1785030887081;

  let current = structuredClone(fixture);
  const roofDraft = buildRoofIntentDraft(current, roofId);
  const functions = [
    'gutterSupport', 'geometricBoundary', 'gravitySupport',
    'geometricBoundary', 'gravitySupport', 'lateralSupport'
  ];
  current = setRoofIntent(current, roofId, {
    loadDistribution: 'oneWay',
    primaryResistanceDirection: { x: 0, y: 1 },
    secondaryResistanceDirection: null,
    diaphragmBehavior: 'candidate',
    boundaryIntents: roofDraft.boundaryIntents.map((boundary, index) => ({
      boundaryId: boundary.boundaryId,
      function: functions[index]
    }))
  }, { recordUserAction: true }).model;

  assert.equal(current.structuralIntent.elementIntents.some((item) => item.elementId === frontonId), false);
  current = setElementIntent(current, interiorId, {
    participation: 'resistant', functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable'
  }, { recordUserAction: true }).model;
  current = setElementIntentsBatch(current, secondaryIds, {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve'
  }, { recordUserAction: true }).model;
  current = setElementIntent(current, 1784752583321, {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'floating'
  }, { recordUserAction: true }).model;

  const workspace = buildStructuralIntentWorkspace(current);
  assert.equal(workspace.summary.elementsDeclared, 4);
  assert.equal(workspace.summary.roofsDeclared, 1);
  assert.equal(current.structuralIntentTrace.events.length, 4);
  assert.deepEqual(current.structuralIntentTrace.events.map((event) => event.operation), [
    'set', 'set', 'batchSet', 'set'
  ]);
  assert.equal(current.structuralIntent.intersectionIntents.length, 0);
  assert.equal(current.structuralIntent.supportIntents.length, 0);
  assert.equal(current.structuralIntent.diaphragmIntents.length, 0);
  assert.equal(current.structuralIntent.overrides.length, 0);

  const reopened = prepareModelImport(JSON.parse(serializeNativeProject(current))).model;
  assert.deepEqual(reopened.structuralIntent, current.structuralIntent);
  assert.deepEqual(reopened.structuralIntentTrace, current.structuralIntentTrace);
  const geometryAfter = serializeAgnosticGeometry(current);
  assert.equal(geometryAfter, geometryBefore);
  assert.equal(Buffer.byteLength(geometryAfter), 81875);
  assert.equal(sha256(geometryAfter), '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a');
});

test('SPEC-015-C FX-008: undetermined es una declaración aislada válida, no ausencia', () => {
  const changed = setElementIntent(fixture, 1784818076062, {
    participation: 'undetermined', functions: [], secondaryInteraction: 'notApplicable'
  }).model;
  const intent = changed.structuralIntent.elementIntents.find((item) => item.elementId === 1784818076062);
  assert.equal(intent.participation, 'undetermined');
  assert.equal(intent.status, 'declared');
});
