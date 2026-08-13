import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONSTRUCTIVE_CONTEXT_REASON_CODES,
  CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
  ConstructiveScenarioContextError,
  buildConstructiveScopeClosure as buildConstructiveScopeClosureCore,
  evaluateConstructiveScenarioContext as evaluateConstructiveScenarioContextCore,
  evaluateConstructiveScopeEligibility as evaluateConstructiveScopeEligibilityCore,
  projectEffectiveConstructiveInput as projectEffectiveConstructiveInputCore
} from '../src/core/constructiveScenarioContext.js';
import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';
import { buildStructuralRequirementsWithReferenceResolutionContext } from '../src/core/structuralRequirements.js';
import {
  STRUCTURAL_REFERENCE_DOMAINS,
  createStructuralReferenceResolutionContext
} from '../src/core/structuralReferenceResolutionContext.js';
import { canonicalizeValue, fingerprint } from '../src/core/structuralProposalCommon.js';
import { buildFx008Rev8Short } from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER_REQUIREMENT = 'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';
const LATERAL_RESISTANCE_REQUIREMENT = 'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';
const LATERAL_REGION = 'sr-region:sha256:60290050fa3ffe641a1ce4e716b6114ac9b28284240537dc0e360ee0eab85e3e';
const MISSING_REGION = `sr-region:sha256:${'d'.repeat(64)}`;
const LATERAL_ROOF = 1785158713616;
const GLOBAL_BLOCKER_ROOFS = [1785161146258, 1785161198226, 1785161662029, 1785161396221, 1785161271814];
const SHA_A = 'a'.repeat(64);
const MISSING_REQUIREMENT = `sr-requirement:sha256:${'c'.repeat(64)}`;
const COMPONENT_TRANSFER = 'abstract-load-transfer-response';
const TRANSITIVE_REQUIREMENT = `sr-requirement:sha256:${'1'.repeat(64)}`;
const TRANSITIVE_REGION = `sr-region:sha256:${'2'.repeat(64)}`;
const TRANSITIVE_ROOF = 9000000000001;
const ALLOWLIST_PATH = `path:sha256:${'8'.repeat(64)}`;
const ALLOWLIST_PATH_ALTERNATE = `path:sha256:${'9'.repeat(64)}`;
const ALLOWLIST_SUPPORT = `sr-support:sha256:${'a'.repeat(64)}`;
const ALLOWLIST_TRANSFER = `sr-transfer:sha256:${'b'.repeat(64)}`;
const ALLOWLIST_RELATION = `rel:sha256:${'c'.repeat(64)}`;
const ALLOWLIST_INTERFACE = `iface:sha256:${'d'.repeat(64)}`;
const ALLOWLIST_ROOF = 9000000000002;
const EXACT_PATH_P1 = `path:sha256:${'e'.repeat(64)}`;
const EXACT_PATH_P2 = `path:sha256:${'f'.repeat(64)}`;
const EXACT_EDGE_E1 = `edge:sha256:${'1'.repeat(64)}`;
const EXACT_EDGE_E2 = `edge:sha256:${'2'.repeat(64)}`;
const CANDIDATE_NODE_N1 = `node:sha256:${'1'.repeat(64)}`;
const CANDIDATE_NODE_N2 = `node:sha256:${'2'.repeat(64)}`;
const CANDIDATE_NODE_N3 = `node:sha256:${'3'.repeat(64)}`;
const CANDIDATE_NODE_N4 = `node:sha256:${'4'.repeat(64)}`;
const FX008_LATERAL_EDGE = 'edge:sha256:93dd4a82f9104b75ef61b16068efe77fb15fe347230c7a255f9ac9300de11dac';
const FX008_LATERAL_PATH = 'path:sha256:6baec8998b1c6f1a80cae66e5394f827526bc33038da3a969508a15c99f5563f';

let fx;

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

test.before(async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const companion = buildStructuralRequirementsWithReferenceResolutionContext(inputFrom(context));
  fx = {
    context,
    requirements: companion.structuralRequirements,
    referenceResolutionContext: companion.referenceResolutionContext
  };
});

function typed(domain, value) {
  return { domain, value };
}

function syntheticContextPayload(requirements) {
  const targets = [];
  const referenceBindings = [];
  const provenanceRelations = [];
  const paths = [...requirements.gravityPaths, ...requirements.lateralPaths];
  const pathValues = new Set(paths.map((item) => item.pathId));
  const relations = new Set(requirements.regions.flatMap((region) => (
    (region.declaredInteractions || []).map((item) => item.relationId).filter(Boolean)
  )));
  const interfaces = new Set(requirements.regions.flatMap((region) => (
    (region.declaredInteractions || []).map((item) => item.interfaceId).filter(Boolean)
  )));
  const addTarget = (ref) => targets.push({ ...ref, origin: { producerType: 'testFixture' } });
  const addBinding = ({ entityType, entityId, field, legacyValue, to, fromDomain, identity = {}, provenance = [] }) => {
    addTarget(to);
    referenceBindings.push({
      occurrenceId: `test:${entityType}:${String(entityId)}:${field}:${to.domain}:${String(to.value)}`,
      origin: {
        entityType,
        entityId,
        field,
        occurrenceKey: `${to.domain}|${typeof to.value}:${String(to.value)}`,
        ...identity
      },
      from: typed(fromDomain, entityId),
      legacyValue,
      to,
      provenance
    });
  };
  for (const path of paths) addTarget(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, path.pathId));
  for (const relationId of relations) addTarget(typed(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relationId));
  for (const interfaceId of interfaces) addTarget(typed(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, interfaceId));
  for (const requirement of requirements.requirements) {
    for (const value of requirement.sourceRefs || []) {
      const to = pathValues.has(value)
        ? typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, value)
        : relations.has(value)
          ? typed(STRUCTURAL_REFERENCE_DOMAINS.RELATION, value)
          : interfaces.has(value)
            ? typed(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, value)
            : typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, value);
      addBinding({
        entityType: 'requirement', entityId: requirement.id, field: 'sourceRefs',
        legacyValue: value, to, fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT
      });
    }
  }
  for (const region of requirements.regions) {
    for (const interaction of region.declaredInteractions || []) {
      for (const value of interaction.sourceRefs || []) {
        const to = value === interaction.relationId
          ? typed(STRUCTURAL_REFERENCE_DOMAINS.RELATION, value)
          : typed(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, value);
        addBinding({
          entityType: 'declaredInteraction', entityId: region.regionId, field: 'sourceRefs',
          legacyValue: value, to, fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REGION,
          identity: { relationId: interaction.relationId, interfaceId: interaction.interfaceId }
        });
      }
    }
  }
  for (const [entityType, entities, fromDomain] of [
    ['support', requirements.supports, STRUCTURAL_REFERENCE_DOMAINS.SUPPORT],
    ['transfer', requirements.transfers, STRUCTURAL_REFERENCE_DOMAINS.TRANSFER]
  ]) {
    for (const entity of entities) {
      for (const field of ['sourceRefs', 'fromRefs', 'toRefs']) {
        for (const value of entity[field] || []) {
          let to;
          if (field !== 'sourceRefs') {
            to = typed(
              entity.provenance === 'declaredRelation'
                ? STRUCTURAL_REFERENCE_DOMAINS.INTERFACE
                : STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE,
              value
            );
          } else if (entity.provenance === 'declaredRelation') {
            to = typed(relations.has(value)
              ? STRUCTURAL_REFERENCE_DOMAINS.RELATION
              : STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, value);
          } else {
            to = typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, value);
          }
          addBinding({
            entityType, entityId: entity.id, field, legacyValue: value, to, fromDomain,
            provenance: [{ kind: entity.provenance === 'declaredRelation'
              ? 'declaredRelationEndpoint'
              : 'candidatePathEndpoint' }]
          });
        }
      }
    }
  }
  return { targets, referenceBindings, provenanceRelations };
}

function referenceContextFor(requirements, payload = null) {
  const fxPayload = fx && requirements.requirements.some((item) => item.id === LOAD_TRANSFER_REQUIREMENT)
    ? {
        targets: fx.referenceResolutionContext.targets,
        referenceBindings: fx.referenceResolutionContext.referenceBindings,
        provenanceRelations: fx.referenceResolutionContext.provenanceRelations
      }
    : null;
  return createStructuralReferenceResolutionContext(
    requirements,
    payload ?? fxPayload ?? syntheticContextPayload(requirements)
  );
}

function buildConstructiveScopeClosure(requirements, ids, context = referenceContextFor(requirements)) {
  return buildConstructiveScopeClosureCore(requirements, ids, context);
}

function evaluateConstructiveScopeEligibility(requirements, scope, context = referenceContextFor(requirements)) {
  return evaluateConstructiveScopeEligibilityCore(requirements, scope, context);
}

function evaluateConstructiveScenarioContext(value) {
  return evaluateConstructiveScenarioContextCore({
    ...value,
    referenceResolutionContext: value.referenceResolutionContext
      ?? referenceContextFor(value.structuralRequirements)
  });
}

function projectEffectiveConstructiveInput(value) {
  return projectEffectiveConstructiveInputCore({
    ...value,
    referenceResolutionContext: value.referenceResolutionContext
      ?? referenceContextFor(value.structuralRequirements)
  });
}

function scopeRequirements(ids = [LOAD_TRANSFER_REQUIREMENT, LATERAL_RESISTANCE_REQUIREMENT]) {
  return { mode: 'requirements', requirementIds: ids };
}

function libraryContext(componentTypeIds = [COMPONENT_TRANSFER, 'abstract-lateral-response']) {
  return {
    schema: CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
    libraryId: 'neutral-contract-library',
    libraryVersion: '1.0.0',
    sha256: SHA_A,
    componentTypes: componentTypeIds.map((componentTypeId) => ({ componentTypeId, upstreamSecret: true }))
  };
}

