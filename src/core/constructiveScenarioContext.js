import {
  canonicalizeValue,
  compareIds,
  compareText,
  fingerprint,
  idToken,
  isRecord
} from './structuralProposalCommon.js';
import { hasOwn } from './hasOwn.js';
import {
  STRUCTURAL_REFERENCE_DOMAINS as REFERENCE_DOMAINS,
  STRUCTURAL_REFERENCE_RESOLUTION_CONTEXT_SCHEMA,
  structuralRequirementsFingerprint
} from './structuralReferenceResolutionContext.js';

export const CONSTRUCTIVE_CONTEXT_EVALUATION_SCHEMA = 'constructive-scenario-context-evaluation-v1.0';
export const CONSTRUCTIVE_SCOPE_ELIGIBILITY_SCHEMA = 'constructive-scope-eligibility-v1.0';
export const CONSTRUCTIVE_SCOPE_CLOSURE_SCHEMA = 'constructive-scope-closure-v1.0';
export const CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA = 'constructive-library-context-v1.0';
export const EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA = 'constructive-effective-input-v1.0';
export const EFFECTIVE_CONSTRUCTIVE_GEOMETRY_SCHEMA = 'effective-constructive-geometry-v1.0';
export const EFFECTIVE_STRUCTURAL_REQUIREMENTS_SCHEMA = 'effective-structural-requirements-v1.0';

export const CONSTRUCTIVE_CONTEXT_REASON_CODES = Object.freeze({
  REQUIREMENT_NOT_FOUND: 'REQUIREMENT_NOT_FOUND',
  REQUIREMENT_OUTSIDE_SCOPE: 'REQUIREMENT_OUTSIDE_SCOPE',
  TARGET_NOT_RESOLVED: 'TARGET_NOT_RESOLVED',
  TARGET_INCOMPATIBLE: 'TARGET_INCOMPATIBLE',
  LIBRARY_NOT_AVAILABLE: 'LIBRARY_NOT_AVAILABLE',
  COMPONENT_TYPE_NOT_FOUND: 'COMPONENT_TYPE_NOT_FOUND',
  BLOCKING_DECISION_RELEVANT: 'BLOCKING_DECISION_RELEVANT',
  BLOCKING_DECISION_UNRESOLVED: 'BLOCKING_DECISION_UNRESOLVED',
  EMPTY_EFFECTIVE_SCOPE: 'EMPTY_EFFECTIVE_SCOPE',
  STRUCTURAL_REQUIREMENTS_INVALID: 'STRUCTURAL_REQUIREMENTS_INVALID',
  SCOPE_REF_DOMAIN_UNRESOLVED: 'SCOPE_REF_DOMAIN_UNRESOLVED',
  SCOPE_REF_DOMAIN_AMBIGUOUS: 'SCOPE_REF_DOMAIN_AMBIGUOUS',
  SCOPE_REF_TARGET_UNRESOLVED: 'SCOPE_REF_TARGET_UNRESOLVED',
  SCOPE_REF_LINK_UNRESOLVED: 'SCOPE_REF_LINK_UNRESOLVED',
  SCOPE_REF_PROVENANCE_MISMATCH: 'SCOPE_REF_PROVENANCE_MISMATCH',
  SCOPE_REF_RESERVED_UNSUPPORTED: 'SCOPE_REF_RESERVED_UNSUPPORTED',
  SCOPE_REF_CONTEXT_MISMATCH: 'SCOPE_REF_CONTEXT_MISMATCH'
});

const REQUIREMENTS_SCHEMA = 'structural-requirements-v1.0';
const GEOMETRY_SCHEMA = 'agnostic-geometry-v1.0';
const SUPPORTED_BLOCKER_DOMAINS = Object.freeze({
  roofGeometryId: 'roofGeometryIds',
  elementId: 'elementIds',
  relationId: 'relationIds',
  interfaceId: 'interfaceIds',
  pathId: 'pathIds'
});

export class ConstructiveScenarioContextError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConstructiveScenarioContextError';
    this.code = code;
    this.details = details;
  }
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  }
  return value;
}

function uniqueText(values) {
  return [...new Set(values.filter((value) => typeof value === 'string'))].sort(compareText);
}

function uniqueIds(values) {
  const byToken = new Map();
  for (const value of values.filter((item) => item !== null && item !== undefined)) {
    byToken.set(idToken(value), value);
  }
  return [...byToken.values()].sort(compareIds);
}

function compareById(key) {
  return (left, right) => compareText(String(left?.[key] ?? ''), String(right?.[key] ?? ''));
}

function pick(source, keys) {
  if (!isRecord(source)) return {};
  return Object.fromEntries(keys.filter((key) => hasOwn(source, key)).map((key) => [key, cloneJson(source[key])]));
}

function diagnostic(code, path, refs = []) {
  return { code, path, refs: uniqueText(refs.map(String)) };
}

function canonicalDiagnostics(diagnostics) {
  const byKey = new Map();
  for (const item of diagnostics) byKey.set(JSON.stringify(canonicalizeValue(item)), item);
  return [...byKey.values()].sort((left, right) => (
    compareText(left.code, right.code)
    || compareText(left.path, right.path)
    || compareText(JSON.stringify(left.refs), JSON.stringify(right.refs))
  ));
}

function requirementsShapeValid(requirements) {
  return isRecord(requirements)
    && requirements.schema === REQUIREMENTS_SCHEMA
    && Array.isArray(requirements.requirements)
    && Array.isArray(requirements.regions)
    && Array.isArray(requirements.supports)
    && Array.isArray(requirements.transfers)
    && Array.isArray(requirements.gravityPaths)
    && Array.isArray(requirements.lateralPaths)
    && Array.isArray(requirements.blockingDecisions)
    && isRecord(requirements.eligibility)
    && requirements.verification?.state === 'notVerified';
}

function refCollections() {
  return {
    roofGeometryIds: [],
    elementIds: [],
    relationIds: [],
    interfaceIds: [],
    pathIds: []
  };
}

function registerTypedPathRefs(collections, path) {
  collections.pathIds.push(path.pathId);
  const refs = path.sourceRefs;
  if (!isRecord(refs)) return;
  if (refs.roofGeometryId !== undefined) collections.roofGeometryIds.push(refs.roofGeometryId);
  if (refs.targetElementId !== undefined) collections.elementIds.push(refs.targetElementId);
  if (refs.relationId !== undefined) collections.relationIds.push(refs.relationId);
}

