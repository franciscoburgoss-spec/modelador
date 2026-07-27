// core/projectParams.js
// Un "parámetro de proyecto" es {id, name, value, unit, description}.
// Los campos numéricos de elementos pueden guardar un número literal (como hoy)
// o una fórmula string que empieza con '=' y referencia parámetros por nombre,
// ej: "=espesor_tabique" o "=espesor_tabique + 20".

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SAFE_EXPR_RE = /^[a-zA-Z0-9_+\-*/().\s]+$/;

// ★ Campos de elemento referenciables en fórmulas derivadas: "=elementId.campo"
const DERIVED_FIELDS = ['thickness', 'widthX', 'widthY', 'width', 'height', 'depth', 'bottomZ', 'topZ', 'levelZ'];
const PLAIN_NUMBER_FIELDS = new Set(['bottomZ', 'topZ', 'levelZ']); // nunca son fórmula
const ELEMENT_FIELD_RE = new RegExp(`([a-zA-Z_][a-zA-Z0-9_]*|\\d+)\\.(${DERIVED_FIELDS.join('|')})\\b`, 'g');

/** Resuelve el campo de OTRO elemento (recursivo, con detección de ciclos vía _visiting). */
function resolveElementField(elementId, field, elementsById, paramsMap, _visiting) {
  const key = `${elementId}.${field}`;
  if (_visiting.has(key)) return NaN; // ciclo
  const el = elementsById[elementId];
  if (!el || el[field] === undefined || el[field] === null) return NaN;
  if (PLAIN_NUMBER_FIELDS.has(field)) return Number(el[field]);
  const nextVisiting = new Set(_visiting);
  nextVisiting.add(key);
  return resolveValue(el[field], paramsMap, elementsById, nextVisiting);
}

export function isValidParamName(name) {
  return NAME_RE.test(name);
}

/** Arma un mapa {nombre: valorNumérico} a partir del array de parámetros del modelo. */
export function buildParamsMap(projectParams) {
  const map = {};
  for (const p of projectParams || []) {
    map[p.name] = Number(p.value) || 0;
  }
  return map;
}

/** true si el valor crudo de un campo es una fórmula (string que empieza con '='). */
export function isFormula(raw) {
  return typeof raw === 'string' && raw.trim().startsWith('=');
}

/**
 * Resuelve un valor crudo de campo a número.
 * - number → se devuelve tal cual.
 * - string "=expr" → evalúa expr sustituyendo nombres de parámetro, o NaN si hay error/nombre desconocido.
 * - cualquier otro string → Number(raw) (compatibilidad con inputs planos).
 */
export function resolveValue(raw, paramsMap, elementsById = {}, _visiting = new Set()) {
  if (typeof raw === 'number') return raw;
  if (!isFormula(raw)) return Number(raw);

  let expr = raw.trim().slice(1).trim();
  if (!expr) return NaN;

  // ★ sustituir "elementId.campo" por su valor numérico antes de evaluar la expresión
  let brokenRef = false;
  expr = expr.replace(ELEMENT_FIELD_RE, (_match, elId, field) => {
    const val = resolveElementField(elId, field, elementsById, paramsMap, _visiting);
    if (!isFinite(val)) { brokenRef = true; return '0'; }
    return `(${val})`;
  });
  if (brokenRef) return NaN;

  if (!SAFE_EXPR_RE.test(expr)) return NaN;

  const usedNames = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  for (const n of usedNames) {
    if (!(n in paramsMap)) return NaN;
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(paramsMap), `"use strict"; return (${expr});`);
    const result = fn(...Object.values(paramsMap));
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

/** Lista de nombres de parámetro referenciados por una fórmula (para mostrar/validar). */
export function extractParamNames(raw) {
  if (!isFormula(raw)) return [];
  const expr = raw.trim().slice(1).trim().replace(ELEMENT_FIELD_RE, '0');
  return [...new Set(expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [])];
}

/** ★ Lista de referencias {elementId, field} a campos de otros elementos en una fórmula. */
export function extractElementFieldRefs(raw) {
  if (!isFormula(raw)) return [];
  const expr = raw.trim().slice(1).trim();
  return [...expr.matchAll(ELEMENT_FIELD_RE)].map(m => ({ elementId: m[1], field: m[2] }));
}

/** ★ Formatea una dimensión (número o fórmula "=param") para mostrar en paneles de solo lectura:
 *  número plano → "150 mm"; fórmula válida → "=espesor_tabique → 140 mm"; fórmula rota → "=x (¡inválida!)".
 *  Antes vivía solo dentro de PropertiesPanel.jsx; ahora es compartida (también la usa AuditModal). */
export function formatDim(raw, paramsMap, elementsById = {}) {
  if (!isFormula(raw)) return `${raw} mm`;
  const resolved = resolveValue(raw, paramsMap, elementsById);
  return isFinite(resolved) ? `${raw} → ${resolved} mm` : `${raw} (¡inválida!)`;
}