function scenario(scope = scopeRequirements(), assignments = []) {
  let root = createConstructiveScenario(createEmptyConstructiveSolutions(), {
    metadata: { name: 'B2 contextual', description: '' },
    adapterRef: { adapterId: 'future-adapter', adapterVersion: '1.0.0' },
    libraryRef: { libraryId: 'neutral-contract-library', libraryVersion: '1.0.0', sha256: SHA_A },
    configuration: { schema: 'b2-test-configuration-v1.0' },
    scope
  }).constructiveSolutions;
  for (const assignment of assignments) {
    root = createConstructiveAssignment(root, 'scenario:000001', assignment).constructiveSolutions;
  }
  return root.scenarios[0];
}

function assignment({
  requirementRef = LOAD_TRANSFER_REQUIREMENT,
  targetRef = { kind: 'requirement', ref: requirementRef },
  componentTypeId = COMPONENT_TRANSFER
} = {}) {
  return {
    requirementRef,
    targetRef,
    choiceRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      componentTypeId
    },
    parameters: {}
  };
}

function args(overrides = {}) {
  const value = {
    scenario: scenario(),
    structuralRequirements: fx.requirements,
    referenceResolutionContext: fx.referenceResolutionContext,
    geometry: fx.context.geometry,
    libraryContext: libraryContext(),
    ...overrides
  };
  if (overrides.structuralRequirements && !overrides.referenceResolutionContext) {
    value.referenceResolutionContext = referenceContextFor(overrides.structuralRequirements);
  }
  return value;
}

function globallyEligible(requirements = fx.requirements) {
  const copy = structuredClone(requirements);
  copy.blockingDecisions = [];
  copy.eligibility = { eligibleForConstructiveSolutions: true, reasonCodes: [] };
  return copy;
}

function transitiveRequirements({ chainLength = 2, blockerRoof = TRANSITIVE_ROOF } = {}) {
  const pathId = `path:sha256:${'3'.repeat(64)}`;
  const supportAId = `sr-support:sha256:${'4'.repeat(64)}`;
  const transferBId = `sr-transfer:sha256:${'5'.repeat(64)}`;
  const supportCId = `sr-support:sha256:${'6'.repeat(64)}`;
  const regionB = `sr-region:sha256:${'b'.repeat(64)}`;
  const regionC = `sr-region:sha256:${'c'.repeat(64)}`;
  const regionD = `sr-region:sha256:${'d'.repeat(64)}`;
  return {
    schema: 'structural-requirements-v1.0',
    requirements: [{
      id: TRANSITIVE_REQUIREMENT,
      code: 'SR-TRANSITIVE-TEST',
      kind: 'loadTransferRequired',
      graph: 'lateral',
      targetRegionRef: TRANSITIVE_REGION,
      sourceRefs: [],
      verificationState: 'notVerified'
    }],
    regions: [
      {
        regionId: TRANSITIVE_REGION,
        ownerRef: { kind: 'element', id: 7001 },
        requirementRefs: [TRANSITIVE_REQUIREMENT],
        declaredInteractions: [],
        verificationState: 'notVerified'
      },
      {
        regionId: regionB,
        ownerRef: { kind: 'element', id: chainLength > 2 ? 7002 : 7999 },
        requirementRefs: [],
        declaredInteractions: [],
        verificationState: 'notVerified'
      },
      ...(chainLength > 2 ? [
        {
          regionId: regionC,
          ownerRef: { kind: 'element', id: 7003 },
          requirementRefs: [],
          declaredInteractions: [],
          verificationState: 'notVerified'
        },
        {
          regionId: regionD,
          ownerRef: { kind: 'element', id: 7999 },
          requirementRefs: [],
          declaredInteractions: [],
          verificationState: 'notVerified'
        }
      ] : [])
    ],
    supports: [
      {
        id: supportAId,
        graph: 'lateral',
        targetRegionRefs: [TRANSITIVE_REGION, regionB],
        sourceRefs: [],
        fromRefs: [],
        toRefs: [],
        verificationState: 'notVerified'
      },
      ...(chainLength > 2 ? [{
        id: supportCId,
        graph: 'lateral',
        targetRegionRefs: [regionC, regionD],
        sourceRefs: [],
        fromRefs: [],
        toRefs: [],
        verificationState: 'notVerified'
      }] : [])
    ],
    transfers: chainLength > 2 ? [{
      id: transferBId,
      graph: 'lateral',
      targetRegionRefs: [regionB, regionC],
      sourceRefs: [],
      fromRefs: [],
      toRefs: [],
      verificationState: 'notVerified'
    }] : [],
    gravityPaths: [],
    lateralPaths: [{
      pathId,
      graph: 'lateral',
      sourceRefs: { roofGeometryId: TRANSITIVE_ROOF, targetElementId: 7999 },
      verificationState: 'notVerified'
    }],
    blockingDecisions: blockerRoof === null ? [] : [{
      decisionId: `sr-decision:sha256:${'7'.repeat(64)}`,
      code: 'SR-TRANSITIVE-BLOCKER',
      scope: { roofGeometryId: blockerRoof },
      sourceRefs: [`roof:${blockerRoof}`]
    }],
    eligibility: { eligibleForConstructiveSolutions: blockerRoof === null, reasonCodes: [] },
    verification: { state: 'notVerified' }
  };
}

function allowlistRequirements({ referenceBearing = false, pathRef = ALLOWLIST_PATH } = {}) {
  const requirements = transitiveRequirements({ chainLength: 2, blockerRoof: null });
  const seedSupport = requirements.supports[0];
  seedSupport.sourceRefs = referenceBearing
    ? [pathRef, ALLOWLIST_SUPPORT, ALLOWLIST_TRANSFER]
    : [];
  seedSupport.evidence = {
    note: pathRef,
    supportNote: ALLOWLIST_SUPPORT,
    transferNote: ALLOWLIST_TRANSFER,
    relationNote: ALLOWLIST_RELATION,
    interfaceNote: ALLOWLIST_INTERFACE
  };
  requirements.regions[0].declaredInteractions = referenceBearing ? [{
    relationId: ALLOWLIST_RELATION,
    interfaceId: ALLOWLIST_INTERFACE,
    interactionRole: 'carrier',
    actionFamily: 'lateral',
    structuralFunction: 'loadTransfer',
    sourceRefs: [ALLOWLIST_RELATION, ALLOWLIST_INTERFACE]
  }] : [];
  requirements.lateralPaths = [
    {
      pathId: pathRef,
      graph: 'lateral',
      sourceRefs: {
        roofGeometryId: ALLOWLIST_ROOF,
        targetElementId: referenceBearing ? 7001 : 8002,
        direction: 'x'
      },
      evidence: { note: TRANSITIVE_REQUIREMENT },
      verificationState: 'notVerified'
    },
    {
      pathId: pathRef === ALLOWLIST_PATH ? ALLOWLIST_PATH_ALTERNATE : ALLOWLIST_PATH,
      graph: 'lateral',
      sourceRefs: { roofGeometryId: ALLOWLIST_ROOF + 1, targetElementId: 8003, direction: 'y' },
      verificationState: 'notVerified'
    }
  ];
  requirements.supports.push({
    id: ALLOWLIST_SUPPORT,
    graph: 'lateral',
    targetRegionRefs: referenceBearing ? [TRANSITIVE_REGION] : [],
    sourceRefs: [],
    fromRefs: [],
    toRefs: [],
    evidence: { note: TRANSITIVE_REQUIREMENT },
    provenance: 'candidatePath',
    supportEvidence: 'candidateSupportEvidence',
    verificationState: 'notVerified'
  });
  requirements.transfers.push({
    id: ALLOWLIST_TRANSFER,
    graph: 'lateral',
    targetRegionRefs: [],
    sourceRefs: [],
    fromRefs: referenceBearing ? [ALLOWLIST_INTERFACE] : [],
    toRefs: [],
    evidence: { note: TRANSITIVE_REQUIREMENT },
    provenance: 'declaredRelation',
    verificationState: 'notVerified'
  });
  return requirements;
}

function crossDomainRequirements({
  ownerRef = { kind: 'element', id: 7001 },
  topologicalBoundaries = [],
  pathSourceRefs = { roofGeometryId: 7001, targetElementId: 9999 },
  extraPaths = [],
  blockingDecisions = []
} = {}) {
  return {
    schema: 'structural-requirements-v1.0',
    requirements: [{
      id: TRANSITIVE_REQUIREMENT,
      code: 'SR-CROSS-DOMAIN-TEST',
      kind: 'loadTransferRequired',
      graph: 'lateral',
      targetRegionRef: TRANSITIVE_REGION,
      sourceRefs: [],
      verificationState: 'notVerified'
    }],
    regions: [{
      regionId: TRANSITIVE_REGION,
      ownerRef,
      topologicalBoundaries,
      activeOpenings: [],
      candidateEvidenceRefs: [],
      requirementRefs: [TRANSITIVE_REQUIREMENT],
      declaredInteractions: [],
      verificationState: 'notVerified'
    }],
    supports: [],
    transfers: [],
    gravityPaths: [],
    lateralPaths: [{
      pathId: ALLOWLIST_PATH,
      graph: 'lateral',
      sourceRefs: pathSourceRefs,
      verificationState: 'notVerified'
    }, ...extraPaths],
    blockingDecisions,
    eligibility: {
      eligibleForConstructiveSolutions: blockingDecisions.length === 0,
      reasonCodes: blockingDecisions.map((item) => item.code)
    },
    verification: { state: 'notVerified' }
  };
}

function exactPathRegressionRequirements() {
  const requirements = crossDomainRequirements({
    pathSourceRefs: { roofGeometryId: 8101, targetElementId: 7001 },
    extraPaths: [{
      pathId: EXACT_PATH_P2,
      graph: 'lateral',
      sourceRefs: { roofGeometryId: 8102, targetElementId: 7001 },
      verificationState: 'notVerified'
    }]
  });
  requirements.requirements[0].sourceRefs = [EXACT_PATH_P1];
  requirements.lateralPaths[0].pathId = EXACT_PATH_P1;
  return requirements;
}

function referenceBinding({
  occurrenceKey,
  entityType,
  entityId,
  field,
  fromDomain,
  legacyValue,
  to,
  identity = {}
}) {
  return {
    occurrenceId: `test:${entityType}:${String(entityId)}:${field}:${occurrenceKey}`,
    origin: { entityType, entityId, field, occurrenceKey, ...identity },
    from: typed(fromDomain, entityId),
    legacyValue,
    to,
    provenance: [{ kind: 'testProducerTypedReference' }]
  };
}

