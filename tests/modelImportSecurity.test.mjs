import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { useModelStore } from '../src/store/useModelStore.js';

const casaL = JSON.parse(fs.readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'casa-L.json'),
  'utf8'
));

function validEmptyModel(extra = {}) {
  return {
    modelVersion: 1,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    ...extra
  };
}

function setKnownState() {
  const model = validEmptyModel({
    grid: {
      xAxes: [{ id: 'x1', label: '1', position: 0 }],
      yAxes: [],
      zLevels: []
    },
    elements: [{ id: 'wall-keep', type: 'wall' }]
  });
  useModelStore.setState({
    model,
    past: [],
    future: [],
    modelImportFeedback: null
  });
  return model;
}

test('importación: objeto vacío y versión futura fallan sin modificar estado', () => {
  for (const incoming of [{}, validEmptyModel({ modelVersion: 999 })]) {
    const before = setKnownState();
    const result = useModelStore.getState().loadModel(incoming);
    assert.equal(result.ok, false);
    assert.equal(useModelStore.getState().model, before, 'el commit debe ser transaccional');
    assert.equal(useModelStore.getState().modelImportFeedback.severity, 'error');
    assert.equal(typeof result.error.code, 'string');
  }
});

test('importación: JSON truncado falla con error tipado y conserva el modelo activo', () => {
  const before = setKnownState();
  const result = useModelStore.getState().importModelText('{"grid":');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_JSON');
  assert.equal(useModelStore.getState().model, before);
});

test('importación: casa-L migra desde v0 y conserva sus dos roofSystems', () => {
  const original = JSON.stringify(casaL);
  const result = useModelStore.getState().loadModel(casaL);
  const loaded = useModelStore.getState().model;

  assert.equal(result.ok, true);
  assert.equal(loaded.modelVersion, 1);
  assert.equal(loaded.roofSystems.length, 2);
  assert.equal(loaded.roofPlanes.length, 0);
  assert.equal(JSON.stringify(casaL), original, 'abrir/migrar no muta el objeto original');
  assert.equal(useModelStore.getState().modelImportFeedback.severity, 'warning');
});

test('importación: roofPlanes tiene precedencia sin destruir roofSystems', () => {
  const incoming = validEmptyModel({
    roofSystems: [{ id: 'legacy-roof' }],
    roofPlanes: [{ id: 'modern-roof', polygon: [] }]
  });
  const result = useModelStore.getState().loadModel(incoming);
  const loaded = useModelStore.getState().model;

  assert.equal(result.ok, true);
  assert.deepEqual(loaded.roofSystems, incoming.roofSystems);
  assert.deepEqual(loaded.roofPlanes, incoming.roofPlanes);
  assert.ok(result.warnings.some((warning) => warning.code === 'ROOF_SOURCE_PRECEDENCE'));
  assert.equal(useModelStore.getState().modelImportFeedback.severity, 'warning');
});

test('importación: casa-L sobrevive guardar y reabrir desde localStorage', () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };

  try {
    assert.equal(useModelStore.getState().loadModel(casaL).ok, true);
    useModelStore.getState().saveModel();
    setKnownState();
    assert.equal(useModelStore.getState().loadModel().ok, true);
    assert.equal(useModelStore.getState().model.roofSystems.length, 2);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
