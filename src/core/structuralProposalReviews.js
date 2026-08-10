import {
  StructuralProposalError,
  canonicalizeValue,
  cloneJson,
  compareText,
  fingerprint,
  idToken,
  isRecord,
  semanticId
} from './structuralProposalCommon.js';
import { fingerprintStructuralIntentTarget } from './structuralIntentTrace.js';

export const STRUCTURAL_PROPOSAL_REVIEW_SCHEMA = 'structural-proposal-review-log-v1.0';
export const STRUCTURAL_PROPOSAL_REVIEW_ACTION = 'structuralProposalReviewed';
export const STRUCTURAL_PROPOSAL_DISPOSITIONS = Object.freeze([
  'accepted',
  'modifiedAndAccepted',
  'rejected',
  'deferred'
]);

const LOG_KEYS = new Set(['schema', 'events']);
const EVENT_KEYS = new Set(['sequence', 'eventId', 'action', 'decisions', 'source']);
const DECISION_KEYS = new Set([
  'proposalId',
  'proposalFingerprint',
  'sourceAggregateSha256',
  'disposition',
  'reasonCode',
  'note',
  'targetType',
  'targetId',
  'appliedIntentFingerprint'
]);

export function createEmptyStructuralProposalReviewLog() {
  return { schema: STRUCTURAL_PROPOSAL_REVIEW_SCHEMA, events: [] };
}

function canonicalDecision(decision) {
  return {
    proposalId: decision.proposalId,
    proposalFingerprint: decision.proposalFingerprint,
    sourceAggregateSha256: decision.sourceAggregateSha256,
    disposition: decision.disposition,
    reasonCode: decision.reasonCode ?? null,
    note: decision.note ?? null,
    targetType: decision.targetType,
    targetId: decision.targetId,
    appliedIntentFingerprint: decision.appliedIntentFingerprint ?? null
  };
}

function canonicalEvent(event) {
  const decisions = Array.isArray(event.decisions)
    ? event.decisions.map(canonicalDecision).sort((left, right) => (
        compareText(left.proposalId, right.proposalId)
        || compareText(idToken(left.targetId), idToken(right.targetId))
      ))
    : event.decisions;
  return {
    sequence: event.sequence,
    eventId: event.eventId,
    action: event.action,
    decisions,
    source: event.source
  };
}

export function canonicalizeStructuralProposalReviewLog(log) {
  if (log === undefined) return undefined;
  if (!isRecord(log)) return log;
  return {
    schema: log.schema,
    events: Array.isArray(log.events)
      ? log.events.map(canonicalEvent).sort((a, b) => a.sequence - b.sequence)
      : log.events
  };
}

function issue(path, code, message) {
  return { path, code, message };
}

