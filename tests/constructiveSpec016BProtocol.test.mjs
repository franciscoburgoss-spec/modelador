import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  attachConstructiveAdapterRuntimeCapabilities
} from '../src/core/constructiveAdapterRuntime.js';

import {
  CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,
  CONSTRUCTIVE_LIBRARY_CONTEXT_V2_SCHEMA,
  projectConstructiveScenarioConfiguration
} from '../src/core/constructiveScenarioContext.js';

import {
  buildConstructiveArtifact,
  buildConstructiveSolutionV2,
  assertValidConstructiveSolutionV2,
  CONSTRUCTIVE_RESOLUTION_RESPONSE_V2_SCHEMA
} from '../src/core/constructiveSolutionContract.js';

import {
  assertValidConstructiveSolution,
  generateNeutralConstructiveSolution
} from '../src/core/constructiveSolutionGeneration.js';

import {
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

import {
  runConstructiveScenarioGeneration
} from '../src/core/constructiveGenerationPipeline.js';

import {
  buildConstructiveStructuralWorkspace
} from '../src/core/constructiveStructuralWorkspace.js';

import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';

import {
  compareIds
} from '../src/core/structuralProposalCommon.js';

import {
  buildFx008Rev8Short
} from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';

const LATERAL_RESISTANCE =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const SYNTHETIC_ADAPTER_REF = {
  adapterId: 'spec016b-protocol-test-adapter',
  adapterVersion: '1.0.0'
};

const SYNTHETIC_LIBRARY_REF = {
  libraryId: 'spec016b-protocol-test-library',
  libraryVersion: '1.0.0',
  sha256: '1'.repeat(64)
};

const SYNTHETIC_COMPONENT =
  'spec016b-protocol-response';

function syntheticResolution(
  requirement,
  adapterInput,
  artifact
) {
  const assignmentIds =
    adapterInput.assignments
      .filter(
        (assignment) =>
          assignment.requirementRef
            === requirement.id
      )
      .map(
        (assignment) =>
          assignment.assignmentId
      )
      .sort();

  if (assignmentIds.length === 0) {
    return {
      requirementId: requirement.id,
      state: 'unresolved',
      response: null,
      provenance: {
        assignmentIds: [],
        adapterRef: adapterInput.adapterRef,
        libraryRef: adapterInput.libraryRef,
        effectiveGenerationInputSha256:
          adapterInput.effectiveGenerationInputSha256
      }
    };
  }

  return {
    requirementId: requirement.id,
    state: 'resolved',
    response: {
      schema:
        CONSTRUCTIVE_RESOLUTION_RESPONSE_V2_SCHEMA,
      artifactRefs: [artifact.artifactId]
    },
    provenance: {
      assignmentIds,
      adapterRef: adapterInput.adapterRef,
      libraryRef: adapterInput.libraryRef,
      effectiveGenerationInputSha256:
        adapterInput.effectiveGenerationInputSha256
    }
  };
}

function generateSyntheticSolution(
  adapterInput
) {
  const artifact =
    buildConstructiveArtifact({
      kind: 'protocol-test-artifact',
      sourceRefs: [],
      requirementRefs: [
        LOAD_TRANSFER
      ],
      payload: {
        schema:
          'spec016b-protocol-test-artifact-v1.0'
      }
    });

  const requirementResolutions =
    adapterInput
      .effectiveStructuralRequirements
      .requirements
      .map(
        (requirement) =>
          syntheticResolution(
            requirement,
            adapterInput,
            artifact
          )
      );

  return buildConstructiveSolutionV2({
    adapterInput,
    generatedArtifacts: [
      artifact
    ],
    requirementResolutions,
    findings: []
  });
}

function buildSyntheticRuntime() {
  const runtime = {
    adapterRef:
      structuredClone(
        SYNTHETIC_ADAPTER_REF
      ),

    availabilityContext: {
      availableAdapters: [
        structuredClone(
          SYNTHETIC_ADAPTER_REF
        )
      ],
      availableLibraries: [
        structuredClone(
          SYNTHETIC_LIBRARY_REF
        )
      ]
    },

    libraryContext: {
      schema:
        CONSTRUCTIVE_LIBRARY_CONTEXT_V2_SCHEMA,
      libraryId:
        SYNTHETIC_LIBRARY_REF.libraryId,
      libraryVersion:
        SYNTHETIC_LIBRARY_REF.libraryVersion,
      sha256:
        SYNTHETIC_LIBRARY_REF.sha256,
      componentTypes: [
        {
          componentTypeId:
            SYNTHETIC_COMPONENT
        }
      ],
      adapterPayload: {
        schema:
          'spec016b-protocol-test-library-payload-v1.0',
        marker: 'B1'
      }
    },

    libraryManifest: {
      schema:
        'spec016b-protocol-test-library-manifest-v1.0'
    },

    libraryRef:
      structuredClone(
        SYNTHETIC_LIBRARY_REF
      )
  };

  return attachConstructiveAdapterRuntimeCapabilities(
    runtime,
    {
      generateSolution:
        generateSyntheticSolution,
      assertValidSolution:
        assertValidConstructiveSolutionV2
    }
  );
}

async function buildFxModel() {
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

  return model;
}

function buildRoot(
  runtime,
  inputRefs
) {
  let root =
    createEmptyConstructiveSolutions();

  root =
    createConstructiveScenario(
      root,
      {
        metadata: {
          name: 'SPEC-016-B B1 protocol',
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
            'spec016b-protocol-test-configuration-v1.0',
          inputRefs: {
            schema:
              CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,
            elementIds:
              structuredClone(
                inputRefs.elementIds
              ),
            roofGeometryIds:
              structuredClone(
                inputRefs.roofGeometryIds
              )
          }
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

  return createConstructiveAssignment(
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
          SYNTHETIC_COMPONENT
      },
      parameters: {}
    }
  ).constructiveSolutions;
}

test(
  'SPEC-016-B B1: runtime neutral conserva exactamente cinco keys y agrega capacidades no enumerables',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

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

    assert.equal(
      runtime.generateSolution,
      generateNeutralConstructiveSolution
    );

    assert.equal(
      runtime.assertValidSolution,
      assertValidConstructiveSolution
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
  }
);

test(
  'SPEC-016-B B1: pipeline común no importa ni invoca el generador neutral concreto',
  async () => {
    const source =
      await readFile(
        new URL(
          '../src/core/constructiveGenerationPipeline.js',
          import.meta.url
        ),
        'utf8'
      );

    assert.equal(
      source.includes(
        'generateNeutralConstructiveSolution'
      ),
      false
    );

    assert.match(
      source,
      /runtime\.generateSolution/
    );

    assert.match(
      source,
      /runtime\.assertValidSolution/
    );
  }
);

test(
  'SPEC-016-B B1: inputRefs canonicaliza IDs tipados y rechaza duplicados',
  () => {
    const projected =
      projectConstructiveScenarioConfiguration({
        schema: 'config-v1',
        inputRefs: {
          schema:
            CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,
          elementIds: [
            2,
            1,
            '2',
            '1'
          ],
          roofGeometryIds: []
        }
      });

    assert.deepEqual(
      projected.inputRefs.elementIds,
      [
        1,
        2,
        '1',
        '2'
      ].sort(compareIds)
    );

    assert.throws(
      () =>
        projectConstructiveScenarioConfiguration({
          schema: 'config-v1',
          inputRefs: {
            schema:
              CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,
            elementIds: [
              1,
              1
            ],
            roofGeometryIds: []
          }
        }),
      (error) =>
        error?.code
          === 'INVALID_CONFIGURATION_INPUT_REFS'
    );
  }
);

test(
  'SPEC-016-B B1: runtime sintético v2 atraviesa pipeline, persiste receipt v1 y no persiste output',
  async () => {
    const model =
      await buildFxModel();

    const beforeModel =
      structuredClone(model);

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    const ids =
      workspace
        .proposalWorkspace
        .geometry
        .elements
        .map((element) => element.id)
        .slice(0, 2);

    assert.equal(
      ids.length,
      2
    );

    const runtime =
      buildSyntheticRuntime();

    const root =
      buildRoot(
        runtime,
        {
          elementIds: [
            ids[1],
            ids[0]
          ],
          roofGeometryIds: []
        }
      );

    const run =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions: root,
        scenarioId: 'scenario:000001',
        runtime
      });

    assert.equal(
      run.ephemeralSolution.schema,
      'constructive-solution-v2.0'
    );

    assert.equal(
      run.ephemeralSolution.verificationState,
      'notVerified'
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
      run.adapterInput.library.schema,
      CONSTRUCTIVE_LIBRARY_CONTEXT_V2_SCHEMA
    );

    assert.deepEqual(
      run.adapterInput.library.adapterPayload,
      runtime.libraryContext.adapterPayload
    );

    assert.deepEqual(
      run.adapterInput
        .configuration
        .inputRefs
        .elementIds,
      [...ids].sort(compareIds)
    );

    for (const id of ids) {
      assert.equal(
        run.adapterInput
          .effectiveGeometry
          .elements
          .some(
            (element) =>
              element.id === id
          ),
        true
      );
    }

    assert.equal(
      JSON.stringify(
        run.constructiveSolutions
      ).includes(
        '"generatedArtifacts"'
      ),
      false
    );

    assert.deepEqual(
      model,
      beforeModel
    );

    assert.deepEqual(
      model.structuralIntent,
      beforeModel.structuralIntent
    );
  }
);

