import assert from 'node:assert/strict';
import test from 'node:test';

import {
  METALCON_LIBRARY_ID,
  METALCON_LIBRARY_MANIFEST,
  METALCON_LIBRARY_MANIFEST_SCHEMA,
  METALCON_LIBRARY_SHA256,
  METALCON_LIBRARY_VERSION,
  assertValidMetalconLibraryManifest,
  canonicalizeMetalconLibraryManifest,
  metalconLibraryManifestSha256,
  buildMetalconLibraryRef,
  buildMetalconLibraryContext,
  assertValidMetalconLibraryBinding,
  METALCON_LIBRARY_PAYLOAD_SCHEMA
} from '../src/core/metalconConstructiveLibrary.js';

const EXPECTED_EMPTY_SHA256 =
  'f90a840bd2a88a2ddd270592ef5e375d4177f345f7eb1d0c6fea608ff65135f0';
const EMPTY_METALCON_LIBRARY_MANIFEST =
  canonicalizeMetalconLibraryManifest({
    schema:
      METALCON_LIBRARY_MANIFEST_SCHEMA,
    libraryId:
      METALCON_LIBRARY_ID,
    libraryVersion:
      METALCON_LIBRARY_VERSION,
    componentTypes: [],
    profiles: [],
    materials: [],
    panels: [],
    wallAssemblies: [],
    components: [],
    connections: []
  });

test(
  'SPEC-016-B B2.1: fixture histórico conserva biblioteca vacía y hash canónico reproducible',
  () => {
    assert.equal(
      METALCON_LIBRARY_MANIFEST_SCHEMA,
      'metalcon-library-manifest-v1.0'
    );

    assert.equal(
      METALCON_LIBRARY_ID,
      'metalcon-library'
    );

    assert.equal(
      METALCON_LIBRARY_VERSION,
      '1.0.0'
    );

    assert.deepEqual(
      EMPTY_METALCON_LIBRARY_MANIFEST,
      {
        componentTypes: [],
        components: [],
        connections: [],
        libraryId: 'metalcon-library',
        libraryVersion: '1.0.0',
        materials: [],
        panels: [],
        profiles: [],
        schema: 'metalcon-library-manifest-v1.0',
        wallAssemblies: []
      }
    );

    assert.equal(
      metalconLibraryManifestSha256(
        EMPTY_METALCON_LIBRARY_MANIFEST
      ),
      EXPECTED_EMPTY_SHA256
    );

    assert.equal(
      assertValidMetalconLibraryManifest(
        EMPTY_METALCON_LIBRARY_MANIFEST
      ),
      EMPTY_METALCON_LIBRARY_MANIFEST
    );
  }
);


test(
  'SPEC-016-B B2.1b: IDs Metalcon son textuales, namespaced y únicos por registro',
  () => {
    const cases = [
      ['profiles', 'profileId', 'metalcon-profile:'],
      ['materials', 'materialId', 'metalcon-material:'],
      ['panels', 'panelId', 'metalcon-panel:'],
      ['wallAssemblies', 'wallAssemblyId', 'metalcon-wall-assembly:'],
      ['components', 'componentId', 'metalcon-component:'],
      ['connections', 'connectionId', 'metalcon-connection:']
    ];

    for (
      const [
        collection,
        idKey,
        prefix
      ]
      of cases
    ) {
      const valid =
        structuredClone(
          METALCON_LIBRARY_MANIFEST
        );

      valid[collection] = [
        {
          [idKey]:
            `${prefix}a`
        },
        {
          [idKey]:
            `${prefix}b`
        }
      ];

      assert.doesNotThrow(
        () =>
          assertValidMetalconLibraryManifest(
            valid
          )
      );

      const duplicate =
        structuredClone(valid);

      duplicate[collection][1][idKey] =
        `${prefix}a`;

      assert.throws(
        () =>
          assertValidMetalconLibraryManifest(
            duplicate
          ),
        (error) =>
          error?.code
            === 'DUPLICATE_METALCON_LIBRARY_ID'
      );

      const wrongPrefix =
        structuredClone(valid);

      wrongPrefix[collection][0][idKey] =
        'legacy:1';

      assert.throws(
        () =>
          assertValidMetalconLibraryManifest(
            wrongPrefix
          ),
        (error) =>
          error?.code
            === 'INVALID_METALCON_LIBRARY_ID'
      );

      const numeric =
        structuredClone(valid);

      numeric[collection][0][idKey] =
        1;

      assert.throws(
        () =>
          assertValidMetalconLibraryManifest(
            numeric
          ),
        (error) =>
          error?.code
            === 'INVALID_METALCON_LIBRARY_ID'
      );
    }
  }
);

