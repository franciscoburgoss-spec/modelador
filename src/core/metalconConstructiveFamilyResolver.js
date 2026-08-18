import {
  assertMetalconScenarioConfigurationLibraryBinding,
  canonicalizeMetalconScenarioConfiguration
} from './metalconScenarioConfiguration.js';

import {
  canonicalizeValue
} from './structuralProposalCommon.js';

export const METALCON_FAMILY_RESOLUTION_SCHEMA =
  'metalcon-family-resolution-v1.0';

export class MetalconConstructiveFamilyResolutionError
  extends Error {
  constructor(
    code,
    message,
    details = {}
  ) {
    super(message);

    this.name =
      'MetalconConstructiveFamilyResolutionError';

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
  throw new MetalconConstructiveFamilyResolutionError(
    code,
    message,
    details
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

function resolveWallAssembly(
  manifest,
  wallAssemblyRef
) {
  const matches =
    manifest.wallAssemblies.filter(
      (assembly) =>
        assembly.wallAssemblyId
          === wallAssemblyRef
    );

  /*
   * El binding B2 ya garantiza existencia
   * y unicidad del registro. Esta barrera
   * permanece fail-closed por defensa local.
   */
  if (matches.length !== 1) {
    fail(
      'UNRESOLVABLE_METALCON_WALL_ASSEMBLY',
      `wallAssemblyRef ${wallAssemblyRef} no resuelve exactamente un assembly.`,
      {
        wallAssemblyRef,
        matches:
          matches.length
      }
    );
  }

  return matches[0];
}

function collectResolvedRefs(
  selection,
  manifest
) {
  const resolvedRefs = {
    studProfileRef:
      null,

    trackProfileRef:
      null,

    materialRef:
      null,

    panelRef:
      null
  };

  let wallAssemblyRef =
    null;

  if (
    hasOwn(
      selection,
      'wallAssemblyRef'
    )
  ) {
    wallAssemblyRef =
      selection.wallAssemblyRef;

    const assembly =
      resolveWallAssembly(
        manifest,
        wallAssemblyRef
      );

    for (
      const key
      of [
        'studProfileRef',
        'trackProfileRef',
        'materialRef',
        'panelRef'
      ]
    ) {
      if (
        hasOwn(
          assembly,
          key
        )
      ) {
        resolvedRefs[key] =
          assembly[key];
      }
    }
  } else {
    for (
      const key
      of [
        'studProfileRef',
        'trackProfileRef',
        'materialRef',
        'panelRef'
      ]
    ) {
      if (
        hasOwn(
          selection,
          key
        )
      ) {
        resolvedRefs[key] =
          selection[key];
      }
    }
  }

  return {
    resolvedRefs,
    wallAssemblyRef
  };
}

function assertCompleteVerticalFamily({
  elementId,
  resolvedRefs,
  studSpacingMm,
  wallAssemblyRef
}) {
  const active =
    resolvedRefs.studProfileRef !== null
    || studSpacingMm !== null;

  if (!active) {
    return false;
  }

  const missingKeys = [];

  if (
    resolvedRefs.studProfileRef
      === null
  ) {
    missingKeys.push(
      'studProfileRef'
    );
  }

  if (
    resolvedRefs.materialRef
      === null
  ) {
    missingKeys.push(
      'materialRef'
    );
  }

  if (studSpacingMm === null) {
    missingKeys.push(
      'studSpacingMm'
    );
  }

  if (missingKeys.length > 0) {
    fail(
      'INCOMPLETE_METALCON_VERTICAL_FAMILY',
      `La familia vertical de ${String(elementId)} está activada pero incompleta.`,
      {
        elementId,
        wallAssemblyRef,
        missingKeys
      }
    );
  }

  return true;
}

function assertCompleteHorizontalFamily({
  elementId,
  resolvedRefs,
  wallAssemblyRef
}) {
  const active =
    resolvedRefs.trackProfileRef
      !== null;

  if (!active) {
    return false;
  }

  const missingKeys = [];

  if (
    resolvedRefs.materialRef
      === null
  ) {
    missingKeys.push(
      'materialRef'
    );
  }

  if (missingKeys.length > 0) {
    fail(
      'INCOMPLETE_METALCON_HORIZONTAL_FAMILY',
      `La familia horizontal de ${String(elementId)} está activada pero incompleta.`,
      {
        elementId,
        wallAssemblyRef,
        missingKeys
      }
    );
  }

  return true;
}

function resolveSelection(
  selection,
  manifest
) {
  const {
    resolvedRefs,
    wallAssemblyRef
  } =
    collectResolvedRefs(
      selection,
      manifest
    );

  const studSpacingMm =
    hasOwn(
      selection,
      'studSpacingMm'
    )
      ? selection.studSpacingMm
      : null;

  const vertical =
    assertCompleteVerticalFamily({
      elementId:
        selection.elementId,

      resolvedRefs,

      studSpacingMm,

      wallAssemblyRef
    });

  const horizontal =
    assertCompleteHorizontalFamily({
      elementId:
        selection.elementId,

      resolvedRefs,

      wallAssemblyRef
    });

  const panel =
    resolvedRefs.panelRef !== null;

  return canonicalizeValue({
    elementId:
      selection.elementId,

    wallAssemblyRef,

    studProfileRef:
      resolvedRefs.studProfileRef,

    trackProfileRef:
      resolvedRefs.trackProfileRef,

    materialRef:
      resolvedRefs.materialRef,

    panelRef:
      resolvedRefs.panelRef,

    studSpacingMm,

    families: {
      vertical,
      horizontal,
      panel
    }
  });
}

export function
resolveMetalconScenarioFamilies({
  configuration,
  manifest
}) {
  /*
   * B3.1a no redefine B2:
   * reutiliza íntegramente sus contratos
   * de configuración, manifest y binding.
   */
  assertMetalconScenarioConfigurationLibraryBinding({
    configuration,
    manifest
  });

  const canonicalConfiguration =
    canonicalizeMetalconScenarioConfiguration(
      configuration
    );

  const selections =
    canonicalConfiguration
      .constructionSelections
      .map(
        (selection) =>
          resolveSelection(
            selection,
            manifest
          )
      );

  return canonicalizeValue({
    schema:
      METALCON_FAMILY_RESOLUTION_SCHEMA,

    selections
  });
}
