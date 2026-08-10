import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyStructuralProposalDecision,
  prepareStructuralProposalDecision
} from '../src/core/applyStructuralProposalDecision.js';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';

function traceCount(model) {
  return model.structuralIntentTrace?.events?.length || 0;
}

test('aceptar muta intención, review y trace en una transacción pura', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const proposal = proposals.proposals[0];
  const prepared = prepareStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    proposalId: proposal.proposalId,
    disposition: 'accepted',
    visualFingerprint: 'visual-1'
  });
  const result = applyStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    preparedDecision: prepared,
    confirmed: true,
    currentVisualFingerprint: 'visual-1'
  });
  assert.equal(result.model.structuralProposalReviews.events.length, 1);
  assert.equal(traceCount(result.model), traceCount(model) + 1);
  assert.ok(result.model.structuralIntent.elementIntents.some((intent) => intent.elementId === proposal.targetId));
  assert.equal(model.structuralProposalReviews, undefined);
});

test('rechazar y diferir no modifican intención ni trace', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  for (const disposition of ['rejected', 'deferred']) {
    const prepared = prepareStructuralProposalDecision({
      model,
      structuralProposals: proposals,
      proposalId: proposals.proposals[0].proposalId,
      disposition
    });
    const result = applyStructuralProposalDecision({
      model,
      structuralProposals: proposals,
      preparedDecision: prepared,
      confirmed: true
    });
    assert.deepEqual(result.model.structuralIntent, model.structuralIntent);
    assert.deepEqual(result.model.structuralIntentTrace, model.structuralIntentTrace);
    assert.equal(result.model.structuralProposalReviews.events.length, 1);
  }
});

test('stale no crea intención, review ni trace', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const prepared = prepareStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    proposalId: proposals.proposals[0].proposalId,
    disposition: 'accepted',
    visualFingerprint: 'visual-before'
  });
  assert.throws(() => applyStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    preparedDecision: prepared,
    confirmed: true,
    currentVisualFingerprint: 'visual-after'
  }), (error) => error.code === 'SI-PROPOSAL-STALE');
  assert.equal(model.structuralProposalReviews, undefined);
});

test('modificar y aceptar no permite cambiar objetivo', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  assert.throws(() => prepareStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    proposalId: proposals.proposals[0].proposalId,
    disposition: 'modifiedAndAccepted',
    modifiedIntentPatch: { elementId: 'otro' }
  }), (error) => error.code === 'SI-PROPOSAL-TARGET-CHANGE-NOT-ALLOWED');
});
