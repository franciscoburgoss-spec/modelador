import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NativeProjectError,
  openNativeProject,
  saveNativeProject,
  serializeNativeProject
} from '../src/core/nativeProjectFile.js';
import { ModelImportError } from '../src/core/modelSchema.js';

function validModel(overrides = {}) {
  return {
    modelVersion: 2,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    wallTypes: [],
    library: {
      wallSections: [],
      columnSections: [],
      beamSections: [],
      openingTemplates: [],
      foundationSections: [],
      metalconProfiles: [],
      materials: [],
      trussTemplates: []
    },
    roofSystems: [],
    roofPlanes: [],
    ...overrides
  };
}

test('SPEC-004-A: serializa canónicamente sin mutar y valida antes de escribir', async () => {
  const source = validModel({ projectProbe: 'área norte' });
  const original = structuredClone(source);
  const writes = [];
  const fileSystem = {
    readText: async () => '',
    writeTextAtomic: async (...args) => { writes.push(args); }
  };

  const content = serializeNativeProject(source);
  assert.equal(content.endsWith('\n'), true);
  assert.equal(content, `${JSON.stringify(source, null, 2)}\n`);
  assert.deepEqual(source, original);

  const saved = await saveNativeProject(fileSystem, '/projects/casa.modelador.json', source);
  assert.deepEqual(saved, { path: '/projects/casa.modelador.json' });
  assert.deepEqual(writes, [[
    '/projects/casa.modelador.json',
    content,
    { backupLimit: 10 }
  ]]);

  await assert.rejects(
    saveNativeProject(fileSystem, '/projects/invalido.modelador.json', {}),
    (error) => error instanceof ModelImportError
      && error.code === 'MODEL_VALIDATION_FAILED'
  );
  assert.equal(writes.length, 1, 'el modelo inválido no alcanza el puerto de escritura');
});

test('SPEC-004-A: abrir prepara un resultado aplicable sólo después de leer y validar', async () => {
  const active = {
    title: 'Proyecto vigente',
    path: '/projects/vigente.modelador.json',
    dirty: true,
    model: validModel({ projectProbe: 'vigente' })
  };
  const before = structuredClone(active);
  const fileSystem = {
    readText: async () => '{"grid":',
    writeTextAtomic: async () => {}
  };

  await assert.rejects(
    openNativeProject(fileSystem, '/projects/roto.modelador.json'),
    (error) => error instanceof ModelImportError && error.code === 'INVALID_JSON'
  );
  assert.deepEqual(active, before, 'el contrato de apertura no recibe ni muta estado activo');

  fileSystem.readText = async () => JSON.stringify(validModel({ projectProbe: 'nuevo' }));
  const opened = await openNativeProject(fileSystem, '/projects/nuevo.modelador.json');
  assert.equal(opened.path, '/projects/nuevo.modelador.json');
  assert.equal(opened.prepared.model.projectProbe, 'nuevo');
  assert.deepEqual(opened.prepared.appliedMigrations, []);
});

test('SPEC-004-A: errores del puerto son tipados y el contrato exige ambas operaciones', async () => {
  await assert.rejects(
    openNativeProject({
      readText: async () => { throw new Error('EACCES'); },
      writeTextAtomic: async () => {}
    }, '/projects/privado.modelador.json'),
    (error) => error instanceof NativeProjectError
      && error.code === 'PROJECT_READ_FAILED'
      && error.cause?.message === 'EACCES'
  );

  await assert.rejects(
    saveNativeProject({
      readText: async () => '',
      writeTextAtomic: async () => { throw new Error('ENOSPC'); }
    }, '/projects/lleno.modelador.json', validModel()),
    (error) => error instanceof NativeProjectError
      && error.code === 'PROJECT_WRITE_FAILED'
      && error.cause?.message === 'ENOSPC'
  );

  await assert.rejects(
    openNativeProject({ readText: async () => '{}' }, '/projects/incompleto.modelador.json'),
    (error) => error instanceof NativeProjectError && error.code === 'INVALID_PROJECT_PORT'
  );
});
