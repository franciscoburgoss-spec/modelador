import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  CONSTRUCTIVE_ASSIGNMENT_SCHEMA,
  CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA,
  CONSTRUCTIVE_SCENARIO_SCHEMA,
  ConstructiveScenarioError,
  assertValidConstructiveSolutions,
  assignmentIdFromOrdinal,
  canonicalizeConstructiveSolutions,
  configureConstructiveScenario,
  createConstructiveAssignment,
  createConstructiveScenario,
  createEmptyConstructiveSolutions,
  deleteConstructiveAssignment,
  deleteConstructiveScenario,
  duplicateConstructiveScenario,
  renameConstructiveScenario,
  scenarioIdFromOrdinal,
  setConstructiveScenarioLifecycle,
  updateConstructiveAssignment
} from '../src/core/constructiveSolutionScenarios.js';
import {
  CURRENT_MODEL_VERSION,
  ModelImportError,
  migrateModel,
  migrateV3ToV4,
  prepareModelImport
} from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';
import { createEmptyStructuralIntent } from '../src/core/structuralIntent.js';
import { createEmptyStructuralProposalReviewLog } from '../src/core/structuralProposalReviews.js';
import { buildFx008Rev8Short } from './helpers/spec015dRev8.mjs';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const REQUIREMENT_A = `sr-requirement:sha256:${SHA_A}`;
const REQUIREMENT_B = `sr-requirement:sha256:${SHA_B}`;
const REGION_A = `sr-region:sha256:${SHA_A}`;

function scenarioInput(name = 'Escenario A', requirementIds = [REQUIREMENT_A, REQUIREMENT_B]) {
  return {
    metadata: { name, description: 'Alternativa contractual' },
    adapterRef: { adapterId: 'neutral-contract-adapter', adapterVersion: '1.0.0' },
    libraryRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      sha256: SHA_A
    },
    configuration: { schema: 'neutral-contract-configuration-v1.0', mode: 'abstract' },
    scope: { mode: 'requirements', requirementIds }
  };
}

function assignmentInput(requirementRef = REQUIREMENT_A, parameters = { factor: 1 }) {
  return {
    requirementRef,
    targetRef: { kind: 'requirement', ref: requirementRef },
    choiceRef: {
      libraryId: 'neutral-contract-library',
      libraryVersion: '1.0.0',
      componentTypeId: 'abstract-load-transfer-response'
    },
    parameters
  };
}

function rootWithScenario() {
  return createConstructiveScenario(createEmptyConstructiveSolutions(), scenarioInput())
    .constructiveSolutions;
}

function validReceipt() {
  return {
    schema: CONSTRUCTIVE_GENERATION_RECEIPT_SCHEMA,
    effectiveGenerationInputSha256: SHA_A,
    outputCanonicalSha256: SHA_B,
    coverageAtGeneration: 'partial',
    resolvedCount: 1,
    partiallyResolvedCount: 0,
    unresolvedCount: 1,
    effectiveFingerprints: {
      effectiveGeometrySha256: SHA_A,
      effectiveStructuralRequirementsSha256: SHA_B,
      relevantBlockingDecisionContextSha256: SHA_C,
      scopeSha256: SHA_A,
      configurationSha256: SHA_B,
      assignmentsSha256: SHA_C,
      adapterFingerprint: SHA_A,
      libraryFingerprint: SHA_B
    },
    globalProvenance: {
      geometrySha256: SHA_A,
      requirementsSha256: SHA_B,
      requirementsSourceAggregateSha256: SHA_C,
      structuralIntentSha256: SHA_A,
      topologyR0R5Sha256: SHA_B
    }
  };
}

function minimalV3(overrides = {}) {
  return {
    modelVersion: 3,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    wallTypes: [],
    structuralIntent: createEmptyStructuralIntent(),
    structuralProposalReviews: createEmptyStructuralProposalReviewLog(),
    library: {},
    roofSystems: [],
    roofPlanes: [],
    ...overrides
  };
}