test(
  'SPEC-016-B B2.1b: permutar registros equivalentes conserva manifest canónico y SHA',
  () => {
    const a =
      structuredClone(
        METALCON_LIBRARY_MANIFEST
      );

    a.profiles = [
      {
        profileId:
          'metalcon-profile:z'
      },
      {
        profileId:
          'metalcon-profile:a'
      }
    ];

    a.materials = [
      {
        materialId:
          'metalcon-material:b'
      },
      {
        materialId:
          'metalcon-material:a'
      }
    ];

    const b =
      structuredClone(a);

    b.profiles.reverse();
    b.materials.reverse();

    const canonicalA =
      canonicalizeMetalconLibraryManifest(
        a
      );

    const canonicalB =
      canonicalizeMetalconLibraryManifest(
        b
      );

    assert.deepEqual(
      canonicalB,
      canonicalA
    );

    assert.deepEqual(
      canonicalA.profiles.map(
        (item) =>
          item.profileId
      ),
      [
        'metalcon-profile:a',
        'metalcon-profile:z'
      ]
    );

    assert.equal(
      metalconLibraryManifestSha256(a),
      metalconLibraryManifestSha256(b)
    );
  }
);


test(
  'SPEC-016-B B2.1c: fixture histórico vacío deriva libraryRef, context v2 y adapterPayload reproducibles',
  () => {
    const libraryRef =
      buildMetalconLibraryRef(
        EMPTY_METALCON_LIBRARY_MANIFEST
      );

    assert.deepEqual(
      libraryRef,
      {
        libraryId:
          'metalcon-library',
        libraryVersion:
          '1.0.0',
        sha256:
          EXPECTED_EMPTY_SHA256
      }
    );

    const context =
      buildMetalconLibraryContext(
        EMPTY_METALCON_LIBRARY_MANIFEST,
        libraryRef
      );

    assert.equal(
      context.schema,
      'constructive-library-context-v2.0'
    );

    assert.equal(
      context.libraryId,
      libraryRef.libraryId
    );

    assert.equal(
      context.libraryVersion,
      libraryRef.libraryVersion
    );

    assert.equal(
      context.sha256,
      libraryRef.sha256
    );

    assert.deepEqual(
      context.componentTypes,
      []
    );

    assert.deepEqual(
      context.adapterPayload,
      {
        schema:
          METALCON_LIBRARY_PAYLOAD_SCHEMA,
        profiles: [],
        materials: [],
        panels: [],
        wallAssemblies: [],
        components: [],
        connections: []
      }
    );

    assert.equal(
      assertValidMetalconLibraryBinding({
        manifest:
          EMPTY_METALCON_LIBRARY_MANIFEST,
        libraryRef,
        libraryContext:
          context
      }),
      true
    );
  }
);

test(
  'SPEC-016-B B2.1c: manifest alterado con SHA anterior falla cerrado por tamper',
  () => {
    const originalRef =
      buildMetalconLibraryRef(
        METALCON_LIBRARY_MANIFEST
      );

    const tampered =
      structuredClone(
        METALCON_LIBRARY_MANIFEST
      );

    tampered.profiles = [
      {
        profileId:
          'metalcon-profile:tampered'
      }
    ];

    const staleContext =
      buildMetalconLibraryContext(
        METALCON_LIBRARY_MANIFEST,
        originalRef
      );

    assert.throws(
      () =>
        assertValidMetalconLibraryBinding({
          manifest:
            tampered,
          libraryRef:
            originalRef,
          libraryContext:
            staleContext
        }),
      (error) =>
        error?.code
          === 'METALCON_LIBRARY_TAMPER'
    );
  }
);

