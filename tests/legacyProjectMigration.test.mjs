import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_PROJECT_STORAGE_KEY,
  inspectLegacyProjectCandidates,
  removeLegacyProjectCandidate
} from '../src/core/legacyProjectMigration.js';
import {
  AUTOSAVE_KEY,
  serializeAutosave
} from '../src/core/autosave.js';

const validModel = (id) => ({
  modelVersion: 2,
  grid: { xAxes: [], yAxes: [], zLevels: [] },
  elements: [],
  wallTypes: [],
  roofSystems: [],
  persistenceProbe: id
});

function fakeStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key)
  };
}

test('SPEC-004-D: inspección legacy valida y conserva dos candidatos distintos', () => {
  const storage = fakeStorage([
    [LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(validModel('principal'))],
    [AUTOSAVE_KEY, serializeAutosave(validModel('autosave'), 42)]
  ]);

  const result = inspectLegacyProjectCandidates(storage);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.candidates.map(({ id, sourceKeys }) => ({ id, sourceKeys })),
    [
      { id: 'browser-autosave', sourceKeys: [AUTOSAVE_KEY] },
      { id: 'browser-project', sourceKeys: [LEGACY_PROJECT_STORAGE_KEY] }
    ]
  );
});

test('SPEC-004-D: copias idénticas se deduplican y consumen juntas sólo tras éxito', () => {
  const model = validModel('igual');
  const storage = fakeStorage([
    [LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(model)],
    [AUTOSAVE_KEY, serializeAutosave(model, 42)]
  ]);
  const { candidates } = inspectLegacyProjectCandidates(storage);

  assert.equal(candidates.length, 1);
  assert.deepEqual(
    candidates[0].sourceKeys.sort(),
    [AUTOSAVE_KEY, LEGACY_PROJECT_STORAGE_KEY].sort()
  );
  assert.equal(storage.values.size, 2, 'inspeccionar nunca consume');

  removeLegacyProjectCandidate(storage, candidates[0]);
  assert.equal(storage.values.size, 0);
  assert.deepEqual(inspectLegacyProjectCandidates(storage).candidates, []);
});

test('SPEC-004-D: JSON legacy corrupto queda presente y produce error visible', () => {
  const storage = fakeStorage([[LEGACY_PROJECT_STORAGE_KEY, '{"grid":']]);
  const result = inspectLegacyProjectCandidates(storage);

  assert.equal(result.candidates.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].sourceKey, LEGACY_PROJECT_STORAGE_KEY);
  assert.equal(storage.values.has(LEGACY_PROJECT_STORAGE_KEY), true);
});
