import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
  projectEffectiveConstructiveInput
} from '../src/core/constructiveScenarioContext.js';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  buildStructuralRequirementsWithReferenceResolutionContext
} from '../src/core/structuralRequirements.js';

import {
  createStructuralReferenceResolutionContext
} from '../src/core/structuralReferenceResolutionContext.js';

import {
  canonicalizeValue,
  fingerprint
} from '../src/core/structuralProposalCommon.js';

import {
  buildConstructiveAdapterInput
} from '../src/core/constructiveGenerationInput.js';

import {
  CONSTRUCTIVE_SOLUTION_SCHEMA,
  NEUTRAL_CONTRACT_RESOLUTION_SCHEMA,
  ConstructiveSolutionGenerationError,
  assertValidConstructiveSolution,
  deriveConstructiveCoverage,
  generateNeutralConstructiveSolution
} from '../src/core/constructiveSolutionGeneration.js';

import { buildFx008Rev8Short } from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER_REQUIREMENT =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE_REQUIREMENT =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const COMPONENT_TRANSFER =
  'abstract-load-transfer-response';

const COMPONENT_LATERAL =
  'abstract-lateral-response';

const SHA_A = 'a'.repeat(64);

let fx;

function inputFrom(context) {
  return {
    geometry: context.geometry,
    topology: context.topology,
    structuralIntent: context.model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent,
    structuralProposals: context.proposals,
    structuralProposalReviews:
      context.model.structuralProposalReviews,
    candidateLoadPaths: context.paths
  };
}

test.before(async () => {
  const context =
    await buildFx008Rev8Short({
      declareEndpointSupports: true
    });

  const companion =
    buildStructuralRequirementsWithReferenceResolutionContext(
      inputFrom(context)
    );

  fx = {
    context,
    requirements: companion.structuralRequirements,
    referenceResolutionContext:
      companion.referenceResolutionContext
  };
});

function scenarioInput(name) {
  return {
    metadata: {
      name,
      description: ''
    },

    adapterRef: {
      adapterId: 'neutral-contract-adapter',
      adapterVersion: '1.0.0'
    },

    libraryRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      sha256: SHA_A
    },

    configuration: {
      schema: 'neutral-contract-configuration-v1.0'
    },

    scope: {
      mode: 'requirements',
      requirementIds: [
        LOAD_TRANSFER_REQUIREMENT,
        LATERAL_RESISTANCE_REQUIREMENT
      ]
    }
  };
}

function assignmentInput(
  requirementRef,
  componentTypeId
) {
  return {
    requirementRef,

    targetRef: {
      kind: 'requirement',
      ref: requirementRef
    },

    choiceRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      componentTypeId
    },

    parameters: {}
  };
}

function rootWithScenarioPair() {
  let root = createEmptyConstructiveSolutions();

  root = createConstructiveScenario(
    root,
    scenarioInput('FX-008 A')
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignmentInput(
      LOAD_TRANSFER_REQUIREMENT,
      COMPONENT_TRANSFER
    )
  ).constructiveSolutions;

  root = createConstructiveScenario(
    root,
    scenarioInput('FX-008 B')
  ).constructiveSolutions;

  return root;
}

function rootWithBothAssignments() {
  let root = createEmptyConstructiveSolutions();

  root = createConstructiveScenario(
    root,
    scenarioInput('Contrato completo sintético')
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignmentInput(
      LOAD_TRANSFER_REQUIREMENT,
      COMPONENT_TRANSFER
    )
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignmentInput(
      LATERAL_RESISTANCE_REQUIREMENT,
      COMPONENT_LATERAL
    )
  ).constructiveSolutions;

  return root;
}

function libraryContext() {
  return {
    schema: CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
    libraryId: 'neutral-contract-library',
    libraryVersion: '1.0.0',
    sha256: SHA_A,

    componentTypes: [
      {
        componentTypeId: COMPONENT_TRANSFER,
        upstreamSecret: true
      },
      {
        componentTypeId: COMPONENT_LATERAL,
        upstreamSecret: true
      }
    ]
  };
}

