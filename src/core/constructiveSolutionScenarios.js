import { hasOwn } from './hasOwn.js';

export const CONSTRUCTIVE_SOLUTIONS_SCHEMA = 'constructive-solution-scenarios-v1.0';
export const CONSTRUCTIVE_SCENARIO_SCHEMA = 'constructive-solution-scenario-v1.0';
export const CONSTRUCTIVE_ASSIGNMENT_SCHEMA = 'constructive-solution-assignment-v1.0';
export const CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA = 'constructive-generation-receipt-v1.0';

const SCENARIO_ID_PATTERN = /^scenario:(\d+)$/;
const ASSIGNMENT_ID_PATTERN = /^scenario:(\d+)\/assignment:(\d+)$/;
const REQUIREMENT_ID_PATTERN = /^sr-requirement:sha256:[0-9a-f]{64}$/;
const REGION_ID_PATTERN = /^sr-region:sha256:[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const LIFECYCLES = new Set(['active', 'archived']);
const SCOPE_MODES = new Set(['all', 'requirements']);
const COVERAGE_STATES = new Set(['notGenerated', 'none', 'partial', 'complete']);

const ROOT_KEYS = new Set(['schema', 'nextScenarioOrdinal', 'scenarios']);
const SCENARIO_KEYS = new Set([
  'schema',
  'scenarioId',
  'nextAssignmentOrdinal',
  'metadata',
  'lifecycle',
  'adapterRef',
  'libraryRef',
  'configuration',
  'scope',
  'assignments',
  'lastGeneration'
]);
const ASSIGNMENT_KEYS = new Set([
  'schema',
  'assignmentId',
  'requirementRef',
  'targetRef',
  'choiceRef',
  'parameters'
]);

export class ConstructiveScenarioError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ConstructiveScenarioError';
    this.code = code;
    this.details = details;
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  }
  return value;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareText)
      .map((key) => [key, canonicalizeJsonValue(value[key])])
  );
}

function sameCanonicalValue(left, right) {
  return JSON.stringify(canonicalizeJsonValue(left)) === JSON.stringify(canonicalizeJsonValue(right));
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function validateExactKeys(value, keys, path, issues) {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) addIssue(issues, `${path}.${key}`, 'UNKNOWN_FIELD', `${path}.${key} no pertenece al schema.`);
  }
  for (const key of keys) {
    if (!hasOwn(value, key)) addIssue(issues, `${path}.${key}`, 'MISSING_FIELD', `Falta ${path}.${key}.`);
  }
}

function validateJsonValue(value, path, issues, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) addIssue(issues, path, 'NON_FINITE_NUMBER', `${path} debe contener números finitos.`);
    return;
  }
  if (typeof value !== 'object') {
    addIssue(issues, path, 'INVALID_JSON_VALUE', `${path} debe ser un valor JSON.`);
    return;
  }
  if (ancestors.has(value)) {
    addIssue(issues, path, 'CYCLIC_VALUE', `${path} no puede contener ciclos.`);
    return;
  }
  const next = new Set(ancestors);
  next.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, issues, next));
    return;
  }
  if (!isRecord(value)) {
    addIssue(issues, path, 'INVALID_JSON_OBJECT', `${path} debe ser un objeto JSON simple.`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__') addIssue(issues, `${path}.${key}`, 'FORBIDDEN_KEY', '__proto__ está prohibido.');
    validateJsonValue(item, `${path}.${key}`, issues, next);
  }
}

function requireRecord(value, path, issues) {
  if (isRecord(value)) return true;
  addIssue(issues, path, 'EXPECTED_OBJECT', `${path} debe ser un objeto.`);
  return false;
}

function requireNonEmptyString(value, path, issues) {
  if (typeof value === 'string' && value.trim() !== '') return true;
  addIssue(issues, path, 'EXPECTED_NON_EMPTY_STRING', `${path} debe ser texto no vacío.`);
  return false;
}

function ordinalFromScenarioId(id) {
  const match = typeof id === 'string' ? id.match(SCENARIO_ID_PATTERN) : null;
  if (!match) return null;
  const ordinal = Number(match[1]);
  return Number.isSafeInteger(ordinal)
    && ordinal > 0
    && match[1] === formatOrdinal(ordinal)
    ? ordinal
    : null;
}

