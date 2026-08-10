import {
  StructuralProposalError,
  canonicalizeValue,
  compareIds,
  compareText,
  foundationFrames,
  geometryIndexes,
  idToken,
  normalizeConfig,
  overlap1d,
  semanticId,
  sourceFingerprints,
  wallFrame
} from './structuralProposalCommon.js';
import { evaluateRelationFreshness, relationEndpoints } from './structuralInterfaces.js';

export const CANDIDATE_LOAD_PATHS_SCHEMA = 'candidate-load-paths-v1.0';
export const CANDIDATE_PATH_STATES = Object.freeze([
  'completeCandidate',
  'incompleteCandidate',
  'blockedCandidate'
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addNode(map, graph, role, ref, data = {}) {
  const nodeId = semanticId('node', { graph, role, ref });
  if (!map.has(nodeId)) map.set(nodeId, { nodeId, graph, role, ref, ...data });
  return nodeId;
}

function addEdge(map, graph, kind, fromNodeId, toNodeId, data = {}) {
  const edgeId = semanticId('edge', { graph, kind, fromNodeId, toNodeId });
  if (!map.has(edgeId)) map.set(edgeId, { edgeId, graph, kind, fromNodeId, toNodeId, ...data });
  return edgeId;
}

function makePath(graph, edgeIds, state, sourceRefs, findings = []) {
  return {
    pathId: semanticId('path', { graph, edgeIds }),
    graph,
    edgeIds,
    candidateState: state,
    confidence: 'candidate',
    sourceRefs,
    findings: [...findings].sort(compareText),
    limitations: [
      'No verifica capacidad, rigidez, conexión, anclaje, resistencia ni deformaciones.'
    ]
  };
}

function makeFinding(code, severity, graph, refs, evidence = {}) {
  return {
    findingId: semanticId('finding', { code, graph, refs }),
    code,
    severity,
    graph,
    refs,
    evidence
  };
}

function elementIntentMap(structuralIntent) {
  if (!isRecord(structuralIntent) || structuralIntent.schema !== 'structural-intent-v1.1') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'structuralIntent debe usar structural-intent-v1.1.');
  }
  return new Map((structuralIntent.elementIntents || []).map((intent) => [idToken(intent.elementId), intent]));
}

function roofIntentList(roofStructuralIntent) {
  return [...(Array.isArray(roofStructuralIntent) ? roofStructuralIntent : [])]
    .sort((left, right) => compareIds(left.roofGeometryId, right.roofGeometryId));
}

function wallFoundationMatches(frame, foundations, config) {
  const matches = [];
  for (const foundation of foundations) {
    for (const candidate of foundationFrames(foundation)) {
      if (candidate.role !== 'sobrecimiento' || candidate.axis !== frame.axis) continue;
      if (frame.fixed < candidate.fixed0 - config.linearToleranceMm
        || frame.fixed > candidate.fixed1 + config.linearToleranceMm) continue;
      if (Math.abs(candidate.z1 - frame.z0) > config.levelToleranceMm) continue;
      const overlap = overlap1d(frame.s0, frame.s1, candidate.s0, candidate.s1);
      if (overlap.length <= config.minimumSupportOverlapMm) continue;
      matches.push({ foundation, candidate, overlap });
    }
  }
  return matches.sort((left, right) => compareIds(left.foundation.id, right.foundation.id));
}

function lowerWallMatches(frame, walls, config) {
  return walls.filter((candidate) => (
    idToken(candidate.id) !== idToken(frame.id)
    && candidate.axis === frame.axis
    && Math.abs(candidate.fixed - frame.fixed) <= config.linearToleranceMm
    && Math.abs(candidate.z1 - frame.z0) <= config.levelToleranceMm
    && overlap1d(frame.s0, frame.s1, candidate.s0, candidate.s1).length > config.minimumSupportOverlapMm
  )).map((candidate) => ({
    wall: candidate,
    overlap: overlap1d(frame.s0, frame.s1, candidate.s0, candidate.s1)
  })).sort((left, right) => compareIds(left.wall.id, right.wall.id));
}

