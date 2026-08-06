import { appendStructuralIntentUserEvent, fingerprintStructuralIntentTarget } from './structuralIntentTrace.js';

import {
  ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE,
  RoofStructuralIntentError,
  buildRoofIntent,
  canonicalizeRoofBoundaryFinding,
  canonicalizeRoofIntent,
  compareRoofIds,
  reconcileRoofIntentsAfterGeometryChange,
  resolveRoofGeometryForIntent,
  roofIdToken,
  validateRoofBoundaryFinding,
  validateRoofIntents
} from './roofStructuralIntent.js';

export {
  ROOF_BOUNDARY_CONFIG,
  ROOF_BOUNDARY_FUNCTIONS,
  ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE,
  ROOF_DIAPHRAGM_BEHAVIORS,
  ROOF_LOAD_DISTRIBUTIONS,
  RoofStructuralIntentError,
  canonicalizeResistanceDirection,
  canonicalizeRoofBoundaries,
  intentIdForRoof
} from './roofStructuralIntent.js';

export const STRUCTURAL_INTENT_SCHEMA = 'structural-intent-v1.0';
export const STRUCTURAL_INTENT_SPLIT_REVIEW = 'SI-INTENT-REVIEW-AFTER-SPLIT';

export const ELEMENT_PARTICIPATIONS = Object.freeze([
  'resistant',
  'secondary',
  'undetermined'
]);

export const ELEMENT_FUNCTIONS = Object.freeze([
  'gravityResistance',
  'inPlaneLateralResistance',
  'loadTransfer',
  'diaphragmAction',
  'collectorAction',
  'support',
  'stabilization',
  'spaceDivision',
  'buildingEnvelope'
]);

export const SECONDARY_INTERACTIONS = Object.freeze([
  'solidary',
  'floating',
  'undetermined',
  'notApplicable'
]);

const RESISTANT_FUNCTIONS = new Set([
  'gravityResistance',
  'inPlaneLateralResistance',
  'loadTransfer',
  'diaphragmAction',
  'collectorAction',
  'support',
  'stabilization'
]);

const SECONDARY_FUNCTIONS = new Set([
  'spaceDivision',
  'buildingEnvelope',
  'stabilization'
]);

const ROOT_COLLECTIONS = Object.freeze([
  'elementIntents',
  'roofIntents',
  'intersectionIntents',
  'supportIntents',
  'diaphragmIntents',
  'overrides'
]);

const ROOT_KEYS = new Set(['schema', ...ROOT_COLLECTIONS]);
const ELEMENT_INTENT_KEYS = new Set([
  'intentId',
  'elementId',
  'participation',
  'functions',
  'secondaryInteraction',
  'status',
  'source',
  'notes'
]);

const FUNCTION_ORDER = new Map(ELEMENT_FUNCTIONS.map((value, index) => [value, index]));

export class StructuralIntentError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'StructuralIntentError';
    this.code = code;
    this.details = details;
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareIds(a, b) {
  return compareText(idKey(a), idKey(b));
}

function sameCanonicalValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function elementIntentFor(root, elementId) {
  return root.elementIntents.find((intent) => hasSameId(intent.elementId, elementId)) ?? null;
}

function roofIntentFor(root, roofGeometryId) {
  return root.roofIntents.find((intent) => hasSameId(intent.roofGeometryId, roofGeometryId)) ?? null;
}

function maybeTrace(model, options, eventInput) {
  return options?.recordUserAction
    ? appendStructuralIntentUserEvent(model, eventInput)
    : model;
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  }
  return value;
}

function hasSameId(a, b) {
  return idKey(a) === idKey(b);
}

function elementIdSet(elements) {
  return new Set((Array.isArray(elements) ? elements : []).map((element) => idKey(element?.id)));
}

function canonicalFunctions(functions) {
  return [...functions].sort((a, b) => (
    (FUNCTION_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER)
    - (FUNCTION_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER)
    || compareText(String(a), String(b))
  ));
}

function canonicalElementIntent(intent) {
  return {
    intentId: intent.intentId,
    elementId: intent.elementId,
    participation: intent.participation,
    functions: canonicalFunctions(intent.functions),
    secondaryInteraction: intent.secondaryInteraction,
    status: intent.status,
    source: intent.source,
    notes: intent.notes
  };
}

export function createEmptyStructuralIntent() {
  return {
    schema: STRUCTURAL_INTENT_SCHEMA,
    elementIntents: [],
    roofIntents: [],
    intersectionIntents: [],
    supportIntents: [],
    diaphragmIntents: [],
    overrides: []
  };
}

export function intentIdForElement(elementId) {
  return typeof elementId === 'string'
    ? `intent:element:string:${encodeURIComponent(elementId)}`
    : `intent:element:${String(elementId)}`;
}

