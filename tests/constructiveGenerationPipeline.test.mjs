import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

import {
  CONSTRUCTIVE_GENERATION_RUN_SCHEMA,
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

test(
  'SPEC-016-A pipeline: existe frontera pura para orquestar generación por escenario',
  () => {
    assert.equal(
      CONSTRUCTIVE_GENERATION_RUN_SCHEMA,
      'constructive-generation-run-v1.0'
    );

    assert.equal(
      typeof runConstructiveScenarioGeneration,
      'function'
    );
  }
);

test(
  'SPEC-016-A pipeline: FX-008 A materializa solución efímera y persiste sólo receipt',
  async () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    const fx =
      await buildFx008Rev8Short({
        declareEndpointSupports: true
      });

    const model =
      structuredClone(fx.model);

    model.structuralIntent = {
      ...structuredClone(
        model.structuralIntent
      ),

      roofIntents:
        structuredClone(
          fx.roofStructuralIntent
        )
    };

    let root =
      createEmptyConstructiveSolutions();

    root =
      createConstructiveScenario(
        root,
        {
          metadata: {
            name: 'FX-008 A pipeline',
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
            mode: 'requirements',

            requirementIds: [
              LOAD_TRANSFER,
              LATERAL_RESISTANCE
            ]
          }
        }
      ).constructiveSolutions;

    root =
      createConstructiveAssignment(
        root,
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
              runtime.libraryRef.libraryId,

            libraryVersion:
              runtime.libraryRef.libraryVersion,

            componentTypeId:
              'abstract-load-transfer-response'
          },

          parameters: {}
        }
      ).constructiveSolutions;

    const before =
      structuredClone(root);

    const run =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions: root,
        scenarioId: 'scenario:000001',
        runtime
      });

    assert.equal(
      run.schema,
      'constructive-generation-run-v1.0'
    );

    assert.equal(
      run.scenarioId,
      'scenario:000001'
    );

    assert.equal(
      run.availability.state,
      'available'
    );

    assert.equal(
      run.ephemeralSolution.schema,
      'constructive-solution-v1.0'
    );

    assert.equal(
      run.receipt.schema,
      'constructive-generation-receipt-v1.0'
    );

    assert.deepEqual(
      run.generationState,
      {
        coverage: 'partial',
        freshness: 'fresh'
      }
    );

    assert.equal(
      run.changed,
      true
    );

    assert.deepEqual(
      root,
      before
    );

    assert.deepEqual(
      run.scenario.lastGeneration,
      run.receipt
    );

    assert.equal(
      Object.hasOwn(
        run.scenario,
        'generatedSolution'
      ),
      false
    );

    assert.equal(
      JSON.stringify(
        run.constructiveSolutions
      ).includes(
        '"requirementResolutions"'
      ),
      false
    );
  }
);
