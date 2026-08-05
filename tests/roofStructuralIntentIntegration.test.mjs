import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  projectAgnosticRoofGeometry,
  serializeAgnosticGeometry
} from '../src/core/agnosticGeometry.js';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';
import {
  canonicalizeRoofBoundaries,
  setRoofIntent
} from '../src/core/structuralIntent.js';

async function loadFx008() {
  return JSON.parse(await readFile(new URL('fixtures/casa-L-completa-v3.json', import.meta.url), 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('SPEC-015-B: FX-008 canonicaliza sus siete cubiertas y evidencia cuatro IDs reales', async () => {
  const model = await loadFx008();
  const roofs = projectAgnosticRoofGeometry(model);
  assert.deepEqual(roofs.map((roof) => roof.id), [
    1785030887081,
    1785158713616,
    1785161146258,
    1785161198226,
    1785161271814,
    1785161396221,
    1785161662029
  ]);
  const boundaries = new Map(roofs.map((roof) => [roof.id, canonicalizeRoofBoundaries(roof)]));
  for (const id of [1785030887081, 1785161146258, 1785161396221, 1785161662029]) {
    assert.ok(boundaries.get(id).length >= 4, String(id));
    assert.ok(boundaries.get(id).every((edge) => edge.roofGeometryId === id));
  }
});

test('SPEC-015-B: intención de cubierta mantiene byte identity y SHA-256 del golden agnóstico', async () => {
  const model = await loadFx008();
  const before = serializeAgnosticGeometry(model);
  assert.equal(Buffer.byteLength(before), 81875);
  assert.equal(sha256(before), '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a');
  const [roof] = projectAgnosticRoofGeometry(model, [1785161396221]);
  const edge = canonicalizeRoofBoundaries(roof)[0];
  const declared = setRoofIntent(model, roof.id, {
    loadDistribution: 'local',
    diaphragmBehavior: 'undetermined',
    boundaryIntents: [{ boundaryId: edge.boundaryId, function: 'undetermined' }]
  }).model;
  const after = serializeAgnosticGeometry(declared);
  assert.equal(after, before);
  assert.equal(sha256(after), sha256(before));
});

test('SPEC-015-B: guardado/reapertura v3 conserva roofIntents canónicos sin migración', async () => {
  const model = await loadFx008();
  const [roof] = projectAgnosticRoofGeometry(model, [1785161662029]);
  const edges = canonicalizeRoofBoundaries(roof);
  const declared = setRoofIntent(model, roof.id, {
    loadDistribution: 'twoWay',
    primaryResistanceDirection: { x: 0, y: -1 },
    secondaryResistanceDirection: { x: -1, y: 0 },
    diaphragmBehavior: 'intended',
    boundaryIntents: [
      { boundaryId: edges.at(-1).boundaryId, function: 'lateralSupport' },
      { boundaryId: edges[0].boundaryId, function: 'gravitySupport' }
    ]
  }).model;
  const reopened = prepareModelImport(JSON.parse(serializeNativeProject(declared))).model;
  assert.equal(reopened.modelVersion, 3);
  assert.deepEqual(reopened.structuralIntent.roofIntents, declared.structuralIntent.roofIntents);
});

test('SPEC-015-B: importación legacy/v2 no fabrica intención de cubierta', async () => {
  const model = await loadFx008();
  const legacy = structuredClone(model);
  legacy.modelVersion = 2;
  delete legacy.structuralIntent;
  delete legacy.structuralIntentFindings;
  const prepared = prepareModelImport(legacy);
  assert.equal(prepared.model.modelVersion, 3);
  assert.deepEqual(prepared.model.structuralIntent.roofIntents, []);
});

test('SPEC-015-B: el núcleo de techumbre no depende de autoridades constructivas ni de UI', async () => {
  const source = await readFile(new URL('../src/core/roofStructuralIntent.js', import.meta.url), 'utf8');
  for (const forbidden of [
    'wallTypes.js', 'wallRoles.js', 'metalcon', 'osbModulation', 'studLayout',
    'trussGeometry', 'react', 'three', 'useModelStore'
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
