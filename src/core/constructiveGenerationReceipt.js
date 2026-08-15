import {
  CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA,
  assertValidConstructiveSolutions,
  canonicalizeConstructiveSolutions
} from './constructiveSolutionScenarios.js';

import {
  CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA,
  buildConstructiveAdapterInput,
  evaluateConstructiveGenerationAvailability
} from './constructiveGenerationInput.js';

import {
  assertValidConstructiveSolutionBySchema,
  deriveConstructiveCoverageBySchema
} from './constructiveSolutionContract.js';

import {
  projectConstructiveScenarioConfiguration
} from './constructiveScenarioContext.js';

import {
  canonicalizeValue,
  isRecord
} from './structuralProposalCommon.js';

const EFFECTIVE_CONSTRUCTIVE_INPUT_SCHEMA =
  'constructive-effective-input-v1.0';

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const RECEIPT_KEYS =
  new Set([
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

const EFFECTIVE_FINGERPRINT_KEYS =
  new Set([
    'effectiveGeometrySha256',
    'effectiveStructuralRequirementsSha256',
    'relevantBlockingDecisionContextSha256',
    'scopeSha256',
    'configurationSha256',
    'assignmentsSha256',
    'adapterFingerprint',
    'libraryFingerprint'
  ]);

const GLOBAL_PROVENANCE_KEYS =
  new Set([
    'geometrySha256',
    'requirementsSha256',
    'requirementsSourceAggregateSha256',
    'structuralIntentSha256',
    'topologyR0R5Sha256'
  ]);

const COVERAGE_STATES =
  new Set([
    'none',
    'partial',
    'complete'
  ]);

export class ConstructiveGenerationReceiptError
  extends Error {
  constructor(
    code,
    message,
    details = []
  ) {
    super(message);

    this.name =
      'ConstructiveGenerationReceiptError';

    this.code =
      code;

    this.details =
      details;
  }
}

function fail(
  code,
  message,
  details = []
) {
  throw new ConstructiveGenerationReceiptError(
    code,
    message,
    details
  );
}

function cloneJson(value) {
  return structuredClone(value);
}

function sameCanonicalValue(
  left,
  right
) {
  return JSON.stringify(
    canonicalizeValue(left)
  ) === JSON.stringify(
    canonicalizeValue(right)
  );
}

function assertExactKeys(
  value,
  keys,
  path
) {
  if (!isRecord(value)) {
    fail(
      'INVALID_RECEIPT',
      `${path} debe ser un objeto.`
    );
  }

  const actual =
    Object.keys(value);

  if (
    actual.length !== keys.size
    || actual.some(
      (key) =>
        !keys.has(key)
    )
  ) {
    fail(
      'INVALID_RECEIPT',
      `${path} contiene campos distintos del contrato exacto.`
    );
  }
}

function assertSha256(
  value,
  path
) {
  if (
    typeof value !== 'string'
    || !SHA256_PATTERN.test(value)
  ) {
    fail(
      'INVALID_RECEIPT',
      `${path} debe ser SHA-256 hexadecimal.`
    );
  }
}

function assertCount(
  value,
  path
) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    fail(
      'INVALID_RECEIPT',
      `${path} debe ser un entero seguro no negativo.`
    );
  }
}

function requireAdapterInput(
  adapterInput
) {
  if (
    !isRecord(adapterInput)
    || adapterInput.schema
      !== CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'adapterInput no cumple constructive-adapter-input-v1.0.'
    );
  }

  if (
    !isRecord(
      adapterInput
        .effectiveStructuralRequirements
    )
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'effectiveStructuralRequirements es inválido.'
    );
  }

  let rebuilt;

  try {
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

    rebuilt =
      buildConstructiveAdapterInput(
        reconstructedEffectiveInput
      );
  } catch (error) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'adapterInput no es reproducible por la frontera B3.1.',
      [
        {
          causeCode:
            error?.code ?? 'UNKNOWN'
        }
      ]
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
      'adapterInput difiere de la salida canónica B3.1.'
    );
  }

  return adapterInput;
}

