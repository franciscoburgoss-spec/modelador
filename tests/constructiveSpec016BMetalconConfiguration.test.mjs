import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA
} from '../src/core/constructiveScenarioContext.js';

import {
  METALCON_SCENARIO_CONFIGURATION_SCHEMA,
  assertValidMetalconScenarioConfiguration,
  canonicalizeMetalconScenarioConfiguration,
  metalconScenarioConfigurationSha256,
  assertMetalconScenarioConfigurationLibraryBinding
} from '../src/core/metalconScenarioConfiguration.js';

import {
  METALCON_LIBRARY_MANIFEST
} from '../src/core/metalconConstructiveLibrary.js';

test(
  'SPEC-016-B B2.2a: configuración Metalcon conserva shape estricta y reutiliza inputRefs B1',
  () => {
    const input = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          '2',
          2,
          '1',
          1
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            '2',

          studSpacingMm:
            600
        },
        {
          elementId:
            1,

          studSpacingMm:
            400
        }
      ]
    };

    const result =
      canonicalizeMetalconScenarioConfiguration(
        input
      );

    assert.equal(
      result.schema,
      METALCON_SCENARIO_CONFIGURATION_SCHEMA
    );

    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'constructionSelections',
        'inputRefs',
        'schema'
      ]
    );

    assert.deepEqual(
      result.inputRefs.elementIds,
      [
        1,
        2,
        '1',
        '2'
      ]
    );

    assert.deepEqual(
      result.constructionSelections.map(
        (selection) =>
          selection.elementId
      ),
      [
        1,
        '2'
      ]
    );

    assert.equal(
      assertValidMetalconScenarioConfiguration(
        result
      ),
      result
    );
  }
);

test(
  'SPEC-016-B B2.2a: constructionSelections vacío es válido pre-B3',
  () => {
    const configuration = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [],

        roofGeometryIds: []
      },

      constructionSelections: []
    };

    assert.doesNotThrow(
      () =>
        assertValidMetalconScenarioConfiguration(
          configuration
        )
    );
  }
);

test(
  'SPEC-016-B B2.2a: keys extra, selection duplicado o target fuera de inputRefs fallan cerrado',
  () => {
    const base = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          1
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            1,

          studSpacingMm:
            600
        }
      ]
    };

    const extra =
      structuredClone(base);

    extra.legacyFallback =
      true;

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          extra
        ),
      (error) =>
        error?.code
          === 'INVALID_METALCON_CONFIGURATION'
    );

    const duplicate =
      structuredClone(base);

    duplicate.constructionSelections.push({
      elementId:
        1,

      studSpacingMm:
        400
    });

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          duplicate
        ),
      (error) =>
        error?.code
          === 'DUPLICATE_METALCON_CONSTRUCTION_SELECTION'
    );

    const outside =
      structuredClone(base);

    outside.constructionSelections[0]
      .elementId =
        '1';

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          outside
        ),
      (error) =>
        error?.code
          === 'METALCON_SELECTION_OUTSIDE_INPUT_REFS'
    );
  }
);


test(
  'SPEC-016-B B2.2b: selection admite sólo decisiones constructivas explícitas',
  () => {
    const valid = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          1
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            1,

          studProfileRef:
            'metalcon-profile:stud',

          trackProfileRef:
            'metalcon-profile:track',

          materialRef:
            'metalcon-material:steel',

          panelRef:
            'metalcon-panel:sheathing',

          studSpacingMm:
            600
        }
      ]
    };

    assert.doesNotThrow(
      () =>
        assertValidMetalconScenarioConfiguration(
          valid
        )
    );

    const emptyDecision =
      structuredClone(valid);

    emptyDecision.constructionSelections = [
      {
        elementId:
          1
      }
    ];

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          emptyDecision
        ),
      (error) =>
        error?.code
          === 'EMPTY_METALCON_CONSTRUCTION_SELECTION'
    );

    const arbitrary =
      structuredClone(valid);

    arbitrary.constructionSelections[0]
      .parameters = {
        legacyFallback:
          true
      };

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          arbitrary
        ),
      (error) =>
        error?.code
          === 'INVALID_METALCON_CONSTRUCTION_SELECTION'
    );

    const badSpacing =
      structuredClone(valid);

    badSpacing.constructionSelections[0]
      .studSpacingMm =
        0;

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          badSpacing
        ),
      (error) =>
        error?.code
          === 'INVALID_METALCON_CONSTRUCTION_SELECTION'
    );
  }
);