function assertMigrationChangesOnlyVersionAndRoot(source, migrated) {
  const {
    modelVersion: sourceVersion,
    constructiveSolutions: sourceConstructiveSolutions,
    ...sourceLegacy
  } = source;
  const {
    modelVersion: migratedVersion,
    constructiveSolutions,
    ...migratedLegacy
  } = migrated;
  assert.equal(sourceVersion, 3);
  assert.equal(sourceConstructiveSolutions, undefined);
  assert.equal(migratedVersion, 4);
  assert.deepEqual(constructiveSolutions, createEmptyConstructiveSolutions());
  assert.deepEqual(migratedLegacy, sourceLegacy);
}

function canonicalSha256(root) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeConstructiveSolutions(root)))
    .digest('hex');
}

test('SPEC-016-A B1: migración v3→v4 realiza exactamente los dos cambios contractuales', () => {
  const source = minimalV3({
    wallTypes: [{ id: 'T90', legacyProbe: true }],
    elements: [{
      id: 'W1',
      type: 'wall',
      wallTypeId: 'T90',
      studs: [{ id: 'S1' }],
      osbCourses: [{ panels: [{ width: 600 }] }],
      modulation: { spacing: 600 }
    }],
    library: { metalconProfiles: [{ id: '90CA085' }] },
    metalconDefaults: { spacing: 600 },
    osbDefaults: { panelWidth: 1220, gap: 5 },
    unknownPersistentV3Field: { preserved: ['byte', 'for', 'byte'] }
  });
  const original = structuredClone(source);
  const migrated = migrateV3ToV4(source);

  assertMigrationChangesOnlyVersionAndRoot(source, migrated);
  assert.deepEqual(source, original, 'la migración no muta su entrada');
  assert.deepEqual(migrateV3ToV4(migrated), migrated, 'la migración directa es idempotente');
});

test('BUG-016-A-001: migración directa acepta sólo v3/v4 y falla cerrada ante colisión', () => {
  const v3 = minimalV3();
  const original = structuredClone(v3);
  const v4 = migrateV3ToV4(v3);
  assertMigrationChangesOnlyVersionAndRoot(v3, v4);
  assert.deepEqual(migrateV3ToV4(v4), v4);
  assert.throws(
    () => migrateV3ToV4({ ...v3, modelVersion: 2 }),
    (error) => error.code === 'INVALID_V3_TO_V4_SOURCE_VERSION'
  );
  const colliding = { ...v3, constructiveSolutions: { legacy: 'no reinterpretar' } };
  const collisionSnapshot = structuredClone(colliding);
  assert.throws(
    () => migrateV3ToV4(colliding),
    (error) => error.code === 'V3_CONSTRUCTIVE_SOLUTIONS_COLLISION'
  );
  assert.deepEqual(colliding, collisionSnapshot);
  assert.deepEqual(v3, original);
});

test('BUG-016-A-001: IDs usan representación única con ancho mínimo seis', () => {
  assert.equal(scenarioIdFromOrdinal(999999), 'scenario:999999');
  assert.equal(scenarioIdFromOrdinal(1000000), 'scenario:1000000');
  assert.equal(assignmentIdFromOrdinal('scenario:999999', 999999), 'scenario:999999/assignment:999999');
  assert.equal(assignmentIdFromOrdinal('scenario:1000000', 1000000), 'scenario:1000000/assignment:1000000');
  assert.notEqual(scenarioIdFromOrdinal(1), 'scenario:0000001');

  const aliasedScenario = rootWithScenario();
  aliasedScenario.scenarios[0].scenarioId = 'scenario:0000001';
  assert.throws(
    () => assertValidConstructiveSolutions(aliasedScenario),
    (error) => error.details.some((issue) => issue.code === 'INVALID_SCENARIO_ID')
  );

  let aliasedAssignment = rootWithScenario();
  aliasedAssignment = createConstructiveAssignment(
    aliasedAssignment,
    'scenario:000001',
    assignmentInput()
  ).constructiveSolutions;
  aliasedAssignment.scenarios[0].assignments[0].assignmentId = 'scenario:000001/assignment:0000001';
  assert.throws(
    () => assertValidConstructiveSolutions(aliasedAssignment),
    (error) => error.details.some((issue) => issue.code === 'INVALID_ASSIGNMENT_ID')
  );
});

