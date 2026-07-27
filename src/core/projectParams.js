// core/projectParams.js
// Un "parámetro de proyecto" es {id, name, value, unit, description}.
// Los campos numéricos de elementos pueden guardar un número literal (como hoy)
// o una fórmula string que empieza con '=' y referencia parámetros por nombre,
// ej: "=espesor_tabique" o "=espesor_tabique + 20".

import {
  evaluateNumericExpression, parseNumericExpression, walkNumericAst
} from './numericExpression.js';

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RESERVED_NAMES = new Set([
  '__proto__',
  'constructor',
  'document',
  'eval',
  'Function',
  'globalThis',
  'localStorage',
  'prototype',
  'self',
  'window'
]);
const MAX_REFERENCE_DEPTH = 64;

// ★ Campos de elemento referenciables en fórmulas derivadas: "=elementId.campo"
const DERIVED_FIELDS = ['thickness', 'widthX', 'widthY', 'width', 'height', 'depth', 'bottomZ', 'topZ', 'levelZ'];
const PLAIN_NUMBER_FIELDS = new Set(['bottomZ', 'topZ', 'levelZ']); // nunca son fórmula

/** Resuelve el campo de OTRO elemento con detección de ciclos y límite de profundidad. */
function resolveElementField(elementId, field, elementsById, paramsMap, context) {
  if (!DERIVED_FIELDS.includes(field)) return NaN;
  if (context.referenceDepth >= MAX_REFERENCE_DEPTH) return NaN;
  const key = `${elementId}.${field}`;
  if (context.visiting.has(key)) return NaN;
  if (!Object.hasOwn(elementsById, elementId)) return NaN;
  const el = elementsById[elementId];
  if (!el || el[field] === undefined || el[field] === null) return NaN;
  if (PLAIN_NUMBER_FIELDS.has(field)) {
    const value = Number(el[field]);
    return Number.isFinite(value) ? value : NaN;
  }
  const nextVisiting = new Set(context.visiting);
  nextVisiting.add(key);
  return resolveValue(el[field], paramsMap, elementsById, {
    visiting: nextVisiting,
    referenceDepth: context.referenceDepth + 1
  });
}

export function isValidParamName(name) {
  return NAME_RE.test(name) && !RESERVED_NAMES.has(name);
}

/** Arma un mapa {nombre: valorNumérico} a partir del array de parámetros del modelo. */
export function buildParamsMap(projectParams) {
  const map = Object.create(null);
  for (const p of projectParams || []) {
    if (!p || !isValidParamName(p.name)) continue;
    const value = Number(p.value);
    map[p.name] = Number.isFinite(value) ? value : 0;
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
export function resolveValue(raw, paramsMap, elementsById = {}, context = null) {
  if (typeof raw === 'number') return raw;
  if (!isFormula(raw)) return Number(raw);

  const expr = raw.trim().slice(1).trim();
  if (!expr) return NaN;

  try {
    const resolutionContext = context || { visiting: new Set(), referenceDepth: 0 };
    return evaluateNumericExpression(expr, {
      resolveIdentifier: (name) => (
        isValidParamName(name) && Object.hasOwn(paramsMap, name) ? paramsMap[name] : NaN
      ),
      resolveReference: (elementId, field) => (
        resolveElementField(elementId, field, elementsById, paramsMap, resolutionContext)
      )
    });
  } catch {
    return NaN;
  }
}

/** Lista de nombres de parámetro referenciados por una fórmula (para mostrar/validar). */
export function extractParamNames(raw) {
  if (!isFormula(raw)) return [];
  try {
    const names = new Set();
    walkNumericAst(parseNumericExpression(raw.trim().slice(1).trim()), (node) => {
      if (node.type === 'identifier') names.add(node.name);
    });
    return [...names];
  } catch {
    return [];
  }
}

/** ★ Lista de referencias {elementId, field} a campos de otros elementos en una fórmula. */
export function extractElementFieldRefs(raw) {
  if (!isFormula(raw)) return [];
  try {
    const references = [];
    walkNumericAst(parseNumericExpression(raw.trim().slice(1).trim()), (node) => {
      if (node.type === 'reference' && DERIVED_FIELDS.includes(node.field)) {
        references.push({ elementId: node.elementId, field: node.field });
      }
    });
    return references;
  } catch {
    return [];
  }
}

/** ★ Formatea una dimensión (número o fórmula "=param") para mostrar en paneles de solo lectura:
 *  número plano → "150 mm"; fórmula válida → "=espesor_tabique → 140 mm"; fórmula rota → "=x (¡inválida!)".
 *  Antes vivía solo dentro de PropertiesPanel.jsx; ahora es compartida (también la usa AuditModal). */
export function formatDim(raw, paramsMap, elementsById = {}) {
  if (!isFormula(raw)) return `${raw} mm`;
  const resolved = resolveValue(raw, paramsMap, elementsById);
  return isFinite(resolved) ? `${raw} → ${resolved} mm` : `${raw} (¡inválida!)`;
}