function referenceContextFor(requirements) {
  return createStructuralReferenceResolutionContext(
    requirements,
    {
      referenceBindings:
        fx.referenceResolutionContext.referenceBindings,

      targets:
        fx.referenceResolutionContext.targets,

      provenanceRelations:
        fx.referenceResolutionContext.provenanceRelations
    }
  );
}

function adapterInputFor(scenario) {
  const effective =
    projectEffectiveConstructiveInput({
      scenario,

      structuralRequirements:
        fx.requirements,

      referenceResolutionContext:
        referenceContextFor(fx.requirements),

      geometry:
        fx.context.geometry,

      libraryContext:
        libraryContext()
    });

  return buildConstructiveAdapterInput(effective);
}

function pairInputs() {
  const root = rootWithScenarioPair();

  return {
    a: adapterInputFor(root.scenarios[0]),
    b: adapterInputFor(root.scenarios[1])
  };
}

function resolutionFor(solution, requirementId) {
  return solution.requirementResolutions.find(
    (item) => item.requirementId === requirementId
  );
}

function solutionPayload(solution) {
  const {
    canonicalSha256: _canonicalSha256,
    ...payload
  } = solution;

  return canonicalizeValue(payload);
}

function rehashSolution(solution) {
  const payload = solutionPayload(solution);

  return canonicalizeValue({
    ...payload,
    canonicalSha256: fingerprint(payload)
  });
}