test('SPEC-016-A B1: FX-008 REV8 completo conserva profundamente todo legacy, interfaces y relaciones', async () => {
  const { model: source } = await buildFx008Rev8Short();
  assert.equal(source.modelVersion, 3);
  assert.ok(source.structuralIntent.interfaceIntents.length > 0);
  assert.ok(source.structuralIntent.relationIntents.length > 0);
  const original = structuredClone(source);
  const migrated = migrateV3ToV4(source);

  assertMigrationChangesOnlyVersionAndRoot(source, migrated);
  for (const field of [
    'wallTypes',
    'elements',
    'library',
    'metalconDefaults',
    'osbDefaults',
    'structuralIntent',
    'structuralProposalReviews',
    'grid',
    'projectParams',
    'roofSystems',
    'roofPlanes'
  ]) assert.deepEqual(migrated[field], source[field], `se preserva ${field}`);
  assert.deepEqual(migrated.structuralIntent.interfaceIntents, source.structuralIntent.interfaceIntents);
  assert.deepEqual(migrated.structuralIntent.relationIntents, source.structuralIntent.relationIntents);
  assert.deepEqual(source, original);
});

test('SPEC-016-A B1: cadena completa es secuencial, determinista e idempotente hasta v4', () => {
  const source = minimalV3();
  const first = migrateModel(source);
  const second = migrateModel(first.model);
  assert.equal(CURRENT_MODEL_VERSION, 4);
  assert.deepEqual(first.appliedMigrations, ['3->4']);
  assert.deepEqual(second.appliedMigrations, []);
  assert.deepEqual(second.model, first.model);
  assert.deepEqual(migrateV3ToV4(source), migrateV3ToV4(structuredClone(source)));
});

test('SPEC-016-A B1: serialización y reapertura v4 conservan el contrato canónico', () => {
  let root = rootWithScenario();
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput()).constructiveSolutions;
  const source = prepareModelImport({ ...minimalV3(), modelVersion: 4, constructiveSolutions: root }).model;
  const serialized = serializeNativeProject(source);
  const reopened = prepareModelImport(JSON.parse(serialized));
  assert.deepEqual(reopened.appliedMigrations, []);
  assert.deepEqual(reopened.model, source);
});

test('SPEC-016-A B1: schema raíz, IDs duplicados y allocators incoherentes se rechazan', () => {
  const root = rootWithScenario();
  const invalidRoots = [
    { ...root, schema: 'wrong' },
    { ...root, scenarios: [...root.scenarios, structuredClone(root.scenarios[0])], nextScenarioOrdinal: 2 },
    { ...root, nextScenarioOrdinal: 1 },
    {
      ...root,
      scenarios: [{ ...root.scenarios[0], nextAssignmentOrdinal: 1, assignments: [
        {
          schema: CONSTRUCTIVE_ASSIGNMENT_SCHEMA,
          assignmentId: 'scenario:000001/assignment:000001',
          ...assignmentInput()
        }
      ] }]
    }
  ];
  for (const candidate of invalidRoots) {
    assert.throws(() => assertValidConstructiveSolutions(candidate), ConstructiveScenarioError);
  }
});

test('SPEC-016-A B1: scenarioId y assignmentId duplicados se rechazan explícitamente', () => {
  let root = rootWithScenario();
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput()).constructiveSolutions;
  const duplicateAssignment = {
    ...root,
    scenarios: [{
      ...root.scenarios[0],
      assignments: [...root.scenarios[0].assignments, structuredClone(root.scenarios[0].assignments[0])]
    }]
  };
  assert.throws(
    () => assertValidConstructiveSolutions(duplicateAssignment),
    (error) => error.details.some((issue) => issue.code === 'DUPLICATE_ASSIGNMENT_ID')
  );
  const duplicateScenario = {
    ...root,
    scenarios: [...root.scenarios, structuredClone(root.scenarios[0])]
  };
  assert.throws(
    () => assertValidConstructiveSolutions(duplicateScenario),
    (error) => error.details.some((issue) => issue.code === 'DUPLICATE_SCENARIO_ID')
  );
});

