import { canonicalizeRoofBoundaries } from './roofStructuralIntent.js';
import {
  canonicalizeValue,
  compareIds,
  compareText,
  fingerprint,
  geometryIndexes,
  idToken,
  semanticId,
  sourceFingerprint,
  sourceFingerprints as legacySourceFingerprints
} from './structuralProposalCommon.js';
import {
  evaluateInterfaceFreshness,
  evaluateRelationFreshness,
  relationEndpoints,
  roofBoundaryLongitudinalRange
} from './structuralInterfaces.js';
import { canonicalizeStructuralIntent } from './structuralIntent.js';
import {
  canonicalizeStructuralProposalReviewLog,
  createEmptyStructuralProposalReviewLog
} from './structuralProposalReviews.js';
import {
  STRUCTURAL_REFERENCE_DOMAINS,
  createStructuralReferenceResolutionContext
} from './structuralReferenceResolutionContext.js';

export const STRUCTURAL_REQUIREMENTS_SCHEMA = 'structural-requirements-v1.0';
export const STRUCTURAL_REQUIREMENTS_SPEC_VERSION = 'SPEC-015-E-v1.0';
export const COMPLETED_TOPOLOGY_SPEC_VERSION = 'SPEC-14-v0.3+SPEC-015-E';
export const STRUCTURAL_VERIFICATION_STATE = 'notVerified';

