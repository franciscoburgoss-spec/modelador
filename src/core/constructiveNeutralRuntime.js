import {
  CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA
} from './constructiveScenarioContext.js';

import {
  canonicalizeValue,
  cloneJson,
  fingerprint
} from './structuralProposalCommon.js';

export const NEUTRAL_CONTRACT_LIBRARY_MANIFEST_SCHEMA =
  'neutral-contract-library-manifest-v1.0';

const NEUTRAL_ADAPTER_ID =
  'neutral-contract-adapter';

const NEUTRAL_ADAPTER_VERSION =
  '1.0.0';

const NEUTRAL_LIBRARY_ID =
  'neutral-contract-library';

const NEUTRAL_LIBRARY_VERSION =
  '1.0.0';

const NEUTRAL_COMPONENT_TYPE_ID =
  'abstract-load-transfer-response';

const NEUTRAL_CONTRACT_LIBRARY_MANIFEST =
  canonicalizeValue({
    schema:
      NEUTRAL_CONTRACT_LIBRARY_MANIFEST_SCHEMA,

    libraryId:
      NEUTRAL_LIBRARY_ID,

    libraryVersion:
      NEUTRAL_LIBRARY_VERSION,

    componentTypes: [
      {
        componentTypeId:
          NEUTRAL_COMPONENT_TYPE_ID
      }
    ]
  });

export const NEUTRAL_CONTRACT_LIBRARY_SHA256 =
  fingerprint(
    NEUTRAL_CONTRACT_LIBRARY_MANIFEST
  );

export function buildNeutralConstructiveRuntime() {
  const adapterRef = {
    adapterId:
      NEUTRAL_ADAPTER_ID,

    adapterVersion:
      NEUTRAL_ADAPTER_VERSION
  };

  const libraryRef = {
    libraryId:
      NEUTRAL_LIBRARY_ID,

    libraryVersion:
      NEUTRAL_LIBRARY_VERSION,

    sha256:
      NEUTRAL_CONTRACT_LIBRARY_SHA256
  };

  const libraryContext = {
    schema:
      CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,

    libraryId:
      NEUTRAL_LIBRARY_ID,

    libraryVersion:
      NEUTRAL_LIBRARY_VERSION,

    sha256:
      NEUTRAL_CONTRACT_LIBRARY_SHA256,

    componentTypes:
      cloneJson(
        NEUTRAL_CONTRACT_LIBRARY_MANIFEST
          .componentTypes
      )
  };

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

  return {
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
        NEUTRAL_CONTRACT_LIBRARY_MANIFEST
      ),

    libraryRef:
      cloneJson(
        libraryRef
      )
  };
}