function deepFreeze(value) {
  if (
    !value
    || typeof value !== 'object'
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  for (const item of Object.values(value)) {
    deepFreeze(item);
  }

  return value;
}

test(
  'SPEC-016-A B3.2: FX-008 A produce constructive-solution-v1.0 mínimo con transferencia resolved y lateral unresolved',
  () => {
    const { a } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(a);

    assert.equal(
      solution.schema,
      CONSTRUCTIVE_SOLUTION_SCHEMA
    );

    assert.equal(
      solution.schema,
      'constructive-solution-v1.0'
    );

    assert.deepEqual(
      Object.keys(solution).sort(),
      [
        'schema',
        'scenarioId',
        'adapterRef',
        'libraryRef',
        'effectiveGenerationInputSha256',
        'verificationState',
        'requirementResolutions',
        'canonicalSha256'
      ].sort()
    );

    assert.equal(
      solution.scenarioId,
      'scenario:000001'
    );

    assert.deepEqual(
      solution.adapterRef,
      a.adapterRef
    );

    assert.deepEqual(
      solution.libraryRef,
      a.libraryRef
    );

    assert.equal(
      solution.effectiveGenerationInputSha256,
      a.effectiveGenerationInputSha256
    );

    assert.equal(
      solution.verificationState,
      'notVerified'
    );

    assert.equal(
      solution.requirementResolutions.length,
      2
    );

    const transfer =
      resolutionFor(
        solution,
        LOAD_TRANSFER_REQUIREMENT
      );

    const lateral =
      resolutionFor(
        solution,
        LATERAL_RESISTANCE_REQUIREMENT
      );

    assert.equal(
      transfer.state,
      'resolved'
    );

    assert.deepEqual(
      transfer.response,
      {
        schema:
          NEUTRAL_CONTRACT_RESOLUTION_SCHEMA,

        componentTypeIds: [
          COMPONENT_TRANSFER
        ]
      }
    );

    assert.deepEqual(
      transfer.provenance,
      {
        assignmentIds: [
          'scenario:000001/assignment:000001'
        ],

        adapterRef:
          a.adapterRef,

        libraryRef:
          a.libraryRef,

        effectiveGenerationInputSha256:
          a.effectiveGenerationInputSha256
      }
    );

    assert.equal(
      lateral.state,
      'unresolved'
    );

    assert.equal(
      lateral.response,
      null
    );

    assert.deepEqual(
      lateral.provenance.assignmentIds,
      []
    );
  }
);

test(
  'SPEC-016-A B3.2: FX-008 A deriva coverage partial 1/0/1 y nunca verified',
  () => {
    const { a } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(a);

    assert.deepEqual(
      deriveConstructiveCoverage(solution),
      {
        state: 'partial',
        resolvedCount: 1,
        partiallyResolvedCount: 0,
        unresolvedCount: 1
      }
    );

    assert.equal(
      solution.verificationState,
      'notVerified'
    );
  }
);

test(
  'SPEC-016-A B3.2: FX-008 B sin assignment produce ambos unresolved y coverage none',
  () => {
    const { b } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(b);

    assert.equal(
      solution.scenarioId,
      'scenario:000002'
    );

    assert.deepEqual(
      solution.requirementResolutions.map(
        (item) => item.requirementId
      ),
      [
        LOAD_TRANSFER_REQUIREMENT,
        LATERAL_RESISTANCE_REQUIREMENT
      ].sort()
    );

    for (
      const resolution
      of solution.requirementResolutions
    ) {
      assert.equal(
        resolution.state,
        'unresolved'
      );

      assert.equal(
        resolution.response,
        null
      );

      assert.deepEqual(
        resolution.provenance.assignmentIds,
        []
      );
    }

    assert.deepEqual(
      deriveConstructiveCoverage(solution),
      {
        state: 'none',
        resolvedCount: 0,
        partiallyResolvedCount: 0,
        unresolvedCount: 2
      }
    );

    assert.equal(
      solution.verificationState,
      'notVerified'
    );
  }
);

test(
  'SPEC-016-A B3.2: A y B conservan identidad, output y hashes independientes',
  () => {
    const { a, b } = pairInputs();

    const solutionA =
      generateNeutralConstructiveSolution(a);

    const solutionB =
      generateNeutralConstructiveSolution(b);

    assert.notEqual(
      solutionA.scenarioId,
      solutionB.scenarioId
    );

    assert.notEqual(
      solutionA.effectiveGenerationInputSha256,
      solutionB.effectiveGenerationInputSha256
    );

    assert.notEqual(
      solutionA.canonicalSha256,
      solutionB.canonicalSha256
    );
  }
);

test(
  'SPEC-016-A B3.2: canonicalSha256 se calcula sobre output validado sin auto-inclusión',
  () => {
    const { a } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(a);

    assert.match(
      solution.canonicalSha256,
      /^[a-f0-9]{64}$/
    );

    assert.equal(
      solution.canonicalSha256,
      fingerprint(solutionPayload(solution))
    );

    assert.equal(
      Object.hasOwn(
        solutionPayload(solution),
        'canonicalSha256'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A B3.2: generación es determinista, pura y no comparte referencias mutables con el input',
  () => {
    const { a } = pairInputs();

    const frozen =
      deepFreeze(
        structuredClone(a)
      );

    const first =
      generateNeutralConstructiveSolution(frozen);

    const second =
      generateNeutralConstructiveSolution(
        structuredClone(a)
      );

    assert.deepEqual(
      second,
      first
    );

    assert.notStrictEqual(
      first.adapterRef,
      frozen.adapterRef
    );

    assert.notStrictEqual(
      first.libraryRef,
      frozen.libraryRef
    );

    assert.deepEqual(
      frozen,
      a
    );
  }
);

test(
  'SPEC-016-A B3.2: cada requirement efectivo aparece exactamente una vez',
  () => {
    const { a } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(a);

    assert.deepEqual(
      solution.requirementResolutions
        .map((item) => item.requirementId)
        .sort(),
      a.effectiveStructuralRequirements
        .requirements
        .map((item) => item.id)
        .sort()
    );

    const duplicate =
      structuredClone(solution);

    duplicate.requirementResolutions[1].requirementId =
      duplicate.requirementResolutions[0].requirementId;

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(duplicate),
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'REQUIREMENT_PARTITION_MISMATCH'
      )
    );

    const omitted =
      structuredClone(solution);

    omitted.requirementResolutions.pop();

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(omitted),
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'REQUIREMENT_PARTITION_MISMATCH'
      )
    );
  }
);

test(
  'SPEC-016-A B3.2: requirement ajeno al effective input falla cerrado',
  () => {
    const { a } = pairInputs();

    const solution =
      generateNeutralConstructiveSolution(a);

    const foreign =
      structuredClone(solution);

    foreign.requirementResolutions[1]
      .requirementId =
        `sr-requirement:sha256:${'c'.repeat(64)}`;

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(foreign),
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'REQUIREMENT_PARTITION_MISMATCH'
      )
    );
  }
);