function typedReferenceKey(domain, value) {
  return `${domain}|${idToken(value)}`;
}

function addTypedReference(refs, domain, value) {
  if (typeof value === 'string' || Number.isFinite(value)) {
    refs.set(typedReferenceKey(domain, value), { domain, value });
  }
}

function addTypedReferenceList(refs, domain, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) addTypedReference(refs, domain, value);
}

function hasTypedReference(refs, domain, value) {
  return (typeof value === 'string' || Number.isFinite(value))
    && refs.has(typedReferenceKey(domain, value));
}

function addRequirementReferences(requirement, refs) {
  addTypedReference(refs, REFERENCE_DOMAINS.REQUIREMENT, requirement.id);
  addTypedReference(refs, REFERENCE_DOMAINS.REGION, requirement.targetRegionRef);
}

function addDeclaredInteractionReferences(interaction, refs) {
  addTypedReference(refs, REFERENCE_DOMAINS.RELATION, interaction.relationId);
  addTypedReference(refs, REFERENCE_DOMAINS.INTERFACE, interaction.interfaceId);
}

function addRegionReferences(region, refs) {
  addTypedReference(refs, REFERENCE_DOMAINS.REGION, region.regionId);
  if (region.ownerRef?.kind === 'element') {
    addTypedReference(refs, REFERENCE_DOMAINS.ELEMENT, region.ownerRef.id);
  }
  if (region.ownerRef?.kind === 'roofBoundary') {
    addTypedReference(refs, REFERENCE_DOMAINS.ROOF_GEOMETRY, region.ownerRef.roofGeometryId);
    addTypedReference(refs, REFERENCE_DOMAINS.BOUNDARY, region.ownerRef.boundaryId);
  }
  for (const boundary of region.topologicalBoundaries || []) {
    addTypedReference(refs, REFERENCE_DOMAINS.TOPOLOGY_NODE, boundary.nodeId);
  }
  addTypedReferenceList(refs, REFERENCE_DOMAINS.OPENING, region.activeOpenings);
  addTypedReferenceList(refs, REFERENCE_DOMAINS.REQUIREMENT, region.requirementRefs);
  for (const interaction of region.declaredInteractions || []) {
    addDeclaredInteractionReferences(interaction, refs);
  }
}

function addPathReferences(path, refs) {
  addTypedReference(refs, REFERENCE_DOMAINS.PATH, path.pathId);
  if (!isRecord(path.sourceRefs)) return;
  addTypedReference(refs, REFERENCE_DOMAINS.PROPOSAL, path.sourceRefs.proposalId);
  addTypedReference(refs, REFERENCE_DOMAINS.RELATION, path.sourceRefs.relationId);
  addTypedReference(refs, REFERENCE_DOMAINS.ROOF_GEOMETRY, path.sourceRefs.roofGeometryId);
  addTypedReference(refs, REFERENCE_DOMAINS.ELEMENT, path.sourceRefs.targetElementId);
  addTypedReference(refs, REFERENCE_DOMAINS.BOUNDARY, path.sourceRefs.boundaryId);
}

function addSupportTransferReferences(entity, refs, identityDomain) {
  addTypedReference(refs, identityDomain, entity.id);
  addTypedReferenceList(refs, REFERENCE_DOMAINS.REGION, entity.targetRegionRefs);
  if (entity.provenance === 'declaredRelation') {
    addTypedReferenceList(refs, REFERENCE_DOMAINS.INTERFACE, entity.fromRefs);
    addTypedReferenceList(refs, REFERENCE_DOMAINS.INTERFACE, entity.toRefs);
  } else if (entity.provenance === 'candidatePath') {
    addTypedReferenceList(refs, REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, entity.fromRefs);
    addTypedReferenceList(refs, REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, entity.toRefs);
  }
}

function sameTypedReference(left, right) {
  return isRecord(left)
    && isRecord(right)
    && left.domain === right.domain
    && idToken(left.value) === idToken(right.value);
}

function typedReferences(values) {
  const refs = new Map();
  for (const value of values) addTypedReference(refs, value.domain, value.value);
  return refs;
}

function contextCanonicalSha256Valid(context) {
  if (typeof context?.canonicalSha256 !== 'string') return false;
  const payload = cloneJson(context);
  delete payload.canonicalSha256;
  return fingerprint(canonicalizeValue(payload)) === context.canonicalSha256;
}

function resolutionContextValid(structuralRequirements, context) {
  return isRecord(context)
    && context.schema === STRUCTURAL_REFERENCE_RESOLUTION_CONTEXT_SCHEMA
    && structuralRequirements.schema === REQUIREMENTS_SCHEMA
    && context.sourceSchema === structuralRequirements.schema
    && Array.isArray(context.referenceBindings)
    && Array.isArray(context.targets)
    && Array.isArray(context.provenanceRelations)
    && context.sourceRequirementsSha256 === structuralRequirementsFingerprint(structuralRequirements)
    && contextCanonicalSha256Valid(context);
}

function targetActuallyResolvable(structuralRequirements, contextTargets, ref) {
  if (!hasTypedReference(contextTargets, ref.domain, ref.value)) return false;
  if (ref.domain === REFERENCE_DOMAINS.PATH) {
    return [...structuralRequirements.gravityPaths, ...structuralRequirements.lateralPaths]
      .some((path) => idToken(path.pathId) === idToken(ref.value));
  }
  if (ref.domain === REFERENCE_DOMAINS.REQUIREMENT) {
    return structuralRequirements.requirements.some((item) => idToken(item.id) === idToken(ref.value));
  }
  if (ref.domain === REFERENCE_DOMAINS.REGION) {
    return structuralRequirements.regions.some((item) => idToken(item.regionId) === idToken(ref.value));
  }
  if (ref.domain === REFERENCE_DOMAINS.SUPPORT) {
    return structuralRequirements.supports.some((item) => idToken(item.id) === idToken(ref.value));
  }
  if (ref.domain === REFERENCE_DOMAINS.TRANSFER) {
    return structuralRequirements.transfers.some((item) => idToken(item.id) === idToken(ref.value));
  }
  return true;
}

