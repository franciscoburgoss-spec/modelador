import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import {
  CURRENT_MODEL_VERSION,
  prepareModelImport,
  prepareModelJsonImport
} from '../src/core/modelSchema.js';
import { resolveWallGeometry } from '../src/core/elementGeometry.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';
import { getRoofSystems } from '../src/core/roofPlaneOutputs.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const manifestPath = resolve(repositoryRoot, 'harness/fixtures.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function loadEntry(entry) {
  const absolutePath = resolve(repositoryRoot, entry.file);
  assert.ok(
    absolutePath.startsWith(`${repositoryRoot}${sep}`),
    `${entry.id}: la ruta debe permanecer dentro del repositorio`
  );
  const raw = readFileSync(absolutePath, 'utf8');
  return { raw, source: JSON.parse(raw) };
}

function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeModel(model) {
  const walls = model.elements.filter((element) => element.type === 'wall');
  const wallGeometries = walls
    .map((wall) => resolveWallGeometry(wall, model.grid))
    .filter(Boolean);
  const xs = wallGeometries.flatMap((geometry) => [geometry.p1.x, geometry.p2.x]);
  const ys = wallGeometries.flatMap((geometry) => [geometry.p1.y, geometry.p2.y]);
  const openings = walls.flatMap((wall) => wall.openings || []);

  return {
    elementCount: model.elements.length,
    elementTypes: countBy(model.elements, (element) => element.type),
    axisCounts: {
      x: model.grid.xAxes.length,
      y: model.grid.yAxes.length,
      z: model.grid.zLevels.length
    },
    wallTypeCount: model.wallTypes.length,
    roofSystemCount: model.roofSystems.length,
    roofPlaneCount: model.roofPlanes.length,
    openingCounts: countBy(openings, (opening) => opening.type),
    resolvableWallCount: wallGeometries.length,
    bounds: wallGeometries.length > 0
      ? {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        }
      : null
  };
}

function fixture(id) {
  const entry = manifest.fixtures.find((candidate) => candidate.id === id);
  assert.ok(entry, `falta ${id} en el manifiesto`);
  const { raw, source } = loadEntry(entry);
  return { entry, raw, source, prepared: prepareModelImport(source) };
}

function wallProfileSeries(model) {
  const profilesById = new Map(
    model.library.metalconProfiles.map((profile) => [profile.id, profile])
  );
  return [...new Set(model.wallTypes.map((wallType) => (
    profilesById.get(wallType.metalconDefaults.studProfileId)?.H
  )))].sort((a, b) => a - b);
}

function assertWallTypeReferences(model) {
  const wallTypeIds = new Set(model.wallTypes.map((wallType) => wallType.id));
  const profileIds = new Set(model.library.metalconProfiles.map((profile) => profile.id));
  for (const wall of model.elements.filter((element) => element.type === 'wall')) {
    assert.ok(wallTypeIds.has(wall.wallTypeId), `${wall.id}: wallTypeId resoluble`);
  }
  for (const wallType of model.wallTypes) {
    assert.ok(
      profileIds.has(wallType.metalconDefaults.studProfileId),
      `${wallType.id}: perfil montante resoluble`
    );
    assert.ok(
      profileIds.has(wallType.metalconDefaults.trackProfileId),
      `${wallType.id}: perfil solera resoluble`
    );
  }
}

function assertDerivedWallStateIsAbsent(model) {
  for (const wall of model.elements.filter((element) => element.type === 'wall')) {
    for (const field of ['studs', 'headers', 'osbCourses', 'studsStale', 'osbStale']) {
      assert.equal(Object.hasOwn(wall, field), false, `${wall.id}: ${field} no persistido`);
    }
  }
}

function ledgerSummary(model) {
  return getRoofSystems(model).flatMap((system) => (
    (system.supportLedgers || []).map((ledger) => ({
      planeId: system.planeId,
      wallId: ledger.wallId,
      side: ledger.side,
      profile: ledger.profile,
      topElevation: ledger.topElevation,
      baseElevation: ledger.baseElevation,
      length: ledger.length,
      runAxis: ledger.runAxis,
      p1: ledger.p1,
      p2: ledger.p2
    }))
  ));
}

test('SPEC-003-A: el manifiesto fija checksum, esquema, propósito e invariantes de cada fixture', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.fixtures.length >= 8);
  assert.equal(new Set(manifest.fixtures.map((entry) => entry.id)).size, manifest.fixtures.length);
  assert.equal(new Set(manifest.fixtures.map((entry) => entry.file)).size, manifest.fixtures.length);
  const discoveredFiles = [
    ...readdirSync(resolve(repositoryRoot, 'tests/fixtures'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => `tests/fixtures/${name}`),
    ...readdirSync(resolve(repositoryRoot, 'lab/roofPlane/fixtures'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => `lab/roofPlane/fixtures/${name}`)
  ].sort();
  assert.deepEqual(
    manifest.fixtures.map((entry) => entry.file).sort(),
    discoveredFiles,
    'todo fixture JSON del repositorio debe estar registrado'
  );

  for (const entry of manifest.fixtures) {
    assert.match(entry.id, /^FX-/);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.origin.length > 0);
    assert.ok(entry.anonymization.length > 0);
    assert.ok(entry.purpose.length > 0);
    assert.ok(entry.requirements.length > 0);
    assert.ok(entry.requirements.every((requirement) => /^REQ-[A-Z]+-\d{3}$/.test(requirement)));
    assert.ok(entry.coverage.length > 0);
    assert.ok(Array.isArray(entry.goldenOutputs));

    const { raw, source } = loadEntry(entry);
    const original = structuredClone(source);
    assert.equal(sha256(raw), entry.sha256, `${entry.id}: checksum`);
    assert.equal(
      Object.hasOwn(source, 'modelVersion') ? source.modelVersion : 0,
      entry.modelVersion,
      `${entry.id}: versión fuente`
    );

    const prepared = prepareModelImport(source);
    assert.equal(prepared.model.modelVersion, CURRENT_MODEL_VERSION);
    assert.deepEqual(prepared.appliedMigrations, entry.appliedMigrations);
    assert.deepEqual(summarizeModel(prepared.model), entry.invariants);
    assert.deepEqual(source, original, `${entry.id}: la importación debe ser pura`);
  }
});