export function canonicalizeStructuralIntent(structuralIntent) {
  if (!isRecord(structuralIntent)) return structuralIntent;
  const canonical = createEmptyStructuralIntent();
  canonical.schema = structuralIntent.schema;
  for (const collection of ROOT_COLLECTIONS) {
    canonical[collection] = Array.isArray(structuralIntent[collection])
      ? structuralIntent[collection].map(cloneJson)
      : structuralIntent[collection];
  }
  if (Array.isArray(canonical.elementIntents)) {
    canonical.elementIntents = canonical.elementIntents
      .map((intent) => (isRecord(intent) && Array.isArray(intent.functions)
        ? canonicalElementIntent(intent)
        : cloneJson(intent)))
      .sort((a, b) => compareIds(a?.elementId, b?.elementId));
  }
  if (Array.isArray(canonical.roofIntents)) {
    canonical.roofIntents = canonical.roofIntents
      .map((intent) => canonicalizeRoofIntent(intent))
      .sort((a, b) => compareRoofIds(a?.roofGeometryId, b?.roofGeometryId));
  }
  return canonical;
}

function validateElementIntent(intent, index, ids, intentIds, issues) {
  const path = `structuralIntent.elementIntents[${index}]`;
  if (!isRecord(intent)) {
    addIssue(issues, path, 'SI-EXPECTED-OBJECT', 'La intención de elemento debe ser un objeto.');
    return;
  }

  for (const key of Object.keys(intent)) {
    if (!ELEMENT_INTENT_KEYS.has(key)) {
      addIssue(issues, `${path}.${key}`, 'SI-UNKNOWN-FIELD', `El campo ${key} no pertenece al contrato.`);
    }
  }

  if (intent.elementId === undefined || intent.elementId === null || intent.elementId === '') {
    addIssue(issues, `${path}.elementId`, 'SI-MISSING-ELEMENT-ID', 'Falta elementId.');
  } else if (!ids.has(idKey(intent.elementId))) {
    addIssue(
      issues,
      `${path}.elementId`,
      'SI-ELEMENT-REFERENCE-NOT-FOUND',
      `elementId ${String(intent.elementId)} no referencia un elemento existente.`
    );
  }

  const expectedIntentId = intentIdForElement(intent.elementId);
  if (intent.intentId !== expectedIntentId) {
    addIssue(
      issues,
      `${path}.intentId`,
      'SI-INVALID-INTENT-ID',
      `intentId debe ser ${expectedIntentId}.`
    );
  }
  if (intentIds.has(intent.intentId)) {
    addIssue(issues, `${path}.intentId`, 'SI-DUPLICATE-INTENT-ID', `intentId ${String(intent.intentId)} está duplicado.`);
  }
  intentIds.add(intent.intentId);

  const targetKey = idKey(intent.elementId);
  if (ids.currentTargets.has(targetKey)) {
    addIssue(
      issues,
      `${path}.elementId`,
      'SI-DUPLICATE-ELEMENT-INTENT',
      `Ya existe una intención vigente para ${String(intent.elementId)}.`
    );
  }
  ids.currentTargets.add(targetKey);

  if (!ELEMENT_PARTICIPATIONS.includes(intent.participation)) {
    addIssue(
      issues,
      `${path}.participation`,
      'SI-INVALID-PARTICIPATION',
      `participation ${String(intent.participation)} no está permitida.`
    );
  }

  if (!Array.isArray(intent.functions)) {
    addIssue(issues, `${path}.functions`, 'SI-EXPECTED-ARRAY', 'functions debe ser un arreglo.');
  } else {
    const seenFunctions = new Set();
    for (let functionIndex = 0; functionIndex < intent.functions.length; functionIndex += 1) {
      const value = intent.functions[functionIndex];
      if (!ELEMENT_FUNCTIONS.includes(value)) {
        addIssue(
          issues,
          `${path}.functions[${functionIndex}]`,
          'SI-INVALID-FUNCTION',
          `La función ${String(value)} no está permitida.`
        );
      }
      if (seenFunctions.has(value)) {
        addIssue(
          issues,
          `${path}.functions[${functionIndex}]`,
          'SI-DUPLICATE-FUNCTION',
          `La función ${String(value)} está duplicada.`
        );
      }
      seenFunctions.add(value);
    }

    if (
      intent.participation === 'resistant'
      && !intent.functions.some((value) => RESISTANT_FUNCTIONS.has(value))
    ) {
      addIssue(
        issues,
        `${path}.functions`,
        'SI-RESISTANT-FUNCTION-REQUIRED',
        'Una intención resistant requiere al menos una función resistente.'
      );
    }

    if (
      intent.participation === 'secondary'
      && intent.functions.some((value) => !SECONDARY_FUNCTIONS.has(value))
    ) {
      addIssue(
        issues,
        `${path}.functions`,
        'SI-SECONDARY-FUNCTION-NOT-ALLOWED',
        'Una intención secondary sólo admite spaceDivision, buildingEnvelope o stabilization.'
      );
    }
  }

  if (!SECONDARY_INTERACTIONS.includes(intent.secondaryInteraction)) {
    addIssue(
      issues,
      `${path}.secondaryInteraction`,
      'SI-INVALID-SECONDARY-INTERACTION',
      `secondaryInteraction ${String(intent.secondaryInteraction)} no está permitida.`
    );
  } else if (intent.participation === 'secondary') {
    if (intent.secondaryInteraction === 'notApplicable') {
      addIssue(
        issues,
        `${path}.secondaryInteraction`,
        'SI-SECONDARY-INTERACTION-REQUIRED',
        'Una intención secondary debe declarar solidary, floating o undetermined.'
      );
    }
  } else if (intent.secondaryInteraction !== 'notApplicable') {
    addIssue(
      issues,
      `${path}.secondaryInteraction`,
      'SI-SECONDARY-INTERACTION-NOT-APPLICABLE',
      'secondaryInteraction debe ser notApplicable cuando participation no es secondary.'
    );
  }

  if (intent.status !== 'declared') {
    addIssue(issues, `${path}.status`, 'SI-INVALID-STATUS', 'status debe ser declared.');
  }
  if (intent.source !== 'userDeclared') {
    addIssue(issues, `${path}.source`, 'SI-INVALID-SOURCE', 'source debe ser userDeclared.');
  }
  if (intent.notes !== null && typeof intent.notes !== 'string') {
    addIssue(issues, `${path}.notes`, 'SI-INVALID-NOTES', 'notes debe ser texto o null.');
  }
}

