import {
  assertValidConstructiveSolution,
  deriveConstructiveCoverage
} from './constructiveSolutionGeneration.js';

import {
  canonicalizeValue,
  compareText,
  fingerprint,
  idToken,
  isRecord
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_SOLUTION_V2_SCHEMA =
  'constructive-solution-v2.0';

export const CONSTRUCTIVE_RESOLUTION_RESPONSE_V2_SCHEMA =
  'constructive-resolution-response-v2.0';

const ARTIFACT_ID_PREFIX =
  'constructive-artifact:sha256:';

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const RESOLUTION_STATES =
  new Set([
    'resolved',
    'partiallyResolved',
    'unresolved'
  ]);

export class ConstructiveSolutionContractError
  extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConstructiveSolutionContractError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ConstructiveSolutionContractError(
    code,
    message,
    details
  );
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length
    && actual.every(
      (key, index) => key === expected[index]
    )
  );
}

function validNonEmptyString(value) {
  return (
    typeof value === 'string'
    && value.length > 0
  );
}

function validReferenceId(value) {
  return (
    (typeof value === 'string' && value.length > 0)
    || Number.isSafeInteger(value)
  );
}

function sameCanonicalValue(left, right) {
  return (
    JSON.stringify(canonicalizeValue(left))
    === JSON.stringify(canonicalizeValue(right))
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
    for (const [key, item] of Object.entries(value)) {
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

function artifactPayload(artifact) {
  return canonicalizeValue({
    kind: artifact.kind,
    sourceRefs: artifact.sourceRefs,
    requirementRefs: artifact.requirementRefs,
    payload: artifact.payload
  });
}

function artifactIdForPayload(payload) {
  return `${ARTIFACT_ID_PREFIX}${fingerprint(payload)}`;
}

function sourceRefToken(ref) {
  return `${ref.kind}:${idToken(ref.ref)}`;
}

function compareSourceRefs(left, right) {
  return compareText(
    sourceRefToken(left),
    sourceRefToken(right)
  );
}

function canonicalSourceRefs(sourceRefs) {
  const result = sourceRefs.map((ref) => {
    if (
      !exactKeys(ref, ['kind', 'ref'])
      || !validNonEmptyString(ref.kind)
      || !validReferenceId(ref.ref)
    ) {
      fail(
        'INVALID_ARTIFACT_SOURCE_REF',
        'Cada sourceRef debe declarar exactamente kind y ref tipado.'
      );
    }

    return {
      kind: ref.kind,
      ref: ref.ref
    };
  }).sort(compareSourceRefs);

  const tokens = result.map(sourceRefToken);
  if (new Set(tokens).size !== tokens.length) {
    fail(
      'DUPLICATE_ARTIFACT_SOURCE_REF',
      'sourceRefs no admite referencias tipadas duplicadas.'
    );
  }

  return result;
}

function canonicalRequirementRefs(
  requirementRefs
) {
  if (!Array.isArray(requirementRefs)) {
    fail(
      'INVALID_ARTIFACT_REQUIREMENT_REFS',
      'requirementRefs debe ser un arreglo.'
    );
  }

  const result = [...requirementRefs];

  if (
    result.some(
      (ref) => !validNonEmptyString(ref)
    )
  ) {
    fail(
      'INVALID_ARTIFACT_REQUIREMENT_REFS',
      'Cada requirementRef debe ser texto no vacío.'
    );
  }

  result.sort(compareText);

  if (new Set(result).size !== result.length) {
    fail(
      'DUPLICATE_ARTIFACT_REQUIREMENT_REF',
      'requirementRefs no admite duplicados.'
    );
  }

  return result;
}

export function buildConstructiveArtifact({
  kind,
  sourceRefs = [],
  requirementRefs = [],
  payload = {}
}) {
  if (!validNonEmptyString(kind)) {
    fail(
      'INVALID_ARTIFACT_KIND',
      'kind debe ser texto no vacío.'
    );
  }

  if (!Array.isArray(sourceRefs)) {
    fail(
      'INVALID_ARTIFACT_SOURCE_REFS',
      'sourceRefs debe ser un arreglo.'
    );
  }

  if (!isRecord(payload)) {
    fail(
      'INVALID_ARTIFACT_PAYLOAD',
      'payload debe ser un objeto JSON.'
    );
  }

  assertFiniteJson(payload, '$.payload');

  const artifact = canonicalizeValue({
    artifactId: null,
    kind,
    sourceRefs:
      canonicalSourceRefs(sourceRefs),
    requirementRefs:
      canonicalRequirementRefs(
        requirementRefs
      ),
    payload
  });

  const identityPayload =
    artifactPayload(artifact);

  return canonicalizeValue({
    ...artifact,
    artifactId:
      artifactIdForPayload(
        identityPayload
      )
  });
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

function validateArtifact(
  artifact,
  effectiveRequirementIds
) {
  if (
    !exactKeys(
      artifact,
      [
        'artifactId',
        'kind',
        'sourceRefs',
        'requirementRefs',
        'payload'
      ]
    )
    || !validNonEmptyString(artifact.kind)
    || !Array.isArray(artifact.sourceRefs)
    || !Array.isArray(artifact.requirementRefs)
    || !isRecord(artifact.payload)
    || typeof artifact.artifactId !== 'string'
    || !artifact.artifactId.startsWith(
      ARTIFACT_ID_PREFIX
    )
    || !SHA256_PATTERN.test(
      artifact.artifactId.slice(
        ARTIFACT_ID_PREFIX.length
      )
    )
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_ARTIFACT',
      'El artefacto no cumple el contrato común v2.'
    );
  }

  assertFiniteJson(
    artifact,
    '$.generatedArtifact'
  );

  const canonicalSources =
    canonicalSourceRefs(
      artifact.sourceRefs
    );

  const canonicalRequirements =
    canonicalRequirementRefs(
      artifact.requirementRefs
    );

  if (
    !sameCanonicalValue(
      canonicalSources,
      artifact.sourceRefs
    )
    || !sameCanonicalValue(
      canonicalRequirements,
      artifact.requirementRefs
    )
  ) {
    fail(
      'NON_CANONICAL_CONSTRUCTIVE_ARTIFACT',
      'sourceRefs y requirementRefs deben usar orden canónico.'
    );
  }

  for (
    const requirementRef
    of artifact.requirementRefs
  ) {
    if (
      !effectiveRequirementIds.has(
        requirementRef
      )
    ) {
      fail(
        'ARTIFACT_REQUIREMENT_NOT_EFFECTIVE',
        'Un artefacto sólo puede declarar requirements efectivos.',
        { requirementRef }
      );
    }
  }

  const expectedId =
    artifactIdForPayload(
      artifactPayload(artifact)
    );

  if (artifact.artifactId !== expectedId) {
    fail(
      'INVALID_ARTIFACT_ID',
      'artifactId debe corresponder al payload canónico del artefacto.'
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
      'La provenance de la resolución v2 no cumple el contrato.'
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
      'Adapter, library y effective input deben coincidir con el adapter input.'
    );
  }

  const assignmentIds =
    [...provenance.assignmentIds];

  const sortedAssignmentIds =
    [...assignmentIds].sort(compareText);

  if (
    new Set(assignmentIds).size
      !== assignmentIds.length
    || !sameCanonicalValue(
      assignmentIds,
      sortedAssignmentIds
    )
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'assignmentIds debe ser único y canónico.'
    );
  }

  for (const assignmentId of assignmentIds) {
    const assignment =
      assignmentsMap.get(assignmentId);

    if (
      !assignment
      || assignment.requirementRef
        !== resolution.requirementId
    ) {
      fail(
        'PROVENANCE_ASSIGNMENT_MISMATCH',
        'Cada assignment debe existir y pertenecer al mismo requirement.'
      );
    }
  }

  if (
    resolution.state === 'unresolved'
    && assignmentIds.length !== 0
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'Una resolución unresolved no declara assignments originadores.'
    );
  }

  if (
    resolution.state !== 'unresolved'
    && assignmentIds.length === 0
  ) {
    fail(
      'PROVENANCE_ASSIGNMENT_MISMATCH',
      'Una resolución con respuesta requiere al menos un assignment originador.'
    );
  }
}

function validateResolution(
  resolution,
  adapterInput,
  assignmentsMap,
  artifactsById
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
      'La requirement resolution no cumple el contrato v2.'
    );
  }

  validateProvenance(
    resolution,
    adapterInput,
    assignmentsMap
  );

  if (resolution.state === 'unresolved') {
    if (resolution.response !== null) {
      fail(
        'INVALID_RESOLUTION_RESPONSE',
        'Un requirement unresolved no puede materializar response.'
      );
    }
    return;
  }

  if (
    !exactKeys(
      resolution.response,
      ['schema', 'artifactRefs']
    )
    || resolution.response.schema
      !== CONSTRUCTIVE_RESOLUTION_RESPONSE_V2_SCHEMA
    || !Array.isArray(
      resolution.response.artifactRefs
    )
    || resolution.response
      .artifactRefs.length === 0
  ) {
    fail(
      'INVALID_RESOLUTION_RESPONSE',
      'resolved y partiallyResolved requieren artifactRefs v2.'
    );
  }

  const artifactRefs =
    [...resolution.response.artifactRefs];

  if (
    artifactRefs.some(
      (ref) => !validNonEmptyString(ref)
    )
    || new Set(artifactRefs).size
      !== artifactRefs.length
    || !sameCanonicalValue(
      artifactRefs,
      [...artifactRefs].sort(compareText)
    )
  ) {
    fail(
      'INVALID_RESOLUTION_RESPONSE',
      'artifactRefs debe ser único y canónico.'
    );
  }

  for (const artifactRef of artifactRefs) {
    const artifact =
      artifactsById.get(artifactRef);

    if (
      !artifact
      || !artifact.requirementRefs.includes(
        resolution.requirementId
      )
    ) {
      fail(
        'RESOLUTION_ARTIFACT_MISMATCH',
        'Cada artifactRef debe existir y declarar el mismo requirement.'
      );
    }
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

export function
assertValidConstructiveSolutionV2(
  solution,
  adapterInput
) {
  if (
    !isRecord(adapterInput)
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
  ) {
    fail(
      'INVALID_ADAPTER_INPUT',
      'La validación v2 requiere un adapter input efectivo.'
    );
  }

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
        'generatedArtifacts',
        'requirementResolutions',
        'findings',
        'canonicalSha256'
      ]
    )
    || solution.schema
      !== CONSTRUCTIVE_SOLUTION_V2_SCHEMA
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_SOLUTION',
      `La salida debe usar exactamente ${CONSTRUCTIVE_SOLUTION_V2_SCHEMA}.`
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
      'La provenance global del output v2 no coincide con el adapter input.'
    );
  }

  if (
    solution.verificationState
      !== 'notVerified'
  ) {
    fail(
      'INVALID_VERIFICATION_STATE',
      'La solución constructiva v2 sólo admite verificationState=notVerified.'
    );
  }

  if (
    !Array.isArray(
      solution.generatedArtifacts
    )
    || !Array.isArray(
      solution.requirementResolutions
    )
    || !Array.isArray(
      solution.findings
    )
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_SOLUTION',
      'generatedArtifacts, requirementResolutions y findings deben ser arreglos.'
    );
  }

  const expectedRequirements =
    expectedRequirementIds(adapterInput);

  const actualRequirements =
    solution.requirementResolutions
      .map(
        (resolution) =>
          resolution?.requirementId
      );

  if (
    !sameCanonicalValue(
      actualRequirements,
      [...expectedRequirements]
    )
    || new Set(actualRequirements).size
      !== actualRequirements.length
  ) {
    fail(
      'REQUIREMENT_PARTITION_MISMATCH',
      'Cada requirement efectivo debe aparecer exactamente una vez y en orden canónico.'
    );
  }

  const effectiveRequirementIds =
    new Set(expectedRequirements);

  const artifactIds =
    solution.generatedArtifacts.map(
      (artifact) => artifact?.artifactId
    );

  if (
    new Set(artifactIds).size
      !== artifactIds.length
    || !sameCanonicalValue(
      artifactIds,
      [...artifactIds].sort(compareText)
    )
  ) {
    fail(
      'INVALID_ARTIFACT_PARTITION',
      'generatedArtifacts debe usar IDs únicos y orden canónico.'
    );
  }

  for (
    const artifact
    of solution.generatedArtifacts
  ) {
    validateArtifact(
      artifact,
      effectiveRequirementIds
    );
  }

  const artifactsById =
    new Map(
      solution.generatedArtifacts.map(
        (artifact) => [
          artifact.artifactId,
          artifact
        ]
      )
    );

  const assignmentsMap =
    assignmentById(adapterInput);

  for (
    const resolution
    of solution.requirementResolutions
  ) {
    validateResolution(
      resolution,
      adapterInput,
      assignmentsMap,
      artifactsById
    );
  }

  const resolutionsByRequirement =
    new Map(
      solution.requirementResolutions.map(
        (resolution) => [
          resolution.requirementId,
          resolution
        ]
      )
    );

  for (
    const artifact
    of solution.generatedArtifacts
  ) {
    for (
      const requirementRef
      of artifact.requirementRefs
    ) {
      const resolution =
        resolutionsByRequirement.get(
          requirementRef
        );

      if (
        !resolution
        || resolution.state === 'unresolved'
        || !resolution.response
          ?.artifactRefs
          ?.includes(
            artifact.artifactId
          )
        || resolution.provenance
          .assignmentIds.length === 0
      ) {
        fail(
          'ARTIFACT_REQUIREMENT_CLAIM_MISMATCH',
          'Todo artefacto que reclama un requirement debe quedar trazado por una resolución con assignment explícito.'
        );
      }
    }
  }

  const canonicalFindings =
    solution.findings
      .map((finding) => {
        assertFiniteJson(
          finding,
          '$.findings[]'
        );
        return canonicalizeValue(finding);
      })
      .sort(
        (left, right) =>
          compareText(
            JSON.stringify(left),
            JSON.stringify(right)
          )
      );

  if (
    !sameCanonicalValue(
      solution.findings,
      canonicalFindings
    )
  ) {
    fail(
      'NON_CANONICAL_FINDINGS',
      'findings debe usar orden canónico.'
    );
  }

  if (
    !SHA256_PATTERN.test(
      solution.canonicalSha256 ?? ''
    )
    || solution.canonicalSha256
      !== fingerprint(
        solutionPayload(solution)
      )
  ) {
    fail(
      'INVALID_CANONICAL_SHA256',
      'canonicalSha256 debe corresponder al output v2 canónico sin auto-inclusión.'
    );
  }

  return solution;
}