function originMatches(binding, spec) {
  const origin = binding?.origin;
  if (!isRecord(origin)
    || origin.entityType !== spec.entityType
    || idToken(origin.entityId) !== idToken(spec.entityId)
    || origin.field !== spec.field) return false;
  if (spec.relationId !== undefined && idToken(origin.relationId) !== idToken(spec.relationId)) return false;
  if (spec.interfaceId !== undefined && idToken(origin.interfaceId) !== idToken(spec.interfaceId)) return false;
  return true;
}

function bindingOccurrenceKey(binding) {
  const origin = binding?.origin || {};
  return `${origin.entityType}|${idToken(origin.entityId)}|${origin.field}|${String(origin.occurrenceKey ?? '')}`;
}

function allowedBindingDomain(spec, domain) {
  if (spec.entityType === 'requirement') {
    return [
      REFERENCE_DOMAINS.RELATION,
      REFERENCE_DOMAINS.INTERFACE,
      REFERENCE_DOMAINS.ELEMENT_INTENT,
      REFERENCE_DOMAINS.PATH,
      REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE
    ].includes(domain);
  }
  if (spec.entityType === 'declaredInteraction') {
    return [REFERENCE_DOMAINS.RELATION, REFERENCE_DOMAINS.INTERFACE].includes(domain);
  }
  if (spec.field === 'fromRefs' || spec.field === 'toRefs') {
    return spec.provenance === 'declaredRelation'
      ? domain === REFERENCE_DOMAINS.INTERFACE
      : spec.provenance === 'candidatePath'
        ? domain === REFERENCE_DOMAINS.CANDIDATE_PATH_NODE
        : false;
  }
  if (spec.field === 'sourceRefs') {
    return spec.provenance === 'declaredRelation'
      ? [REFERENCE_DOMAINS.RELATION, REFERENCE_DOMAINS.INTERFACE].includes(domain)
      : spec.provenance === 'candidatePath'
        ? domain === REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE
        : false;
  }
  return false;
}

function addResolutionDiagnostic(state, code, spec, values = []) {
  state.diagnostics.push(diagnostic(
    code,
    `$.referenceResolutionContext.${spec.entityType}.${String(spec.entityId)}.${spec.field}`,
    values
  ));
}

function validEdgeMemberships(state, edgeRef) {
  const relations = state.context.provenanceRelations.filter((relation) => (
    relation?.kind === 'candidateEdgeMemberOfPath'
    && sameTypedReference(relation.from, edgeRef)
  ));
  const valid = [];
  for (const relation of relations) {
    if (relation.from?.domain !== REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE
      || relation.to?.domain !== REFERENCE_DOMAINS.PATH) {
      addResolutionDiagnostic(state, CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH, {
        entityType: 'candidatePathEdge', entityId: edgeRef.value, field: 'candidateEdgeMemberOfPath'
      }, [edgeRef.value]);
      continue;
    }
    if (!targetActuallyResolvable(state.structuralRequirements, state.contextTargets, relation.to)) {
      addResolutionDiagnostic(state, CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_TARGET_UNRESOLVED, {
        entityType: 'candidatePathEdge', entityId: edgeRef.value, field: 'candidateEdgeMemberOfPath'
      }, [relation.to.value]);
      continue;
    }
    valid.push(relation);
  }
  return valid;
}

function applyRequiredBindings(state, spec, values) {
  const expectedFrom = { domain: spec.fromDomain, value: spec.entityId };
  for (const legacyValue of values || []) {
    const matches = state.context.referenceBindings.filter((binding) => (
      originMatches(binding, spec)
      && idToken(binding.legacyValue) === idToken(legacyValue)
    ));
    if (matches.length === 0) {
      addResolutionDiagnostic(
        state,
        CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_UNRESOLVED,
        spec,
        [legacyValue]
      );
      continue;
    }
    const byOccurrence = new Map();
    for (const binding of matches) {
      const key = bindingOccurrenceKey(binding);
      if (!byOccurrence.has(key)) byOccurrence.set(key, []);
      byOccurrence.get(key).push(binding);
    }
    for (const occurrence of byOccurrence.values()) {
      const targetKeys = new Set(occurrence.map((binding) => (
        isRecord(binding.to) ? typedReferenceKey(binding.to.domain, binding.to.value) : 'invalid'
      )));
      if (targetKeys.size !== 1) {
        addResolutionDiagnostic(
          state,
          CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_DOMAIN_AMBIGUOUS,
          spec,
          [legacyValue]
        );
        continue;
      }
      if (occurrence.some((binding) => binding.legacyValue !== String(binding.to?.value))) {
        addResolutionDiagnostic(
          state,
          CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH,
          spec,
          [legacyValue]
        );
        continue;
      }
      const binding = occurrence[0];
      if (!sameTypedReference(binding.from, expectedFrom)
        || !allowedBindingDomain(spec, binding.to?.domain)) {
        addResolutionDiagnostic(
          state,
          CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_PROVENANCE_MISMATCH,
          spec,
          [legacyValue]
        );
        continue;
      }
      if (!targetActuallyResolvable(state.structuralRequirements, state.contextTargets, binding.to)) {
        addResolutionDiagnostic(
          state,
          CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_TARGET_UNRESOLVED,
          spec,
          [legacyValue]
        );
        continue;
      }
      addTypedReference(state.refs, binding.to.domain, binding.to.value);
      addTypedReference(state.pathSelectorRefs, binding.to.domain, binding.to.value);
      if (spec.entityType === 'requirement'
        && [REFERENCE_DOMAINS.PATH, REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE].includes(binding.to.domain)) {
        state.hasContractualPathSelector = true;
      }
      if (binding.to.domain === REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE) {
        const memberships = validEdgeMemberships(state, binding.to);
        if (memberships.length === 0) {
          addResolutionDiagnostic(
            state,
            CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_LINK_UNRESOLVED,
            spec,
            [legacyValue]
          );
        } else {
          for (const relation of memberships) {
            addTypedReference(state.refs, relation.to.domain, relation.to.value);
            addTypedReference(state.pathSelectorRefs, relation.to.domain, relation.to.value);
          }
        }
      }
    }
  }
}

function bindingRefsForEntity(state, spec) {
  return state.context.referenceBindings
    .filter((binding) => (
      binding?.origin?.entityType === spec.entityType
      && idToken(binding.origin.entityId) === idToken(spec.entityId)
      && sameTypedReference(binding.from, { domain: spec.fromDomain, value: spec.entityId })
    ))
    .map((binding) => binding.to)
    .filter(isRecord);
}

