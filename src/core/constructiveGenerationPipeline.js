import {
  assertValidConstructiveSolutions
} from './constructiveSolutionScenarios.js';

import {
  projectEffectiveConstructiveInput
} from './constructiveScenarioContext.js';

import {
  buildConstructiveAdapterInput,
  evaluateConstructiveGenerationAvailability
} from './constructiveGenerationInput.js';

import {
  generateNeutralConstructiveSolution
} from './constructiveSolutionGeneration.js';

import {
  buildConstructiveGenerationReceipt,
  deriveConstructiveGenerationState,
  recordConstructiveGenerationReceipt
} from './constructiveGenerationReceipt.js';

import {
  buildConstructiveStructuralWorkspace
} from './constructiveStructuralWorkspace.js';

import {
  canonicalizeValue
} from './structuralProposalCommon.js';

export const CONSTRUCTIVE_GENERATION_RUN_SCHEMA =
  'constructive-generation-run-v1.0';

export class ConstructiveGenerationPipelineError
  extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name =
      'ConstructiveGenerationPipelineError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = null) {
  throw new ConstructiveGenerationPipelineError(
    code,
    message,
    details
  );
}

function requireRuntime(runtime) {
  if (
    runtime === null
    || typeof runtime !== 'object'
    || Array.isArray(runtime)
    || runtime.libraryContext === null
    || typeof runtime.libraryContext !== 'object'
    || runtime.availabilityContext === null
    || typeof runtime.availabilityContext !== 'object'
  ) {
    fail(
      'INVALID_RUNTIME',
      'La generación requiere un runtime constructivo explícito.'
    );
  }
}

export function runConstructiveScenarioGeneration({
  model,
  constructiveSolutions,
  scenarioId,
  runtime
}) {
  assertValidConstructiveSolutions(
    constructiveSolutions
  );

  requireRuntime(runtime);

  const scenario =
    constructiveSolutions.scenarios.find(
      (item) =>
        item.scenarioId === scenarioId
    );

  if (!scenario) {
    fail(
      'SCENARIO_NOT_FOUND',
      `No existe el escenario ${scenarioId}.`
    );
  }

  const structuralWorkspace =
    buildConstructiveStructuralWorkspace(
      model
    );

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

  if (availability.state !== 'available') {
    fail(
      'GENERATION_UNAVAILABLE',
      'El adapter o la biblioteca requerida no están disponibles.',
      {
        availability
      }
    );
  }

  const ephemeralSolution =
    generateNeutralConstructiveSolution(
      adapterInput
    );

  const receipt =
    buildConstructiveGenerationReceipt({
      adapterInput,

      solution:
        ephemeralSolution,

      structuralRequirements:
        structuralWorkspace
          .structuralRequirements
    });

  const recorded =
    recordConstructiveGenerationReceipt(
      constructiveSolutions,
      scenarioId,
      receipt,
      adapterInput
    );

  const generationState =
    deriveConstructiveGenerationState({
      adapterInput,

      receipt:
        recorded.scenario
          .lastGeneration,

      availabilityContext:
        runtime.availabilityContext
    });

  return canonicalizeValue({
    schema:
      CONSTRUCTIVE_GENERATION_RUN_SCHEMA,

    scenarioId,

    adapterInput,
    availability,

    ephemeralSolution,
    receipt,
    generationState,

    constructiveSolutions:
      recorded.constructiveSolutions,

    scenario:
      recorded.scenario,

    changed:
      recorded.changed
  });
}
