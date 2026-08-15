import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
  projectEffectiveConstructiveInput
} from '../src/core/constructiveScenarioContext.js';
import {
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions
} from '../src/core/constructiveSolutionScenarios.js';
import {
  buildStructuralRequirementsWithReferenceResolutionContext
} from '../src/core/structuralRequirements.js';
import {
  createStructuralReferenceResolutionContext
} from '../src/core/structuralReferenceResolutionContext.js';
import {
  canonicalizeValue,
  fingerprint
} from '../src/core/structuralProposalCommon.js';
import {
  CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA,
  CONSTRUCTIVE_GENERATION_AVAILABILITY_SCHEMA,
  ConstructiveGenerationInputError,
  buildConstructiveAdapterInput,
  evaluateConstructiveGenerationAvailability
} from '../src/core/constructiveGenerationInput.js';
import { buildFx008Rev8Short } from './helpers/spec015dRev8.mjs';

const LOAD_TRANSFER_REQUIREMENT =
  'sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331';
const LATERAL_RESISTANCE_REQUIREMENT =
  'sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84';

const COMPONENT_TRANSFER = 'abstract-load-transfer-response';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

let fx;

function inputFrom(context) {
  return {
    geometry: context.geometry,
    topology: context.topology,
    structuralIntent: context.model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent,
    structuralProposals: context.proposals,
    structuralProposalReviews: context.model.structuralProposalReviews,
    candidateLoadPaths: context.paths
  };
}

test.before(async () => {
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const companion =
    buildStructuralRequirementsWithReferenceResolutionContext(inputFrom(context));

  fx = {
    context,
    requirements: companion.structuralRequirements,
    referenceResolutionContext: companion.referenceResolutionContext
  };
});

function scenarioInput({
  name = 'Escenario B3',
  adapterVersion = '1.0.0',
  librarySha256 = SHA_A,
  configuration = { schema: 'neutral-contract-configuration-v1.0' },
  scope = {
    mode: 'requirements',
    requirementIds: [
      LOAD_TRANSFER_REQUIREMENT,
      LATERAL_RESISTANCE_REQUIREMENT
    ]
  }
} = {}) {
  return {
    metadata: { name, description: '' },
    adapterRef: {
      adapterId: 'neutral-contract-adapter',
      adapterVersion
    },
    libraryRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      sha256: librarySha256
    },
    configuration,
    scope
  };
}

function assignmentInput(parameters = {}) {
  return {
    requirementRef: LOAD_TRANSFER_REQUIREMENT,
    targetRef: {
      kind: 'requirement',
      ref: LOAD_TRANSFER_REQUIREMENT
    },
    choiceRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      componentTypeId: COMPONENT_TRANSFER
    },
    parameters
  };
}

function rootWithOneScenario({
  scenario = scenarioInput(),
  assignment = assignmentInput()
} = {}) {
  let root = createConstructiveScenario(
    createEmptyConstructiveSolutions(),
    scenario
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignment
  ).constructiveSolutions;

  return root;
}

function rootWithTwoEquivalentScenarios() {
  let root = createEmptyConstructiveSolutions();

  root = createConstructiveScenario(
    root,
    scenarioInput({ name: 'A' })
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignmentInput()
  ).constructiveSolutions;

  root = createConstructiveScenario(
    root,
    scenarioInput({ name: 'B' })
  ).constructiveSolutions;

  root = createConstructiveAssignment(
    root,
    'scenario:000002',
    assignmentInput()
  ).constructiveSolutions;

  return root;
}

function libraryContext(sha256 = SHA_A) {
  return {
    schema: CONSTRUCTIVE_LIBRARY_CONTEXT_SCHEMA,
    libraryId: 'neutral-contract-library',
    libraryVersion: '1.0.0',
    sha256,
    componentTypes: [
      { componentTypeId: COMPONENT_TRANSFER, upstreamSecret: true },
      { componentTypeId: 'abstract-lateral-response', upstreamSecret: true }
    ]
  };
}