function memberOfPath(edgeId, pathId) {
  return {
    relationId: `test:member:${edgeId}:${pathId}`,
    kind: 'candidateEdgeMemberOfPath',
    from: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, edgeId),
    to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, pathId),
    origin: { producerType: 'candidateLoadPath', graph: 'lateral', pathId }
  };
}

function target(ref) {
  return { ...ref, origin: { producerType: 'testFixture' } };
}

function legacyTypedTargetContradiction() {
  const requirements = {
    schema: 'structural-requirements-v1.0',
    requirements: [{
      id: 'R',
      code: 'SR-LEGACY-TYPED-TARGET-CONTRADICTION',
      kind: 'loadTransferRequired',
      graph: 'lateral',
      targetRegionRef: 'Region A',
      sourceRefs: ['P1'],
      verificationState: 'notVerified'
    }],
    regions: [{
      regionId: 'Region A',
      ownerRef: { kind: 'element', id: 'E0' },
      topologicalBoundaries: [],
      activeOpenings: [],
      candidateEvidenceRefs: [],
      requirementRefs: ['R'],
      declaredInteractions: [],
      verificationState: 'notVerified'
    }],
    supports: [],
    transfers: [],
    gravityPaths: [],
    lateralPaths: [
      {
        pathId: 'P1',
        graph: 'lateral',
        sourceRefs: { targetElementId: 'E1' },
        verificationState: 'notVerified'
      },
      {
        pathId: 'P2',
        graph: 'lateral',
        sourceRefs: { targetElementId: 'E2' },
        verificationState: 'notVerified'
      }
    ],
    blockingDecisions: [],
    eligibility: { eligibleForConstructiveSolutions: true, reasonCodes: [] },
    verification: { state: 'notVerified' }
  };
  const payload = {
    referenceBindings: [referenceBinding({
      occurrenceKey: 'requirement-path-p1',
      entityType: 'requirement',
      entityId: 'R',
      field: 'sourceRefs',
      fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'P1',
      to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P2')
    })],
    targets: [target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P2'))],
    provenanceRelations: []
  };
  return {
    requirements,
    context: createStructuralReferenceResolutionContext(requirements, payload)
  };
}

function multiRequirementSelectorCoexistence() {
  const requirements = {
    schema: 'structural-requirements-v1.0',
    requirements: [
      {
        id: 'R1',
        code: 'SR-MULTI-REQUIREMENT-R1',
        kind: 'loadTransferRequired',
        graph: 'lateral',
        targetRegionRef: 'Region A',
        sourceRefs: ['P1'],
        verificationState: 'notVerified'
      },
      {
        id: 'R2',
        code: 'SR-MULTI-REQUIREMENT-R2',
        kind: 'loadTransferRequired',
        graph: 'lateral',
        targetRegionRef: 'Region B',
        sourceRefs: [],
        verificationState: 'notVerified'
      }
    ],
    regions: [
      {
        regionId: 'Region A',
        ownerRef: { kind: 'element', id: 'E1' },
        topologicalBoundaries: [],
        activeOpenings: [],
        candidateEvidenceRefs: [],
        requirementRefs: ['R1'],
        declaredInteractions: [],
        verificationState: 'notVerified'
      },
      {
        regionId: 'Region B',
        ownerRef: { kind: 'element', id: 'E2' },
        topologicalBoundaries: [],
        activeOpenings: [],
        candidateEvidenceRefs: [],
        requirementRefs: ['R2'],
        declaredInteractions: [],
        verificationState: 'notVerified'
      }
    ],
    supports: [],
    transfers: [],
    gravityPaths: [],
    lateralPaths: [
      {
        pathId: 'P1',
        graph: 'lateral',
        sourceRefs: { targetElementId: 'E1' },
        verificationState: 'notVerified'
      },
      {
        pathId: 'P2',
        graph: 'lateral',
        sourceRefs: { targetElementId: 'E2' },
        verificationState: 'notVerified'
      }
    ],
    blockingDecisions: [],
    eligibility: { eligibleForConstructiveSolutions: true, reasonCodes: [] },
    verification: { state: 'notVerified' }
  };
  const payload = {
    referenceBindings: [referenceBinding({
      occurrenceKey: 'requirement-r1-path-p1',
      entityType: 'requirement',
      entityId: 'R1',
      field: 'sourceRefs',
      fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'P1',
      to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P1')
    })],
    targets: [target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P1'))],
    provenanceRelations: []
  };
  return {
    requirements,
    context: createStructuralReferenceResolutionContext(requirements, payload)
  };
}

function typedRefIdentity(ref) {
  return JSON.stringify([ref.domain, typeof ref.value, ref.value]);
}

function recanonicalizeReferenceContext(context) {
  const payload = structuredClone(context);
  delete payload.canonicalSha256;
  const canonical = canonicalizeValue(payload);
  return { ...canonical, canonicalSha256: fingerprint(canonical) };
}

function protectedTransitiveGraph({ cycle = false } = {}) {
  const supportAId = `sr-support:sha256:${'4'.repeat(64)}`;
  const transferBId = `sr-transfer:sha256:${'5'.repeat(64)}`;
  const supportCId = `sr-support:sha256:${'6'.repeat(64)}`;
  const requirements = {
    schema: 'structural-requirements-v1.0',
    requirements: [{
      id: TRANSITIVE_REQUIREMENT,
      code: 'SR-PROTECTED-TRANSITIVE',
      kind: 'loadTransferRequired',
      graph: 'lateral',
      targetRegionRef: TRANSITIVE_REGION,
      sourceRefs: [EXACT_EDGE_E1],
      verificationState: 'notVerified'
    }],
    regions: [{
      regionId: TRANSITIVE_REGION,
      ownerRef: { kind: 'element', id: 7001 },
      topologicalBoundaries: [],
      activeOpenings: [],
      candidateEvidenceRefs: [],
      requirementRefs: [TRANSITIVE_REQUIREMENT],
      declaredInteractions: [],
      verificationState: 'notVerified'
    }],
    supports: [
      {
        id: supportAId,
        graph: 'lateral',
        targetRegionRefs: [],
        sourceRefs: [EXACT_EDGE_E1],
        fromRefs: [CANDIDATE_NODE_N1],
        toRefs: [CANDIDATE_NODE_N2],
        provenance: 'candidatePath',
        verificationState: 'notVerified'
      },
      {
        id: supportCId,
        graph: 'lateral',
        targetRegionRefs: [],
        sourceRefs: [EXACT_EDGE_E2],
        fromRefs: [CANDIDATE_NODE_N3],
        toRefs: cycle ? [CANDIDATE_NODE_N4, CANDIDATE_NODE_N1] : [CANDIDATE_NODE_N4],
        provenance: 'candidatePath',
        verificationState: 'notVerified'
      }
    ],
    transfers: [{
      id: transferBId,
      graph: 'lateral',
      targetRegionRefs: [],
      sourceRefs: [EXACT_EDGE_E2],
      fromRefs: [CANDIDATE_NODE_N2],
      toRefs: [CANDIDATE_NODE_N3],
      provenance: 'candidatePath',
      verificationState: 'notVerified'
    }],
    gravityPaths: [],
    lateralPaths: [
      {
        pathId: EXACT_PATH_P1,
        graph: 'lateral',
        sourceRefs: { roofGeometryId: 9101, targetElementId: 7001 },
        verificationState: 'notVerified'
      },
      {
        pathId: EXACT_PATH_P2,
        graph: 'lateral',
        sourceRefs: { roofGeometryId: 9102, targetElementId: 7999 },
        verificationState: 'notVerified'
      }
    ],
    blockingDecisions: [],
    eligibility: { eligibleForConstructiveSolutions: true, reasonCodes: [] },
    verification: { state: 'notVerified' }
  };
  const bindings = [referenceBinding({
    occurrenceKey: 'requirement-edge-e1',
    entityType: 'requirement',
    entityId: TRANSITIVE_REQUIREMENT,
    field: 'sourceRefs',
    fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
    legacyValue: EXACT_EDGE_E1,
    to: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, EXACT_EDGE_E1)
  })];
  for (const [entityType, entity, fromDomain] of [
    ['support', requirements.supports[0], STRUCTURAL_REFERENCE_DOMAINS.SUPPORT],
    ['support', requirements.supports[1], STRUCTURAL_REFERENCE_DOMAINS.SUPPORT],
    ['transfer', requirements.transfers[0], STRUCTURAL_REFERENCE_DOMAINS.TRANSFER]
  ]) {
    for (const value of entity.sourceRefs) {
      bindings.push(referenceBinding({
        occurrenceKey: `edge:${value}`,
        entityType,
        entityId: entity.id,
        field: 'sourceRefs',
        fromDomain,
        legacyValue: value,
        to: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, value)
      }));
    }
    for (const field of ['fromRefs', 'toRefs']) {
      for (const value of entity[field]) {
        bindings.push(referenceBinding({
          occurrenceKey: `node:${value}`,
          entityType,
          entityId: entity.id,
          field,
          fromDomain,
          legacyValue: value,
          to: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, value)
        }));
      }
    }
  }
  const payload = {
    referenceBindings: bindings,
    targets: [
      EXACT_EDGE_E1, EXACT_EDGE_E2
    ].map((value) => target(typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, value))).concat(
      [EXACT_PATH_P1, EXACT_PATH_P2]
        .map((value) => target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, value))),
      [CANDIDATE_NODE_N1, CANDIDATE_NODE_N2, CANDIDATE_NODE_N3, CANDIDATE_NODE_N4]
        .map((value) => target(typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, value)))
    ),
    provenanceRelations: [
      memberOfPath(EXACT_EDGE_E1, EXACT_PATH_P1),
      memberOfPath(EXACT_EDGE_E2, EXACT_PATH_P2)
    ]
  };
  return {
    requirements,
    context: createStructuralReferenceResolutionContext(requirements, payload),
    payload
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function allObjectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    for (const item of value) allObjectKeys(item, keys);
    return keys;
  }
  for (const [key, item] of Object.entries(value)) {
    keys.add(key);
    allObjectKeys(item, keys);
  }
  return keys;
}

