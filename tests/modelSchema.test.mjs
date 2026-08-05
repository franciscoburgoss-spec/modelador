import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CURRENT_MODEL_VERSION, ModelImportError, migrateModel, parseModelJson,
  prepareModelImport
} from '../src/core/modelSchema.js';
import { createEmptyStructuralIntent } from '../src/core/structuralIntent.js';

function fixture(name) {
  return JSON.parse(fs.readFileSync(
    path.join(import.meta.dirname, 'fixtures', name),
    'utf8'
  ));
}

test('R5-A: migración v0→v1→v2→v3 es secuencial, pura e idempotente', () => {
  const v0 = fixture('model-v0.json');
  const original = JSON.stringify(v0);
  const first = migrateModel(v0);
  const second = migrateModel(first.model);

  assert.equal(first.model.modelVersion, CURRENT_MODEL_VERSION);
  assert.deepEqual(first.appliedMigrations, ['0->1', '1->2', '2->3']);
  assert.equal(first.model.roofSystems.length, 1);
  assert.deepEqual(first.model.wallTypes, []);
  assert.deepEqual(first.model.structuralIntent, createEmptyStructuralIntent());
  assert.equal(Object.hasOwn(first.model.elements[0], 'wallTypeId'), false);
  assert.equal(Object.hasOwn(first.model.elements[0], 'role'), false);
  assert.equal(JSON.stringify(v0), original, 'la migración no muta la entrada');
  assert.deepEqual(second.model, first.model);
  assert.deepEqual(second.appliedMigrations, []);
});

test('R5-A: fixture v1 conserva defaults, overrides y derivados sin inferir tipo ni rol', () => {
  const v1 = fixture('model-v1-wall-defaults.json');
  const original = structuredClone(v1);
  const result = migrateModel(v1);

  assert.deepEqual(result.appliedMigrations, ['1->2', '2->3']);
  assert.equal(result.model.modelVersion, 3);
  assert.deepEqual(result.model.structuralIntent, createEmptyStructuralIntent());
  assert.deepEqual(result.model.wallTypes, []);
  assert.deepEqual(result.model.metalconDefaults, original.metalconDefaults);
  assert.deepEqual(result.model.osbDefaults, original.osbDefaults);
  assert.deepEqual(result.model.elements, original.elements);
  assert.ok(result.model.elements.every((wall) => !Object.hasOwn(wall, 'wallTypeId')));
  assert.ok(result.model.elements.every((wall) => !Object.hasOwn(wall, 'role')));
  assert.deepEqual(v1, original, 'la migración no muta el fixture v1');

  const reopened = prepareModelImport(JSON.parse(JSON.stringify(result.model)));
  assert.deepEqual(reopened.model, result.model);
  assert.deepEqual(reopened.appliedMigrations, []);
});

test('fixture v1 conserva ambas fuentes y declara precedencia mediante warning tipado', () => {
  const v1 = fixture('model-v1-dual-roof.json');
  const result = prepareModelImport(v1);
  assert.deepEqual(result.model.roofSystems, v1.roofSystems);
  assert.deepEqual(result.model.roofPlanes, v1.roofPlanes);
  assert.ok(result.warnings.some((warning) => warning.code === 'ROOF_SOURCE_PRECEDENCE'));
});

test('esquema rechaza {}, duplicados, referencias de nivel rotas y versiones futuras', () => {
  const invalidModels = [
    {},
    {
      modelVersion: 1,
      grid: {
        xAxes: [{ id: 'x', position: 0 }, { id: 'x', position: 10 }],
        yAxes: [],
        zLevels: []
      },
      elements: []
    },
    {
      modelVersion: 1,
      grid: { xAxes: [], yAxes: [], zLevels: [] },
      elements: [],
      currentZLevelId: 'missing'
    },
    {
      modelVersion: 999,
      grid: { xAxes: [], yAxes: [], zLevels: [] },
      elements: []
    }
  ];

  for (const model of invalidModels) {
    assert.throws(
      () => prepareModelImport(model),
      (error) => error instanceof ModelImportError && typeof error.code === 'string'
    );
  }
});

test('R5-A: esquema v2 valida wallTypes, perfiles y referencias de muro', () => {
  const base = {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [{ id: 'W1', type: 'wall', wallTypeId: 'T1' }],
    wallTypes: [{
      id: 'T1',
      name: 'Exterior',
      role: 'MP1',
      metalconDefaults: {
        spacing: 600,
        studProfileId: 'C90',
        trackProfileId: 'U90',
        materialId: null
      },
      osbDefaults: {
        panelWidth: 1220,
        panelHeight: 2440,
        minPanelWidth: 200,
        gap: 5
      }
    }],
    library: {
      metalconProfiles: [
        { id: 'C90', shape: 'C' },
        { id: 'U90', shape: 'U' }
      ]
    },
    roofSystems: [],
    roofPlanes: []
  };

  assert.doesNotThrow(() => prepareModelImport(base));
  assert.throws(
    () => prepareModelImport({
      ...base,
      elements: [{ ...base.elements[0], wallTypeId: 'missing' }]
    }),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => issue.code === 'BROKEN_WALL_TYPE_REFERENCE')
  );
  assert.throws(
    () => prepareModelImport({
      ...base,
      elements: [{ ...base.elements[0], role: 'MP1' }]
    }),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => issue.code === 'FORBIDDEN_WALL_ROLE')
  );
  assert.throws(
    () => prepareModelImport({
      ...base,
      wallTypes: [{ ...base.wallTypes[0], role: 'mp1' }]
    }),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => issue.code === 'INVALID_WALL_TYPE')
  );
  const { wallTypes: _wallTypes, ...withoutWallTypes } = base;
  assert.throws(
    () => prepareModelImport(withoutWallTypes),
    (error) => error instanceof ModelImportError
      && error.details.some((issue) => (
        issue.path === 'wallTypes' && issue.code === 'EXPECTED_ARRAY'
      ))
  );
});

test('parser JSON tipa archivos truncados', () => {
  assert.throws(
    () => parseModelJson('{"grid":'),
    (error) => error instanceof ModelImportError && error.code === 'INVALID_JSON'
  );
});
