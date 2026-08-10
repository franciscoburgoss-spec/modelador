import {
  setElementIntent,
  setElementIntentsBatch,
  setRoofIntent
} from './structuralIntent.js';
import { fingerprintStructuralIntentTarget } from './structuralIntentTrace.js';
import {
  appendStructuralProposalReview
} from './structuralProposalReviews.js';
import {
  StructuralProposalError,
  canonicalizeValue,
  cloneJson,
  compareText,
  fingerprint,
  idToken,
  isRecord,
  sameFingerprintSet,
  semanticId
} from './structuralProposalCommon.js';

export const PREPARED_STRUCTURAL_PROPOSAL_DECISION_SCHEMA =
  'prepared-structural-proposal-decision-v1';

const ACCEPT_DISPOSITIONS = new Set(['accepted', 'modifiedAndAccepted']);
const REVIEW_ONLY_DISPOSITIONS = new Set(['rejected', 'deferred']);
const ALL_DISPOSITIONS = new Set([...ACCEPT_DISPOSITIONS, ...REVIEW_ONLY_DISPOSITIONS]);

function targetIntent(model, targetType, targetId) {
  if (targetType === 'element') {
    return model.structuralIntent?.elementIntents?.find(
      (intent) => idToken(intent.elementId) === idToken(targetId)
    ) || null;
  }
  if (targetType === 'roof') {
    return model.structuralIntent?.roofIntents?.find(
      (intent) => idToken(intent.roofGeometryId) === idToken(targetId)
    ) || null;
  }
  throw new StructuralProposalError(
    'SI-PROPOSAL-DECISION-INVALID',
    `El tipo de objetivo ${String(targetType)} no está permitido.`
  );
}

function proposalById(structuralProposals, proposalId) {
  if (structuralProposals?.schema !== 'structural-proposals-v1.0') {
    throw new StructuralProposalError(
      'SI-PROPOSAL-INPUT-INVALID',
      'structuralProposals debe usar structural-proposals-v1.0.'
    );
  }
  const proposal = structuralProposals.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-REFERENCE-NOT-FOUND',
      `No existe la propuesta ${String(proposalId)}.`,
      { proposalId }
    );
  }
  return proposal;
}

function normalizePatch(proposal, disposition, modifiedIntentPatch) {
  if (!ACCEPT_DISPOSITIONS.has(disposition)) return null;
  if (disposition === 'accepted') return cloneJson(proposal.proposedIntentPatch);
  if (!isRecord(modifiedIntentPatch)) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      'Modificar y aceptar exige un patch de intención.'
    );
  }
  if ('targetId' in modifiedIntentPatch || 'elementId' in modifiedIntentPatch || 'roofGeometryId' in modifiedIntentPatch) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-TARGET-CHANGE-NOT-ALLOWED',
      'Modificar y aceptar no permite cambiar el objetivo.'
    );
  }
  return { ...cloneJson(proposal.proposedIntentPatch), ...cloneJson(modifiedIntentPatch) };
}

export function prepareStructuralProposalDecision({
  model,
  structuralProposals,
  proposalId,
  disposition,
  modifiedIntentPatch = null,
  reasonCode = null,
  note = null,
  visualFingerprint = null
}) {
  if (!isRecord(model)) {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'El modelo debe ser un objeto.');
  }
  if (!ALL_DISPOSITIONS.has(disposition)) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      `La disposición ${String(disposition)} no está permitida.`
    );
  }
  const proposal = proposalById(structuralProposals, proposalId);
  if (ACCEPT_DISPOSITIONS.has(disposition) && proposal.candidateState === 'blockedCandidate') {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      'Una propuesta bloqueada no puede aceptarse.'
    );
  }
  const patch = normalizePatch(proposal, disposition, modifiedIntentPatch);
  const previous = targetIntent(model, proposal.targetType, proposal.targetId);
  const previousFingerprint = fingerprintStructuralIntentTarget(
    proposal.targetType,
    proposal.targetId,
    previous
  );
  const payload = {
    schema: PREPARED_STRUCTURAL_PROPOSAL_DECISION_SCHEMA,
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
    sourceFingerprints: cloneJson(structuralProposals.sourceFingerprints),
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    previousIntentFingerprint: previousFingerprint,
    visualFingerprint,
    disposition,
    reasonCode,
    note,
    proposedIntentPatch: patch,
    before: cloneJson(previous),
    afterPreview: patch === null ? cloneJson(previous) : cloneJson(patch),
    expectedEffects: {
      historySteps: 1,
      reviewEvents: 1,
      intentTraceEvents: ACCEPT_DISPOSITIONS.has(disposition) ? 1 : 0,
      changesIntent: ACCEPT_DISPOSITIONS.has(disposition)
    }
  };
  return canonicalizeValue({
    ...payload,
    decisionFingerprint: fingerprint(payload)
  });
}