function ordinalsFromAssignmentId(id) {
  const match = typeof id === 'string' ? id.match(ASSIGNMENT_ID_PATTERN) : null;
  if (!match) return null;
  const scenarioOrdinal = Number(match[1]);
  const assignmentOrdinal = Number(match[2]);
  return Number.isSafeInteger(scenarioOrdinal)
    && scenarioOrdinal > 0
    && Number.isSafeInteger(assignmentOrdinal)
    && assignmentOrdinal > 0
    && match[1] === formatOrdinal(scenarioOrdinal)
    && match[2] === formatOrdinal(assignmentOrdinal)
    ? { scenarioOrdinal, assignmentOrdinal }
    : null;
}

function formatOrdinal(ordinal) {
  return String(ordinal).padStart(6, '0');
}

function assignmentSemanticKey(assignment) {
  const { assignmentId: _assignmentId, ...semantic } = assignment;
  return JSON.stringify(canonicalizeJsonValue(semantic));
}

export function scenarioIdFromOrdinal(ordinal) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new ConstructiveScenarioError('INVALID_SCENARIO_ORDINAL', 'El ordinal de escenario debe ser un entero seguro positivo.');
  }
  return `scenario:${formatOrdinal(ordinal)}`;
}

export function assignmentIdFromOrdinal(scenarioId, ordinal) {
  if (ordinalFromScenarioId(scenarioId) === null) {
    throw new ConstructiveScenarioError('INVALID_SCENARIO_ID', 'scenarioId no cumple el formato canónico.');
  }
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new ConstructiveScenarioError('INVALID_ASSIGNMENT_ORDINAL', 'El ordinal de assignment debe ser un entero seguro positivo.');
  }
  return `${scenarioId}/assignment:${formatOrdinal(ordinal)}`;
}

export function createEmptyConstructiveSolutions() {
  return {
    schema: CONSTRUCTIVE_SOLUTIONS_SCHEMA,
    nextScenarioOrdinal: 1,
    scenarios: []
  };
}

function validateAdapterRef(value, path, issues) {
  if (!requireRecord(value, path, issues)) return;
  validateExactKeys(value, new Set(['adapterId', 'adapterVersion']), path, issues);
  requireNonEmptyString(value.adapterId, `${path}.adapterId`, issues);
  requireNonEmptyString(value.adapterVersion, `${path}.adapterVersion`, issues);
}

function validateLibraryRef(value, path, issues) {
  if (!requireRecord(value, path, issues)) return;
  validateExactKeys(value, new Set(['libraryId', 'libraryVersion', 'sha256']), path, issues);
  requireNonEmptyString(value.libraryId, `${path}.libraryId`, issues);
  requireNonEmptyString(value.libraryVersion, `${path}.libraryVersion`, issues);
  if (typeof value.sha256 !== 'string' || !SHA256_PATTERN.test(value.sha256)) {
    addIssue(issues, `${path}.sha256`, 'INVALID_SHA256', `${path}.sha256 debe ser SHA-256 hexadecimal.`);
  }
}

function validateScope(value, path, issues) {
  if (!requireRecord(value, path, issues)) return;
  if (!SCOPE_MODES.has(value.mode)) {
    addIssue(issues, `${path}.mode`, 'INVALID_SCOPE_MODE', 'scope.mode debe ser all o requirements.');
    return;
  }
  if (value.mode === 'all') {
    validateExactKeys(value, new Set(['mode']), path, issues);
    return;
  }
  validateExactKeys(value, new Set(['mode', 'requirementIds']), path, issues);
  if (!Array.isArray(value.requirementIds) || value.requirementIds.length === 0) {
    addIssue(issues, `${path}.requirementIds`, 'EMPTY_REQUIREMENT_SCOPE', 'El scope requirements exige al menos un requirementId.');
    return;
  }
  const ids = new Set();
  value.requirementIds.forEach((id, index) => {
    if (typeof id !== 'string' || !REQUIREMENT_ID_PATTERN.test(id)) {
      addIssue(issues, `${path}.requirementIds[${index}]`, 'INVALID_REQUIREMENT_REF', 'requirementId no cumple el formato contractual.');
    } else if (ids.has(id)) {
      addIssue(issues, `${path}.requirementIds[${index}]`, 'DUPLICATE_REQUIREMENT_REF', `El requirementId ${id} está duplicado.`);
    }
    ids.add(id);
  });
}

