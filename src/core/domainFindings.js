// Constructor canónico de findings. Mantiene el shape legacy cuando no se entregan campos de
// dominio y valida que las extensiones numéricas/navegables sean explícitas.

import { FINDING_SEVERITIES, getDomainRule } from './domainRules.js';
import { hasOwn } from './hasOwn.js';

const ID_FIELDS = ['elementIds', 'wallIds', 'roofSystemIds', 'roofPlaneIds'];
const SEVERITY_RANK = { info: 0, warning: 1, error: 2 };

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeMeasured(measured) {
  if (measured === null) return null;
  if (
    !isRecord(measured)
    || !Number.isFinite(measured.value)
    || !nonEmptyString(measured.unit)
  ) {
    throw new TypeError('measured debe ser null o { value finito, unit }.');
  }
  return { value: measured.value, unit: measured.unit };
}

function normalizeLimit(limit) {
  if (limit === null) return null;
  if (!isRecord(limit) || !nonEmptyString(limit.unit)) {
    throw new TypeError('limit debe ser null o un objeto numérico con unit.');
  }
  const allowed = new Set(['min', 'max', 'equal', 'exclusiveMin', 'unit']);
  if (Object.keys(limit).some((field) => !allowed.has(field))) {
    throw new TypeError('limit contiene campos no reconocidos.');
  }
  const bounds = ['min', 'max', 'equal', 'exclusiveMin']
    .filter((field) => hasOwn(limit, field));
  if (bounds.length === 0 || bounds.some((field) => !Number.isFinite(limit[field]))) {
    throw new TypeError('limit requiere min, max, equal o exclusiveMin finito.');
  }
  if (hasOwn(limit, 'equal') && bounds.length > 1) {
    throw new TypeError('limit no puede mezclar equal con otros límites.');
  }
  if (hasOwn(limit, 'exclusiveMin') && bounds.length > 1) {
    throw new TypeError('limit no puede mezclar exclusiveMin con otros límites.');
  }
  if (hasOwn(limit, 'min') && hasOwn(limit, 'max') && limit.min > limit.max) {
    throw new TypeError('limit no puede tener min mayor que max.');
  }
  return {
    ...Object.fromEntries(bounds.map((field) => [field, limit[field]])),
    unit: limit.unit
  };
}

function normalizeIds(field, value) {
  if (!Array.isArray(value)) throw new TypeError(`${field} debe ser un array.`);
  for (const id of value) {
    const validString = typeof id === 'string' && id.length > 0;
    const validNumber = typeof id === 'number' && Number.isFinite(id);
    if (!validString && !validNumber) {
      throw new TypeError(`${field} sólo admite ids string o numéricos.`);
    }
  }
  return [...value];
}

/**
 * Crea un finding compatible con los productores legacy o extendido con una regla de dominio.
 * Los campos ausentes no se materializan, para preservar comparaciones deepEqual existentes.
 */
export function createFinding(input) {
  if (!isRecord(input)) throw new TypeError('El finding debe ser un objeto.');
  if (hasOwn(input, 'ids')) {
    throw new TypeError('No existe un campo ids genérico; usa ids tipados.');
  }
  if (!nonEmptyString(input.category)) throw new TypeError('El finding requiere category.');
  if (!nonEmptyString(input.message)) throw new TypeError('El finding requiere message.');

  let rule = null;
  if (hasOwn(input, 'rule')) {
    if (!nonEmptyString(input.rule) || !(rule = getDomainRule(input.rule))) {
      throw new TypeError(`Regla inexistente: ${input.rule}.`);
    }
  }

  const severity = input.severity ?? rule?.severity;
  if (!FINDING_SEVERITIES.includes(severity)) {
    throw new TypeError('El finding requiere un severity válido.');
  }
  if (rule && SEVERITY_RANK[severity] > SEVERITY_RANK[rule.severity]) {
    throw new TypeError(`La regla ${rule.id} tiene severidad máxima ${rule.severity}.`);
  }

  const finding = {
    severity,
    category: input.category,
    message: input.message
  };

  if (rule) finding.rule = rule.id;

  if (hasOwn(input, 'stage')) {
    if (!nonEmptyString(input.stage)) {
      throw new TypeError('stage debe ser un string no vacío.');
    }
    finding.stage = input.stage;
  }

  if (hasOwn(input, 'measured')) {
    finding.measured = normalizeMeasured(input.measured);
  }
  if (hasOwn(input, 'limit')) {
    finding.limit = normalizeLimit(input.limit);
  }
  if (
    finding.measured !== null
    && finding.measured !== undefined
    && finding.limit !== null
    && finding.limit !== undefined
    && finding.measured.unit !== finding.limit.unit
  ) {
    throw new TypeError('measured y limit deben usar la misma unidad.');
  }

  for (const field of ID_FIELDS) {
    if (hasOwn(input, field)) finding[field] = normalizeIds(field, input[field]);
  }
  return finding;
}