function entityIsReachable(entity, refs, extractReferences, identityDomain, contextRefs = []) {
  const entityRefs = new Map();
  extractReferences(entity, entityRefs, identityDomain);
  for (const ref of contextRefs) addTypedReference(entityRefs, ref.domain, ref.value);
  return [...entityRefs.values()].some((ref) => hasTypedReference(refs, ref.domain, ref.value));
}

function processRegion(state, region) {
  addRegionReferences(region, state.refs);
  addRegionReferences(region, state.pathSelectorRefs);
  if ((region.candidateEvidenceRefs || []).length > 0) {
    addResolutionDiagnostic(state, CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_RESERVED_UNSUPPORTED, {
      entityType: 'region', entityId: region.regionId, field: 'candidateEvidenceRefs'
    }, region.candidateEvidenceRefs);
  }
  for (const interaction of region.declaredInteractions || []) {
    applyRequiredBindings(state, {
      entityType: 'declaredInteraction',
      entityId: region.regionId,
      field: 'sourceRefs',
      relationId: interaction.relationId,
      interfaceId: interaction.interfaceId,
      fromDomain: REFERENCE_DOMAINS.REGION
    }, interaction.sourceRefs || []);
  }
}

function processSupportTransfer(state, entity, entityType, identityDomain) {
  addSupportTransferReferences(entity, state.refs, identityDomain);
  addSupportTransferReferences(entity, state.pathSelectorRefs, identityDomain);
  for (const regionRef of entity.targetRegionRefs || []) state.regionIds.add(regionRef);
  const base = {
    entityType,
    entityId: entity.id,
    fromDomain: identityDomain,
    provenance: entity.provenance
  };
  applyRequiredBindings(state, { ...base, field: 'sourceRefs' }, entity.sourceRefs || []);
  applyRequiredBindings(state, { ...base, field: 'fromRefs' }, entity.fromRefs || []);
  applyRequiredBindings(state, { ...base, field: 'toRefs' }, entity.toRefs || []);
}

function createResolutionState(structuralRequirements, referenceResolutionContext) {
  return {
    structuralRequirements,
    context: referenceResolutionContext,
    contextTargets: typedReferences(referenceResolutionContext.targets || []),
    refs: new Map(),
    pathSelectorRefs: new Map(),
    diagnostics: [],
    regionIds: new Set(),
    hasContractualPathSelector: false
  };
}

function resolveClosureEntities(structuralRequirements, selectedRequirements, referenceResolutionContext) {
  const regionById = new Map(structuralRequirements.regions.map((item) => [item.regionId, item]));
  const state = createResolutionState(structuralRequirements, referenceResolutionContext);
  for (const requirement of selectedRequirements) {
    addRequirementReferences(requirement, state.refs);
    addRequirementReferences(requirement, state.pathSelectorRefs);
    if (requirement.targetRegionRef) state.regionIds.add(requirement.targetRegionRef);
    applyRequiredBindings(state, {
      entityType: 'requirement',
      entityId: requirement.id,
      field: 'sourceRefs',
      fromDomain: REFERENCE_DOMAINS.REQUIREMENT
    }, requirement.sourceRefs || []);
  }
  const selectedPathIds = new Set();
  const selectedSupportIds = new Set();
  const selectedTransferIds = new Set();
  const processedRegionIds = new Set();
  const processedSupportIds = new Set();
  const processedTransferIds = new Set();
  const pathCandidates = [...structuralRequirements.gravityPaths, ...structuralRequirements.lateralPaths];

  let changed;
  do {
    const sizeBefore = state.regionIds.size + state.refs.size + selectedPathIds.size
      + selectedSupportIds.size + selectedTransferIds.size;
    for (const regionId of state.regionIds) {
      const region = regionById.get(regionId);
      if (region && !processedRegionIds.has(regionId)) {
        processedRegionIds.add(regionId);
        processRegion(state, region);
      }
    }
    for (const path of pathCandidates) {
      const exactPathReached = hasTypedReference(state.pathSelectorRefs, REFERENCE_DOMAINS.PATH, path.pathId);
      const fallbackReached = !state.hasContractualPathSelector
        && entityIsReachable(path, state.pathSelectorRefs, addPathReferences);
      if (selectedPathIds.has(path.pathId) || exactPathReached || fallbackReached) {
        selectedPathIds.add(path.pathId);
        addPathReferences(path, state.refs);
      }
    }
    for (const support of structuralRequirements.supports) {
      const spec = {
        entityType: 'support', entityId: support.id, field: 'sourceRefs',
        fromDomain: REFERENCE_DOMAINS.SUPPORT
      };
      if (selectedSupportIds.has(support.id) || entityIsReachable(
        support,
        state.refs,
        addSupportTransferReferences,
        REFERENCE_DOMAINS.SUPPORT,
        bindingRefsForEntity(state, spec)
      )) {
        selectedSupportIds.add(support.id);
        if (!processedSupportIds.has(support.id)) {
          processedSupportIds.add(support.id);
          processSupportTransfer(state, support, 'support', REFERENCE_DOMAINS.SUPPORT);
        }
      }
    }
    for (const transfer of structuralRequirements.transfers) {
      const spec = {
        entityType: 'transfer', entityId: transfer.id, field: 'sourceRefs',
        fromDomain: REFERENCE_DOMAINS.TRANSFER
      };
      if (selectedTransferIds.has(transfer.id) || entityIsReachable(
        transfer,
        state.refs,
        addSupportTransferReferences,
        REFERENCE_DOMAINS.TRANSFER,
        bindingRefsForEntity(state, spec)
      )) {
        selectedTransferIds.add(transfer.id);
        if (!processedTransferIds.has(transfer.id)) {
          processedTransferIds.add(transfer.id);
          processSupportTransfer(state, transfer, 'transfer', REFERENCE_DOMAINS.TRANSFER);
        }
      }
    }
    const sizeAfter = state.regionIds.size + state.refs.size + selectedPathIds.size
      + selectedSupportIds.size + selectedTransferIds.size;
    changed = sizeAfter > sizeBefore;
  } while (changed);

  return {
    regionById,
    regionIds: state.regionIds,
    sourceRefs: state.refs,
    diagnostics: canonicalDiagnostics(state.diagnostics),
    selectedRegions: [...state.regionIds].map((id) => regionById.get(id)).filter(Boolean),
    selectedPaths: pathCandidates.filter((item) => selectedPathIds.has(item.pathId)),
    selectedSupports: structuralRequirements.supports.filter((item) => selectedSupportIds.has(item.id)),
    selectedTransfers: structuralRequirements.transfers.filter((item) => selectedTransferIds.has(item.id))
  };
}