export function validateStructuralProposalReviewLog(log) {
  if (log === undefined) return [];
  if (!isRecord(log)) {
    return [issue('structuralProposalReviews', 'SI-PROPOSAL-REVIEW-EXPECTED-OBJECT', 'El review log debe ser un objeto.')];
  }
  const issues = [];
  for (const key of Object.keys(log)) {
    if (!LOG_KEYS.has(key)) issues.push(issue(`structuralProposalReviews.${key}`, 'SI-PROPOSAL-REVIEW-UNKNOWN-FIELD', `El campo ${key} no pertenece al contrato.`));
  }
  if (log.schema !== STRUCTURAL_PROPOSAL_REVIEW_SCHEMA) {
    issues.push(issue('structuralProposalReviews.schema', 'SI-PROPOSAL-REVIEW-SCHEMA-INVALID', `schema debe ser ${STRUCTURAL_PROPOSAL_REVIEW_SCHEMA}.`));
  }
  if (!Array.isArray(log.events)) {
    issues.push(issue('structuralProposalReviews.events', 'SI-PROPOSAL-REVIEW-EXPECTED-ARRAY', 'events debe ser un arreglo.'));
    return issues;
  }
  const eventIds = new Set();
  log.events.forEach((event, index) => {
    const path = `structuralProposalReviews.events[${index}]`;
    if (!isRecord(event)) {
      issues.push(issue(path, 'SI-PROPOSAL-REVIEW-EXPECTED-OBJECT', 'El evento debe ser un objeto.'));
      return;
    }
    for (const key of Object.keys(event)) {
      if (!EVENT_KEYS.has(key)) issues.push(issue(`${path}.${key}`, 'SI-PROPOSAL-REVIEW-UNKNOWN-FIELD', `El campo ${key} no pertenece al evento.`));
    }
    if (event.sequence !== index + 1) issues.push(issue(`${path}.sequence`, 'SI-PROPOSAL-REVIEW-SEQUENCE-INVALID', `sequence debe ser ${index + 1}.`));
    if (event.action !== STRUCTURAL_PROPOSAL_REVIEW_ACTION) issues.push(issue(`${path}.action`, 'SI-PROPOSAL-REVIEW-ACTION-INVALID', `action debe ser ${STRUCTURAL_PROPOSAL_REVIEW_ACTION}.`));
    if (event.source !== 'userAction') issues.push(issue(`${path}.source`, 'SI-PROPOSAL-REVIEW-SOURCE-INVALID', 'source debe ser userAction.'));
    if (typeof event.eventId !== 'string' || event.eventId === '') issues.push(issue(`${path}.eventId`, 'SI-PROPOSAL-REVIEW-ID-INVALID', 'eventId debe ser texto no vacío.'));
    if (eventIds.has(event.eventId)) issues.push(issue(`${path}.eventId`, 'SI-PROPOSAL-REVIEW-ID-DUPLICATE', 'eventId está duplicado.'));
    eventIds.add(event.eventId);
    if (!Array.isArray(event.decisions) || event.decisions.length === 0) {
      issues.push(issue(`${path}.decisions`, 'SI-PROPOSAL-REVIEW-DECISIONS-INVALID', 'decisions debe contener al menos una decisión.'));
      return;
    }
    const proposalIds = new Set();
    event.decisions.forEach((decision, decisionIndex) => {
      const decisionPath = `${path}.decisions[${decisionIndex}]`;
      if (!isRecord(decision)) {
        issues.push(issue(decisionPath, 'SI-PROPOSAL-REVIEW-EXPECTED-OBJECT', 'La decisión debe ser un objeto.'));
        return;
      }
      for (const key of Object.keys(decision)) {
        if (!DECISION_KEYS.has(key)) issues.push(issue(`${decisionPath}.${key}`, 'SI-PROPOSAL-REVIEW-UNKNOWN-FIELD', `El campo ${key} no pertenece a la decisión.`));
      }
      if (typeof decision.proposalId !== 'string' || decision.proposalId === '') issues.push(issue(`${decisionPath}.proposalId`, 'SI-PROPOSAL-REVIEW-PROPOSAL-ID-INVALID', 'proposalId debe ser texto no vacío.'));
      if (proposalIds.has(decision.proposalId)) issues.push(issue(`${decisionPath}.proposalId`, 'SI-PROPOSAL-REVIEW-PROPOSAL-DUPLICATE', 'La decisión de lote repite proposalId.'));
      proposalIds.add(decision.proposalId);
      if (typeof decision.proposalFingerprint !== 'string' || decision.proposalFingerprint.length !== 64) issues.push(issue(`${decisionPath}.proposalFingerprint`, 'SI-PROPOSAL-REVIEW-FINGERPRINT-INVALID', 'proposalFingerprint debe ser SHA-256.'));
      if (typeof decision.sourceAggregateSha256 !== 'string' || decision.sourceAggregateSha256.length !== 64) issues.push(issue(`${decisionPath}.sourceAggregateSha256`, 'SI-PROPOSAL-REVIEW-FINGERPRINT-INVALID', 'sourceAggregateSha256 debe ser SHA-256.'));
      if (!STRUCTURAL_PROPOSAL_DISPOSITIONS.includes(decision.disposition)) issues.push(issue(`${decisionPath}.disposition`, 'SI-PROPOSAL-REVIEW-DISPOSITION-INVALID', 'disposition no está permitida.'));
      if (!['element', 'roof', 'interface', 'relation'].includes(decision.targetType)) issues.push(issue(`${decisionPath}.targetType`, 'SI-PROPOSAL-REVIEW-TARGET-TYPE-INVALID', 'targetType no está permitido.'));
      if (!['number', 'string'].includes(typeof decision.targetId) || decision.targetId === '') issues.push(issue(`${decisionPath}.targetId`, 'SI-PROPOSAL-REVIEW-TARGET-ID-INVALID', 'targetId debe ser string o number no vacío.'));
      if (decision.note !== null && decision.note !== undefined && typeof decision.note !== 'string') issues.push(issue(`${decisionPath}.note`, 'SI-PROPOSAL-REVIEW-NOTE-INVALID', 'note debe ser texto o null.'));
    });
  });
  return issues;
}

export function assertValidStructuralProposalReviewLog(log) {
  const normalized = log === undefined ? createEmptyStructuralProposalReviewLog() : canonicalizeStructuralProposalReviewLog(log);
  const issues = validateStructuralProposalReviewLog(normalized);
  if (issues.length > 0) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-REVIEW-INVALID',
      `El review log contiene ${issues.length} problema${issues.length === 1 ? '' : 's'}.`,
      { issues }
    );
  }
  return normalized;
}