const FULL_PHASES = Object.freeze(['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12']);
const STRUCTURAL_FUNCTION_EFFECT = Object.freeze({
  support: 'supportRequired',
  loadTransfer: 'loadTransferRequired',
  collectorAction: 'collectorActionRequired',
  diaphragmAction: 'diaphragmActionRequired',
  stabilization: 'stabilizationRequired'
});
const REQUIREMENT_CODE = Object.freeze({
  supportRequired: 'SR-SUPPORT-REQUIRED',
  loadTransferRequired: 'SR-LOAD-TRANSFER-REQUIRED',
  collectorActionRequired: 'SR-COLLECTOR-ACTION-REQUIRED',
  diaphragmActionRequired: 'SR-DIAPHRAGM-ACTION-REQUIRED',
  stabilizationRequired: 'SR-STABILIZATION-REQUIRED',
  gravityResistanceRequired: 'SR-GRAVITY-RESISTANCE-REQUIRED',
  inPlaneLateralResistanceRequired: 'SR-IN-PLANE-LATERAL-RESISTANCE-REQUIRED'
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function fail(message) {
  const error = new Error(message);
  error.name = 'StructuralRequirementsError';
  error.code = 'SR-INPUT-INVALID';
  throw error;
}

function finiteRange(range) {
  return Array.isArray(range) && range.length === 2 && range.every(Number.isFinite) && range[1] > range[0];
}

function overlapRange(a, b) {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return end > start ? [start, end] : null;
}

function ownerSortToken(ownerRef) {
  if (ownerRef?.kind === 'element') return `element:${idToken(ownerRef.id)}`;
  return `roofBoundary:${idToken(ownerRef?.roofGeometryId)}:${String(ownerRef?.boundaryId ?? '')}`;
}

function sourceRefs(...values) {
  return [...new Set(values.flat().filter((value) => value !== null && value !== undefined).map(String))].sort(compareText);
}

function resolutionRef(domain, value) {
  return { domain, value };
}

function resolutionOrigin(entityType, entityId, field, identity = {}) {
  return { entityType, entityId, field, ...identity };
}

function addResolutionTarget(capture, ref, origin) {
  if (!ref || (typeof ref.value !== 'string' && !Number.isFinite(ref.value))) return;
  capture.targets.push({ ...clone(ref), origin: clone(origin) });
}

function addResolutionBinding(capture, { origin, from, legacyValue, to, provenance = [] }) {
  const occurrenceId = semanticId('sr-ref-occurrence', {
    origin,
    from,
    legacyValue,
    to
  });
  capture.referenceBindings.push({
    occurrenceId,
    origin: clone(origin),
    from: clone(from),
    legacyValue,
    to: clone(to),
    provenance: clone(provenance)
  });
  addResolutionTarget(capture, to, origin);
}

function addLegacyResolutionBindings(capture, { origin, from, refs }) {
  for (const ref of refs) {
    addResolutionBinding(capture, {
      origin: { ...origin, occurrenceKey: `${ref.domain}|${idToken(ref.value)}` },
      from,
      legacyValue: String(ref.value),
      to: ref,
      provenance: [{ kind: 'producerTypedReference' }]
    });
  }
}

function requirementId(effect, graph, targetRegionRef, refs) {
  return semanticId('sr-requirement', { effect, graph, targetRegionRef, sourceRefs: refs });
}

function finding(code, severity, scope, refs, evidence = {}) {
  const normalizedRefs = sourceRefs(refs);
  return {
    findingId: semanticId('sr-finding', { code, scope, sourceRefs: normalizedRefs }),
    code,
    severity,
    scope,
    sourceRefs: normalizedRefs,
    evidence
  };
}

function blockingDecision(code, scope, refs) {
  const normalizedRefs = sourceRefs(refs);
  return {
    decisionId: semanticId('sr-decision', { code, scope, sourceRefs: normalizedRefs }),
    code,
    scope,
    sourceRefs: normalizedRefs
  };
}

function wallById(topology) {
  return new Map((topology.walls || []).map((wall) => [idToken(wall.id), wall]));
}

function rangeLocation(sRange) {
  return { kind: 'range', sRange: [...sRange] };
}

function endpointLocation(locator, wall) {
  if (!['lowS', 'highS'].includes(locator.end) || !finiteRange(locator.sRange)) return null;
  const anchorS = locator.end === 'lowS' ? wall.s0 : wall.s1;
  return {
    kind: 'end',
    end: locator.end,
    anchorS,
    localizationEnvelope: [...locator.sRange]
  };
}

function normalizeRegion(region) {
  if (!region || region.ownerRef?.kind !== 'element' || !finiteRange(region.zRange)) return null;
  if (region.longitudinalLocation?.kind === 'range' && finiteRange(region.longitudinalLocation.sRange)) {
    return { ownerRef: clone(region.ownerRef), longitudinalLocation: rangeLocation(region.longitudinalLocation.sRange), zRange: [...region.zRange] };
  }
  if (region.longitudinalLocation?.kind === 'end') {
    const location = region.longitudinalLocation;
    if (!['lowS', 'highS'].includes(location.end) || !Number.isFinite(location.anchorS) || !finiteRange(location.localizationEnvelope)) return null;
    return {
      ownerRef: clone(region.ownerRef),
      longitudinalLocation: {
        kind: 'end', end: location.end, anchorS: location.anchorS,
        localizationEnvelope: [...location.localizationEnvelope]
      },
      zRange: [...region.zRange]
    };
  }
  if (finiteRange(region.sRange)) {
    return { ownerRef: clone(region.ownerRef), longitudinalLocation: rangeLocation(region.sRange), zRange: [...region.zRange] };
  }
  return null;
}

function interfaceRegion(interfaceIntent, walls) {
  if (interfaceIntent?.ownerRef?.kind !== 'element') return null;
  const wall = walls.get(idToken(interfaceIntent.ownerRef.id));
  if (!wall) return null;
  const locator = interfaceIntent.locator || {};
  const zRange = locator.zRange ?? [wall.z0, wall.z1];
  if (!finiteRange(zRange)) return null;
  if (locator.kind === 'end') {
    const longitudinalLocation = endpointLocation(locator, wall);
    return longitudinalLocation ? { ownerRef: clone(interfaceIntent.ownerRef), longitudinalLocation, zRange: [...zRange] } : null;
  }
  const sRange = locator.sRange ?? [wall.s0, wall.s1];
  if (!finiteRange(sRange)) return null;
  return { ownerRef: clone(interfaceIntent.ownerRef), longitudinalLocation: rangeLocation(sRange), zRange: [...zRange] };
}

function wholeWallRegion(elementId, walls) {
  const wall = walls.get(idToken(elementId));
  return wall ? {
    ownerRef: { kind: 'element', id: elementId },
    longitudinalLocation: rangeLocation([wall.s0, wall.s1]),
    zRange: [wall.z0, wall.z1]
  } : null;
}

function regionGeometrySRange(region) {
  const location = region.longitudinalLocation;
  return location?.kind === 'end' ? location.localizationEnvelope : location?.sRange;
}

function regionSortS(region) {
  const location = region.longitudinalLocation;
  return location?.kind === 'end' ? location.anchorS : location?.sRange?.[0] ?? Number.POSITIVE_INFINITY;
}

function semanticLongitudinalLocation(region) {
  const location = region.longitudinalLocation;
  return location?.kind === 'end'
    ? { kind: 'end', end: location.end, anchorS: location.anchorS }
    : { kind: 'range', sRange: location.sRange };
}

function regionKey(region) {
  return JSON.stringify(canonicalizeValue({ ownerRef: region.ownerRef, longitudinalLocation: semanticLongitudinalLocation(region), zRange: region.zRange }));
}

function buildRegionBase(region, topology, walls) {
  const wall = walls.get(idToken(region.ownerRef.id));
  const tolerance = topology.config?.linearTolerance ?? 0.1;
  const zTolerance = topology.config?.levelTolerance ?? 0.1;
  const geometrySRange = regionGeometrySRange(region);
  const activeOpenings = (topology.openings || []).filter((opening) => (
    idToken(opening.hostWallId) === idToken(region.ownerRef.id)
    && overlapRange(geometrySRange, [opening.s0, opening.s1])
    && overlapRange(region.zRange, [opening.z0, opening.z1])
  )).map((opening) => opening.id).sort(compareIds);
  const topologicalBoundaries = (topology.nodes || []).filter((node) => {
    if (idToken(node.wallId) !== idToken(region.ownerRef.id)) return false;
    const s = wall.s0 + node.localS;
    if (region.longitudinalLocation.kind === 'end') return Math.abs(s - region.longitudinalLocation.anchorS) <= tolerance;
    return Math.abs(s - region.longitudinalLocation.sRange[0]) <= tolerance || Math.abs(s - region.longitudinalLocation.sRange[1]) <= tolerance;
  }).map((node) => ({ nodeId: node.id, nodeType: node.nodeType })).sort((a, b) => compareText(a.nodeId, b.nodeId));
  const zBands = (topology.relations || []).filter((relation) => (
    Array.isArray(relation.wallIds) && relation.wallIds.some((id) => idToken(id) === idToken(region.ownerRef.id))
  )).flatMap((relation) => relation.verticalBands || []).filter((band) => (
    band.z1 >= region.zRange[0] - zTolerance && band.z0 <= region.zRange[1] + zTolerance
  ));
  const longitudinalLocation = clone(region.longitudinalLocation);
  return {
    regionId: semanticId('sr-region', {
      ownerRef: region.ownerRef,
      longitudinalLocation: semanticLongitudinalLocation(region),
      zRange: region.zRange,
      topologicalBoundaries
    }),
    ownerRef: clone(region.ownerRef),
    longitudinalLocation,
    zRange: [...region.zRange],
    topologicalBoundaries,
    activeOpenings,
    zBands: canonicalizeValue(zBands),
    declaredFunctions: [],
    declaredInteractions: [],
    candidateEvidenceRefs: [],
    requirementRefs: [],
    verificationState: STRUCTURAL_VERIFICATION_STATE
  };
}

function addRegion(regionMap, region, topology, walls) {
  const normalized = normalizeRegion(region);
  if (!normalized) return null;
  const key = regionKey(normalized);
  if (!regionMap.has(key)) regionMap.set(key, buildRegionBase(normalized, topology, walls));
  return regionMap.get(key);
}

function deriveSourceFingerprints(input, roofIntents) {
  const structuralIntent = canonicalizeStructuralIntent(input.structuralIntent);
  const reviewLog = canonicalizeStructuralProposalReviewLog(
    input.structuralProposalReviews ?? createEmptyStructuralProposalReviewLog()
  );
  const result = {
    geometrySha256: sourceFingerprint(input.geometry),
    topologyR0R5Sha256: sourceFingerprint(input.topology),
    structuralIntentSha256: sourceFingerprint(structuralIntent),
    elementIntentsSha256: sourceFingerprint(structuralIntent.elementIntents || []),
    roofIntentsSha256: sourceFingerprint(roofIntents),
    intersectionIntentsSha256: sourceFingerprint(structuralIntent.intersectionIntents || []),
    supportIntentsSha256: sourceFingerprint(structuralIntent.supportIntents || []),
    interfaceIntentsSha256: sourceFingerprint(structuralIntent.interfaceIntents || []),
    relationIntentsSha256: sourceFingerprint(structuralIntent.relationIntents || []),
    diaphragmIntentsSha256: sourceFingerprint(structuralIntent.diaphragmIntents || []),
    overridesSha256: sourceFingerprint(structuralIntent.overrides || []),
    proposalSetSha256: sourceFingerprint(input.structuralProposals),
    proposalReviewLogSha256: sourceFingerprint(reviewLog),
    candidateLoadPathsSha256: sourceFingerprint(input.candidateLoadPaths)
  };
  result.aggregateSha256 = fingerprint(result);
  return result;
}

function roofCoverage(geometry, roofIntents) {
  const byId = new Map(roofIntents.map((intent) => [idToken(intent.roofGeometryId), intent]));
  return (geometry.roofGeometry || []).map((roof) => {
    const intent = byId.get(idToken(roof.id));
    let state = 'notDeclared';
    if (intent) {
      const functions = (intent.boundaryIntents || []).map((item) => item.function);
      const structuralBoundary = functions.some((value) => ['gravitySupport', 'lateralSupport', 'gravityAndLateralSupport'].includes(value));
      const nonStructural = functions.length > 0 && functions.every((value) => ['geometricBoundary', 'gutterSupport', 'nonStructuralBoundary'].includes(value));
      if (intent.diaphragmBehavior === 'intended' || structuralBoundary) state = 'declaredStructural';
      else if (intent.diaphragmBehavior === 'notIntended' && nonStructural) state = 'declaredNonStructural';
      else state = 'partial';
    }
    return { roofGeometryId: roof.id, state };
  }).sort((a, b) => compareIds(a.roofGeometryId, b.roofGeometryId));
}

function mapDeclaredFunctionToEffect(name) {
  if (name === 'gravityResistance') return 'gravityResistanceRequired';
  if (name === 'inPlaneLateralResistance') return 'inPlaneLateralResistanceRequired';
  return STRUCTURAL_FUNCTION_EFFECT[name] ?? null;
}

function pathProjection(path, graph, edges) {
  return {
    graph,
    pathId: path.pathId,
    candidateState: path.candidateState,
    confidence: path.confidence,
    sourceRefs: clone(path.sourceRefs || {}),
    edgeKinds: (path.edgeIds || []).map((id) => edges.get(id)?.kind).filter(Boolean),
    findings: [...(path.findings || [])],
    verificationState: STRUCTURAL_VERIFICATION_STATE
  };
}

function lateralState(candidateLoadPaths, roofIntents) {
  const paths = candidateLoadPaths.lateral?.paths || [];
  if (paths.length > 0) {
    const rank = ['completeCandidate', 'incompleteCandidate', 'blockedCandidate'];
    return rank.reduce((state, value) => paths.some((path) => path.candidateState === value) ? value : state, 'candidate');
  }
  const declared = roofIntents.some((intent) => intent.diaphragmBehavior === 'intended');
  return declared ? 'candidate' : 'notDeclared';
}

function buildStructuralRequirementsProduct(input) {
  if (!isRecord(input)) fail('La entrada debe ser un objeto.');
  if (input.geometry?.schema !== 'agnostic-geometry-v1.0') fail('geometry debe usar agnostic-geometry-v1.0.');
  if (input.topology?.schema !== 'recognized-structural-topology-v1.0') fail('topology debe usar recognized-structural-topology-v1.0.');
  if (JSON.stringify(input.topology.phasesExecuted) !== JSON.stringify(['R0', 'R1', 'R2', 'R3', 'R4', 'R5'])) fail('topology debe ser la salida R0–R5 congelada.');
  if (input.structuralIntent?.schema !== 'structural-intent-v1.1') fail('structuralIntent debe usar structural-intent-v1.1.');
  if (input.structuralProposals?.schema !== 'structural-proposals-v1.0') fail('structuralProposals debe usar structural-proposals-v1.0.');
  if (input.candidateLoadPaths?.schema !== 'candidate-load-paths-v1.0') fail('candidateLoadPaths debe usar candidate-load-paths-v1.0.');

  const topology = input.topology;
  const walls = wallById(topology);
  const roofIntents = [...(input.roofStructuralIntent ?? input.structuralIntent.roofIntents ?? [])]
    .sort((a, b) => compareIds(a.roofGeometryId, b.roofGeometryId));
  const interfaceIntents = input.structuralIntent.interfaceIntents || [];
  const relationIntents = input.structuralIntent.relationIntents || [];
  const interfaceById = new Map(interfaceIntents.map((item) => [item.interfaceId, item]));
  const elementIntentById = new Map((input.structuralIntent.elementIntents || []).map((item) => [idToken(item.elementId), item]));
  const regionMap = new Map();
  const findings = [];
  const decisions = [];
  const requirements = [];
  const supports = [];
  const transfers = [];
  const resolutionCapture = {
    referenceBindings: [],
    targets: [],
    provenanceRelations: []
  };

  for (const intent of input.structuralIntent.elementIntents || []) {
    addResolutionTarget(
      resolutionCapture,
      resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.ELEMENT_INTENT, intent.intentId),
      resolutionOrigin('elementIntent', intent.intentId, 'intentId')
    );
  }
  for (const iface of interfaceIntents) {
    addResolutionTarget(
      resolutionCapture,
      resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, iface.interfaceId),
      resolutionOrigin('interfaceIntent', iface.interfaceId, 'interfaceId')
    );
  }
  for (const relation of relationIntents) {
    addResolutionTarget(
      resolutionCapture,
      resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relation.relationId),
      resolutionOrigin('relationIntent', relation.relationId, 'relationId')
    );
  }
  for (const graph of ['gravity', 'lateral']) {
    const graphData = input.candidateLoadPaths[graph] || { nodes: [], edges: [], paths: [] };
    for (const node of graphData.nodes || []) {
      addResolutionTarget(
        resolutionCapture,
        resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, node.nodeId),
        resolutionOrigin('candidatePathNode', node.nodeId, 'nodeId', { graph })
      );
    }
    for (const edge of graphData.edges || []) {
      addResolutionTarget(
        resolutionCapture,
        resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, edge.edgeId),
        resolutionOrigin('candidatePathEdge', edge.edgeId, 'edgeId', { graph })
      );
    }
    for (const path of graphData.paths || []) {
      addResolutionTarget(
        resolutionCapture,
        resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.PATH, path.pathId),
        resolutionOrigin('candidatePath', path.pathId, 'pathId', { graph })
      );
      for (const edgeId of path.edgeIds || []) {
        const from = resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, edgeId);
        const to = resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.PATH, path.pathId);
        resolutionCapture.provenanceRelations.push({
          relationId: semanticId('sr-ref-relation', {
            kind: 'candidateEdgeMemberOfPath', graph, edgeId, pathId: path.pathId
          }),
          kind: 'candidateEdgeMemberOfPath',
          from,
          to,
          origin: { producerType: 'candidateLoadPath', graph, pathId: path.pathId }
        });
      }
    }
  }

  for (const intent of input.structuralIntent.elementIntents || []) addRegion(regionMap, wholeWallRegion(intent.elementId, walls), topology, walls);
  for (const intent of interfaceIntents) addRegion(regionMap, interfaceRegion(intent, walls), topology, walls);
  for (const relation of relationIntents) {
    for (const region of relation.carrierRegions || []) addRegion(regionMap, region, topology, walls);
  }

  for (const [key, intent] of elementIntentById) {
    const wall = walls.get(key);
    if (!wall) {
      findings.push(finding('SR-INTENT-UNRESOLVED', 'blocking', { elementId: intent.elementId }, [intent.intentId]));
      decisions.push(blockingDecision('SR-INTENT-UNRESOLVED', { elementId: intent.elementId }, [intent.intentId]));
      continue;
    }
    const region = addRegion(regionMap, wholeWallRegion(intent.elementId, walls), topology, walls);
    region.declaredFunctions = [...new Set([...region.declaredFunctions, ...(intent.functions || [])])].sort(compareText);
  }

  for (const iface of interfaceIntents) {
    const state = evaluateInterfaceFreshness(input.geometry, iface);
    if (state.state !== 'fresh') {
      const code = state.state === 'brokenReference' ? 'SR-EXPLICIT-RELATION-UNRESOLVED' : 'SR-INTERFACE-STALE';
      findings.push(finding(code, 'blocking', { interfaceId: iface.interfaceId }, [iface.interfaceId], state));
      decisions.push(blockingDecision(code, { interfaceId: iface.interfaceId }, [iface.interfaceId]));
    }
  }

  for (const relation of relationIntents) {
    const freshness = evaluateRelationFreshness(input.geometry, relation, interfaceIntents);
    const refs = [relation.relationId, ...(relation.ports || []).map((port) => port.interfaceRef)];
    if (freshness.state !== 'fresh') {
      const code = freshness.state === 'brokenReference' ? 'SR-EXPLICIT-RELATION-UNRESOLVED' : 'SR-RELATION-STALE';
      findings.push(finding(code, 'blocking', { relationId: relation.relationId }, refs, freshness));
      decisions.push(blockingDecision(code, { relationId: relation.relationId }, refs));
      continue;
    }
    const endpoints = relationEndpoints(relation, interfaceIntents);
    for (const port of relation.ports || []) {
      const iface = interfaceById.get(port.interfaceRef);
      const region = addRegion(regionMap, interfaceRegion(iface, walls), topology, walls);
      if (!region) continue;
      const interaction = {
        relationId: relation.relationId,
        interfaceId: port.interfaceRef,
        interactionRole: port.interactionRole,
        actionFamily: relation.actionFamily,
        structuralFunction: relation.structuralFunction,
        sourceRefs: refs
      };
      region.declaredInteractions.push(interaction);
      addLegacyResolutionBindings(resolutionCapture, {
        origin: resolutionOrigin('declaredInteraction', region.regionId, 'sourceRefs', {
          relationId: interaction.relationId,
          interfaceId: interaction.interfaceId
        }),
        from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.REGION, region.regionId),
        refs: [
          resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relation.relationId),
          ...relation.ports.map((item) => resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, item.interfaceRef))
        ]
      });
    }
    for (const carrier of relation.carrierRegions || []) {
      const region = addRegion(regionMap, carrier, topology, walls);
      if (region) {
        const interaction = {
        relationId: relation.relationId,
        interfaceId: null,
        interactionRole: 'carrier',
        actionFamily: relation.actionFamily,
        structuralFunction: relation.structuralFunction,
        sourceRefs: refs
        };
        region.declaredInteractions.push(interaction);
        addLegacyResolutionBindings(resolutionCapture, {
          origin: resolutionOrigin('declaredInteraction', region.regionId, 'sourceRefs', {
            relationId: interaction.relationId,
            interfaceId: null
          }),
          from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.REGION, region.regionId),
          refs: [
            resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relation.relationId),
            ...relation.ports.map((item) => resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, item.interfaceRef))
          ]
        });
      }
    }
    const effect = STRUCTURAL_FUNCTION_EFFECT[relation.structuralFunction];
    const sourceRegions = [...(relation.carrierRegions || [])].map((region) => addRegion(regionMap, region, topology, walls)).filter(Boolean);
    const endpointRegions = [...endpoints.receives, ...endpoints.delivers].map((endpoint) => (
      addRegion(regionMap, interfaceRegion(endpoint.interfaceIntent, walls), topology, walls)
    )).filter(Boolean);
    const targetRegions = sourceRegions.length ? sourceRegions : endpointRegions;
    for (const region of targetRegions) {
      const id = requirementId(effect, relation.actionFamily, region.regionId, refs);
      requirements.push({ id, code: REQUIREMENT_CODE[effect], kind: effect, graph: relation.actionFamily, targetRegionRef: region.regionId, sourceRefs: refs, verificationState: STRUCTURAL_VERIFICATION_STATE });
      region.requirementRefs.push(id);
      addLegacyResolutionBindings(resolutionCapture, {
        origin: resolutionOrigin('requirement', id, 'sourceRefs'),
        from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT, id),
        refs: [
          resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relation.relationId),
          ...relation.ports.map((item) => resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, item.interfaceRef))
        ]
      });
    }
    const record = {
      id: semanticId(relation.structuralFunction === 'support' ? 'sr-support' : 'sr-transfer', { relationId: relation.relationId }),
      graph: relation.actionFamily,
      structuralFunction: relation.structuralFunction,
      fromRefs: endpoints.delivers.map((item) => item.interfaceRef),
      toRefs: endpoints.receives.map((item) => item.interfaceRef),
      targetRegionRefs: targetRegions.map((region) => region.regionId).sort(compareText),
      provenance: 'declaredRelation',
      certainty: 'declared',
      verificationState: STRUCTURAL_VERIFICATION_STATE,
      sourceRefs: refs
    };
    addLegacyResolutionBindings(resolutionCapture, {
      origin: resolutionOrigin(relation.structuralFunction === 'support' ? 'support' : 'transfer', record.id, 'sourceRefs'),
      from: resolutionRef(
        relation.structuralFunction === 'support'
          ? STRUCTURAL_REFERENCE_DOMAINS.SUPPORT
          : STRUCTURAL_REFERENCE_DOMAINS.TRANSFER,
        record.id
      ),
      refs: [
        resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.RELATION, relation.relationId),
        ...relation.ports.map((item) => resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, item.interfaceRef))
      ]
    });
    for (const field of ['fromRefs', 'toRefs']) {
      for (const value of record[field]) {
        addResolutionBinding(resolutionCapture, {
          origin: resolutionOrigin(
            relation.structuralFunction === 'support' ? 'support' : 'transfer',
            record.id,
            field,
            { occurrenceKey: `${STRUCTURAL_REFERENCE_DOMAINS.INTERFACE}|${idToken(value)}` }
          ),
          from: resolutionRef(
            relation.structuralFunction === 'support'
              ? STRUCTURAL_REFERENCE_DOMAINS.SUPPORT
              : STRUCTURAL_REFERENCE_DOMAINS.TRANSFER,
            record.id
          ),
          legacyValue: String(value),
          to: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.INTERFACE, value),
          provenance: [{ kind: 'declaredRelationEndpoint', relationId: relation.relationId }]
        });
      }
    }
    if (relation.structuralFunction === 'support') supports.push(record);
    else transfers.push(record);
  }

  for (const intent of input.structuralIntent.elementIntents || []) {
    const region = addRegion(regionMap, wholeWallRegion(intent.elementId, walls), topology, walls);
    if (!region) continue;
    for (const fn of intent.functions || []) {
      const effect = mapDeclaredFunctionToEffect(fn);
      if (!effect) continue;
      const refs = [intent.intentId];
      const id = requirementId(effect, fn === 'inPlaneLateralResistance' ? 'lateral' : 'gravity', region.regionId, refs);
      requirements.push({ id, code: REQUIREMENT_CODE[effect] ?? 'SR-STRUCTURAL-EFFECT-REQUIRED', kind: effect, graph: fn === 'inPlaneLateralResistance' ? 'lateral' : 'gravity', targetRegionRef: region.regionId, sourceRefs: refs, verificationState: STRUCTURAL_VERIFICATION_STATE });
      region.requirementRefs.push(id);
      addLegacyResolutionBindings(resolutionCapture, {
        origin: resolutionOrigin('requirement', id, 'sourceRefs'),
        from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT, id),
        refs: [resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.ELEMENT_INTENT, intent.intentId)]
      });
    }
  }

  for (const graph of ['gravity', 'lateral']) {
    const graphData = input.candidateLoadPaths[graph] || { nodes: [], edges: [], paths: [] };
    const edgeById = new Map((graphData.edges || []).map((edge) => [edge.edgeId, edge]));
    for (const edge of graphData.edges || []) {
      if (edge.kind !== 'supportedByFoundation') continue;
      const support = {
        id: semanticId('sr-support', { graph, edgeId: edge.edgeId }),
        graph,
        structuralFunction: 'support',
        fromRefs: [edge.fromNodeId],
        toRefs: [edge.toNodeId],
        targetRegionRefs: [],
        evidence: edge.overlapRange ? { overlapRange: [...edge.overlapRange] } : {},
        provenance: 'candidatePath',
        certainty: 'candidate',
        supportEvidence: 'candidateSupportEvidence',
        verificationState: STRUCTURAL_VERIFICATION_STATE,
        sourceRefs: [edge.edgeId]
      };
      supports.push(support);
      addLegacyResolutionBindings(resolutionCapture, {
        origin: resolutionOrigin('support', support.id, 'sourceRefs'),
        from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.SUPPORT, support.id),
        refs: [resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, edge.edgeId)]
      });
      for (const field of ['fromRefs', 'toRefs']) {
        for (const value of support[field]) {
          addResolutionBinding(resolutionCapture, {
            origin: resolutionOrigin('support', support.id, field, {
              occurrenceKey: `${STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE}|${idToken(value)}`
            }),
            from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.SUPPORT, support.id),
            legacyValue: String(value),
            to: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_NODE, value),
            provenance: [{ kind: 'candidatePathEndpoint', edgeId: edge.edgeId }]
          });
        }
      }
    }
    for (const path of graphData.paths || []) {
      if (path.candidateState === 'completeCandidate') continue;
      const code = graph === 'gravity' ? 'SR-GRAVITY-PATH-INCOMPLETE' : 'SR-LATERAL-PATH-INCOMPLETE';
      findings.push(finding(code, 'warning', { graph, pathId: path.pathId }, [path.pathId, ...(path.findings || [])]));
      for (const edgeId of path.edgeIds || []) {
        const edge = edgeById.get(edgeId);
        if (edge?.kind !== 'unresolvedVerticalTransfer') continue;
        const targetNode = (graphData.nodes || []).find((node) => node.nodeId === edge.toNodeId);
        const targetId = targetNode?.ref?.elementId;
        const region = targetId === undefined ? null : addRegion(regionMap, wholeWallRegion(targetId, walls), topology, walls);
        const refs = [path.pathId, edge.edgeId];
        const id = requirementId('loadTransferRequired', graph, region?.regionId ?? null, refs);
        requirements.push({
          id,
          code: 'SR-LOAD-TRANSFER-REQUIRED',
          kind: 'loadTransferRequired',
          graph,
          targetRegionRef: region?.regionId ?? null,
          sourceRefs: refs,
          evidence: { gapMm: edge.gapMm ?? null },
          verificationState: STRUCTURAL_VERIFICATION_STATE
        });
        if (region) region.requirementRefs.push(id);
        addLegacyResolutionBindings(resolutionCapture, {
          origin: resolutionOrigin('requirement', id, 'sourceRefs'),
          from: resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.REQUIREMENT, id),
          refs: [
            resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.PATH, path.pathId),
            resolutionRef(STRUCTURAL_REFERENCE_DOMAINS.CANDIDATE_PATH_EDGE, edge.edgeId)
          ]
        });
      }
    }
  }

  const expectedLegacy = legacySourceFingerprints({
    geometry: input.geometry,
    structuralIntent: input.structuralIntent,
    roofStructuralIntent: roofIntents,
    topology: input.topology
  });
  if (JSON.stringify(canonicalizeValue(expectedLegacy)) !== JSON.stringify(canonicalizeValue(input.candidateLoadPaths.sourceFingerprints))) {
    findings.push(finding('SR-SOURCE-FINGERPRINT-MISMATCH', 'blocking', { source: 'candidateLoadPaths' }, [input.candidateLoadPaths.canonicalSha256]));
    decisions.push(blockingDecision('SR-SOURCE-FINGERPRINT-MISMATCH', { source: 'candidateLoadPaths' }, [input.candidateLoadPaths.canonicalSha256]));
  }

  const coverage = roofCoverage(input.geometry, roofIntents);
  for (const item of coverage) {
    if (!['notDeclared', 'partial'].includes(item.state)) continue;
    findings.push(finding('SR-ROOF-INTENT-INCOMPLETE', 'blocking', { roofGeometryId: item.roofGeometryId }, [`roof:${item.roofGeometryId}`]));
    decisions.push(blockingDecision('SR-ROOF-INTENT-INCOMPLETE', { roofGeometryId: item.roofGeometryId }, [`roof:${item.roofGeometryId}`]));
  }

  const regions = [...regionMap.values()].map((region) => ({
    ...region,
    declaredInteractions: region.declaredInteractions.sort((a, b) => compareText(a.relationId, b.relationId) || compareText(String(a.interfaceId), String(b.interfaceId))),
    candidateEvidenceRefs: [...new Set(region.candidateEvidenceRefs)].sort(compareText),
    requirementRefs: [...new Set(region.requirementRefs)].sort(compareText)
  })).sort((a, b) => ownerSortToken(a.ownerRef).localeCompare(ownerSortToken(b.ownerRef)) || regionSortS(a) - regionSortS(b) || compareText(a.longitudinalLocation.kind, b.longitudinalLocation.kind) || a.zRange[0] - b.zRange[0] || compareText(a.regionId, b.regionId));

  const regionByOwner = new Map();
  for (const region of regions) {
    const key = idToken(region.ownerRef.id);
    if (!regionByOwner.has(key)) regionByOwner.set(key, []);
    regionByOwner.get(key).push(region);
  }
  const elements = (topology.walls || []).map((wall) => {
    const intent = elementIntentById.get(idToken(wall.id));
    const localInteractions = (regionByOwner.get(idToken(wall.id)) || []).flatMap((region) => region.declaredInteractions.map((interaction) => ({ regionRef: region.regionId, ...interaction })));
    return {
      elementId: wall.id,
      axisContext: 'undetermined',
      declaredParticipation: intent?.participation ?? 'undetermined',
      declaredFunctions: [...(intent?.functions || [])].sort(compareText),
      declaredInteractions: localInteractions,
      candidateFunctions: [],
      resolvedByScenarioFunctions: [],
      verificationState: STRUCTURAL_VERIFICATION_STATE,
      sources: intent ? [intent.intentId] : []
    };
  }).sort((a, b) => compareIds(a.elementId, b.elementId));

  const gravityEdges = new Map((input.candidateLoadPaths.gravity?.edges || []).map((edge) => [edge.edgeId, edge]));
  const lateralEdges = new Map((input.candidateLoadPaths.lateral?.edges || []).map((edge) => [edge.edgeId, edge]));
  const gravityPaths = (input.candidateLoadPaths.gravity?.paths || []).map((path) => pathProjection(path, 'gravity', gravityEdges)).sort((a, b) => compareText(a.pathId, b.pathId));
  const lateralPaths = (input.candidateLoadPaths.lateral?.paths || []).map((path) => pathProjection(path, 'lateral', lateralEdges)).sort((a, b) => compareText(a.pathId, b.pathId));

  const fingerprints = deriveSourceFingerprints(input, roofIntents);
  const uniqueRequirements = [...new Map(requirements.map((item) => [item.id, item])).values()].sort((a, b) => compareText(a.id, b.id));
  const supportTransferSort = (a, b) => compareText(a.graph, b.graph) || compareText(a.fromRefs?.[0], b.fromRefs?.[0]) || compareText(a.toRefs?.[0], b.toRefs?.[0]) || compareText(a.id, b.id);
  const uniqueSupports = [...new Map(supports.map((item) => [item.id, item])).values()].sort(supportTransferSort);
  const uniqueTransfers = [...new Map(transfers.map((item) => [item.id, item])).values()].sort(supportTransferSort);
  const uniqueFindings = [...new Map(findings.map((item) => [item.findingId, item])).values()].sort((a, b) => compareText(a.severity, b.severity) || compareText(a.code, b.code) || compareText(a.findingId, b.findingId));
  const uniqueDecisions = [...new Map(decisions.map((item) => [item.decisionId, item])).values()].sort((a, b) => compareText(a.code, b.code) || compareText(a.decisionId, b.decisionId));
  const eligibility = {
    eligibleForConstructiveSolutions: uniqueDecisions.length === 0,
    reasonCodes: [...new Set(uniqueDecisions.map((item) => item.code))].sort(compareText)
  };

  const draft = {
    schema: STRUCTURAL_REQUIREMENTS_SCHEMA,
    specVersion: STRUCTURAL_REQUIREMENTS_SPEC_VERSION,
    sourceFingerprints: fingerprints,
    elements,
    regions,
    supports: uniqueSupports,
    transfers: uniqueTransfers,
    gravityPaths,
    lateralPaths,
    roofIntentCoverage: coverage,
    findings: uniqueFindings,
    requirements: uniqueRequirements,
    blockingDecisions: uniqueDecisions,
    lateralStatus: lateralState(input.candidateLoadPaths, roofIntents),
    eligibility,
    verification: { state: STRUCTURAL_VERIFICATION_STATE, verifierRef: null }
  };
  const canonical = canonicalizeValue(draft, topology.config?.roundDecimals ?? 3);
  const requirementsDocument = {
    ...canonical,
    canonicalSha256: sourceFingerprint(canonical, topology.config?.roundDecimals ?? 3)
  };
  return {
    requirements: requirementsDocument,
    referenceResolutionContext: createStructuralReferenceResolutionContext(
      requirementsDocument,
      resolutionCapture
    )
  };
}

