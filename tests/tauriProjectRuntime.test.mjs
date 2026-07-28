import test from 'node:test';
import assert from 'node:assert/strict';

import { createTauriProjectRuntime } from '../src/adapters/tauriProjectRuntime.js';

test('SPEC-004-C: localhost no publica un runtime nativo aparente', () => {
  let invokes = 0;
  const runtime = createTauriProjectRuntime({
    isTauri: () => false,
    invoke: async () => { invokes += 1; }
  });

  assert.equal(runtime, null);
  assert.equal(invokes, 0);
});

test('SPEC-004-D: el runtime usa sólo los nueve comandos estrechos y argumentos estructurados', async () => {
  const calls = [];
  const invoke = async (command, args) => {
    calls.push([command, args]);
    if (command === 'choose_open_project_path') return '/p/abierto.modelador.json';
    if (command === 'choose_save_project_path') return '/p/copia.modelador.json';
    if (command === 'read_project_text') return '{"modelVersion":2}';
    if (command === 'load_recent_project_paths') return ['/p/reciente.modelador.json'];
    if (command === 'load_recovery_snapshot') return '{"version":2}';
    return undefined;
  };
  const runtime = createTauriProjectRuntime({ isTauri: () => true, invoke });

  assert.equal(await runtime.chooseOpenPath(), '/p/abierto.modelador.json');
  assert.equal(
    await runtime.chooseSavePath({ currentPath: '/p/actual.modelador.json' }),
    '/p/copia.modelador.json'
  );
  assert.equal(
    await runtime.fileSystem.readText('/p/abierto.modelador.json'),
    '{"modelVersion":2}'
  );
  await runtime.fileSystem.writeTextAtomic(
    '/p/copia.modelador.json',
    '{"modelVersion":2}\n',
    { backupLimit: 10 }
  );
  assert.deepEqual(await runtime.loadRecentPaths(), ['/p/reciente.modelador.json']);
  await runtime.saveRecentPaths(['/p/copia.modelador.json']);
  assert.equal(await runtime.loadRecoverySnapshot(), '{"version":2}');
  await runtime.saveRecoverySnapshot('{"version":2}');
  await runtime.clearRecoverySnapshot();

  assert.deepEqual(calls, [
    ['choose_open_project_path', undefined],
    ['choose_save_project_path', { currentPath: '/p/actual.modelador.json' }],
    ['read_project_text', { projectPath: '/p/abierto.modelador.json' }],
    ['write_project_text_atomic', {
      projectPath: '/p/copia.modelador.json',
      content: '{"modelVersion":2}\n',
      backupLimit: 10
    }],
    ['load_recent_project_paths', undefined],
    ['save_recent_project_paths', { recentPaths: ['/p/copia.modelador.json'] }],
    ['load_recovery_snapshot', undefined],
    ['save_recovery_snapshot', { content: '{"version":2}' }],
    ['clear_recovery_snapshot', undefined]
  ]);
});
