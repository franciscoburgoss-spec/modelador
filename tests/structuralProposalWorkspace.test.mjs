import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFx008Spec015dContext } from './helpers/spec015d.mjs';
import { buildStructuralProposalWorkspace } from '../src/core/structuralProposalWorkspace.js';

function modelWithRoofIntent(context) {
  return {
    ...context.model,
    structuralIntent: {
      ...context.model.structuralIntent,
      roofIntents: context.roofStructuralIntent
    }
  };
}

test('workspace puro aplica contratos a FX-008 sin crear autoridad nueva', async () => {
  const context = await buildFx008Spec015dContext();
  const model = modelWithRoofIntent(context);
  const before = structuredClone(model);
  const workspace = buildStructuralProposalWorkspace(model, { analysisContexts: [{ graph: 'lateral', direction: 'x' }] });
  assert.equal(workspace.schema, 'structural-proposal-workspace-v1.0');
  assert.equal(workspace.structuralProposals.proposals.length, 2);
  assert.equal(workspace.candidateLoadPaths.gravity.paths.length, 2);
  assert.equal(workspace.candidateLoadPaths.lateral.paths.length, 1);
  assert.equal(workspace.reviewedProposals.every((item) => item.reviewState === 'pending'), true);
  assert.deepEqual(model, before);
});

test('workspace usa descriptores humanos en el grafo lateral', async () => {
  const context = await buildFx008Spec015dContext();
  const workspace = buildStructuralProposalWorkspace(modelWithRoofIntent(context), { analysisContexts: [{ graph: 'lateral', direction: 'x' }] });
  const titles = workspace.visualPresentation.graphs.lateral.nodes.map((node) => node.title);
  assert.ok(titles.some((title) => title.includes('Faldón rectangular')));
  assert.ok(titles.some((title) => title.includes('Muro X')));
  assert.equal(titles.some((title) => /^(Muro|Cubierta|Faldón)\s+\d+$/.test(title)), false);
});


test('SPEC-015-D REV7: estado vacío explica ausencia de intención de techumbre', async () => {
  const context = await buildFx008Spec015dContext();
  const model = {
    ...context.model,
    structuralIntent: { ...context.model.structuralIntent, roofIntents: [] }
  };
  const workspace = buildStructuralProposalWorkspace(model);
  assert.equal(workspace.structuralProposals.proposals.length, 0);
  assert.equal(workspace.proposalReadiness.state, 'noRoofIntent');
  assert.equal(workspace.proposalReadiness.action, 'openRoofIntent');
  assert.match(workspace.proposalReadiness.message, /no inventa apoyos/);
});

test('SPEC-015-D REV7: distingue bordes no resistentes de receptores incompatibles', async () => {
  const context = await buildFx008Spec015dContext();
  const roofIntents = structuredClone(context.roofStructuralIntent);
  roofIntents[0].boundaryIntents = roofIntents[0].boundaryIntents.map((item) => ({
    ...item,
    function: 'geometricBoundary'
  }));
  const model = {
    ...context.model,
    structuralIntent: { ...context.model.structuralIntent, roofIntents }
  };
  const workspace = buildStructuralProposalWorkspace(model);
  assert.equal(workspace.proposalReadiness.state, 'noResistantBoundary');
  assert.match(workspace.proposalReadiness.message, /soporte local de canaleta/i);
});
