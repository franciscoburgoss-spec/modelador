import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA
} from '../src/core/constructiveScenarioContext.js';

import {
  assertValidConstructiveSolutionV2
} from '../src/core/constructiveSolutionContract.js';

import {
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  buildConstructiveStructuralWorkspace
} from '../src/core/constructiveStructuralWorkspace.js';

import {
  migrateV3ToV4
} from '../src/core/modelSchema.js';

import {
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  METALCON_LIBRARY_MANIFEST
} from '../src/core/metalconConstructiveLibrary.js';

import {
  METALCON_SCENARIO_CONFIGURATION_SCHEMA
} from '../src/core/metalconScenarioConfiguration.js';

import {
  buildMetalconConstructiveRuntime
} from '../src/core/metalconConstructiveRuntime.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const FX008_LATERAL_ROOF_ID =
  1785158713616;

const FX008_LATERAL_WALL_ID =
  1784606313849;

const FX008_LATERAL_GAP_MM =
  571.429;

async function buildFxModel() {
  const fx =
    await buildFx008Rev8Short({
      declareEndpointSupports:
        true
    });

  const model =
    structuredClone(
      fx.model
    );

  model.structuralIntent = {
    ...structuredClone(
      model.structuralIntent
    ),

    roofIntents:
      structuredClone(
        fx.roofStructuralIntent
      )
  };

  return migrateV3ToV4(
    model
  );
}

function buildMetalconRoot(
  runtime,
  elementIds,
  roofGeometryIds = []
) {
  const root =
    createEmptyConstructiveSolutions();

  return createConstructiveScenario(
    root,
    {
      metadata: {
        name:
          'SPEC-016-B B2.3 runtime Metalcon pre-B3',
        description:
          ''
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
          METALCON_SCENARIO_CONFIGURATION_SCHEMA,

        inputRefs: {
          schema:
            CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

          elementIds:
            structuredClone(
              elementIds
            ),

          roofGeometryIds:
            structuredClone(
              roofGeometryIds
            )
        },

        constructionSelections:
          []
      },

      scope: {
        mode:
          'requirements',

        requirementIds: [
          LOAD_TRANSFER,
          LATERAL_RESISTANCE
        ]
      }
    }
  ).constructiveSolutions;
}

test(
  'SPEC-016-B B2.3a: runtime Metalcon expone protocolo B1 y biblioteca B2 sin legacy',
  () => {
    const runtime =
      buildMetalconConstructiveRuntime();

    assert.deepEqual(
      Object.keys(runtime).sort(),
      [
        'adapterRef',
        'availabilityContext',
        'libraryContext',
        'libraryManifest',
        'libraryRef'
      ].sort()
    );

    assert.deepEqual(
      runtime.adapterRef,
      {
        adapterId:
          'metalcon',
        adapterVersion:
          '1.0.0'
      }
    );

    assert.deepEqual(
      runtime.libraryManifest,
      METALCON_LIBRARY_MANIFEST
    );

    assert.deepEqual(
      runtime.libraryContext
        .componentTypes,
      []
    );

    assert.deepEqual(
      runtime.libraryContext
        .adapterPayload
        .profiles,
      []
    );

    assert.equal(
      runtime.assertValidSolution,
      assertValidConstructiveSolutionV2
    );

    assert.equal(
      typeof runtime.generateSolution,
      'function'
    );

    assert.equal(
      Object.getOwnPropertyDescriptor(
        runtime,
        'generateSolution'
      ).enumerable,
      false
    );

    assert.equal(
      Object.getOwnPropertyDescriptor(
        runtime,
        'assertValidSolution'
      ).enumerable,
      false
    );

    assert.deepEqual(
      runtime.availabilityContext
        .availableAdapters,
      [
        runtime.adapterRef
      ]
    );

    assert.deepEqual(
      runtime.availabilityContext
        .availableLibraries,
      [
        runtime.libraryRef
      ]
    );
  }
);