function resolveGravityBranches(frame, indexes, config, nodeMap, edgeMap, prefixEdges, visited = new Set()) {
  const token = idToken(frame.id);
  if (visited.has(token)) return [{ edgeIds: prefixEdges, state: 'blockedCandidate', findings: ['SI-GRAVITY-PATH-CYCLE'] }];
  const nextVisited = new Set(visited);
  nextVisited.add(token);
  const currentNode = addNode(nodeMap, 'gravity', 'receiverWall', { elementId: frame.id }, {
    geometry: { axis: frame.axis, fixed: frame.fixed, sRange: [frame.s0, frame.s1], zRange: [frame.z0, frame.z1] }
  });

  const lowerWalls = lowerWallMatches(frame, indexes.walls, config);
  if (lowerWalls.length > 0) {
    const branches = [];
    for (const lower of lowerWalls) {
      const lowerNode = addNode(nodeMap, 'gravity', 'immediateLowerWall', { elementId: lower.wall.id }, {
        geometry: { axis: lower.wall.axis, fixed: lower.wall.fixed, sRange: [lower.wall.s0, lower.wall.s1], zRange: [lower.wall.z0, lower.wall.z1] }
      });
      const edge = addEdge(edgeMap, 'gravity', 'supportedByWall', currentNode, lowerNode, {
        overlapMm: lower.overlap.length,
        overlapRange: [lower.overlap.start, lower.overlap.end]
      });
      branches.push(...resolveGravityBranches(
        lower.wall,
        indexes,
        config,
        nodeMap,
        edgeMap,
        [...prefixEdges, edge],
        nextVisited
      ));
    }
    return branches;
  }

  const foundations = wallFoundationMatches(frame, indexes.foundations, config);
  if (foundations.length > 0) {
    return foundations.map((match) => {
      const foundationNode = addNode(nodeMap, 'gravity', 'foundationBase', { foundationId: match.foundation.id }, {
        geometry: {
          axis: match.candidate.axis,
          sRange: [match.candidate.s0, match.candidate.s1],
          zRange: [match.candidate.z0, match.candidate.z1]
        }
      });
      const edge = addEdge(edgeMap, 'gravity', 'supportedByFoundation', currentNode, foundationNode, {
        overlapMm: match.overlap.length,
        overlapRange: [match.overlap.start, match.overlap.end]
      });
      return { edgeIds: [...prefixEdges, edge], state: 'completeCandidate', findings: [] };
    });
  }

  return [{
    edgeIds: prefixEdges,
    state: 'incompleteCandidate',
    findings: ['SI-VERTICAL-SUPPORT-UNRESOLVED']
  }];
}

function polygonBounds(roof) {
  const boundary = roof?.surface?.boundary || [];
  return {
    minX: Math.min(...boundary.map((point) => point.x)),
    maxX: Math.max(...boundary.map((point) => point.x)),
    minY: Math.min(...boundary.map((point) => point.y)),
    maxY: Math.max(...boundary.map((point) => point.y))
  };
}

function roofZAt(roof, x, y) {
  const points = roof?.surface?.boundary || [];
  if (points.length < 3) return null;
  let a = points[0]; let b = null; let c = null;
  for (let index = 1; index < points.length && !c; index += 1) {
    for (let other = index + 1; other < points.length; other += 1) {
      const p = points[index]; const q = points[other];
      const ux = p.x - a.x; const uy = p.y - a.y; const uz = p.z - a.z;
      const vx = q.x - a.x; const vy = q.y - a.y; const vz = q.z - a.z;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      if (Math.abs(nz) > 1e-9) { b = p; c = q; break; }
    }
  }
  if (!b || !c) return null;
  const ux = b.x - a.x; const uy = b.y - a.y; const uz = b.z - a.z;
  const vx = c.x - a.x; const vy = c.y - a.y; const vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return a.z - (nx * (x - a.x) + ny * (y - a.y)) / nz;
}

function wallMidpoint(frame) {
  if (frame.axis === 'x') return { x: (frame.s0 + frame.s1) / 2, y: frame.fixed };
  return { x: frame.fixed, y: (frame.s0 + frame.s1) / 2 };
}

function withinRoofPlan(roof, point, tolerance) {
  const bounds = polygonBounds(roof);
  return point.x >= bounds.minX - tolerance && point.x <= bounds.maxX + tolerance
    && point.y >= bounds.minY - tolerance && point.y <= bounds.maxY + tolerance;
}