function assertPrepared(prepared) {
  if (!isRecord(prepared) || prepared.schema !== PREPARED_STRUCTURAL_PROPOSAL_DECISION_SCHEMA) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      `La decisión preparada debe usar ${PREPARED_STRUCTURAL_PROPOSAL_DECISION_SCHEMA}.`
    );
  }
  if (!ALL_DISPOSITIONS.has(prepared.disposition)) {
    throw new StructuralProposalError('SI-PROPOSAL-DECISION-INVALID', 'La disposición preparada no es válida.');
  }
}

function stale(message, details = {}) {
  throw new StructuralProposalError('SI-PROPOSAL-STALE', message, details);
}

function assertPreparedDecisionFresh({
  model,
  structuralProposals,
  preparedDecision,
  currentVisualFingerprint = null
}) {
  assertPrepared(preparedDecision);
  const proposal = proposalById(structuralProposals, preparedDecision.proposalId);
  if (proposal.proposalFingerprint !== preparedDecision.proposalFingerprint) {
    stale('La propuesta cambió desde la previsualización.', {
      expected: preparedDecision.proposalFingerprint,
      actual: proposal.proposalFingerprint
    });
  }
  if (!sameFingerprintSet(
    structuralProposals.sourceFingerprints,
    preparedDecision.sourceFingerprints
  )) {
    stale('Las fuentes de la propuesta cambiaron desde la previsualización.');
  }
  if (proposal.targetType !== preparedDecision.targetType
    || idToken(proposal.targetId) !== idToken(preparedDecision.targetId)) {
    stale('El objetivo de la propuesta cambió desde la previsualización.');
  }
  const currentIntent = targetIntent(model, proposal.targetType, proposal.targetId);
  const currentIntentFingerprint = fingerprintStructuralIntentTarget(
    proposal.targetType,
    proposal.targetId,
    currentIntent
  );
  if (currentIntentFingerprint !== preparedDecision.previousIntentFingerprint) {
    stale('La intención vigente del objetivo cambió desde la previsualización.');
  }
  if (preparedDecision.visualFingerprint !== null
    && currentVisualFingerprint !== preparedDecision.visualFingerprint) {
    stale('La geometría visual cambió desde la previsualización.');
  }
  return { proposal, currentIntentFingerprint };
}

function batchIntentInput(patch) {
  return {
    participation: patch.participation,
    functions: cloneJson(patch.functions),
    secondaryInteraction: patch.secondaryInteraction,
    notesMode: 'replace',
    notes: patch.notes ?? null
  };
}

function samePatch(left, right) {
  return fingerprint(canonicalizeValue(left)) === fingerprint(canonicalizeValue(right));
}

export function applyStructuralProposalDecision({
  model,
  structuralProposals,
  preparedDecision,
  confirmed = false,
  currentVisualFingerprint = null
}) {
  if (!confirmed) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      'La decisión requiere confirmación explícita.'
    );
  }
  const { proposal, currentIntentFingerprint } = assertPreparedDecisionFresh({
    model,
    structuralProposals,
    preparedDecision,
    currentVisualFingerprint
  });

  let nextModel = model;
  let changedIntent = false;
  let appliedIntentFingerprint = currentIntentFingerprint;
  if (ACCEPT_DISPOSITIONS.has(preparedDecision.disposition)) {
    const outcome = proposal.targetType === 'element'
      ? setElementIntent(
          model,
          proposal.targetId,
          preparedDecision.proposedIntentPatch,
          { recordUserAction: true }
        )
      : setRoofIntent(
          model,
          proposal.targetId,
          preparedDecision.proposedIntentPatch,
          { recordUserAction: true }
        );
    nextModel = outcome.model;
    changedIntent = nextModel !== model;
    const applied = targetIntent(nextModel, proposal.targetType, proposal.targetId);
    appliedIntentFingerprint = fingerprintStructuralIntentTarget(
      proposal.targetType,
      proposal.targetId,
      applied
    );
  }

  const reviewDecision = {
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
    sourceAggregateSha256: structuralProposals.sourceFingerprints.aggregateSha256,
    disposition: preparedDecision.disposition,
    reasonCode: preparedDecision.reasonCode,
    note: preparedDecision.note,
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    appliedIntentFingerprint
  };
  nextModel = appendStructuralProposalReview(nextModel, [reviewDecision]);
  return {
    model: nextModel,
    proposalId: proposal.proposalId,
    disposition: preparedDecision.disposition,
    changedIntent,
    reviewDecision: cloneJson(reviewDecision),
    transactionId: semanticId('proposal-decision', {
      decisionFingerprint: preparedDecision.decisionFingerprint,
      reviewDecision
    })
  };
}