function referenceContextFor(requirements) {
  return createStructuralReferenceResolutionContext(requirements, {
    referenceBindings: fx.referenceResolutionContext.referenceBindings,
    targets: fx.referenceResolutionContext.targets,
    provenanceRelations: fx.referenceResolutionContext.provenanceRelations
  });
}

function effectiveInputFor(
  scenario,
  {
    requirements = fx.requirements,
    referenceResolutionContext = null,
    librarySha256 = scenario.libraryRef.sha256
  } = {}
) {
  return projectEffectiveConstructiveInput({
    scenario,
    structuralRequirements: requirements,
    referenceResolutionContext:
      referenceResolutionContext ?? referenceContextFor(requirements),
    geometry: fx.context.geometry,
    libraryContext: libraryContext(librarySha256)
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function aggregatePayload(adapterInput) {
  return canonicalizeValue({
    scenarioId: adapterInput.scenarioId,
    effectiveGeometry: adapterInput.effectiveGeometry,
    effectiveStructuralRequirements:
      adapterInput.effectiveStructuralRequirements,
    relevantBlockingDecisionContext:
      adapterInput.relevantBlockingDecisionContext,
    scope: adapterInput.scope,
    configuration: adapterInput.configuration,
    assignments: adapterInput.assignments,
    adapterRef: adapterInput.adapterRef,
    libraryRef: adapterInput.libraryRef
  });
}

test(
  'SPEC-016-A B3.1: construye constructive-adapter-input-v1.0 separando blocker context sin redefinir B2',
  () => {
    const root = rootWithOneScenario();
    const effective = effectiveInputFor(root.scenarios[0]);
    const before = structuredClone(effective);

    const result = buildConstructiveAdapterInput(effective);

    assert.equal(
      result.schema,
      CONSTRUCTIVE_ADAPTER_INPUT_SCHEMA
    );
    assert.equal(
      result.schema,
      'constructive-adapter-input-v1.0'
    );

    assert.deepEqual(effective, before);

    assert.deepEqual(
      result.relevantBlockingDecisionContext,
      effective.effectiveStructuralRequirements
        .relevantBlockingDecisionContext
    );

    assert.equal(
      Object.hasOwn(
        result.effectiveStructuralRequirements,
        'relevantBlockingDecisionContext'
      ),
      false
    );

    assert.deepEqual(
      result.library,
      effective.library,
      'B3.1 debe conservar la selección efectiva mínima ya proyectada por B2'
    );

    assert.deepEqual(
      result.library.componentTypes,
      [{ componentTypeId: COMPONENT_TRANSFER }]
    );

    assert.equal(
      Object.hasOwn(result.library.componentTypes[0], 'upstreamSecret'),
      false,
      'B3.1 no puede reintroducir contenido descartado por el allowlist B2'
    );

    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'adapterRef',
        'assignments',
        'configuration',
        'effectiveFingerprints',
        'effectiveGenerationInputSha256',
        'effectiveGeometry',
        'effectiveStructuralRequirements',
        'library',
        'libraryRef',
        'relevantBlockingDecisionContext',
        'scenarioId',
        'schema',
        'scope'
      ].sort()
    );
  }
);

test(
  'SPEC-016-A B3.1: effectiveGenerationInputSha256 usa exactamente las dimensiones contractuales y no su propio hash',
  () => {
    const root = rootWithOneScenario();
    const result = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    assert.match(
      result.effectiveGenerationInputSha256,
      /^[a-f0-9]{64}$/
    );

    assert.equal(
      result.effectiveGenerationInputSha256,
      fingerprint(aggregatePayload(result))
    );

    assert.equal(
      Object.hasOwn(
        aggregatePayload(result),
        'effectiveGenerationInputSha256'
      ),
      false
    );
  }
);

test(
  'SPEC-016-A B3.1: los ocho subfingerprints corresponden sólo a las dimensiones efectivas',
  () => {
    const root = rootWithOneScenario();
    const result = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    assert.deepEqual(
      result.effectiveFingerprints,
      canonicalizeValue({
        effectiveGeometrySha256:
          fingerprint(result.effectiveGeometry),
        effectiveStructuralRequirementsSha256:
          fingerprint(result.effectiveStructuralRequirements),
        relevantBlockingDecisionContextSha256:
          fingerprint(result.relevantBlockingDecisionContext),
        scopeSha256:
          fingerprint(result.scope),
        configurationSha256:
          fingerprint(result.configuration),
        assignmentsSha256:
          fingerprint(result.assignments),
        adapterFingerprint:
          fingerprint(result.adapterRef),
        libraryFingerprint:
          fingerprint(result.libraryRef)
      })
    );

    assert.deepEqual(
      Object.keys(result.effectiveFingerprints).sort(),
      [
        'effectiveGeometrySha256',
        'effectiveStructuralRequirementsSha256',
        'relevantBlockingDecisionContextSha256',
        'scopeSha256',
        'configurationSha256',
        'assignmentsSha256',
        'adapterFingerprint',
        'libraryFingerprint'
      ].sort()
    );
  }
);

test(
  'SPEC-016-A B3.1: misma entrada efectiva produce deepEqual y el mismo aggregate',
  () => {
    const root = rootWithOneScenario();
    const effective = effectiveInputFor(root.scenarios[0]);

    const first = buildConstructiveAdapterInput(effective);
    const second = buildConstructiveAdapterInput(
      structuredClone(effective)
    );

    assert.deepEqual(second, first);
    assert.equal(
      second.effectiveGenerationInputSha256,
      first.effectiveGenerationInputSha256
    );
  }
);

test(
  'SPEC-016-A B3.1: orden incidental del scope queda resuelto por B2 y no cambia el aggregate',
  () => {
    const root = rootWithOneScenario();
    const source = root.scenarios[0];

    const permuted = structuredClone(source);
    permuted.scope.requirementIds.reverse();

    const a = buildConstructiveAdapterInput(
      effectiveInputFor(source)
    );
    const b = buildConstructiveAdapterInput(
      effectiveInputFor(permuted)
    );

    assert.deepEqual(b, a);
  }
);

test(
  'SPEC-016-A B3.1 reversión: scenarioId y assignmentIds del escenario duplicado cambian el aggregate',
  () => {
    const root = rootWithTwoEquivalentScenarios();

    const a = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );
    const b = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[1])
    );

    assert.notEqual(a.scenarioId, b.scenarioId);
    assert.notDeepEqual(a.assignments, b.assignments);
    assert.notEqual(
      a.effectiveGenerationInputSha256,
      b.effectiveGenerationInputSha256
    );
  }
);

