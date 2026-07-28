import {
  prepareModelImport,
  prepareModelJsonImport
} from './modelSchema.js';
import {
  AUTOSAVE_KEY,
  parseAutosave
} from './autosave.js';

export const LEGACY_PROJECT_STORAGE_KEY = 'modelador-structural-v1';

function errorRecord(sourceKey, error) {
  return {
    sourceKey,
    code: typeof error?.code === 'string' ? error.code : 'LEGACY_STORAGE_READ_FAILED',
    message: error instanceof Error
      ? error.message
      : 'No se pudo leer una copia heredada del navegador.'
  };
}

function candidateIdentity(model) {
  return JSON.stringify(model);
}

export function inspectLegacyProjectCandidates(storage) {
  if (!storage) return { candidates: [], errors: [] };
  const candidates = [];
  const errors = [];

  const inspect = (sourceKey, buildCandidate) => {
    let raw;
    try {
      raw = storage.getItem(sourceKey);
    } catch (error) {
      errors.push(errorRecord(sourceKey, error));
      return;
    }
    if (!raw) return;
    try {
      candidates.push(buildCandidate(raw));
    } catch (error) {
      errors.push(errorRecord(sourceKey, error));
    }
  };

  inspect(AUTOSAVE_KEY, (raw) => {
    const autosave = parseAutosave(raw);
    const prepared = prepareModelImport(autosave.model);
    return {
      id: 'browser-autosave',
      label: 'Sesión sin guardar del navegador',
      timestamp: autosave.timestamp,
      model: prepared.model,
      sourceKeys: [AUTOSAVE_KEY]
    };
  });

  inspect(LEGACY_PROJECT_STORAGE_KEY, (raw) => {
    const prepared = prepareModelJsonImport(raw);
    return {
      id: 'browser-project',
      label: 'Copia guardada en el navegador',
      timestamp: 0,
      model: prepared.model,
      sourceKeys: [LEGACY_PROJECT_STORAGE_KEY]
    };
  });

  const unique = [];
  for (const candidate of candidates) {
    const identity = candidateIdentity(candidate.model);
    const existing = unique.find((entry) => entry.identity === identity);
    if (existing) {
      existing.candidate.sourceKeys.push(...candidate.sourceKeys);
      continue;
    }
    unique.push({ identity, candidate });
  }

  return {
    candidates: unique.map((entry) => entry.candidate),
    errors
  };
}

export function removeLegacyProjectCandidate(storage, candidate) {
  if (!storage || !Array.isArray(candidate?.sourceKeys)) return;
  for (const sourceKey of candidate.sourceKeys) {
    storage.removeItem(sourceKey);
  }
}
