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
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

import {
  useModelStore
} from '../src/store/useModelStore.js';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

function scenarioInput(runtime) {
  return {
    metadata: {
      name: 'FX-008 A store',
      description: ''
    },

    adapterRef:
      structuredClone(runtime.adapterRef),

    libraryRef:
      structuredClone(runtime.libraryRef),

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
  };
}

async function fixture() {
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

  let constructiveSolutions =
    createEmptyConstructiveSolutions();

  constructiveSolutions =
    createConstructiveScenario(
      constructiveSolutions,
      scenarioInput(runtime)
    ).constructiveSolutions;

  constructiveSolutions =
    createConstructiveAssignment(
      constructiveSolutions,
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

  model.constructiveSolutions =
    constructiveSolutions;

  return model;
}

function reset(model) {
  useModelStore.setState({
    model,
    past: [],
    future: []
  });
}

function withoutConstructiveSolutions(model) {
  const clone =
    structuredClone(model);

  delete clone.constructiveSolutions;

  return clone;
}

test(
  'SPEC-016-A store: generación es una mutación atómica, persiste sólo receipt y soporta undo/redo',
  async () => {
    const model =
      await fixture();

    reset(model);

    const original =
      structuredClone(
        useModelStore.getState().model
      );

    const result =
      useModelStore
        .getState()
        .generateConstructiveScenario(
          'scenario:000001'
        );

    let state =
      useModelStore.getState();

    assert.equal(
      result.changed,
      true
    );

    assert.equal(
      result.ephemeralSolution.schema,
      'constructive-solution-v1.0'
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.deepEqual(
      state.model
        .constructiveSolutions
        .scenarios[0]
        .lastGeneration,
      result.receipt
    );

    assert.equal(
      JSON.stringify(
        state.model
      ).includes(
        '"requirementResolutions"'
      ),
      false
    );

    assert.deepEqual(
      withoutConstructiveSolutions(
        state.model
      ),
      withoutConstructiveSolutions(
        original
      )
    );

    state.undo();

    state =
      useModelStore.getState();

    assert.deepEqual(
      state.model,
      original
    );

    assert.equal(
      state.past.length,
      0
    );

    assert.equal(
      state.future.length,
      1
    );

    state.redo();

    state =
      useModelStore.getState();

    assert.deepEqual(
      state.model
        .constructiveSolutions
        .scenarios[0]
        .lastGeneration,
      result.receipt
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.equal(
      JSON.stringify(
        state.model
      ).includes(
        '"requirementResolutions"'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A store: regeneración idéntica es no-op y no agrega historial',
  async () => {
    const model =
      await fixture();

    reset(model);

    const first =
      useModelStore
        .getState()
        .generateConstructiveScenario(
          'scenario:000001'
        );

    const afterFirst =
      structuredClone(
        useModelStore.getState().model
      );

    const second =
      useModelStore
        .getState()
        .generateConstructiveScenario(
          'scenario:000001'
        );

    const state =
      useModelStore.getState();

    assert.equal(
      first.changed,
      true
    );

    assert.equal(
      second.changed,
      false
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.deepEqual(
      state.model,
      afterFirst
    );

    assert.deepEqual(
      second.receipt,
      first.receipt
    );
  }
);


test(
  'SPEC-016-A store: creación neutral compone contrato y es una mutación histórica atómica',
  async () => {
    const model =
      await fixture();

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    reset(model);

    const original =
      structuredClone(
        useModelStore.getState().model
      );

    const result =
      useModelStore
        .getState()
        .createNeutralConstructiveScenario({
          metadata: {
            name:
              'Alternativa neutral',

            description:
              'Scope elegido explícitamente'
          },

          scope: {
            mode:
              'all'
          }
        });

    let state =
      useModelStore.getState();

    assert.equal(
      result.changed,
      true
    );

    assert.equal(
      result.scenario.scenarioId,
      'scenario:000001'
    );

    assert.deepEqual(
      result.scenario.metadata,
      {
        name:
          'Alternativa neutral',

        description:
          'Scope elegido explícitamente'
      }
    );

    assert.equal(
      result.scenario.lifecycle,
      'active'
    );

    assert.deepEqual(
      result.scenario.adapterRef,
      {
        adapterId:
          'neutral-contract-adapter',

        adapterVersion:
          '1.0.0'
      }
    );

    assert.equal(
      result.scenario.libraryRef.libraryId,
      'neutral-contract-library'
    );

    assert.equal(
      result.scenario.libraryRef.libraryVersion,
      '1.0.0'
    );

    assert.match(
      result.scenario.libraryRef.sha256,
      /^[0-9a-f]{64}$/
    );

    assert.deepEqual(
      result.scenario.configuration,
      {
        schema:
          'neutral-contract-configuration-v1.0'
      }
    );

    assert.deepEqual(
      result.scenario.scope,
      {
        mode:
          'all'
      }
    );

    assert.deepEqual(
      result.scenario.assignments,
      []
    );

    assert.equal(
      result.scenario.lastGeneration,
      null
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );

    assert.deepEqual(
      state.model.constructiveSolutions,
      result.constructiveSolutions
    );

    assert.deepEqual(
      withoutConstructiveSolutions(
        state.model
      ),
      withoutConstructiveSolutions(
        original
      )
    );

    state.undo();

    state =
      useModelStore.getState();

    assert.deepEqual(
      state.model,
      original
    );

    assert.equal(
      state.past.length,
      0
    );

    assert.equal(
      state.future.length,
      1
    );

    state.redo();

    state =
      useModelStore.getState();

    assert.deepEqual(
      state.model.constructiveSolutions,
      result.constructiveSolutions
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );
  }
);


test(
  'SPEC-016-A store: creación neutral preserva scope requirements explícito y canónico',
  async () => {
    const model =
      await fixture();

    model.constructiveSolutions =
      createEmptyConstructiveSolutions();

    reset(model);

    const result =
      useModelStore
        .getState()
        .createNeutralConstructiveScenario({
          metadata: {
            name:
              'Alternativa requirements',

            description:
              'Alcance explícito'
          },

          scope: {
            mode:
              'requirements',

            requirementIds: [
              LATERAL_RESISTANCE,
              LOAD_TRANSFER
            ]
          }
        });

    const state =
      useModelStore.getState();

    assert.equal(
      result.changed,
      true
    );

    assert.deepEqual(
      result.scenario.scope,
      {
        mode:
          'requirements',

        requirementIds: [
          LOAD_TRANSFER,
          LATERAL_RESISTANCE
        ]
      }
    );

    assert.deepEqual(
      state.model
        .constructiveSolutions
        .scenarios[0]
        .scope,
      result.scenario.scope
    );

    assert.deepEqual(
      result.scenario.assignments,
      []
    );

    assert.equal(
      result.scenario.lastGeneration,
      null
    );

    assert.equal(
      state.past.length,
      1
    );

    assert.equal(
      state.future.length,
      0
    );
  }
);
