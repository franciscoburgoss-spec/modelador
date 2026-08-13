import {
  canonicalizeValue,
  compareText,
  fingerprint,
  sourceFingerprint
} from './structuralProposalCommon.js';

export const STRUCTURAL_REFERENCE_RESOLUTION_CONTEXT_SCHEMA =
  'structural-reference-resolution-context-v1.0';

export const STRUCTURAL_REFERENCE_DOMAINS = Object.freeze({
  REQUIREMENT: 'requirementId',
  REGION: 'regionId',
  ELEMENT: 'elementId',
  ELEMENT_INTENT: 'elementIntentId',
  ROOF_GEOMETRY: 'roofGeometryId',
  BOUNDARY: 'boundaryId',
  TOPOLOGY_NODE: 'topologyNodeId',
  CANDIDATE_PATH_NODE: 'candidatePathNodeId',
  PATH: 'pathId',
  CANDIDATE_PATH_EDGE: 'candidatePathEdgeId',
  SUPPORT: 'supportId',
  TRANSFER: 'transferId',
  RELATION: 'relationId',
  INTERFACE: 'interfaceId',
  PROPOSAL: 'proposalId',
  OPENING: 'openingId'
});

function clone(value) {
  return structuredClone(value);
}

function withoutCanonicalSha256(value) {
  const copy = clone(value);
  if (copy && typeof copy === 'object') delete copy.canonicalSha256;
  return copy;
}

export function structuralRequirementsFingerprint(structuralRequirements) {
  return sourceFingerprint(withoutCanonicalSha256(structuralRequirements));
}

function canonicalArray(values, identity) {
  const byIdentity = new Map();
  for (const value of values || []) {
    const canonical = canonicalizeValue(clone(value));
    const key = identity(canonical);
    const existing = byIdentity.get(key);
    if (!existing || compareText(JSON.stringify(canonical), JSON.stringify(existing)) < 0) {
      byIdentity.set(key, canonical);
    }
  }
  return [...byIdentity.values()].sort((left, right) => (
    compareText(identity(left), identity(right))
    || compareText(JSON.stringify(left), JSON.stringify(right))
  ));
}

export function createStructuralReferenceResolutionContext(
  structuralRequirements,
  { referenceBindings = [], targets = [], provenanceRelations = [] } = {}
) {
  const draft = {
    schema: STRUCTURAL_REFERENCE_RESOLUTION_CONTEXT_SCHEMA,
    sourceSchema: structuralRequirements.schema,
    sourceRequirementsSha256: structuralRequirementsFingerprint(structuralRequirements),
    referenceBindings: canonicalArray(referenceBindings, (item) => String(item.occurrenceId ?? '')),
    targets: canonicalArray(targets, (item) => `${item.domain}|${JSON.stringify(item.value)}`),
    provenanceRelations: canonicalArray(provenanceRelations, (item) => String(item.relationId ?? ''))
  };
  const canonical = canonicalizeValue(draft);
  return { ...canonical, canonicalSha256: fingerprint(canonical) };
}
