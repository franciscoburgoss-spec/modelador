import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildSpec015bEvidence } from '../scripts/generate-spec015b-evidence.mjs';

test('SPEC-015-B: evidencia FX-008 es reproducible, byte-identical y cubre cuatro cubiertas', async () => {
  const generated = await buildSpec015bEvidence();
  assert.deepEqual(generated.evidence.counts, {
    walls: 45, openings: 43, foundations: 32, roofs: 7
  });
  assert.equal(generated.evidence.agnosticGeometry.bytesBefore, 81875);
  assert.equal(
    generated.evidence.agnosticGeometry.sha256Before,
    '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a'
  );
  assert.equal(generated.evidence.agnosticGeometry.byteIdentical, true);
  assert.deepEqual(generated.evidence.declarations.map((item) => item.roofGeometryId), [
    1785030887081, 1785161146258, 1785161396221, 1785161662029
  ]);
  assert.ok(generated.evidence.declarations.some((item) => item.intent.loadDistribution === 'undetermined'));
  assert.ok(generated.evidence.declarations.every((item) => item.boundary.boundaryId.length > 70));
  const storedJson = await readFile(new URL('../evidence/spec-015-b/FX-008-roof-intent.json', import.meta.url), 'utf8');
  const storedSvg = await readFile(new URL('../evidence/spec-015-b/FX-008-roof-intent.svg', import.meta.url), 'utf8');
  const storedManifest = await readFile(new URL('../evidence/spec-015-b/MANIFEST.json', import.meta.url), 'utf8');
  assert.equal(storedJson, generated.json);
  assert.equal(storedSvg, generated.svg);
  assert.equal(storedManifest, generated.manifest);
});
