import { hasOwn } from './hasOwn.js';
import {
  canonicalizeValue,
  compareText,
  fingerprint,
  isRecord
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA =
  'constructive-adapter-input-v1.0';

export const CONSTRUCTIVE_GENERATION_AVAILABILITY_SCHEMA =
  'constructive-generation-availability-v1.0';

const EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA =
  'constructive-effective-input-v1.0';

const EFFECTIVE_LIBRARY_SCHEMA =
  'constructive-library-context-v1.0';

const EFFECTIVE_LIBRARY_V2_SCHEMA =
  'constructive-library-context-v2.0';

export class ConstructiveGenerationInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConstructiveGenerationInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ConstructiveGenerationInputError(
    code,
    message,
    details
  );
}

function finiteJsonValue(value) {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(finiteJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(finiteJsonValue);
  }

  return false;
}

function requireEffectiveInput(value) {
  if (
    !isRecord(value)
    || value.schema !== EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT_SCHEMA',
      `La entrada debe usar schema ${EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA}.`
    );
  }

  const requiredRecords = [
    'adapterRef',
    'libraryRef',
    'library',
    'scope',
    'configuration',
    'effectiveGeometry',
    'effectiveStructuralRequirements'
  ];

  for (const key of requiredRecords) {
    if (!isRecord(value[key])) {
      fail(
        'INVALID_EFFECTIVE_INPUT',
        `${key} debe ser un objeto del paquete efectivo B2.`,
        { path: `$.${key}` }
      );
    }
  }

  if (
    typeof value.scenarioId !== 'string'
    || value.scenarioId.length === 0
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'scenarioId debe ser un identificador no vacío.',
      { path: '$.scenarioId' }
    );
  }

  if (!Array.isArray(value.assignments)) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'assignments debe ser un arreglo.',
      { path: '$.assignments' }
    );
  }

  const library = value.library;

  const isLibraryV1 =
    library.schema
      === EFFECTIVE_LIBRARY_SCHEMA;

  const isLibraryV2 =
    library.schema
      === EFFECTIVE_LIBRARY_V2_SCHEMA;

  const validLibraryKeys =
    (
      isLibraryV1
      && exactKeys(
        library,
        [
          'schema',
          'libraryId',
          'libraryVersion',
          'sha256',
          'componentTypes'
        ]
      )
    )
    || (
      isLibraryV2
      && exactKeys(
        library,
        [
          'schema',
          'libraryId',
          'libraryVersion',
          'sha256',
          'componentTypes',
          'adapterPayload'
        ]
      )
    );

  if (
    !validLibraryKeys
    || !validNonEmptyString(library.libraryId)
    || !validNonEmptyString(library.libraryVersion)
    || !/^[a-f0-9]{64}$/.test(library.sha256 ?? '')
    || !Array.isArray(library.componentTypes)
    || (
      isLibraryV2
      && (
        !isRecord(library.adapterPayload)
        || !finiteJsonValue(
          library.adapterPayload
        )
      )
    )
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'library debe conservar exactamente la selección efectiva proyectada por B2/B1.',
      { path: '$.library' }
    );
  }

  if (
    library.libraryId !== value.libraryRef.libraryId
    || library.libraryVersion !== value.libraryRef.libraryVersion
    || library.sha256 !== value.libraryRef.sha256
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'library debe coincidir exactamente con libraryRef.',
      { path: '$.library' }
    );
  }

  const requiredComponentTypeIds = [];

  for (const [index, assignment] of value.assignments.entries()) {
    const componentTypeId =
      assignment?.choiceRef?.componentTypeId;

    if (!validNonEmptyString(componentTypeId)) {
      fail(
        'INVALID_EFFECTIVE_INPUT',
        'Cada assignment efectivo debe declarar choiceRef.componentTypeId.',
        {
          path:
            `$.assignments[${index}].choiceRef.componentTypeId`
        }
      );
    }

    requiredComponentTypeIds.push(componentTypeId);
  }

  const expectedComponentTypes = [
    ...new Set(requiredComponentTypeIds)
  ]
    .sort(compareText)
    .map((componentTypeId) => ({ componentTypeId }));

  if (
    JSON.stringify(canonicalizeValue(library.componentTypes))
    !== JSON.stringify(canonicalizeValue(expectedComponentTypes))
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'library.componentTypes debe coincidir exactamente con la selección requerida por assignments.',
      { path: '$.library.componentTypes' }
    );
  }

  if (
    !hasOwn(
      value.effectiveStructuralRequirements,
      'relevantBlockingDecisionContext'
    )
    || !Array.isArray(
      value.effectiveStructuralRequirements
        .relevantBlockingDecisionContext
    )
  ) {
    fail(
      'INVALID_EFFECTIVE_INPUT',
      'El paquete B2 debe declarar relevantBlockingDecisionContext.',
      {
        path:
          '$.effectiveStructuralRequirements.relevantBlockingDecisionContext'
      }
    );
  }
}