export function buildStructuralRequirements(input) {
  return buildStructuralRequirementsProduct(input).requirements;
}

export function buildStructuralRequirementsWithReferenceResolutionContext(input) {
  const { requirements, referenceResolutionContext } = buildStructuralRequirementsProduct(input);
  return { structuralRequirements: requirements, referenceResolutionContext };
}

export function completeStructuralTopologyR6R12(input, structuralRequirements = null) {
  const requirements = structuralRequirements ?? buildStructuralRequirements(input);
  const source = clone(input.topology);
  const elementById = new Map(requirements.elements.map((item) => [idToken(item.elementId), item]));
  const roofBoundaryById = new Map();
  for (const roof of input.geometry.roofGeometry || []) {
    for (const boundary of canonicalizeRoofBoundaries(roof)) roofBoundaryById.set(boundary.boundaryId, { roof, boundary });
  }
  const roofSupports = [];
  for (const relation of input.structuralIntent.relationIntents || []) {
    const freshness = evaluateRelationFreshness(input.geometry, relation, input.structuralIntent.interfaceIntents || []);
    if (freshness.state !== 'fresh') continue;
    const endpoints = relationEndpoints(relation, input.structuralIntent.interfaceIntents || []);
    for (const endpoint of [...endpoints.delivers, ...endpoints.receives]) {
      const owner = endpoint.interfaceIntent?.ownerRef;
      if (owner?.kind !== 'roofBoundary') continue;
      const physical = roofBoundaryById.get(owner.boundaryId);
      roofSupports.push({
        relationId: relation.relationId,
        roofGeometryId: owner.roofGeometryId,
        actionFamily: relation.actionFamily,
        structuralFunction: relation.structuralFunction,
        physicalBoundary: {
          boundaryId: owner.boundaryId,
          physicalSRange: physical ? roofBoundaryLongitudinalRange(physical.boundary) : null
        },
        interactionLocator: clone(endpoint.interfaceIntent.locator),
        verificationState: STRUCTURAL_VERIFICATION_STATE
      });
    }
  }
  const findings = [...(source.findings || []), ...requirements.findings.map((item) => ({ ...item, phase: 'R12', rule: 'SPEC-015-E' }))];
  const draft = {
    ...source,
    specVersion: COMPLETED_TOPOLOGY_SPEC_VERSION,
    phasesExecuted: [...FULL_PHASES],
    phasesPending: [],
    walls: (source.walls || []).map((wall) => ({ ...wall, structuralContext: elementById.get(idToken(wall.id)) ?? null })),
    roofSupports: roofSupports.sort((a, b) => compareIds(a.roofGeometryId, b.roofGeometryId) || compareText(a.relationId, b.relationId)),
    verticalSupports: clone(requirements.supports),
    findings,
    eligibleForSpec08: false
  };
  delete draft.canonicalSha256;
  const canonical = canonicalizeValue(draft, source.config?.roundDecimals ?? 3);
  return { ...canonical, canonicalSha256: sourceFingerprint(canonical, source.config?.roundDecimals ?? 3) };
}

export function integrateStructuralRequirements(input) {
  const { requirements } = buildStructuralRequirementsProduct(input);
  const topology = completeStructuralTopologyR6R12(input, requirements);
  return { topology, requirements };
}
