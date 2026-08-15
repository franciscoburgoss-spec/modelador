import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  projectEffectiveConstructiveInput
} from '../src/core/constructiveScenarioContext.js';

import {
  buildConstructiveAdapterInput,
  evaluateConstructiveGenerationAvailability
} from '../src/core/constructiveGenerationInput.js';

import {
  deriveConstructiveCoverage,
  generateNeutralConstructiveSolution
} from '../src/core/constructiveSolutionGeneration.js';

import {
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

import {
  buildStructuralRequirementsWithReferenceResolutionContext
} from '../src/core/structuralRequirements.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const EXPECTED_LIBRARY_SHA256 =
  '404ca9e7ed30b522dfddb211b98099bb8a739119957071d1642f41f004d2fc2f';

function requirementInput(context) {
  return {
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
  };
}

function scenarioInput(
  name,
  runtime
) {
  return {
    metadata: {
      name,
      description: ''
    },

    adapterRef:
      structuredClone(
        runtime.adapterRef
      ),

    libraryRef:
      structuredClone(
        runtime.libraryRef
      ),

    configuration: {
      schema:
        'neutral-contract-configuration-v1.0'
    },

    scope: {
      mode:
        'requirements',

      requirementIds: [
        LOAD_TRANSFER,
        LATERAL_RESISTANCE
      ]
    }
  };
}

function transferAssignment(
  runtime
) {
  return {
    requirementRef:
      LOAD_TRANSFER,

    targetRef: {
      kind:
        'requirement',

      ref:
        LOAD_TRANSFER
    },

    choiceRef: {
      libraryId:
        runtime.libraryRef.libraryId,

      libraryVersion:
        runtime.libraryRef.libraryVersion,

      componentTypeId:
        'abstract-load-transfer-response'
    },

    parameters: {}
  };
}

function runScenario({
  scenario,
  context,
  companion,
  runtime
}) {
  const effective =
    projectEffectiveConstructiveInput({
      scenario,

      structuralRequirements:
        companion.structuralRequirements,

      referenceResolutionContext:
        companion.referenceResolutionContext,

      geometry:
        context.geometry,

      libraryContext:
        runtime.libraryContext
    });

  const adapterInput =
    buildConstructiveAdapterInput(
      effective
    );

  const availability =
    evaluateConstructiveGenerationAvailability(
      adapterInput,
      runtime.availabilityContext
    );

  const solution =
    generateNeutralConstructiveSolution(
      adapterInput
    );

  return {
    adapterInput,
    availability,
    solution,

    coverage:
      deriveConstructiveCoverage(
        solution
      )
  };
}

test(
  'SPEC-016-A integración: runtime neutral productivo atraviesa B2/B3.1/B3.2 en FX-008 A/B',
  async () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    const context =
      await buildFx008Rev8Short({
        declareEndpointSupports: true
      });

    context.model.library = {
      libraryId:
        'SHOULD-NOT-BE-READ',

      sha256:
        '0'.repeat(64),

      componentTypes: [
        {
          componentTypeId:
            'SHOULD-NOT-BE-READ'
        }
      ]
    };

    const companion =
      buildStructuralRequirementsWithReferenceResolutionContext(
        requirementInput(
          context
        )
      );

    let root =
      createEmptyConstructiveSolutions();

    root =
      createConstructiveScenario(
        root,
        scenarioInput(
          'FX-008 A runtime neutral',
          runtime
        )
      ).constructiveSolutions;

    root =
      createConstructiveAssignment(
        root,
        'scenario:000001',
        transferAssignment(
          runtime
        )
      ).constructiveSolutions;

    root =
      createConstructiveScenario(
        root,
        scenarioInput(
          'FX-008 B runtime neutral',
          runtime
        )
      ).constructiveSolutions;

    const A =
      runScenario({
        scenario:
          root.scenarios[0],

        context,
        companion,
        runtime
      });

    const B =
      runScenario({
        scenario:
          root.scenarios[1],

        context,
        companion,
        runtime
      });

    assert.equal(
      root.scenarios[0].scenarioId,
      'scenario:000001'
    );

    assert.equal(
      root.scenarios[1].scenarioId,
      'scenario:000002'
    );

    assert.equal(
      runtime.libraryRef.sha256,
      EXPECTED_LIBRARY_SHA256
    );

    assert.equal(
      A.availability.state,
      'available'
    );

    assert.equal(
      B.availability.state,
      'available'
    );

    assert.deepEqual(
      A.coverage,
      {
        state:
          'partial',

        resolvedCount:
          1,

        partiallyResolvedCount:
          0,

        unresolvedCount:
          1
      }
    );

    assert.deepEqual(
      B.coverage,
      {
        state:
          'none',

        resolvedCount:
          0,

        partiallyResolvedCount:
          0,

        unresolvedCount:
          2
      }
    );

    assert.equal(
      A.solution.verificationState,
      'notVerified'
    );

    assert.equal(
      B.solution.verificationState,
      'notVerified'
    );

    const expectedRequirementIds =
      [
        LOAD_TRANSFER,
        LATERAL_RESISTANCE
      ].sort();

    assert.deepEqual(
      A.solution
        .requirementResolutions
        .map(
          (item) =>
            item.requirementId
        )
        .sort(),
      expectedRequirementIds
    );

    assert.deepEqual(
      B.solution
        .requirementResolutions
        .map(
          (item) =>
            item.requirementId
        )
        .sort(),
      expectedRequirementIds
    );

    assert.equal(
      A.adapterInput.libraryRef.sha256,
      EXPECTED_LIBRARY_SHA256
    );

    assert.equal(
      B.adapterInput.libraryRef.sha256,
      EXPECTED_LIBRARY_SHA256
    );

    assert.notEqual(
      A.adapterInput.libraryRef.sha256,
      context.model.library.sha256
    );

    assert.notEqual(
      B.adapterInput.libraryRef.sha256,
      context.model.library.sha256
    );

    assert.notEqual(
      A.adapterInput
        .effectiveGenerationInputSha256,
      B.adapterInput
        .effectiveGenerationInputSha256
    );
  }
);