test('SPEC-003-A: FX-003 es una vivienda independiente con X/Y, vanos y familias 60/90', () => {
  const casa = fixture('FX-001').source;
  const fx3 = fixture('FX-003');
  const fx4 = fixture('FX-004').source;
  const model = fx3.prepared.model;
  const walls = model.elements.filter((element) => element.type === 'wall');
  const openings = walls.flatMap((wall) => wall.openings || []);

  assert.notEqual(sha256(JSON.stringify(model.elements)), sha256(JSON.stringify(casa.elements)));
  assert.notEqual(sha256(JSON.stringify(model.library)), sha256(JSON.stringify(casa.library)));
  assert.notEqual(sha256(JSON.stringify(model.elements)), sha256(JSON.stringify(fx4.elements)));
  assert.notEqual(sha256(JSON.stringify(model.library)), sha256(JSON.stringify(fx4.library)));
  assert.deepEqual(new Set(walls.map((wall) => wall.direction)), new Set(['x', 'y']));
  assert.equal(openings.filter((opening) => opening.type === 'door').length, 3);
  assert.equal(openings.filter((opening) => opening.type === 'window').length, 3);
  assert.deepEqual(wallProfileSeries(model), [60, 90]);
  assert.ok(walls.every((wall) => resolveWallGeometry(wall, model.grid)));
  assertWallTypeReferences(model);
  assertDerivedWallStateIsAbsent(model);
});

test('SPEC-003-A: FX-004 persiste roofPlanes y deriva dos ledgers reproducibles tras roundtrip', () => {
  const fx4 = fixture('FX-004');
  const model = fx4.prepared.model;
  const plane = model.roofPlanes[0];

  assert.deepEqual(fx4.prepared.appliedMigrations, ['2->3', '3->4']);
  assert.equal(model.modelVersion, 4);
  assert.deepEqual(wallProfileSeries(model), [60, 90]);
  assert.equal(model.roofSystems.length, 0, 'no duplica la fuente moderna con sistemas legacy');
  assert.equal(model.roofPlanes.length, 1);
  assert.equal(Object.hasOwn(plane, 'supportLedgers'), false, 'el faldón no persiste derivados');
  assertWallTypeReferences(model);
  assertDerivedWallStateIsAbsent(model);

  const roofProfileCodes = new Set(
    model.library.metalconProfiles.map((profile) => profile.code)
  );
  const template = model.library.trussTemplates.find((item) => item.id === plane.templateId);
  assert.ok(template, 'la plantilla del faldón existe');
  for (const profileCode of [
    plane.supportProfile,
    ...Object.values(plane.profiles),
    template.purlinProfile
  ]) {
    assert.ok(roofProfileCodes.has(profileCode), `perfil de cubierta ${profileCode} resoluble`);
  }

  const systems = getRoofSystems(model);
  assert.equal(systems.length, fx4.entry.derived.roofSystemCount);
  assert.ok(systems.every((system) => system.trussGeometry?.resolved));
  const before = ledgerSummary(model);
  assert.equal(before.length, fx4.entry.derived.ledgerCount);
  assert.ok(before.every((ledger) => (
    ledger.profile === '90CA085'
    && Number.isFinite(ledger.topElevation)
    && Number.isFinite(ledger.baseElevation)
    && Number.isFinite(ledger.length)
    && ledger.length > 0
  )));

  const reopened = prepareModelJsonImport(JSON.stringify(model));
  assert.deepEqual(reopened.appliedMigrations, []);
  assert.deepEqual(reopened.model.roofPlanes, model.roofPlanes);
  assert.deepEqual(ledgerSummary(reopened.model), before);
});

test('SPEC-003-C0: FX-004 persiste propiedades mecánicas canónicas para la cercha', () => {
  const model = fixture('FX-004').prepared.model;
  const projectProfiles = new Map(
    model.library.metalconProfiles.map((profile) => [profile.code, profile])
  );
  const catalogProfiles = new Map(
    METALCON_PROFILES.map((profile) => [profile.code, profile])
  );

  for (const code of ['90CA085', '40CA085', '60CA085']) {
    const projectProfile = projectProfiles.get(code);
    const catalogProfile = catalogProfiles.get(code);
    assert.ok(projectProfile, `${code}: perfil persistido`);
    assert.ok(catalogProfile, `${code}: perfil canónico`);
    for (const property of ['areaCm2', 'ixCm4', 'iyCm4']) {
      assert.equal(
        projectProfile[property],
        catalogProfile[property],
        `${code}.${property}: debe coincidir literalmente con el catálogo`
      );
      assert.ok(
        Number.isFinite(projectProfile[property]) && projectProfile[property] > 0,
        `${code}.${property}: debe ser finita y positiva`
      );
    }
  }
});
