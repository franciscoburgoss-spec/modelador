import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { serializeAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';
import {
  createEmptyStructuralIntent,
  setElementIntent
} from '../src/core/structuralIntent.js';

async function casaL() {
  return JSON.parse(await readFile(new URL('fixtures/casa-L.json', import.meta.url), 'utf8'));
}

async function casaLCompleta() {
  return JSON.parse(await readFile(
    new URL('fixtures/casa-L-completa-v3.json', import.meta.url),
    'utf8'
  ));
}

test('SPEC-015-A: legacy→v3 conserva el proyecto real y no infiere intención estructural', async () => {
  const source = await casaL();
  const sourceClone = structuredClone(source);
  const prepared = prepareModelImport(source);
  const migrated = prepared.model;

  assert.equal(migrated.modelVersion, 3);
  assert.deepEqual(prepared.appliedMigrations, ['0->1', '1->2', '2->3']);
  assert.deepEqual(migrated.structuralIntent, createEmptyStructuralIntent());
  assert.deepEqual(source, sourceClone, 'la migración no muta el fixture legacy');
  assert.deepEqual(migrated.wallTypes, []);
  assert.equal(migrated.structuralIntent.elementIntents.length, 0);

  const walls = migrated.elements.filter((element) => element.type === 'wall');
  const openings = walls.flatMap((wall) => wall.openings || []);
  const foundations = migrated.elements.filter((element) => element.type === 'foundation');
  const roofs = (migrated.roofSystems || []).length + (migrated.roofPlanes || []).length;
  assert.equal(walls.length, 45);
  assert.equal(openings.length, 43);
  assert.equal(foundations.length, 4);
  assert.equal(roofs, 2);
});

test('SPEC-015-A: FX-008 conserva 45/43/32/7 y la intención no cambia la geometría agnóstica', async () => {
  const prepared = prepareModelImport(await casaLCompleta());
  const model = prepared.model;

  assert.equal(model.modelVersion, 3);
  assert.deepEqual(prepared.appliedMigrations, []);
  assert.deepEqual(model.structuralIntent, createEmptyStructuralIntent());

  const walls = model.elements.filter((element) => element.type === 'wall');
  const openings = walls.flatMap((wall) => wall.openings || []);
  const foundations = model.elements.filter((element) => element.type === 'foundation');

  assert.equal(walls.length, 45);
  assert.equal(openings.length, 43);
  assert.equal(foundations.length, 32);
  assert.equal(model.roofPlanes.length, 7);

  const before = serializeAgnosticGeometry(model);
  assert.equal(Buffer.byteLength(before), 81875);
  assert.equal(
    createHash('sha256').update(before).digest('hex'),
    '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a'
  );

  const withIntent = setElementIntent(model, walls[0].id, {
    participation: 'resistant',
    functions: ['gravityResistance', 'inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable',
    notes: 'Declaración explícita de prueba'
  }).model;

  const after = serializeAgnosticGeometry(withIntent);

  assert.equal(after, before);
  assert.equal(
    createHash('sha256').update(after).digest('hex'),
    '966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a'
  );
});

test('SPEC-015-A: guardado/reapertura conserva intención y canonicaliza el orden', async () => {
  const migrated = prepareModelImport(await casaL()).model;
  const [wallA, wallB] = migrated.elements.filter((element) => element.type === 'wall');
  let current = setElementIntent(migrated, wallB.id, {
    participation: 'secondary',
    functions: ['stabilization', 'spaceDivision'],
    secondaryInteraction: 'undetermined'
  }).model;
  current = setElementIntent(current, wallA.id, {
    participation: 'resistant',
    functions: ['inPlaneLateralResistance', 'gravityResistance']
  }).model;

  const bytes = serializeNativeProject(current);
  const reopened = prepareModelImport(JSON.parse(bytes)).model;
  assert.deepEqual(reopened.structuralIntent, current.structuralIntent);
  assert.deepEqual(
    reopened.structuralIntent.elementIntents.map((intent) => intent.elementId),
    current.structuralIntent.elementIntents.map((intent) => intent.elementId)
  );
  assert.deepEqual(reopened.structuralIntent.elementIntents[0].functions, [
    'gravityResistance',
    'inPlaneLateralResistance'
  ]);
});

test('SPEC-015-A: el núcleo no depende de autoridades constructivas', async () => {
  const source = await readFile(new URL('../src/core/structuralIntent.js', import.meta.url), 'utf8');
  for (const forbidden of [
    'wallTypes.js',
    'wallRoles.js',
    'metalcon',
    'osbModulation',
    'studLayout',
    'wallModulation'
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