export function validateStructuralIntent(structuralIntent, elements = [], roofGeometry = []) {
  const issues = [];
  if (!isRecord(structuralIntent)) {
    return [{
      path: 'structuralIntent',
      code: 'SI-EXPECTED-OBJECT',
      message: 'structuralIntent debe ser un objeto.'
    }];
  }

  for (const key of Object.keys(structuralIntent)) {
    if (!ROOT_KEYS.has(key)) {
      addIssue(
        issues,
        `structuralIntent.${key}`,
        'SI-UNKNOWN-ROOT-FIELD',
        `El campo raíz ${key} no pertenece a structural-intent-v1.0.`
      );
    }
  }

  if (structuralIntent.schema !== STRUCTURAL_INTENT_SCHEMA) {
    addIssue(
      issues,
      'structuralIntent.schema',
      'SI-INVALID-SCHEMA',
      `schema debe ser ${STRUCTURAL_INTENT_SCHEMA}.`
    );
  }

  for (const collection of ROOT_COLLECTIONS) {
    if (!Array.isArray(structuralIntent[collection])) {
      addIssue(
        issues,
        `structuralIntent.${collection}`,
        'SI-EXPECTED-ARRAY',
        `${collection} debe ser un arreglo.`
      );
    }
  }

  for (const collection of [
    'intersectionIntents',
    'supportIntents',
    'diaphragmIntents',
    'overrides'
  ]) {
    if (Array.isArray(structuralIntent[collection]) && structuralIntent[collection].length > 0) {
      addIssue(
        issues,
        `structuralIntent.${collection}`,
        'SI-COLLECTION-NOT-ACTIVE',
        `${collection} debe permanecer vacío en SPEC-015-A.`
      );
    }
  }

  if (Array.isArray(structuralIntent.elementIntents)) {
    const ids = elementIdSet(elements);
    ids.currentTargets = new Set();
    const intentIds = new Set();
    structuralIntent.elementIntents.forEach((intent, index) => {
      validateElementIntent(intent, index, ids, intentIds, issues);
    });
  }
  issues.push(...validateRoofIntents(structuralIntent.roofIntents, roofGeometry));

  return issues;
}

export function canonicalizeStructuralIntentFindings(findings) {
  if (findings === undefined) return undefined;
  if (!Array.isArray(findings)) return findings;
  return findings.map((finding) => {
    if (!isRecord(finding)) return cloneJson(finding);
    if (finding.code === ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE) {
      return canonicalizeRoofBoundaryFinding(finding);
    }
    return {
      ...cloneJson(finding),
      ...(Array.isArray(finding.targetElementIds)
        ? { targetElementIds: [...finding.targetElementIds].sort(compareIds) }
        : {})
    };
  }).sort((a, b) => compareText(String(a?.findingId), String(b?.findingId)));
}