test(
  'SPEC-016-B B1: permutar inputRefs no cambia el adapter input efectivo ni su hash',
  async () => {
    const model =
      await buildFxModel();

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    const ids =
      workspace
        .proposalWorkspace
        .geometry
        .elements
        .map((element) => element.id)
        .slice(0, 2);

    const runtimeA =
      buildSyntheticRuntime();

    const runtimeB =
      buildSyntheticRuntime();

    const runA =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          buildRoot(
            runtimeA,
            {
              elementIds: [
                ids[0],
                ids[1]
              ],
              roofGeometryIds: []
            }
          ),
        scenarioId:
          'scenario:000001',
        runtime:
          runtimeA
      });

    const runB =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          buildRoot(
            runtimeB,
            {
              elementIds: [
                ids[1],
                ids[0]
              ],
              roofGeometryIds: []
            }
          ),
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
  }
);

test(
  'SPEC-016-B B1: inputRef inexistente y colisión string/number fallan cerradamente',
  async () => {
    const model =
      await buildFxModel();

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    const ids =
      workspace
        .proposalWorkspace
        .geometry
        .elements
        .map((element) => element.id);

    const runtime =
      buildSyntheticRuntime();

    assert.throws(
      () =>
        runConstructiveScenarioGeneration({
          model,
          constructiveSolutions:
            buildRoot(
              runtime,
              {
                elementIds: [
                  '__missing-element__'
                ],
                roofGeometryIds: []
              }
            ),
          scenarioId:
            'scenario:000001',
          runtime
        }),
      (error) =>
        error?.code
          === 'CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE'
        && error.details
          ?.evaluation
          ?.reasonCodes
          ?.includes(
            'CONFIGURATION_INPUT_REF_NOT_RESOLVED'
          )
    );

    const numericId =
      ids.find(
        (id) =>
          typeof id === 'number'
      );

    if (numericId !== undefined) {
      const secondRuntime =
        buildSyntheticRuntime();

      assert.throws(
        () =>
          runConstructiveScenarioGeneration({
            model,
            constructiveSolutions:
              buildRoot(
                secondRuntime,
                {
                  elementIds: [
                    String(numericId)
                  ],
                  roofGeometryIds: []
                }
              ),
            scenarioId:
              'scenario:000001',
            runtime:
              secondRuntime
          }),
        (error) =>
          error?.code
            === 'CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE'
          && error.details
            ?.evaluation
            ?.reasonCodes
            ?.includes(
              'CONFIGURATION_INPUT_REF_NOT_RESOLVED'
            )
      );
    }
  }
);