function canonicalOwnerRefs(values) {
  const byValue = new Map();
  for (const value of values) {
    const canonical = canonicalizeValue(cloneJson(value));
    byValue.set(JSON.stringify(canonical), canonical);
  }
  return [...byValue.values()].sort((left, right) => (
    compareText(JSON.stringify(left), JSON.stringify(right))
  ));
}

function canonicalTraceUnion(traces) {
  const byRequirementId = new Map();
  for (const trace of traces) byRequirementId.set(trace.requirementId, cloneJson(trace));
  return [...byRequirementId.values()].sort(compareById('requirementId'));
}

function canonicalUnionOfIndividualClosures(closures) {
  const sourceRefs = typedReferences(closures.flatMap((closure) => closure.sourceRefs));
  return canonicalizeValue({
    schema: CONSTRUCTIVE_SCOPE_CLOSURE_SCHEMA,
    scopeDeterminate: closures.every((closure) => closure.scopeDeterminate),
    requirementIds: uniqueText(closures.flatMap((closure) => closure.requirementIds)),
    regionIds: uniqueText(closures.flatMap((closure) => closure.regionIds)),
    ownerRefs: canonicalOwnerRefs(closures.flatMap((closure) => closure.ownerRefs)),
    sourceRefs: [...sourceRefs.values()]
      .sort((left, right) => compareText(left.domain, right.domain) || compareIds(left.value, right.value)),
    pathRefs: uniqueText(closures.flatMap((closure) => closure.pathRefs)),
    supportRefs: uniqueText(closures.flatMap((closure) => closure.supportRefs)),
    transferRefs: uniqueText(closures.flatMap((closure) => closure.transferRefs)),
    governingRefs: {
      roofGeometryIds: uniqueIds(closures.flatMap((closure) => closure.governingRefs.roofGeometryIds)),
      elementIds: uniqueIds(closures.flatMap((closure) => closure.governingRefs.elementIds)),
      relationIds: uniqueIds(closures.flatMap((closure) => closure.governingRefs.relationIds)),
      interfaceIds: uniqueIds(closures.flatMap((closure) => closure.governingRefs.interfaceIds)),
      pathIds: uniqueIds(closures.flatMap((closure) => closure.governingRefs.pathIds))
    },
    traces: canonicalTraceUnion(closures.flatMap((closure) => closure.traces)),
    resolutionDiagnostics: canonicalDiagnostics(
      closures.flatMap((closure) => closure.resolutionDiagnostics)
    )
  });
}

export function buildConstructiveScopeClosure(
  structuralRequirements,
  requirementIds,
  referenceResolutionContext
) {
  if (!requirementsShapeValid(structuralRequirements)) {
    throw new ConstructiveScenarioContextError(
      CONSTRUCTIVE_CONTEXT_REASON_CODES.STRUCTURAL_REQUIREMENTS_INVALID,
      'structuralRequirements no cumple structural-requirements-v1.0.'
    );
  }
  const requestedIds = uniqueText(requirementIds || []);
  const requirementById = new Map(structuralRequirements.requirements.map((item) => [item.id, item]));
  const selectedRequirements = requestedIds.map((id) => requirementById.get(id)).filter(Boolean);
  if (!resolutionContextValid(structuralRequirements, referenceResolutionContext)) {
    return canonicalizeValue({
      schema: CONSTRUCTIVE_SCOPE_CLOSURE_SCHEMA,
      scopeDeterminate: false,
      requirementIds: requestedIds,
      regionIds: [],
      ownerRefs: [],
      sourceRefs: [],
      pathRefs: [],
      supportRefs: [],
      transferRefs: [],
      governingRefs: refCollections(),
      traces: [],
      resolutionDiagnostics: [diagnostic(
        CONSTRUCTIVE_CONTEXT_REASON_CODES.SCOPE_REF_CONTEXT_MISMATCH,
        '$.referenceResolutionContext'
      )]
    });
  }
  if (requestedIds.length > 1) {
    return canonicalUnionOfIndividualClosures(requestedIds.map((requirementId) => (
      buildConstructiveScopeClosure(
        structuralRequirements,
        [requirementId],
        referenceResolutionContext
      )
    )));
  }
  const resolved = resolveClosureEntities(
    structuralRequirements,
    selectedRequirements,
    referenceResolutionContext
  );
  const {
    regionById,
    sourceRefs,
    diagnostics,
    selectedRegions,
    selectedPaths,
    selectedSupports,
    selectedTransfers
  } = resolved;

  const governing = refCollections();
  for (const region of selectedRegions) {
    if (region.ownerRef?.kind === 'element') governing.elementIds.push(region.ownerRef.id);
    for (const interaction of region.declaredInteractions || []) {
      if (interaction.relationId) governing.relationIds.push(interaction.relationId);
      if (interaction.interfaceId) governing.interfaceIds.push(interaction.interfaceId);
    }
  }
  for (const path of selectedPaths) registerTypedPathRefs(governing, path);

  const traces = selectedRequirements.map((requirement) => {
    const requirementClosure = resolveClosureEntities(
      structuralRequirements,
      [requirement],
      referenceResolutionContext
    );
    return {
      requirementId: requirement.id,
      targetRegionRef: requirement.targetRegionRef ?? null,
      ownerRef: cloneJson(regionById.get(requirement.targetRegionRef)?.ownerRef ?? null),
      sourceRefs: [...requirementClosure.sourceRefs.values()]
        .sort((left, right) => compareText(left.domain, right.domain) || compareIds(left.value, right.value)),
      pathRefs: uniqueText(requirementClosure.selectedPaths.map((item) => item.pathId)),
      supportRefs: uniqueText(requirementClosure.selectedSupports.map((item) => item.id)),
      transferRefs: uniqueText(requirementClosure.selectedTransfers.map((item) => item.id))
    };
  }).sort(compareById('requirementId'));

  return canonicalizeValue({
    schema: CONSTRUCTIVE_SCOPE_CLOSURE_SCHEMA,
    scopeDeterminate: diagnostics.length === 0,
    requirementIds: requestedIds,
    regionIds: uniqueText(selectedRegions.map((item) => item.regionId)),
    ownerRefs: selectedRegions.map((item) => cloneJson(item.ownerRef))
      .sort((left, right) => compareText(`${left.kind}:${idToken(left.id)}`, `${right.kind}:${idToken(right.id)}`)),
    sourceRefs: [...sourceRefs.values()]
      .sort((left, right) => compareText(left.domain, right.domain) || compareIds(left.value, right.value)),
    pathRefs: uniqueText(selectedPaths.map((item) => item.pathId)),
    supportRefs: uniqueText(selectedSupports.map((item) => item.id)),
    transferRefs: uniqueText(selectedTransfers.map((item) => item.id)),
    governingRefs: {
      roofGeometryIds: uniqueIds(governing.roofGeometryIds),
      elementIds: uniqueIds(governing.elementIds),
      relationIds: uniqueIds(governing.relationIds),
      interfaceIds: uniqueIds(governing.interfaceIds),
      pathIds: uniqueIds(governing.pathIds)
    },
    traces,
    resolutionDiagnostics: diagnostics
  });
}