function validateAssignment(assignment, scenario, index, issues) {
  const path = `constructiveSolutions.scenarios[${scenario.index}].assignments[${index}]`;
  if (!requireRecord(assignment, path, issues)) return null;
  validateExactKeys(assignment, ASSIGNMENT_KEYS, path, issues);
  if (assignment.schema !== CONSTRUCTIVE_ASSIGNMENT_SCHEMA) {
    addIssue(issues, `${path}.schema`, 'INVALID_ASSIGNMENT_SCHEMA', `schema debe ser ${CONSTRUCTIVE_ASSIGNMENT_SCHEMA}.`);
  }
  const ordinals = ordinalsFromAssignmentId(assignment.assignmentId);
  if (!ordinals || ordinals.scenarioOrdinal !== scenario.ordinal) {
    addIssue(issues, `${path}.assignmentId`, 'INVALID_ASSIGNMENT_ID', 'assignmentId debe pertenecer al scenarioId y usar formato canónico.');
  }
  if (typeof assignment.requirementRef !== 'string' || !REQUIREMENT_ID_PATTERN.test(assignment.requirementRef)) {
    addIssue(issues, `${path}.requirementRef`, 'INVALID_REQUIREMENT_REF', 'requirementRef no cumple el formato contractual.');
  }
  if (scenario.scope?.mode === 'requirements'
    && !scenario.scope.requirementIds?.includes(assignment.requirementRef)) {
    addIssue(issues, `${path}.requirementRef`, 'REQUIREMENT_OUTSIDE_SCOPE', 'requirementRef debe pertenecer al scope del escenario.');
  }
  if (requireRecord(assignment.targetRef, `${path}.targetRef`, issues)) {
    validateExactKeys(assignment.targetRef, new Set(['kind', 'ref']), `${path}.targetRef`, issues);
    if (assignment.targetRef.kind === 'requirement') {
      if (assignment.targetRef.ref !== assignment.requirementRef) {
        addIssue(issues, `${path}.targetRef.ref`, 'INCOMPATIBLE_TARGET_REF', 'El target requirement debe coincidir con requirementRef.');
      }
    } else if (assignment.targetRef.kind === 'region') {
      if (typeof assignment.targetRef.ref !== 'string' || !REGION_ID_PATTERN.test(assignment.targetRef.ref)) {
        addIssue(issues, `${path}.targetRef.ref`, 'INVALID_REGION_REF', 'El target region no cumple el formato contractual.');
      }
    } else {
      addIssue(issues, `${path}.targetRef.kind`, 'INVALID_TARGET_KIND', 'targetRef.kind debe ser requirement o region.');
    }
  }
  if (requireRecord(assignment.choiceRef, `${path}.choiceRef`, issues)) {
    validateExactKeys(
      assignment.choiceRef,
      new Set(['libraryId', 'libraryVersion', 'componentTypeId']),
      `${path}.choiceRef`,
      issues
    );
    if (assignment.choiceRef.libraryId !== scenario.libraryRef?.libraryId
      || assignment.choiceRef.libraryVersion !== scenario.libraryRef?.libraryVersion) {
      addIssue(issues, `${path}.choiceRef`, 'LIBRARY_REF_MISMATCH', 'choiceRef debe usar la biblioteca exacta del escenario.');
    }
    requireNonEmptyString(assignment.choiceRef.componentTypeId, `${path}.choiceRef.componentTypeId`, issues);
  }
  if (requireRecord(assignment.parameters, `${path}.parameters`, issues)) {
    validateJsonValue(assignment.parameters, `${path}.parameters`, issues);
  }
  return ordinals?.assignmentOrdinal ?? null;
}