test(
  'SPEC-016-B B2.3a: FX-008 pre-B3 produce sólo resolutions unresolved y ningún artefacto',
  async () => {
    const model =
      await buildFxModel();

    const beforeModel =
      structuredClone(
        model
      );

    const runtime =
      buildMetalconConstructiveRuntime();

    const constructiveSolutions =
      buildMetalconRoot(
        runtime,
        [
          FX008_LATERAL_WALL_ID
        ],
        [
          FX008_LATERAL_ROOF_ID
        ]
      );

    const run =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions,
        scenarioId:
          'scenario:000001',
        runtime
      });

    const solution =
      run.ephemeralSolution;

    assert.deepEqual(
      run.adapterInput
        .configuration
        .inputRefs
        .elementIds,
      [
        FX008_LATERAL_WALL_ID
      ]
    );

    assert.deepEqual(
      run.adapterInput
        .configuration
        .inputRefs
        .roofGeometryIds,
      [
        FX008_LATERAL_ROOF_ID
      ]
    );

    assert.deepEqual(
      run.adapterInput
        .effectiveGeometry
        .elements
        .map(
          (element) =>
            element.id
        ),
      [
        FX008_LATERAL_WALL_ID
      ]
    );

    assert.deepEqual(
      run.adapterInput
        .effectiveGeometry
        .roofGeometry
        .map(
          (roof) =>
            roof.id
        ),
      [
        FX008_LATERAL_ROOF_ID
      ]
    );

    const transferRequirement =
      run.adapterInput
        .effectiveStructuralRequirements
        .requirements
        .find(
          (requirement) =>
            requirement.id
              === LOAD_TRANSFER
        );

    assert.ok(
      transferRequirement
    );

    assert.equal(
      transferRequirement.code,
      'SR-LOAD-TRANSFER-REQUIRED'
    );

    assert.ok(
      Math.abs(
        transferRequirement
          .evidence
          .gapMm
          - FX008_LATERAL_GAP_MM
      ) <= 0.001
    );

    assert.equal(
      run.adapterInput
        .effectiveStructuralRequirements
        .verification
        .state,
      'notVerified'
    );

    assert.deepEqual(
      run.adapterInput
        .configuration
        .constructionSelections,
      []
    );

    assert.equal(
      solution.schema,
      'constructive-solution-v2.0'
    );

    assert.equal(
      solution.verificationState,
      'notVerified'
    );

    assert.deepEqual(
      solution.generatedArtifacts,
      []
    );

    assert.deepEqual(
      solution.findings,
      []
    );

    assert.deepEqual(
      solution
        .requirementResolutions
        .map(
          (resolution) =>
            resolution.requirementId
        ),
      [
        LOAD_TRANSFER,
        LATERAL_RESISTANCE
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
        resolution.provenance
          .assignmentIds,
        []
      );

      assert.deepEqual(
        resolution.provenance
          .adapterRef,
        run.adapterInput.adapterRef
      );

      assert.deepEqual(
        resolution.provenance
          .libraryRef,
        run.adapterInput.libraryRef
      );

      assert.equal(
        resolution.provenance
          .effectiveGenerationInputSha256,
        run.adapterInput
          .effectiveGenerationInputSha256
      );
    }

    assert.deepEqual(
      run.adapterInput.assignments,
      []
    );

    assert.deepEqual(
      run.adapterInput.library
        .componentTypes,
      []
    );

    assert.deepEqual(
      model,
      beforeModel
    );

    assert.equal(
      run.receipt.schema,
      'constructive-generation-receipt-v1.0'
    );

    assert.deepEqual(
      run.generationState,
      {
        coverage:
          'none',
        freshness:
          'fresh'
      }
    );

    assert.deepEqual(
      run.scenario.lastGeneration,
      run.receipt
    );

    const persistedScenario =
      run.constructiveSolutions
        .scenarios
        .find(
          (scenario) =>
            scenario.scenarioId
              === 'scenario:000001'
        );

    assert.ok(
      persistedScenario
    );

    assert.deepEqual(
      persistedScenario.lastGeneration,
      run.receipt
    );

    assert.equal(
      JSON.stringify(
        run.constructiveSolutions
      ).includes(
        '"generatedArtifacts"'
      ),
      false
    );
  }
);