function transferIntentsFor(elementIntentById) {
  return [...elementIntentById.values()].filter((intent) => (
    intent.participation === 'resistant'
    && (intent.functions || []).some((value) => value === 'loadTransfer' || value === 'collectorAction')
  ));
}

function explicitRelationGraph(structuralIntent, geometry, actionFamily) {
  const interfaces = Array.isArray(structuralIntent.interfaceIntents)
    ? structuralIntent.interfaceIntents
    : [];
  const relations = Array.isArray(structuralIntent.relationIntents)
    ? structuralIntent.relationIntents
    : [];
  const interfaceById = new Map(interfaces.map((intent) => [intent.interfaceId, intent]));
  const outgoing = new Map();
  const entries = [];

  for (const relation of relations) {
    if (relation.actionFamily !== actionFamily) continue;
    const endpoints = relationEndpoints(relation, interfaces);
    const freshness = evaluateRelationFreshness(geometry, relation, interfaces);
    const from = relation.structuralFunction === 'loadTransfer'
      || relation.structuralFunction === 'collectorAction'
      ? endpoints.receives
      : endpoints.delivers;
    const to = relation.structuralFunction === 'loadTransfer'
      || relation.structuralFunction === 'collectorAction'
      ? endpoints.delivers
      : endpoints.receives;
    for (const source of from) {
      for (const target of to) {
        const entry = {
          relation,
          freshness,
          from: source,
          to: target
        };
        if (!outgoing.has(source.interfaceRef)) outgoing.set(source.interfaceRef, []);
        outgoing.get(source.interfaceRef).push(entry);
        entries.push(entry);
      }
    }
  }
  for (const values of outgoing.values()) {
    values.sort((left, right) => (
      compareText(left.relation.relationId, right.relation.relationId)
      || compareText(left.to.interfaceRef, right.to.interfaceRef)
    ));
  }
  return { interfaceById, outgoing, entries };
}

function interfaceNode(nodeMap, graph, interfaceIntent) {
  const ownerRef = interfaceIntent?.ownerRef || {};
  return addNode(nodeMap, graph, 'declaredInterface', { interfaceId: interfaceIntent.interfaceId }, {
    ownerRef,
    locator: interfaceIntent.locator
  });
}

function explicitEdge(edgeMap, nodeMap, graph, entry) {
  const sourceIntent = entry.from.interfaceIntent;
  const targetIntent = entry.to.interfaceIntent;
  const fromNode = interfaceNode(nodeMap, graph, sourceIntent);
  const toNode = interfaceNode(nodeMap, graph, targetIntent);
  return addEdge(
    edgeMap,
    graph,
    `declared:${entry.relation.structuralFunction}`,
    fromNode,
    toNode,
    {
      relationId: entry.relation.relationId,
      actionFamily: entry.relation.actionFamily,
      structuralFunction: entry.relation.structuralFunction,
      carrierRegions: entry.relation.carrierRegions,
      relationState: entry.freshness.state
    }
  );
}

function wallFrameForInterface(indexes, interfaceIntent) {
  if (interfaceIntent?.ownerRef?.kind !== 'element') return null;
  return indexes.walls.find((wall) => idToken(wall.id) === idToken(interfaceIntent.ownerRef.id)) ?? null;
}