function validateReceipt(value, path, issues) {
  if (value === null) return;
  if (!requireRecord(value, path, issues)) return;
  const keys = new Set([
    'schema',
    'effectiveGenerationInputSha256',
    'outputCanonicalSha256',
    'coverageAtGeneration',
    'resolvedCount',
    'partiallyResolvedCount',
    'unresolvedCount',
    'effectiveFingerprints',
    'globalProvenance'
  ]);
  validateExactKeys(value, keys, path, issues);
  if (value.schema !== CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA) {
    addIssue(issues, `${path}.schema`, 'INVALID_RECEIPT_SCHEMA', `schema debe ser ${CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA}.`);
  }
  for (const field of ['effectiveGenerationInputSha256', 'outputCanonicalSha256']) {
    if (typeof value[field] !== 'string' || !SHA256_PATTERN.test(value[field])) {
      addIssue(issues, `${path}.${field}`, 'INVALID_SHA256', `${field} debe ser SHA-256 hexadecimal.`);
    }
  }
  if (!COVERAGE_STATES.has(value.coverageAtGeneration) || value.coverageAtGeneration === 'notGenerated') {
    addIssue(issues, `${path}.coverageAtGeneration`, 'INVALID_GENERATED_COVERAGE', 'coverageAtGeneration debe ser none, partial o complete.');
  }
  for (const field of ['resolvedCount', 'partiallyResolvedCount', 'unresolvedCount']) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) {
      addIssue(issues, `${path}.${field}`, 'INVALID_COUNT', `${field} debe ser un entero seguro no negativo.`);
    }
  }
  const effectiveKeys = new Set([
    'effectiveGeometrySha256',
    'effectiveStructuralRequirementsSha256',
    'relevantBlockingDecisionContextSha256',
    'scopeSha256',
    'configurationSha256',
    'assignmentsSha256',
    'adapterFingerprint',
    'libraryFingerprint'
  ]);
  if (requireRecord(value.effectiveFingerprints, `${path}.effectiveFingerprints`, issues)) {
    validateExactKeys(value.effectiveFingerprints, effectiveKeys, `${path}.effectiveFingerprints`, issues);
    for (const key of effectiveKeys) {
      if (typeof value.effectiveFingerprints[key] !== 'string' || !SHA256_PATTERN.test(value.effectiveFingerprints[key])) {
        addIssue(issues, `${path}.effectiveFingerprints.${key}`, 'INVALID_SHA256', `${key} debe ser SHA-256 hexadecimal.`);
      }
    }
  }
  const provenanceKeys = new Set([
    'geometrySha256',
    'requirementsSha256',
    'requirementsSourceAggregateSha256',
    'structuralIntentSha256',
    'topologyR0R5Sha256'
  ]);
  if (requireRecord(value.globalProvenance, `${path}.globalProvenance`, issues)) {
    validateExactKeys(value.globalProvenance, provenanceKeys, `${path}.globalProvenance`, issues);
    for (const key of provenanceKeys) {
      if (typeof value.globalProvenance[key] !== 'string' || !SHA256_PATTERN.test(value.globalProvenance[key])) {
        addIssue(issues, `${path}.globalProvenance.${key}`, 'INVALID_SHA256', `${key} debe ser SHA-256 hexadecimal.`);
      }
    }
  }
}

