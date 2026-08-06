import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BATCH_WALL_IDS,
  TARGET_WALL_ID,
  buildSpec015c1Evidence
} from '../scripts/generate-spec015c1-evidence.mjs';

test('SPEC-015-C-1 evidencia FX-008 es real, determinista y no muta autoridades', async () => {
  const generated = await buildSpec015c1Evidence();
  assert.deepEqual(generated.evidence.sourceGeometry, {
    walls: 45, openings: 43, foundations: 32, roofPlanes: 7, elements: 77
  });
  assert.equal(generated.evidence.individual.targetId, TARGET_WALL_ID);
  assert.equal(generated.evidence.individual.descriptor.orientation, 'X');
  assert.equal(generated.evidence.individual.descriptor.axis.coordinates, 'x=14.500→23.200 · y=2.000');
  assert.equal(generated.evidence.individual.descriptor.axis.nominal, '7→11A @ C');
  assert.deepEqual(generated.evidence.individual.descriptor.dimensions, {
    length: 8700, thickness: 101.1, height: 3700, openings: 3
  });
  assert.equal(generated.evidence.individual.openingIds.length, 3);
  assert.deepEqual(generated.evidence.batch.targetIds, [...BATCH_WALL_IDS]);
  assert.deepEqual(generated.evidence.batch.marks.map((item) => item.mark), ['S1', 'S2', 'S3']);
  assert.deepEqual(generated.evidence.locator, {
    historyChanges: 0,
    traceChanges: 0,
    authorityChanges: 0,
    globalSelectionPreserved: true,
    viewRestored: true,
    interactionSequence: ['open', 'hover', 'request', 'activate', 'fit', 'restore']
  });
  assert.deepEqual(generated.evidence.prohibitions, {
    structuralProposalsEnabled: false,
    loadPathsEnabled: false,
    topologyEnabled: false,
    globalSelectionExpanded: false,
    structuralInferencePerformed: false
  });

  const storedJson = await readFile(new URL('../evidence/spec-015-c-1/FX-008-SPEC-015-C-1.json', import.meta.url), 'utf8');
  const storedSvg = await readFile(new URL('../evidence/spec-015-c-1/FX-008-SPEC-015-C-1.svg', import.meta.url), 'utf8');
  const storedManifest = await readFile(new URL('../evidence/spec-015-c-1/MANIFEST.json', import.meta.url), 'utf8');
  assert.equal(storedJson, generated.json);
  assert.equal(storedSvg, generated.svg);
  assert.equal(storedManifest, generated.manifest);
});
