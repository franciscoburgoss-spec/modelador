import {
  CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA,
  buildConstructiveAdapterInput
} from './constructiveGenerationInput.js';

import {
  canonicalizeValue,
  compareText,
  fingerprint,
  isRecord
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_SOLUTION_SCHEMA =
  'constructive-solution-v1.0';

export const NEUTRAL_CONTRACT_RESOLUTION_SCHEMA =
  'neutral-contract-resolution-v1.0';

const NEUTRAL_ADAPTER_ID =
  'neutral-contract-adapter';

const NEUTRAL_ADAPTER_VERSION =
  '1.0.0';

const NEUTRAL_LIBRARY_ID =
  'neutral-contract-library';

const NEUTRAL_LIBRARY_VERSION =
  '1.0.0';

const SUPPORTED_NEUTRAL_COMPONENT_TYPES =
  new Set([
    'abstract-load-transfer-response'
  ]);

const RESOLUTION_STATES =
  new Set([
    'resolved',
    'partiallyResolved',
    'unresolved'
  ]);

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA =
  'constructive-effective-input-v1.0';

export class ConstructiveSolutionGenerationError
  extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name =
      'ConstructiveSolutionGenerationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ConstructiveSolutionGenerationError(
    code,
    message,
    details
  );
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;

  const actual =
    Object.keys(value).sort();

  const expected =
    [...keys].sort();

  return (
    actual.length === expected.length
    && actual.every(
      (key, index) =>
        key === expected[index]
    )
  );
}

function sameCanonicalValue(left, right) {
  return (
    JSON.stringify(canonicalizeValue(left))
    === JSON.stringify(canonicalizeValue(right))
  );
}

function validNonEmptyString(value) {
  return (
    typeof value === 'string'
    && value.length > 0
  );
}

function assertFiniteJson(value, path = '$') {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail(
        'INVALID_JSON_VALUE',
        `Valor numérico no finito en ${path}.`,
        { path }
      );
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        assertFiniteJson(
          item,
          `${path}[${index}]`
        )
    );

    return;
  }

  if (isRecord(value)) {
    for (
      const [key, item]
      of Object.entries(value)
    ) {
      assertFiniteJson(
        item,
        `${path}.${key}`
      );
    }

    return;
  }

  fail(
    'INVALID_JSON_VALUE',
    `Valor no contractual en ${path}.`,
    { path }
  );
}

function assertExactAdapterBoundary(
  adapterInput
) {
  const reconstructedEffectiveInput = {
    schema:
      EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA,

    scenarioId:
      adapterInput.scenarioId,

    adapterRef:
      adapterInput.adapterRef,

    libraryRef:
      adapterInput.libraryRef,

    scope:
      adapterInput.scope,

    configuration:
      adapterInput.configuration,

    assignments:
      adapterInput.assignments,

    library:
      adapterInput.library,

    effectiveGeometry:
      adapterInput.effectiveGeometry,

    effectiveStructuralRequirements: {
      ...adapterInput
        .effectiveStructuralRequirements,

      relevantBlockingDecisionContext:
        adapterInput
          .relevantBlockingDecisionContext
    }
  };

  let rebuilt;

  try {
    rebuilt =
      buildConstructiveAdapterInput(
        reconstructedEffectiveInput
      );
  } catch (error) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'El adapter input no es reproducible por la frontera productiva B3.1.',
      {
        causeCode:
          error?.code ?? 'UNKNOWN'
      }
    );
  }

  if (
    !sameCanonicalValue(
      rebuilt,
      adapterInput
    )
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'El adapter input difiere de la salida canónica reproducible por B3.1.'
    );
  }
}

function requireAdapterInput(adapterInput) {
  if (
    !isRecord(adapterInput)
    || adapterInput.schema
      !== CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      `La generación requiere ${CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA}.`
    );
  }

  if (
    !validNonEmptyString(
      adapterInput.scenarioId
    )
    || !isRecord(adapterInput.adapterRef)
    || !isRecord(adapterInput.libraryRef)
    || !isRecord(adapterInput.library)
    || !Array.isArray(
      adapterInput.assignments
    )
    || !isRecord(
      adapterInput
        .effectiveStructuralRequirements
    )
    || !Array.isArray(
      adapterInput
        .effectiveStructuralRequirements
        .requirements
    )
    || !SHA256_PATTERN.test(
      adapterInput
        .effectiveGenerationInputSha256
        ?? ''
    )
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'El adapter input no conserva la frontera B3.1 requerida.'
    );
  }

  assertFiniteJson(
    adapterInput,
    '$adapterInput'
  );

  assertExactAdapterBoundary(
    adapterInput
  );
}

