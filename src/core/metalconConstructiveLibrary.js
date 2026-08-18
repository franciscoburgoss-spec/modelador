import {
  canonicalizeValue,
  compareText,
  fingerprint,
  isRecord
} from './structuralProposalCommon.js';

import {
  CONSTRUCTIVE_LIBRARY_CONTEXT_V2_SCHEMA
} from './constructiveScenarioContext.js';

import {
  METALCON_PRODUCT_MATERIALS,
  METALCON_PRODUCT_PANELS,
  METALCON_PRODUCT_PROFILES
} from './metalconProductCatalog.js';

export const METALCON_LIBRARY_MANIFEST_SCHEMA =
  'metalcon-library-manifest-v1.0';

export const METALCON_LIBRARY_ID =
  'metalcon-library';

export const METALCON_LIBRARY_VERSION =
  '1.0.0';

const MANIFEST_KEYS = [
  'componentTypes',
  'components',
  'connections',
  'libraryId',
  'libraryVersion',
  'materials',
  'panels',
  'profiles',
  'schema',
  'wallAssemblies'
];

const REGISTRIES = Object.freeze([
  {
    collection: 'profiles',
    idKey: 'profileId',
    prefix: 'metalcon-profile:'
  },
  {
    collection: 'materials',
    idKey: 'materialId',
    prefix: 'metalcon-material:'
  },
  {
    collection: 'panels',
    idKey: 'panelId',
    prefix: 'metalcon-panel:'
  },
  {
    collection: 'wallAssemblies',
    idKey: 'wallAssemblyId',
    prefix: 'metalcon-wall-assembly:'
  },
  {
    collection: 'components',
    idKey: 'componentId',
    prefix: 'metalcon-component:'
  },
  {
    collection: 'connections',
    idKey: 'connectionId',
    prefix: 'metalcon-connection:'
  }
]);

const WALL_ASSEMBLY_REF_SPECS =
  Object.freeze([
    {
      refKey: 'studProfileRef',
      collection: 'profiles',
      idKey: 'profileId',
      prefix: 'metalcon-profile:'
    },
    {
      refKey: 'trackProfileRef',
      collection: 'profiles',
      idKey: 'profileId',
      prefix: 'metalcon-profile:'
    },
    {
      refKey: 'materialRef',
      collection: 'materials',
      idKey: 'materialId',
      prefix: 'metalcon-material:'
    },
    {
      refKey: 'panelRef',
      collection: 'panels',
      idKey: 'panelId',
      prefix: 'metalcon-panel:'
    }
  ]);

export class MetalconConstructiveLibraryError
  extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name =
      'MetalconConstructiveLibraryError';
    this.code = code;
    this.details = details;
  }
}

function fail(
  code,
  message,
  details = {}
) {
  throw new MetalconConstructiveLibraryError(
    code,
    message,
    details
  );
}

function sameKeys(
  value,
  expected
) {
  if (!isRecord(value)) return false;

  const actual =
    Object.keys(value).sort(compareText);

  return (
    actual.length === expected.length
    && actual.every(
      (key, index) =>
        key === expected[index]
    )
  );
}

function assertValidRegistry(
  manifest,
  {
    collection,
    idKey,
    prefix
  }
) {
  const items =
    manifest[collection];

  if (!Array.isArray(items)) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      `${collection} debe ser un arreglo.`,
      {
        collection
      }
    );
  }

  const ids =
    new Set();

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    if (!isRecord(item)) {
      fail(
        'INVALID_METALCON_LIBRARY_ENTRY',
        `${collection}[${index}] debe ser un objeto.`,
        {
          collection,
          index
        }
      );
    }

    const id =
      item[idKey];

    if (
      typeof id !== 'string'
      || !id.startsWith(prefix)
      || id.length === prefix.length
    ) {
      fail(
        'INVALID_METALCON_LIBRARY_ID',
        `${collection}[${index}].${idKey} debe usar ${prefix}*.`,
        {
          collection,
          index,
          idKey,
          id
        }
      );
    }

    if (ids.has(id)) {
      fail(
        'DUPLICATE_METALCON_LIBRARY_ID',
        `${collection} contiene el ID duplicado ${id}.`,
        {
          collection,
          idKey,
          id
        }
      );
    }

    ids.add(id);
  }
}