test('SPEC-016-A B2: requirement y scope requirements reales resuelven un conjunto efectivo no vacío', () => {
  const result = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.effectiveRequirementIds, [LOAD_TRANSFER_REQUIREMENT, LATERAL_RESISTANCE_REQUIREMENT].sort());
  assert.deepEqual(result.reasonCodes, []);
});

test('BUG-016-A-005 reversión P1/T1: mismo target, requirement alcanza sólo el path exacto de sourceRefs', () => {
  const closure = buildConstructiveScopeClosure(exactPathRegressionRequirements(), [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, [EXACT_PATH_P1]);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [8101]);
});

test('BUG-016-A-008 reversión H2: legacy P1 no puede redirigirse al target tipado P2', () => {
  const fixture = legacyTypedTargetContradiction();
  const result = evaluateConstructiveScopeEligibilityCore(
    fixture.requirements,
    { mode: 'requirements', requirementIds: ['R'] },
    fixture.context
  );
  const evidence = JSON.stringify({
    pathRefs: result.scopeClosure.pathRefs,
    scopeDeterminate: result.scopeClosure.scopeDeterminate,
    resolutionDiagnostics: result.scopeClosure.resolutionDiagnostics,
    eligible: result.eligible,
    reasonCodes: result.reasonCodes
  });
  assert.equal(result.scopeClosure.scopeDeterminate, false, evidence);
  assert.ok(
    result.scopeClosure.resolutionDiagnostics.some((item) => (
      item.code === CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH
    )),
    evidence
  );
  assert.equal(result.eligible, false, evidence);
  assert.ok(
    result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH),
    evidence
  );
});

test('BUG-016-A-009 reversión H3: clausura múltiple une closures individuales sin perder fallback tipado', () => {
  const fixture = multiRequirementSelectorCoexistence();
  const closureR1 = buildConstructiveScopeClosureCore(
    fixture.requirements,
    ['R1'],
    fixture.context
  );
  const closureR2 = buildConstructiveScopeClosureCore(
    fixture.requirements,
    ['R2'],
    fixture.context
  );
  const aggregate = buildConstructiveScopeClosureCore(
    fixture.requirements,
    ['R1', 'R2'],
    fixture.context
  );
  const evidence = JSON.stringify({
    expected: ['P1', 'P2'],
    actual: aggregate.pathRefs,
    scopeDeterminate: aggregate.scopeDeterminate,
    resolutionDiagnostics: aggregate.resolutionDiagnostics
  });
  assert.deepEqual(closureR1.pathRefs, ['P1']);
  assert.deepEqual(closureR2.pathRefs, ['P2']);
  assert.deepEqual(aggregate.pathRefs, ['P1', 'P2'], evidence);
  const tracePathRefs = [...new Set(aggregate.traces.flatMap((trace) => trace.pathRefs))].sort();
  assert.deepEqual(aggregate.pathRefs, tracePathRefs);
  const aggregateSourceRefs = aggregate.sourceRefs.map(typedRefIdentity).sort();
  const traceSourceRefs = [...new Set(
    aggregate.traces.flatMap((trace) => trace.sourceRefs.map(typedRefIdentity))
  )].sort();
  assert.deepEqual(aggregateSourceRefs, traceSourceRefs);
  const permuted = buildConstructiveScopeClosureCore(
    fixture.requirements,
    ['R2', 'R1'],
    fixture.context
  );
  assert.deepEqual(permuted, aggregate);
});

test('BUG-016-A-007 H1: sourceSchema ausente o incorrecto falla cerrado como context mismatch', () => {
  const graph = protectedTransitiveGraph();
  const missing = structuredClone(graph.context);
  delete missing.sourceSchema;
  const incorrect = structuredClone(graph.context);
  incorrect.sourceSchema = 'structural-requirements-v0.9';
  for (const context of [
    recanonicalizeReferenceContext(missing),
    recanonicalizeReferenceContext(incorrect)
  ]) {
    const result = evaluateConstructiveScopeEligibilityCore(
      graph.requirements,
      { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
      context
    );
    assert.equal(result.eligible, false);
    assert.equal(result.scopeClosure.scopeDeterminate, false);
    assert.deepEqual(result.scopeClosure.pathRefs, []);
    assert.ok(result.reasonCodes.includes(
      CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_CONTEXT_MISMATCH
    ));
  }
});

test('BUG-016-A-008 H2: identidad legacy numérica equivalente no produce provenance mismatch', () => {
  const fixture = legacyTypedTargetContradiction();
  fixture.requirements.requirements[0].sourceRefs = ['1784606313849'];
  const payload = {
    referenceBindings: [referenceBinding({
      occurrenceKey: 'numeric-element-intent',
      entityType: 'requirement',
      entityId: 'R',
      field: 'sourceRefs',
      fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: '1784606313849',
      to: typed(STRUCTURAL_REFERENCE_DOMAINS.ELEMENT_INTENT, 1784606313849)
    })],
    targets: [target(typed(STRUCTURAL_REFERENCE_DOMAINS.ELEMENT_INTENT, 1784606313849))],
    provenanceRelations: []
  };
  const context = createStructuralReferenceResolutionContext(fixture.requirements, payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    fixture.requirements,
    { mode: 'requirements', requirementIds: ['R'] },
    context
  );
  assert.equal(result.scopeClosure.scopeDeterminate, true);
  assert.equal(result.eligible, true);
  assert.equal(result.reasonCodes.includes(
    CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH
  ), false);
  assert.ok(result.scopeClosure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.ELEMENT_INTENT
      && ref.value === 1784606313849
  )));
});

test('BUG-016-A-008 H2: SAME en ocurrencias path/edge distintas conserva ambos sin mismatch', () => {
  const requirements = exactPathRegressionRequirements();
  requirements.requirements[0].sourceRefs = ['SAME', 'SAME'];
  const payload = syntheticContextPayload(requirements);
  payload.referenceBindings = [
    referenceBinding({
      occurrenceKey: 'same-path', entityType: 'requirement', entityId: TRANSITIVE_REQUIREMENT,
      field: 'sourceRefs', fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'SAME', to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'SAME')
    }),
    referenceBinding({
      occurrenceKey: 'same-edge', entityType: 'requirement', entityId: TRANSITIVE_REQUIREMENT,
      field: 'sourceRefs', fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'SAME', to: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, 'SAME')
    })
  ];
  requirements.lateralPaths[0].pathId = 'SAME';
  payload.targets.push(target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'SAME')));
  payload.targets.push(target(typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, 'SAME')));
  payload.provenanceRelations.push(memberOfPath('SAME', 'SAME'));
  const context = createStructuralReferenceResolutionContext(requirements, payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    context
  );
  assert.equal(result.reasonCodes.includes(
    CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_AMBIGUOUS
  ), false);
  assert.equal(result.reasonCodes.includes(
    CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH
  ), false);
  assert.ok(result.scopeClosure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.PATH && ref.value === 'SAME'
  )));
  assert.ok(result.scopeClosure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE && ref.value === 'SAME'
  )));
});

test('BUG-016-A-009 H3: fail-closed individual determina false y conserva diagnostics agregados', () => {
  const fixture = multiRequirementSelectorCoexistence();
  const contradictory = structuredClone(fixture.context);
  contradictory.referenceBindings[0].to = typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P2');
  contradictory.targets.push(target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'P2')));
  const context = recanonicalizeReferenceContext(contradictory);
  const closureR1 = buildConstructiveScopeClosureCore(fixture.requirements, ['R1'], context);
  const closureR2 = buildConstructiveScopeClosureCore(fixture.requirements, ['R2'], context);
  const aggregate = buildConstructiveScopeClosureCore(
    fixture.requirements,
    ['R1', 'R2'],
    context
  );
  assert.equal(closureR1.scopeDeterminate, false);
  assert.equal(closureR2.scopeDeterminate, true);
  assert.equal(aggregate.scopeDeterminate, false);
  assert.ok(aggregate.resolutionDiagnostics.some((item) => (
    item.code === CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH
  )));
});

test('BUG-016-A-005 P2/P3: cadena real por refs supera tres saltos y blocker indirecto usa path exacto', () => {
  const graph = protectedTransitiveGraph();
  graph.requirements.blockingDecisions = [{
    decisionId: `sr-decision:sha256:${'7'.repeat(64)}`,
    code: 'SR-PROTECTED-BLOCKER',
    scope: { roofGeometryId: 9102 },
    sourceRefs: ['diagnostic-only']
  }];
  graph.requirements.eligibility = {
    eligibleForConstructiveSolutions: false,
    reasonCodes: ['SR-PROTECTED-BLOCKER']
  };
  graph.context = createStructuralReferenceResolutionContext(graph.requirements, graph.payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    graph.requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.deepEqual(result.scopeClosure.supportRefs, [
    `sr-support:sha256:${'4'.repeat(64)}`,
    `sr-support:sha256:${'6'.repeat(64)}`
  ]);
  assert.deepEqual(result.scopeClosure.transferRefs, [`sr-transfer:sha256:${'5'.repeat(64)}`]);
  assert.deepEqual(result.scopeClosure.pathRefs, [EXACT_PATH_P1, EXACT_PATH_P2]);
  assert.equal(result.relevantBlockingDecisions[0].proof, 'typed-intersecting-reference-closure');
  assert.deepEqual(result.relevantBlockingDecisions[0].intersection, [9102]);
});

test('BUG-016-A-005 P4: ciclo de refs originales termina sin duplicados', () => {
  const graph = protectedTransitiveGraph({ cycle: true });
  const closure = buildConstructiveScopeClosureCore(
    graph.requirements,
    [TRANSITIVE_REQUIREMENT],
    graph.context
  );
  assert.equal(closure.supportRefs.length, 2);
  assert.equal(closure.transferRefs.length, 1);
  assert.equal(closure.pathRefs.length, 2);
  assert.equal(new Set(closure.sourceRefs.map((ref) => `${ref.domain}|${String(ref.value)}`)).size, closure.sourceRefs.length);
});

test('BUG-016-A-005 P5: permutar el grafo tipado conserva deepEqual y canonicalSha256 del contexto', () => {
  const graph = protectedTransitiveGraph();
  const requirements = structuredClone(graph.requirements);
  requirements.supports.reverse();
  requirements.transfers.reverse();
  requirements.lateralPaths.reverse();
  const payload = structuredClone(graph.payload);
  payload.referenceBindings.reverse();
  payload.targets.reverse();
  payload.provenanceRelations.reverse();
  const context = createStructuralReferenceResolutionContext(requirements, payload);
  assert.equal(context.canonicalSha256, graph.context.canonicalSha256);
  assert.deepEqual(
    buildConstructiveScopeClosureCore(requirements, [TRANSITIVE_REQUIREMENT], context),
    buildConstructiveScopeClosureCore(graph.requirements, [TRANSITIVE_REQUIREMENT], graph.context)
  );
});

test('BUG-016-A-005 P6: cambiar sólo la ref contractual P1 por P2 cambia la clausura', () => {
  const firstRequirements = exactPathRegressionRequirements();
  const secondRequirements = structuredClone(firstRequirements);
  secondRequirements.requirements[0].sourceRefs = [EXACT_PATH_P2];
  const first = buildConstructiveScopeClosure(firstRequirements, [TRANSITIVE_REQUIREMENT]);
  const second = buildConstructiveScopeClosure(secondRequirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(first.pathRefs, [EXACT_PATH_P1]);
  assert.deepEqual(second.pathRefs, [EXACT_PATH_P2]);
  assert.notDeepEqual(second, first);
});

test('BUG-016-A-005 T2: candidate edge alcanza su path propietario exacto', () => {
  const graph = protectedTransitiveGraph();
  const closure = buildConstructiveScopeClosureCore(
    graph.requirements,
    [TRANSITIVE_REQUIREMENT],
    graph.context
  );
  assert.ok(closure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE && ref.value === EXACT_EDGE_E1
  )));
  assert.deepEqual(closure.pathRefs, [EXACT_PATH_P1, EXACT_PATH_P2]);
});