test('SPEC-016-A B1: crear escenarios consume ordinals consecutivos y eliminar no reutiliza', () => {
  const first = createConstructiveScenario(createEmptyConstructiveSolutions(), scenarioInput('A'));
  const second = createConstructiveScenario(first.constructiveSolutions, scenarioInput('B'));
  const deleted = deleteConstructiveScenario(second.constructiveSolutions, 'scenario:000001');
  const third = createConstructiveScenario(deleted.constructiveSolutions, scenarioInput('C'));

  assert.equal(first.scenario.scenarioId, 'scenario:000001');
  assert.equal(second.scenario.scenarioId, 'scenario:000002');
  assert.equal(third.scenario.scenarioId, 'scenario:000003');
  assert.equal(third.constructiveSolutions.nextScenarioOrdinal, 4);
});

test('SPEC-016-A B1: duplicar reescribe assignments, limpia receipt y aísla profundamente', () => {
  let root = rootWithScenario();
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput()).constructiveSolutions;
  root = createConstructiveAssignment(
    root,
    'scenario:000001',
    assignmentInput(REQUIREMENT_B, { nested: { value: 2 } })
  ).constructiveSolutions;
  root = canonicalizeConstructiveSolutions({
    ...root,
    scenarios: [{ ...root.scenarios[0], lastGeneration: validReceipt() }]
  });
  const duplicated = duplicateConstructiveScenario(root, 'scenario:000001', { name: 'Copia' });
  const copy = duplicated.scenario;

  assert.equal(copy.scenarioId, 'scenario:000002');
  assert.deepEqual(copy.assignments.map((item) => item.assignmentId), [
    'scenario:000002/assignment:000001',
    'scenario:000002/assignment:000002'
  ]);
  assert.equal(copy.nextAssignmentOrdinal, 3);
  assert.equal(copy.lastGeneration, null);
  assert.deepEqual(
    copy.assignments.map(({ assignmentId: _id, ...item }) => item),
    root.scenarios[0].assignments.map(({ assignmentId: _id, ...item }) => item)
  );

  copy.assignments[1].parameters.nested.value = 99;
  assert.equal(root.scenarios[0].assignments[1].parameters.nested.value, 2);
  assert.equal(duplicated.constructiveSolutions.scenarios[0].assignments[1].parameters.nested.value, 2);
});

test('SPEC-016-A B1: rename, configuración y lifecycle conservan identidad y detectan no-op', () => {
  const root = rootWithScenario();
  const renamed = renameConstructiveScenario(root, 'scenario:000001', 'Renombrado');
  assert.equal(renamed.scenario.scenarioId, 'scenario:000001');
  assert.equal(renamed.changed, true);
  const renameNoop = renameConstructiveScenario(renamed.constructiveSolutions, 'scenario:000001', 'Renombrado');
  assert.equal(renameNoop.changed, false);

  const configured = configureConstructiveScenario(renameNoop.constructiveSolutions, 'scenario:000001', {
    configuration: { mode: 'abstract', schema: 'neutral-contract-configuration-v1.0' }
  });
  assert.equal(configured.changed, false, 'orden de claves incidental es no-op');
  const archived = setConstructiveScenarioLifecycle(configured.constructiveSolutions, 'scenario:000001', 'archived');
  const unarchived = setConstructiveScenarioLifecycle(archived.constructiveSolutions, 'scenario:000001', 'active');
  assert.equal(archived.scenario.scenarioId, 'scenario:000001');
  assert.equal(unarchived.scenario.scenarioId, 'scenario:000001');
  assert.equal(setConstructiveScenarioLifecycle(unarchived.constructiveSolutions, 'scenario:000001', 'active').changed, false);
});