export function validateStructuralIntentFindings(findings, elements = [], roofGeometry = []) {
  if (findings === undefined) return [];
  const issues = [];
  if (!Array.isArray(findings)) {
    return [{
      path: 'structuralIntentFindings',
      code: 'SI-EXPECTED-ARRAY',
      message: 'structuralIntentFindings debe ser un arreglo.'
    }];
  }
  const targets = elementIdSet(elements);
  const roofGeometryIds = new Set((Array.isArray(roofGeometry) ? roofGeometry : []).map((roof) => roofIdToken(roof?.id)));
  const findingIds = new Set();
  findings.forEach((finding, index) => {
    const path = `structuralIntentFindings[${index}]`;
    if (!isRecord(finding)) {
      addIssue(issues, path, 'SI-EXPECTED-OBJECT', 'El finding debe ser un objeto.');
      return;
    }
    if (typeof finding.findingId !== 'string' || finding.findingId.length === 0) {
      addIssue(issues, `${path}.findingId`, 'SI-INVALID-FINDING-ID', 'findingId debe ser texto no vacío.');
    } else if (findingIds.has(finding.findingId)) {
      addIssue(issues, `${path}.findingId`, 'SI-DUPLICATE-FINDING-ID', `findingId ${finding.findingId} está duplicado.`);
    }
    findingIds.add(finding.findingId);
    if (validateRoofBoundaryFinding(finding, path, roofGeometryIds, issues)) return;
    if (finding.code !== STRUCTURAL_INTENT_SPLIT_REVIEW) {
      addIssue(issues, `${path}.code`, 'SI-INVALID-FINDING-CODE', 'Código de finding no permitido.');
    }
    if (finding.status !== 'open' || finding.severity !== 'warning') {
      addIssue(issues, path, 'SI-INVALID-FINDING-STATE', 'El finding de división debe permanecer open/warning.');
    }
    if (!Array.isArray(finding.targetElementIds) || finding.targetElementIds.length !== 2) {
      addIssue(issues, `${path}.targetElementIds`, 'SI-INVALID-FINDING-TARGETS', 'La revisión de división requiere dos elementos destino.');
    } else {
      finding.targetElementIds.forEach((elementId, targetIndex) => {
        if (!targets.has(idKey(elementId))) {
          addIssue(
            issues,
            `${path}.targetElementIds[${targetIndex}]`,
            'SI-ELEMENT-REFERENCE-NOT-FOUND',
            `El destino ${String(elementId)} no existe.`
          );
        }
      });
    }
    if (!isRecord(finding.originalIntent)) {
      addIssue(issues, `${path}.originalIntent`, 'SI-EXPECTED-OBJECT', 'Debe conservarse la intención original.');
    }
  });
  return issues;
}

export function assertValidStructuralIntent(structuralIntent, elements = [], roofGeometry = []) {
  const issues = validateStructuralIntent(structuralIntent, elements, roofGeometry);
  if (issues.length > 0) {
    throw new StructuralIntentError(
      'SI-VALIDATION-FAILED',
      `La intención estructural no cumple el contrato (${issues.length} problema${issues.length === 1 ? '' : 's'}).`,
      issues
    );
  }
  return canonicalizeStructuralIntent(structuralIntent);
}

function requireModel(model) {
  if (!isRecord(model) || !Array.isArray(model.elements)) {
    throw new StructuralIntentError('SI-INVALID-MODEL', 'El modelo debe declarar elements[].');
  }
}

function currentRoot(model) {
  return model.structuralIntent ?? createEmptyStructuralIntent();
}

function buildElementIntent(elementId, input) {
  if (!isRecord(input)) {
    throw new StructuralIntentError('SI-INVALID-INTENT', 'La intención debe ser un objeto.');
  }
  for (const key of Object.keys(input)) {
    if (!ELEMENT_INTENT_KEYS.has(key)) {
      throw new StructuralIntentError(
        'SI-UNKNOWN-FIELD',
        `El campo ${key} no pertenece al contrato de intención de elemento.`
      );
    }
  }
  if (input.elementId !== undefined && !hasSameId(input.elementId, elementId)) {
    throw new StructuralIntentError('SI-ELEMENT-ID-MISMATCH', 'elementId no coincide con el objetivo de la mutación.');
  }
  const intentId = intentIdForElement(elementId);
  if (input.intentId !== undefined && input.intentId !== intentId) {
    throw new StructuralIntentError('SI-INTENT-ID-MISMATCH', `intentId debe ser ${intentId}.`);
  }
  if (input.status !== undefined && input.status !== 'declared') {
    throw new StructuralIntentError('SI-INVALID-STATUS', 'status debe ser declared.');
  }
  if (input.source !== undefined && input.source !== 'userDeclared') {
    throw new StructuralIntentError('SI-INVALID-SOURCE', 'source debe ser userDeclared.');
  }
  const participation = input.participation;
  return {
    intentId,
    elementId,
    participation,
    functions: Array.isArray(input.functions) ? [...input.functions] : input.functions,
    secondaryInteraction: input.secondaryInteraction
      ?? (participation === 'secondary' ? 'undetermined' : 'notApplicable'),
    status: 'declared',
    source: 'userDeclared',
    notes: input.notes ?? null
  };
}

function result(model, affectedElementIds, extra = {}) {
  return {
    model,
    affectedElementIds: [...affectedElementIds],
    invalidatedStructuralDerivatives: [],
    ...extra,
    affectedRoofGeometryIds: [...(extra.affectedRoofGeometryIds || [])]
  };
}