function validateScenario(scenario, index, issues) {
  const path = `constructiveSolutions.scenarios[${index}]`;
  if (!requireRecord(scenario, path, issues)) return null;
  validateExactKeys(scenario, SCENARIO_KEYS, path, issues);
  if (scenario.schema !== CONSTRUCTIVE_SCENARIO_SCHEMA) {
    addIssue(issues, `${path}.schema`, 'INVALID_SCENARIO_SCHEMA', `schema debe ser ${CONSTRUCTIVE_SCENARIO_SCHEMA}.`);
  }
  const ordinal = ordinalFromScenarioId(scenario.scenarioId);
  if (ordinal === null) addIssue(issues, `${path}.scenarioId`, 'INVALID_SCENARIO_ID', 'scenarioId no cumple el formato canónico.');
  if (requireRecord(scenario.metadata, `${path}.metadata`, issues)) {
    validateExactKeys(scenario.metadata, new Set(['name', 'description']), `${path}.metadata`, issues);
    requireNonEmptyString(scenario.metadata.name, `${path}.metadata.name`, issues);
    if (typeof scenario.metadata.description !== 'string') {
      addIssue(issues, `${path}.metadata.description`, 'INVALID_DESCRIPTION', 'metadata.description debe ser texto.');
    }
  }
  if (!LIFECYCLES.has(scenario.lifecycle)) {
    addIssue(issues, `${path}.lifecycle`, 'INVALID_LIFECYCLE', 'lifecycle debe ser active o archived.');
  }
  validateAdapterRef(scenario.adapterRef, `${path}.adapterRef`, issues);
  validateLibraryRef(scenario.libraryRef, `${path}.libraryRef`, issues);
  if (requireRecord(scenario.configuration, `${path}.configuration`, issues)) {
    requireNonEmptyString(scenario.configuration.schema, `${path}.configuration.schema`, issues);
    validateJsonValue(scenario.configuration, `${path}.configuration`, issues);
  }
  validateScope(scenario.scope, `${path}.scope`, issues);
  if (!Array.isArray(scenario.assignments)) {
    addIssue(issues, `${path}.assignments`, 'EXPECTED_ARRAY', 'assignments debe ser un arreglo.');
  }
  const assignmentIds = new Set();
  const semanticAssignments = new Map();
  let maxAssignmentOrdinal = 0;
  if (Array.isArray(scenario.assignments)) {
    const context = { ...scenario, index, ordinal };
    scenario.assignments.forEach((assignment, assignmentIndex) => {
      if (isRecord(assignment) && assignmentIds.has(assignment.assignmentId)) {
        addIssue(issues, `${path}.assignments[${assignmentIndex}].assignmentId`, 'DUPLICATE_ASSIGNMENT_ID', `El assignmentId ${assignment.assignmentId} está duplicado.`);
      }
      if (isRecord(assignment)) {
        assignmentIds.add(assignment.assignmentId);
        const semanticKey = assignmentSemanticKey(assignment);
        if (semanticAssignments.has(semanticKey)) {
          addIssue(
            issues,
            `${path}.assignments[${assignmentIndex}]`,
            'DUPLICATE_SEMANTIC_ASSIGNMENT',
            `El assignment duplica semánticamente ${semanticAssignments.get(semanticKey)}.`
          );
        } else {
          semanticAssignments.set(semanticKey, assignment.assignmentId);
        }
      }
      maxAssignmentOrdinal = Math.max(
        maxAssignmentOrdinal,
        validateAssignment(assignment, context, assignmentIndex, issues) ?? 0
      );
    });
  }
  if (!Number.isSafeInteger(scenario.nextAssignmentOrdinal)
    || scenario.nextAssignmentOrdinal < 1
    || scenario.nextAssignmentOrdinal <= maxAssignmentOrdinal) {
    addIssue(issues, `${path}.nextAssignmentOrdinal`, 'INCOHERENT_ASSIGNMENT_ALLOCATOR', 'nextAssignmentOrdinal debe ser mayor que todo assignment persistido.');
  }
  validateReceipt(scenario.lastGeneration, `${path}.lastGeneration`, issues);
  return ordinal;
}

