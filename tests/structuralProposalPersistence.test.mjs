import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';
import { appendStructuralProposalReview } from '../src/core/structuralProposalReviews.js';

async function fixture() {
  return JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
}

const decision = {
  proposalId: `proposal:sha256:${'a'.repeat(64)}`,
  proposalFingerprint: 'b'.repeat(64),
  sourceAggregateSha256: 'c'.repeat(64),
  disposition: 'rejected',
  reasonCode: 'USER_REVIEW',
  note: 'No corresponde a la intención del proyecto.',
  targetType: 'element',
  targetId: 1784604634483,
  appliedIntentFingerprint: 'd'.repeat(64)
};

test('review log persiste en el modelo v3 y roundtrip nativo', async () => {
  const model = appendStructuralProposalReview(await fixture(), [decision]);
  const raw = serializeNativeProject(model);
  const prepared = prepareModelImport(JSON.parse(raw));
  assert.deepEqual(prepared.model.structuralProposalReviews, model.structuralProposalReviews);
  assert.equal(prepared.model.structuralProposalReviews.events.length, 1);
});

test('modelo v3 sin review log sigue siendo compatible y no inventa eventos', async () => {
  const model = await fixture();
  delete model.structuralProposalReviews;
  const prepared = prepareModelImport(model);
  assert.equal(prepared.model.structuralProposalReviews, undefined);
});
