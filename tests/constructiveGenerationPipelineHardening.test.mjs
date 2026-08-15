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
  ConstructiveGenerationPipelineError,
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

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

async function buildFixture() {
  const runtime =
    buildNeutralConstructiveRuntime();

  const fx =
    await buildFx008Rev8Short({
      declareEndpointSupports: true
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

  let root =
    createEmptyConstructiveSolutions();

  root =
    createConstructiveScenario(
      root,
      scenarioInput(
        'FX-008 A pipeline',
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
        'FX-008 B pipeline',
        runtime
      )
    ).constructiveSolutions;

  return {
    model,
    root,
    runtime
  };
}

test(
  'SPEC-016-A pipeline: FX-008 A/B generan y persisten receipts independientes',
  async () => {
    const {
      model,
      root,
      runtime
    } =
      await buildFixture();

    const runA =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          root,
        scenarioId:
          'scenario:000001',
        runtime
      });

    const runB =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          runA.constructiveSolutions,
        scenarioId:
          'scenario:000002',
        runtime
      });

    assert.deepEqual(
      runA.generationState,
      {
        coverage:
          'partial',

        freshness:
          'fresh'
      }
    );

    assert.deepEqual(
      runB.generationState,
      {
        coverage:
          'none',

        freshness:
          'fresh'
      }
    );

    assert.notEqual(
      runA.receipt
        .effectiveGenerationInputSha256,
      runB.receipt
        .effectiveGenerationInputSha256
    );

    assert.notEqual(
      runA.receipt
        .outputCanonicalSha256,
      runB.receipt
        .outputCanonicalSha256
    );

    const persistedA =
      runB.constructiveSolutions
        .scenarios
        .find(
          (item) =>
            item.scenarioId
            === 'scenario:000001'
        );

    const persistedB =
      runB.constructiveSolutions
        .scenarios
        .find(
          (item) =>
            item.scenarioId
            === 'scenario:000002'
        );

    assert.deepEqual(
      persistedA.lastGeneration,
      runA.receipt
    );

    assert.deepEqual(
      persistedB.lastGeneration,
      runB.receipt
    );

    assert.equal(
      JSON.stringify(
        runB.constructiveSolutions
      ).includes(
        '"requirementResolutions"'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A pipeline: regenerar el mismo escenario es no-op persistente',
  async () => {
    const {
      model,
      root,
      runtime
    } =
      await buildFixture();

    const first =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          root,
        scenarioId:
          'scenario:000001',
        runtime
      });

    const second =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          first.constructiveSolutions,
        scenarioId:
          'scenario:000001',
        runtime
      });

    assert.equal(
      first.changed,
      true
    );

    assert.equal(
      second.changed,
      false
    );

    assert.deepEqual(
      second.receipt,
      first.receipt
    );

    assert.deepEqual(
      second.constructiveSolutions,
      first.constructiveSolutions
    );

    assert.deepEqual(
      second.generationState,
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
  'SPEC-016-A pipeline: runtime unavailable falla cerrado antes de B3.2 y no persiste',
  async () => {
    const {
      model,
      root,
      runtime
    } =
      await buildFixture();

    const unavailableRuntime =
      structuredClone(
        runtime
      );

    unavailableRuntime
      .availabilityContext = {
        availableAdapters: [],
        availableLibraries: []
      };

    const before =
      structuredClone(
        root
      );

    assert.throws(
      () =>
        runConstructiveScenarioGeneration({
          model,

          constructiveSolutions:
            root,

          scenarioId:
            'scenario:000001',

          runtime:
            unavailableRuntime
        }),

      (error) => (
        error
          instanceof
          ConstructiveGenerationPipelineError
        && error.code
          === 'GENERATION_UNAVAILABLE'
        && error.details
          ?.availability
          ?.state
          === 'unavailable'
      )
    );

    assert.deepEqual(
      root,
      before
    );

    assert.equal(
      root.scenarios[0]
        .lastGeneration,
      null
    );
  }
);