test('BUG-016-A-005 T3: candidate edge inexistente falla cerrado como target unresolved', () => {
  const graph = protectedTransitiveGraph();
  graph.payload.targets = graph.payload.targets.filter((item) => !(
    item.domain === STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE && item.value === EXACT_EDGE_E1
  ));
  graph.context = createStructuralReferenceResolutionContext(graph.requirements, graph.payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    graph.requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_TARGET_UNRESOLVED));
});

test('BUG-016-A-005 T4: candidate edge sin memberOfPath falla cerrado como link unresolved', () => {
  const graph = protectedTransitiveGraph();
  graph.payload.provenanceRelations = graph.payload.provenanceRelations.filter((item) => (
    item.from.value !== EXACT_EDGE_E1
  ));
  graph.context = createStructuralReferenceResolutionContext(graph.requirements, graph.payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    graph.requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_LINK_UNRESOLVED));
});

test('BUG-016-A-005 T5: ref connective-required sin binding falla como domain unresolved', () => {
  const requirements = exactPathRegressionRequirements();
  const payload = syntheticContextPayload(requirements);
  payload.referenceBindings = payload.referenceBindings.filter((item) => item.origin.entityType !== 'requirement');
  const context = createStructuralReferenceResolutionContext(requirements, payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_UNRESOLVED));
});

test('BUG-016-A-005 T6: bindings contradictorios de una ocurrencia fallan como domain ambiguous', () => {
  const graph = protectedTransitiveGraph();
  const first = graph.payload.referenceBindings[0];
  graph.payload.referenceBindings.push({
    ...structuredClone(first),
    occurrenceId: `${first.occurrenceId}:contradictory`,
    to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, EXACT_PATH_P1)
  });
  graph.context = createStructuralReferenceResolutionContext(graph.requirements, graph.payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    graph.requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_AMBIGUOUS));
});

test('BUG-016-A-005 T6 provenance: binding con from contradictorio falla como provenance mismatch', () => {
  const graph = protectedTransitiveGraph();
  graph.payload.referenceBindings[0].from = typed(
    STRUCTURAL_REFERENCE_DOMAINS.REGION,
    TRANSITIVE_REGION
  );
  graph.context = createStructuralReferenceResolutionContext(graph.requirements, graph.payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    graph.requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH));
});

test('BUG-016-A-005 T7: topologyNodeId:X no conecta con candidatePathNodeId:X', () => {
  const requirements = crossDomainRequirements({
    ownerRef: { kind: 'element', id: 9998 },
    topologicalBoundaries: [{ nodeId: 'X', nodeType: 'test' }],
    pathSourceRefs: { roofGeometryId: 8001, targetElementId: 9999 }
  });
  requirements.supports.push({
    id: ALLOWLIST_SUPPORT,
    graph: 'lateral',
    targetRegionRefs: [],
    sourceRefs: [],
    fromRefs: ['X'],
    toRefs: [],
    provenance: 'candidatePath',
    verificationState: 'notVerified'
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.supportRefs, []);
});

test('BUG-016-A-005 T8: pathId:X no conecta con candidatePathEdgeId:X', () => {
  const requirements = exactPathRegressionRequirements();
  requirements.supports.push({
    id: ALLOWLIST_SUPPORT,
    graph: 'lateral',
    targetRegionRefs: [],
    sourceRefs: [EXACT_PATH_P1],
    fromRefs: [],
    toRefs: [],
    provenance: 'candidatePath',
    verificationState: 'notVerified'
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.supportRefs, []);
});

test('BUG-016-A-005 T9: fingerprint de otro requirements falla como context mismatch', () => {
  const graph = protectedTransitiveGraph();
  const changed = structuredClone(graph.requirements);
  changed.requirements[0].code = 'SR-OTHER-RUN';
  const result = evaluateConstructiveScopeEligibilityCore(
    changed,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    graph.context
  );
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_CONTEXT_MISMATCH));
});

test('BUG-016-A-005 T10: candidateEvidenceRefs no vacío falla como reserved unsupported', () => {
  const requirements = exactPathRegressionRequirements();
  requirements.regions[0].candidateEvidenceRefs = ['reserved-ref'];
  const result = evaluateConstructiveScopeEligibility(requirements, {
    mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT]
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_RESERVED_UNSUPPORTED));
});

test('BUG-016-A-005 T11/T12: blocker y contexto ajenos al scope no atraviesan effective input', () => {
  const scenarioValue = scenario(scopeRequirements(), [assignment()]);
  const before = projectEffectiveConstructiveInput(args({ scenario: scenarioValue }));
  const changedRequirements = structuredClone(fx.requirements);
  changedRequirements.blockingDecisions[0].sourceRefs.push('diagnostic-context-outside-scope');
  const payload = {
    targets: fx.referenceResolutionContext.targets,
    referenceBindings: fx.referenceResolutionContext.referenceBindings,
    provenanceRelations: [
      ...fx.referenceResolutionContext.provenanceRelations,
      {
        relationId: 'unrelated-provenance',
        kind: 'candidateEdgeMemberOfPath',
        from: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, 'unrelated-edge'),
        to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'unrelated-path'),
        origin: { producerType: 'testFixture' }
      }
    ]
  };
  const changedContext = createStructuralReferenceResolutionContext(changedRequirements, payload);
  const after = projectEffectiveConstructiveInput(args({
    scenario: scenarioValue,
    structuralRequirements: changedRequirements,
    referenceResolutionContext: changedContext
  }));
  assert.deepEqual(after, before);
  assert.equal(allObjectKeys(after).has('referenceResolutionContext'), false);
});

test('BUG-016-A-005 T13: mismo legacyValue en dos dominios conserva ambos sin ambiguity', () => {
  const requirements = exactPathRegressionRequirements();
  requirements.requirements[0].sourceRefs = ['SAME', 'SAME'];
  requirements.lateralPaths[0].pathId = 'SAME';
  const payload = syntheticContextPayload(requirements);
  payload.referenceBindings = [
    referenceBinding({
      occurrenceKey: 'same-path', entityType: 'requirement', entityId: TRANSITIVE_REQUIREMENT,
      field: 'sourceRefs', fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'SAME', to: typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'SAME')
    }),
    referenceBinding({
      occurrenceKey: 'same-edge', entityType: 'requirement', entityId: TRANSITIVE_REQUIREMENT,
      field: 'sourceRefs', fromDomain: STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT,
      legacyValue: 'SAME', to: typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, 'SAME')
    })
  ];
  payload.targets.push(target(typed(STRUCTURAL_REFERENCE_DOMAINS.PATH, 'SAME')));
  payload.targets.push(target(typed(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, 'SAME')));
  payload.provenanceRelations.push(memberOfPath('SAME', 'SAME'));
  const context = createStructuralReferenceResolutionContext(requirements, payload);
  const result = evaluateConstructiveScopeEligibilityCore(
    requirements,
    { mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT] },
    context
  );
  assert.equal(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_AMBIGUOUS), false);
  assert.equal(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH), false);
  assert.ok(result.scopeClosure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.PATH && ref.value === 'SAME'
  )));
  assert.ok(result.scopeClosure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE && ref.value === 'SAME'
  )));
});

test('BUG-016-A-005 FX-008: requirement lateral alcanza path y edge exactos, no un segundo path del target', () => {
  const closure = buildConstructiveScopeClosure(
    fx.requirements,
    [LOAD_TRANSFER_REQUIREMENT],
    fx.referenceResolutionContext
  );
  assert.deepEqual(closure.pathRefs, [FX008_LATERAL_PATH]);
  assert.ok(closure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE && ref.value === FX008_LATERAL_EDGE
  )));
  assert.equal(fx.requirements.verification.state, 'notVerified');
});

test('SPEC-016-A B2: FX-008 conserva autoridades, conteos y notVerified antes del cierre', () => {
  assert.equal(fx.context.geometry.elements.filter((item) => item.type === 'wall').length, 45);
  assert.equal(fx.context.geometry.elements.filter((item) => item.type === 'wall').flatMap((item) => item.openings).length, 43);
  assert.equal(fx.context.geometry.elements.filter((item) => item.type === 'foundation').length, 32);
  assert.equal(fx.context.geometry.roofGeometry.length, 7);
  assert.equal(fx.requirements.requirements.length, 9);
  assert.equal(fx.requirements.blockingDecisions.length, 5);
  assert.equal(fx.requirements.verification.state, 'notVerified');
});

