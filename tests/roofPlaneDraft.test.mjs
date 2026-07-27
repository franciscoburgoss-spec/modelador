// tests/roofPlaneDraft.test.mjs
// ★ B4.7.4a — Dibujo del polígono del faldón: reducers de estado transitorio (store) + helper de
// cierre por proximidad al primer vértice (render puro). Sin canvas real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';
import { isNearFirstVertex } from '../src/render/roofPlaneDraft.js';

function draft() { return useModelStore.getState().roofPlaneDraft; }

test('startRoofPlaneDraft activa el dibujo vacío', () => {
  useModelStore.getState().startRoofPlaneDraft();
  assert.deepEqual(draft(), { active: true, closed: false, vertices: [] });
});

test('addRoofPlaneDraftVertex agrega vértices; se ignora si no está activo', () => {
  useModelStore.getState().startRoofPlaneDraft();
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 0, y: 0 });
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 3000, y: 0 });
  assert.equal(draft().vertices.length, 2);
  useModelStore.getState().cancelRoofPlaneDraft();
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 1, y: 1 }); // inactivo → no-op
  assert.equal(draft().vertices.length, 0);
});

test('undoRoofPlaneDraftVertex quita el último', () => {
  useModelStore.getState().startRoofPlaneDraft();
  for (const p of [[0, 0], [3000, 0], [3000, 2000]]) useModelStore.getState().addRoofPlaneDraftVertex({ x: p[0], y: p[1] });
  useModelStore.getState().undoRoofPlaneDraftVertex();
  assert.equal(draft().vertices.length, 2);
});

test('closeRoofPlaneDraft: <3 vértices no cierra; ≥3 cierra y conserva el polígono', () => {
  useModelStore.getState().startRoofPlaneDraft();
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 0, y: 0 });
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 3000, y: 0 });
  useModelStore.getState().closeRoofPlaneDraft();
  assert.equal(draft().closed, false, 'con 2 vértices no cierra');
  assert.equal(draft().active, true);
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 3000, y: 2000 });
  useModelStore.getState().closeRoofPlaneDraft();
  assert.equal(draft().closed, true, 'con 3 vértices cierra');
  assert.equal(draft().active, false, 'deja de capturar clics');
  assert.equal(draft().vertices.length, 3, 'conserva el polígono para el modal');
});

test('cancelRoofPlaneDraft resetea a vacío', () => {
  useModelStore.getState().startRoofPlaneDraft();
  useModelStore.getState().addRoofPlaneDraftVertex({ x: 0, y: 0 });
  useModelStore.getState().cancelRoofPlaneDraft();
  assert.deepEqual(draft(), { active: false, closed: false, vertices: [] });
});

test('isNearFirstVertex: true solo con ≥3 vértices y cursor sobre el primero', () => {
  const view = { scale: 1, offsetX: 0, offsetY: 0 };
  const canvasH = 1000;
  const d3 = { vertices: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 300 }] };
  // pantalla del primer vértice (misma proyección que usa el helper)
  const near = isNearFirstVertex(d3, screenOfFirst(d3, view, canvasH), view, canvasH);
  assert.equal(near, true);
  const far = isNearFirstVertex(d3, { x: 9999, y: 9999 }, view, canvasH);
  assert.equal(far, false);
  const d2 = { vertices: [{ x: 100, y: 100 }, { x: 400, y: 100 }] };
  assert.equal(isNearFirstVertex(d2, screenOfFirst(d2, view, canvasH), view, canvasH), false, '<3 vértices no cierra');
});

// proyecta el primer vértice a pantalla con la misma fórmula de projection.js (plan: h=x, v=y,
// flipY=false → sy = (v - offsetY)*scale). Evita depender de internals: reusa projectPlane.
import { projectPlane } from '../src/core/projection.js';
function screenOfFirst(d, view, canvasH) {
  const p = projectPlane(d.vertices[0].x, d.vertices[0].y, 'plan', view, canvasH);
  return { x: p.x, y: p.y };
}
