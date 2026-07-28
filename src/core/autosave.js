// core/autosave.js
// Lógica pura del autoguardado: sobre versionado, decisión de recuperación y compatibilidad
// con storage web inyectable. El runtime nativo persiste el mismo sobre mediante comandos Rust.

export const AUTOSAVE_KEY = 'modelador-autosave';
export const AUTOSAVE_VERSION = 2;
export const AUTOSAVE_DEBOUNCE_MS = 2000;

export class AutosaveError extends Error {
  constructor(code, message, cause = undefined) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AutosaveError';
    this.code = code;
  }
}

/** Snapshot serializado: {version, timestamp, projectPath, model}. */
export function serializeAutosave(model, timestamp = Date.now(), projectPath = null) {
  return JSON.stringify({
    version: AUTOSAVE_VERSION,
    timestamp,
    projectPath,
    model
  });
}

/** Devuelve el sobre v2 migrado, null si falta y error tipado si existe pero no es válido. */
export function parseAutosave(raw) {
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new AutosaveError(
      'AUTOSAVE_INVALID_JSON',
      'El snapshot de recuperación contiene JSON inválido.',
      error
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AutosaveError(
      'AUTOSAVE_ENVELOPE_INVALID',
      'El snapshot de recuperación no tiene un sobre válido.'
    );
  }
  if (data.version !== 1 && data.version !== AUTOSAVE_VERSION) {
    throw new AutosaveError(
      'AUTOSAVE_VERSION_UNSUPPORTED',
      `La versión ${String(data.version)} del snapshot no es compatible.`
    );
  }
  if (!data.model || typeof data.model !== 'object' || Array.isArray(data.model)) {
    throw new AutosaveError(
      'AUTOSAVE_MODEL_INVALID',
      'El snapshot de recuperación no contiene un modelo válido.'
    );
  }
  const projectPath = data.version === 1 ? null : data.projectPath ?? null;
  if (
    projectPath !== null
    && (typeof projectPath !== 'string' || projectPath.length === 0)
  ) {
    throw new AutosaveError(
      'AUTOSAVE_PATH_INVALID',
      'La ruta asociada al snapshot de recuperación no es válida.'
    );
  }
  return {
    version: AUTOSAVE_VERSION,
    timestamp: Number(data.timestamp) || 0,
    projectPath,
    model: data.model,
    appliedMigrations: data.version === 1 ? ['1->2'] : []
  };
}

/** Modelo "vacío": sin elementos, sin ejes y sin techumbres. No vale la pena ofrecerlo. */
export function isEmptyModel(model) {
  if (!model || typeof model !== 'object') return true;
  const els = model.elements || [];
  const grid = model.grid || {};
  const roofs = model.roofSystems || [];
  return els.length === 0
    && (grid.xAxes || []).length === 0
    && (grid.yAxes || []).length === 0
    && roofs.length === 0;
}

/**
 * ¿Ofrecer recuperar? Solo si el snapshot tiene contenido real y difiere del modelo
 * ya cargado (comparación estructural por JSON: el modelo es inmutable y serializable).
 */
export function shouldOfferRestore(saved, currentModel) {
  if (!saved || !saved.model) return false;
  if (isEmptyModel(saved.model)) return false;
  try {
    return JSON.stringify(saved.model) !== JSON.stringify(currentModel);
  } catch {
    return true; // ante ciclos/errores raros, mejor preguntar que perder trabajo
  }
}

/** Fecha legible para el banner de recuperación. */
export function formatAutosaveTimestamp(timestamp, locale = 'es-CL') {
  if (!timestamp) return 'fecha desconocida';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'fecha desconocida';
  return d.toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Escribe el snapshot. Nunca lanza: si el storage está lleno (QuotaExceededError) devuelve
 * {ok:false} para que el llamador desactive el autosave en vez de romper la app.
 */
export function writeAutosave(storage, model, timestamp = Date.now(), projectPath = null) {
  if (!storage) return { ok: false, error: new Error('storage no disponible') };
  try {
    storage.setItem(AUTOSAVE_KEY, serializeAutosave(model, timestamp, projectPath));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export function readAutosave(storage) {
  if (!storage) return null;
  try {
    return parseAutosave(storage.getItem(AUTOSAVE_KEY));
  } catch {
    return null;
  }
}

export function clearAutosave(storage) {
  if (!storage) return;
  try { storage.removeItem(AUTOSAVE_KEY); } catch { /* no-op */ }
}
