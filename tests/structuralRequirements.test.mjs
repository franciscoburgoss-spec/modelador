import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateStructuralRequirements } from '../src/core/structuralRequirements.js';
import { buildFx008Rev8Short, FX008_FRONTON_C_6_7, FX008_ROOF_NORTH } from './helpers/spec015dRev8.mjs';

function inputFrom(context) {
  return {
    geometry: context.geometry,
    topology: context.topology,
    structuralIntent: context.model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent,
    structuralProposals: context.proposals,
    structuralProposalReviews: context.model.structuralProposalReviews,
    candidateLoadPaths: context.paths
  };
}

test('SPEC-015-E B2: completa R6–R12 sin mutar R0–R5 y mantiene notVerified', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const sourceTopology = structuredClone(context.topology);
  const result = integrateStructuralRequirements(inputFrom(context));
  assert.deepEqual(context.topology, sourceTopology);
  assert.deepEqual(result.topology.phasesExecuted, ['R0','R1','R2','R3','R4','R5','R6','R7','R8','R9','R10','R11','R12']);
  assert.deepEqual(result.topology.phasesPending, []);
  assert.equal(result.requirements.schema, 'structural-requirements-v1.0');
  assert.equal(result.requirements.verification.state, 'notVerified');
  assert.ok(result.requirements.elements.every((item) => item.verificationState === 'notVerified'));
  assert.ok(result.requirements.gravityPaths.every((item) => item.verificationState === 'notVerified'));
});

test('SPEC-015-E B2: relación local no promueve función global y B1 conserva rango físico/interacción', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const { topology, requirements } = integrateStructuralRequirements(inputFrom(context));
  const fronton = requirements.elements.find((item) => item.elementId === FX008_FRONTON_C_6_7);
  assert.ok(fronton);
  assert.deepEqual(fronton.declaredFunctions, []);
  assert.ok(fronton.declaredInteractions.length >= 3);
  const roofSupport = topology.roofSupports.find((item) => (
    item.roofGeometryId === FX008_ROOF_NORTH
    && item.interactionLocator?.sRange?.[0] === 12800
    && item.interactionLocator?.sRange?.[1] === 14500
  ));
  assert.ok(roofSupport);
  assert.deepEqual(roofSupport.physicalBoundary.physicalSRange, [12800, 23200]);
  assert.deepEqual(roofSupport.interactionLocator.sRange, [12800, 14500]);
});

test('SPEC-015-E B2: supportedByFoundation sigue siendo evidencia candidata', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const { requirements } = integrateStructuralRequirements(inputFrom(context));
  const candidates = requirements.supports.filter((item) => item.provenance === 'candidatePath');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((item) => item.certainty === 'candidate'));
  assert.ok(candidates.every((item) => item.supportEvidence === 'candidateSupportEvidence'));
  assert.ok(candidates.every((item) => item.verificationState === 'notVerified'));
});

test('SPEC-015-E B2: gap lateral produce requisito de transferencia sin convertirlo en verificación', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const { requirements } = integrateStructuralRequirements(inputFrom(context));
  assert.equal(requirements.lateralStatus, 'incompleteCandidate');
  const transfer = requirements.requirements.find((item) => item.code === 'SR-LOAD-TRANSFER-REQUIRED' && item.graph === 'lateral');
  assert.ok(transfer);
  assert.equal(transfer.verificationState, 'notVerified');
  assert.ok(Math.abs(transfer.evidence.gapMm - 571.429) <= 0.001);
});

test('SPEC-015-E B2: requirementRefs siempre resuelven requirements[]', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const { requirements } = integrateStructuralRequirements(inputFrom(context));
  const ids = new Set(requirements.requirements.map((item) => item.id));
  for (const region of requirements.regions) {
    for (const ref of region.requirementRefs) assert.ok(ids.has(ref), `requirementRef no resuelto: ${ref}`);
  }
});

test('SPEC-015-E B2: misma entrada produce deepEqual y SHA idéntico', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const input = inputFrom(context);
  const a = integrateStructuralRequirements(input);
  const b = integrateStructuralRequirements(structuredClone(input));
  assert.deepEqual(a, b);
  assert.equal(a.requirements.canonicalSha256, b.requirements.canonicalSha256);
  assert.equal(a.topology.canonicalSha256, b.topology.canonicalSha256);
});

test('SPEC-015-E B2: relación stale bloquea su ámbito y no cae a fallback geométrico', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const input = inputFrom(context);
  input.structuralIntent = structuredClone(input.structuralIntent);
  input.structuralIntent.interfaceIntents[0].hostGeometryFingerprint = '0'.repeat(64);
  const { requirements } = integrateStructuralRequirements(input);
  assert.ok(requirements.blockingDecisions.some((item) => ['SR-INTERFACE-STALE', 'SR-RELATION-STALE'].includes(item.code)));
  assert.ok(requirements.eligibility.reasonCodes.some((code) => ['SR-INTERFACE-STALE', 'SR-RELATION-STALE'].includes(code)));
});

test('SPEC-015-E B2: cero paths laterales nunca se convierte automáticamente en notApplicable', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const input = inputFrom(context);
  input.roofStructuralIntent = input.roofStructuralIntent.map((intent) => ({ ...intent, diaphragmBehavior: 'candidate' }));
  input.candidateLoadPaths = structuredClone(input.candidateLoadPaths);
  input.candidateLoadPaths.lateral = { ...input.candidateLoadPaths.lateral, nodes: [], edges: [], paths: [], findings: [] };
  const { requirements } = integrateStructuralRequirements(input);
  assert.equal(requirements.lateralStatus, 'notDeclared');
  assert.notEqual(requirements.lateralStatus, 'notApplicable');
});

test('SPEC-015-E B2: salida no se persiste silenciosamente en el modelo fuente', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const before = structuredClone(context.model);
  integrateStructuralRequirements(inputFrom(context));
  assert.deepEqual(context.model, before);
  assert.equal(Object.hasOwn(context.model, 'structuralRequirements'), false);
  assert.equal(Object.hasOwn(context.model, 'recognizedStructuralTopology'), false);
});