export function setElementIntent(model, elementId, input, options = {}) {
  requireModel(model);
  const target = model.elements.find((element) => hasSameId(element?.id, elementId));
  if (!target) {
    throw new StructuralIntentError(
      'SI-ELEMENT-REFERENCE-NOT-FOUND',
      `No existe el elemento ${String(elementId)}.`
    );
  }
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  const candidate = buildElementIntent(target.id, input);
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    elementIntents: [
      ...root.elementIntents.filter((intent) => !hasSameId(intent.elementId, target.id)),
      candidate
    ]
  });
  assertValidStructuralIntent(nextRoot, model.elements, roofGeometryForCurrentIntents(model, nextRoot));
  const previousIntent = elementIntentFor(root, target.id);
  const nextIntent = elementIntentFor(nextRoot, target.id);
  if (sameCanonicalValue(previousIntent, nextIntent)) return result(model, []);
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot },
    options,
    {
      operation: 'set',
      targetType: 'element',
      changes: [{ targetId: target.id, previousIntent, nextIntent }]
    }
  );
  return result(nextModel, [target.id]);
}

export function removeElementIntent(model, elementId, options = {}) {
  requireModel(model);
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  const existing = root.elementIntents.find((intent) => hasSameId(intent.elementId, elementId));
  if (!existing) return result(model, []);
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    elementIntents: root.elementIntents.filter((intent) => !hasSameId(intent.elementId, elementId))
  });
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot },
    options,
    {
      operation: 'remove',
      targetType: 'element',
      changes: [{ targetId: existing.elementId, previousIntent: existing, nextIntent: null }]
    }
  );
  return result(nextModel, [existing.elementId]);
}


function canonicalBatchTargets(elementIds) {
  if (!Array.isArray(elementIds) || elementIds.length === 0) {
    throw new StructuralIntentError('SI-BATCH-TARGETS-EMPTY', 'La asignación masiva requiere al menos un objetivo.');
  }
  const seen = new Set();
  const duplicates = [];
  for (const elementId of elementIds) {
    const key = idKey(elementId);
    if (seen.has(key)) duplicates.push(elementId);
    seen.add(key);
  }
  if (duplicates.length > 0) {
    throw new StructuralIntentError(
      'SI-BATCH-DUPLICATE-TARGET',
      'La selección masiva contiene objetivos duplicados.',
      duplicates.map((elementId) => ({
        path: 'elementIds',
        code: 'SI-BATCH-DUPLICATE-TARGET',
        elementId
      }))
    );
  }
  return [...elementIds].sort(compareIds);
}

function validateExpectedPrevious(expectedPrevious, targetIds, root) {
  if (expectedPrevious === undefined) return;
  if (!Array.isArray(expectedPrevious)) {
    throw new StructuralIntentError('SI-BATCH-PREVIEW-INVALID', 'expectedPrevious debe ser un arreglo.');
  }
  const expected = new Map();
  for (const entry of expectedPrevious) {
    if (!isRecord(entry) || !/^[a-f0-9]{64}$/.test(entry.fingerprint)) {
      throw new StructuralIntentError('SI-BATCH-PREVIEW-INVALID', 'Cada fingerprint esperado debe ser SHA-256 hexadecimal.');
    }
    const key = idKey(entry.elementId);
    if (expected.has(key)) {
      throw new StructuralIntentError('SI-BATCH-PREVIEW-INVALID', 'expectedPrevious contiene objetivos duplicados.');
    }
    expected.set(key, entry.fingerprint);
  }
  const stale = [];
  for (const elementId of targetIds) {
    const key = idKey(elementId);
    const current = elementIntentFor(root, elementId);
    const actual = fingerprintStructuralIntentTarget('element', elementId, current);
    if (!expected.has(key) || expected.get(key) !== actual) {
      stale.push({ elementId, expected: expected.get(key) ?? null, actual });
    }
  }
  if (stale.length > 0 || expected.size !== targetIds.length) {
    throw new StructuralIntentError(
      'SI-BATCH-PREVIEW-STALE',
      'La previsualización quedó obsoleta; recargue los valores antes de confirmar.',
      stale
    );
  }
}

function buildBatchCandidate(elementId, input, previousIntent) {
  if (!isRecord(input)) {
    throw new StructuralIntentError('SI-BATCH-CANDIDATE-INVALID', 'La declaración masiva debe ser un objeto.');
  }
  const allowed = new Set([
    'participation', 'functions', 'secondaryInteraction', 'notesMode', 'notes'
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new StructuralIntentError('SI-BATCH-CANDIDATE-INVALID', `El campo ${key} no pertenece al contrato masivo.`);
    }
  }
  const notesMode = input.notesMode ?? 'preserve';
  if (!['preserve', 'replace'].includes(notesMode)) {
    throw new StructuralIntentError('SI-BATCH-CANDIDATE-INVALID', 'notesMode debe ser preserve o replace.');
  }
  if (notesMode === 'replace' && input.notes !== null && typeof input.notes !== 'string') {
    throw new StructuralIntentError('SI-BATCH-CANDIDATE-INVALID', 'notes debe ser texto o null.');
  }
  return buildElementIntent(elementId, {
    participation: input.participation,
    functions: input.functions,
    secondaryInteraction: input.secondaryInteraction,
    notes: notesMode === 'preserve' ? previousIntent?.notes ?? null : input.notes ?? null
  });
}

