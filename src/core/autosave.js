// core/autosave.js
// Lógica pura del autoguardado: serialización, decisión de recuperación y acceso a storage
// con storage inyectable (localStorage en la app, un fake en los tests).

export const AUTOSAVE_KEY = 'modelador-autosave';
export const AUTOSAVE_VERSION = 1;
export const AUTOSAVE_DEBOUNCE_MS = 2000;

/** Snapshot serializado: {version, timestamp, model}. */
export function serializeAutosave(model, timestamp = Date.now()) {
  return JSON.stringify({ version: AUTOSAVE_VERSION, timestamp, model });
}

/** Devuelve {timestamp, model} o null si falta / está corrupto / es de otra versión. */
export function parseAutosave(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.version !== AUTOSAVE_VERSION) return null;
    if (!data.model || typeof data.model !== 'object') return null;
    return { timestamp: Number(data.timestamp) || 0, model: data.model };
  } catch {
    return null;
  }
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
export function writeAutosave(storage, model, timestamp = Date.now()) {
  if (!storage) return { ok: false, error: new Error('storage no disponible') };
  try {
    storage.setItem(AUTOSAVE_KEY, serializeAutosave(model, timestamp));
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