function effectiveRequirementCount(
  adapterInput
) {
  const requirements =
    adapterInput
      .effectiveStructuralRequirements
      .requirements;

  if (
    !Array.isArray(requirements)
    || requirements.length === 0
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'El input efectivo debe contener requirements.'
    );
  }

  return requirements.length;
}

function assertReceiptSemantics(
  receipt,
  expectedRequirementCount = null
) {
  const {
    coverageAtGeneration,
    resolvedCount,
    partiallyResolvedCount,
    unresolvedCount
  } = receipt;

  const total =
    resolvedCount
    + partiallyResolvedCount
    + unresolvedCount;

  if (total <= 0) {
    fail(
      'INVALID_RECEIPT',
      'Un receipt generado debe cubrir al menos un requirement.'
    );
  }

  if (
    expectedRequirementCount !== null
    && total !== expectedRequirementCount
  ) {
    fail(
      'INVALID_RECEIPT',
      'Los conteos del receipt no cubren exactamente los requirements efectivos.'
    );
  }

  if (
    coverageAtGeneration === 'none'
    && (
      resolvedCount !== 0
      || partiallyResolvedCount !== 0
    )
  ) {
    fail(
      'INVALID_RECEIPT',
      'coverage none no admite respuestas.'
    );
  }

  if (
    coverageAtGeneration === 'complete'
    && (
      resolvedCount <= 0
      || partiallyResolvedCount !== 0
      || unresolvedCount !== 0
    )
  ) {
    fail(
      'INVALID_RECEIPT',
      'coverage complete exige todos los requirements resolved.'
    );
  }

  if (
    coverageAtGeneration === 'partial'
  ) {
    const responseCount =
      resolvedCount
      + partiallyResolvedCount;

    const allResolved =
      resolvedCount === total
      && partiallyResolvedCount === 0
      && unresolvedCount === 0;

    if (
      responseCount <= 0
      || allResolved
    ) {
      fail(
        'INVALID_RECEIPT',
        'coverage partial exige alguna respuesta sin resolución total.'
      );
    }
  }
}

function validateOperationalReceipt(
  receipt,
  expectedRequirementCount = null
) {
  assertExactKeys(
    receipt,
    RECEIPT_KEYS,
    'receipt'
  );

  if (
    receipt.schema
      !== CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA
  ) {
    fail(
      'INVALID_RECEIPT',
      'schema de receipt inválido.'
    );
  }

  assertSha256(
    receipt.effectiveGenerationInputSha256,
    'receipt.effectiveGenerationInputSha256'
  );

  assertSha256(
    receipt.outputCanonicalSha256,
    'receipt.outputCanonicalSha256'
  );

  if (
    !COVERAGE_STATES.has(
      receipt.coverageAtGeneration
    )
  ) {
    fail(
      'INVALID_RECEIPT',
      'coverageAtGeneration debe ser none, partial o complete.'
    );
  }

  assertCount(
    receipt.resolvedCount,
    'receipt.resolvedCount'
  );

  assertCount(
    receipt.partiallyResolvedCount,
    'receipt.partiallyResolvedCount'
  );

  assertCount(
    receipt.unresolvedCount,
    'receipt.unresolvedCount'
  );

  assertExactKeys(
    receipt.effectiveFingerprints,
    EFFECTIVE_FINGERPRINT_KEYS,
    'receipt.effectiveFingerprints'
  );

  for (
    const key
    of EFFECTIVE_FINGERPRINT_KEYS
  ) {
    assertSha256(
      receipt.effectiveFingerprints[key],
      `receipt.effectiveFingerprints.${key}`
    );
  }

  assertExactKeys(
    receipt.globalProvenance,
    GLOBAL_PROVENANCE_KEYS,
    'receipt.globalProvenance'
  );

  for (
    const key
    of GLOBAL_PROVENANCE_KEYS
  ) {
    assertSha256(
      receipt.globalProvenance[key],
      `receipt.globalProvenance.${key}`
    );
  }

  assertReceiptSemantics(
    receipt,
    expectedRequirementCount
  );

  return receipt;
}