export function validateConstructiveSolutions(root) {
  const issues = [];
  if (!requireRecord(root, 'constructiveSolutions', issues)) return issues;
  validateExactKeys(root, ROOT_KEYS, 'constructiveSolutions', issues);
  if (root.schema !== CONSTRUCTIVE_SOLUTIONS_SCHEMA) {
    addIssue(issues, 'constructiveSolutions.schema', 'INVALID_CONSTRUCTIVE_SOLUTIONS_SCHEMA', `schema debe ser ${CONSTRUCTIVE_SOLUTIONS_SCHEMA}.`);
  }
  if (!Array.isArray(root.scenarios)) {
    addIssue(issues, 'constructiveSolutions.scenarios', 'EXPECTED_ARRAY', 'scenarios debe ser un arreglo.');
  }
  const ids = new Set();
  let maxOrdinal = 0;
  if (Array.isArray(root.scenarios)) {
    root.scenarios.forEach((scenario, index) => {
      if (isRecord(scenario) && ids.has(scenario.scenarioId)) {
        addIssue(issues, `constructiveSolutions.scenarios[${index}].scenarioId`, 'DUPLICATE_SCENARIO_ID', `El scenarioId ${scenario.scenarioId} está duplicado.`);
      }
      if (isRecord(scenario)) ids.add(scenario.scenarioId);
      maxOrdinal = Math.max(maxOrdinal, validateScenario(scenario, index, issues) ?? 0);
    });
  }
  if (!Number.isSafeInteger(root.nextScenarioOrdinal)
    || root.nextScenarioOrdinal < 1
    || root.nextScenarioOrdinal <= maxOrdinal) {
    addIssue(issues, 'constructiveSolutions.nextScenarioOrdinal', 'INCOHERENT_SCENARIO_ALLOCATOR', 'nextScenarioOrdinal debe ser mayor que todo escenario persistido.');
  }
  return issues;
}

export function assertValidConstructiveSolutions(root) {
  const issues = validateConstructiveSolutions(root);
  if (issues.length > 0) {
    throw new ConstructiveScenarioError(
      'INVALID_CONSTRUCTIVE_SOLUTIONS',
      `constructiveSolutions no cumple el contrato (${issues.length} problema${issues.length === 1 ? '' : 's'}).`,
      issues
    );
  }
  return root;
}

function canonicalizeAssignment(assignment) {
  return {
    schema: assignment.schema,
    assignmentId: assignment.assignmentId,
    requirementRef: assignment.requirementRef,
    targetRef: canonicalizeJsonValue(assignment.targetRef),
    choiceRef: canonicalizeJsonValue(assignment.choiceRef),
    parameters: canonicalizeJsonValue(assignment.parameters)
  };
}

function canonicalizeScenario(scenario) {
  return {
    schema: scenario.schema,
    scenarioId: scenario.scenarioId,
    nextAssignmentOrdinal: scenario.nextAssignmentOrdinal,
    metadata: canonicalizeJsonValue(scenario.metadata),
    lifecycle: scenario.lifecycle,
    adapterRef: canonicalizeJsonValue(scenario.adapterRef),
    libraryRef: canonicalizeJsonValue(scenario.libraryRef),
    configuration: canonicalizeJsonValue(scenario.configuration),
    scope: scenario.scope.mode === 'requirements'
      ? { mode: 'requirements', requirementIds: [...scenario.scope.requirementIds].sort(compareText) }
      : { mode: 'all' },
    assignments: scenario.assignments
      .map(canonicalizeAssignment)
      .sort((left, right) => (
        ordinalsFromAssignmentId(left.assignmentId).assignmentOrdinal
        - ordinalsFromAssignmentId(right.assignmentId).assignmentOrdinal
      )),
    lastGeneration: scenario.lastGeneration === null
      ? null
      : canonicalizeJsonValue(scenario.lastGeneration)
  };
}

export function canonicalizeConstructiveSolutions(root) {
  assertValidConstructiveSolutions(root);
  return {
    schema: root.schema,
    nextScenarioOrdinal: root.nextScenarioOrdinal,
    scenarios: root.scenarios
      .map(canonicalizeScenario)
      .sort((left, right) => (
        ordinalFromScenarioId(left.scenarioId) - ordinalFromScenarioId(right.scenarioId)
      ))
  };
}

function canonicalRoot(root) {
  return canonicalizeConstructiveSolutions(root);
}

function scenarioIndex(root, scenarioId) {
  return root.scenarios.findIndex((scenario) => scenario.scenarioId === scenarioId);
}

function requireScenario(root, scenarioId) {
  const index = scenarioIndex(root, scenarioId);
  if (index < 0) throw new ConstructiveScenarioError('SCENARIO_NOT_FOUND', `No existe el escenario ${scenarioId}.`);
  return { index, scenario: root.scenarios[index] };
}