test(
  'SPEC-016-B B2.2b: assembly y overrides directos no tienen precedencia implícita',
  () => {
    const configuration = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          1
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            1,

          wallAssemblyRef:
            'metalcon-wall-assembly:basic',

          studProfileRef:
            'metalcon-profile:stud'
        }
      ]
    };

    assert.throws(
      () =>
        assertValidMetalconScenarioConfiguration(
          configuration
        ),
      (error) =>
        error?.code
          === 'AMBIGUOUS_METALCON_CONSTRUCTION_SELECTION'
    );
  }
);

test(
  'SPEC-016-B B2.2b: refs de configuración deben pertenecer al dominio y existir en la biblioteca nueva',
  () => {
    const manifest =
      structuredClone(
        METALCON_LIBRARY_MANIFEST
      );

    manifest.profiles = [
      {
        profileId:
          'metalcon-profile:stud'
      },
      {
        profileId:
          'metalcon-profile:track'
      }
    ];

    manifest.materials = [
      {
        materialId:
          'metalcon-material:steel'
      }
    ];

    manifest.panels = [
      {
        panelId:
          'metalcon-panel:sheathing'
      }
    ];

    manifest.wallAssemblies = [
      {
        wallAssemblyId:
          'metalcon-wall-assembly:basic'
      }
    ];

    const configuration = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          1,
          2
        ],

        roofGeometryIds: []
      },

      constructionSelections: [
        {
          elementId:
            1,

          wallAssemblyRef:
            'metalcon-wall-assembly:basic'
        },
        {
          elementId:
            2,

          studProfileRef:
            'metalcon-profile:stud',

          trackProfileRef:
            'metalcon-profile:track',

          materialRef:
            'metalcon-material:steel',

          panelRef:
            'metalcon-panel:sheathing'
        }
      ]
    };

    assert.equal(
      assertMetalconScenarioConfigurationLibraryBinding({
        configuration,
        manifest
      }),
      true
    );

    const wrongDomain =
      structuredClone(configuration);

    wrongDomain.constructionSelections[1]
      .studProfileRef =
        'metalcon-material:steel';

    assert.throws(
      () =>
        assertMetalconScenarioConfigurationLibraryBinding({
          configuration:
            wrongDomain,
          manifest
        }),
      (error) =>
        error?.code
          === 'INVALID_METALCON_CONFIGURATION_REF'
    );

    const missing =
      structuredClone(configuration);

    missing.constructionSelections[1]
      .studProfileRef =
        'metalcon-profile:missing';

    assert.throws(
      () =>
        assertMetalconScenarioConfigurationLibraryBinding({
          configuration:
            missing,
          manifest
        }),
      (error) =>
        error?.code
          === 'BROKEN_METALCON_CONFIGURATION_REF'
    );
  }
);


test(
  'SPEC-016-B B2.2c: permutar inputRefs y selections conserva configuración canónica y SHA',
  () => {
    const a = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          '2',
          2,
          '1',
          1
        ],

        roofGeometryIds: [
          'roof-b',
          'roof-a'
        ]
      },

      constructionSelections: [
        {
          elementId:
            '2',

          studProfileRef:
            'metalcon-profile:stud',

          studSpacingMm:
            600
        },
        {
          elementId:
            1,

          wallAssemblyRef:
            'metalcon-wall-assembly:basic'
        }
      ]
    };

    const b = {
      schema:
        'metalcon-scenario-configuration-v1.0',

      inputRefs: {
        schema:
          CONSTRUCTIVE_CONFIGURATION_INPUT_REFS_SCHEMA,

        elementIds: [
          1,
          '1',
          2,
          '2'
        ],

        roofGeometryIds: [
          'roof-a',
          'roof-b'
        ]
      },

      constructionSelections: [
        {
          wallAssemblyRef:
            'metalcon-wall-assembly:basic',

          elementId:
            1
        },
        {
          studSpacingMm:
            600,

          studProfileRef:
            'metalcon-profile:stud',

          elementId:
            '2'
        }
      ]
    };

    assert.deepEqual(
      canonicalizeMetalconScenarioConfiguration(
        a
      ),
      canonicalizeMetalconScenarioConfiguration(
        b
      )
    );

    assert.equal(
      metalconScenarioConfigurationSha256(
        a
      ),
      metalconScenarioConfigurationSha256(
        b
      )
    );

    assert.match(
      metalconScenarioConfigurationSha256(
        a
      ),
      /^[0-9a-f]{64}$/
    );
  }
);