export function buildConstructiveSolutionV2({
  adapterInput,
  generatedArtifacts = [],
  requirementResolutions,
  findings = []
}) {
  if (!Array.isArray(requirementResolutions)) {
    fail(
      'INVALID_REQUIREMENT_RESOLUTIONS',
      'requirementResolutions debe ser un arreglo.'
    );
  }

  const canonicalArtifacts =
    generatedArtifacts
      .map((artifact) =>
        canonicalizeValue(artifact)
      )
      .sort(
        (left, right) =>
          compareText(
            left.artifactId,
            right.artifactId
          )
      );

  const canonicalResolutions =
    requirementResolutions
      .map((resolution) =>
        canonicalizeValue(resolution)
      )
      .sort(
        (left, right) =>
          compareText(
            left.requirementId,
            right.requirementId
          )
      );

  const canonicalFindings =
    findings
      .map((finding) => {
        assertFiniteJson(
          finding,
          '$.findings[]'
        );
        return canonicalizeValue(finding);
      })
      .sort(
        (left, right) =>
          compareText(
            JSON.stringify(left),
            JSON.stringify(right)
          )
      );

  const payload =
    canonicalizeValue({
      schema:
        CONSTRUCTIVE_SOLUTION_V2_SCHEMA,

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

      generatedArtifacts:
        canonicalArtifacts,

      requirementResolutions:
        canonicalResolutions,

      findings:
        canonicalFindings
    });

  const result =
    canonicalizeValue({
      ...payload,
      canonicalSha256:
        fingerprint(payload)
    });

  assertValidConstructiveSolutionV2(
    result,
    adapterInput
  );

  return result;
}

