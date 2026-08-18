import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA
} from '../src/core/constructiveScenarioContext.js';

import {
  METALCON_LIBRARY_MANIFEST
} from '../src/core/metalconConstructiveLibrary.js';

import {
  METALCON_SCENARIO_CONFIGURATION_SCHEMA
} from '../src/core/metalconScenarioConfiguration.js';

import {
  METALCON_FAMILY_RESOLUTION_SCHEMA,
  resolveMetalconScenarioFamilies
} from '../src/core/metalconConstructiveFamilyResolver.js';

const STUD_PROFILE =
  'metalcon-profile:test-b31a-stud';

const TRACK_PROFILE =
  'metalcon-profile:test-b31a-track';

const MATERIAL =
  'metalcon-material:test-b31a-material';

const PANEL =
  'metalcon-panel:test-b31a-panel';

const FULL_ASSEMBLY =
  'metalcon-wall-assembly:test-b31a-full';

const PANEL_ONLY_ASSEMBLY =
  'metalcon-wall-assembly:test-b31a-panel-only';

function buildFixtureManifest() {
  const manifest =
    structuredClone(
      METALCON_LIBRARY_MANIFEST
    );

  /*
   * Fixtures exclusivamente no productivos.
   * D-073 prohíbe promover estos IDs al
   * catálogo productivo B3.1b.
   */
  manifest.profiles = [
    {
      profileId:
        STUD_PROFILE
    },
    {
      profileId:
        TRACK_PROFILE
    }
  ];

  manifest.materials = [
    {
      materialId:
        MATERIAL
    }
  ];

  manifest.panels = [
    {
      panelId:
        PANEL
    }
  ];

  manifest.wallAssemblies = [
    {
      wallAssemblyId:
        FULL_ASSEMBLY,

      studProfileRef:
        STUD_PROFILE,

      trackProfileRef:
        TRACK_PROFILE,

      materialRef:
        MATERIAL,

      panelRef:
        PANEL
    },
    {
      wallAssemblyId:
        PANEL_ONLY_ASSEMBLY,

      panelRef:
        PANEL
    }
  ];

  return manifest;
}

function buildConfiguration(
  constructionSelections
) {
  return {
    schema:
      METALCON_SCENARIO_CONFIGURATION_SCHEMA,

    inputRefs: {
      schema:
        CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

      elementIds:
        constructionSelections.map(
          (selection) =>
            selection.elementId
        ),

      roofGeometryIds:
        []
    },

    constructionSelections:
      structuredClone(
        constructionSelections
      )
  };
}

test(
  'SPEC-016-B B3.1a: resolución vacía es válida y no inventa familias',
  () => {
    const manifest =
      buildFixtureManifest();

    const configuration =
      buildConfiguration([]);

    const result =
      resolveMetalconScenarioFamilies({
        configuration,
        manifest
      });

    assert.deepEqual(
      result,
      {
        schema:
          METALCON_FAMILY_RESOLUTION_SCHEMA,

        selections:
          []
      }
    );
  }
);

test(
  'SPEC-016-B B3.1a: materialRef aislado no activa framing',
  () => {
    const result =
      resolveMetalconScenarioFamilies({
        manifest:
          buildFixtureManifest(),

        configuration:
          buildConfiguration([
            {
              elementId:
                1,

              materialRef:
                MATERIAL
            }
          ])
      });

    assert.equal(
      result.selections[0]
        .materialRef,
      MATERIAL
    );

    assert.deepEqual(
      result.selections[0]
        .families,
      {
        horizontal:
          false,

        panel:
          false,

        vertical:
          false
      }
    );
  }
);

test(
  'SPEC-016-B B3.1a: panelRef y panelRef + materialRef activan sólo panel',
  () => {
    for (
      const selection
      of [
        {
          elementId:
            1,

          panelRef:
            PANEL
        },
        {
          elementId:
            1,

          panelRef:
            PANEL,

          materialRef:
            MATERIAL
        }
      ]
    ) {
      const result =
        resolveMetalconScenarioFamilies({
          manifest:
            buildFixtureManifest(),

          configuration:
            buildConfiguration([
              selection
            ])
        });

      assert.deepEqual(
        result.selections[0]
          .families,
        {
          horizontal:
            false,

          panel:
            true,

          vertical:
            false
        }
      );
    }
  }
);

test(
  'SPEC-016-B B3.1a: familias directas completas se resuelven sin artifacts',
  () => {
    const result =
      resolveMetalconScenarioFamilies({
        manifest:
          buildFixtureManifest(),

        configuration:
          buildConfiguration([
            {
              elementId:
                1,

              studProfileRef:
                STUD_PROFILE,

              trackProfileRef:
                TRACK_PROFILE,

              materialRef:
                MATERIAL,

              panelRef:
                PANEL,

              studSpacingMm:
                600
            }
          ])
      });

    assert.deepEqual(
      result.selections[0],
      {
        elementId:
          1,

        families: {
          horizontal:
            true,

          panel:
            true,

          vertical:
            true
        },

        materialRef:
          MATERIAL,

        panelRef:
          PANEL,

        studProfileRef:
          STUD_PROFILE,

        studSpacingMm:
          600,

        trackProfileRef:
          TRACK_PROFILE,

        wallAssemblyRef:
          null
      }
    );

    assert.equal(
      JSON.stringify(result)
        .includes(
          'generatedArtifacts'
        ),
      false
    );
  }
);

