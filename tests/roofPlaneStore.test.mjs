// tests/roofPlaneStore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';

function reset() {
  useModelStore.setState(useModelStore.getState(), true);
}

test('addRoofPlane agrega un faldón con id y lo selecciona', () => {
  const { addRoofPlane } = useModelStore.getState();
  const before = useModelStore.getState().model.roofPlanes?.length || 0;
  addRoofPlane({ canalWallId: 1, polygon: [{ x: 0, y: 0 }] });
  const m = useModelStore.getState().model;
  assert.equal(m.roofPlanes.length, before + 1);
  const added = m.roofPlanes[m.roofPlanes.length - 1];
  assert.ok(added.id, 'tiene id generado');
  assert.equal(m.selectedRoofPlaneId, added.id);
  assert.equal(m.selectedElementId, null);
});

test('updateRoofPlane parchea sin tocar otros', () => {
  const { addRoofPlane, updateRoofPlane } = useModelStore.getState();
  addRoofPlane({ canalWallId: 2, trussSpacing: 1200 });
  const id = useModelStore.getState().model.selectedRoofPlaneId;
  updateRoofPlane(id, { trussSpacing: 1000 });
  const p = useModelStore.getState().model.roofPlanes.find(x => x.id === id);
  assert.equal(p.trussSpacing, 1000);
  assert.equal(p.canalWallId, 2, 'no borró otros campos');
});

test('removeRoofPlane elimina y limpia selección', () => {
  const { addRoofPlane, removeRoofPlane } = useModelStore.getState();
  addRoofPlane({ canalWallId: 3 });
  const id = useModelStore.getState().model.selectedRoofPlaneId;
  removeRoofPlane(id);
  const m = useModelStore.getState().model;
  assert.equal(m.roofPlanes.find(x => x.id === id), undefined);
  assert.equal(m.selectedRoofPlaneId, null);
});

test('loadModel con roofSystems legacy marca aviso y no los carga', () => {
  const { loadModel } = useModelStore.getState();
  loadModel({
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    roofSystems: [{ id: 999, wallLowId: 1, wallHighId: 2 }]
  });
  const m = useModelStore.getState().model;
  assert.equal(m.roofSystems.length, 0, 'no carga la techumbre vieja');
  assert.equal(m._legacyRoofSystemsDetected, true, 'marca el aviso');
});

test('dismissLegacyRoofWarning apaga el aviso', () => {
  const { loadModel, dismissLegacyRoofWarning } = useModelStore.getState();
  loadModel({ grid: { xAxes: [], yAxes: [], zLevels: [] }, elements: [], roofSystems: [{ id: 1 }] });
  assert.equal(useModelStore.getState().model._legacyRoofSystemsDetected, true);
  dismissLegacyRoofWarning();
  assert.equal(useModelStore.getState().model._legacyRoofSystemsDetected, false);
});

test('loadModel sin roofSystems no marca aviso', () => {
  const { loadModel } = useModelStore.getState();
  loadModel({ grid: { xAxes: [], yAxes: [], zLevels: [] }, elements: [] });
  assert.equal(useModelStore.getState().model._legacyRoofSystemsDetected, false);
});

// ★ B4.7.4c — edición/selección del faldón desde el lienzo
test('startEditRoofPlane / cancelEditRoofPlane manejan el modo edición del modal', () => {
  const { startEditRoofPlane, cancelEditRoofPlane } = useModelStore.getState();
  startEditRoofPlane('P1');
  assert.equal(useModelStore.getState().editingRoofPlaneId, 'P1');
  cancelEditRoofPlane();
  assert.equal(useModelStore.getState().editingRoofPlaneId, null);
});

test('updateRoofPlane aplica el patch al faldón', () => {
  const { addRoofPlane, updateRoofPlane } = useModelStore.getState();
  addRoofPlane({ canalWallId: 1, trussSpacing: 1200, polygon: [{ x: 0, y: 0 }] });
  const id = useModelStore.getState().model.selectedRoofPlaneId;
  updateRoofPlane(id, { trussSpacing: 1000 });
  const p = useModelStore.getState().model.roofPlanes.find(r => r.id === id);
  assert.equal(p.trussSpacing, 1000);
});

test('selectElement limpia selectedRoofPlaneId (selecciones mutuamente excluyentes)', () => {
  const { addRoofPlane, selectElement } = useModelStore.getState();
  addRoofPlane({ canalWallId: 1, polygon: [{ x: 0, y: 0 }] });
  assert.ok(useModelStore.getState().model.selectedRoofPlaneId);
  selectElement(99);
  assert.equal(useModelStore.getState().model.selectedRoofPlaneId, null);
  assert.equal(useModelStore.getState().model.selectedElementId, 99);
});