function requireNeutralAdapter(adapterInput) {
  if (
    adapterInput.adapterRef.adapterId
      !== NEUTRAL_ADAPTER_ID
    || adapterInput.adapterRef.adapterVersion
      !== NEUTRAL_ADAPTER_VERSION
  ) {
    fail(
      'UNSUPPORTED_NEUTRAL_ADAPTER',
      'El generador neutral sólo admite neutral-contract-adapter@1.0.0.'
    );
  }

  if (
    adapterInput.libraryRef.libraryId
      !== NEUTRAL_LIBRARY_ID
    || adapterInput.libraryRef.libraryVersion
      !== NEUTRAL_LIBRARY_VERSION
  ) {
    fail(
      'UNSUPPORTED_NEUTRAL_LIBRARY',
      'El generador neutral sólo admite neutral-contract-library@1.0.0.'
    );
  }
}

function solutionPayload(solution) {
  const {
    canonicalSha256:
      _canonicalSha256,
    ...payload
  } = solution;

  return canonicalizeValue(payload);
}

function expectedRequirementIds(adapterInput) {
  return adapterInput
    .effectiveStructuralRequirements
    .requirements
    .map((requirement) => requirement.id)
    .sort(compareText);
}

function assignmentById(adapterInput) {
  return new Map(
    adapterInput.assignments.map(
      (assignment) => [
        assignment.assignmentId,
        assignment
      ]
    )
  );
}

function validatePartition(
  solution,
  adapterInput
) {
  if (
    !Array.isArray(
      solution.requirementResolutions
    )
  ) {
    fail(
      'REQUIREMENT_PARTITION_MISMATCH',
      'requirementResolutions debe particionar exactamente los requirements efectivos.'
    );
  }

  const expected =
    expectedRequirementIds(adapterInput);

  const actual =
    solution.requirementResolutions
      .map((resolution) =>
        resolution?.requirementId
      )
      .sort(compareText);

  if (
    actual.length !== expected.length
    || actual.some(
      (id, index) =>
        id !== expected[index]
    )
    || new Set(actual).size
      !== actual.length
  ) {
    fail(
      'REQUIREMENT_PARTITION_MISMATCH',
      'Cada requirement efectivo debe aparecer exactamente una vez.'
    );
  }
}

function validateResponse(
  resolution,
  assignments
) {
  const hasResponse =
    resolution.response !== null;

  if (
    resolution.state === 'unresolved'
  ) {
    if (hasResponse) {
      fail(
        'INVALID_RESOLUTION_RESPONSE',
        'Un requirement unresolved no puede materializar response.'
      );
    }

    return;
  }

  if (!hasResponse) {
    fail(
      'INVALID_RESOLUTION_RESPONSE',
      'resolved y partiallyResolved requieren response.'
    );
  }

  if (
    !exactKeys(
      resolution.response,
      [
        'schema',
        'componentTypeIds'
      ]
    )
    || resolution.response.schema
      !== NEUTRAL_CONTRACT_RESOLUTION_SCHEMA
    || !Array.isArray(
      resolution.response.componentTypeIds
    )
    || resolution.response
      .componentTypeIds.length === 0
    || resolution.response
      .componentTypeIds.some(
        (id) =>
          !validNonEmptyString(id)
      )
  ) {
    fail(
      'INVALID_RESOLUTION_RESPONSE',
      'La response neutral no cumple el contrato v1.0.'
    );
  }

  const expectedComponents =
    [
      ...new Set(
        assignments.map(
          (assignment) =>
            assignment
              .choiceRef
              .componentTypeId
        )
      )
    ].sort(compareText);

  const actualComponents =
    [
      ...resolution
        .response
        .componentTypeIds
    ].sort(compareText);

  if (
    actualComponents.length
      !== expectedComponents.length
    || actualComponents.some(
      (id, index) =>
        id !== expectedComponents[index]
    )
  ) {
    fail(
      'INVALID_RESOLUTION_RESPONSE',
      'componentTypeIds debe provenir exactamente de los assignments declarados en provenance.'
    );
  }
}