test(
  'SPEC-016-B B2.3a: assignment inyectado falla cerrado antes de resolver requirements',
  async () => {
    const model =
      await buildFxModel();

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    const elementId =
      workspace
        .proposalWorkspace
        .geometry
        .elements[0]
        .id;

    const runtime =
      buildMetalconConstructiveRuntime();

    const constructiveSolutions =
      buildMetalconRoot(
        runtime,
        [
          elementId
        ]
      );

    const run =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions,
        scenarioId:
          'scenario:000001',
        runtime
      });

    const injected =
      structuredClone(
        run.adapterInput
      );

    injected.assignments = [
      {
        assignmentId:
          'assignment:injected'
      }
    ];

    assert.throws(
      () =>
        runtime.generateSolution(
          injected
        ),
      (error) =>
        error?.code
          === 'METALCON_ASSIGNMENTS_UNSUPPORTED_PRE_B4'
    );
  }
);

test(
  'SPEC-016-B B2.3b: mutar Metalcon legacy real de FX-008 no altera adapterInput ni solución',
  async () => {
    const baseModel =
      await buildFxModel();

    const mutatedModel =
      structuredClone(
        baseModel
      );

    assert.equal(
      baseModel.modelVersion,
      4
    );

    assert.equal(
      mutatedModel.modelVersion,
      4
    );

    const workspace =
      buildConstructiveStructuralWorkspace(
        baseModel
      );

    const elementId =
      workspace
        .proposalWorkspace
        .geometry
        .elements[0]
        .id;

    const legacyElement =
      mutatedModel
        .elements
        .find(
          (element) =>
            element.id === elementId
        );

    assert.ok(
      legacyElement
    );

    /*
     * Inversión D-070 sobre datos legacy
     * realmente presentes en FX-008.
     */
    mutatedModel.osbDefaults = {
      panelWidth:
        1250,
      minPanelWidth:
        250,
      gap:
        7
    };

    legacyElement.studSpacing =
      legacyElement.studSpacing === '400'
        ? '600'
        : '400';

    legacyElement.studs =
      structuredClone(
        legacyElement.studs
      ).reverse();

    legacyElement.headers =
      structuredClone(
        legacyElement.headers
      ).reverse();

    legacyElement.osbCourses =
      structuredClone(
        legacyElement.osbCourses
      ).reverse();

    legacyElement.studsStale =
      !legacyElement.studsStale;

    assert.notDeepEqual(
      mutatedModel.osbDefaults,
      baseModel.osbDefaults
    );

    assert.notDeepEqual(
      legacyElement.studs,
      baseModel
        .elements
        .find(
          (element) =>
            element.id === elementId
        )
        .studs
    );

    assert.deepEqual(
      mutatedModel.structuralIntent,
      baseModel.structuralIntent
    );

    const runtimeA =
      buildMetalconConstructiveRuntime();

    const runtimeB =
      buildMetalconConstructiveRuntime();

    const rootA =
      buildMetalconRoot(
        runtimeA,
        [
          elementId
        ]
      );

    const rootB =
      buildMetalconRoot(
        runtimeB,
        [
          elementId
        ]
      );

    const runA =
      runConstructiveScenarioGeneration({
        model:
          baseModel,
        constructiveSolutions:
          rootA,
        scenarioId:
          'scenario:000001',
        runtime:
          runtimeA
      });

    const runB =
      runConstructiveScenarioGeneration({
        model:
          mutatedModel,
        constructiveSolutions:
          rootB,
        scenarioId:
          'scenario:000001',
        runtime:
          runtimeB
      });

    assert.deepEqual(
      runB.adapterInput,
      runA.adapterInput
    );

    assert.equal(
      runB.adapterInput
        .effectiveGenerationInputSha256,
      runA.adapterInput
        .effectiveGenerationInputSha256
    );

    assert.deepEqual(
      runB.ephemeralSolution,
      runA.ephemeralSolution
    );

    assert.deepEqual(
      runB.adapterInput
        .effectiveGeometry,
      runA.adapterInput
        .effectiveGeometry
    );
  }
);
