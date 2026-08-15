import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA,
  assertValidConstructiveSolutions,
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions,
  setConstructiveScenarioLifecycle
} from '../src/core/constructiveSolutionScenarios.js';

import {
  CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
  projectEffectiveConstructiveInput
} from '../src/core/constructiveScenarioContext.js';

import {
  buildStructuralRequirementsWithReferenceResolutionContext
} from '../src/core/structuralRequirements.js';

import {
  createStructuralReferenceResolutionContext
} from '../src/core/structuralReferenceResolutionContext.js';

import {
  buildConstructiveAdapterInput
} from '../src/core/constructiveGenerationInput.js';

import {
  deriveConstructiveCoverage,
  generateNeutralConstructiveSolution
} from '../src/core/constructiveSolutionGeneration.js';

import {
  ConstructiveGenerationReceiptError,
  assertOperationallyValidConstructiveGenerationReceipt,
  buildConstructiveGenerationReceipt,
  deriveConstructiveGenerationState,
  recordConstructiveGenerationReceipt
} from '../src/core/constructiveGenerationReceipt.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const LIB_SHA_A =
  'a'.repeat(64);

const LIB_SHA_B =
  'b'.repeat(64);

function scenarioInput(
  name,
  librarySha = LIB_SHA_A
) {
  return {
    metadata: {
      name,
      description: ''
    },

    adapterRef: {
      adapterId:
        'neutral-contract-adapter',
      adapterVersion:
        '1.0.0'
    },

    libraryRef: {
      libraryId:
        'neutral-contract-library',
      libraryVersion:
        '1.0.0',
      sha256:
        librarySha
    },

    configuration: {
      schema:
        'neutral-contract-configuration-v1.0'
    },

    scope: {
      mode: 'requirements',
      requirementIds: [
        LOAD_TRANSFER,
        LATERAL
      ]
    }
  };
}

const context =
  await buildFx008Rev8Short({
    declareEndpointSupports: true
  });

const companion =
  buildStructuralRequirementsWithReferenceResolutionContext({
    geometry:
      context.geometry,

    topology:
      context.topology,

    structuralIntent:
      context.model.structuralIntent,

    roofStructuralIntent:
      context.roofStructuralIntent,

    structuralProposals:
      context.proposals,

    structuralProposalReviews:
      context.model.structuralProposalReviews,

    candidateLoadPaths:
      context.paths
  });

let baseRoot =
  createEmptyConstructiveSolutions();

baseRoot =
  createConstructiveScenario(
    baseRoot,
    scenarioInput('FX-008 A')
  ).constructiveSolutions;

baseRoot =
  createConstructiveAssignment(
    baseRoot,
    'scenario:000001',
    {
      requirementRef:
        LOAD_TRANSFER,

      targetRef: {
        kind: 'requirement',
        ref: LOAD_TRANSFER
      },

      choiceRef: {
        libraryId:
          'neutral-contract-library',

        libraryVersion:
          '1.0.0',

        componentTypeId:
          'abstract-load-transfer-response'
      },

      parameters: {}
    }
  ).constructiveSolutions;

baseRoot =
  createConstructiveScenario(
    baseRoot,
    scenarioInput('FX-008 B')
  ).constructiveSolutions;

function referenceContext() {
  return createStructuralReferenceResolutionContext(
    companion.structuralRequirements,
    {
      referenceBindings:
        companion.referenceResolutionContext
          .referenceBindings,

      targets:
        companion.referenceResolutionContext
          .targets,

      provenanceRelations:
        companion.referenceResolutionContext
          .provenanceRelations
    }
  );
}

function adapterInputFor(
  scenario,
  librarySha =
    scenario.libraryRef.sha256
) {
  const effective =
    projectEffectiveConstructiveInput({
      scenario,

      structuralRequirements:
        companion.structuralRequirements,

      referenceResolutionContext:
        referenceContext(),

      geometry:
        context.geometry,

      libraryContext: {
        schema:
          CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,

        libraryId:
          'neutral-contract-library',

        libraryVersion:
          '1.0.0',

        sha256:
          librarySha,

        componentTypes: [
          {
            componentTypeId:
              'abstract-load-transfer-response'
          },
          {
            componentTypeId:
              'abstract-lateral-response'
          }
        ]
      }
    });

  return buildConstructiveAdapterInput(
    effective
  );
}

const scenarioA =
  baseRoot.scenarios.find(
    (item) =>
      item.scenarioId
      === 'scenario:000001'
  );

const scenarioB =
  baseRoot.scenarios.find(
    (item) =>
      item.scenarioId
      === 'scenario:000002'
  );