function unresolvedBlockerEvidence(decision, closure) {
  return canonicalizeValue({
    blockingDecisionId: decision.decisionId,
    code: decision.code,
    domain: null,
    blockerRefs: [],
    scopeRefs: [],
    intersection: [],
    proof: 'typed-reference-closure-unresolved',
    sourceRefs: uniqueText(decision.sourceRefs || []),
    closureRef: closure.schema
  });
}

function classifyBlocker(decision, closure) {
  const scope = isRecord(decision.scope) ? decision.scope : {};
  const domains = Object.keys(SUPPORTED_BLOCKER_DOMAINS).filter((key) => hasOwn(scope, key));
  const unknownKeys = Object.keys(scope).filter((key) => !hasOwn(SUPPORTED_BLOCKER_DOMAINS, key));
  if (domains.length !== 1 || unknownKeys.length > 0) {
    return { classification: 'relevant', unresolved: true, evidence: unresolvedBlockerEvidence(decision, closure) };
  }
  const domain = domains[0];
  const blockerRefs = uniqueIds([scope[domain]]);
  const scopeRefs = uniqueIds(closure.governingRefs[SUPPORTED_BLOCKER_DOMAINS[domain]] || []);
  if (blockerRefs.length !== 1 || scopeRefs.length === 0) {
    return { classification: 'relevant', unresolved: true, evidence: unresolvedBlockerEvidence(decision, closure) };
  }
  const scopeTokens = new Set(scopeRefs.map(idToken));
  const intersection = blockerRefs.filter((ref) => scopeTokens.has(idToken(ref)));
  const excluded = intersection.length === 0;
  return {
    classification: excluded ? 'excluded' : 'relevant',
    unresolved: false,
    evidence: canonicalizeValue({
      blockingDecisionId: decision.decisionId,
      code: decision.code,
      domain,
      blockerRefs,
      scopeRefs,
      intersection,
      proof: excluded ? 'typed-disjoint-reference-closure' : 'typed-intersecting-reference-closure',
      sourceRefs: uniqueText(decision.sourceRefs || [])
    })
  };
}

function globalBlockerEvidence(decision) {
  return canonicalizeValue({
    blockingDecisionId: decision.decisionId,
    code: decision.code,
    domain: 'globalEligibility',
    blockerRefs: uniqueText(decision.sourceRefs || []),
    scopeRefs: [],
    intersection: [],
    proof: 'global-eligibility-authority',
    sourceRefs: uniqueText(decision.sourceRefs || [])
  });
}

export function evaluateConstructiveScopeEligibility(
  structuralRequirements,
  scope,
  referenceResolutionContext
) {
  const reasonCodes = [];
  if (!requirementsShapeValid(structuralRequirements)) {
    return {
      schema: CONSTRUCTIVE_SCOPE_ELIGIBILITY_SCHEMA,
      eligible: false,
      effectiveRequirementIds: [],
      scopeClosure: null,
      relevantBlockingDecisions: [],
      excludedBlockingDecisions: [],
      reasonCodes: [CONSTRUCTIVE_CONTEXT_REASON_CODES.STRUCTURAL_REQUIREMENTS_INVALID]
    };
  }
  const requirementById = new Map(structuralRequirements.requirements.map((item) => [item.id, item]));
  let effectiveRequirementIds = [];
  if (scope?.mode === 'all') {
    effectiveRequirementIds = uniqueText([...requirementById.keys()]);
  } else if (scope?.mode === 'requirements' && Array.isArray(scope.requirementIds)) {
    for (const id of uniqueText(scope.requirementIds)) {
      if (requirementById.has(id)) effectiveRequirementIds.push(id);
      else reasonCodes.push(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_NOT_FOUND);
    }
  } else {
    reasonCodes.push(CONSTRUCTIVE_CONTEXT_REASON_CODES.EMPTY_EFFECTIVE_SCOPE);
  }
  effectiveRequirementIds = uniqueText(effectiveRequirementIds);
  if (effectiveRequirementIds.length === 0) reasonCodes.push(CONSTRUCTIVE_CONTEXT_REASON_CODES.EMPTY_EFFECTIVE_SCOPE);
  const closure = buildConstructiveScopeClosure(
    structuralRequirements,
    effectiveRequirementIds,
    referenceResolutionContext
  );
  reasonCodes.push(...closure.resolutionDiagnostics.map((item) => item.code));
  for (const id of effectiveRequirementIds) {
    const requirement = requirementById.get(id);
    if (!requirement?.targetRegionRef
      || !structuralRequirements.regions.some((region) => region.regionId === requirement.targetRegionRef)) {
      reasonCodes.push(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED);
    }
  }

  const relevantBlockingDecisions = [];
  const excludedBlockingDecisions = [];
  if (scope?.mode === 'all') {
    for (const decision of structuralRequirements.blockingDecisions) {
      relevantBlockingDecisions.push(globalBlockerEvidence(decision));
    }
    if (!structuralRequirements.eligibility.eligibleForConstructiveSolutions) {
      reasonCodes.push(CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_RELEVANT);
    }
  } else {
    for (const decision of structuralRequirements.blockingDecisions) {
      const classified = classifyBlocker(decision, closure);
      if (classified.classification === 'excluded') excludedBlockingDecisions.push(classified.evidence);
      else {
        relevantBlockingDecisions.push(classified.evidence);
        reasonCodes.push(classified.unresolved
          ? CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_UNRESOLVED
          : CONSTRUCTIVE_CONTEXT_REASON_CODES.BLOCKING_DECISION_RELEVANT);
      }
    }
  }
  relevantBlockingDecisions.sort(compareById('blockingDecisionId'));
  excludedBlockingDecisions.sort(compareById('blockingDecisionId'));
  const canonicalReasonCodes = uniqueText(reasonCodes);
  return canonicalizeValue({
    schema: CONSTRUCTIVE_SCOPE_ELIGIBILITY_SCHEMA,
    eligible: canonicalReasonCodes.length === 0,
    effectiveRequirementIds,
    scopeClosure: closure,
    relevantBlockingDecisions,
    excludedBlockingDecisions,
    reasonCodes: canonicalReasonCodes
  });
}

