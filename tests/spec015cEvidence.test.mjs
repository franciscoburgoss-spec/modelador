import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildSpec015cEvidence } from '../scripts/generate-spec015c-evidence.mjs';

test('SPEC-015-C: evidencia FX-008 es reproducible, completa y byte-identical', async () => {
  const generated = await buildSpec015cEvidence();
  assert.deepEqual(generated.evidence.counts, {
    walls: 45, openings: 43, foundations: 32, roofs: 7, elements: 77
  });
  assert.equal(generated.evidence.initial.tracePresent, false);
  assert.equal(generated.evidence.final.frontonIntent, null);
  assert.equal(generated.evidence.isolatedUndetermined.integratedIntoFinalState, false);
  assert.equal(generated.evidence.isolatedUndetermined.intent.participation, 'undetermined');
  assert.equal(generated.evidence.final.elementIntents.length, 4);
  assert.equal(generated.evidence.final.roofIntents.length, 1);
  assert.equal(generated.evidence.trace.events.length, 4);
  assert.deepEqual(generated.evidence.trace.events.map((event) => event.operation), [
    'set', 'set', 'batchSet', 'set'
  ]);
  assert.equal(generated.evidence.roof.boundaries.length, 6);
  assert.deepEqual(generated.evidence.roof.boundaries.map((item) => item.label), [
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6'
  ]);
  assert.equal(generated.evidence.history.undoRemovesFloating, true);
  assert.equal(generated.evidence.history.redoRestoresFloating, true);
  assert.equal(generated.evidence.persistence.deepEqual, true);
  assert.equal(generated.evidence.agnosticGeometry.bytesBefore, 81875);
  assert.equal(generated.evidence.agnosticGeometry.sha256Before, '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a');
  assert.equal(generated.evidence.agnosticGeometry.byteIdentical, true);
  assert.deepEqual(generated.evidence.inactiveCollections, {
    intersectionIntents: 0, supportIntents: 0, diaphragmIntents: 0, overrides: 0
  });
  assert.ok(generated.evidence.errorScenarios.every((item) => item.code));
  assert.equal(generated.evidence.interpretation.capacityVerification, false);

  const storedJson = await readFile(new URL('../evidence/spec-015-c/FX-008-structural-intent-workspace.json', import.meta.url), 'utf8');
  const storedHtml = await readFile(new URL('../evidence/spec-015-c/FX-008-structural-intent-workspace.html', import.meta.url), 'utf8');
  const storedManifest = await readFile(new URL('../evidence/spec-015-c/MANIFEST.json', import.meta.url), 'utf8');
  assert.equal(storedJson, generated.json);
  assert.equal(storedHtml, generated.html);
  assert.equal(storedManifest, generated.manifest);
});