test('SPEC-016-A B1: assignment válido consume allocator, actualiza con no-op y no reutiliza al eliminar', () => {
  let root = rootWithScenario();
  const first = createConstructiveAssignment(root, 'scenario:000001', assignmentInput());
  root = first.constructiveSolutions;
  assert.equal(first.assignment.assignmentId, 'scenario:000001/assignment:000001');
  assert.equal(root.scenarios[0].nextAssignmentOrdinal, 2);

  const duplicateNoop = createConstructiveAssignment(root, 'scenario:000001', assignmentInput());
  assert.equal(duplicateNoop.changed, false);
  assert.equal(duplicateNoop.assignment.assignmentId, 'scenario:000001/assignment:000001');
  assert.equal(duplicateNoop.constructiveSolutions.scenarios[0].nextAssignmentOrdinal, 2);

  const noop = updateConstructiveAssignment(root, 'scenario:000001', first.assignment.assignmentId, {
    parameters: { factor: 1 }
  });
  assert.equal(noop.changed, false);
  root = deleteConstructiveAssignment(noop.constructiveSolutions, 'scenario:000001', first.assignment.assignmentId)
    .constructiveSolutions;
  const second = createConstructiveAssignment(root, 'scenario:000001', assignmentInput());
  assert.equal(second.assignment.assignmentId, 'scenario:000001/assignment:000002');
});

test('SPEC-016-A B1: un escenario archivado se inspecciona pero no se edita', () => {
  const archived = setConstructiveScenarioLifecycle(
    rootWithScenario(),
    'scenario:000001',
    'archived'
  ).constructiveSolutions;
  for (const operation of [
    () => renameConstructiveScenario(archived, 'scenario:000001', 'No permitido'),
    () => configureConstructiveScenario(archived, 'scenario:000001', {
      configuration: { schema: 'neutral-contract-configuration-v1.0' }
    }),
    () => createConstructiveAssignment(archived, 'scenario:000001', assignmentInput())
  ]) {
    assert.throws(operation, (error) => error.code === 'SCENARIO_ARCHIVED');
  }
  assert.doesNotThrow(() => duplicateConstructiveScenario(
    archived,
    'scenario:000001',
    { name: 'Copia activa' }
  ));
  assert.doesNotThrow(() => deleteConstructiveScenario(archived, 'scenario:000001'));
});

test('SPEC-016-A B1: assignments inválidos por schema, requirement, target y library se rechazan', () => {
  const root = rootWithScenario();
  const cases = [
    assignmentInput(`sr-requirement:sha256:${SHA_C}`),
    { ...assignmentInput(), targetRef: { kind: 'requirement', ref: REQUIREMENT_B } },
    { ...assignmentInput(), targetRef: { kind: 'region', ref: 'region:invalid' } },
    {
      ...assignmentInput(),
      choiceRef: { ...assignmentInput().choiceRef, libraryVersion: '2.0.0' }
    }
  ];
  for (const input of cases) {
    assert.throws(
      () => createConstructiveAssignment(root, 'scenario:000001', input),
      ConstructiveScenarioError
    );
  }

  const validRegionTarget = {
    ...assignmentInput(),
    targetRef: { kind: 'region', ref: REGION_A }
  };
  assert.doesNotThrow(() => createConstructiveAssignment(root, 'scenario:000001', validRegionTarget));

  const withAssignment = createConstructiveAssignment(root, 'scenario:000001', assignmentInput())
    .constructiveSolutions;
  const invalidSchema = structuredClone(withAssignment);
  invalidSchema.scenarios[0].assignments[0].schema = 'invalid';
  assert.throws(
    () => assertValidConstructiveSolutions(invalidSchema),
    (error) => error.details.some((issue) => issue.code === 'INVALID_ASSIGNMENT_SCHEMA')
  );
});