export function
deriveConstructiveCoverageV2(
  solution
) {
  if (
    !isRecord(solution)
    || solution.schema
      !== CONSTRUCTIVE_SOLUTION_V2_SCHEMA
    || solution.verificationState
      !== 'notVerified'
    || !Array.isArray(
      solution.requirementResolutions
    )
  ) {
    fail(
      'INVALID_CONSTRUCTIVE_SOLUTION',
      'Coverage v2 requiere una constructive-solution-v2.0 materializada.'
    );
  }

  let resolvedCount = 0;
  let partiallyResolvedCount = 0;
  let unresolvedCount = 0;

  for (
    const resolution
    of solution.requirementResolutions
  ) {
    if (resolution?.state === 'resolved') {
      resolvedCount += 1;
    } else if (
      resolution?.state
        === 'partiallyResolved'
    ) {
      partiallyResolvedCount += 1;
    } else if (
      resolution?.state
        === 'unresolved'
    ) {
      unresolvedCount += 1;
    } else {
      fail(
        'INVALID_REQUIREMENT_RESOLUTION',
        'Estado de resolution no reconocido.'
      );
    }
  }

  const total =
    resolvedCount
    + partiallyResolvedCount
    + unresolvedCount;

  const state =
    total === 0 || unresolvedCount === total
      ? 'none'
      : unresolvedCount === 0
        && partiallyResolvedCount === 0
        ? 'complete'
        : 'partial';

  return canonicalizeValue({
    state,
    resolvedCount,
    partiallyResolvedCount,
    unresolvedCount
  });
}

export function
assertValidConstructiveSolutionBySchema(
  solution,
  adapterInput
) {
  if (
    solution?.schema
      === CONSTRUCTIVE_SOLUTION_V2_SCHEMA
  ) {
    return assertValidConstructiveSolutionV2(
      solution,
      adapterInput
    );
  }

  return assertValidConstructiveSolution(
    solution,
    adapterInput
  );
}

export function
deriveConstructiveCoverageBySchema(
  solution
) {
  if (
    solution?.schema
      === CONSTRUCTIVE_SOLUTION_V2_SCHEMA
  ) {
    return deriveConstructiveCoverageV2(
      solution
    );
  }

  return deriveConstructiveCoverage(
    solution
  );
}
