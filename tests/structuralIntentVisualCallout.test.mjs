import test from 'node:test';
import assert from 'node:assert/strict';
import { structuralIntentMarkLayout } from '../src/core/structuralIntentVisualCallout.js';

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function polygonBounds(polygon) {
  const xMin = Math.min(...polygon.map((point) => point.x));
  const xMax = Math.max(...polygon.map((point) => point.x));
  const yMin = Math.min(...polygon.map((point) => point.y));
  const yMax = Math.max(...polygon.map((point) => point.y));
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
}

test('BUG-015-D-032: una cara corta desplaza la marca fuera del polígono y agrega líder', () => {
  const polygon = [
    { x: 104, y: 95 }, { x: 110, y: 95 }, { x: 110, y: 105 }, { x: 104, y: 105 }
  ];
  const layout = structuralIntentMarkLayout({
    polygon,
    faceSegment: [{ x: 104, y: 95 }, { x: 104, y: 105 }],
    textWidth: 16,
    interfaceKind: 'face'
  });
  assert.equal(layout.callout, true);
  assert.ok(layout.leader);
  assert.ok(layout.anchor.x > 110, 'la llamada debe salir hacia el exterior físico de la cara');
  assert.equal(intersects(layout.box, polygonBounds(polygon)), false, 'la etiqueta no debe tapar la selección corta');
  assert.ok(layout.leader.start.x >= 109.999);
  assert.ok(layout.leader.end.x > layout.leader.start.x);
});

test('BUG-015-D-032: una cara corta en el sentido opuesto conserva el lado exterior', () => {
  const polygon = [
    { x: 90, y: 95 }, { x: 96, y: 95 }, { x: 96, y: 105 }, { x: 90, y: 105 }
  ];
  const layout = structuralIntentMarkLayout({
    polygon,
    faceSegment: [{ x: 96, y: 95 }, { x: 96, y: 105 }],
    textWidth: 16,
    interfaceKind: 'face'
  });
  assert.equal(layout.callout, true);
  assert.ok(layout.anchor.x < 90);
  assert.equal(intersects(layout.box, polygonBounds(polygon)), false);
});

test('BUG-015-D-032: una interfaz de cara suficientemente larga conserva marca centrada', () => {
  const polygon = [
    { x: 104, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 180 }, { x: 104, y: 180 }
  ];
  const layout = structuralIntentMarkLayout({
    polygon,
    faceSegment: [{ x: 104, y: 20 }, { x: 104, y: 180 }],
    textWidth: 16,
    interfaceKind: 'face'
  });
  assert.equal(layout.callout, false);
  assert.equal(layout.leader, null);
  assert.deepEqual(layout.anchor, { x: 107, y: 100 });
});

test('BUG-015-D-032: objetivos que no son cara conservan el comportamiento histórico', () => {
  const polygon = [
    { x: 104, y: 95 }, { x: 110, y: 95 }, { x: 110, y: 105 }, { x: 104, y: 105 }
  ];
  const layout = structuralIntentMarkLayout({
    polygon,
    faceSegment: [{ x: 104, y: 95 }, { x: 104, y: 105 }],
    textWidth: 16,
    interfaceKind: 'end'
  });
  assert.equal(layout.callout, false);
  assert.equal(layout.leader, null);
  assert.deepEqual(layout.anchor, { x: 107, y: 100 });
});