function walkExplicitGravity({
  interfaceId,
  relationGraph,
  indexes,
  config,
  nodeMap,
  edgeMap,
  prefixEdges,
  visited = new Set(),
  arrivedAs = null
}) {
  if (visited.has(interfaceId)) {
    return [{ edgeIds: prefixEdges, state: 'blockedCandidate', findings: ['SI-GRAVITY-PATH-CYCLE'] }];
  }
  const nextVisited = new Set(visited);
  nextVisited.add(interfaceId);
  const outgoing = relationGraph.outgoing.get(interfaceId) || [];
  if (outgoing.length > 0) {
    const branches = [];
    for (const entry of outgoing) {
      const edge = explicitEdge(edgeMap, nodeMap, 'gravity', entry);
      if (entry.freshness.state !== 'fresh') {
        branches.push({
          edgeIds: [...prefixEdges, edge],
          state: 'blockedCandidate',
          findings: [entry.freshness.state === 'brokenReference'
            ? 'SI-EXPLICIT-RELATION-BROKEN-REFERENCE'
            : 'SI-EXPLICIT-RELATION-STALE']
        });
        continue;
      }
      branches.push(...walkExplicitGravity({
        interfaceId: entry.to.interfaceRef,
        relationGraph,
        indexes,
        config,
        nodeMap,
        edgeMap,
        prefixEdges: [...prefixEdges, edge],
        visited: nextVisited,
        arrivedAs: entry.to.interactionRole
      }));
    }
    return branches;
  }

  const interfaceIntent = relationGraph.interfaceById.get(interfaceId);
  if (!interfaceIntent) {
    return [{ edgeIds: prefixEdges, state: 'blockedCandidate', findings: ['SI-EXPLICIT-RELATION-BROKEN-REFERENCE'] }];
  }
  const frame = wallFrameForInterface(indexes, interfaceIntent);
  if (!frame) {
    return [{ edgeIds: prefixEdges, state: 'incompleteCandidate', findings: ['SI-EXPLICIT-DESTINATION-UNRESOLVED'] }];
  }

  if (arrivedAs === 'delivers') {
    return [{
      edgeIds: prefixEdges,
      state: 'incompleteCandidate',
      findings: ['SI-EXPLICIT-END-SUPPORT-UNRESOLVED']
    }];
  }
  return resolveGravityBranches(frame, indexes, config, nodeMap, edgeMap, prefixEdges);
}

function roofBoundaryKey(ownerRef) {
  return ownerRef?.kind === 'roofBoundary'
    ? `${idToken(ownerRef.roofGeometryId)}|${String(ownerRef.boundaryId)}`
    : null;
}

function buildExplicitGravity(input, indexes, config, nodeMap, edgeMap) {
  const relationGraph = explicitRelationGraph(input.structuralIntent, input.geometry, 'gravity');
  const paths = [];
  const findings = [];
  const coveredRoofBoundaries = new Set();
  const startEntries = relationGraph.entries.filter((entry) => (
    entry.relation.structuralFunction === 'support'
    && entry.from.interactionRole === 'delivers'
    && entry.from.interfaceIntent?.ownerRef?.kind === 'roofBoundary'
  ));

  for (const entry of startEntries) {
    const boundaryKey = roofBoundaryKey(entry.from.interfaceIntent.ownerRef);
    if (boundaryKey) coveredRoofBoundaries.add(boundaryKey);
    const edge = explicitEdge(edgeMap, nodeMap, 'gravity', entry);
    let branches;
    if (entry.freshness.state !== 'fresh') {
      branches = [{
        edgeIds: [edge],
        state: 'blockedCandidate',
        findings: [entry.freshness.state === 'brokenReference'
          ? 'SI-EXPLICIT-RELATION-BROKEN-REFERENCE'
          : 'SI-EXPLICIT-RELATION-STALE']
      }];
    } else {
      branches = walkExplicitGravity({
        interfaceId: entry.to.interfaceRef,
        relationGraph,
        indexes,
        config,
        nodeMap,
        edgeMap,
        prefixEdges: [edge],
        arrivedAs: entry.to.interactionRole
      });
    }
    for (const branch of branches) {
      paths.push(makePath('gravity', branch.edgeIds, branch.state, {
        relationId: entry.relation.relationId,
        roofGeometryId: entry.from.interfaceIntent.ownerRef.roofGeometryId,
        boundaryId: entry.from.interfaceIntent.ownerRef.boundaryId
      }, branch.findings));
      for (const code of branch.findings) {
        findings.push(makeFinding(
          code,
          code.includes('STALE') || code.includes('BROKEN') || code.includes('CYCLE') ? 'blocking' : 'warning',
          'gravity',
          { relationId: entry.relation.relationId, interfaceId: entry.to.interfaceRef }
        ));
      }
    }
  }
  return { paths, findings, coveredRoofBoundaries };
}