test(
  'SPEC-016-A B3.1: metadata y lifecycle no consumidos no alteran freshness fingerprint',
  () => {
    const root = rootWithOneScenario();
    const source = root.scenarios[0];
    const incidental = structuredClone(source);

    incidental.metadata.name = 'Renombrado';
    incidental.metadata.description = 'Cambio no técnico';
    incidental.lifecycle = 'archived';

    const a = buildConstructiveAdapterInput(
      effectiveInputFor(source)
    );
    const b = buildConstructiveAdapterInput(
      effectiveInputFor(incidental)
    );

    assert.deepEqual(b, a);
  }
);

test(
  'SPEC-016-A B3.1: blocker todavía excluido no atraviesa B2 ni cambia el aggregate',
  () => {
    const root = rootWithOneScenario();
    const sourceScenario = root.scenarios[0];

    const changedRequirements = structuredClone(fx.requirements);
    changedRequirements.blockingDecisions[0].code =
      'SR-EXCLUDED-DIAGNOSTIC-CHANGED';

    const changedContext =
      referenceContextFor(changedRequirements);

    const before = buildConstructiveAdapterInput(
      effectiveInputFor(sourceScenario)
    );

    const after = buildConstructiveAdapterInput(
      effectiveInputFor(sourceScenario, {
        requirements: changedRequirements,
        referenceResolutionContext: changedContext
      })
    );

    assert.deepEqual(after, before);
  }
);