export function setElementIntentsBatch(model, elementIds, input, options = {}) {
  requireModel(model);
  const targetIds = canonicalBatchTargets(elementIds);
  const targetsById = new Map(model.elements.map((element) => [idKey(element?.id), element]));
  const missing = targetIds.filter((elementId) => !targetsById.has(idKey(elementId)));
  if (missing.length > 0) {
    throw new StructuralIntentError(
      'SI-BATCH-TARGET-NOT-FOUND',
      'Uno o más objetivos de la asignación masiva no existen.',
      missing.map((elementId) => ({ path: 'elementIds', elementId }))
    );
  }
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  validateExpectedPrevious(options.expectedPrevious, targetIds, root);

  let candidates;
  try {
    candidates = targetIds.map((elementId) => {
      const target = targetsById.get(idKey(elementId));
      const previousIntent = elementIntentFor(root, target.id);
      return {
        elementId: target.id,
        previousIntent,
        nextIntent: buildBatchCandidate(target.id, input, previousIntent)
      };
    });
  } catch (error) {
    if (error instanceof StructuralIntentError && error.code.startsWith('SI-BATCH-')) throw error;
    throw new StructuralIntentError(
      'SI-BATCH-CANDIDATE-INVALID',
      error instanceof Error ? error.message : 'No fue posible construir la declaración masiva.',
      error?.details || []
    );
  }

  const replacementKeys = new Set(candidates.map((entry) => idKey(entry.elementId)));
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    elementIntents: [
      ...root.elementIntents.filter((intent) => !replacementKeys.has(idKey(intent.elementId))),
      ...candidates.map((entry) => entry.nextIntent)
    ]
  });
  try {
    assertValidStructuralIntent(nextRoot, model.elements, roofGeometryForCurrentIntents(model, nextRoot));
  } catch (error) {
    throw new StructuralIntentError(
      'SI-BATCH-CANDIDATE-INVALID',
      'La declaración masiva contiene una combinación inválida.',
      error?.details || []
    );
  }
  const effective = candidates.filter((entry) => (
    !sameCanonicalValue(entry.previousIntent, elementIntentFor(nextRoot, entry.elementId))
  )).map((entry) => ({
    ...entry,
    nextIntent: elementIntentFor(nextRoot, entry.elementId)
  }));
  if (effective.length === 0) return result(model, []);
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot },
    options,
    {
      operation: 'batchSet',
      targetType: 'element',
      changes: effective.map((entry) => ({
        targetId: entry.elementId,
        previousIntent: entry.previousIntent,
        nextIntent: entry.nextIntent
      }))
    }
  );
  return result(nextModel, effective.map((entry) => entry.elementId), {
    changes: effective
  });
}

export function removeElementIntentsBatch(model, elementIds, options = {}) {
  requireModel(model);
  const targetIds = canonicalBatchTargets(elementIds);
  const targetsById = new Map(model.elements.map((element) => [idKey(element?.id), element]));
  const missing = targetIds.filter((elementId) => !targetsById.has(idKey(elementId)));
  if (missing.length > 0) {
    throw new StructuralIntentError(
      'SI-BATCH-TARGET-NOT-FOUND',
      'Uno o más objetivos de la eliminación masiva no existen.',
      missing.map((elementId) => ({ path: 'elementIds', elementId }))
    );
  }
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  validateExpectedPrevious(options.expectedPrevious, targetIds, root);
  const effective = targetIds.map((elementId) => ({
    elementId: targetsById.get(idKey(elementId)).id,
    previousIntent: elementIntentFor(root, targetsById.get(idKey(elementId)).id)
  })).filter((entry) => entry.previousIntent !== null);
  if (effective.length === 0) return result(model, []);
  const removalKeys = new Set(effective.map((entry) => idKey(entry.elementId)));
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    elementIntents: root.elementIntents.filter((intent) => !removalKeys.has(idKey(intent.elementId)))
  });
  assertValidStructuralIntent(nextRoot, model.elements, roofGeometryForCurrentIntents(model, nextRoot));
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot },
    options,
    {
      operation: 'batchRemove',
      targetType: 'element',
      changes: effective.map((entry) => ({
        targetId: entry.elementId,
        previousIntent: entry.previousIntent,
        nextIntent: null
      }))
    }
  );
  return result(nextModel, effective.map((entry) => entry.elementId), {
    changes: effective.map((entry) => ({ ...entry, nextIntent: null }))
  });
}

