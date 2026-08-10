import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildSpec015dRev8Evidence } from '../scripts/generate-spec015d-rev8-evidence.mjs';

test('REV8: evidencia FX-008 es determinista y conserva separación agnóstica', async () => {
  const first = await buildSpec015dRev8Evidence();
  const second = await buildSpec015dRev8Evidence();
  assert.deepEqual(second.data, first.data);
  assert.equal(first.data.invariants.geometryMutation, false);
  assert.equal(first.data.invariants.structuralAssembly, 'not-used');
  assert.ok(first.data.short.gravityPaths.every((path) => path.candidateState === 'completeCandidate'));
  assert.ok(first.data.continuous.gravityPaths.every((path) => path.candidateState === 'completeCandidate'));
  assert.match(first.svg, /face −N/);
  assert.match(first.svg, /C\/6→11A/);
});

test('REV8: evidencia versionada coincide con generador', async () => {
  const built = await buildSpec015dRev8Evidence();
  const stored = JSON.parse(await readFile(new URL('../evidence/spec-015-d-rev8/FX-008-SPEC-015-D-REV8.json', import.meta.url), 'utf8'));
  assert.deepEqual(stored, built.data);
});
