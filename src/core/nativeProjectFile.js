import {
  prepareModelImport,
  prepareModelJsonImport
} from './modelSchema.js';

export const NATIVE_PROJECT_BACKUP_LIMIT = 10;

export class NativeProjectError extends Error {
  constructor(code, message, cause = undefined) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'NativeProjectError';
    this.code = code;
  }
}

function assertProjectFileSystem(fileSystem) {
  if (
    !fileSystem
    || typeof fileSystem.readText !== 'function'
    || typeof fileSystem.writeTextAtomic !== 'function'
  ) {
    throw new NativeProjectError(
      'INVALID_PROJECT_PORT',
      'La persistencia nativa exige las operaciones readText y writeTextAtomic.'
    );
  }
}

export function serializeNativeProject(model) {
  const prepared = prepareModelImport(model);
  return `${JSON.stringify(prepared.model, null, 2)}\n`;
}

export async function openNativeProject(fileSystem, projectPath) {
  assertProjectFileSystem(fileSystem);
  let raw;
  try {
    raw = await fileSystem.readText(projectPath);
  } catch (error) {
    throw new NativeProjectError(
      'PROJECT_READ_FAILED',
      'No se pudo leer el archivo del proyecto.',
      error
    );
  }
  return {
    path: projectPath,
    prepared: prepareModelJsonImport(raw)
  };
}

export async function saveNativeProject(fileSystem, projectPath, model) {
  assertProjectFileSystem(fileSystem);
  const content = serializeNativeProject(model);
  try {
    await fileSystem.writeTextAtomic(projectPath, content, {
      backupLimit: NATIVE_PROJECT_BACKUP_LIMIT
    });
  } catch (error) {
    throw new NativeProjectError(
      'PROJECT_WRITE_FAILED',
      'No se pudo guardar el archivo del proyecto.',
      error
    );
  }
  return { path: projectPath };
}