function validateProvenance(
  resolution,
  adapterInput,
  assignmentsMap
) {
  const provenance =
    resolution.provenance;

  if (
    !exactKeys(
      provenance,
      [
        'assignmentIds',
        'adapterRef',
        'libraryRef',
        'effectiveGenerationInputSha256'
      ]
    )
    || !Array.isArray(
      provenance.assignmentIds
    )
  ) {
    fail(
      'PROVENANCE_MISMATCH',
      'La provenance de la resolution no cumple el contrato.'
    );
  }

  if (
    !sameCanonicalValue(
      provenance.adapterRef,
      adapterInput.adapterRef
    )
    || !sameCanonicalValue(
      provenance.libraryRef,
      adapterInput.libraryRef
    )
    || provenance
      .effectiveGenerationInputSha256
      !== adapterInput
        .effectiveGenerationInputSha256
  ) {
    fail(
      'PROVENANCE_MISMATCH',
      'Adapter, library y effective input de provenance deben coincidir exactamente con B3.1.'
    );
  }

  const assignmentIds =
    provenance.assignmentIds;

  if (
    new Set(assignmentIds).size
      !== assignmentIds.length
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'assignmentIds no admite duplicados.'
    );
  }

  const assignments = [];

  for (const assignmentId of assignmentIds) {
    const assignment =
      assignmentsMap.get(
        assignmentId
      );

    if (
      !assignment
      || assignment.requirementRef
        !== resolution.requirementId
    ) {
      fail(
        'PROVENANCE_ASSIGNMENT_MISMATCH',
        'Cada assignment de provenance debe existir y pertenecer al mismo requirement.'
      );
    }

    assignments.push(assignment);
  }

  if (
    resolution.state === 'unresolved'
    && assignmentIds.length !== 0
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'Una resolution unresolved no declara assignments originadores de response.'
    );
  }

  if (
    resolution.state !== 'unresolved'
    && assignmentIds.length === 0
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'Una resolution con respuesta debe declarar al menos un assignment originador.'
    );
  }

  return assignments;
}

function validateSolutionStructure(
  solution,
  adapterInput,
  {
    validateHash = true
  } = {}
) {
  requireAdapterInput(adapterInput);

  if (
    !exactKeys(
      solution,
      [
        'schema',
        'scenarioId',
        'adapterRef',
        'libraryRef',
        'effectiveGenerationInputSha256',
        'verificationState',
        'requirementResolutions',
        'canonicalSha256'
      ]
    )
    || solution.schema
      !== CONSTRUCTIVE_SOLUTION_SCHEMA
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_SOLUTION',
      `La salida debe usar exactamente ${CONSTRUCTIVE_SOLUTION_SCHEMA}.`
    );
  }

  assertFiniteJson(
    solution,
    '$solution'
  );

  if (
    solution.scenarioId
      !== adapterInput.scenarioId
    || !sameCanonicalValue(
      solution.adapterRef,
      adapterInput.adapterRef
    )
    || !sameCanonicalValue(
      solution.libraryRef,
      adapterInput.libraryRef
    )
    || solution
      .effectiveGenerationInputSha256
      !== adapterInput
        .effectiveGenerationInputSha256
  ) {
    fail(
      'PROVENANCE_MISMATCH',
      'La provenance global del output no coincide con el adapter input.'
    );
  }

  if (
    solution.verificationState
      !== 'notVerified'
  ) {
    fail(
      'INVALID_VERIFICATION_STATE',
      'SPEC-016-A sólo admite verificationState=notVerified.'
    );
  }

  validatePartition(
    solution,
    adapterInput
  );

  const assignmentsMap =
    assignmentById(adapterInput);

  for (
    const resolution
    of solution.requirementResolutions
  ) {
    if (
      !exactKeys(
        resolution,
        [
          'requirementId',
          'state',
          'response',
          'provenance'
        ]
      )
      || !validNonEmptyString(
        resolution.requirementId
      )
      || !RESOLUTION_STATES.has(
        resolution.state
      )
      || !isRecord(
        resolution.provenance
      )
    ) {
      fail(
        'INVALID_REQUIREMENT_RESOLUTION',
        'La requirement resolution no cumple el contrato v1.0.'
      );
    }

    const assignments =
      validateProvenance(
        resolution,
        adapterInput,
        assignmentsMap
      );

    validateResponse(
      resolution,
      assignments
    );
  }

  if (validateHash) {
    if (
      !SHA256_PATTERN.test(
        solution.canonicalSha256
        ?? ''
      )
      || solution.canonicalSha256
        !== fingerprint(
          solutionPayload(solution)
        )
    ) {
      fail(
        'INVALID_CANONICAL_SHA256',
        'canonicalSha256 debe corresponder al output canónico sin auto-inclusión.'
      );
    }
  }

  return true;
}

export function assertValidConstructiveSolution(
  solution,
  adapterInput
) {
  validateSolutionStructure(
    solution,
    adapterInput,
    {
      validateHash: true
    }
  );

  return solution;
}