export function appendStructuralProposalReview(model, decisions) {
  if (!isRecord(model)) throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'El modelo debe ser un objeto.');
  if (!Array.isArray(decisions) || decisions.length === 0) {
    throw new StructuralProposalError('SI-PROPOSAL-DECISION-INVALID', 'La revisión requiere al menos una decisión.');
  }
  const current = assertValidStructuralProposalReviewLog(model.structuralProposalReviews);
  const canonicalDecisions = decisions.map(canonicalDecision).sort((left, right) => compareText(left.proposalId, right.proposalId));
  const sequence = current.events.length + 1;
  const eventPayload = {
    sequence,
    action: STRUCTURAL_PROPOSAL_REVIEW_ACTION,
    decisions: canonicalDecisions,
    source: 'userAction'
  };
  const event = {
    ...eventPayload,
    eventId: semanticId('review', { sequence, decisions: canonicalDecisions })
  };
  const next = canonicalizeStructuralProposalReviewLog({
    schema: STRUCTURAL_PROPOSAL_REVIEW_SCHEMA,
    events: [...current.events, event]
  });
  const issues = validateStructuralProposalReviewLog(next);
  if (issues.length > 0) {
    throw new StructuralProposalError('SI-PROPOSAL-REVIEW-INVALID', 'No se pudo agregar la revisión.', { issues });
  }
  return { ...model, structuralProposalReviews: next };
}

export function reviewFingerprint(log) {
  return fingerprint(canonicalizeStructuralProposalReviewLog(log || createEmptyStructuralProposalReviewLog()));
}

function currentTargetIntent(structuralIntent, targetType, targetId) {
  if (!structuralIntent) return null;
  const descriptors = {
    element: ['elementIntents', 'elementId'],
    roof: ['roofIntents', 'roofGeometryId'],
    interface: ['interfaceIntents', 'interfaceId'],
    relation: ['relationIntents', 'relationId']
  };
  const descriptor = descriptors[targetType];
  if (!descriptor) return null;
  const [collectionName, key] = descriptor;
  return structuralIntent[collectionName]?.find((intent) => idToken(intent?.[key]) === idToken(targetId)) || null;
}

function exactReviewState(proposal, decision, structuralProposals, structuralIntent) {
  if (decision.proposalFingerprint !== proposal.proposalFingerprint) return false;
  if (['accepted', 'modifiedAndAccepted'].includes(decision.disposition)) {
    if (!structuralIntent) {
      return decision.sourceAggregateSha256
        === structuralProposals.sourceFingerprints.aggregateSha256;
    }
    const current = currentTargetIntent(
      structuralIntent,
      decision.targetType,
      decision.targetId
    );
    return fingerprintStructuralIntentTarget(
      decision.targetType,
      decision.targetId,
      current
    ) === decision.appliedIntentFingerprint;
  }
  return decision.sourceAggregateSha256
    === structuralProposals.sourceFingerprints.aggregateSha256;
}

export function materializeStructuralProposalReviews(
  structuralProposals,
  reviewLog,
  structuralIntent = null
) {
  if (structuralProposals?.schema !== 'structural-proposals-v1.0') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'structuralProposals debe usar structural-proposals-v1.0.');
  }
  const log = assertValidStructuralProposalReviewLog(reviewLog);
  const latestByProposal = new Map();
  for (const event of log.events) {
    for (const decision of event.decisions) latestByProposal.set(decision.proposalId, { event, decision });
  }
  return structuralProposals.proposals.map((proposal) => {
    const latest = latestByProposal.get(proposal.proposalId);
    if (!latest) return { proposal: cloneJson(proposal), reviewState: 'pending', reviewEventId: null };
    const exact = exactReviewState(
      proposal,
      latest.decision,
      structuralProposals,
      structuralIntent
    );
    return {
      proposal: cloneJson(proposal),
      reviewState: exact ? latest.decision.disposition : 'superseded',
      reviewEventId: latest.event.eventId,
      reviewedFingerprint: latest.decision.proposalFingerprint,
      currentFingerprint: proposal.proposalFingerprint
    };
  }).sort((a, b) => compareText(a.proposal.proposalId, b.proposal.proposalId));
}

export function serializeStructuralProposalReviewLog(log) {
  return `${JSON.stringify(canonicalizeValue(assertValidStructuralProposalReviewLog(log)), null, 2)}\n`;
}
