import { readFile } from 'node:fs/promises';

import { createNodeProjectFileSystem } from '../../src/adapters/nodeProjectFileSystem.js';

const targetPath = process.argv[2];

if (!targetPath || typeof process.send !== 'function') {
  throw new Error('El helper exige una ruta explícita y un canal IPC.');
}

const current = JSON.parse(await readFile(targetPath, 'utf8'));
const replacement = `${JSON.stringify({
  ...current,
  interruptionProbe: 'replacement-not-published'
}, null, 2)}\n`;
const fileSystem = createNodeProjectFileSystem({
  afterTempFileSynced: async ({ tempPath }) => {
    process.channel?.ref();
    process.send({ status: 'temp-synced', tempPath });
    await new Promise(() => {});
  }
});

await fileSystem.writeTextAtomic(targetPath, replacement, { backupLimit: 10 });