export function clearStructuralIntent(model) {
  requireModel(model);
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  const affectedElementIds = root.elementIntents.map((intent) => intent.elementId);
  const affectedRoofGeometryIds = root.roofIntents.map((intent) => intent.roofGeometryId);
  const { structuralIntentTrace: ignoredTrace, ...withoutTrace } = model;
  void ignoredTrace;
  const hasChanges = affectedElementIds.length > 0
    || affectedRoofGeometryIds.length > 0
    || (Array.isArray(model.structuralIntentFindings) && model.structuralIntentFindings.length > 0)
    || model.structuralIntentTrace !== undefined;
  if (!hasChanges) return result(model, []);
  return result({
    ...withoutTrace,
    structuralIntent: createEmptyStructuralIntent(),
    structuralIntentFindings: []
  }, affectedElementIds, { affectedRoofGeometryIds });
}

function splitFindingId(sourceElementId, targetElementIds) {
  const targets = [...targetElementIds].sort(compareIds).map(String).join('|');
  return `finding:${STRUCTURAL_INTENT_SPLIT_REVIEW}:element:${String(sourceElementId)}:targets:${targets}`;
}

export function reconcileStructuralIntentAfterSplit(
  originalModel,
  nextModel,
  sourceElementId,
  targetElementIds
) {
  requireModel(originalModel);
  requireModel(nextModel);
  if (!Array.isArray(targetElementIds) || targetElementIds.length !== 2) {
    throw new StructuralIntentError(
      'SI-SPLIT-TARGETS-INVALID',
      'La división debe declarar exactamente dos elementos nuevos.'
    );
  }
  const originalRoot = assertValidStructuralIntent(
    currentRoot(originalModel),
    originalModel.elements,
    roofGeometryForCurrentIntents(originalModel)
  );
  const originalIntent = originalRoot.elementIntents.find((intent) => (
    hasSameId(intent.elementId, sourceElementId)
  ));
  const nextRoot = canonicalizeStructuralIntent({
    ...originalRoot,
    elementIntents: originalRoot.elementIntents.filter((intent) => (
      !hasSameId(intent.elementId, sourceElementId)
    ))
  });
  assertValidStructuralIntent(nextRoot, nextModel.elements, roofGeometryForCurrentIntents(nextModel, nextRoot));
  if (!originalIntent) {
    return result({ ...nextModel, structuralIntent: nextRoot }, [sourceElementId, ...targetElementIds], {
      finding: null
    });
  }

  const sortedTargets = [...targetElementIds].sort(compareIds);
  const finding = {
    findingId: splitFindingId(sourceElementId, sortedTargets),
    code: STRUCTURAL_INTENT_SPLIT_REVIEW,
    severity: 'warning',
    status: 'open',
    sourceElementId,
    targetElementIds: sortedTargets,
    originalIntent: canonicalElementIntent(originalIntent),
    message: 'La división eliminó la referencia vigente; ambos tramos requieren una decisión explícita.'
  };
  const previousFindings = Array.isArray(originalModel.structuralIntentFindings)
    ? originalModel.structuralIntentFindings
    : [];
  const findings = [...previousFindings.filter((item) => item?.findingId !== finding.findingId), finding]
    .sort((a, b) => compareText(a.findingId, b.findingId));
  const nextWithFinding = {
    ...nextModel,
    structuralIntent: nextRoot,
    structuralIntentFindings: findings
  };
  const findingIssues = validateStructuralIntentFindings(findings, nextModel.elements);
  if (findingIssues.length > 0) {
    throw new StructuralIntentError(
      'SI-FINDING-VALIDATION-FAILED',
      'No fue posible persistir el finding de revisión posterior a división.',
      findingIssues
    );
  }
  return result(nextWithFinding, [sourceElementId, ...sortedTargets], { finding });
}

export function checkStructuralIntentBeforeMerge(model, elementIds) {
  requireModel(model);
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  const requested = new Set((Array.isArray(elementIds) ? elementIds : []).map(idKey));
  const sourceIntents = root.elementIntents.filter((intent) => requested.has(idKey(intent.elementId)));
  if (sourceIntents.length === 0) return { ok: true, sourceIntents: [] };
  return {
    ok: false,
    code: 'SI-MERGE-INTENT-DECISION-REQUIRED',
    error: 'La unión requiere resolver explícitamente la intención de los muros de origen.',
    elementIds: sourceIntents.map((intent) => intent.elementId).sort(compareIds)
  };
}