test('SPEC-016-A B1: configuración/parameters no finitos y schemas incompletos se rechazan', () => {
  assert.throws(
    () => createConstructiveScenario(
      createEmptyConstructiveSolutions(),
      { ...scenarioInput(), configuration: { schema: 'config-v1', factor: Infinity } }
    ),
    ConstructiveScenarioError
  );
  assert.throws(
    () => createConstructiveAssignment(rootWithScenario(), 'scenario:000001', assignmentInput(REQUIREMENT_A, { factor: NaN })),
    ConstructiveScenarioError
  );
  assert.throws(
    () => createConstructiveScenario(
      createEmptyConstructiveSolutions(),
      { ...scenarioInput(), configuration: {} }
    ),
    ConstructiveScenarioError
  );
});

test('SPEC-016-A B1: canonicalización elimina orden incidental sin alterar semántica', () => {
  const scopeBA = createConstructiveScenario(
    createEmptyConstructiveSolutions(),
    scenarioInput('Scope equivalente', [REQUIREMENT_B, REQUIREMENT_A])
  ).constructiveSolutions;
  const scopeAB = createConstructiveScenario(
    createEmptyConstructiveSolutions(),
    scenarioInput('Scope equivalente', [REQUIREMENT_A, REQUIREMENT_B])
  ).constructiveSolutions;
  const canonicalScopeBA = canonicalizeConstructiveSolutions(scopeBA);
  const canonicalScopeAB = canonicalizeConstructiveSolutions(scopeAB);
  assert.deepEqual(
    canonicalScopeBA.scenarios[0].scope.requirementIds,
    [REQUIREMENT_A, REQUIREMENT_B],
    'el scope [B, A] es válido y canonicaliza a [A, B]'
  );
  assert.deepEqual(
    canonicalScopeAB.scenarios[0].scope.requirementIds,
    [REQUIREMENT_A, REQUIREMENT_B],
    'el scope [A, B] permanece [A, B]'
  );
  assert.deepEqual(canonicalScopeBA, canonicalScopeAB);

  let root = createConstructiveScenario(createEmptyConstructiveSolutions(), scenarioInput('A')).constructiveSolutions;
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput(REQUIREMENT_A, { z: 1, a: 2 })).constructiveSolutions;
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput(REQUIREMENT_B, { b: 1, a: 2 })).constructiveSolutions;
  root = createConstructiveScenario(root, scenarioInput('B')).constructiveSolutions;

  const permuted = structuredClone(root);
  permuted.scenarios.reverse();
  const first = permuted.scenarios.find((item) => item.scenarioId === 'scenario:000001');
  first.assignments.reverse();
  first.scope.requirementIds.reverse();
  first.configuration = { mode: first.configuration.mode, schema: first.configuration.schema };

  assert.deepEqual(
    canonicalizeConstructiveSolutions(permuted),
    canonicalizeConstructiveSolutions(root)
  );
});

test('BUG-016-A-001: canonicalización ordena escenarios y assignments por ordinal numérico', () => {
  let scenariosRoot = { ...createEmptyConstructiveSolutions(), nextScenarioOrdinal: 999998 };
  for (const ordinal of [999998, 999999, 1000000, 1000001]) {
    const created = createConstructiveScenario(scenariosRoot, scenarioInput(`Escenario ${ordinal}`));
    assert.equal(created.scenario.scenarioId, scenarioIdFromOrdinal(ordinal));
    scenariosRoot = created.constructiveSolutions;
  }
  const scenariosPermuted = structuredClone(scenariosRoot);
  scenariosPermuted.scenarios.reverse();
  assert.deepEqual(
    canonicalizeConstructiveSolutions(scenariosPermuted).scenarios.map((item) => item.scenarioId),
    [999998, 999999, 1000000, 1000001].map(scenarioIdFromOrdinal)
  );
  assert.equal(canonicalSha256(scenariosPermuted), canonicalSha256(scenariosRoot));

  let assignmentsRoot = rootWithScenario();
  assignmentsRoot.scenarios[0].nextAssignmentOrdinal = 999998;
  for (const ordinal of [999998, 999999, 1000000, 1000001]) {
    const created = createConstructiveAssignment(
      assignmentsRoot,
      'scenario:000001',
      assignmentInput(REQUIREMENT_A, { ordinal })
    );
    assert.equal(created.assignment.assignmentId, assignmentIdFromOrdinal('scenario:000001', ordinal));
    assignmentsRoot = created.constructiveSolutions;
  }
  const assignmentsPermuted = structuredClone(assignmentsRoot);
  assignmentsPermuted.scenarios[0].assignments.reverse();
  assert.deepEqual(
    canonicalizeConstructiveSolutions(assignmentsPermuted).scenarios[0].assignments
      .map((item) => item.assignmentId),
    [999998, 999999, 1000000, 1000001]
      .map((ordinal) => assignmentIdFromOrdinal('scenario:000001', ordinal))
  );
  assert.equal(canonicalSha256(assignmentsPermuted), canonicalSha256(assignmentsRoot));
});