test(
  'SPEC-016-A B3.2: sólo verificationState=notVerified es admisible',
  () => {
    const { a } = pairInputs();

    for (
      const forbidden
      of ['verified', 'verificationFailed']
    ) {
      const invalid =
        generateNeutralConstructiveSolution(a);

      invalid.verificationState =
        forbidden;

      assert.throws(
        () => assertValidConstructiveSolution(
          rehashSolution(invalid),
          a
        ),
        (error) => (
          error
            instanceof ConstructiveSolutionGenerationError
          && error.code
            === 'INVALID_VERIFICATION_STATE'
        )
      );
    }
  }
);

test(
  'SPEC-016-A B3.2: resolved/partiallyResolved requieren response y unresolved la prohíbe',
  () => {
    const { a } = pairInputs();

    const resolvedWithoutResponse =
      generateNeutralConstructiveSolution(a);

    resolutionFor(
      resolvedWithoutResponse,
      LOAD_TRANSFER_REQUIREMENT
    ).response = null;

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(resolvedWithoutResponse),
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_RESOLUTION_RESPONSE'
      )
    );

    const unresolvedWithResponse =
      generateNeutralConstructiveSolution(a);

    resolutionFor(
      unresolvedWithResponse,
      LATERAL_RESISTANCE_REQUIREMENT
    ).response = {
      schema:
        NEUTRAL_CONTRACT_RESOLUTION_SCHEMA,
      componentTypeIds: [
        COMPONENT_LATERAL
      ]
    };

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(unresolvedWithResponse),
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_RESOLUTION_RESPONSE'
      )
    );
  }
);

test(
  'SPEC-016-A B3.2: provenance debe coincidir exactamente con adapter, library y effective input',
  () => {
    const { a } = pairInputs();

    const mutations = [
      (resolution) => {
        resolution.provenance.adapterRef.adapterVersion =
          '9.9.9';
      },

      (resolution) => {
        resolution.provenance.libraryRef.sha256 =
          'b'.repeat(64);
      },

      (resolution) => {
        resolution.provenance.effectiveGenerationInputSha256 =
          'b'.repeat(64);
      }
    ];

    for (const mutate of mutations) {
      const invalid =
        generateNeutralConstructiveSolution(a);

      mutate(
        resolutionFor(
          invalid,
          LOAD_TRANSFER_REQUIREMENT
        )
      );

      assert.throws(
        () => assertValidConstructiveSolution(
          rehashSolution(invalid),
          a
        ),
        (error) => (
          error
            instanceof ConstructiveSolutionGenerationError
          && error.code
            === 'PROVENANCE_MISMATCH'
        )
      );
    }
  }
);

test(
  'SPEC-016-A B3.2: provenance no admite assignment inexistente o perteneciente a otro requirement',
  () => {
    const root =
      rootWithBothAssignments();

    const input =
      adapterInputFor(
        root.scenarios[0]
      );

    const base =
      generateNeutralConstructiveSolution(input);

    const foreign =
      structuredClone(base);

    resolutionFor(
      foreign,
      LOAD_TRANSFER_REQUIREMENT
    ).provenance.assignmentIds = [
      'scenario:000001/assignment:999999'
    ];

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(foreign),
        input
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'PROVENANCE_ASSIGNMENT_MISMATCH'
      )
    );

    const wrongRequirement =
      structuredClone(base);

    resolutionFor(
      wrongRequirement,
      LOAD_TRANSFER_REQUIREMENT
    ).provenance.assignmentIds = [
      'scenario:000001/assignment:000002'
    ];

    assert.throws(
      () => assertValidConstructiveSolution(
        rehashSolution(wrongRequirement),
        input
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'PROVENANCE_ASSIGNMENT_MISMATCH'
      )
    );
  }
);

test(
  'SPEC-016-A B3.2: partiallyResolved existe contractualmente y coverage lo cuenta como respuesta parcial',
  () => {
    const { a } = pairInputs();

    const partial =
      generateNeutralConstructiveSolution(a);

    resolutionFor(
      partial,
      LOAD_TRANSFER_REQUIREMENT
    ).state =
      'partiallyResolved';

    const canonicalPartial =
      rehashSolution(partial);

    assert.doesNotThrow(
      () => assertValidConstructiveSolution(
        canonicalPartial,
        a
      )
    );

    assert.deepEqual(
      deriveConstructiveCoverage(
        canonicalPartial
      ),
      {
        state: 'partial',
        resolvedCount: 0,
        partiallyResolvedCount: 1,
        unresolvedCount: 1
      }
    );
  }
);