function validateLibrary(scenario, libraryContext, diagnostics) {
  if (!isRecord(libraryContext)
    || libraryContext.schema !== CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA
    || libraryContext.libraryId !== scenario.libraryRef?.libraryId
    || libraryContext.libraryVersion !== scenario.libraryRef?.libraryVersion
    || libraryContext.sha256 !== scenario.libraryRef?.sha256
    || !Array.isArray(libraryContext.componentTypes)) {
    diagnostics.push(diagnostic(
      CONSTRUCTIVE_CONTEXT_REASON_CODES.LIBRARY_NOT_AVAILABLE,
      '$.libraryContext',
      [scenario.libraryRef?.libraryId, scenario.libraryRef?.libraryVersion]
    ));
    return;
  }
  const componentIds = new Set(libraryContext.componentTypes.map((item) => item?.componentTypeId));
  scenario.assignments.forEach((assignment, index) => {
    if (!componentIds.has(assignment.choiceRef?.componentTypeId)) {
      diagnostics.push(diagnostic(
        CONSTRUCTIVE_CONTEXT_REASON_CODES.COMPONENT_TYPE_NOT_FOUND,
        `$.scenario.assignments[${index}].choiceRef.componentTypeId`,
        [assignment.assignmentId, assignment.choiceRef?.componentTypeId]
      ));
    }
  });
}

export function evaluateConstructiveScenarioContext({
  scenario,
  structuralRequirements,
  referenceResolutionContext,
  geometry,
  libraryContext
}) {
  const scopeEligibility = evaluateConstructiveScopeEligibility(
    structuralRequirements,
    scenario?.scope,
    referenceResolutionContext
  );
  const diagnostics = scopeEligibility.reasonCodes.map((code) => diagnostic(code, '$.scenario.scope'));
  const requirementById = new Map((structuralRequirements?.requirements || []).map((item) => [item.id, item]));
  const regionById = new Map((structuralRequirements?.regions || []).map((item) => [item.regionId, item]));
  const scopeIds = new Set(scopeEligibility.effectiveRequirementIds);
  if (isRecord(scenario) && Array.isArray(scenario.assignments)) {
    scenario.assignments.forEach((assignment, index) => {
      const path = `$.scenario.assignments[${index}]`;
      const requirement = requirementById.get(assignment.requirementRef);
      if (!requirement) diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_NOT_FOUND, `${path}.requirementRef`, [assignment.requirementRef]));
      else if (!scopeIds.has(assignment.requirementRef)) diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.REQUIREMENT_OUTSIDE_SCOPE, `${path}.requirementRef`, [assignment.requirementRef]));
      if (requirement && assignment.targetRef?.kind === 'requirement' && assignment.targetRef.ref !== requirement.id) {
        diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_INCOMPATIBLE, `${path}.targetRef`, [assignment.targetRef.ref, requirement.id]));
      }
      if (requirement && assignment.targetRef?.kind === 'region') {
        const region = regionById.get(assignment.targetRef.ref);
        if (!region) diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED, `${path}.targetRef`, [assignment.targetRef.ref]));
        else if (requirement.targetRegionRef !== region.regionId || !region.requirementRefs?.includes(requirement.id)) {
          diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_INCOMPATIBLE, `${path}.targetRef`, [region.regionId, requirement.id]));
        }
      }
    });
    validateLibrary(scenario, libraryContext, diagnostics);
  }

  if (geometry?.schema !== GEOMETRY_SCHEMA || !Array.isArray(geometry.elements) || !Array.isArray(geometry.roofGeometry)) {
    diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED, '$.geometry'));
  } else if (scopeEligibility.scopeClosure) {
    const elementTokens = new Set(geometry.elements.map((item) => idToken(item.id)));
    const roofTokens = new Set(geometry.roofGeometry.map((item) => idToken(item.id)));
    for (const id of scopeEligibility.scopeClosure.governingRefs.elementIds) {
      if (!elementTokens.has(idToken(id))) diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED, '$.geometry.elements', [id]));
    }
    for (const id of scopeEligibility.scopeClosure.governingRefs.roofGeometryIds) {
      if (!roofTokens.has(idToken(id))) diagnostics.push(diagnostic(CONSTRUCTIVE_CONTEXT_REASON_CODES.TARGET_NOT_RESOLVED, '$.geometry.roofGeometry', [id]));
    }
  }
  const canonical = canonicalDiagnostics(diagnostics);
  return canonicalizeValue({
    schema: CONSTRUCTIVE_CONTEXT_EVALUATION_SCHEMA,
    contextuallyValid: canonical.length === 0,
    eligibleForEffectiveProjection: scopeEligibility.eligible && canonical.length === 0,
    scopeEligibility,
    diagnostics: canonical,
    reasonCodes: uniqueText(canonical.map((item) => item.code))
  });
}

function projectPoint(value) {
  return pick(value, ['x', 'y', 'z']);
}

function projectPrism(prism) {
  if (!isRecord(prism)) return null;
  const result = pick(prism, ['kind', 'thickness', 'height', 'width']);
  if (prism.start) result.start = projectPoint(prism.start);
  if (prism.end) result.end = projectPoint(prism.end);
  if (prism.min) result.min = projectPoint(prism.min);
  if (prism.max) result.max = projectPoint(prism.max);
  return result;
}

