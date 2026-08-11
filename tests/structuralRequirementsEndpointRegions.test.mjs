import assert from 'node:assert/strict';
import test from 'node:test';

import { integrateStructuralRequirements } from '../src/core/structuralRequirements.js';
import {
  buildFx008Rev8Short,
  FX008_SUPPORT_AT_6,
  FX008_SUPPORT_AT_7
} from './helpers/spec015dRev8.mjs';

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

async function requirementsFx008() {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  return integrateStructuralRequirements(inputFrom(context)).requirements;
}

test('BUG-015-E-010: C/7 proyecta end/highS en S=2000 y conserva 0,1 mm sólo como envolvente de localización', async () => {
  const requirements = await requirementsFx008();
  const c7 = requirements.regions.find((region) => region.ownerRef?.id === FX008_SUPPORT_AT_7);
  assert.ok(c7);
  assert.deepEqual(c7.longitudinalLocation, {
    kind: 'end',
    end: 'highS',
    anchorS: 2000,
    localizationEnvelope: [1999.9, 2000]
  });
  assert.equal(Object.hasOwn(c7, 'sRange'), false);
  assert.deepEqual(c7.zRange, [3250, 4150]);
  assert.ok(c7.topologicalBoundaries.some((item) => item.nodeType === 'wallEnd'));
});

test('BUG-015-E-010: C/6 sigue siendo rango físico de interacción de 101,1 mm', async () => {
  const requirements = await requirementsFx008();
  const c6 = requirements.regions.find((region) => region.ownerRef?.id === FX008_SUPPORT_AT_6);
  assert.ok(c6);
  assert.deepEqual(c6.longitudinalLocation, { kind: 'range', sRange: [1949.45, 2050.55] });
  assert.ok(Math.abs((c6.longitudinalLocation.sRange[1] - c6.longitudinalLocation.sRange[0]) - 101.1) <= 0.001);
});

test('BUG-015-E-011: relaciones declaradas referencian regionIds y no republican ranges ambiguos', async () => {
  const requirements = await requirementsFx008();
  const regionIds = new Set(requirements.regions.map((region) => region.regionId));
  const declared = [...requirements.supports, ...requirements.transfers].filter((item) => item.provenance === 'declaredRelation');
  assert.ok(declared.length > 0);
  for (const record of declared) {
    assert.equal(Object.hasOwn(record, 'ranges'), false);
    assert.ok(Array.isArray(record.targetRegionRefs) && record.targetRegionRefs.length > 0);
    assert.ok(record.targetRegionRefs.every((ref) => regionIds.has(ref)));
    assert.ok(Array.isArray(record.fromRefs));
    assert.ok(Array.isArray(record.toRefs));
  }
});

test('BUG-015-E-011: support candidato conserva overlap sólo como evidencia candidata, no como región declarada', async () => {
  const requirements = await requirementsFx008();
  const candidates = requirements.supports.filter((item) => item.provenance === 'candidatePath');
  assert.ok(candidates.length > 0);
  for (const record of candidates) {
    assert.equal(Object.hasOwn(record, 'ranges'), false);
    assert.deepEqual(record.targetRegionRefs, []);
    assert.equal(record.certainty, 'candidate');
    assert.equal(record.supportEvidence, 'candidateSupportEvidence');
    assert.ok(Array.isArray(record.evidence?.overlapRange));
    assert.equal(record.verificationState, 'notVerified');
  }
});

test('B3.2: todas las referencias de requisito y de soporte/transferencia permanecen resolubles', async () => {
  const requirements = await requirementsFx008();
  const regionIds = new Set(requirements.regions.map((region) => region.regionId));
  const requirementIds = new Set(requirements.requirements.map((item) => item.id));
  for (const region of requirements.regions) {
    for (const ref of region.requirementRefs) assert.ok(requirementIds.has(ref), `requirementRef no resuelto: ${ref}`);
  }
  for (const record of [...requirements.supports, ...requirements.transfers]) {
    for (const ref of record.targetRegionRefs || []) assert.ok(regionIds.has(ref), `targetRegionRef no resuelto: ${ref}`);
  }
  for (const requirement of requirements.requirements) {
    if (requirement.targetRegionRef !== null) assert.ok(regionIds.has(requirement.targetRegionRef), `targetRegionRef requisito no resuelto: ${requirement.targetRegionRef}`);
  }
});

test('B3.2: misma entrada conserva deepEqual y SHA idéntico con localización discriminada', async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const input = inputFrom(context);
  const a = integrateStructuralRequirements(input);
  const b = integrateStructuralRequirements(structuredClone(input));
  assert.deepEqual(a, b);
  assert.equal(a.requirements.canonicalSha256, b.requirements.canonicalSha256);
});