test(
  'SPEC-016-A B3.1 reversión: cambios efectivos en configuration, adapter o library cambian el aggregate',
  () => {
    const baseRoot = rootWithOneScenario();
    const baseScenario = baseRoot.scenarios[0];

    const base = buildConstructiveAdapterInput(
      effectiveInputFor(baseScenario)
    );

    const configurationScenario = structuredClone(baseScenario);
    configurationScenario.configuration = {
      schema: 'neutral-contract-configuration-v1.0',
      option: 'changed'
    };

    const adapterScenario = structuredClone(baseScenario);
    adapterScenario.adapterRef.adapterVersion = '1.0.1';

    const libraryScenario = structuredClone(baseScenario);
    libraryScenario.libraryRef.sha256 = SHA_B;

    const configuration = buildConstructiveAdapterInput(
      effectiveInputFor(configurationScenario)
    );

    const adapter = buildConstructiveAdapterInput(
      effectiveInputFor(adapterScenario)
    );

    const library = buildConstructiveAdapterInput(
      effectiveInputFor(libraryScenario, {
        librarySha256: SHA_B
      })
    );

    assert.notEqual(
      configuration.effectiveGenerationInputSha256,
      base.effectiveGenerationInputSha256
    );
    assert.notEqual(
      adapter.effectiveGenerationInputSha256,
      base.effectiveGenerationInputSha256
    );
    assert.notEqual(
      library.effectiveGenerationInputSha256,
      base.effectiveGenerationInputSha256
    );
  }
);

test(
  'SPEC-016-A B3.1: adapter input es puro, no muta entrada congelada y no comparte objetos mutables',
  () => {
    const root = rootWithOneScenario();
    const effective = deepFreeze(
      structuredClone(
        effectiveInputFor(root.scenarios[0])
      )
    );

    const result = buildConstructiveAdapterInput(effective);

    const originalScenarioId = effective.scenarioId;
    result.effectiveGeometry.elements[0].id = 'mutated-test-value';

    assert.equal(effective.scenarioId, originalScenarioId);
    assert.notEqual(
      effective.effectiveGeometry.elements[0].id,
      'mutated-test-value'
    );
  }
);

test(
  'SPEC-016-A B3.1: schema B2 incorrecto falla cerrado',
  () => {
    const root = rootWithOneScenario();
    const effective = effectiveInputFor(root.scenarios[0]);

    assert.throws(
      () => buildConstructiveAdapterInput({
        ...effective,
        schema: 'constructive-effective-input-v9.9'
      }),
      (error) => (
        error instanceof ConstructiveGenerationInputError
        && error.code === 'INVALID_EFFECTIVE_INPUT_SCHEMA'
      )
    );
  }
);

test(
  'SPEC-016-A B3.1: módulo puro no depende de store, UI, React, Three, Metalcon ni OSB',
  async () => {
    const source = await readFile(
      new URL(
        '../src/core/constructiveGenerationInput.js',
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
  }
);

test(
  'SPEC-016-A B3.1: availability exige adapter y biblioteca exactos',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    const result = evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [
          {
            adapterId: 'neutral-contract-adapter',
            adapterVersion: '1.0.0'
          }
        ],
        availableLibraries: [
          {
            libraryId: 'neutral-contract-library',
            libraryVersion: '1.0.0',
            sha256: SHA_A
          }
        ]
      }
    );

    assert.deepEqual(result, {
      schema: CONSTRUCTIVE_GENERATION_AVAILABILITY_SCHEMA,
      state: 'available',
      adapterAvailable: true,
      libraryAvailable: true,
      reasonCodes: []
    });
  }
);

test(
  'SPEC-016-A B3.1: adapter ausente produce unavailable sin alterar aggregate',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );
    const before = structuredClone(adapterInput);

    const result = evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [],
        availableLibraries: [
          {
            libraryId: 'neutral-contract-library',
            libraryVersion: '1.0.0',
            sha256: SHA_A
          }
        ]
      }
    );

    assert.equal(result.state, 'unavailable');
    assert.equal(result.adapterAvailable, false);
    assert.equal(result.libraryAvailable, true);
    assert.deepEqual(
      result.reasonCodes,
      ['ADAPTER_NOT_AVAILABLE']
    );
    assert.deepEqual(adapterInput, before);
  }
);