export function
assertOperationallyValidConstructiveGenerationReceipt(
  receipt
) {
  validateOperationalReceipt(
    receipt
  );

  return receipt;
}

function requireGlobalProvenance(
  structuralRequirements
) {
  if (
    !isRecord(structuralRequirements)
    || !isRecord(
      structuralRequirements
        .sourceFingerprints
    )
  ) {
    fail(
      'INVALID_GLOBAL_PROVENANCE',
      'structuralRequirements no contiene provenance global utilizable.'
    );
  }

  const source =
    structuralRequirements
      .sourceFingerprints;

  const globalProvenance = {
    geometrySha256:
      source.geometrySha256,

    requirementsSha256:
      structuralRequirements
        .canonicalSha256,

    requirementsSourceAggregateSha256:
      source.aggregateSha256,

    structuralIntentSha256:
      source.structuralIntentSha256,

    topologyR0R5Sha256:
      source.topologyR0R5Sha256
  };

  for (
    const key
    of GLOBAL_PROVENANCE_KEYS
  ) {
    if (
      typeof globalProvenance[key]
        !== 'string'
      || !SHA256_PATTERN.test(
        globalProvenance[key]
      )
    ) {
      fail(
        'INVALID_GLOBAL_PROVENANCE',
        `globalProvenance.${key} no contiene SHA-256 válido.`
      );
    }
  }

  return globalProvenance;
}

export function
buildConstructiveGenerationReceipt({
  adapterInput,
  solution,
  structuralRequirements,
  solutionValidator = null
}) {
  requireAdapterInput(
    adapterInput
  );

  try {
    if (solutionValidator !== null) {
      if (typeof solutionValidator !== 'function') {
        fail(
          'INVALID_SOLUTION_VALIDATOR',
          'solutionValidator debe ser una función o null.'
        );
      }

      solutionValidator(
        solution,
        adapterInput
      );
    } else {
      assertValidConstructiveSolutionBySchema(
        solution,
        adapterInput
      );
    }
  } catch (error) {
    fail(
      'INVALID_SOLUTION',
      'La solución no cumple el contrato B3.2 para este input.',
      [
        {
          causeCode:
            error?.code ?? 'UNKNOWN'
        }
      ]
    );
  }

  const coverage =
    deriveConstructiveCoverageBySchema(
      solution
    );

  const receipt =
    canonicalizeValue({
      schema:
        CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA,

      effectiveGenerationInputSha256:
        adapterInput
          .effectiveGenerationInputSha256,

      outputCanonicalSha256:
        solution.canonicalSha256,

      coverageAtGeneration:
        coverage.state,

      resolvedCount:
        coverage.resolvedCount,

      partiallyResolvedCount:
        coverage.partiallyResolvedCount,

      unresolvedCount:
        coverage.unresolvedCount,

      effectiveFingerprints:
        cloneJson(
          adapterInput
            .effectiveFingerprints
        ),

      globalProvenance:
        requireGlobalProvenance(
          structuralRequirements
        )
    });

  validateOperationalReceipt(
    receipt,
    effectiveRequirementCount(
      adapterInput
    )
  );

  return receipt;
}

export function
deriveConstructiveGenerationState({
  adapterInput,
  receipt,
  availabilityContext
}) {
  requireAdapterInput(
    adapterInput
  );

  if (receipt === null) {
    return {
      coverage:
        'notGenerated',

      freshness:
        'notGenerated'
    };
  }

  validateOperationalReceipt(
    receipt
  );

  const sameEffectiveInput =
    receipt
      .effectiveGenerationInputSha256
    === adapterInput
      .effectiveGenerationInputSha256;

  if (sameEffectiveInput) {
    validateOperationalReceipt(
      receipt,
      effectiveRequirementCount(
        adapterInput
      )
    );
  }

  const availability =
    evaluateConstructiveGenerationAvailability(
      adapterInput,
      availabilityContext
    );

  const coverage =
    sameEffectiveInput
      ? receipt.coverageAtGeneration
      : 'notGenerated';

  if (
    availability.state
      === 'unavailable'
  ) {
    return {
      coverage,
      freshness:
        'unavailable'
    };
  }

  return {
    coverage,
    freshness:
      sameEffectiveInput
        ? 'fresh'
        : 'stale'
  };
}