test('SPEC-016-A B2: requirement inexistente persiste pero produce diagnóstico contextual explícito', () => {
  const result = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements([MISSING_REQUIREMENT]), [assignment({ requirementRef: MISSING_REQUIREMENT })])
  }));
  assert.equal(result.eligibleForEffectiveProjection, false);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_NOT_FOUND));
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.EMPTY_EFFECTIVE_SCOPE));
});

test('SPEC-016-A B2: scope all conserva la elegibilidad global sin reinterpretarla', () => {
  const allowed = evaluateConstructiveScopeEligibility(globallyEligible(), { mode: 'all' });
  const blocked = evaluateConstructiveScopeEligibility(fx.requirements, { mode: 'all' });
  assert.equal(allowed.eligible, true);
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.excludedBlockingDecisions.length, 0);
  assert.equal(blocked.relevantBlockingDecisions.length, 5);
  assert.ok(blocked.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_RELEVANT));
});

test('SPEC-016-A B2: scope requirements roto o efectivo vacío falla cerrado', () => {
  const result = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements([MISSING_REQUIREMENT]));
  assert.equal(result.eligible, false);
  assert.deepEqual(result.effectiveRequirementIds, []);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_NOT_FOUND));
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.EMPTY_EFFECTIVE_SCOPE));
});

test('SPEC-016-A B2: target requirement exacto es compatible', () => {
  const result = evaluateConstructiveScenarioContext(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  assert.equal(result.contextuallyValid, true);
  assert.equal(result.eligibleForEffectiveProjection, true);
});

test('SPEC-016-A B2: target region real compatible se resuelve por referencias exactas', () => {
  const result = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements(), [assignment({ targetRef: { kind: 'region', ref: LATERAL_REGION } })])
  }));
  assert.equal(result.contextuallyValid, true);
});

test('SPEC-016-A B2: target region ajena se rechaza sin heurística', () => {
  const otherRegion = fx.requirements.regions.find((item) => item.regionId !== LATERAL_REGION);
  const result = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements(), [assignment({ targetRef: { kind: 'region', ref: otherRegion.regionId } })])
  }));
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_INCOMPATIBLE));
});

test('SPEC-016-A B2: target region que dejó de resolver queda diagnosticada, no reparada', () => {
  const result = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements(), [assignment({ targetRef: { kind: 'region', ref: MISSING_REGION } })])
  }));
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED));
});

test('SPEC-016-A B2: assignment válido pero ajeno al scope efectivo queda diagnosticado', () => {
  const desynchronized = scenario(scopeRequirements(), [assignment()]);
  desynchronized.scope = scopeRequirements([LATERAL_RESISTANCE_REQUIREMENT]);
  const result = evaluateConstructiveScenarioContext(args({
    scenario: desynchronized
  }));
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_OUTSIDE_SCOPE));
});

test('SPEC-016-A B2: biblioteca exacta y componentType existente habilitan validación contextual', () => {
  const result = evaluateConstructiveScenarioContext(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  assert.equal(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.LIBRARY_NOT_AVAILABLE), false);
  assert.equal(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.COMPONENT_TYPE_NOT_FOUND), false);
});

test('SPEC-016-A B2: biblioteca ausente y componentType inexistente son diagnósticos estables', () => {
  const withMissingLibrary = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements(), [assignment()]), libraryContext: null
  }));
  const withMissingComponent = evaluateConstructiveScenarioContext(args({
    scenario: scenario(scopeRequirements(), [assignment()]), libraryContext: libraryContext([])
  }));
  assert.ok(withMissingLibrary.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.LIBRARY_NOT_AVAILABLE));
  assert.ok(withMissingComponent.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.COMPONENT_TYPE_NOT_FOUND));
});

test('SPEC-016-A B2: FX-008 excluye los cinco blockers por disjunción tipada roofGeometryId', () => {
  const result = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.scopeClosure.governingRefs.roofGeometryIds, [LATERAL_ROOF]);
  assert.deepEqual(result.relevantBlockingDecisions, []);
  assert.deepEqual(result.excludedBlockingDecisions.map((item) => item.blockerRefs[0]), GLOBAL_BLOCKER_ROOFS);
  assert.ok(result.excludedBlockingDecisions.every((item) => item.domain === 'roofGeometryId'));
  assert.ok(result.excludedBlockingDecisions.every((item) => item.proof === 'typed-disjoint-reference-closure'));
});

test('BUG-016-A-002 B2.1: clausura de dos saltos alcanza un path no referido por el requirement', () => {
  const closure = buildConstructiveScopeClosure(transitiveRequirements({ chainLength: 2, blockerRoof: null }), [TRANSITIVE_REQUIREMENT]);
  assert.equal(closure.pathRefs.length, 1);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [TRANSITIVE_ROOF]);
});

test('BUG-016-A-002 B2.1: clausura de más de tres saltos alcanza support, transfer, support y path', () => {
  const closure = buildConstructiveScopeClosure(transitiveRequirements({ chainLength: 4, blockerRoof: null }), [TRANSITIVE_REQUIREMENT]);
  assert.equal(closure.supportRefs.length, 2);
  assert.equal(closure.transferRefs.length, 1);
  assert.equal(closure.pathRefs.length, 1);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [TRANSITIVE_ROOF]);
});

test('BUG-016-A-002 B2.1: roof indirecto vuelve relevante el blocker por intersección tipada', () => {
  const result = evaluateConstructiveScopeEligibility(transitiveRequirements({ chainLength: 4 }), {
    mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT]
  });
  assert.equal(result.eligible, false);
  assert.equal(result.relevantBlockingDecisions.length, 1);
  assert.equal(result.relevantBlockingDecisions[0].proof, 'typed-intersecting-reference-closure');
  assert.deepEqual(result.relevantBlockingDecisions[0].intersection, [TRANSITIVE_ROOF]);
});

test('BUG-016-A-002 B2.1: permutar entidades no cambia la clausura transitiva final', () => {
  const original = transitiveRequirements({ chainLength: 4, blockerRoof: null });
  const permuted = structuredClone(original);
  permuted.supports.reverse();
  permuted.transfers.reverse();
  permuted.lateralPaths.reverse();
  assert.deepEqual(
    buildConstructiveScopeClosure(permuted, [TRANSITIVE_REQUIREMENT]),
    buildConstructiveScopeClosure(original, [TRANSITIVE_REQUIREMENT])
  );
});

test('BUG-016-A-002 B2.1: ciclos explícitos terminan sin duplicar entidades', () => {
  const requirements = transitiveRequirements({ chainLength: 4, blockerRoof: null });
  requirements.supports[1].targetRegionRefs.push(TRANSITIVE_REGION);
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.equal(closure.supportRefs.length, 2);
  assert.equal(closure.transferRefs.length, 1);
  assert.equal(closure.pathRefs.length, 1);
});

test('BUG-016-A-003 B2.2: IDs escritos sólo como evidence descriptiva no expanden la clausura', () => {
  const closure = buildConstructiveScopeClosure(allowlistRequirements(), [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, []);
  assert.deepEqual(closure.supportRefs, [
    `sr-support:sha256:${'4'.repeat(64)}`
  ]);
  assert.deepEqual(closure.transferRefs, []);
  assert.equal(closure.sourceRefs.includes(ALLOWLIST_PATH), false);
  assert.equal(closure.sourceRefs.includes(ALLOWLIST_SUPPORT), false);
  assert.equal(closure.sourceRefs.includes(ALLOWLIST_TRANSFER), false);
  assert.equal(closure.sourceRefs.includes(ALLOWLIST_RELATION), false);
  assert.equal(closure.sourceRefs.includes(ALLOWLIST_INTERFACE), false);
});

test('BUG-016-A-003 B2.2: los mismos IDs en campos reference-bearing sí expanden la clausura', () => {
  const closure = buildConstructiveScopeClosure(allowlistRequirements({ referenceBearing: true }), [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, [ALLOWLIST_PATH]);
  assert.ok(closure.supportRefs.includes(ALLOWLIST_SUPPORT));
  assert.deepEqual(closure.transferRefs, [ALLOWLIST_TRANSFER]);
  assert.ok(closure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.RELATION && ref.value === ALLOWLIST_RELATION
  )));
  assert.ok(closure.sourceRefs.some((ref) => (
    ref.domain === STRUCTURAL_REFERENCE_DOMAINS.INTERFACE && ref.value === ALLOWLIST_INTERFACE
  )));
  assert.deepEqual(closure.governingRefs.relationIds, [ALLOWLIST_RELATION]);
  assert.deepEqual(closure.governingRefs.interfaceIds, [ALLOWLIST_INTERFACE]);
});

test('BUG-016-A-003 B2.2: ownerRef y targetElementId numéricos conectan sin promover otros números', () => {
  const requirements = allowlistRequirements();
  requirements.supports[0].evidence = {};
  requirements.lateralPaths[0].sourceRefs.targetElementId = 7001;
  requirements.lateralPaths[0].evidence = { gapMm: 7001, arbitraryNumber: 123456789 };
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, [ALLOWLIST_PATH]);
  assert.ok(closure.governingRefs.elementIds.includes(7001));
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [ALLOWLIST_ROOF]);
  assert.equal(closure.sourceRefs.includes(123456789), false);
});

test('BUG-016-A-003 B2.2: cambiar sólo texto no-reference conserva deepEqual la clausura', () => {
  const before = allowlistRequirements();
  const after = structuredClone(before);
  after.supports[0].evidence.note = 'path:sha256:descriptive-value-changed';
  after.lateralPaths[0].findings = ['sr-support:sha256:descriptive-finding'];
  after.lateralPaths[0].sourceRefs.direction = 'path:sha256:still-data';
  assert.deepEqual(
    buildConstructiveScopeClosure(after, [TRANSITIVE_REQUIREMENT]),
    buildConstructiveScopeClosure(before, [TRANSITIVE_REQUIREMENT])
  );
});