test(
  'SPEC-016-B B3.1a: familia vertical activada pero incompleta falla cerrado',
  () => {
    const cases = [
      {
        selection: {
          elementId:
            1,

          studSpacingMm:
            600,

          materialRef:
            MATERIAL
        },

        missingKeys: [
          'studProfileRef'
        ]
      },
      {
        selection: {
          elementId:
            1,

          studProfileRef:
            STUD_PROFILE,

          materialRef:
            MATERIAL
        },

        missingKeys: [
          'studSpacingMm'
        ]
      }
    ];

    for (
      const {
        selection,
        missingKeys
      }
      of cases
    ) {
      assert.throws(
        () =>
          resolveMetalconScenarioFamilies({
            manifest:
              buildFixtureManifest(),

            configuration:
              buildConfiguration([
                selection
              ])
          }),
        (error) => {
          assert.equal(
            error?.code,
            'INCOMPLETE_METALCON_VERTICAL_FAMILY'
          );

          assert.deepEqual(
            error?.details
              ?.missingKeys,
            missingKeys
          );

          return true;
        }
      );
    }
  }
);

test(
  'SPEC-016-B B3.1a: familia horizontal activada sin material falla cerrado',
  () => {
    assert.throws(
      () =>
        resolveMetalconScenarioFamilies({
          manifest:
            buildFixtureManifest(),

          configuration:
            buildConfiguration([
              {
                elementId:
                  1,

                trackProfileRef:
                  TRACK_PROFILE
              }
            ])
        }),
      (error) => {
        assert.equal(
          error?.code,
          'INCOMPLETE_METALCON_HORIZONTAL_FAMILY'
        );

        assert.deepEqual(
          error?.details
            ?.missingKeys,
          [
            'materialRef'
          ]
        );

        return true;
      }
    );
  }
);

test(
  'SPEC-016-B B3.1a: wallAssemblyRef + spacing resuelve refs y las tres familias',
  () => {
    const result =
      resolveMetalconScenarioFamilies({
        manifest:
          buildFixtureManifest(),

        configuration:
          buildConfiguration([
            {
              elementId:
                1,

              wallAssemblyRef:
                FULL_ASSEMBLY,

              studSpacingMm:
                600
            }
          ])
      });

    assert.deepEqual(
      result.selections[0],
      {
        elementId:
          1,

        families: {
          horizontal:
            true,

          panel:
            true,

          vertical:
            true
        },

        materialRef:
          MATERIAL,

        panelRef:
          PANEL,

        studProfileRef:
          STUD_PROFILE,

        studSpacingMm:
          600,

        trackProfileRef:
          TRACK_PROFILE,

        wallAssemblyRef:
          FULL_ASSEMBLY
      }
    );
  }
);

test(
  'SPEC-016-B B3.1a: wallAssembly con stud no introduce spacing oculto',
  () => {
    assert.throws(
      () =>
        resolveMetalconScenarioFamilies({
          manifest:
            buildFixtureManifest(),

          configuration:
            buildConfiguration([
              {
                elementId:
                  1,

                wallAssemblyRef:
                  FULL_ASSEMBLY
              }
            ])
        }),
      (error) => {
        assert.equal(
          error?.code,
          'INCOMPLETE_METALCON_VERTICAL_FAMILY'
        );

        assert.deepEqual(
          error?.details
            ?.missingKeys,
          [
            'studSpacingMm'
          ]
        );

        return true;
      }
    );
  }
);

test(
  'SPEC-016-B B3.1a: wallAssembly panel-only no activa framing',
  () => {
    const result =
      resolveMetalconScenarioFamilies({
        manifest:
          buildFixtureManifest(),

        configuration:
          buildConfiguration([
            {
              elementId:
                1,

              wallAssemblyRef:
                PANEL_ONLY_ASSEMBLY
            }
          ])
      });

    assert.deepEqual(
      result.selections[0]
        .families,
      {
        horizontal:
          false,

        panel:
          true,

        vertical:
          false
      }
    );

    assert.equal(
      result.selections[0]
        .studSpacingMm,
      null
    );
  }
);

test(
  'SPEC-016-B B3.1a: permutaciones equivalentes conservan output e inputs quedan inmutables',
  () => {
    const manifestA =
      buildFixtureManifest();

    const manifestB =
      structuredClone(
        manifestA
      );

    manifestB.profiles.reverse();
    manifestB.wallAssemblies.reverse();

    const configurationA =
      buildConfiguration([
        {
          elementId:
            2,

          panelRef:
            PANEL,

          materialRef:
            MATERIAL
        },
        {
          elementId:
            1,

          wallAssemblyRef:
            FULL_ASSEMBLY,

          studSpacingMm:
            600
        }
      ]);

    const configurationB =
      buildConfiguration([
        {
          studSpacingMm:
            600,

          wallAssemblyRef:
            FULL_ASSEMBLY,

          elementId:
            1
        },
        {
          materialRef:
            MATERIAL,

          panelRef:
            PANEL,

          elementId:
            2
        }
      ]);

    const beforeManifestA =
      structuredClone(
        manifestA
      );

    const beforeManifestB =
      structuredClone(
        manifestB
      );

    const beforeConfigurationA =
      structuredClone(
        configurationA
      );

    const beforeConfigurationB =
      structuredClone(
        configurationB
      );

    const resultA =
      resolveMetalconScenarioFamilies({
        manifest:
          manifestA,

        configuration:
          configurationA
      });

    const resultB =
      resolveMetalconScenarioFamilies({
        manifest:
          manifestB,

        configuration:
          configurationB
      });

    assert.deepEqual(
      resultB,
      resultA
    );

    assert.deepEqual(
      manifestA,
      beforeManifestA
    );

    assert.deepEqual(
      manifestB,
      beforeManifestB
    );

    assert.deepEqual(
      configurationA,
      beforeConfigurationA
    );

    assert.deepEqual(
      configurationB,
      beforeConfigurationB
    );

    assert.deepEqual(
      resultA.selections.map(
        (selection) =>
          selection.elementId
      ),
      [
        1,
        2
      ]
    );
  }
);
