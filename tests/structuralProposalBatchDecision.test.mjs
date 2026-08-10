import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStructuralProposalDecisionBatch,
  prepareStructuralProposalDecision
} from '../src/core/applyStructuralProposalDecision.js';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';

function traceCount(model) {
  return model.structuralIntentTrace?.events?.length || 0;
}

function prepareBatch(model, proposals, disposition) {
  return proposals.proposals.map((proposal) => prepareStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    proposalId: proposal.proposalId,
    disposition
  }));
}

test('lote homogéneo aceptado crea un review event y un trace batchSet', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const preparedDecisions = prepareBatch(model, proposals, 'accepted');
  const result = applyStructuralProposalDecisionBatch({
    model,
    structuralProposals: proposals,
    preparedDecisions,
    confirmed: true
  });
  assert.equal(result.model.structuralProposalReviews.events.length, 1);
  assert.equal(result.model.structuralProposalReviews.events[0].decisions.length, 2);
  assert.equal(traceCount(result.model), traceCount(model) + 1);
  assert.equal(result.model.structuralIntentTrace.events.at(-1).operation, 'batchSet');
  for (const proposal of proposals.proposals) {
    assert.ok(result.model.structuralIntent.elementIntents.some(
      (intent) => intent.elementId === proposal.targetId
    ));
  }
});

test('lote rechazado crea un review event sin cambiar intención ni trace', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const result = applyStructuralProposalDecisionBatch({
    model,
    structuralProposals: proposals,
    preparedDecisions: prepareBatch(model, proposals, 'rejected'),
    confirmed: true
  });
  assert.equal(result.model.structuralProposalReviews.events.length, 1);
  assert.equal(result.model.structuralProposalReviews.events[0].decisions.length, 2);
  assert.deepEqual(result.model.structuralIntent, model.structuralIntent);
  assert.deepEqual(result.model.structuralIntentTrace, model.structuralIntentTrace);
});

test('lote stale falla de forma atómica antes de intención, review o trace', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const preparedDecisions = proposals.proposals.map((proposal, index) => prepareStructuralProposalDecision({
    model,
    structuralProposals: proposals,
    proposalId: proposal.proposalId,
    disposition: 'accepted',
    visualFingerprint: `visual-${index}`
  }));
  assert.throws(() => applyStructuralProposalDecisionBatch({
    model,
    structuralProposals: proposals,
    preparedDecisions,
    confirmed: true,
    currentVisualFingerprints: Object.fromEntries(
      preparedDecisions.map((decision) => [decision.proposalId, 'changed'])
    )
  }), (error) => error.code === 'SI-PROPOSAL-STALE');
  assert.equal(model.structuralProposalReviews, undefined);
});

test('lote no homogéneo se rechaza antes de aplicar', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const [first, second] = proposals.proposals;
  const preparedDecisions = [
    prepareStructuralProposalDecision({
      model, structuralProposals: proposals, proposalId: first.proposalId, disposition: 'accepted'
    }),
    prepareStructuralProposalDecision({
      model, structuralProposals: proposals, proposalId: second.proposalId, disposition: 'rejected'
    })
  ];
  assert.throws(() => applyStructuralProposalDecisionBatch({
    model, structuralProposals: proposals, preparedDecisions, confirmed: true
  }), (error) => error.code === 'SI-PROPOSAL-BATCH-NOT-HOMOGENEOUS');
});