test('BUG-016-A-003 B2.2: cambiar una referencia contractual altera la clausura', () => {
  const first = buildConstructiveScopeClosure(
    allowlistRequirements({ referenceBearing: true, pathRef: ALLOWLIST_PATH }),
    [TRANSITIVE_REQUIREMENT]
  );
  const second = buildConstructiveScopeClosure(
    allowlistRequirements({ referenceBearing: true, pathRef: ALLOWLIST_PATH_ALTERNATE }),
    [TRANSITIVE_REQUIREMENT]
  );
  assert.notDeepEqual(second, first);
  assert.deepEqual(first.pathRefs, [ALLOWLIST_PATH]);
  assert.deepEqual(second.pathRefs, [ALLOWLIST_PATH_ALTERNATE]);
});

test('BUG-016-A-003 B2.2: la cadena contractual de más de tres saltos conserva el punto fijo', () => {
  const closure = buildConstructiveScopeClosure(
    transitiveRequirements({ chainLength: 4, blockerRoof: null }),
    [TRANSITIVE_REQUIREMENT]
  );
  assert.equal(closure.supportRefs.length, 2);
  assert.equal(closure.transferRefs.length, 1);
  assert.equal(closure.pathRefs.length, 1);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [TRANSITIVE_ROOF]);
});

test('BUG-016-A-003 B2.2: el motor no decide referencias por forma textual ni recorrido indiscriminado', async () => {
  const source = await readFile(new URL('../src/core/constructiveScenarioContext.js', import.meta.url), 'utf8');
  assert.equal(source.includes('collectReferenceStrings'), false);
  assert.equal(source.includes("value.includes(':')"), false);
  assert.equal(source.includes('.startsWith('), false);
  assert.equal(source.includes('Object.values('), false);
});

test('BUG-016-A-004 B2.3 reversión: elementId y roofGeometryId con igual valor no conectan', () => {
  const requirements = allowlistRequirements();
  requirements.lateralPaths[0].sourceRefs = {
    roofGeometryId: 7001,
    targetElementId: 9999,
    direction: 'x'
  };
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, []);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, []);
});

test('BUG-016-A-004 B2.3: elementId y targetElementId del mismo dominio sí conectan', () => {
  const requirements = crossDomainRequirements({
    pathSourceRefs: { roofGeometryId: 8001, targetElementId: 7001 }
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, [ALLOWLIST_PATH]);
  assert.deepEqual(closure.governingRefs.elementIds, [7001]);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [8001]);
});

test('BUG-016-A-004 B2.3: mismo valor simultáneo conserva elementId y roofGeometryId separados', () => {
  const requirements = crossDomainRequirements({
    pathSourceRefs: { roofGeometryId: 7001, targetElementId: 7001 }
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, [ALLOWLIST_PATH]);
  assert.deepEqual(closure.governingRefs.elementIds, [7001]);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, [7001]);
});

