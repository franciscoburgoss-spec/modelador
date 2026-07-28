import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  GLOBAL_PROBE_WARNING,
  readCalculixVersion,
  runCalculixJob
} from '../scripts/lib/calculix-smoke.mjs';

const source = [
  '*NODE',
  '1, 0, 0, 0',
  '2, 1000, 0, 0',
  '*ELEMENT, TYPE=U1, ELSET=F_1',
  '1, 1, 2',
  '*MATERIAL, NAME=M',
  '*ELASTIC',
  '25000, 0.2',
  '*BEAM SECTION, ELSET=F_1, MATERIAL=M, SECTION=GENERAL',
  '240000, 3200000000, 0, 7200000000, 0',
  '0, 0, 1',
  ''
].join('\n');

function fakeFrd() {
  return [
    ' -4  DISP        7    1',
    ' -1         1 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00',
    ' -1         2 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00 0.00000E+00',
    ' -3',
    ''
  ].join('\n');
}

test('SPEC-003-C2: detector de versión usa argumento directo y tolera status informativo 201', () => {
  const calls = [];
  const version = readCalculixVersion('/ruta/ccx', (file, args, options) => {
    calls.push({ file, args, options });
    return { status: 201, stdout: 'This is Version 2.23\n', stderr: '' };
  });
  assert.equal(version, '2.23');
  assert.deepEqual(calls[0].args, ['-v']);
  assert.equal(calls[0].options.encoding, 'utf8');
});

test('SPEC-003-C2: runner borra stale, aísla y conserva fuente/sonda separadas', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'modelador-ccx-contract-'));
  const staleDirectory = resolve(root, 'ccx', 'global');
  mkdirSync(staleDirectory, { recursive: true });
  writeFileSync(resolve(staleDirectory, 'job.frd'), 'resultado stale ajeno', 'utf8');
  writeFileSync(resolve(staleDirectory, 'sentinel.stale'), 'stale', 'utf8');
  const calls = [];

  try {
    const result = await runCalculixJob({
      artifactRoot: root,
      executable: '/ruta/ccx',
      id: 'global',
      source,
      resultFormat: 'frd',
      probe: true,
      expectedNodeSet: 'SMOKE_GLOBAL',
      allowedWarnings: [GLOBAL_PROBE_WARNING],
      spawn(file, args, options) {
        calls.push({ file, args, options });
        writeFileSync(resolve(options.cwd, 'job.frd'), fakeFrd(), 'utf8');
        return {
          status: 0,
          stdout: `${GLOBAL_PROBE_WARNING}\nJob finished\n`,
          stderr: ''
        };
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].file, '/ruta/ccx');
    assert.deepEqual(calls[0].args, ['job']);
    assert.equal(calls[0].options.shell, undefined);
    assert.equal(
      await readFile(resolve(staleDirectory, 'source.inp'), 'utf8'),
      source
    );
    await assert.rejects(
      readFile(resolve(staleDirectory, 'sentinel.stale'), 'utf8'),
      /ENOENT/
    );
    assert.equal(result.result.nodeCount, 2);
    assert.equal(result.result.valueCount, 12);
    assert.deepEqual(result.warnings, [GLOBAL_PROBE_WARNING]);
    assert.notEqual(result.sourceSha256, result.executedSha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SPEC-003-C2: runner rechaza salida verde con ERROR o warning no permitido', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'modelador-ccx-errors-'));
  const runWith = (line) => runCalculixJob({
    artifactRoot: root,
    executable: '/ruta/ccx',
    id: 'global',
    source,
    resultFormat: 'frd',
    probe: true,
    expectedNodeSet: 'SMOKE_GLOBAL',
    allowedWarnings: [GLOBAL_PROBE_WARNING],
    spawn(file, args, options) {
      writeFileSync(resolve(options.cwd, 'job.frd'), fakeFrd(), 'utf8');
      return { status: 0, stdout: `${line}\nJob finished\n`, stderr: '' };
    }
  });
  try {
    await assert.rejects(runWith('*ERROR reading *BEAM SECTION'), /informó errores/);
    await assert.rejects(runWith('*WARNING: distinto'), /warnings no permitidos/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
