import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

import {
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  inspectConstructiveScenario
} from '../src/core/constructiveScenarioInspection.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

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
      {
        metadata: {
          name: 'FX-008 inspección',
          description: 'Escenario A'
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

  return {
    model,
    constructiveSolutions,
    runtime
  };
}

test(
  'SPEC-016-A UI inspection: escenario sin generación muestra estado real sin ejecutar B3.2',
  async () => {
    const {
      model,
      constructiveSolutions,
      runtime
    } = await fixture();

    const before =
      structuredClone(
        constructiveSolutions
      );

    const inspection =
      inspectConstructiveScenario({
        model,
        constructiveSolutions,
        scenarioId:
          'scenario:000001',
        runtime
      });

    assert.deepEqual(
      inspection,
      {
        schema:
          'constructive-scenario-inspection-v1.0',

        scenarioId:
          'scenario:000001',

        name:
          'FX-008 inspección',

        description:
          'Escenario A',

        lifecycle:
          'active',

        assignmentCount:
          1,

        eligibility: {
          eligibleForEffectiveProjection:
            true,

          reasonCodes: []
        },

        execution:
          'idle',

        verification:
          'notVerified',

        availability:
          'available',

        coverage:
          'notGenerated',

        freshness:
          'notGenerated',

        fingerprints: {
          currentEffectiveGenerationInputSha256:
            inspection
              .fingerprints
              .currentEffectiveGenerationInputSha256,

          lastGenerationEffectiveGenerationInputSha256:
            null
        }
      }
    );

    assert.match(
      inspection
        .fingerprints
        .currentEffectiveGenerationInputSha256,
      /^[0-9a-f]{64}$/
    );

    assert.deepEqual(
      constructiveSolutions,
      before
    );
  }
);

test(
  'SPEC-016-A UI inspection: receipt vigente deriva partial/fresh sin regenerar',
  async () => {
    const {
      model,
      constructiveSolutions,
      runtime
    } = await fixture();

    const generated =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions,
        scenarioId:
          'scenario:000001',
        runtime
      });

    const persisted =
      generated.constructiveSolutions;

    const before =
      structuredClone(
        persisted
      );

    const inspection =
      inspectConstructiveScenario({
        model,
        constructiveSolutions:
          persisted,

        scenarioId:
          'scenario:000001',

        runtime
      });

    assert.equal(
      inspection.execution,
      'idle'
    );

    assert.equal(
      inspection.verification,
      'notVerified'
    );

    assert.equal(
      inspection.availability,
      'available'
    );

    assert.equal(
      inspection.coverage,
      'partial'
    );

    assert.equal(
      inspection.freshness,
      'fresh'
    );

    assert.equal(
      inspection
        .fingerprints
        .lastGenerationEffectiveGenerationInputSha256,
      inspection
        .fingerprints
        .currentEffectiveGenerationInputSha256
    );

    assert.deepEqual(
      persisted,
      before
    );
  }
);

test(
  'SPEC-016-A UI inspection: frontera de lectura no depende de B3.2, store ni UI',
  async () => {
    const source =
      await readFile(
        new URL(
          '../src/core/constructiveScenarioInspection.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /constructiveSolutionGeneration|generateNeutralConstructiveSolution/
    );

    assert.doesNotMatch(
      source,
      /useModelStore|components\/|React|Metalcon|OSB/
    );
  }
);


test(
  'BUG-016-A-038: inspección representa inelegibilidad B2 sin proyectar entrada efectiva',
  async () => {
    const {
      model,
      runtime
    } = await fixture();

    let constructiveSolutions =
      createEmptyConstructiveSolutions();

    constructiveSolutions =
      createConstructiveScenario(
        constructiveSolutions,
        {
          metadata: {
            name:
              'FX-008 scope all bloqueado',

            description:
              'Escenario válido B1 e inelegible B2'
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
              'all'
          }
        }
      ).constructiveSolutions;

    const before =
      structuredClone(
        constructiveSolutions
      );

    const inspection =
      inspectConstructiveScenario({
        model,

        constructiveSolutions,

        scenarioId:
          'scenario:000001',

        runtime
      });

    assert.deepEqual(
      inspection.eligibility,
      {
        eligibleForEffectiveProjection:
          false,

        reasonCodes: [
          'BLOCKING_DECISION_RELEVANT'
        ]
      }
    );

    assert.equal(
      inspection.availability,
      null
    );

    assert.equal(
      inspection.coverage,
      'notGenerated'
    );

    assert.equal(
      inspection.freshness,
      'notGenerated'
    );

    assert.equal(
      inspection
        .fingerprints
        .currentEffectiveGenerationInputSha256,
      null
    );

    assert.equal(
      inspection
        .fingerprints
        .lastGenerationEffectiveGenerationInputSha256,
      null
    );

    assert.deepEqual(
      constructiveSolutions,
      before
    );
  }
);
