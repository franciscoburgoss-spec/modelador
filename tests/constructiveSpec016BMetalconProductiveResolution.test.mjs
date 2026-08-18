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

const FX008_WALL_ID =
  1784606313849;

const STUD_PROFILE =
  'metalcon-profile:cintac-90ca085';

const TRACK_PROFILE =
  'metalcon-profile:cintac-92c085';

const MATERIAL =
  'metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90';

const PANEL =
  'metalcon-panel:lp-osb-apa-protec-11_1-1220x2440';

test(
  'SPEC-016-B B3.1b: resolver B3.1a consume catálogo productivo real sin defaults ni artifacts',
  () => {
    const configuration = {
      schema:
        METALCON_SCENARIO_CONFIGURATION_SCHEMA,

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          FX008_WALL_ID
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            FX008_WALL_ID,

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
      ]
    };

    const before =
      structuredClone(configuration);

    const result =
      resolveMetalconScenarioFamilies({
        configuration,
        manifest:
          METALCON_LIBRARY_MANIFEST
      });

    assert.deepEqual(
      configuration,
      before
    );

    assert.deepEqual(
      result,
      {
        schema:
          METALCON_FAMILY_RESOLUTION_SCHEMA,

        selections: [
          {
            elementId:
              FX008_WALL_ID,

            families: {
              horizontal: true,
              panel: true,
              vertical: true
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
        ]
      }
    );

    assert.deepEqual(
      METALCON_LIBRARY_MANIFEST
        .wallAssemblies,
      []
    );

    const encoded =
      JSON.stringify(result);

    for (
      const forbidden
      of [
        'generatedArtifacts',
        'assignments',
        'requirementRefs',
        'verificationState',
        'capacity'
      ]
    ) {
      assert.equal(
        encoded.includes(forbidden),
        false
      );
    }
  }
);
