import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  evaluateConstructiveGenerationAvailability
} from '../src/core/constructiveGenerationInput.js';

import {
  NEUTRAL_CONTRACT_LIBRARY_MANIFEST_SCHEMA,
  NEUTRAL_CONTRACT_LIBRARY_SHA256,
  buildNeutralConstructiveRuntime
} from '../src/core/constructiveNeutralRuntime.js';

const EXPECTED_SHA256 =
  '404ca9e7ed30b522dfddb211b98099bb8a739119957071d1642f41f004d2fc2f';

const EXPECTED_COMPONENT =
  'abstract-load-transfer-response';

test(
  'SPEC-016-A integración: runtime neutral materializa identidad productiva exacta',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    assert.equal(
      NEUTRAL_CONTRACT_LIBRARY_MANIFEST_SCHEMA,
      'neutral-contract-library-manifest-v1.0'
    );

    assert.equal(
      NEUTRAL_CONTRACT_LIBRARY_SHA256,
      EXPECTED_SHA256
    );

    assert.deepEqual(
      runtime.libraryManifest,
      {
        schema:
          'neutral-contract-library-manifest-v1.0',

        libraryId:
          'neutral-contract-library',

        libraryVersion:
          '1.0.0',

        componentTypes: [
          {
            componentTypeId:
              EXPECTED_COMPONENT
          }
        ]
      }
    );

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
  }
);

test(
  'SPEC-016-A integración: libraryRef deriva del manifiesto neutral y usa SHA reproducible',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    assert.deepEqual(
      runtime.libraryRef,
      {
        libraryId:
          'neutral-contract-library',

        libraryVersion:
          '1.0.0',

        sha256:
          EXPECTED_SHA256
      }
    );

    assert.equal(
      runtime.libraryRef.sha256,
      NEUTRAL_CONTRACT_LIBRARY_SHA256
    );
  }
);

test(
  'SPEC-016-A integración: libraryContext es sólo la proyección mínima requerida por B2',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    assert.deepEqual(
      runtime.libraryContext,
      {
        schema:
          'constructive-library-context-v1.0',

        libraryId:
          'neutral-contract-library',

        libraryVersion:
          '1.0.0',

        sha256:
          EXPECTED_SHA256,

        componentTypes: [
          {
            componentTypeId:
              EXPECTED_COMPONENT
          }
        ]
      }
    );

    assert.equal(
      Object.hasOwn(
        runtime.libraryContext,
        'materials'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        runtime.libraryContext,
        'profiles'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A integración: availabilityContext usa exactamente la identidad B3.1',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    assert.deepEqual(
      runtime.adapterRef,
      {
        adapterId:
          'neutral-contract-adapter',

        adapterVersion:
          '1.0.0'
      }
    );

    assert.deepEqual(
      runtime.availabilityContext,
      {
        availableAdapters: [
          {
            adapterId:
              'neutral-contract-adapter',

            adapterVersion:
              '1.0.0'
          }
        ],

        availableLibraries: [
          {
            libraryId:
              'neutral-contract-library',

            libraryVersion:
              '1.0.0',

            sha256:
              EXPECTED_SHA256
          }
        ]
      }
    );

    const availability =
      evaluateConstructiveGenerationAvailability(
        {
          schema:
            'constructive-adapter-input-v1.0',

          adapterRef:
            structuredClone(
              runtime.adapterRef
            ),

          libraryRef:
            structuredClone(
              runtime.libraryRef
            )
        },

        runtime.availabilityContext
      );

    assert.equal(
      availability.state,
      'available'
    );

    assert.equal(
      availability.adapterAvailable,
      true
    );

    assert.equal(
      availability.libraryAvailable,
      true
    );

    assert.deepEqual(
      availability.reasonCodes,
      []
    );
  }
);

test(
  'SPEC-016-A integración: runtime no expone capacidades neutrales que B3.2 no soporta',
  () => {
    const runtime =
      buildNeutralConstructiveRuntime();

    const ids =
      runtime.libraryManifest
        .componentTypes
        .map(
          (item) =>
            item.componentTypeId
        );

    assert.deepEqual(
      ids,
      [
        'abstract-load-transfer-response'
      ]
    );

    assert.equal(
      ids.includes(
        'abstract-lateral-response'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A integración: llamadas sucesivas no comparten objetos mutables',
  () => {
    const first =
      buildNeutralConstructiveRuntime();

    const second =
      buildNeutralConstructiveRuntime();

    assert.deepEqual(
      second,
      first
    );

    first.libraryManifest
      .componentTypes[0]
      .componentTypeId =
        'MUTATED';

    first.availabilityContext
      .availableLibraries[0]
      .sha256 =
        '0'.repeat(64);

    const third =
      buildNeutralConstructiveRuntime();

    assert.equal(
      third.libraryManifest
        .componentTypes[0]
        .componentTypeId,
      EXPECTED_COMPONENT
    );

    assert.equal(
      third.libraryRef.sha256,
      EXPECTED_SHA256
    );

    assert.equal(
      third.availabilityContext
        .availableLibraries[0]
        .sha256,
      EXPECTED_SHA256
    );
  }
);

test(
  'SPEC-016-A integración: runtime neutral permanece independiente de store/UI/Metalcon/OSB',
  async () => {
    const source =
      await readFile(
        new URL(
          '../src/core/constructiveNeutralRuntime.js',
          import.meta.url
        ),
        'utf8'
      );

    for (const forbiddenImport of [
      'react',
      'three',
      '../store',
      '/store',
      '/components/',
      'metalcon',
      'osb'
    ]) {
      assert.equal(
        new RegExp(
          `from\\s+['"][^'"]*${forbiddenImport}`,
          'i'
        ).test(source),
        false,
        `import prohibido: ${forbiddenImport}`
      );
    }

    for (const forbiddenVocabulary of [
      'stud',
      'profile',
      'material',
      'capacity',
      'rigidity'
    ]) {
      assert.equal(
        source
          .toLowerCase()
          .includes(forbiddenVocabulary),
        false,
        `vocabulario constructivo real prohibido: ${forbiddenVocabulary}`
      );
    }
  }
);