export function applyStructuralProposalDecisionBatch({
  model,
  structuralProposals,
  preparedDecisions,
  confirmed = false,
  currentVisualFingerprints = {}
}) {
  if (!confirmed) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-DECISION-INVALID',
      'La decisión de lote requiere confirmación explícita.'
    );
  }
  if (!Array.isArray(preparedDecisions) || preparedDecisions.length < 2) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-BATCH-INVALID',
      'El lote requiere al menos dos decisiones preparadas.'
    );
  }
  const proposalIds = new Set();
  const disposition = preparedDecisions[0]?.disposition;
  const validated = preparedDecisions.map((preparedDecision) => {
    if (preparedDecision.disposition !== disposition) {
      throw new StructuralProposalError(
        'SI-PROPOSAL-BATCH-NOT-HOMOGENEOUS',
        'Todas las decisiones del lote deben usar la misma disposición.'
      );
    }
    if (proposalIds.has(preparedDecision.proposalId)) {
      throw new StructuralProposalError(
        'SI-PROPOSAL-BATCH-DUPLICATE',
        'El lote repite una propuesta.'
      );
    }
    proposalIds.add(preparedDecision.proposalId);
    return {
      preparedDecision,
      ...assertPreparedDecisionFresh({
        model,
        structuralProposals,
        preparedDecision,
        currentVisualFingerprint: currentVisualFingerprints[preparedDecision.proposalId] ?? null
      })
    };
  });

  let nextModel = model;
  let changedIntent = false;
  if (ACCEPT_DISPOSITIONS.has(disposition)) {
    if (validated.some(({ proposal }) => proposal.targetType !== 'element')) {
      throw new StructuralProposalError(
        'SI-PROPOSAL-BATCH-NOT-HOMOGENEOUS',
        'La aceptación por lote sólo admite propuestas homogéneas sobre elementos.'
      );
    }
    const referencePatch = validated[0].preparedDecision.proposedIntentPatch;
    if (validated.some(({ preparedDecision }) => (
      !samePatch(referencePatch, preparedDecision.proposedIntentPatch)
    ))) {
      throw new StructuralProposalError(
        'SI-PROPOSAL-BATCH-NOT-HOMOGENEOUS',
        'Las propuestas aceptadas por lote deben aplicar el mismo patch de intención.'
      );
    }
    const outcome = setElementIntentsBatch(
      model,
      validated.map(({ proposal }) => proposal.targetId),
      batchIntentInput(referencePatch),
      {
        recordUserAction: true,
        expectedPrevious: validated.map(({ proposal, preparedDecision }) => ({
          elementId: proposal.targetId,
          fingerprint: preparedDecision.previousIntentFingerprint
        }))
      }
    );
    nextModel = outcome.model;
    changedIntent = nextModel !== model;
  }

  const reviewDecisions = validated.map(({ proposal, preparedDecision, currentIntentFingerprint }) => {
    const appliedIntent = targetIntent(nextModel, proposal.targetType, proposal.targetId);
    return {
      proposalId: proposal.proposalId,
      proposalFingerprint: proposal.proposalFingerprint,
      sourceAggregateSha256: structuralProposals.sourceFingerprints.aggregateSha256,
      disposition,
      reasonCode: preparedDecision.reasonCode,
      note: preparedDecision.note,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      appliedIntentFingerprint: ACCEPT_DISPOSITIONS.has(disposition)
        ? fingerprintStructuralIntentTarget(proposal.targetType, proposal.targetId, appliedIntent)
        : currentIntentFingerprint
    };
  });
  nextModel = appendStructuralProposalReview(nextModel, reviewDecisions);
  return {
    model: nextModel,
    proposalIds: [...proposalIds].sort(compareText),
    disposition,
    changedIntent,
    reviewDecisions: cloneJson(reviewDecisions),
    transactionId: semanticId('proposal-decision-batch', {
      decisionFingerprints: preparedDecisions.map((item) => item.decisionFingerprint).sort(compareText),
      reviewDecisions
    })
  };
}