test('BUG-016-A-001: reapertura rechaza assignments persistidos semánticamente duplicados', () => {
  let root = rootWithScenario();
  root = createConstructiveAssignment(root, 'scenario:000001', assignmentInput()).constructiveSolutions;
  const duplicate = {
    ...structuredClone(root.scenarios[0].assignments[0]),
    assignmentId: 'scenario:000001/assignment:000002'
  };
  const persisted = structuredClone(root);
  persisted.scenarios[0].assignments.push(duplicate);
  persisted.scenarios[0].nextAssignmentOrdinal = 3;

  assert.throws(
    () => assertValidConstructiveSolutions(persisted),
    (error) => error.details.some((issue) => issue.code === 'DUPLICATE_SEMANTIC_ASSIGNMENT')
  );
  assert.throws(
    () => prepareModelImport({ ...minimalV3(), modelVersion: 4, constructiveSolutions: persisted }),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => issue.code === 'DUPLICATE_SEMANTIC_ASSIGNMENT')
  );
});

test('SPEC-016-A B1: model schema incorpora y rechaza constructiveSolutions inválido', () => {
  const valid = { ...minimalV3(), modelVersion: 4, constructiveSolutions: createEmptyConstructiveSolutions() };
  assert.doesNotThrow(() => prepareModelImport(valid));
  assert.throws(
    () => prepareModelImport({ ...valid, constructiveSolutions: { schema: 'bad', scenarios: [] } }),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => issue.path.startsWith('constructiveSolutions'))
  );
});

test('SPEC-016-A B1 reversión: tocar cualquier campo legacy rompe la prueba de pérdida cero', () => {
  const source = minimalV3({
    wallTypes: [{ id: 'legacy-type' }],
    structuralIntent: createEmptyStructuralIntent(),
    legacyProbe: { nested: ['preserve'] }
  });
  const correct = migrateV3ToV4(source);
  assert.doesNotThrow(() => assertMigrationChangesOnlyVersionAndRoot(source, correct));

  const revertedGuard = {
    ...correct,
    wallTypes: [],
    legacyProbe: { nested: ['changed'] }
  };
  assert.throws(
    () => assertMigrationChangesOnlyVersionAndRoot(source, revertedGuard),
    assert.AssertionError
  );
});

test('SPEC-016-A B1: contratos no dependen de React, UI, Three, Metalcon, OSB ni adapters', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => (
    readFile(new URL('../src/core/constructiveSolutionScenarios.js', import.meta.url), 'utf8')
  ));
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1].toLowerCase());
  for (const forbidden of ['react', 'three', '/components/', '/store/', 'metalcon', 'osb', 'adapter.js']) {
    assert.equal(imports.some((entry) => entry.includes(forbidden)), false, `sin dependencia ${forbidden}`);
  }
  assert.match(source, /CONSTRUCTIVE_SCENARIO_SCHEMA/);
  assert.equal(CONSTRUCTIVE_SCENARIO_SCHEMA, 'constructive-solution-scenario-v1.0');
});
