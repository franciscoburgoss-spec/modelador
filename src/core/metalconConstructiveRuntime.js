import {
  attachConstructiveAdapterRuntimeCapabilities
} from './constructiveAdapterRuntime.js';

import {
  assertValidConstructiveSolutionV2,
  buildConstructiveSolutionV2
} from './constructiveSolutionContract.js';

import {
  METALCON_LIBRARY_MANIFEST,
  buildMetalconLibraryContext,
  buildMetalconLibraryRef
} from './metalconConstructiveLibrary.js';

import {
  assertMetalconScenarioConfigurationLibraryBinding,
  assertValidMetalconScenarioConfiguration
} from './metalconScenarioConfiguration.js';

import {
  canonicalizeValue,
  cloneJson,
  isRecord
} from './structuralProposalCommon.js';

const METALCON_ADAPTER_REF =
  Object.freeze({
    adapterId:
      'metalcon',

    adapterVersion:
      '1.0.0'
  });

export class MetalconConstructiveRuntimeError
  extends Error {
  constructor(
    code,
    message,
    details = {}
  ) {
    super(message);

    this.name =
      'MetalconConstructiveRuntimeError';

    this.code =
      code;

    this.details =
      details;
  }
}

function fail(
  code,
  message,
  details = {}
) {
  throw new MetalconConstructiveRuntimeError(
    code,
    message,
    details
  );
}

function sameCanonicalValue(
  left,
  right
) {
  return (
    JSON.stringify(
      canonicalizeValue(left)
    )
    ===
    JSON.stringify(
      canonicalizeValue(right)
    )
  );
}

function expectedLibraryRef() {
  return buildMetalconLibraryRef(
    METALCON_LIBRARY_MANIFEST
  );
}

function expectedLibraryContext() {
  const libraryRef =
    expectedLibraryRef();

  return buildMetalconLibraryContext(
    METALCON_LIBRARY_MANIFEST,
    libraryRef
  );
}

function assertMetalconAdapterInputBoundary(
  adapterInput
) {
  if (!isRecord(adapterInput)) {
    fail(
      'INVALID_METALCON_ADAPTER_INPUT',
      'El runtime Metalcon requiere un adapterInput efectivo.'
    );
  }

  if (
    !sameCanonicalValue(
      adapterInput.adapterRef,
      METALCON_ADAPTER_REF
    )
  ) {
    fail(
      'METALCON_ADAPTER_REF_MISMATCH',
      'adapterInput.adapterRef no corresponde a metalcon@1.0.0.'
    );
  }

  const libraryRef =
    expectedLibraryRef();

  const libraryContext =
    expectedLibraryContext();

  if (
    !sameCanonicalValue(
      adapterInput.libraryRef,
      libraryRef
    )
    ||
    !sameCanonicalValue(
      adapterInput.library,
      libraryContext
    )
  ) {
    fail(
      'METALCON_LIBRARY_BINDING_MISMATCH',
      'El adapter input no está ligado exactamente a la biblioteca Metalcon canónica B2.'
    );
  }

  if (
    !Array.isArray(
      adapterInput.assignments
    )
  ) {
    fail(
      'INVALID_METALCON_ADAPTER_INPUT',
      'adapterInput.assignments debe ser un arreglo.'
    );
  }

  /*
   * B2/B3 no procesan assignments.
   * La respuesta explícita a requirements
   * pertenece a B4.
   */
  if (
    adapterInput.assignments.length
      > 0
  ) {
    fail(
      'METALCON_ASSIGNMENTS_UNSUPPORTED_PRE_B4',
      'El runtime Metalcon pre-B4 no admite assignments.'
    );
  }

  assertValidMetalconScenarioConfiguration(
    adapterInput.configuration
  );

  assertMetalconScenarioConfigurationLibraryBinding({
    configuration:
      adapterInput.configuration,

    manifest:
      METALCON_LIBRARY_MANIFEST
  });

  if (
    !isRecord(
      adapterInput
        .effectiveStructuralRequirements
    )
    ||
    !Array.isArray(
      adapterInput
        .effectiveStructuralRequirements
        .requirements
    )
  ) {
    fail(
      'INVALID_METALCON_ADAPTER_INPUT',
      'El runtime Metalcon requiere requirements estructurales efectivos.'
    );
  }

  return adapterInput;
}

export function
generateMetalconConstructiveSolutionPreB3(
  adapterInput
) {
  assertMetalconAdapterInputBoundary(
    adapterInput
  );

  const requirementResolutions =
    adapterInput
      .effectiveStructuralRequirements
      .requirements
      .map(
        (requirement) => ({
          requirementId:
            requirement.id,

          state:
            'unresolved',

          response:
            null,

          provenance: {
            assignmentIds:
              [],

            adapterRef:
              adapterInput.adapterRef,

            libraryRef:
              adapterInput.libraryRef,

            effectiveGenerationInputSha256:
              adapterInput
                .effectiveGenerationInputSha256
          }
        })
      );

  return buildConstructiveSolutionV2({
    adapterInput,

    generatedArtifacts:
      [],

    requirementResolutions,

    findings:
      []
  });
}

export function
buildMetalconConstructiveRuntime() {
  const adapterRef =
    cloneJson(
      METALCON_ADAPTER_REF
    );

  const libraryManifest =
    cloneJson(
      METALCON_LIBRARY_MANIFEST
    );

  const libraryRef =
    cloneJson(
      expectedLibraryRef()
    );

  const libraryContext =
    cloneJson(
      expectedLibraryContext()
    );

  const availabilityContext = {
    availableAdapters: [
      cloneJson(
        adapterRef
      )
    ],

    availableLibraries: [
      cloneJson(
        libraryRef
      )
    ]
  };

  const runtime = {
    adapterRef:
      cloneJson(
        adapterRef
      ),

    availabilityContext:
      cloneJson(
        availabilityContext
      ),

    libraryContext:
      cloneJson(
        libraryContext
      ),

    libraryManifest:
      cloneJson(
        libraryManifest
      ),

    libraryRef:
      cloneJson(
        libraryRef
      )
  };

  return attachConstructiveAdapterRuntimeCapabilities(
    runtime,
    {
      generateSolution:
        generateMetalconConstructiveSolutionPreB3,

      assertValidSolution:
        assertValidConstructiveSolutionV2
    }
  );
}
