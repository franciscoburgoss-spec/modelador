import { randomUUID } from 'node:crypto';
import {
  constants,
  copyFile,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  readFile
} from 'node:fs/promises';
import path from 'node:path';

function assertTargetPath(targetPath) {
  if (typeof targetPath !== 'string' || targetPath.length === 0) {
    throw new TypeError('La ruta de proyecto debe ser texto no vacío.');
  }
}

function assertBackupLimit(backupLimit) {
  if (!Number.isSafeInteger(backupLimit) || backupLimit < 0) {
    throw new TypeError('El límite de backups debe ser un entero no negativo.');
  }
}

async function syncDirectory(directory) {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function targetExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function orderedBackupNames(entries) {
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.bak'))
    .map((entry) => entry.name)
    .sort();
}

async function pruneBackups(backupDirectory, backupLimit) {
  const names = orderedBackupNames(await readdir(backupDirectory, { withFileTypes: true }));
  const expired = names.slice(0, Math.max(0, names.length - backupLimit));
  await Promise.all(expired.map((name) => rm(path.join(backupDirectory, name))));
  if (expired.length > 0) await syncDirectory(backupDirectory);
}

function backupIdentifier() {
  const timestamp = String(Date.now()).padStart(13, '0');
  const monotonic = String(process.hrtime.bigint()).padStart(20, '0');
  return `${timestamp}-${monotonic}-${randomUUID()}`;
}

async function backupCurrentTarget(targetPath, backupLimit) {
  if (backupLimit === 0) return;
  const backupDirectory = projectBackupDirectory(targetPath);
  await mkdir(backupDirectory, { recursive: true });
  const identifier = backupIdentifier();
  const temporaryPath = path.join(backupDirectory, `.backup-${identifier}.tmp`);
  const backupPath = path.join(backupDirectory, `backup-${identifier}.bak`);
  let published = false;
  try {
    await copyFile(targetPath, temporaryPath, constants.COPYFILE_EXCL);
    const handle = await open(temporaryPath, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, backupPath);
    published = true;
    await syncDirectory(backupDirectory);
    await pruneBackups(backupDirectory, backupLimit);
  } finally {
    if (!published) await rm(temporaryPath, { force: true });
  }
}

export function projectBackupDirectory(targetPath) {
  assertTargetPath(targetPath);
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.backups`);
}

export function createNodeProjectFileSystem({ afterTempFileSynced } = {}) {
  if (afterTempFileSynced !== undefined && typeof afterTempFileSynced !== 'function') {
    throw new TypeError('afterTempFileSynced debe ser una función.');
  }

  return {
    readText: (targetPath) => {
      assertTargetPath(targetPath);
      return readFile(targetPath, 'utf8');
    },

    async writeTextAtomic(targetPath, content, { backupLimit = 10 } = {}) {
      assertTargetPath(targetPath);
      if (typeof content !== 'string') {
        throw new TypeError('El contenido del proyecto debe ser texto.');
      }
      assertBackupLimit(backupLimit);

      const directory = path.dirname(targetPath);
      const temporaryPath = path.join(
        directory,
        `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
      );
      let handle;
      let published = false;
      try {
        handle = await open(temporaryPath, 'wx', 0o600);
        await handle.writeFile(content, 'utf8');
        await handle.sync();
        const syncedHandle = handle;
        handle = undefined;
        await syncedHandle.close();

        if (afterTempFileSynced) {
          await afterTempFileSynced({ targetPath, tempPath: temporaryPath });
        }
        if (await targetExists(targetPath)) {
          await backupCurrentTarget(targetPath, backupLimit);
        }
        await rename(temporaryPath, targetPath);
        published = true;
        await syncDirectory(directory);
      } finally {
        if (handle) await handle.close();
        if (!published) await rm(temporaryPath, { force: true });
      }
    }
  };
}