function projectAdapterDimensions(effectiveInput) {
  const {
    relevantBlockingDecisionContext,
    ...effectiveStructuralRequirements
  } = effectiveInput.effectiveStructuralRequirements;

  return canonicalizeValue({
    scenarioId: effectiveInput.scenarioId,
    adapterRef: effectiveInput.adapterRef,
    libraryRef: effectiveInput.libraryRef,
    library: effectiveInput.library,
    scope: effectiveInput.scope,
    configuration: effectiveInput.configuration,
    assignments: effectiveInput.assignments,
    effectiveGeometry: effectiveInput.effectiveGeometry,
    effectiveStructuralRequirements,
    relevantBlockingDecisionContext
  });
}

function buildEffectiveFingerprints(dimensions) {
  return canonicalizeValue({
    effectiveGeometrySha256:
      fingerprint(dimensions.effectiveGeometry),

    effectiveStructuralRequirementsSha256:
      fingerprint(dimensions.effectiveStructuralRequirements),

    relevantBlockingDecisionContextSha256:
      fingerprint(dimensions.relevantBlockingDecisionContext),

    scopeSha256:
      fingerprint(dimensions.scope),

    configurationSha256:
      fingerprint(dimensions.configuration),

    assignmentsSha256:
      fingerprint(dimensions.assignments),

    adapterFingerprint:
      fingerprint(dimensions.adapterRef),

    libraryFingerprint:
      fingerprint(dimensions.libraryRef)
  });
}

function generationFingerprintPayload(dimensions) {
  return canonicalizeValue({
    scenarioId: dimensions.scenarioId,
    effectiveGeometry: dimensions.effectiveGeometry,
    effectiveStructuralRequirements:
      dimensions.effectiveStructuralRequirements,
    relevantBlockingDecisionContext:
      dimensions.relevantBlockingDecisionContext,
    scope: dimensions.scope,
    configuration: dimensions.configuration,
    assignments: dimensions.assignments,
    adapterRef: dimensions.adapterRef,
    libraryRef: dimensions.libraryRef
  });
}

export function buildConstructiveAdapterInput(effectiveInput) {
  requireEffectiveInput(effectiveInput);

  const dimensions =
    projectAdapterDimensions(effectiveInput);

  const effectiveFingerprints =
    buildEffectiveFingerprints(dimensions);

  const effectiveGenerationInputSha256 =
    fingerprint(
      generationFingerprintPayload(dimensions)
    );

  return canonicalizeValue({
    schema: CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA,

    ...dimensions,

    effectiveFingerprints,
    effectiveGenerationInputSha256
  });
}


function exactKeys(value, keys) {
  if (!isRecord(value)) return false;

  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function requireAdapterInputForAvailability(value) {
  if (
    !isRecord(value)
    || value.schema !== CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA
    || !isRecord(value.adapterRef)
    || !isRecord(value.libraryRef)
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      `availability requiere ${CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA}.`
    );
  }

  if (
    !validNonEmptyString(value.adapterRef.adapterId)
    || !validNonEmptyString(value.adapterRef.adapterVersion)
    || !validNonEmptyString(value.libraryRef.libraryId)
    || !validNonEmptyString(value.libraryRef.libraryVersion)
    || !/^[a-f0-9]{64}$/.test(value.libraryRef.sha256 ?? '')
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'adapterRef y libraryRef deben conservar referencias contractuales exactas.'
    );
  }
}

