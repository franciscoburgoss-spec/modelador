import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOSAVE_KEY, serializeAutosave, parseAutosave, isEmptyModel, shouldOfferRestore,
  formatAutosaveTimestamp, writeAutosave, readAutosave, clearAutosave
} from '../src/core/autosave.js';

const emptyModel = () => ({ elements: [], grid: { xAxes: [], yAxes: [], zLevels: [] }, roofSystems: [] });
const someModel = () => ({
  elements: [{ id: 'w1', type: 'wall' }],
  grid: { xAxes: [{ id: 'x1', position: 0 }], yAxes: [], zLevels: [] },
  roofSystems: []
});

function fakeStorage({ failOnSet = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failOnSet) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k)
  };
}

test('serializeAutosave/parseAutosave: round-trip conserva modelo y timestamp', () => {
  const parsed = parseAutosave(serializeAutosave(someModel(), 1700000000000));
  assert.equal(parsed.timestamp, 1700000000000);
  assert.equal(parsed.model.elements.length, 1);
});

test('parseAutosave: nulo ante vacío, JSON corrupto o versión distinta', () => {
  assert.equal(parseAutosave(null), null);
  assert.equal(parseAutosave(''), null);
  assert.equal(parseAutosave('{no json'), null);
  assert.equal(parseAutosave(JSON.stringify({ version: 99, model: {} })), null);
  assert.equal(parseAutosave(JSON.stringify({ version: 1 })), null);
});

test('isEmptyModel: vacío solo si no hay elementos, ejes ni techumbres', () => {
  assert.equal(isEmptyModel(emptyModel()), true);
  assert.equal(isEmptyModel(null), true);
  assert.equal(isEmptyModel(someModel()), false);
  assert.equal(isEmptyModel({ ...emptyModel(), roofSystems: [{ id: 'r1' }] }), false);
});

test('shouldOfferRestore: ofrece solo con contenido real y distinto del modelo actual', () => {
  const saved = { timestamp: 1, model: someModel() };
  assert.equal(shouldOfferRestore(saved, emptyModel()), true);
  assert.equal(shouldOfferRestore(saved, someModel()), false, 'idéntico: no molestar');
  assert.equal(shouldOfferRestore({ timestamp: 1, model: emptyModel() }, emptyModel()), false);
  assert.equal(shouldOfferRestore(null, emptyModel()), false);
});

test('shouldOfferRestore: preserva roofSystems y library en la comparación', () => {
  const base = someModel();
  const saved = { timestamp: 1, model: { ...base, roofSystems: [{ id: 'r1', trussPositions: [0, 600] }] } };
  assert.equal(shouldOfferRestore(saved, base), true);
});

test('writeAutosave/readAutosave: escribe bajo AUTOSAVE_KEY y relee igual', () => {
  const st = fakeStorage();
  const res = writeAutosave(st, someModel(), 42);
  assert.equal(res.ok, true);
  assert.ok(st.map.has(AUTOSAVE_KEY));
  const back = readAutosave(st);
  assert.equal(back.timestamp, 42);
  assert.equal(back.model.elements[0].id, 'w1');
});

test('writeAutosave: quota excedida devuelve ok:false sin lanzar', () => {
  const st = fakeStorage({ failOnSet: true });
  const res = writeAutosave(st, someModel());
  assert.equal(res.ok, false);
  assert.equal(res.error.name, 'QuotaExceededError');
});

test('readAutosave/clearAutosave: tolera storage ausente y limpia la clave', () => {
  assert.equal(readAutosave(null), null);
  assert.equal(writeAutosave(null, someModel()).ok, false);
  const st = fakeStorage();
  writeAutosave(st, someModel());
  clearAutosave(st);
  assert.equal(readAutosave(st), null);
});

test('formatAutosaveTimestamp: string legible; degrada sin timestamp válido', () => {
  assert.equal(formatAutosaveTimestamp(0), 'fecha desconocida');
  assert.equal(formatAutosaveTimestamp(NaN), 'fecha desconocida');
  assert.equal(typeof formatAutosaveTimestamp(1700000000000), 'string');
  assert.ok(formatAutosaveTimestamp(1700000000000).length > 0);
});