function assertValidWallAssemblyRefs(
  manifest
) {
  const indexes =
    new Map();

  for (
    const {
      collection,
      idKey
    }
    of REGISTRIES
  ) {
    indexes.set(
      collection,
      new Set(
        manifest[collection].map(
          (item) =>
            item[idKey]
        )
      )
    );
  }

  for (
    let index = 0;
    index < manifest.wallAssemblies.length;
    index += 1
  ) {
    const assembly =
      manifest.wallAssemblies[index];

    for (
      const {
        refKey,
        collection,
        prefix
      }
      of WALL_ASSEMBLY_REF_SPECS
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          assembly,
          refKey
        )
      ) {
        continue;
      }

      const ref =
        assembly[refKey];

      if (
        typeof ref !== 'string'
        || !ref.startsWith(prefix)
        || ref.length === prefix.length
      ) {
        fail(
          'INVALID_METALCON_LIBRARY_REF',
          `wallAssemblies[${index}].${refKey} debe usar ${prefix}*.`,
          {
            index,
            refKey,
            ref
          }
        );
      }

      if (
        !indexes
          .get(collection)
          .has(ref)
      ) {
        fail(
          'BROKEN_METALCON_LIBRARY_REF',
          `wallAssemblies[${index}].${refKey} referencia ${ref}, que no existe en ${collection}.`,
          {
            index,
            refKey,
            ref,
            collection
          }
        );
      }
    }
  }
}

export function
assertValidMetalconLibraryManifest(
  manifest
) {
  if (
    !sameKeys(
      manifest,
      MANIFEST_KEYS
    )
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      'El manifest debe conservar exactamente las keys contractuales.'
    );
  }

  if (
    manifest.schema
      !== METALCON_LIBRARY_MANIFEST_SCHEMA
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      `schema debe ser ${METALCON_LIBRARY_MANIFEST_SCHEMA}.`
    );
  }

  if (
    manifest.libraryId
      !== METALCON_LIBRARY_ID
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      `libraryId debe ser ${METALCON_LIBRARY_ID}.`
    );
  }

  if (
    manifest.libraryVersion
      !== METALCON_LIBRARY_VERSION
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      `libraryVersion debe ser ${METALCON_LIBRARY_VERSION}.`
    );
  }

  if (
    !Array.isArray(
      manifest.componentTypes
    )
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      'componentTypes debe ser un arreglo.'
    );
  }

  if (
    manifest.componentTypes.length !== 0
  ) {
    fail(
      'INVALID_METALCON_LIBRARY_MANIFEST',
      'componentTypes debe permanecer vacío durante B2.'
    );
  }

  for (const registry of REGISTRIES) {
    assertValidRegistry(
      manifest,
      registry
    );
  }

  assertValidWallAssemblyRefs(
    manifest
  );

  return manifest;
}

export function
canonicalizeMetalconLibraryManifest(
  manifest
) {
  assertValidMetalconLibraryManifest(
    manifest
  );

  const result =
    structuredClone(manifest);

  for (
    const {
      collection,
      idKey
    }
    of REGISTRIES
  ) {
    result[collection].sort(
      (left, right) =>
        compareText(
          left[idKey],
          right[idKey]
        )
    );
  }

  return canonicalizeValue(result);
}

export function
metalconLibraryManifestSha256(
  manifest
) {
  return fingerprint(
    canonicalizeMetalconLibraryManifest(
      manifest
    )
  );
}

export const METALCON_LIBRARY_MANIFEST =
  canonicalizeMetalconLibraryManifest({
    schema:
      METALCON_LIBRARY_MANIFEST_SCHEMA,

    libraryId:
      METALCON_LIBRARY_ID,

    libraryVersion:
      METALCON_LIBRARY_VERSION,

    componentTypes: [],

    profiles:
      METALCON_PRODUCT_PROFILES,

    materials:
      METALCON_PRODUCT_MATERIALS,

    panels:
      METALCON_PRODUCT_PANELS,

    wallAssemblies: [],

    components: [],

    connections: []
  });