function requireActiveScenario(scenario) {
  if (scenario.lifecycle !== 'active') {
    throw new ConstructiveScenarioError(
      'SCENARIO_ARCHIVED',
      `El escenario ${scenario.scenarioId} debe reactivarse antes de editarlo.`
    );
  }
}

function replaceScenario(root, index, scenario) {
  const scenarios = root.scenarios.map((item, itemIndex) => (itemIndex === index ? scenario : item));
  return canonicalRoot({ ...root, scenarios });
}

function validatedScenarioInput(input, scenarioId) {
  return {
    schema: CONSTRUCTIVE_SCENARIO_SCHEMA,
    scenarioId,
    nextAssignmentOrdinal: 1,
    metadata: {
      name: input?.metadata?.name,
      description: input?.metadata?.description ?? ''
    },
    lifecycle: 'active',
    adapterRef: cloneJson(input?.adapterRef),
    libraryRef: cloneJson(input?.libraryRef),
    configuration: cloneJson(input?.configuration),
    scope: cloneJson(input?.scope),
    assignments: [],
    lastGeneration: null
  };
}

export function createConstructiveScenario(root, input) {
  const current = canonicalRoot(root);
  const scenarioId = scenarioIdFromOrdinal(current.nextScenarioOrdinal);
  const scenario = validatedScenarioInput(input, scenarioId);
  const next = canonicalRoot({
    ...current,
    nextScenarioOrdinal: current.nextScenarioOrdinal + 1,
    scenarios: [...current.scenarios, scenario]
  });
  return { constructiveSolutions: next, scenario: cloneJson(next.scenarios.find((item) => item.scenarioId === scenarioId)), changed: true };
}

export function duplicateConstructiveScenario(root, scenarioId, metadata) {
  const current = canonicalRoot(root);
  const { scenario: source } = requireScenario(current, scenarioId);
  const newScenarioId = scenarioIdFromOrdinal(current.nextScenarioOrdinal);
  const assignments = source.assignments.map((assignment, index) => ({
    ...cloneJson(assignment),
    assignmentId: assignmentIdFromOrdinal(newScenarioId, index + 1)
  }));
  const duplicate = {
    ...cloneJson(source),
    scenarioId: newScenarioId,
    nextAssignmentOrdinal: assignments.length + 1,
    metadata: {
      name: metadata?.name,
      description: metadata?.description ?? source.metadata.description
    },
    lifecycle: 'active',
    assignments,
    lastGeneration: null
  };
  const next = canonicalRoot({
    ...current,
    nextScenarioOrdinal: current.nextScenarioOrdinal + 1,
    scenarios: [...current.scenarios, duplicate]
  });
  return { constructiveSolutions: next, scenario: cloneJson(next.scenarios.find((item) => item.scenarioId === newScenarioId)), changed: true };
}

export function renameConstructiveScenario(root, scenarioId, name) {
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  requireActiveScenario(scenario);
  const nextScenario = { ...scenario, metadata: { ...scenario.metadata, name } };
  if (sameCanonicalValue(nextScenario, scenario)) return { constructiveSolutions: current, scenario: cloneJson(scenario), changed: false };
  const next = replaceScenario(current, index, nextScenario);
  return { constructiveSolutions: next, scenario: cloneJson(next.scenarios[index]), changed: true };
}

export function configureConstructiveScenario(root, scenarioId, patch) {
  const allowed = new Set(['adapterRef', 'libraryRef', 'configuration', 'scope']);
  if (!isRecord(patch) || Object.keys(patch).some((key) => !allowed.has(key))) {
    throw new ConstructiveScenarioError('INVALID_CONFIGURATION_PATCH', 'El patch de escenario contiene campos no permitidos.');
  }
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  requireActiveScenario(scenario);
  const nextScenario = {
    ...scenario,
    ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, cloneJson(value)]))
  };
  if (sameCanonicalValue(nextScenario, scenario)) return { constructiveSolutions: current, scenario: cloneJson(scenario), changed: false };
  const next = replaceScenario(current, index, nextScenario);
  return { constructiveSolutions: next, scenario: cloneJson(next.scenarios[index]), changed: true };
}