test('BUG-016-A-004 B2.3: nodeId y elementId con igual valor no conectan', () => {
  const requirements = crossDomainRequirements({
    ownerRef: { kind: 'element', id: 9998 },
    topologicalBoundaries: [{ nodeId: 7001, nodeType: 'test' }],
    pathSourceRefs: { roofGeometryId: 8001, targetElementId: 7001 }
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, []);
  assert.deepEqual(closure.governingRefs.roofGeometryIds, []);
});

test('BUG-016-A-004 B2.3: boundaryId y roofGeometryId con igual valor no conectan', () => {
  const requirements = crossDomainRequirements({
    ownerRef: { kind: 'roofBoundary', roofGeometryId: 8001, boundaryId: 'same-value' },
    pathSourceRefs: {
      roofGeometryId: 'same-value',
      boundaryId: 'other-boundary',
      targetElementId: 9999
    }
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, []);
});

test('BUG-016-A-004 B2.3: string y número conservan identidades distintas dentro del mismo dominio', () => {
  const requirements = crossDomainRequirements({
    pathSourceRefs: { roofGeometryId: 8001, targetElementId: '7001' }
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.deepEqual(closure.pathRefs, []);
});

test('BUG-016-A-004 B2.3: colisión cross-domain no fabrica blocker intersectante', () => {
  const decision = {
    decisionId: `sr-decision:sha256:${'e'.repeat(64)}`,
    code: 'SR-CROSS-DOMAIN-BLOCKER',
    scope: { roofGeometryId: 7001 },
    sourceRefs: ['evidence-only']
  };
  const requirements = crossDomainRequirements({
    pathSourceRefs: { roofGeometryId: 8001, targetElementId: 7001 },
    extraPaths: [{
      pathId: ALLOWLIST_PATH_ALTERNATE,
      graph: 'lateral',
      sourceRefs: { roofGeometryId: 7001, targetElementId: 9999 },
      verificationState: 'notVerified'
    }],
    blockingDecisions: [decision]
  });
  const result = evaluateConstructiveScopeEligibility(requirements, {
    mode: 'requirements', requirementIds: [TRANSITIVE_REQUIREMENT]
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.scopeClosure.pathRefs, [ALLOWLIST_PATH]);
  assert.deepEqual(result.scopeClosure.governingRefs.roofGeometryIds, [8001]);
  assert.deepEqual(result.relevantBlockingDecisions, []);
  assert.equal(result.excludedBlockingDecisions[0].proof, 'typed-disjoint-reference-closure');
});

test('BUG-016-A-004 B2.3: referencia ajena con valor colisionante no altera effective input', () => {
  const baselineEligibility = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  const effectiveElementId = baselineEligibility.scopeClosure.governingRefs.elementIds[0];
  const first = structuredClone(fx.requirements);
  const second = structuredClone(fx.requirements);
  const unrelatedPath = {
    pathId: `path:sha256:${'a'.repeat(64)}`,
    graph: 'lateral',
    sourceRefs: { roofGeometryId: effectiveElementId, targetElementId: -1, direction: 'x' },
    verificationState: 'notVerified'
  };
  first.lateralPaths.push(unrelatedPath);
  second.lateralPaths.push({
    ...unrelatedPath,
    sourceRefs: { ...unrelatedPath.sourceRefs, roofGeometryId: effectiveElementId + 1 }
  });
  const scenarioValue = scenario(scopeRequirements(), [assignment()]);
  assert.deepEqual(
    projectEffectiveConstructiveInput(args({ scenario: scenarioValue, structuralRequirements: first })),
    projectEffectiveConstructiveInput(args({ scenario: scenarioValue, structuralRequirements: second }))
  );
});

test('BUG-016-A-004 B2.3: ciclo tipado termina y colisión cross-domain no agrega path artificial', () => {
  const requirements = transitiveRequirements({ chainLength: 4, blockerRoof: null });
  requirements.supports[1].targetRegionRefs.push(TRANSITIVE_REGION);
  requirements.lateralPaths.push({
    pathId: ALLOWLIST_PATH,
    graph: 'lateral',
    sourceRefs: { roofGeometryId: 7001, targetElementId: 9999 },
    verificationState: 'notVerified'
  });
  const closure = buildConstructiveScopeClosure(requirements, [TRANSITIVE_REQUIREMENT]);
  assert.equal(closure.supportRefs.length, 2);
  assert.equal(closure.transferRefs.length, 1);
  assert.equal(closure.pathRefs.length, 1);
  assert.equal(closure.pathRefs.includes(ALLOWLIST_PATH), false);
});

test('BUG-016-A-004 B2.3: permutar el mismo conjunto tipado conserva scopeClosure deepEqual', () => {
  const original = transitiveRequirements({ chainLength: 4, blockerRoof: null });
  const permuted = structuredClone(original);
  permuted.regions.reverse();
  permuted.supports.reverse();
  permuted.transfers.reverse();
  permuted.lateralPaths.reverse();
  assert.deepEqual(
    buildConstructiveScopeClosure(permuted, [TRANSITIVE_REQUIREMENT]),
    buildConstructiveScopeClosure(original, [TRANSITIVE_REQUIREMENT])
  );
});

test('BUG-016-A-004 B2.3: conectividad productiva conserva explícitamente dominio y valor', async () => {
  const source = await readFile(new URL('../src/core/constructiveScenarioContext.js', import.meta.url), 'utf8');
  assert.equal(source.includes('refs.set(idToken(value), value)'), false);
  assert.ok(source.includes('typedReferenceKey(domain, value)'));
  assert.ok(source.includes('{ domain, value }'));
});

test('BUG-016-A-002 B2.1: blockers excluidos quedan en diagnóstico pero no atraviesan effective input', () => {
  const eligibility = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  const projected = projectEffectiveConstructiveInput(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  assert.equal(eligibility.excludedBlockingDecisions.length, 5);
  assert.equal(allObjectKeys(projected).has('excludedBlockingDecisions'), false);
  for (const blocker of eligibility.excludedBlockingDecisions) {
    assert.equal(JSON.stringify(projected).includes(blocker.blockingDecisionId), false);
  }
});

test('BUG-016-A-002 B2.1 reversión: cambiar un blocker todavía excluido conserva deepEqual el effective input', () => {
  const changed = structuredClone(fx.requirements);
  changed.blockingDecisions[0].code = 'SR-ROOF-INTENT-INCOMPLETE-CHANGED-OUTSIDE-SCOPE';
  changed.blockingDecisions[0].sourceRefs.push('aux:changed-outside-scope');
  const scenarioValue = scenario(scopeRequirements(), [assignment()]);
  const beforeEvaluation = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  const afterEvaluation = evaluateConstructiveScopeEligibility(changed, scopeRequirements());
  assert.notDeepEqual(afterEvaluation, beforeEvaluation);
  assert.deepEqual(
    projectEffectiveConstructiveInput(args({ scenario: scenarioValue })),
    projectEffectiveConstructiveInput(args({ scenario: scenarioValue, structuralRequirements: changed }))
  );
});

test('BUG-016-A-002 B2.1 inversa: el mismo blocker al intersectar bloquea y rechaza proyección', () => {
  const intersecting = structuredClone(fx.requirements);
  intersecting.blockingDecisions[0].scope.roofGeometryId = LATERAL_ROOF;
  const result = evaluateConstructiveScopeEligibility(intersecting, scopeRequirements());
  assert.equal(result.eligible, false);
  assert.equal(result.relevantBlockingDecisions[0].proof, 'typed-intersecting-reference-closure');
  assert.throws(
    () => projectEffectiveConstructiveInput(args({ structuralRequirements: intersecting })),
    (error) => error instanceof ConstructiveScenarioContextError && error.code === 'CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE'
  );
});

test('BUG-016-A-002 B2.1: FX-008 conserva cinco excluidos en diagnóstico y cero en el paquete efectivo', () => {
  const eligibility = evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements());
  const projected = projectEffectiveConstructiveInput(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  assert.equal(eligibility.excludedBlockingDecisions.length, 5);
  assert.deepEqual(projected.effectiveStructuralRequirements.relevantBlockingDecisionContext, []);
  assert.equal(allObjectKeys(projected).has('excludedBlockingDecisions'), false);
});

test('BUG-016-A-002 B2.1: motor productivo no hardcodea IDs del fixture FX-008', async () => {
  const source = await readFile(new URL('../src/core/constructiveScenarioContext.js', import.meta.url), 'utf8');
  for (const id of [LATERAL_ROOF, ...GLOBAL_BLOCKER_ROOFS]) assert.equal(source.includes(String(id)), false);
});

test('SPEC-016-A B2: sourceRef auxiliar irresoluble no invalida prueba completa por roofGeometryId', () => {
  const requirements = structuredClone(fx.requirements);
  requirements.blockingDecisions[0].sourceRefs.push('aux:unmaterialized');
  const result = evaluateConstructiveScopeEligibility(requirements, scopeRequirements());
  assert.equal(result.eligible, true);
  assert.equal(result.excludedBlockingDecisions.length, 5);
  assert.equal(result.excludedBlockingDecisions[0].proof, 'typed-disjoint-reference-closure');
});

test('SPEC-016-A B2 inversa: blocker intersectante con roof lateral bloquea', () => {
  const requirements = structuredClone(fx.requirements);
  requirements.blockingDecisions[0].scope.roofGeometryId = LATERAL_ROOF;
  const result = evaluateConstructiveScopeEligibility(requirements, scopeRequirements());
  assert.equal(result.eligible, false);
  assert.equal(result.relevantBlockingDecisions.length, 1);
  assert.equal(result.relevantBlockingDecisions[0].proof, 'typed-intersecting-reference-closure');
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_RELEVANT));
});

test('SPEC-016-A B2 inversa: blocker con dominio irresoluble bloquea fail-closed', () => {
  const requirements = structuredClone(fx.requirements);
  requirements.blockingDecisions[0].scope = { roofBoundaryId: 'missing-boundary' };
  const result = evaluateConstructiveScopeEligibility(requirements, scopeRequirements());
  assert.equal(result.eligible, false);
  assert.equal(result.relevantBlockingDecisions.length, 1);
  assert.equal(result.excludedBlockingDecisions.length, 4);
  assert.ok(result.reasonCodes.includes(CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_UNRESOLVED));
});

test('SPEC-016-A B2: múltiples blockers excluyen sólo los demostrablemente ajenos', () => {
  const requirements = structuredClone(fx.requirements);
  requirements.blockingDecisions[0].scope = { unresolvedSourceRef: 'aux:missing' };
  requirements.blockingDecisions[1].scope.roofGeometryId = LATERAL_ROOF;
  const result = evaluateConstructiveScopeEligibility(requirements, scopeRequirements());
  assert.equal(result.eligible, false);
  assert.equal(result.relevantBlockingDecisions.length, 2);
  assert.equal(result.excludedBlockingDecisions.length, 3);
});

test('SPEC-016-A B2: cierre real es trazable, determinista y conserva provenance', () => {
  const first = buildConstructiveScopeClosure(fx.requirements, [LATERAL_RESISTANCE_REQUIREMENT, LOAD_TRANSFER_REQUIREMENT]);
  const second = buildConstructiveScopeClosure(fx.requirements, [LOAD_TRANSFER_REQUIREMENT, LATERAL_RESISTANCE_REQUIREMENT]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.regionIds, [LATERAL_REGION]);
  assert.equal(first.pathRefs.length, 1);
  assert.equal(first.governingRefs.roofGeometryIds[0], LATERAL_ROOF);
  assert.ok(first.traces.some((item) => item.requirementId === LOAD_TRANSFER_REQUIREMENT && item.pathRefs.length === 1));
});

test('SPEC-016-A B2: permutaciones incidentales conservan elegibilidad, cierre y blockers', () => {
  const permuted = structuredClone(fx.requirements);
  for (const key of ['requirements', 'regions', 'supports', 'transfers', 'gravityPaths', 'lateralPaths', 'blockingDecisions']) {
    permuted[key].reverse();
  }
  assert.deepEqual(
    evaluateConstructiveScopeEligibility(permuted, scopeRequirements([LATERAL_RESISTANCE_REQUIREMENT, LOAD_TRANSFER_REQUIREMENT])),
    evaluateConstructiveScopeEligibility(fx.requirements, scopeRequirements())
  );
});

test('SPEC-016-A B2: evaluación y proyección aceptan autoridades congeladas y no mutan entradas', () => {
  const frozenArgs = deepFreeze(structuredClone(args({ scenario: scenario(scopeRequirements(), [assignment()]) })));
  const before = structuredClone(frozenArgs);
  evaluateConstructiveScenarioContext(frozenArgs);
  projectEffectiveConstructiveInput(frozenArgs);
  assert.deepEqual(frozenArgs, before);
  assert.throws(() => frozenArgs.structuralRequirements.requirements.push({}), TypeError);
});

test('SPEC-016-A B2: effective projection FX-008 es mínima y conserva IDs/provenance', () => {
  const projected = projectEffectiveConstructiveInput(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  assert.equal(projected.effectiveGeometry.elements.length, 1);
  assert.equal(projected.effectiveGeometry.roofGeometry.length, 1);
  assert.equal(projected.effectiveGeometry.elements[0].id, 1784606313849);
  assert.equal(projected.effectiveGeometry.roofGeometry[0].id, LATERAL_ROOF);
  assert.equal(projected.effectiveStructuralRequirements.requirements.length, 2);
  assert.equal(projected.effectiveStructuralRequirements.regions.length, 1);
  assert.equal(projected.effectiveStructuralRequirements.paths.length, 1);
  assert.equal(projected.effectiveStructuralRequirements.verification.state, 'notVerified');
  assert.equal(projected.effectiveStructuralRequirements.requirements.find((item) => item.id === LOAD_TRANSFER_REQUIREMENT).evidence.gapMm, 571.429);
});

test('SPEC-016-A B2 reversión: allowlist impide que campos upstream nuevos atraviesen la proyección', () => {
  const geometry = structuredClone(fx.context.geometry);
  geometry.structuralIntent = { forbidden: true };
  geometry.wallTypes = [{ forbidden: true }];
  geometry.elements.find((item) => item.id === 1784606313849).metalconProfile = 'C90';
  const requirements = structuredClone(fx.requirements);
  requirements.unexpectedAuthority = { store: true, UI: true, OSB: true };
  requirements.requirements.find((item) => item.id === LOAD_TRANSFER_REQUIREMENT).newUnknownField = 'must-not-pass';
  const projected = projectEffectiveConstructiveInput(args({ geometry, structuralRequirements: requirements, scenario: scenario(scopeRequirements(), [assignment()]) }));
  const keys = allObjectKeys(projected);
  for (const forbidden of ['structuralIntent', 'wallTypes', 'metalconProfile', 'unexpectedAuthority', 'newUnknownField', 'OSB']) {
    assert.equal(keys.has(forbidden), false, `${forbidden} no debe atravesar la allowlist`);
  }
  assert.equal(keys.has('structuralIntentSha256'), false, 'provenance global no contamina el paquete efectivo');
});

test('SPEC-016-A B2: proyección no entrega raíz completa, store, UI, Metalcon ni topología', () => {
  const projected = projectEffectiveConstructiveInput(args({ scenario: scenario(scopeRequirements(), [assignment()]) }));
  const keys = allObjectKeys(projected);
  assert.equal(Object.hasOwn(projected, 'structuralRequirements'), false);
  assert.equal(Object.hasOwn(projected, 'structuralIntent'), false);
  for (const forbidden of ['recognizedStructuralTopology', 'store', 'UI', 'Metalcon', 'studs', 'OSB']) {
    assert.equal(keys.has(forbidden), false);
  }
});

test('SPEC-016-A B2: mismo input produce salida canónica deepEqual', () => {
  const source = args({ scenario: scenario(scopeRequirements([LATERAL_RESISTANCE_REQUIREMENT, LOAD_TRANSFER_REQUIREMENT]), [assignment()]) });
  assert.deepEqual(projectEffectiveConstructiveInput(source), projectEffectiveConstructiveInput(structuredClone(source)));
  assert.deepEqual(projectEffectiveConstructiveInput(source).scope.requirementIds, [LOAD_TRANSFER_REQUIREMENT, LATERAL_RESISTANCE_REQUIREMENT].sort());
});

test('SPEC-016-A B2: proyección se rechaza antes de adapter si blocker es relevante', () => {
  const requirements = structuredClone(fx.requirements);
  requirements.blockingDecisions[0].scope.roofGeometryId = LATERAL_ROOF;
  assert.throws(
    () => projectEffectiveConstructiveInput(args({ requirements, structuralRequirements: requirements })),
    (error) => error instanceof ConstructiveScenarioContextError && error.code === 'CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE'
  );
});

test('SPEC-016-A B2: módulo puro no depende de store, UI, adapters, React, Three ni Metalcon', async () => {
  const source = await readFile(new URL('../src/core/constructiveScenarioContext.js', import.meta.url), 'utf8');
  for (const forbiddenImport of ['react', 'three', '../store', '/store', 'adapter', 'metalcon', 'osb']) {
    assert.equal(
      new RegExp(`from\\s+['"][^'"]*${forbiddenImport}`, 'i').test(source),
      false,
      `import prohibido: ${forbiddenImport}`
    );
  }
});