test(
  'SPEC-016-B B1: v2 mantiene resolved distinto de verified y prohíbe claims sin assignment',
  async () => {
    const model =
      await buildFxModel();

    const workspace =
      buildConstructiveStructuralWorkspace(
        model
      );

    const id =
      workspace
        .proposalWorkspace
        .geometry
        .elements[0]
        .id;

    const runtime =
      buildSyntheticRuntime();

    const run =
      runConstructiveScenarioGeneration({
        model,
        constructiveSolutions:
          buildRoot(
            runtime,
            {
              elementIds: [id],
              roofGeometryIds: []
            }
          ),
        scenarioId:
          'scenario:000001',
        runtime
      });

    const invalidVerification =
      structuredClone(
        run.ephemeralSolution
      );

    invalidVerification.verificationState =
      'verified';

    assert.throws(
      () =>
        assertValidConstructiveSolutionV2(
          invalidVerification,
          run.adapterInput
        ),
      (error) =>
        error?.code
          === 'INVALID_VERIFICATION_STATE'
    );

    const orphanArtifact =
      buildConstructiveArtifact({
        kind: 'protocol-test-orphan',
        requirementRefs: [
          LATERAL_RESISTANCE
        ],
        payload: {
          schema:
            'spec016b-protocol-test-orphan-v1.0'
        }
      });

    assert.throws(
      () =>
        buildConstructiveSolutionV2({
          adapterInput:
            run.adapterInput,
          generatedArtifacts: [
            ...run.ephemeralSolution
              .generatedArtifacts,
            orphanArtifact
          ],
          requirementResolutions:
            run.ephemeralSolution
              .requirementResolutions,
          findings: []
        }),
      (error) =>
        error?.code
          === 'ARTIFACT_REQUIREMENT_CLAIM_MISMATCH'
    );
  }
);