function assignmentsResolvingRequirement(
  adapterInput,
  requirementId
) {
  return adapterInput.assignments
    .filter(
      (assignment) => (
        assignment.requirementRef
          === requirementId
        && assignment.targetRef?.kind
          === 'requirement'
        && assignment.targetRef?.ref
          === requirementId
        && SUPPORTED_NEUTRAL_COMPONENT_TYPES
          .has(
            assignment
              .choiceRef
              ?.componentTypeId
          )
      )
    )
    .sort(
      (left, right) =>
        compareText(
          left.assignmentId,
          right.assignmentId
        )
    );
}

function buildResolution(
  requirement,
  adapterInput
) {
  const assignments =
    assignmentsResolvingRequirement(
      adapterInput,
      requirement.id
    );

  if (assignments.length === 0) {
    return canonicalizeValue({
      requirementId:
        requirement.id,

      state:
        'unresolved',

      response:
        null,

      provenance: {
        assignmentIds: [],

        adapterRef:
          adapterInput.adapterRef,

        libraryRef:
          adapterInput.libraryRef,

        effectiveGenerationInputSha256:
          adapterInput
            .effectiveGenerationInputSha256
      }
    });
  }

  const componentTypeIds =
    [
      ...new Set(
        assignments.map(
          (assignment) =>
            assignment
              .choiceRef
              .componentTypeId
        )
      )
    ].sort(compareText);

  return canonicalizeValue({
    requirementId:
      requirement.id,

    state:
      'resolved',

    response: {
      schema:
        NEUTRAL_CONTRACT_RESOLUTION_SCHEMA,

      componentTypeIds
    },

    provenance: {
      assignmentIds:
        assignments.map(
          (assignment) =>
            assignment.assignmentId
        ),

      adapterRef:
        adapterInput.adapterRef,

      libraryRef:
        adapterInput.libraryRef,

      effectiveGenerationInputSha256:
        adapterInput
          .effectiveGenerationInputSha256
    }
  });
}

export function generateNeutralConstructiveSolution(
  adapterInput
) {
  requireAdapterInput(adapterInput);
  requireNeutralAdapter(adapterInput);

  const requirementResolutions =
    adapterInput
      .effectiveStructuralRequirements
      .requirements
      .map(
        (requirement) =>
          buildResolution(
            requirement,
            adapterInput
          )
      )
      .sort(
        (left, right) =>
          compareText(
            left.requirementId,
            right.requirementId
          )
      );

  const payload =
    canonicalizeValue({
      schema:
        CONSTRUCTIVE_SOLUTION_SCHEMA,

      scenarioId:
        adapterInput.scenarioId,

      adapterRef:
        adapterInput.adapterRef,

      libraryRef:
        adapterInput.libraryRef,

      effectiveGenerationInputSha256:
        adapterInput
          .effectiveGenerationInputSha256,

      verificationState:
        'notVerified',

      requirementResolutions,

      canonicalSha256:
        null
    });

  validateSolutionStructure(
    payload,
    adapterInput,
    {
      validateHash: false
    }
  );

  const canonicalPayload =
    solutionPayload(payload);

  const result =
    canonicalizeValue({
      ...canonicalPayload,
      canonicalSha256:
        fingerprint(
          canonicalPayload
        )
    });

  assertValidConstructiveSolution(
    result,
    adapterInput
  );

  return result;
}

export function deriveConstructiveCoverage(
  solution
) {
  if (
    !isRecord(solution)
    || solution.schema
      !== CONSTRUCTIVE_SOLUTION_SCHEMA
    || solution.verificationState
      !== 'notVerified'
    || !Array.isArray(
      solution.requirementResolutions
    )
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_SOLUTION',
      'Coverage requiere una constructive-solution-v1.0 materializada.'
    );
  }

  let resolvedCount = 0;
  let partiallyResolvedCount = 0;
  let unresolvedCount = 0;

  for (
    const resolution
    of solution.requirementResolutions
  ) {
    if (
      resolution?.state === 'resolved'
    ) {
      resolvedCount += 1;
    } else if (
      resolution?.state
        === 'partiallyResolved'
    ) {
      partiallyResolvedCount += 1;
    } else if (
      resolution?.state === 'unresolved'
    ) {
      unresolvedCount += 1;
    } else {
      fail(
        'INVALID_REQUIREMENT_RESOLUTION',
        'Coverage encontró un estado de resolution no contractual.'
      );
    }
  }

  const total =
    resolvedCount
    + partiallyResolvedCount
    + unresolvedCount;

  let state;

  if (
    resolvedCount === 0
    && partiallyResolvedCount === 0
  ) {
    state = 'none';
  } else if (
    total > 0
    && resolvedCount === total
  ) {
    state = 'complete';
  } else {
    state = 'partial';
  }

  return canonicalizeValue({
    state,
    resolvedCount,
    partiallyResolvedCount,
    unresolvedCount
  });
}