const adapterInputA =
  adapterInputFor(
    scenarioA
  );

const adapterInputB =
  adapterInputFor(
    scenarioB
  );

const solutionA =
  generateNeutralConstructiveSolution(
    adapterInputA
  );

const solutionB =
  generateNeutralConstructiveSolution(
    adapterInputB
  );

const AVAILABLE_A = {
  availableAdapters: [
    {
      adapterId:
        'neutral-contract-adapter',

      adapterVersion:
        '1.0.0'
    }
  ],

  availableLibraries: [
    {
      libraryId:
        'neutral-contract-library',

      libraryVersion:
        '1.0.0',

      sha256:
        LIB_SHA_A
    }
  ]
};

const UNAVAILABLE = {
  availableAdapters: [],
  availableLibraries: []
};

function buildAReceipt() {
  return buildConstructiveGenerationReceipt({
    adapterInput:
      adapterInputA,

    solution:
      solutionA,

    structuralRequirements:
      companion.structuralRequirements
  });
}

function buildBReceipt() {
  return buildConstructiveGenerationReceipt({
    adapterInput:
      adapterInputB,

    solution:
      solutionB,

    structuralRequirements:
      companion.structuralRequirements
  });
}

function changedLibraryAdapterInput() {
  const changed =
    structuredClone(
      scenarioA
    );

  changed.libraryRef.sha256 =
    LIB_SHA_B;

  return adapterInputFor(
    changed,
    LIB_SHA_B
  );
}