export const METALCON_LIBRARY_SHA256 =
  metalconLibraryManifestSha256(
    METALCON_LIBRARY_MANIFEST
  );


export const METALCON_LIBRARY_PAYLOAD_SCHEMA =
  'metalcon-library-payload-v1.0';

function sameCanonicalValue(
  left,
  right
) {
  return (
    JSON.stringify(
      canonicalizeValue(left)
    )
    === JSON.stringify(
      canonicalizeValue(right)
    )
  );
}

function assertLibraryRefMatchesManifest(
  manifest,
  libraryRef
) {
  const expectedSha256 =
    metalconLibraryManifestSha256(
      manifest
    );

  if (
    !sameKeys(
      libraryRef,
      [
        'libraryId',
        'libraryVersion',
        'sha256'
      ]
    )
    || libraryRef.libraryId
      !== METALCON_LIBRARY_ID
    || libraryRef.libraryVersion
      !== METALCON_LIBRARY_VERSION
    || libraryRef.sha256
      !== expectedSha256
  ) {
    fail(
      'METALCON_LIBRARY_TAMPER',
      'libraryRef no coincide exactamente con la identidad y SHA-256 del manifest canónico.',
      {
        expectedSha256,
        libraryRef
      }
    );
  }
}

function buildMetalconLibraryPayload(
  manifest
) {
  const canonical =
    canonicalizeMetalconLibraryManifest(
      manifest
    );

  return canonicalizeValue({
    schema:
      METALCON_LIBRARY_PAYLOAD_SCHEMA,

    profiles:
      structuredClone(
        canonical.profiles
      ),

    materials:
      structuredClone(
        canonical.materials
      ),

    panels:
      structuredClone(
        canonical.panels
      ),

    wallAssemblies:
      structuredClone(
        canonical.wallAssemblies
      ),

    components:
      structuredClone(
        canonical.components
      ),

    connections:
      structuredClone(
        canonical.connections
      )
  });
}

export function buildMetalconLibraryRef(
  manifest
) {
  const canonical =
    canonicalizeMetalconLibraryManifest(
      manifest
    );

  return canonicalizeValue({
    libraryId:
      canonical.libraryId,

    libraryVersion:
      canonical.libraryVersion,

    sha256:
      metalconLibraryManifestSha256(
        canonical
      )
  });
}

export function buildMetalconLibraryContext(
  manifest,
  libraryRef
) {
  const canonical =
    canonicalizeMetalconLibraryManifest(
      manifest
    );

  assertLibraryRefMatchesManifest(
    canonical,
    libraryRef
  );

  return canonicalizeValue({
    schema:
      CONSTRUCTIVE_LIBRARY_CONTEXT_V2_SCHEMA,

    libraryId:
      canonical.libraryId,

    libraryVersion:
      canonical.libraryVersion,

    sha256:
      libraryRef.sha256,

    componentTypes:
      structuredClone(
        canonical.componentTypes
      ),

    adapterPayload:
      buildMetalconLibraryPayload(
        canonical
      )
  });
}

export function
assertValidMetalconLibraryBinding({
  manifest,
  libraryRef,
  libraryContext
}) {
  const canonical =
    canonicalizeMetalconLibraryManifest(
      manifest
    );

  assertLibraryRefMatchesManifest(
    canonical,
    libraryRef
  );

  const expectedContext =
    buildMetalconLibraryContext(
      canonical,
      libraryRef
    );

  if (
    !sameCanonicalValue(
      libraryContext,
      expectedContext
    )
  ) {
    fail(
      'METALCON_LIBRARY_CONTEXT_MISMATCH',
      'libraryContext debe derivar exclusivamente del manifest Metalcon canónico.',
      {
        expectedContext,
        libraryContext
      }
    );
  }

  return true;
}