export function setConstructiveScenarioLifecycle(root, scenarioId, lifecycle) {
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  const nextScenario = { ...scenario, lifecycle };
  if (sameCanonicalValue(nextScenario, scenario)) return { constructiveSolutions: current, scenario: cloneJson(scenario), changed: false };
  const next = replaceScenario(current, index, nextScenario);
  return { constructiveSolutions: next, scenario: cloneJson(next.scenarios[index]), changed: true };
}

export function deleteConstructiveScenario(root, scenarioId) {
  const current = canonicalRoot(root);
  requireScenario(current, scenarioId);
  return {
    constructiveSolutions: canonicalRoot({
      ...current,
      scenarios: current.scenarios.filter((scenario) => scenario.scenarioId !== scenarioId)
    }),
    changed: true
  };
}

function assignmentInput(input, assignmentId) {
  return {
    schema: CONSTRUCTIVE_ASSIGNMENT_SCHEMA,
    assignmentId,
    requirementRef: input?.requirementRef,
    targetRef: cloneJson(input?.targetRef),
    choiceRef: cloneJson(input?.choiceRef),
    parameters: cloneJson(input?.parameters ?? {})
  };
}

export function createConstructiveAssignment(root, scenarioId, input) {
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  requireActiveScenario(scenario);
  const assignmentId = assignmentIdFromOrdinal(scenarioId, scenario.nextAssignmentOrdinal);
  const assignment = assignmentInput(input, assignmentId);
  const existing = scenario.assignments.find((item) => (
    assignmentSemanticKey(item) === assignmentSemanticKey(assignment)
  ));
  if (existing) {
    return {
      constructiveSolutions: current,
      assignment: cloneJson(existing),
      changed: false
    };
  }
  const nextScenario = {
    ...scenario,
    nextAssignmentOrdinal: scenario.nextAssignmentOrdinal + 1,
    assignments: [...scenario.assignments, assignment]
  };
  const candidate = replaceScenario(current, index, nextScenario);
  return {
    constructiveSolutions: candidate,
    assignment: cloneJson(candidate.scenarios[index].assignments.find((item) => item.assignmentId === assignmentId)),
    changed: true
  };
}

export function updateConstructiveAssignment(root, scenarioId, assignmentId, patch) {
  const allowed = new Set(['requirementRef', 'targetRef', 'choiceRef', 'parameters']);
  if (!isRecord(patch) || Object.keys(patch).some((key) => !allowed.has(key))) {
    throw new ConstructiveScenarioError('INVALID_ASSIGNMENT_PATCH', 'El patch de assignment contiene campos no permitidos.');
  }
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  requireActiveScenario(scenario);
  const assignmentIndex = scenario.assignments.findIndex((item) => item.assignmentId === assignmentId);
  if (assignmentIndex < 0) throw new ConstructiveScenarioError('ASSIGNMENT_NOT_FOUND', `No existe el assignment ${assignmentId}.`);
  const source = scenario.assignments[assignmentIndex];
  const nextAssignment = {
    ...source,
    ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, cloneJson(value)]))
  };
  if (sameCanonicalValue(nextAssignment, source)) {
    return { constructiveSolutions: current, assignment: cloneJson(source), changed: false };
  }
  const nextScenario = {
    ...scenario,
    assignments: scenario.assignments.map((item, itemIndex) => (
      itemIndex === assignmentIndex ? nextAssignment : item
    ))
  };
  const next = replaceScenario(current, index, nextScenario);
  return { constructiveSolutions: next, assignment: cloneJson(nextAssignment), changed: true };
}

export function deleteConstructiveAssignment(root, scenarioId, assignmentId) {
  const current = canonicalRoot(root);
  const { index, scenario } = requireScenario(current, scenarioId);
  requireActiveScenario(scenario);
  if (!scenario.assignments.some((item) => item.assignmentId === assignmentId)) {
    throw new ConstructiveScenarioError('ASSIGNMENT_NOT_FOUND', `No existe el assignment ${assignmentId}.`);
  }
  const nextScenario = {
    ...scenario,
    assignments: scenario.assignments.filter((item) => item.assignmentId !== assignmentId)
  };
  return { constructiveSolutions: replaceScenario(current, index, nextScenario), changed: true };
}
