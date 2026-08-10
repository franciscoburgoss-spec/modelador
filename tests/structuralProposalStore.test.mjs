import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareStructuralProposalDecision
} from '../src/core/applyStructuralProposalDecision.js';
import { useModelStore } from '../src/store/useModelStore.js';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';

let context;

beforeEach(async () => {
  context = await buildFx008Spec015dContext();
  useModelStore.setState({
    model: structuredClone(context.model),
    past: [],
    future: []
  });
});

function prepare(proposal, disposition, options = {}) {
  return prepareStructuralProposalDecision({
    model: useModelStore.getState().model,
    structuralProposals: context.proposals,
    proposalId: proposal.proposalId,
    disposition,
    ...options
  });
}

test('SPEC-015-D: aceptar en store es un undo para intención, review y trace', () => {
  const original = structuredClone(useModelStore.getState().model);
  const proposal = context.proposals.proposals[0];
  useModelStore.getState().applyPreparedStructuralProposalDecision({
    structuralProposals: context.proposals,
    preparedDecision: prepare(proposal, 'accepted')
  });
  let state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.equal(
    state.model.structuralIntentTrace.events.length,
    (original.structuralIntentTrace?.events?.length || 0) + 1
  );

  state.undo();
  state = useModelStore.getState();
  assert.deepEqual(state.model, original);
  assert.equal(state.future.length, 1);

  state.redo();
  state = useModelStore.getState();
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.equal(state.past.length, 1);
});

test('SPEC-015-D: rechazo en store crea historial/review sin mutar intención ni trace', () => {
  const original = structuredClone(useModelStore.getState().model);
  const proposal = context.proposals.proposals[0];
  useModelStore.getState().applyPreparedStructuralProposalDecision({
    structuralProposals: context.proposals,
    preparedDecision: prepare(proposal, 'rejected')
  });
  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.deepEqual(state.model.structuralIntent, original.structuralIntent);
  assert.deepEqual(state.model.structuralIntentTrace, original.structuralIntentTrace);
});

test('SPEC-015-D: lote aceptado es un historial, un review event y un trace batchSet', () => {
  const original = structuredClone(useModelStore.getState().model);
  const preparedDecisions = context.proposals.proposals.map((proposal) => prepare(proposal, 'accepted'));
  useModelStore.getState().applyPreparedStructuralProposalDecisionBatch({
    structuralProposals: context.proposals,
    preparedDecisions
  });
  const state = useModelStore.getState();
  assert.equal(state.past.length, 1);
  assert.equal(state.model.structuralProposalReviews.events.length, 1);
  assert.equal(state.model.structuralProposalReviews.events[0].decisions.length, 2);
  assert.equal(
    state.model.structuralIntentTrace.events.length,
    (original.structuralIntentTrace?.events?.length || 0) + 1
  );
  assert.equal(state.model.structuralIntentTrace.events.at(-1).operation, 'batchSet');
});

test('SPEC-015-D: stale en store no crea historial ni mutación parcial', () => {
  const proposal = context.proposals.proposals[0];
  const before = structuredClone(useModelStore.getState().model);
  const preparedDecision = prepare(proposal, 'accepted', { visualFingerprint: 'before' });
  assert.throws(() => useModelStore.getState().applyPreparedStructuralProposalDecision({
    structuralProposals: context.proposals,
    preparedDecision,
    currentVisualFingerprint: 'after'
  }), (error) => error.code === 'SI-PROPOSAL-STALE');
  const state = useModelStore.getState();
  assert.deepEqual(state.model, before);
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
});
