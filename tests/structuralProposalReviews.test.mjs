import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendStructuralProposalReview,
  createEmptyStructuralProposalReviewLog,
  materializeStructuralProposalReviews,
  validateStructuralProposalReviewLog
} from '../src/core/structuralProposalReviews.js';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';
import {
  applyStructuralProposalDecision,
  prepareStructuralProposalDecision
} from '../src/core/applyStructuralProposalDecision.js';
import { generateStructuralProposals } from '../src/core/structuralProposals.js';
import { setElementIntent } from '../src/core/structuralIntent.js';

test('review log nace sólo con la primera decisión y es append-only', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  assert.equal(model.structuralProposalReviews, undefined);
  const proposal = proposals.proposals[0];
  const next = appendStructuralProposalReview(model, [{
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
    sourceAggregateSha256: proposals.sourceFingerprints.aggregateSha256,
    disposition: 'rejected',
    reasonCode: 'REQUIERE-REVISION',
    note: null,
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    appliedIntentFingerprint: null
  }]);
  assert.equal(next.structuralProposalReviews.events.length, 1);
  assert.deepEqual(validateStructuralProposalReviewLog(next.structuralProposalReviews), []);
  assert.equal(model.structuralProposalReviews, undefined);
});

test('rechazo exacto se materializa y una propuesta cambiada reaparece superseded', async () => {
  const { model, proposals } = await buildFx008Spec015dContext();
  const proposal = proposals.proposals[0];
  const next = appendStructuralProposalReview(model, [{
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
    sourceAggregateSha256: proposals.sourceFingerprints.aggregateSha256,
    disposition: 'rejected',
    reasonCode: null,
    note: 'No corresponde',
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    appliedIntentFingerprint: null
  }]);
  assert.equal(materializeStructuralProposalReviews(proposals, next.structuralProposalReviews)[0].reviewState, 'rejected');
  const changed = structuredClone(proposals);
  changed.proposals[0].proposalFingerprint = '0'.repeat(64);
  assert.equal(materializeStructuralProposalReviews(changed, next.structuralProposalReviews)[0].reviewState, 'superseded');
});

test('log vacío es válido', () => {
  assert.deepEqual(validateStructuralProposalReviewLog(createEmptyStructuralProposalReviewLog()), []);
});


function recalculateProposals(context, model) {
  return generateStructuralProposals({
    geometry: context.geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent,
    topology: context.topology,
    config: {}
  });
}

function acceptProposal(context) {
  const proposal = context.proposals.proposals[0];
  const prepared = prepareStructuralProposalDecision({
    model: context.model,
    structuralProposals: context.proposals,
    proposalId: proposal.proposalId,
    disposition: 'accepted'
  });
  const outcome = applyStructuralProposalDecision({
    model: context.model,
    structuralProposals: context.proposals,
    preparedDecision: prepared,
    confirmed: true
  });
  return { proposal, outcome };
}

test('aceptación efectiva permanece accepted después de recalcular', async () => {
  const context = await buildFx008Spec015dContext();
  const { proposal, outcome } = acceptProposal(context);
  const recalculated = recalculateProposals(context, outcome.model);
  const current = recalculated.proposals.find((item) => item.proposalId === proposal.proposalId);
  assert.ok(current);
  assert.equal(current.proposalFingerprint, proposal.proposalFingerprint);
  const reviewed = materializeStructuralProposalReviews(
    recalculated,
    outcome.model.structuralProposalReviews,
    outcome.model.structuralIntent
  );
  assert.equal(
    reviewed.find((item) => item.proposal.proposalId === proposal.proposalId).reviewState,
    'accepted'
  );
});

test('cambio de intención no relacionado no invalida aceptación efectiva', async () => {
  const context = await buildFx008Spec015dContext();
  const { proposal, outcome } = acceptProposal(context);
  const unrelatedWall = context.geometry.elements.find((element) => (
    element.type === 'wall' && element.id !== proposal.targetId
  ));
  assert.ok(unrelatedWall);
  const changed = setElementIntent(outcome.model, unrelatedWall.id, {
    participation: 'undetermined',
    functions: [],
    secondaryInteraction: 'notApplicable',
    notes: 'Cambio no relacionado para regresión SPEC-015-D.'
  }).model;
  const recalculated = recalculateProposals(context, changed);
  const reviewed = materializeStructuralProposalReviews(
    recalculated,
    changed.structuralProposalReviews,
    changed.structuralIntent
  );
  assert.equal(
    reviewed.find((item) => item.proposal.proposalId === proposal.proposalId).reviewState,
    'accepted'
  );
});

test('cambio posterior de la intención aplicada vuelve la aceptación superseded', async () => {
  const context = await buildFx008Spec015dContext();
  const { proposal, outcome } = acceptProposal(context);
  const changed = setElementIntent(outcome.model, proposal.targetId, {
    participation: 'undetermined',
    functions: [],
    secondaryInteraction: 'notApplicable',
    notes: 'Cambio posterior deliberado.'
  }).model;
  const recalculated = recalculateProposals(context, changed);
  const reviewed = materializeStructuralProposalReviews(
    recalculated,
    changed.structuralProposalReviews,
    changed.structuralIntent
  );
  assert.equal(
    reviewed.find((item) => item.proposal.proposalId === proposal.proposalId).reviewState,
    'superseded'
  );
});
