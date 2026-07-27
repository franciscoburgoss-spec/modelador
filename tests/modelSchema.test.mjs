import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CURRENT_MODEL_VERSION, ModelImportError, migrateModel, parseModelJson,
  prepareModelImport
} from '../src/core/modelSchema.js';

function fixture(name) {
  return JSON.parse(fs.readFileSync(
    path.join(import.meta.dirname, 'fixtures', name),
    'utf8'
  ));
}

test('migración v0→v1 es secuencial, pura e idempotente', () => {
  const v0 = fixture('model-v0.json');
  const original = JSON.stringify(v0);
  const first = migrateModel(v0);
  const second = migrateModel(first.model);

  assert.equal(first.model.modelVersion, CURRENT_MODEL_VERSION);
  assert.deepEqual(first.appliedMigrations, ['0->1']);
  assert.equal(first.model.roofSystems.length, 1);
  assert.equal(JSON.stringify(v0), original, 'la migración no muta la entrada');
  assert.deepEqual(second.model, first.model);
  assert.deepEqual(second.appliedMigrations, []);
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

test('parser JSON tipa archivos truncados', () => {
  assert.throws(
    () => parseModelJson('{"grid":'),
    (error) => error instanceof ModelImportError && error.code === 'INVALID_JSON'
  );
});
