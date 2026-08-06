import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  STRUCTURAL_INTENT_VISUAL_CONTRACT,
  buildStructuralIntentVisualPresentation,
  buildStructuralIntentVisualPreview,
  compareVisualFingerprintSnapshot,
  visualFingerprintSnapshot
} from '../src/core/structuralIntentVisualPresentation.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/casa-L-completa-v3.json', import.meta.url)));

function multiTypeModel() {
  return {
    modelVersion: 3,
    grid: {
      xAxes: [
        { id: 'X0', label: '1', position: 0 },
        { id: 'X1', label: '2', position: 4000 }
      ],
      yAxes: [
        { id: 'Y0', label: 'A', position: 0 },
        { id: 'Y1', label: 'B', position: 3000 }
      ],
      zLevels: [
        { id: 'Z0', label: 'NPT', elevation: 0 },
        { id: 'Z1', label: 'CIELO', elevation: 2400 }
      ]
    },
    projectParams: [],
    elements: [
      {
        id: 'W1', type: 'wall', direction: 'x', xStart: 'X0', xEnd: 'X1',
        yStart: 'Y0', yEnd: 'Y0', bottomZ: 'Z0', topZ: 'Z1', thickness: 90, openings: []
      },
      {
        id: 'C1', type: 'column', axisXId: 'X1', axisYId: 'Y1',
        bottomZ: 'Z0', topZ: 'Z1', widthX: 200, widthY: 300
      },
      {
        id: 'B1', type: 'beam', direction: 'y', fixedAxisId: 'X1', startAxisId: 'Y0',
        endAxisId: 'Y1', levelZ: 'Z1', width: 200, height: 400
      },
      {
        id: 'F1', type: 'foundation', foundationType: 'corrida', direction: 'x',
        fixedAxisId: 'Y0', startAxisId: 'X0', endAxisId: 'X1', levelZ: 'Z0',
        topOffset: 0,
        cimiento: { width: 500, depth: 600 },
        sobrecimiento: { width: 140, height: 450 }
      }
    ],
    roofSystems: [], roofPlanes: [],
    structuralIntent: { schema: 'structural-intent-v1.0', elementIntents: [], roofIntents: [] }
  };
}

test('SPEC-015-C-1: presentador puro cubre wall, column, beam y foundation sin mutar', () => {
  const model = multiTypeModel();
  const before = structuredClone(model);
  const presentation = buildStructuralIntentVisualPresentation(model);
  assert.equal(presentation.runtimeContract, STRUCTURAL_INTENT_VISUAL_CONTRACT);
  assert.deepEqual(presentation.targets.map((target) => target.type), ['wall', 'column', 'beam', 'foundation']);
  assert.ok(presentation.targets.every((target) => target.state === 'available'));
  assert.ok(presentation.targets.every((target) => /^[a-f0-9]{64}$/.test(target.geometryFingerprint)));
  assert.deepEqual(model, before);
});

test('SPEC-015-C-1: descriptor FX-008 del muro objetivo coincide con geometría real', () => {
  const presentation = buildStructuralIntentVisualPresentation(fixture);
  const target = presentation.targets.find((item) => item.id === 1784605101040);
  assert.equal(target.descriptor.orientation, 'X');
  assert.equal(target.descriptor.axis.nominal, '7→11A @ C');
  assert.equal(target.descriptor.levels.bottomLabel, 'NPT');
  assert.equal(target.descriptor.levels.topLabel, 'FRONTON GENERAL');
  assert.deepEqual(target.descriptor.dimensions, {
    length: 8700, thickness: 101.1, height: 3700, openings: 3
  });
  assert.deepEqual(target.openings.map((opening) => opening.id), [
    1784605151802, 1784605173145, 1784605196342
  ]);
});

