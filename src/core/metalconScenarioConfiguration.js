import {
  projectConstructiveScenarioConfiguration
} from './constructiveScenarioContext.js';

import {
  canonicalizeValue,
  compareIds,
  compareText,
  fingerprint,
  idToken,
  isRecord
} from './structuralProposalCommon.js';

import {
  assertValidMetalconLibraryManifest
} from './metalconConstructiveLibrary.js';

export const METALCON_SCENARIO_CONFIGURATION_SCHEMA =
  'metalcon-scenario-configuration-v1.0';

const CONFIGURATION_KEYS = [
  'constructionSelections',
  'inputRefs',
  'schema'
];


const SELECTION_KEYS =
  new Set([
    'elementId',
    'materialRef',
    'panelRef',
    'studProfileRef',
    'studSpacingMm',
    'trackProfileRef',
    'wallAssemblyRef'
  ]);

const DIRECT_OVERRIDE_KEYS =
  Object.freeze([
    'studProfileRef',
    'trackProfileRef',
    'materialRef',
    'panelRef'
  ]);

const CONFIGURATION_REF_SPECS =
  Object.freeze([
    {
      refKey: 'wallAssemblyRef',
      collection: 'wallAssemblies',
      idKey: 'wallAssemblyId',
      prefix: 'metalcon-wall-assembly:'
    },
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

export class MetalconScenarioConfigurationError
  extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name =
      'MetalconScenarioConfigurationError';
    this.code = code;
    this.details = details;
  }
}

