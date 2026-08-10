import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { buildCandidateLoadPaths } from '../src/core/candidateLoadPaths.js';
import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';
import { applyStructuralInterfaceTransaction } from '../src/core/structuralIntent.js';
import { generateStructuralProposals } from '../src/core/structuralProposals.js';
import {
  FX008_C_7_11A,
  FX008_FRONTON_C_6_7,
  buildFx008Rev8Continuous,
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

test('REV8 FX-008: dos cubiertas entran por caras opuestas sin convertir cara en acción lateral', async () => {
  const { model, paths } = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const faces = model.structuralIntent.interfaceIntents.filter((item) => (
    item.ownerRef.kind === 'element' && item.ownerRef.id === FX008_FRONTON_C_6_7 && item.locator.kind === 'face'
  ));
  assert.equal(faces.length, 2);
  assert.deepEqual(new Set(faces.map((item) => item.locator.side)), new Set(['negativeN', 'positiveN']));
  assert.ok(faces.every((item) => !Object.hasOwn(item, 'actionFamily')));
  const starts = paths.gravity.paths.filter((path) => path.sourceRefs.boundaryId);
  assert.ok(starts.length >= 2);
  assert.ok(starts.every((path) => path.candidateState === 'completeCandidate'));
});

test('REV8 FX-008: extremo sin support declarado queda incompleto y no cae a geometría silenciosamente', async () => {
  const { paths } = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const explicit = paths.gravity.paths.filter((path) => path.sourceRefs.relationId);
  assert.ok(explicit.length >= 2);
  assert.ok(explicit.every((path) => path.candidateState === 'incompleteCandidate'));
  assert.ok(explicit.every((path) => path.findings.includes('SI-EXPLICIT-END-SUPPORT-UNRESOLVED')));
});

test('REV8 FX-008: C/6→7 transfiere hacia apoyos declarados y continúa por apoyo vertical geométrico', async () => {
  const { paths } = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const explicit = paths.gravity.paths.filter((path) => path.sourceRefs.relationId);
  assert.ok(explicit.length >= 2);
  assert.ok(explicit.every((path) => path.candidateState === 'completeCandidate'));
  for (const path of explicit) {
    const kinds = path.edgeIds.map((id) => paths.gravity.edges.find((edge) => edge.edgeId === id)?.kind);
    assert.ok(kinds.includes('declared:support'));
    assert.ok(kinds.includes('declared:loadTransfer'));
    assert.ok(kinds.includes('supportedByFoundation'));
  }
});

test('REV8 FX-008: mecanismo continuo C/6→11A usa dos carrierRegions sin structuralAssembly ni alterar geometría', async () => {
  const { sourceModel, model, geometry, paths } = await buildFx008Rev8Continuous();
  const relation = model.structuralIntent.relationIntents.find((item) => item.notes === 'Mecanismo continuo C/6→11A en banda superior.');
  assert.ok(relation);
  assert.equal(relation.carrierRegions.length, 2);
  assert.deepEqual(relation.carrierRegions.map((item) => item.ownerRef.id).sort(), [FX008_C_7_11A, FX008_FRONTON_C_6_7].sort());
  assert.ok(!Object.hasOwn(model.structuralIntent, 'structuralAssemblies'));
  assert.ok(!JSON.stringify(model.structuralIntent).includes('structuralAssembly'));
  assert.deepEqual(geometry.elements, (await import('../src/core/agnosticGeometry.js')).projectAgnosticGeometry(sourceModel).elements);
  const explicit = paths.gravity.paths.filter((path) => path.sourceRefs.relationId);
  assert.ok(explicit.length >= 2);
  assert.ok(explicit.every((path) => path.candidateState === 'completeCandidate'));
});


test('REV8: ciclo explícito por interfaz queda blockedCandidate y no recurre indefinidamente', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const face = context.model.structuralIntent.interfaceIntents.find((item) => (
    item.ownerRef.kind === 'element'
    && item.ownerRef.id === FX008_FRONTON_C_6_7
    && item.locator.kind === 'face'
    && item.locator.side === 'negativeN'
  ));
  assert.ok(face);
  const model = applyStructuralInterfaceTransaction(context.model, { relations: [{
    ports: [
      { interfaceRef: face.interfaceId, interactionRole: 'receives' },
      { interfaceRef: face.interfaceId, interactionRole: 'delivers' }
    ],
    actionFamily: 'gravity',
    structuralFunction: 'loadTransfer',
    carrierRegions: []
  }] }).model;
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);
  const proposals = generateStructuralProposals({
    geometry, structuralIntent: model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent, topology, config: {}
  });
  const paths = buildCandidateLoadPaths({
    geometry, structuralIntent: model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent, topology,
    structuralProposals: proposals, analysisContexts: [{ graph: 'lateral', direction: 'x' }], config: {}
  });
  assert.ok(paths.gravity.paths.some((path) => (
    path.candidateState === 'blockedCandidate' && path.findings.includes('SI-GRAVITY-PATH-CYCLE')
  )));
});
