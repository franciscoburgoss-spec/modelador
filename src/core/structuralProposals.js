import { canonicalizeRoofBoundaries } from './roofStructuralIntent.js';
import {
  StructuralProposalError,
  assertUniqueIds,
  canonicalJson,
  canonicalizeValue,
  compareIds,
  compareText,
  geometryIndexes,
  idToken,
  normalizeConfig,
  openingEvidenceForWall,
  overlap1d,
  roofBoundaryFrame,
  semanticId,
  sourceFingerprints
} from './structuralProposalCommon.js';

export { StructuralProposalError } from './structuralProposalCommon.js';

export const STRUCTURAL_PROPOSALS_SCHEMA = 'structural-proposals-v1.0';
export const STRUCTURAL_PROPOSAL_STATES = Object.freeze([
  'candidate',
  'insufficientEvidence',
  'blockedCandidate'
]);

const SUPPORT_FUNCTIONS = new Set([
  'gravitySupport',
  'lateralSupport',
  'gravityAndLateralSupport'
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedRoofIntents(input) {
  const intents = Array.isArray(input) ? input : [];
  assertUniqueIds(intents, 'roofStructuralIntent', (intent) => intent?.roofGeometryId);
  return [...intents].sort((left, right) => compareIds(left.roofGeometryId, right.roofGeometryId));
}

function normalizedElementIntents(structuralIntent) {
  if (!isRecord(structuralIntent) || structuralIntent.schema !== 'structural-intent-v1.1') {
    throw new StructuralProposalError(
      'SI-PROPOSAL-INPUT-INVALID',
      'structuralIntent debe usar structural-intent-v1.1.'
    );
  }
  const intents = Array.isArray(structuralIntent.elementIntents)
    ? structuralIntent.elementIntents
    : [];
  assertUniqueIds(intents, 'structuralIntent.elementIntents', (intent) => intent?.elementId);
  return new Map(intents.map((intent) => [idToken(intent.elementId), intent]));
}

function normalizedTopology(topology) {
  if (!isRecord(topology) || topology.schema !== 'recognized-structural-topology-v1.0') {
    throw new StructuralProposalError(
      'SI-PROPOSAL-INPUT-INVALID',
      'topology debe usar recognized-structural-topology-v1.0.'
    );
  }
  return topology;
}

function proposalPatchFor(boundaryFunction, targetIntent) {
  const functions = new Set(targetIntent?.functions || []);
  if (boundaryFunction === 'gravitySupport' || boundaryFunction === 'gravityAndLateralSupport') {
    functions.add('gravityResistance');
    functions.add('support');
  }
  if (boundaryFunction === 'lateralSupport' || boundaryFunction === 'gravityAndLateralSupport') {
    functions.add('inPlaneLateralResistance');
    functions.add('support');
  }
  return {
    participation: targetIntent?.participation || 'resistant',
    functions: [...functions].sort(compareText),
    secondaryInteraction: 'notApplicable',
    status: 'declared',
    source: 'userDeclared',
    notes: targetIntent?.notes ?? null
  };
}

function intentConflict(targetIntent, patch) {
  if (!targetIntent) return false;
  if (targetIntent.participation !== 'resistant') return true;
  const existing = new Set(targetIntent.functions || []);
  return patch.functions.some((value) => !existing.has(value)) && targetIntent.status === 'declared';
}

function openingState(openings, boundary, config) {
  let blocked = false;
  const withVertical = openings.map((opening) => {
    const overlap = overlap1d(
      opening.zRange[0],
      opening.zRange[1],
      boundary.z0,
      boundary.z1
    );
    const zOverlapMm = Math.max(0, overlap.length);
    if (zOverlapMm > config.minimumOverlapMm) blocked = true;
    const verticalDistanceMm = zOverlapMm > 0
      ? 0
      : Math.min(
          Math.abs(opening.zRange[1] - boundary.z0),
          Math.abs(boundary.z1 - opening.zRange[0])
        );
    return { ...opening, zOverlapMm, verticalDistanceMm };
  });
  return { blocked, openings: withVertical };
}

function makeFinding(code, severity, proposalId, refs, evidence = {}) {
  return {
    findingId: semanticId('finding', { code, proposalId, refs }),
    code,
    severity,
    proposalId,
    refs,
    evidence
  };
}

function mergeProposal(existing, next) {
  if (!existing) return next;
  const evidence = [...existing.evidence.matches, ...next.evidence.matches]
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  const limitationSet = new Set([...existing.limitations, ...next.limitations]);
  const stateRank = new Map([
    ['candidate', 0],
    ['insufficientEvidence', 1],
    ['blockedCandidate', 2]
  ]);
  const candidateState = stateRank.get(next.candidateState) > stateRank.get(existing.candidateState)
    ? next.candidateState
    : existing.candidateState;
  const merged = {
    ...existing,
    candidateState,
    evidence: { ...existing.evidence, matches: evidence },
    limitations: [...limitationSet].sort(compareText)
  };
  const { proposalFingerprint: ignored, ...payload } = merged;
  return { ...merged, proposalFingerprint: semanticId('proposal-fingerprint', payload).split(':').at(-1) };
}

export function generateStructuralProposals(input) {
  if (!isRecord(input)) {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'La entrada debe ser un objeto.');
  }
  const config = normalizeConfig(input.config);
  const indexes = geometryIndexes(input.geometry);
  const topology = normalizedTopology(input.topology);
  const elementIntentById = normalizedElementIntents(input.structuralIntent);
  const roofIntents = normalizedRoofIntents(input.roofStructuralIntent);
  const source = sourceFingerprints({
    geometry: input.geometry,
    structuralIntent: input.structuralIntent,
    roofStructuralIntent: roofIntents,
    topology
  }, config.roundDecimals);

  const proposalMap = new Map();
  const findings = [];

  for (const roofIntent of roofIntents) {
    const roofGeometry = indexes.roofById.get(idToken(roofIntent.roofGeometryId));
    if (!roofGeometry) {
      throw new StructuralProposalError(
        'SI-PROPOSAL-REFERENCE-NOT-FOUND',
        `La cubierta ${String(roofIntent.roofGeometryId)} no existe.`,
        { roofGeometryId: roofIntent.roofGeometryId }
      );
    }
    const boundaries = canonicalizeRoofBoundaries(roofGeometry);
    const boundaryById = new Map(boundaries.map((item) => [item.boundaryId, item]));
    for (const boundaryIntent of roofIntent.boundaryIntents || []) {
      if (!SUPPORT_FUNCTIONS.has(boundaryIntent.function)) continue;
      const boundary = boundaryById.get(boundaryIntent.boundaryId);
      if (!boundary) {
        throw new StructuralProposalError(
          'SI-PROPOSAL-REFERENCE-NOT-FOUND',
          `El borde ${boundaryIntent.boundaryId} no pertenece a la cubierta declarada.`,
          { roofGeometryId: roofIntent.roofGeometryId, boundaryId: boundaryIntent.boundaryId }
        );
      }
      const boundaryFrame = roofBoundaryFrame(boundary);
      const candidates = [];
      for (const wall of indexes.walls) {
        if (wall.axis !== boundaryFrame.axis) continue;
        const axisDistanceMm = Math.abs(wall.fixed - boundaryFrame.fixed);
        if (axisDistanceMm > config.linearToleranceMm) continue;
        const overlap = overlap1d(wall.s0, wall.s1, boundaryFrame.s0, boundaryFrame.s1);
        if (overlap.length <= config.minimumSupportOverlapMm) continue;
        const zCompatible = boundaryFrame.z0 >= wall.z0 - config.levelToleranceMm
          && boundaryFrame.z1 <= wall.z1 + config.levelToleranceMm;
        candidates.push({ wall, axisDistanceMm, overlap, zCompatible });
      }

      if (candidates.length === 0) {
        findings.push(makeFinding(
          'SI-ROOF-SUPPORT-UNRESOLVED',
          'blocking',
          null,
          { roofGeometryId: roofIntent.roofGeometryId, boundaryId: boundary.boundaryId },
          { boundary }
        ));
        continue;
      }

      for (const match of candidates) {
        const targetIntent = elementIntentById.get(idToken(match.wall.id)) || null;
        const patch = proposalPatchFor(boundaryIntent.function, targetIntent);
        const semanticKey = {
          proposalKind: 'roofBoundaryReceiver',
          roofGeometryId: roofIntent.roofGeometryId,
          boundaryId: boundary.boundaryId,
          boundaryFunction: boundaryIntent.function,
          targetType: 'element',
          targetId: match.wall.id
        };
        const proposalId = semanticId('proposal', semanticKey);
        const rawOpenings = openingEvidenceForWall(match.wall, match.overlap, config);
        const openingResult = openingState(rawOpenings, boundaryFrame, config);
        const limitations = [
          'No verifica capacidad, conexión, anclaje, resistencia ni deformaciones.'
        ];
        let candidateState = match.zCompatible ? 'candidate' : 'insufficientEvidence';
        if (!match.zCompatible) limitations.push('El rango Z del borde no está contenido en el muro.');
        if (openingResult.blocked) {
          candidateState = 'blockedCandidate';
          limitations.push('Existe un vano con solape tridimensional en la entrega.');
        }
        if (intentConflict(targetIntent, patch)) {
          candidateState = 'blockedCandidate';
          limitations.push('La propuesta contradice intención estructural ya declarada.');
        }
        const matchEvidence = {
          axis: match.wall.axis,
          axisDistanceMm: match.axisDistanceMm,
          overlapMm: match.overlap.length,
          boundaryCoverage: match.overlap.length / boundaryFrame.length,
          wallCoverage: match.overlap.length / match.wall.length,
          overlapRange: [match.overlap.start, match.overlap.end],
          boundaryZRange: [boundaryFrame.z0, boundaryFrame.z1],
          wallZRange: [match.wall.z0, match.wall.z1],
          crownClearanceMm: match.wall.z1 - boundaryFrame.z1,
          openings: openingResult.openings,
          tolerances: {
            linearToleranceMm: config.linearToleranceMm,
            levelToleranceMm: config.levelToleranceMm,
            minimumSupportOverlapMm: config.minimumSupportOverlapMm
          }
        };
        const proposalWithoutFingerprint = {
          proposalId,
          proposalKind: 'roofBoundaryReceiver',
          targetType: 'element',
          targetId: match.wall.id,
          candidateState,
          confidence: 'candidate',
          proposedIntentPatch: patch,
          evidence: {
            roofGeometryId: roofIntent.roofGeometryId,
            boundaryId: boundary.boundaryId,
            boundaryFunction: boundaryIntent.function,
            matches: [matchEvidence]
          },
          limitations: limitations.sort(compareText),
          sourceRefs: {
            roofGeometryId: roofIntent.roofGeometryId,
            roofIntentId: roofIntent.intentId,
            boundaryId: boundary.boundaryId,
            targetElementId: match.wall.id,
            topologyCanonicalSha256: topology.canonicalSha256 || null
          }
        };
        const proposal = {
          ...proposalWithoutFingerprint,
          proposalFingerprint: semanticId('proposal-fingerprint', proposalWithoutFingerprint).split(':').at(-1)
        };
        proposalMap.set(proposalId, mergeProposal(proposalMap.get(proposalId), proposal));
        findings.push(makeFinding(
          'SI-ROOF-SUPPORT-CANDIDATE',
          'info',
          proposalId,
          proposal.sourceRefs,
          matchEvidence
        ));
        findings.push(makeFinding(
          'SI-PROPOSAL-USER-DECISION-REQUIRED',
          'warning',
          proposalId,
          proposal.sourceRefs
        ));
        if (openingResult.blocked) {
          findings.push(makeFinding(
            'SI-ROOF-LOAD-OVER-OPENING',
            'blocking',
            proposalId,
            proposal.sourceRefs,
            { openings: openingResult.openings }
          ));
        }
        if (intentConflict(targetIntent, patch)) {
          findings.push(makeFinding(
            'SI-PROPOSAL-CONFLICTS-WITH-DECLARED-INTENT',
            'blocking',
            proposalId,
            proposal.sourceRefs,
            { existingIntent: targetIntent, proposedIntentPatch: patch }
          ));
        }
      }
    }
  }

  const proposals = [...proposalMap.values()].sort((left, right) => compareText(left.proposalId, right.proposalId));
  const canonicalFindings = findings.sort((left, right) => compareText(left.findingId, right.findingId));
  const output = {
    schema: STRUCTURAL_PROPOSALS_SCHEMA,
    sourceFingerprints: source,
    config,
    proposals,
    findings: canonicalFindings
  };
  output.canonicalSha256 = semanticId('canonical', canonicalizeValue(output, config.roundDecimals)).split(':').at(-1);
  return canonicalizeValue(output, config.roundDecimals);
}