test('SPEC-015-C-1: contexto individual y lote FX-008 son deterministas y no semánticos', () => {
  const presentation = buildStructuralIntentVisualPresentation(fixture);
  const individual = buildStructuralIntentVisualPreview(presentation, [1784605101040]);
  assert.deepEqual(individual.context.map(({ id, contextDistance }) => [id, contextDistance]), [
    [1784754251210, 0],
    [1784756700772, 0],
    [1784819708086, 0],
    [1784607987483, 1098.9],
    [1784754427246, 1098.9],
    [1784756325325, 1098.9]
  ]);
  assert.equal(individual.selected[0].mark, 'T');

  const batch = buildStructuralIntentVisualPreview(
    presentation,
    [1784752639636, 1784751397992, 1784752583321],
    { activeId: 1784752583321 }
  );
  assert.deepEqual(batch.selected.map(({ id, mark }) => [id, mark]), [
    [1784751397992, 'S1'], [1784752583321, 'S2'], [1784752639636, 'S3']
  ]);
  assert.equal(batch.activeId, 1784752583321);
  assert.deepEqual(batch.context.map(({ id, contextDistance }) => [id, contextDistance]), [
    [1784604634483, 0], [1784606313849, 0], [1784670218571, 0],
    [1784751024158, 1098.9], [1784600403613, 1098.9]
  ]);
});

test('SPEC-015-C-1: etiquetas nominales requieren coincidencia dentro de 0,1 mm', () => {
  const model = multiTypeModel();
  model.elements.find((element) => element.id === 'C1').offsetX = 0.11;
  const target = buildStructuralIntentVisualPresentation(model).targets.find((item) => item.id === 'C1');
  assert.equal(target.descriptor.axes, null);
  assert.match(target.descriptor.coordinates, /x=4\.000,11/);
});

test('SPEC-015-C-1: intención huérfana permanece visible como referencia rota', () => {
  const model = structuredClone(fixture);
  model.structuralIntent.elementIntents.push({
    elementId: 'MISSING', participation: 'undetermined', functions: [],
    secondaryInteraction: 'notApplicable', status: 'declared', source: 'user'
  });
  const presentation = buildStructuralIntentVisualPresentation(model);
  assert.equal(presentation.orphans.length, 1);
  assert.equal(presentation.orphans[0].id, 'MISSING');
  assert.equal(presentation.orphans[0].state, 'brokenReference');
  assert.equal(presentation.orphans[0].error.code, 'SI-VISUAL-TARGET-NOT-FOUND');
});

test('SPEC-015-C-1: fingerprint detecta preview stale y referencia rota', () => {
  const presentation = buildStructuralIntentVisualPresentation(fixture);
  const snapshot = visualFingerprintSnapshot(presentation, [1784605101040]);
  assert.equal(compareVisualFingerprintSnapshot(presentation, snapshot).ok, true);

  const changed = structuredClone(fixture);
  changed.elements.find((element) => element.id === 1784605101040).thickness = 120;
  const stale = compareVisualFingerprintSnapshot(
    buildStructuralIntentVisualPresentation(changed), snapshot
  );
  assert.equal(stale.ok, false);
  assert.equal(stale.conflicts[0].code, 'SI-VISUAL-PREVIEW-STALE');

  const removed = structuredClone(fixture);
  removed.elements = removed.elements.filter((element) => element.id !== 1784605101040);
  removed.structuralIntent.elementIntents = [];
  removed.roofPlanes = [];
  removed.roofSystems = [];
  const broken = compareVisualFingerprintSnapshot(
    buildStructuralIntentVisualPresentation(removed), snapshot
  );
  assert.equal(broken.ok, false);
  assert.equal(broken.conflicts[0].code, 'SI-VISUAL-TARGET-NOT-FOUND');
});

test('SPEC-015-C-1: permutar colecciones equivalentes conserva salida y SHA', () => {
  const first = buildStructuralIntentVisualPresentation(fixture);
  const permuted = structuredClone(fixture);
  permuted.elements.reverse();
  permuted.grid.xAxes.reverse();
  permuted.grid.yAxes.reverse();
  permuted.grid.zLevels.reverse();
  const second = buildStructuralIntentVisualPresentation(permuted);
  assert.deepEqual(second, first);
  assert.equal(second.presentationSha256, first.presentationSha256);
});