test(
  'SPEC-016-B B2.1c: libraryRef o adapterPayload desacoplado del manifest falla cerrado',
  () => {
    const libraryRef =
      buildMetalconLibraryRef(
        METALCON_LIBRARY_MANIFEST
      );

    const context =
      buildMetalconLibraryContext(
        METALCON_LIBRARY_MANIFEST,
        libraryRef
      );

    const wrongRef =
      structuredClone(
        libraryRef
      );

    wrongRef.sha256 =
      'a'.repeat(64);

    assert.throws(
      () =>
        assertValidMetalconLibraryBinding({
          manifest:
            METALCON_LIBRARY_MANIFEST,
          libraryRef:
            wrongRef,
          libraryContext:
            context
        }),
      (error) =>
        error?.code
          === 'METALCON_LIBRARY_TAMPER'
    );

    const wrongContext =
      structuredClone(
        context
      );

    wrongContext.adapterPayload.profiles = [
      {
        profileId:
          'metalcon-profile:injected'
      }
    ];

    assert.throws(
      () =>
        assertValidMetalconLibraryBinding({
          manifest:
            METALCON_LIBRARY_MANIFEST,
          libraryRef,
          libraryContext:
            wrongContext
        }),
      (error) =>
        error?.code
          === 'METALCON_LIBRARY_CONTEXT_MISMATCH'
    );
  }
);

test(
  'SPEC-016-B B2.1d: wallAssembly acepta sólo refs internas existentes y del dominio correcto',
  () => {
    const valid =
      structuredClone(
        METALCON_LIBRARY_MANIFEST
      );

    valid.profiles = [
      {
        profileId:
          'metalcon-profile:stud'
      },
      {
        profileId:
          'metalcon-profile:track'
      }
    ];

    valid.materials = [
      {
        materialId:
          'metalcon-material:steel'
      }
    ];

    valid.panels = [
      {
        panelId:
          'metalcon-panel:sheathing'
      }
    ];

    valid.wallAssemblies = [
      {
        wallAssemblyId:
          'metalcon-wall-assembly:basic',
        studProfileRef:
          'metalcon-profile:stud',
        trackProfileRef:
          'metalcon-profile:track',
        materialRef:
          'metalcon-material:steel',
        panelRef:
          'metalcon-panel:sheathing'
      }
    ];

    assert.doesNotThrow(
      () =>
        assertValidMetalconLibraryManifest(
          valid
        )
    );

    const missing =
      structuredClone(valid);

    missing.wallAssemblies[0]
      .studProfileRef =
        'metalcon-profile:missing';

    assert.throws(
      () =>
        assertValidMetalconLibraryManifest(
          missing
        ),
      (error) =>
        error?.code
          === 'BROKEN_METALCON_LIBRARY_REF'
    );

    const crossDomain =
      structuredClone(valid);

    crossDomain.wallAssemblies[0]
      .studProfileRef =
        'metalcon-material:steel';

    assert.throws(
      () =>
        assertValidMetalconLibraryManifest(
          crossDomain
        ),
      (error) =>
        error?.code
          === 'INVALID_METALCON_LIBRARY_REF'
    );
  }
);

test(
  'SPEC-016-B B2.1d: ref interna no textual falla cerrado sin coerción',
  () => {
    const invalid =
      structuredClone(
        METALCON_LIBRARY_MANIFEST
      );

    invalid.profiles = [
      {
        profileId:
          'metalcon-profile:stud'
      }
    ];

    invalid.wallAssemblies = [
      {
        wallAssemblyId:
          'metalcon-wall-assembly:basic',
        studProfileRef:
          1
      }
    ];

    assert.throws(
      () =>
        assertValidMetalconLibraryManifest(
          invalid
        ),
      (error) =>
        error?.code
          === 'INVALID_METALCON_LIBRARY_REF'
    );
  }
);
