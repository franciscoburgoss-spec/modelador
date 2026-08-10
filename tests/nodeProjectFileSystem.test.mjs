import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createNodeProjectFileSystem,
  projectBackupDirectory
} from '../src/adapters/nodeProjectFileSystem.js';
import {
  openNativeProject,
  saveNativeProject,
  serializeNativeProject
} from '../src/core/nativeProjectFile.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

async function temporaryProjectPath() {
  const directory = await mkdtemp(path.join(tmpdir(), 'modelador-native-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'casa.modelador.json');
}

function project(sequence) {
  return {
    modelVersion: 3,
    structuralIntent: {
      schema: 'structural-intent-v1.1',
      elementIntents: [],
      roofIntents: [],
      intersectionIntents: [],
      supportIntents: [],
      interfaceIntents: [],
      relationIntents: [],
      diaphragmIntents: [],
      overrides: []
    },
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
    persistenceProbe: sequence
  };
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function waitForSyncedTemporary(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El helper no sincronizó el temporal.')), 5000);
    child.once('error', reject);
    child.on('message', (message) => {
      if (message?.status !== 'temp-synced') return;
      clearTimeout(timer);
      resolve(message);
    });
    child.once('exit', (code, signal) => {
      if (code !== null || signal !== null) {
        clearTimeout(timer);
        reject(new Error(`El helper terminó antes del kill: code=${code} signal=${signal}`));
      }
    });
  });
}

async function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

test('SPEC-004-A: un SIGKILL entre fsync y rename conserva el último archivo válido', async () => {
  const targetPath = await temporaryProjectPath();
  const fileSystem = createNodeProjectFileSystem();
  await saveNativeProject(fileSystem, targetPath, project(0));
  const before = await readFile(targetPath);
  const helperPath = fileURLToPath(
    new URL('./helpers/interruptedAtomicWrite.mjs', import.meta.url)
  );
  const child = spawn(process.execPath, [helperPath, targetPath], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  const message = await waitForSyncedTemporary(child);
  assert.equal(path.dirname(message.tempPath), path.dirname(targetPath));
  const exitPromise = waitForExit(child);
  assert.equal(child.kill('SIGKILL'), true);
  assert.deepEqual(await exitPromise, { code: null, signal: 'SIGKILL' });

  const after = await readFile(targetPath);
  assert.equal(sha256(after), sha256(before));
  assert.deepEqual(
    (await openNativeProject(fileSystem, targetPath)).prepared.model,
    project(0)
  );
});

test('SPEC-004-A: cada reemplazo respalda bytes exactos y conserva las diez versiones previas', async () => {
  const targetPath = await temporaryProjectPath();
  const fileSystem = createNodeProjectFileSystem();
  const initial = serializeNativeProject(project(0));
  await saveNativeProject(fileSystem, targetPath, project(0));
  await saveNativeProject(fileSystem, targetPath, project(1));

  const backupDirectory = projectBackupDirectory(targetPath);
  let backupNames = (await readdir(backupDirectory)).filter((name) => name.endsWith('.bak'));
  assert.equal(backupNames.length, 1);
  assert.equal(await readFile(path.join(backupDirectory, backupNames[0]), 'utf8'), initial);

  for (let sequence = 2; sequence <= 12; sequence += 1) {
    await saveNativeProject(fileSystem, targetPath, project(sequence));
  }

  backupNames = (await readdir(backupDirectory))
    .filter((name) => name.endsWith('.bak'))
    .sort();
  assert.equal(backupNames.length, 10);

  const backupSequences = [];
  for (const backupName of backupNames) {
    const backupPath = path.join(backupDirectory, backupName);
    const opened = await openNativeProject(fileSystem, backupPath);
    backupSequences.push(opened.prepared.model.persistenceProbe);
  }
  assert.deepEqual(backupSequences, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(
    (await openNativeProject(fileSystem, targetPath)).prepared.model.persistenceProbe,
    12
  );
});