function requireAvailabilityContext(context) {
  if (
    !isRecord(context)
    || !Array.isArray(context.availableAdapters)
    || !Array.isArray(context.availableLibraries)
  ) {
    fail(
      'INVALID_AVAILABILITY_CONTEXT',
      'El contexto de availability debe declarar availableAdapters y availableLibraries.'
    );
  }

  const adapterKeys = ['adapterId', 'adapterVersion'];
  const adapterIdentities = new Set();

  for (const [index, adapter] of context.availableAdapters.entries()) {
    if (
      !exactKeys(adapter, adapterKeys)
      || !validNonEmptyString(adapter.adapterId)
      || !validNonEmptyString(adapter.adapterVersion)
    ) {
      fail(
        'INVALID_AVAILABILITY_CONTEXT',
        'Cada adapter disponible debe declarar exactamente adapterId y adapterVersion.',
        { path: `$.availableAdapters[${index}]` }
      );
    }

    const identity =
      `${adapter.adapterId}\u0000${adapter.adapterVersion}`;

    if (adapterIdentities.has(identity)) {
      fail(
        'INVALID_AVAILABILITY_CONTEXT',
        'El contexto de availability no admite adapters duplicados.',
        { path: `$.availableAdapters[${index}]` }
      );
    }

    adapterIdentities.add(identity);
  }

  const libraryKeys = [
    'libraryId',
    'libraryVersion',
    'sha256'
  ];
  const libraryIdentities = new Set();

  for (const [index, library] of context.availableLibraries.entries()) {
    if (
      !exactKeys(library, libraryKeys)
      || !validNonEmptyString(library.libraryId)
      || !validNonEmptyString(library.libraryVersion)
      || !/^[a-f0-9]{64}$/.test(library.sha256 ?? '')
    ) {
      fail(
        'INVALID_AVAILABILITY_CONTEXT',
        'Cada biblioteca disponible debe declarar exactamente libraryId, libraryVersion y sha256.',
        { path: `$.availableLibraries[${index}]` }
      );
    }

    const identity =
      `${library.libraryId}\u0000${library.libraryVersion}\u0000${library.sha256}`;

    if (libraryIdentities.has(identity)) {
      fail(
        'INVALID_AVAILABILITY_CONTEXT',
        'El contexto de availability no admite bibliotecas duplicadas.',
        { path: `$.availableLibraries[${index}]` }
      );
    }

    libraryIdentities.add(identity);
  }
}

export function evaluateConstructiveGenerationAvailability(
  adapterInput,
  context
) {
  requireAdapterInputForAvailability(adapterInput);
  requireAvailabilityContext(context);

  const adapterAvailable =
    context.availableAdapters.some((available) => (
      available.adapterId === adapterInput.adapterRef.adapterId
      && available.adapterVersion
        === adapterInput.adapterRef.adapterVersion
    ));

  const libraryAvailable =
    context.availableLibraries.some((available) => (
      available.libraryId === adapterInput.libraryRef.libraryId
      && available.libraryVersion
        === adapterInput.libraryRef.libraryVersion
      && available.sha256 === adapterInput.libraryRef.sha256
    ));

  const reasonCodes = [];

  if (!adapterAvailable) {
    reasonCodes.push('ADAPTER_NOT_AVAILABLE');
  }

  if (!libraryAvailable) {
    reasonCodes.push('LIBRARY_NOT_AVAILABLE');
  }

  return canonicalizeValue({
    schema: CONSTRUCTIVE_GENERATION_AVAILABILITY_SCHEMA,
    state:
      adapterAvailable && libraryAvailable
        ? 'available'
        : 'unavailable',
    adapterAvailable,
    libraryAvailable,
    reasonCodes
  });
}
