import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { buildStructuralIntentWorkspace } from '../src/core/structuralIntentWorkspace.js';
import { buildStructuralInterfaceWallContext } from '../src/core/structuralInterfaceVisualContext.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));

function allClose(values, expected, tolerance = 1e-9) {
  return values.every((value) => Math.abs(value - expected) <= tolerance);
}

test('BUG-015-D-020: FX-008 C/6→7 expone +N/−N sobre la cara física y conserva ejes humanos', () => {
  const geometry = projectAgnosticGeometry(fixture);
  const workspace = buildStructuralIntentWorkspace(fixture);
  const wall = geometry.elements.find((item) => item.id === 1784819708086);
  const visualTarget = workspace.visualPresentation.targets.find((item) => item.id === wall.id);

  const positive = buildStructuralInterfaceWallContext({ wall, visualTarget, locatorKind: 'face', faceSide: 'positiveN' });
  const negative = buildStructuralInterfaceWallContext({ wall, visualTarget, locatorKind: 'face', faceSide: 'negativeN' });

  assert.equal(positive.axis, 'x');
  assert.equal(positive.labels.lowSLabel, '6');
  assert.equal(positive.labels.highSLabel, '7');
  assert.equal(positive.labels.fixedLabel, 'C');
  assert.deepEqual(positive.normalWorld, { positiveN: '+Y', negativeN: '−Y' });

  const half = wall.prism.thickness / 2;
  assert.ok(allClose(positive.selected.faceSegment.map((point) => point.y), positive.frame.fixed + half));
  assert.ok(allClose(negative.selected.faceSegment.map((point) => point.y), negative.frame.fixed - half));
  assert.ok(positive.selected.polygon.some((point) => point.y > positive.frame.fixed + half));
  assert.ok(negative.selected.polygon.some((point) => point.y < negative.frame.fixed - half));
  assert.equal(positive.locatorPreview.selected[0].mark, '+N');
  assert.equal(negative.locatorPreview.selected[0].mark, '−N');
  assert.equal(positive.locatorPreview.selected[0].id, wall.id);
});

test('BUG-015-D-020: marco canónico no cambia si el prisma equivalente viene invertido', () => {
  const base = {
    id: 'W-X', type: 'wall', openings: [],
    prism: { kind: 'oriented-prism', start: { x: 100, y: 200, z: 0 }, end: { x: 900, y: 200, z: 0 }, thickness: 100, height: 2500 }
  };
  const reversed = { ...base, prism: { ...base.prism, start: base.prism.end, end: base.prism.start } };
  const visualTarget = { descriptor: { axis: { fromLabel: '1', toLabel: '2', fixedLabel: 'A', nominal: '1→2 @ A' } } };
  const forward = buildStructuralInterfaceWallContext({ wall: base, visualTarget, faceSide: 'positiveN' });
  const backward = buildStructuralInterfaceWallContext({ wall: reversed, visualTarget, faceSide: 'positiveN' });

  assert.deepEqual(backward.hostPolygon, forward.hostPolygon);
  assert.deepEqual(backward.selected.faceSegment, forward.selected.faceSegment);
  assert.deepEqual(backward.normalWorld, forward.normalWorld);
});

test('BUG-015-D-020: muro Y usa +N=−X y extremos lowS/highS legibles', () => {
  const wall = {
    id: 'W-Y', type: 'wall', openings: [],
    prism: { kind: 'oriented-prism', start: { x: 500, y: 1000, z: 0 }, end: { x: 500, y: 3000, z: 0 }, thickness: 120, height: 2400 }
  };
  const visualTarget = { descriptor: { axis: { fromLabel: 'A', toLabel: 'B', fixedLabel: '6', nominal: 'A→B @ 6' } } };
  const face = buildStructuralInterfaceWallContext({ wall, visualTarget, locatorKind: 'face', faceSide: 'positiveN' });
  const low = buildStructuralInterfaceWallContext({ wall, visualTarget, locatorKind: 'end', end: 'lowS' });
  const high = buildStructuralInterfaceWallContext({ wall, visualTarget, locatorKind: 'end', end: 'highS' });

  assert.deepEqual(face.normalWorld, { positiveN: '−X', negativeN: '+X' });
  assert.ok(face.selected.faceSegment.every((point) => point.x < face.frame.fixed));
  assert.equal(low.labels.lowSLabel, 'A');
  assert.equal(high.labels.highSLabel, 'B');
  assert.equal(low.selected.mark, 'S−');
  assert.equal(high.selected.mark, 'S+');
  assert.ok(low.selected.polygon.some((point) => point.y < low.frame.s0));
  assert.ok(high.selected.polygon.some((point) => point.y > high.frame.s1));
});

test('MEJ-015-D-026: región S/Z se representa como banda longitudinal sin convertir Z en planta', () => {
  const wall = {
    id: 'W-R', type: 'wall', openings: [],
    prism: { kind: 'oriented-prism', start: { x: 0, y: 0, z: 450 }, end: { x: 2000, y: 0, z: 450 }, thickness: 100, height: 3000 }
  };
  const context = buildStructuralInterfaceWallContext({
    wall,
    locatorKind: 'region',
    sRange: [500, 1500],
    zRange: [3250, 3450]
  });

  assert.deepEqual(context.sRange, [500, 1500]);
  assert.deepEqual(context.zRange, [3250, 3450]);
  assert.equal(context.selected.mark, 'R');
  assert.deepEqual(context.locatorPreview.selected[0].interfaceLocation.zRange, [3250, 3450]);
  assert.deepEqual([...new Set(context.selected.polygon.map((point) => point.x))].sort((a, b) => a - b), [500, 1500]);
});