function projectElement(element) {
  const result = pick(element, ['id', 'type', 'kind']);
  if (element.prism) result.prism = projectPrism(element.prism);
  if (Array.isArray(element.openings)) {
    result.openings = element.openings.map((opening) => ({
      ...pick(opening, ['id', 'kind', 'hostWallId']),
      void: projectPrism(opening.void)
    })).sort(compareById('id'));
  }
  if (Array.isArray(element.solids)) {
    result.solids = element.solids.map((solid) => ({ role: solid.role, prism: projectPrism(solid.prism) }))
      .sort(compareById('role'));
  }
  return result;
}

function projectRoof(roof) {
  return {
    ...pick(roof, ['id', 'source']),
    surface: {
      kind: roof.surface?.kind,
      boundary: (roof.surface?.boundary || []).map(projectPoint)
    }
  };
}

function projectRequirement(requirement) {
  return pick(requirement, ['id', 'code', 'kind', 'graph', 'targetRegionRef', 'sourceRefs', 'evidence', 'verificationState']);
}

function projectRegion(region) {
  return pick(region, [
    'regionId', 'ownerRef', 'longitudinalLocation', 'zRange', 'topologicalBoundaries',
    'activeOpenings', 'declaredFunctions', 'declaredInteractions', 'candidateEvidenceRefs',
    'requirementRefs', 'verificationState'
  ]);
}

function projectPath(path) {
  return pick(path, ['graph', 'pathId', 'candidateState', 'confidence', 'sourceRefs', 'edgeKinds', 'findings', 'verificationState']);
}

function projectSupportTransfer(item) {
  return pick(item, [
    'id', 'graph', 'structuralFunction', 'fromRefs', 'toRefs', 'targetRegionRefs', 'evidence',
    'provenance', 'certainty', 'supportEvidence', 'verificationState', 'sourceRefs'
  ]);
}

export function projectEffectiveConstructiveInput({
  scenario,
  structuralRequirements,
  referenceResolutionContext,
  geometry,
  libraryContext
}) {
  const evaluation = evaluateConstructiveScenarioContext({
    scenario,
    structuralRequirements,
    referenceResolutionContext,
    geometry,
    libraryContext
  });
  if (!evaluation.eligibleForEffectiveProjection) {
    throw new ConstructiveScenarioContextError(
      'CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE',
      'El escenario no es contextualmente elegible para proyectar una entrada efectiva.',
      { evaluation }
    );
  }
  const closure = evaluation.scopeEligibility.scopeClosure;
  const requirementIds = new Set(evaluation.scopeEligibility.effectiveRequirementIds);
  const regionIds = new Set(closure.regionIds);
  const pathIds = new Set(closure.pathRefs);
  const supportIds = new Set(closure.supportRefs);
  const transferIds = new Set(closure.transferRefs);
  const elementTokens = new Set(closure.governingRefs.elementIds.map(idToken));
  const roofTokens = new Set(closure.governingRefs.roofGeometryIds.map(idToken));
  const selectedComponentTypeIds = new Set(scenario.assignments.map((item) => item.choiceRef.componentTypeId));
  const effectiveGeometry = {
    schema: EFFECTIVE_CONSTRUCTIVE_GEOMETRY_SCHEMA,
    units: pick(geometry.units, ['length']),
    coordinates: {
      type: geometry.coordinates?.type,
      handedness: geometry.coordinates?.handedness,
      axes: pick(geometry.coordinates?.axes, ['x', 'y', 'z'])
    },
    elements: geometry.elements.filter((item) => elementTokens.has(idToken(item.id))).map(projectElement)
      .sort((left, right) => compareIds(left.id, right.id)),
    roofGeometry: geometry.roofGeometry.filter((item) => roofTokens.has(idToken(item.id))).map(projectRoof)
      .sort((left, right) => compareIds(left.id, right.id))
  };
  const effectiveStructuralRequirements = {
    schema: EFFECTIVE_STRUCTURAL_REQUIREMENTS_SCHEMA,
    sourceSchema: structuralRequirements.schema,
    verification: { state: 'notVerified' },
    requirements: structuralRequirements.requirements.filter((item) => requirementIds.has(item.id)).map(projectRequirement).sort(compareById('id')),
    regions: structuralRequirements.regions.filter((item) => regionIds.has(item.regionId)).map(projectRegion).sort(compareById('regionId')),
    paths: [...structuralRequirements.gravityPaths, ...structuralRequirements.lateralPaths]
      .filter((item) => pathIds.has(item.pathId)).map(projectPath).sort(compareById('pathId')),
    supports: structuralRequirements.supports.filter((item) => supportIds.has(item.id)).map(projectSupportTransfer).sort(compareById('id')),
    transfers: structuralRequirements.transfers.filter((item) => transferIds.has(item.id)).map(projectSupportTransfer).sort(compareById('id')),
    relevantBlockingDecisionContext: cloneJson(evaluation.scopeEligibility.relevantBlockingDecisions),
    provenance: {
      closure: cloneJson(closure)
    }
  };
  return canonicalizeValue({
    schema: EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA,
    scenarioId: scenario.scenarioId,
    adapterRef: pick(scenario.adapterRef, ['adapterId', 'adapterVersion']),
    libraryRef: pick(scenario.libraryRef, ['libraryId', 'libraryVersion', 'sha256']),
    scope: scenario.scope.mode === 'requirements'
      ? { mode: 'requirements', requirementIds: uniqueText(scenario.scope.requirementIds) }
      : { mode: 'all' },
    configuration: cloneJson(scenario.configuration),
    assignments: cloneJson(scenario.assignments).sort(compareById('assignmentId')),
    library: {
      schema: libraryContext.schema,
      libraryId: libraryContext.libraryId,
      libraryVersion: libraryContext.libraryVersion,
      sha256: libraryContext.sha256,
      componentTypes: libraryContext.componentTypes
        .filter((item) => selectedComponentTypeIds.has(item.componentTypeId))
        .map((item) => pick(item, ['componentTypeId']))
        .sort(compareById('componentTypeId'))
    },
    effectiveGeometry,
    effectiveStructuralRequirements,
  });
}