export function removeElementAndStructuralReferences(model, elementId) {
  requireModel(model);
  const target = model.elements.find((element) => hasSameId(element?.id, elementId));
  if (!target) {
    throw new StructuralIntentError(
      'SI-ELEMENT-REFERENCE-NOT-FOUND',
      `No existe el elemento ${String(elementId)}.`
    );
  }
  const root = assertValidStructuralIntent(
    currentRoot(model),
    model.elements,
    roofGeometryForCurrentIntents(model)
  );
  const nextElements = model.elements.filter((element) => !hasSameId(element?.id, elementId));
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    elementIntents: root.elementIntents.filter((intent) => !hasSameId(intent.elementId, elementId))
  });
  assertValidStructuralIntent(
    nextRoot,
    nextElements,
    roofGeometryForCurrentIntents({ ...model, elements: nextElements }, nextRoot)
  );
  const findings = (Array.isArray(model.structuralIntentFindings)
    ? model.structuralIntentFindings
    : []).filter((finding) => (
    !hasSameId(finding?.sourceElementId, elementId)
    && !(finding?.targetElementIds || []).some((targetId) => hasSameId(targetId, elementId))
  ));
  return result({
    ...model,
    elements: nextElements,
    structuralIntent: nextRoot,
    structuralIntentFindings: findings
  }, [target.id]);
}


function roofGeometryForCurrentIntents(model, root = currentRoot(model)) {
  const ids = Array.isArray(root.roofIntents)
    ? root.roofIntents.map((intent) => intent?.roofGeometryId)
    : [];
  if (ids.length === 0) return [];
  return ids.map((id) => resolveRoofGeometryForIntent(model, id));
}

export function setRoofIntent(model, roofGeometryId, input, options = {}) {
  requireModel(model);
  const roofGeometry = resolveRoofGeometryForIntent(model, roofGeometryId);
  const rootRoofGeometry = roofGeometryForCurrentIntents(model);
  const root = assertValidStructuralIntent(currentRoot(model), model.elements, rootRoofGeometry);
  const candidate = buildRoofIntent(roofGeometry.id, input);
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    roofIntents: [
      ...root.roofIntents.filter((intent) => !hasSameId(intent.roofGeometryId, roofGeometry.id)),
      candidate
    ]
  });
  const validationGeometry = [
    ...rootRoofGeometry.filter((roof) => !hasSameId(roof.id, roofGeometry.id)),
    roofGeometry
  ];
  assertValidStructuralIntent(nextRoot, model.elements, validationGeometry);
  const previousIntent = roofIntentFor(root, roofGeometry.id);
  const nextIntent = roofIntentFor(nextRoot, roofGeometry.id);
  if (sameCanonicalValue(previousIntent, nextIntent)) return result(model, []);
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot },
    options,
    {
      operation: 'set',
      targetType: 'roof',
      changes: [{ targetId: roofGeometry.id, previousIntent, nextIntent }]
    }
  );
  return result(nextModel, [], {
    affectedRoofGeometryIds: [roofGeometry.id]
  });
}

export function removeRoofIntent(model, roofGeometryId, options = {}) {
  requireModel(model);
  const rootRoofGeometry = roofGeometryForCurrentIntents(model);
  const root = assertValidStructuralIntent(currentRoot(model), model.elements, rootRoofGeometry);
  const existing = root.roofIntents.find((intent) => hasSameId(intent.roofGeometryId, roofGeometryId));
  if (!existing) return result(model, []);
  const nextRoot = canonicalizeStructuralIntent({
    ...root,
    roofIntents: root.roofIntents.filter((intent) => !hasSameId(intent.roofGeometryId, roofGeometryId))
  });
  const findings = (Array.isArray(model.structuralIntentFindings)
    ? model.structuralIntentFindings
    : []).filter((finding) => (
    finding?.code !== ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE
    || !hasSameId(finding.roofGeometryId, roofGeometryId)
  ));
  const nextModel = maybeTrace(
    { ...model, structuralIntent: nextRoot, structuralIntentFindings: findings },
    options,
    {
      operation: 'remove',
      targetType: 'roof',
      changes: [{ targetId: existing.roofGeometryId, previousIntent: existing, nextIntent: null }]
    }
  );
  return result(nextModel, [], {
    affectedRoofGeometryIds: [existing.roofGeometryId]
  });
}

export function reconcileStructuralIntentAfterGeometryChange(originalModel, nextModel) {
  requireModel(originalModel);
  requireModel(nextModel);
  try {
    const reconciled = reconcileRoofIntentsAfterGeometryChange(originalModel, nextModel, {
      currentRoot,
      canonicalizeRoot: canonicalizeStructuralIntent
    });
    const roofGeometry = roofGeometryForCurrentIntents(reconciled);
    assertValidStructuralIntent(currentRoot(reconciled), reconciled.elements, roofGeometry);
    const findingIssues = validateStructuralIntentFindings(
      reconciled.structuralIntentFindings,
      reconciled.elements,
      roofGeometry
    );
    if (findingIssues.length > 0) {
      throw new StructuralIntentError(
        'SI-FINDING-VALIDATION-FAILED',
        'La reconciliación produjo findings estructurales inválidos.',
        findingIssues
      );
    }
    return reconciled;
  } catch (error) {
    if (error instanceof RoofStructuralIntentError) {
      throw new StructuralIntentError(error.code, error.message, error.details);
    }
    throw error;
  }
}
