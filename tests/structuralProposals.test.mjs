import assert from 'node:assert/strict';
import test from 'node:test';
import { generateStructuralProposals } from '../src/core/structuralProposals.js';
import {
  FX008_FRONTON_ID,
  FX008_GRAVITY_WALL_ID,
  buildFx008Spec015dContext,
  reverseSemanticCollections
} from './helpers/spec015d.mjs';

test('FX-008 genera dos propuestas gravitacionales no autoritativas con evidencia geométrica', async () => {
  const context = await buildFx008Spec015dContext();
  assert.equal(context.proposals.schema, 'structural-proposals-v1.0');
  assert.equal(context.proposals.proposals.length, 2);
  assert.deepEqual(
    context.proposals.proposals.map((proposal) => proposal.targetId).sort(),
    [FX008_GRAVITY_WALL_ID, FX008_FRONTON_ID].sort()
  );
  const lower = context.proposals.proposals.find((proposal) => proposal.targetId === FX008_GRAVITY_WALL_ID);
  assert.equal(lower.candidateState, 'candidate');
  assert.equal(lower.confidence, 'candidate');
  assert.equal(lower.evidence.matches[0].axisDistanceMm, 0);
  assert.equal(lower.evidence.matches[0].overlapMm, 9800);
  assert.equal(lower.evidence.matches[0].openings.length, 2);
  assert.ok(!JSON.stringify(context.proposals).includes('verified'));
});

test('permutar fuentes semánticas conserva resultado y fingerprints', async () => {
  const context = await buildFx008Spec015dContext();
  const permuted = generateStructuralProposals({
    geometry: reverseSemanticCollections(context.geometry),
    structuralIntent: reverseSemanticCollections(context.model.structuralIntent),
    roofStructuralIntent: [...context.roofStructuralIntent].reverse(),
    topology: reverseSemanticCollections(context.topology),
    config: {}
  });
  assert.deepEqual(permuted, context.proposals);
});

test('un borde no resistente no crea propuesta', async () => {
  const context = await buildFx008Spec015dContext();
  const roofStructuralIntent = structuredClone(context.roofStructuralIntent);
  roofStructuralIntent[0].boundaryIntents = roofStructuralIntent[0].boundaryIntents.map((intent) => ({
    ...intent,
    function: 'geometricBoundary'
  }));
  const result = generateStructuralProposals({
    geometry: context.geometry,
    structuralIntent: context.model.structuralIntent,
    roofStructuralIntent,
    topology: context.topology,
    config: {}
  });
  assert.deepEqual(result.proposals, []);
});