test(
  'SPEC-016-A B3.1: biblioteca ausente produce unavailable',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    const result = evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [
          {
            adapterId: 'neutral-contract-adapter',
            adapterVersion: '1.0.0'
          }
        ],
        availableLibraries: []
      }
    );

    assert.equal(result.state, 'unavailable');
    assert.equal(result.adapterAvailable, true);
    assert.equal(result.libraryAvailable, false);
    assert.deepEqual(
      result.reasonCodes,
      ['LIBRARY_NOT_AVAILABLE']
    );
  }
);

test(
  'SPEC-016-A B3.1 reversión: versión distinta de adapter no satisface disponibilidad',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    const result = evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [
          {
            adapterId: 'neutral-contract-adapter',
            adapterVersion: '1.0.1'
          }
        ],
        availableLibraries: [
          {
            libraryId: 'neutral-contract-library',
            libraryVersion: '1.0.0',
            sha256: SHA_A
          }
        ]
      }
    );

    assert.equal(result.state, 'unavailable');
    assert.equal(result.adapterAvailable, false);
  }
);

test(
  'SPEC-016-A B3.1 reversión: hash distinto de biblioteca no satisface disponibilidad',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    const result = evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [
          {
            adapterId: 'neutral-contract-adapter',
            adapterVersion: '1.0.0'
          }
        ],
        availableLibraries: [
          {
            libraryId: 'neutral-contract-library',
            libraryVersion: '1.0.0',
            sha256: SHA_B
          }
        ]
      }
    );

    assert.equal(result.state, 'unavailable');
    assert.equal(result.libraryAvailable, false);
  }
);

test(
  'SPEC-016-A B3.1: availability nunca participa del effectiveGenerationInputSha256',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    const hashBefore =
      adapterInput.effectiveGenerationInputSha256;

    evaluateConstructiveGenerationAvailability(
      adapterInput,
      {
        availableAdapters: [],
        availableLibraries: []
      }
    );

    assert.equal(
      adapterInput.effectiveGenerationInputSha256,
      hashBefore
    );
  }
);

test(
  'SPEC-016-A B3.1: contexto runtime inválido falla cerrado',
  () => {
    const root = rootWithOneScenario();
    const adapterInput = buildConstructiveAdapterInput(
      effectiveInputFor(root.scenarios[0])
    );

    assert.throws(
      () => evaluateConstructiveGenerationAvailability(
        adapterInput,
        {
          availableAdapters: [
            {
              adapterId: 'neutral-contract-adapter'
            }
          ],
          availableLibraries: []
        }
      ),
      (error) => (
        error instanceof ConstructiveGenerationInputError
        && error.code === 'INVALID_AVAILABILITY_CONTEXT'
      )
    );
  }
);


test(
  'BUG-016-A-013 BEFORE: library efectiva debe coincidir exactamente con libraryRef',
  () => {
    const root = rootWithOneScenario();
    const effective = effectiveInputFor(root.scenarios[0]);

    for (const mutate of [
      (library) => { library.libraryId = 'otra-library'; },
      (library) => { library.libraryVersion = '9.9.9'; },
      (library) => { library.sha256 = SHA_B; }
    ]) {
      const invalid = structuredClone(effective);
      mutate(invalid.library);

      assert.throws(
        () => buildConstructiveAdapterInput(invalid),
        (error) => error instanceof ConstructiveGenerationInputError
      );
    }
  }
);

test(
  'BUG-016-A-013 BEFORE: componentTypes debe ser exactamente la selección requerida por assignments',
  () => {
    const root = rootWithOneScenario();
    const effective = effectiveInputFor(root.scenarios[0]);

    const missing = structuredClone(effective);
    missing.library.componentTypes = [];

    assert.throws(
      () => buildConstructiveAdapterInput(missing),
      (error) => error instanceof ConstructiveGenerationInputError
    );

    const extra = structuredClone(effective);
    extra.library.componentTypes.push({
      componentTypeId: 'abstract-lateral-response'
    });

    assert.throws(
      () => buildConstructiveAdapterInput(extra),
      (error) => error instanceof ConstructiveGenerationInputError
    );
  }
);