test(
  'SPEC-016-A B3.3: construye receipt A exacto desde adapter input, solution y provenance global',
  () => {
    const receipt =
      buildAReceipt();

    const coverage =
      deriveConstructiveCoverage(
        solutionA
      );

    assert.deepEqual(
      Object.keys(receipt).sort(),
      [
        'coverageAtGeneration',
        'effectiveFingerprints',
        'effectiveGenerationInputSha256',
        'globalProvenance',
        'outputCanonicalSha256',
        'partiallyResolvedCount',
        'resolvedCount',
        'schema',
        'unresolvedCount'
      ]
    );

    assert.equal(
      receipt.schema,
      CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA
    );

    assert.equal(
      receipt.effectiveGenerationInputSha256,
      adapterInputA
        .effectiveGenerationInputSha256
    );

    assert.equal(
      receipt.outputCanonicalSha256,
      solutionA.canonicalSha256
    );

    assert.equal(
      receipt.coverageAtGeneration,
      coverage.state
    );

    assert.equal(
      receipt.resolvedCount,
      1
    );

    assert.equal(
      receipt.partiallyResolvedCount,
      0
    );

    assert.equal(
      receipt.unresolvedCount,
      1
    );

    assert.deepEqual(
      receipt.effectiveFingerprints,
      adapterInputA
        .effectiveFingerprints
    );

    assert.deepEqual(
      receipt.globalProvenance,
      {
        geometrySha256:
          companion.structuralRequirements
            .sourceFingerprints
            .geometrySha256,

        requirementsSha256:
          companion.structuralRequirements
            .canonicalSha256,

        requirementsSourceAggregateSha256:
          companion.structuralRequirements
            .sourceFingerprints
            .aggregateSha256,

        structuralIntentSha256:
          companion.structuralRequirements
            .sourceFingerprints
            .structuralIntentSha256,

        topologyR0R5Sha256:
          companion.structuralRequirements
            .sourceFingerprints
            .topologyR0R5Sha256
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: receipt B conserva coverage none 0/0/2',
  () => {
    const receipt =
      buildBReceipt();

    assert.equal(
      receipt.coverageAtGeneration,
      'none'
    );

    assert.equal(
      receipt.resolvedCount,
      0
    );

    assert.equal(
      receipt.partiallyResolvedCount,
      0
    );

    assert.equal(
      receipt.unresolvedCount,
      2
    );
  }
);

test(
  'SPEC-016-A B3.3: receipt es determinista, puro y no comparte fingerprints mutables',
  () => {
    const beforeInput =
      structuredClone(
        adapterInputA
      );

    const first =
      buildAReceipt();

    const second =
      buildAReceipt();

    assert.deepEqual(
      first,
      second
    );

    assert.deepEqual(
      adapterInputA,
      beforeInput
    );

    first.effectiveFingerprints
      .scopeSha256 =
        'f'.repeat(64);

    assert.notEqual(
      first.effectiveFingerprints
        .scopeSha256,
      adapterInputA
        .effectiveFingerprints
        .scopeSha256
    );
  }
);

test(
  'BUG-016-A-018 AFTER: complete con unresolvedCount positivo falla cerrado',
  () => {
    const invalid =
      buildAReceipt();

    invalid.coverageAtGeneration =
      'complete';

    assert.throws(
      () =>
        assertOperationallyValidConstructiveGenerationReceipt(
          invalid
        ),
      (error) => (
        error
          instanceof
          ConstructiveGenerationReceiptError
        && error.code
          === 'INVALID_RECEIPT'
      )
    );
  }
);

test(
  'BUG-016-A-018 AFTER: none no admite resolved ni partiallyResolved',
  () => {
    const invalid =
      buildBReceipt();

    invalid.resolvedCount =
      1;

    assert.throws(
      () =>
        assertOperationallyValidConstructiveGenerationReceipt(
          invalid
        ),
      (error) => (
        error
          instanceof
          ConstructiveGenerationReceiptError
        && error.code
          === 'INVALID_RECEIPT'
      )
    );
  }
);

test(
  'BUG-016-A-018 AFTER: partial exige alguna respuesta y no admite estado semánticamente complete',
  () => {
    const noResponse =
      buildAReceipt();

    noResponse.resolvedCount =
      0;

    noResponse.partiallyResolvedCount =
      0;

    noResponse.unresolvedCount =
      2;

    assert.throws(
      () =>
        assertOperationallyValidConstructiveGenerationReceipt(
          noResponse
        ),
      ConstructiveGenerationReceiptError
    );

    const actuallyComplete =
      buildAReceipt();

    actuallyComplete.resolvedCount =
      2;

    actuallyComplete.partiallyResolvedCount =
      0;

    actuallyComplete.unresolvedCount =
      0;

    assert.throws(
      () =>
        assertOperationallyValidConstructiveGenerationReceipt(
          actuallyComplete
        ),
      ConstructiveGenerationReceiptError
    );
  }
);

test(
  'SPEC-016-A B3.3: sin receipt deriva freshness y coverage notGenerated',
  () => {
    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt:
          null,

        availabilityContext:
          UNAVAILABLE
      }),
      {
        coverage:
          'notGenerated',

        freshness:
          'notGenerated'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: receipt actual y runtime disponible deriva fresh + partial',
  () => {
    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt:
          buildAReceipt(),

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: aggregate distinto y runtime disponible deriva stale + notGenerated',
  () => {
    const changedInput =
      changedLibraryAdapterInput();

    const availability = {
      availableAdapters: [
        {
          adapterId:
            'neutral-contract-adapter',

          adapterVersion:
            '1.0.0'
        }
      ],

      availableLibraries: [
        {
          libraryId:
            'neutral-contract-library',

          libraryVersion:
            '1.0.0',

          sha256:
            LIB_SHA_B
        }
      ]
    };

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          changedInput,

        receipt:
          buildAReceipt(),

        availabilityContext:
          availability
      }),
      {
        coverage:
          'notGenerated',

        freshness:
          'stale'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: runtime unavailable prevalece sobre freshness y conserva coverage si aggregate coincide',
  () => {
    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt:
          buildAReceipt(),

        availabilityContext:
          UNAVAILABLE
      }),
      {
        coverage:
          'partial',

        freshness:
          'unavailable'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: unavailable con aggregate distinto conserva freshness unavailable pero coverage notGenerated',
  () => {
    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          changedLibraryAdapterInput(),

        receipt:
          buildAReceipt(),

        availabilityContext:
          UNAVAILABLE
      }),
      {
        coverage:
          'notGenerated',

        freshness:
          'unavailable'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: subfingerprints no gobiernan freshness individualmente',
  () => {
    const receipt =
      buildAReceipt();

    receipt.effectiveFingerprints
      .effectiveGeometrySha256 =
        'f'.repeat(64);

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt,

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: provenance global no gobierna freshness',
  () => {
    const receipt =
      buildAReceipt();

    receipt.globalProvenance
      .geometrySha256 =
        'f'.repeat(64);

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt,

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );
  }
);

test(
  'BUG-016-A-018 AFTER: receipt fresh debe cubrir exactamente todos los requirements efectivos',
  () => {
    const invalid =
      buildAReceipt();

    invalid.unresolvedCount =
      2;

    assert.throws(
      () =>
        deriveConstructiveGenerationState({
          adapterInput:
            adapterInputA,

          receipt:
            invalid,

          availabilityContext:
            AVAILABLE_A
        }),
      (error) => (
        error
          instanceof
          ConstructiveGenerationReceiptError
        && error.code
          === 'INVALID_RECEIPT'
      )
    );
  }
);

test(
  'SPEC-016-A B3.3: record persiste sólo receipt, no output, y es no-op aware',
  () => {
    const receipt =
      buildAReceipt();

    const before =
      structuredClone(
        baseRoot
      );

    const recorded =
      recordConstructiveGenerationReceipt(
        baseRoot,
        'scenario:000001',
        receipt,
        adapterInputA
      );

    assert.equal(
      recorded.changed,
      true
    );

    assert.deepEqual(
      baseRoot,
      before
    );

    assert.deepEqual(
      recorded.scenario
        .lastGeneration,
      receipt
    );

    assert.equal(
      Object.hasOwn(
        recorded.scenario,
        'generatedSolution'
      ),
      false
    );

    assertValidConstructiveSolutions(
      recorded.constructiveSolutions
    );

    const again =
      recordConstructiveGenerationReceipt(
        recorded.constructiveSolutions,
        'scenario:000001',
        receipt,
        adapterInputA
      );

    assert.equal(
      again.changed,
      false
    );
  }
);

test(
  'SPEC-016-A B3.3: record rechaza adapter input de otro escenario',
  () => {
    assert.throws(
      () =>
        recordConstructiveGenerationReceipt(
          baseRoot,
          'scenario:000001',
          buildBReceipt(),
          adapterInputB
        ),
      (error) => (
        error
          instanceof
          ConstructiveGenerationReceiptError
        && error.code
          === 'SCENARIO_INPUT_MISMATCH'
      )
    );
  }
);

test(
  'SPEC-016-A B3.3: escenario archivado no puede registrar una generación',
  () => {
    const archived =
      setConstructiveScenarioLifecycle(
        baseRoot,
        'scenario:000001',
        'archived'
      ).constructiveSolutions;

    assert.throws(
      () =>
        recordConstructiveGenerationReceipt(
          archived,
          'scenario:000001',
          buildAReceipt(),
          adapterInputA
        ),
      (error) => (
        error
          instanceof
          ConstructiveGenerationReceiptError
        && error.code
          === 'SCENARIO_ARCHIVED'
      )
    );
  }
);

test(
  'SPEC-016-A B3.3: reapertura conserva receipt, no output, reconstruye fresh y regenera el mismo hash',
  () => {
    const receipt =
      buildAReceipt();

    const recorded =
      recordConstructiveGenerationReceipt(
        baseRoot,
        'scenario:000001',
        receipt,
        adapterInputA
      );

    const serialized =
      JSON.stringify(
        recorded.constructiveSolutions
      );

    assert.equal(
      serialized.includes(
        '"requirementResolutions"'
      ),
      false
    );

    const reopened =
      JSON.parse(
        serialized
      );

    assertValidConstructiveSolutions(
      reopened
    );

    const reopenedScenario =
      reopened.scenarios.find(
        (item) =>
          item.scenarioId
          === 'scenario:000001'
      );

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt:
          reopenedScenario
            .lastGeneration,

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );

    const regenerated =
      generateNeutralConstructiveSolution(
        adapterInputA
      );

    assert.equal(
      regenerated.canonicalSha256,
      receipt
        .outputCanonicalSha256
    );
  }
);

test(
  'SPEC-016-A B3.3: FX-008 A/B conservan receipts y estados independientes',
  () => {
    const receiptA =
      buildAReceipt();

    const receiptB =
      buildBReceipt();

    assert.notEqual(
      receiptA.effectiveGenerationInputSha256,
      receiptB.effectiveGenerationInputSha256
    );

    assert.notEqual(
      receiptA.outputCanonicalSha256,
      receiptB.outputCanonicalSha256
    );

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputA,

        receipt:
          receiptA,

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );

    assert.deepEqual(
      deriveConstructiveGenerationState({
        adapterInput:
          adapterInputB,

        receipt:
          receiptB,

        availabilityContext:
          AVAILABLE_A
      }),
      {
        coverage:
          'none',

        freshness:
          'fresh'
      }
    );
  }
);

test(
  'SPEC-016-A B3.3: módulo de receipt/freshness permanece fuera de store, UI, Metalcon y OSB',
  async () => {
    const source =
      await import(
        'node:fs/promises'
      ).then(
        ({ readFile }) =>
          readFile(
            new URL(
              '../src/core/constructiveGenerationReceipt.js',
              import.meta.url
            ),
            'utf8'
          )
      );

    assert.doesNotMatch(
      source,
      /react|three|store|components|metalcon|osb/i
    );
  }
);