function buildGravity(input, indexes, config) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  const explicit = buildExplicitGravity(input, indexes, config, nodeMap, edgeMap);
  const paths = [...explicit.paths];
  const findings = [...explicit.findings];
  for (const proposal of input.structuralProposals.proposals || []) {
    const boundaryFunction = proposal.evidence?.boundaryFunction;
    if (!['gravitySupport', 'gravityAndLateralSupport'].includes(boundaryFunction)) continue;
    const proposalBoundaryKey = `${idToken(proposal.evidence.roofGeometryId)}|${String(proposal.evidence.boundaryId)}`;
    if (explicit.coveredRoofBoundaries.has(proposalBoundaryKey)) continue;
    const roofNode = addNode(nodeMap, 'gravity', 'roofSource', {
      roofGeometryId: proposal.evidence.roofGeometryId,
      boundaryId: proposal.evidence.boundaryId
    });
    const frame = indexes.walls.find((wall) => idToken(wall.id) === idToken(proposal.targetId));
    if (!frame) {
      findings.push(makeFinding('SI-PROPOSAL-BROKEN-REFERENCE', 'blocking', 'gravity', { proposalId: proposal.proposalId }));
      continue;
    }
    const receiverNode = addNode(nodeMap, 'gravity', 'receiverWall', { elementId: frame.id });
    const firstEdge = addEdge(edgeMap, 'gravity', 'roofBoundaryToReceiver', roofNode, receiverNode, {
      proposalId: proposal.proposalId,
      overlapMm: proposal.evidence.matches?.[0]?.overlapMm ?? null
    });
    if (proposal.candidateState === 'blockedCandidate') {
      paths.push(makePath('gravity', [firstEdge], 'blockedCandidate', {
        proposalId: proposal.proposalId,
        roofGeometryId: proposal.evidence.roofGeometryId,
        targetElementId: frame.id
      }, ['SI-ROOF-LOAD-OVER-OPENING']));
      continue;
    }
    const branches = resolveGravityBranches(frame, indexes, config, nodeMap, edgeMap, [firstEdge]);
    for (const branch of branches) {
      paths.push(makePath('gravity', branch.edgeIds, branch.state, {
        proposalId: proposal.proposalId,
        roofGeometryId: proposal.evidence.roofGeometryId,
        targetElementId: frame.id
      }, branch.findings));
      for (const code of branch.findings) {
        findings.push(makeFinding(code, code.includes('CYCLE') ? 'blocking' : 'warning', 'gravity', {
          proposalId: proposal.proposalId,
          targetElementId: frame.id
        }));
      }
    }
  }
  return {
    graphType: 'gravity',
    nodes: [...nodeMap.values()].sort((a, b) => compareText(a.nodeId, b.nodeId)),
    edges: [...edgeMap.values()].sort((a, b) => compareText(a.edgeId, b.edgeId)),
    paths: paths.sort((a, b) => compareText(a.pathId, b.pathId)),
    findings: findings.sort((a, b) => compareText(a.findingId, b.findingId))
  };
}

