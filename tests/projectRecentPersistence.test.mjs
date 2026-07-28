import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hydrateProjectRuntimeRecents,
  persistProjectRuntimeRecents
} from '../src/adapters/projectRecentPersistence.js';

function actions() {
  const calls = [];
  return {
    calls,
    hydrateProjectRecentPaths: (paths) => calls.push(['hydrate', paths]),
    reportProjectOperationError: (error) => calls.push(['error', error])
  };
}

test('SPEC-004-C: coordina hidratación y persistencia sin conocer Tauri', async () => {
  const target = actions();
  const saved = [];
  const runtime = {
    loadRecentPaths: async () => ['/p/uno.modelador.json'],
    saveRecentPaths: async (paths) => { saved.push(paths); }
  };

  assert.equal(await hydrateProjectRuntimeRecents(runtime, target), true);
  assert.deepEqual(target.calls, [['hydrate', ['/p/uno.modelador.json']]]);

  assert.equal(await persistProjectRuntimeRecents(
    runtime,
    ['/p/dos.modelador.json', '/p/uno.modelador.json'],
    target
  ), true);
  assert.deepEqual(saved, [['/p/dos.modelador.json', '/p/uno.modelador.json']]);
});

test('SPEC-004-C: fallos auxiliares quedan tipados y no se confunden con el archivo principal', async () => {
  const hydrateTarget = actions();
  const persistTarget = actions();

  assert.equal(await hydrateProjectRuntimeRecents({
    loadRecentPaths: async () => { throw new Error('settings roto'); }
  }, hydrateTarget), false);
  assert.equal(hydrateTarget.calls[0][0], 'error');
  assert.equal(hydrateTarget.calls[0][1].code, 'RECENT_PROJECTS_READ_FAILED');
  assert.match(hydrateTarget.calls[0][1].message, /recientes/);

  assert.equal(await persistProjectRuntimeRecents({
    saveRecentPaths: async () => { throw new Error('disco lleno'); }
  }, ['/p/guardado.modelador.json'], persistTarget), false);
  assert.equal(persistTarget.calls[0][0], 'error');
  assert.equal(persistTarget.calls[0][1].code, 'RECENT_PROJECTS_WRITE_FAILED');
  assert.match(persistTarget.calls[0][1].message, /operación del proyecto terminó/);
});