function fail(
  code,
  message,
  details = {}
) {
  throw new MetalconScenarioConfigurationError(
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

function validElementId(
  value
) {
  return (
    (
      typeof value === 'string'
      && value.length > 0
    )
    || Number.isSafeInteger(value)
  );
}

function hasOwn(
  value,
  key
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

function assertValidSelectionContract(
  selection,
  index
) {
  if (!isRecord(selection)) {
    fail(
      'INVALID_METALCON_CONSTRUCTION_SELECTION',
      `constructionSelections[${index}] debe ser un objeto.`,
      {
        index
      }
    );
  }

  for (const key of Object.keys(selection)) {
    if (!SELECTION_KEYS.has(key)) {
      fail(
        'INVALID_METALCON_CONSTRUCTION_SELECTION',
        `constructionSelections[${index}] no admite ${key}.`,
        {
          index,
          key
        }
      );
    }
  }

  const decisionKeys =
    [...SELECTION_KEYS]
      .filter(
        (key) =>
          key !== 'elementId'
          && hasOwn(
            selection,
            key
          )
      );

  if (decisionKeys.length === 0) {
    fail(
      'EMPTY_METALCON_CONSTRUCTION_SELECTION',
      `constructionSelections[${index}] debe declarar al menos una decisión constructiva.`,
      {
        index
      }
    );
  }

  if (
    hasOwn(
      selection,
      'wallAssemblyRef'
    )
    && DIRECT_OVERRIDE_KEYS.some(
      (key) =>
        hasOwn(
          selection,
          key
        )
    )
  ) {
    fail(
      'AMBIGUOUS_METALCON_CONSTRUCTION_SELECTION',
      `constructionSelections[${index}] no puede mezclar wallAssemblyRef con overrides directos.`,
      {
        index
      }
    );
  }

  if (
    hasOwn(
      selection,
      'studSpacingMm'
    )
    && (
      !Number.isFinite(
        selection.studSpacingMm
      )
      || selection.studSpacingMm <= 0
    )
  ) {
    fail(
      'INVALID_METALCON_CONSTRUCTION_SELECTION',
      `constructionSelections[${index}].studSpacingMm debe ser finito y mayor que cero.`,
      {
        index,
        studSpacingMm:
          selection.studSpacingMm
      }
    );
  }

  for (
    const {
      refKey,
      prefix
    }
    of CONFIGURATION_REF_SPECS
  ) {
    if (!hasOwn(selection, refKey)) {
      continue;
    }

    const ref =
      selection[refKey];

    if (
      typeof ref !== 'string'
      || !ref.startsWith(prefix)
      || ref.length === prefix.length
    ) {
      fail(
        'INVALID_METALCON_CONFIGURATION_REF',
        `constructionSelections[${index}].${refKey} debe usar ${prefix}*.`,
        {
          index,
          refKey,
          ref
        }
      );
    }
  }
}

function inspectConfiguration(
  configuration
) {
  if (
    !sameKeys(
      configuration,
      CONFIGURATION_KEYS
    )
    || configuration.schema
      !== METALCON_SCENARIO_CONFIGURATION_SCHEMA
    || !Array.isArray(
      configuration.constructionSelections
    )
  ) {
    fail(
      'INVALID_METALCON_CONFIGURATION',
      'La configuración Metalcon debe conservar exactamente schema, inputRefs y constructionSelections.'
    );
  }

  let projected;

  try {
    projected =
      projectConstructiveScenarioConfiguration(
        configuration
      );
  } catch (error) {
    fail(
      'INVALID_METALCON_CONFIGURATION',
      'configuration.inputRefs no cumple el contrato común B1.',
      {
        causeCode:
          error?.code ?? null
      }
    );
  }

  const allowedTargets =
    new Set(
      projected.inputRefs.elementIds.map(
        idToken
      )
    );

  const seenTargets =
    new Set();

  for (
    let index = 0;
    index
      < configuration
        .constructionSelections
        .length;
    index += 1
  ) {
    const selection =
      configuration
        .constructionSelections[index];

    assertValidSelectionContract(
      selection,
      index
    );

    if (
      !hasOwn(
        selection,
        'elementId'
      )
      || !validElementId(
        selection.elementId
      )
    ) {
      fail(
        'INVALID_METALCON_CONSTRUCTION_SELECTION',
        `constructionSelections[${index}] requiere un elementId tipado válido.`,
        {
          index,
          elementId:
            selection?.elementId
        }
      );
    }

    const token =
      idToken(
        selection.elementId
      );

    if (seenTargets.has(token)) {
      fail(
        'DUPLICATE_METALCON_CONSTRUCTION_SELECTION',
        `constructionSelections contiene más de una selección para ${String(selection.elementId)}.`,
        {
          index,
          elementId:
            selection.elementId
        }
      );
    }

    seenTargets.add(token);

    if (!allowedTargets.has(token)) {
      fail(
        'METALCON_SELECTION_OUTSIDE_INPUT_REFS',
        `constructionSelections[${index}].elementId debe existir explícitamente en inputRefs.elementIds.`,
        {
          index,
          elementId:
            selection.elementId
        }
      );
    }
  }

  return projected;
}

export function
assertValidMetalconScenarioConfiguration(
  configuration
) {
  inspectConfiguration(
    configuration
  );

  return configuration;
}

export function
assertMetalconScenarioConfigurationLibraryBinding({
  configuration,
  manifest
}) {
  assertValidMetalconScenarioConfiguration(
    configuration
  );

  assertValidMetalconLibraryManifest(
    manifest
  );

  const indexes =
    new Map();

  for (
    const {
      collection,
      idKey
    }
    of CONFIGURATION_REF_SPECS
  ) {
    if (indexes.has(collection)) {
      continue;
    }

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
    index
      < configuration
        .constructionSelections
        .length;
    index += 1
  ) {
    const selection =
      configuration
        .constructionSelections[index];

    for (
      const {
        refKey,
        collection
      }
      of CONFIGURATION_REF_SPECS
    ) {
      if (!hasOwn(selection, refKey)) {
        continue;
      }

      const ref =
        selection[refKey];

      if (
        !indexes
          .get(collection)
          .has(ref)
      ) {
        fail(
          'BROKEN_METALCON_CONFIGURATION_REF',
          `constructionSelections[${index}].${refKey} referencia ${ref}, que no existe en ${collection}.`,
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

  return true;
}

export function
canonicalizeMetalconScenarioConfiguration(
  configuration
) {
  const projected =
    inspectConfiguration(
      configuration
    );

  const constructionSelections =
    projected
      .constructionSelections
      .map(
        (selection) =>
          canonicalizeValue(
            structuredClone(
              selection
            )
          )
      )
      .sort(
        (left, right) =>
          compareIds(
            left.elementId,
            right.elementId
          )
      );

  return canonicalizeValue({
    schema:
      METALCON_SCENARIO_CONFIGURATION_SCHEMA,

    inputRefs:
      projected.inputRefs,

    constructionSelections
  });
}

export function
metalconScenarioConfigurationSha256(
  configuration
) {
  return fingerprint(
    canonicalizeMetalconScenarioConfiguration(
      configuration
    )
  );
}