function buildLateral(input, indexes, config, elementIntentById) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  const paths = [];
  const findings = [];
  const contexts = [...(input.analysisContexts || [])]
    .filter((context) => context?.graph === 'lateral' && ['x', 'y'].includes(context.direction))
    .sort((a, b) => compareText(a.direction, b.direction));
  const transfers = transferIntentsFor(elementIntentById);

  for (const roofIntent of roofIntentList(input.roofStructuralIntent)) {
    const roof = indexes.roofById.get(idToken(roofIntent.roofGeometryId));
    if (!roof) continue;
    if (roofIntent.diaphragmBehavior !== 'intended') {
      if (roofIntent.diaphragmBehavior === 'candidate') {
        findings.push(makeFinding('SI-DIAPHRAGM-UNDECLARED', 'warning', 'lateral', {
          roofGeometryId: roofIntent.roofGeometryId
        }));
      }
      continue;
    }
    for (const context of contexts) {
      const sourceNode = addNode(nodeMap, 'lateral', 'diaphragmSource', {
        roofGeometryId: roofIntent.roofGeometryId,
        direction: context.direction
      });
      const compatible = indexes.walls.filter((frame) => {
        const intent = elementIntentById.get(idToken(frame.id));
        const point = wallMidpoint(frame);
        return frame.axis === context.direction
          && intent?.participation === 'resistant'
          && (intent.functions || []).includes('inPlaneLateralResistance')
          && withinRoofPlan(roof, point, config.linearToleranceMm);
      });
      for (const frame of compatible) {
        const point = wallMidpoint(frame);
        const roofZ = roofZAt(roof, point.x, point.y);
        if (!Number.isFinite(roofZ)) continue;
        const gapMm = roofZ - frame.z1;
        const targetNode = addNode(nodeMap, 'lateral', 'resistantWallDestination', { elementId: frame.id }, {
          direction: context.direction,
          geometry: { point, wallTopZ: frame.z1, roofZ, gapMm }
        });
        const pathEdges = [];
        const pathFindings = [];
        let state = 'completeCandidate';
        if (gapMm > config.levelToleranceMm) {
          const matchingTransfer = transfers.find((intent) => idToken(intent.elementId) !== idToken(frame.id));
          if (matchingTransfer) {
            const transferNode = addNode(nodeMap, 'lateral', 'declaredTransfer', { elementId: matchingTransfer.elementId });
            pathEdges.push(addEdge(edgeMap, 'lateral', 'diaphragmToTransfer', sourceNode, transferNode, { gapMm }));
            pathEdges.push(addEdge(edgeMap, 'lateral', 'transferToWall', transferNode, targetNode, { gapMm }));
          } else {
            pathEdges.push(addEdge(edgeMap, 'lateral', 'unresolvedVerticalTransfer', sourceNode, targetNode, { gapMm }));
            state = 'incompleteCandidate';
            pathFindings.push('SI-LATERAL-TRANSFER-REQUIRED');
            findings.push(makeFinding('SI-LATERAL-TRANSFER-REQUIRED', 'blocking', 'lateral', {
              roofGeometryId: roofIntent.roofGeometryId,
              targetElementId: frame.id,
              direction: context.direction
            }, { gapMm, roofZ, wallTopZ: frame.z1 }));
          }
        } else {
          pathEdges.push(addEdge(edgeMap, 'lateral', 'diaphragmToWall', sourceNode, targetNode, { gapMm: Math.max(0, gapMm) }));
        }

        const foundationMatches = wallFoundationMatches(frame, indexes.foundations, config);
        if (foundationMatches.length > 0) {
          const foundation = foundationMatches[0];
          const foundationNode = addNode(nodeMap, 'lateral', 'foundationBase', { foundationId: foundation.foundation.id });
          pathEdges.push(addEdge(edgeMap, 'lateral', 'wallToBaseCandidate', targetNode, foundationNode, {
            overlapMm: foundation.overlap.length
          }));
        } else {
          state = 'incompleteCandidate';
          pathFindings.push('SI-VERTICAL-SUPPORT-UNRESOLVED');
          findings.push(makeFinding('SI-VERTICAL-SUPPORT-UNRESOLVED', 'warning', 'lateral', {
            targetElementId: frame.id,
            direction: context.direction
          }));
        }
        paths.push(makePath('lateral', pathEdges, state, {
          roofGeometryId: roofIntent.roofGeometryId,
          targetElementId: frame.id,
          direction: context.direction
        }, pathFindings));
      }
    }
  }

  return {
    graphType: 'lateral',
    nodes: [...nodeMap.values()].sort((a, b) => compareText(a.nodeId, b.nodeId)),
    edges: [...edgeMap.values()].sort((a, b) => compareText(a.edgeId, b.edgeId)),
    paths: paths.sort((a, b) => compareText(a.pathId, b.pathId)),
    findings: findings.sort((a, b) => compareText(a.findingId, b.findingId))
  };
}

export function buildCandidateLoadPaths(input) {
  if (!isRecord(input)) {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'La entrada debe ser un objeto.');
  }
  if (input.structuralProposals?.schema !== 'structural-proposals-v1.0') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'structuralProposals debe usar structural-proposals-v1.0.');
  }
  if (!isRecord(input.topology) || input.topology.schema !== 'recognized-structural-topology-v1.0') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'topology debe usar recognized-structural-topology-v1.0.');
  }
  const config = normalizeConfig(input.config);
  const indexes = geometryIndexes(input.geometry);
  const elementIntentById = elementIntentMap(input.structuralIntent);
  const fingerprints = sourceFingerprints({
    geometry: input.geometry,
    structuralIntent: input.structuralIntent,
    roofStructuralIntent: roofIntentList(input.roofStructuralIntent),
    topology: input.topology
  }, config.roundDecimals);
  const gravity = buildGravity(input, indexes, config);
  const lateral = buildLateral(input, indexes, config, elementIntentById);
  const output = {
    schema: CANDIDATE_LOAD_PATHS_SCHEMA,
    sourceFingerprints: fingerprints,
    config,
    gravity,
    lateral
  };
  output.canonicalSha256 = semanticId('canonical', output).split(':').at(-1);
  return canonicalizeValue(output, config.roundDecimals);
}
