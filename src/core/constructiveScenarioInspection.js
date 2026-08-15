import {
  assertValidConstructiveSolutions
} from './constructiveSolutionScenarios.js';

import {
  evaluateConstructiveScenarioContext,
  projectEffectiveConstructiveInput
} from './constructiveScenarioContext.js';

import {
  buildConstructiveAdapterInput,
  evaluateConstructiveGenerationAvailability
} from './constructiveGenerationInput.js';

import {
  deriveConstructiveGenerationState
} from './constructiveGenerationReceipt.js';

import {
  buildConstructiveStructuralWorkspace
} from './constructiveStructuralWorkspace.js';

import {
  canonicalizeValue
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_SCENARIO_INSPECTION_SCHEMA =
  'constructive-scenario-inspection-v1.0';

export function inspectConstructiveScenario({
  model,
  constructiveSolutions,
  scenarioId,
  runtime
}) {
  assertValidConstructiveSolutions(
    constructiveSolutions
  );

  const scenario =
    constructiveSolutions.scenarios.find(
      (item) =>
        item.scenarioId === scenarioId
    );

  if (!scenario) {
    throw new Error(
      `No existe el escenario ${scenarioId}.`
    );
  }

  const structuralWorkspace =
    buildConstructiveStructuralWorkspace(
      model
    );

  const contextEvaluation =
    evaluateConstructiveScenarioContext({
      scenario,

      structuralRequirements:
        structuralWorkspace
          .structuralRequirements,

      referenceResolutionContext:
        structuralWorkspace
          .referenceResolutionContext,

      geometry:
        structuralWorkspace
          .proposalWorkspace
          .geometry,

      libraryContext:
        runtime.libraryContext
    });

  if (
    !contextEvaluation
      .eligibleForEffectiveProjection
    && scenario.lastGeneration === null
  ) {
    return canonicalizeValue({
      schema:
        CONSTRUCTIVE_SCENARIO_INSPECTION_SCHEMA,

      scenarioId:
        scenario.scenarioId,

      name:
        scenario.metadata.name,

      description:
        scenario.metadata.description,

      lifecycle:
        scenario.lifecycle,

      assignmentCount:
        scenario.assignments.length,

      eligibility: {
        eligibleForEffectiveProjection:
          false,

        reasonCodes:
          contextEvaluation.reasonCodes
      },

      execution:
        'idle',

      verification:
        'notVerified',

      // B3.1 no puede evaluarse sin adapterInput válido.
      availability:
        null,

      coverage:
        'notGenerated',

      freshness:
        'notGenerated',

      fingerprints: {
        currentEffectiveGenerationInputSha256:
          null,

        lastGenerationEffectiveGenerationInputSha256:
          null
      }
    });
  }

  const effectiveInput =
    projectEffectiveConstructiveInput({
      scenario,

      structuralRequirements:
        structuralWorkspace
          .structuralRequirements,

      referenceResolutionContext:
        structuralWorkspace
          .referenceResolutionContext,

      geometry:
        structuralWorkspace
          .proposalWorkspace
          .geometry,

      libraryContext:
        runtime.libraryContext
    });

  const adapterInput =
    buildConstructiveAdapterInput(
      effectiveInput
    );

  const availability =
    evaluateConstructiveGenerationAvailability(
      adapterInput,
      runtime.availabilityContext
    );

  const generationState =
    deriveConstructiveGenerationState({
      adapterInput,

      receipt:
        scenario.lastGeneration,

      availabilityContext:
        runtime.availabilityContext
    });

  return canonicalizeValue({
    schema:
      CONSTRUCTIVE_SCENARIO_INSPECTION_SCHEMA,

    scenarioId:
      scenario.scenarioId,

    name:
      scenario.metadata.name,

    description:
      scenario.metadata.description,

    lifecycle:
      scenario.lifecycle,

    assignmentCount:
      scenario.assignments.length,

    eligibility: {
      eligibleForEffectiveProjection:
        contextEvaluation
          .eligibleForEffectiveProjection,

      reasonCodes:
        contextEvaluation.reasonCodes
    },

    execution:
      'idle',

    verification:
      'notVerified',

    availability:
      availability.state,

    coverage:
      generationState.coverage,

    freshness:
      generationState.freshness,

    fingerprints: {
      currentEffectiveGenerationInputSha256:
        adapterInput
          .effectiveGenerationInputSha256,

      lastGenerationEffectiveGenerationInputSha256:
        scenario.lastGeneration
          ?.effectiveGenerationInputSha256
        ?? null
    }
  });
}