function scenarioProjection(
  scenario
) {
  return {
    scenarioId:
      scenario.scenarioId,

    adapterRef:
      scenario.adapterRef,

    libraryRef:
      scenario.libraryRef,

    configuration:
      projectConstructiveScenarioConfiguration(
        scenario.configuration
      ),

    scope:
      scenario.scope,

    assignments:
      scenario.assignments
  };
}

function adapterScenarioProjection(
  adapterInput
) {
  return {
    scenarioId:
      adapterInput.scenarioId,

    adapterRef:
      adapterInput.adapterRef,

    libraryRef:
      adapterInput.libraryRef,

    configuration:
      projectConstructiveScenarioConfiguration(
        adapterInput.configuration
      ),

    scope:
      adapterInput.scope,

    assignments:
      adapterInput.assignments
  };
}

export function
recordConstructiveGenerationReceipt(
  constructiveSolutions,
  scenarioId,
  receipt,
  adapterInput
) {
  assertValidConstructiveSolutions(
    constructiveSolutions
  );

  requireAdapterInput(
    adapterInput
  );

  if (
    adapterInput.scenarioId
      !== scenarioId
  ) {
    fail(
      'SCENARIO_INPUT_MISMATCH',
      'adapterInput pertenece a otro escenario.'
    );
  }

  const scenario =
    constructiveSolutions
      .scenarios
      .find(
        (item) =>
          item.scenarioId
            === scenarioId
      );

  if (!scenario) {
    fail(
      'SCENARIO_NOT_FOUND',
      `No existe el escenario ${scenarioId}.`
    );
  }

  if (
    scenario.lifecycle
      === 'archived'
  ) {
    fail(
      'SCENARIO_ARCHIVED',
      'Un escenario archivado no puede registrar generación.'
    );
  }

  if (
    !sameCanonicalValue(
      scenarioProjection(
        scenario
      ),
      adapterScenarioProjection(
        adapterInput
      )
    )
  ) {
    fail(
      'SCENARIO_INPUT_MISMATCH',
      'El input de generación no corresponde al estado persistente actual del escenario.'
    );
  }

  validateOperationalReceipt(
    receipt,
    effectiveRequirementCount(
      adapterInput
    )
  );

  if (
    receipt
      .effectiveGenerationInputSha256
    !== adapterInput
      .effectiveGenerationInputSha256
  ) {
    fail(
      'RECEIPT_INPUT_MISMATCH',
      'El receipt no corresponde al input efectivo actual.'
    );
  }

  const current =
    canonicalizeConstructiveSolutions(
      constructiveSolutions
    );

  const currentScenario =
    current.scenarios.find(
      (item) =>
        item.scenarioId
          === scenarioId
    );

  if (
    currentScenario.lastGeneration
      !== null
    && sameCanonicalValue(
      currentScenario
        .lastGeneration,
      receipt
    )
  ) {
    return {
      constructiveSolutions:
        current,

      scenario:
        cloneJson(
          currentScenario
        ),

      changed:
        false
    };
  }

  const candidate =
    cloneJson(
      current
    );

  const candidateScenario =
    candidate.scenarios.find(
      (item) =>
        item.scenarioId
          === scenarioId
    );

  candidateScenario.lastGeneration =
    cloneJson(
      receipt
    );

  const next =
    canonicalizeConstructiveSolutions(
      candidate
    );

  const nextScenario =
    next.scenarios.find(
      (item) =>
        item.scenarioId
          === scenarioId
    );

  return {
    constructiveSolutions:
      next,

    scenario:
      cloneJson(
        nextScenario
      ),

    changed:
      true
  };
}