test(
  'SPEC-016-A B3.2: coverage complete exige que todos los requirements estén resolved y no implica verified',
  () => {
    const root =
      rootWithBothAssignments();

    const input =
      adapterInputFor(
        root.scenarios[0]
      );

    const complete =
      generateNeutralConstructiveSolution(input);

    const lateral =
      resolutionFor(
        complete,
        LATERAL_RESISTANCE_REQUIREMENT
      );

    lateral.state =
      'resolved';

    lateral.response = {
      schema:
        NEUTRAL_CONTRACT_RESOLUTION_SCHEMA,

      componentTypeIds: [
        COMPONENT_LATERAL
      ]
    };

    lateral.provenance.assignmentIds = [
      'scenario:000001/assignment:000002'
    ];

    const canonicalComplete =
      rehashSolution(complete);

    assert.doesNotThrow(
      () => assertValidConstructiveSolution(
        canonicalComplete,
        input
      )
    );

    assert.deepEqual(
      deriveConstructiveCoverage(
        canonicalComplete
      ),
      {
        state: 'complete',
        resolvedCount: 2,
        partiallyResolvedCount: 0,
        unresolvedCount: 0
      }
    );

    assert.equal(
      canonicalComplete.verificationState,
      'notVerified'
    );
  }
);

test(
  'SPEC-016-A B3.2: canonicalSha256 falso falla cerrado después del contrato estructural',
  () => {
    const { a } = pairInputs();

    const invalid =
      generateNeutralConstructiveSolution(a);

    invalid.canonicalSha256 =
      'b'.repeat(64);

    assert.throws(
      () => assertValidConstructiveSolution(
        invalid,
        a
      ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_CANONICAL_SHA256'
      )
    );
  }
);

test(
  'SPEC-016-A B3.2: módulo puro no depende de store, UI, React, Three, Metalcon ni OSB',
  async () => {
    const source =
      await readFile(
        new URL(
          '../src/core/constructiveSolutionGeneration.js',
          import.meta.url
        ),
        'utf8'
      );

    for (
      const forbiddenImport
      of [
        'react',
        'three',
        '../store',
        '/store',
        '/components/',
        'metalcon',
        'osb'
      ]
    ) {
      assert.equal(
        new RegExp(
          `from\\s+['"][^'"]*${forbiddenImport}`,
          'i'
        ).test(source),
        false,
        `import prohibido: ${forbiddenImport}`
      );
    }
  }
);

test(
  'BUG-016-A-016 BEFORE: B3.2 rechaza library efectiva adulterada aunque conserve schema B3.1',
  () => {
    const { a } = pairInputs();

    const invalid =
      structuredClone(a);

    invalid.library.componentTypes = [];

    assert.throws(
      () =>
        generateNeutralConstructiveSolution(
          invalid
        ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_ADAPTER_INPUT'
      )
    );
  }
);

test(
  'BUG-016-A-016 BEFORE: B3.2 rechaza effectiveGenerationInputSha256 adulterado aunque sea SHA válido',
  () => {
    const { a } = pairInputs();

    const invalid =
      structuredClone(a);

    invalid.effectiveGenerationInputSha256 =
      'b'.repeat(64);

    assert.throws(
      () =>
        generateNeutralConstructiveSolution(
          invalid
        ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_ADAPTER_INPUT'
      )
    );
  }
);

test(
  'BUG-016-A-016 BEFORE: B3.2 rechaza subfingerprint adulterado aunque el aggregate permanezca intacto',
  () => {
    const { a } = pairInputs();

    const invalid =
      structuredClone(a);

    invalid.effectiveFingerprints
      .assignmentsSha256 =
        'b'.repeat(64);

    assert.throws(
      () =>
        generateNeutralConstructiveSolution(
          invalid
        ),
      (error) => (
        error
          instanceof ConstructiveSolutionGenerationError
        && error.code
          === 'INVALID_ADAPTER_INPUT'
      )
    );
  }
);
