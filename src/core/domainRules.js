// Catálogo puro de reglas constructivas. No lee el modelo ni emite findings: declara metadata y
// resuelve límites a partir del contexto explícito que entregue un check futuro.

import { isWallRole } from './wallRoles.js';

export const RULE_SCOPES = Object.freeze(['sistema', 'proyecto', 'oficina', 'elemento']);
export const RULE_ORIGINS = Object.freeze(['manual', 'derivado', 'obra']);
export const FINDING_SEVERITIES = Object.freeze(['error', 'warning', 'info']);

const RULE_ID = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;
const EDGE_DISTANCE_MM = 10;
const CINTAC_METALCON_SOURCE = {
  doc: 'Manual de Diseño Metalcon',
  ed: '2020',
  seccion: '§1.5.2, §1.5.2.1 y Anexo IV',
  url: 'https://www.cintac.cl/wp-content/uploads/2023/08/Manual-de-Diseno-Metalcon.pdf',
  consultado: '2026-07-27'
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function deepFreeze(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (typeof value === 'function') return Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertSource(rule) {
  if (rule.origen === 'manual') {
    if (!isRecord(rule.fuente)) {
      throw new TypeError(`La regla manual ${rule.id} requiere fuente estructurada.`);
    }
    for (const field of ['doc', 'ed', 'seccion', 'url', 'consultado']) {
      if (!nonEmptyString(rule.fuente[field])) {
        throw new TypeError(`La fuente de ${rule.id} requiere ${field}.`);
      }
    }
    let url;
    try {
      url = new URL(rule.fuente.url);
    } catch {
      throw new TypeError(`La fuente de ${rule.id} tiene una URL inválida.`);
    }
    if (url.protocol !== 'https:') {
      throw new TypeError(`La fuente de ${rule.id} debe usar HTTPS.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.fuente.consultado)) {
      throw new TypeError(`La fuente de ${rule.id} requiere fecha de consulta YYYY-MM-DD.`);
    }
  }

  if (rule.origen === 'obra') {
    if (rule.fuente !== null) {
      throw new TypeError(`La regla de obra ${rule.id} no puede declarar fuente normativa.`);
    }
    if (rule.severity !== 'info') {
      throw new TypeError(`La regla de obra ${rule.id} tiene severidad máxima info.`);
    }
  }
}

/** Valida un catálogo antes de publicarlo. Lanza ante un contrato incoherente. */
export function assertValidDomainRules(catalog) {
  if (!isRecord(catalog)) throw new TypeError('El catálogo de reglas debe ser un objeto.');
  const entries = Object.entries(catalog);

  for (const [key, rule] of entries) {
    if (!isRecord(rule)) throw new TypeError(`La regla ${key} debe ser un objeto.`);
    if (key !== rule.id) {
      throw new TypeError(`El id ${rule.id || '(ausente)'} no coincide con la clave ${key}.`);
    }
    if (!RULE_ID.test(rule.id)) {
      throw new TypeError(`El id de regla ${rule.id} debe tener tres niveles.`);
    }
    if (!nonEmptyString(rule.titulo)) throw new TypeError(`La regla ${rule.id} requiere titulo.`);
    if (!nonEmptyString(rule.descripcion)) {
      throw new TypeError(`La regla ${rule.id} requiere descripcion.`);
    }
    if (!RULE_SCOPES.includes(rule.scope)) {
      throw new TypeError(`La regla ${rule.id} tiene scope inválido.`);
    }
    if (!RULE_ORIGINS.includes(rule.origen)) {
      throw new TypeError(`La regla ${rule.id} tiene origen inválido.`);
    }
    if (!FINDING_SEVERITIES.includes(rule.severity)) {
      throw new TypeError(`La regla ${rule.id} tiene severity inválido.`);
    }
    if (!nonEmptyString(rule.unidad)) throw new TypeError(`La regla ${rule.id} requiere unidad.`);
    if (
      !Array.isArray(rule.aplicaA)
      || rule.aplicaA.length === 0
      || rule.aplicaA.some((role) => !isWallRole(role))
      || new Set(rule.aplicaA).size !== rule.aplicaA.length
    ) {
      throw new TypeError(`La regla ${rule.id} requiere aplicaA con roles válidos y únicos.`);
    }
    if (!Array.isArray(rule.dependsOn) || rule.dependsOn.some((id) => !nonEmptyString(id))) {
      throw new TypeError(`La regla ${rule.id} requiere dependsOn como array de ids.`);
    }
    if (new Set(rule.dependsOn).size !== rule.dependsOn.length) {
      throw new TypeError(`La regla ${rule.id} repite una dependencia.`);
    }
    if (typeof rule.resolveLimit !== 'function') {
      throw new TypeError(`La regla ${rule.id} requiere resolveLimit puro.`);
    }
    assertSource(rule);
  }

  const ids = new Set(entries.map(([key]) => key));
  for (const [, rule] of entries) {
    for (const dependency of rule.dependsOn) {
      if (!ids.has(dependency)) {
        throw new TypeError(`La dependencia ${dependency} de ${rule.id} no existe.`);
      }
      if (dependency === rule.id) {
        throw new TypeError(`La regla ${rule.id} no puede depender de sí misma.`);
      }
    }
  }
  return catalog;
}

const catalog = {
  'osb.tornillo.borde': {
    id: 'osb.tornillo.borde',
    titulo: 'Distancia de fijación al borde del tablero',
    descripcion: 'Las fijaciones de OSB deben quedar al menos a 10 mm del borde del tablero.',
    scope: 'sistema',
    origen: 'manual',
    severity: 'error',
    unidad: 'mm',
    fuente: {
      doc: 'Manual Práctico de Construcción LP — Anexo 3 Metalcon',
      ed: 'sin edición declarada',
      seccion: '2.3 Fijaciones, p. 259',
      url: 'https://lpchile.cl/wp-content/uploads/2017/08/03_ANEXO_METALCON-253_268.pdf',
      consultado: '2026-07-27'
    },
    aplicaA: ['MP1'],
    dependsOn: [],
    resolveLimit: () => ({ min: EDGE_DISTANCE_MM, unit: 'mm' })
  },
  'osb.cadeneta.ala': {
    id: 'osb.cadeneta.ala',
    titulo: 'Ala útil de cadeneta en junta horizontal',
    descripcion: 'El ala debe recibir dos distancias de borde más el gap efectivo entre placas.',
    scope: 'sistema',
    origen: 'derivado',
    severity: 'error',
    unidad: 'mm',
    fuente: null,
    aplicaA: ['MP1'],
    dependsOn: ['osb.tornillo.borde'],
    resolveLimit: ({ gap } = {}) => (
      Number.isFinite(gap) && gap >= 0
        ? { min: 2 * EDGE_DISTANCE_MM + gap, unit: 'mm' }
        : null
    )
  },
  'muro.vano.holguraManilla': {
    id: 'muro.vano.holguraManilla',
    titulo: 'Holgura lateral para manilla de puerta',
    descripcion: 'El borde del vano guarda entre 50 y 60 mm de la cara del muro perpendicular.',
    scope: 'proyecto',
    origen: 'obra',
    severity: 'info',
    unidad: 'mm',
    fuente: null,
    aplicaA: ['MP1', 'MP2', 'MP3', 'tabique'],
    dependsOn: [],
    resolveLimit: () => ({ min: 50, max: 60, unit: 'mm' })
  },
  'muro.montante.paso': {
    id: 'muro.montante.paso',
    titulo: 'Paso máximo de montantes',
    descripcion: 'El paso configurado de montantes no supera el máximo del rol de panel.',
    scope: 'sistema',
    origen: 'manual',
    severity: 'error',
    unidad: 'mm',
    fuente: CINTAC_METALCON_SOURCE,
    aplicaA: ['MP1', 'MP2'],
    dependsOn: [],
    resolveLimit: ({ role } = {}) => (
      role === 'MP1'
        ? { max: 610, unit: 'mm' }
        : role === 'MP2'
          ? { max: 600, unit: 'mm' }
          : null
    )
  },
  'muro.jamba.distanciaMontante': {
    id: 'muro.jamba.distanciaMontante',
    titulo: 'Distancia entre montante regular y jamba',
    descripcion: 'La separación eje a eje menor a 150 mm requiere coordinación de oficina.',
    scope: 'oficina',
    origen: 'obra',
    severity: 'info',
    unidad: 'mm',
    fuente: null,
    aplicaA: ['MP1', 'MP2', 'MP3', 'tabique'],
    dependsOn: [],
    resolveLimit: () => ({ min: 150, unit: 'mm' })
  },
  'muro.dintel.llegadaCercha': {
    id: 'muro.dintel.llegadaCercha',
    titulo: 'Coincidencia de llegada de cercha con jamba',
    descripcion: 'La llegada de cercha sobre un vano coincide con el pie derecho del dintel.',
    scope: 'sistema',
    origen: 'manual',
    severity: 'error',
    unidad: 'mm',
    fuente: CINTAC_METALCON_SOURCE,
    aplicaA: ['MP1', 'MP2', 'MP3'],
    dependsOn: [],
    resolveLimit: ({ flangeWidth } = {}) => (
      Number.isFinite(flangeWidth) && flangeWidth > 0
        ? { max: flangeWidth / 2, unit: 'mm' }
        : null
    )
  },
  'muro.panel.largo': {
    id: 'muro.panel.largo',
    titulo: 'Largo nominal del panel de muro',
    descripcion: 'El largo estructural nominal respeta el rango definido para MP2 o MP3.',
    scope: 'elemento',
    origen: 'manual',
    severity: 'error',
    unidad: 'mm',
    fuente: CINTAC_METALCON_SOURCE,
    aplicaA: ['MP2', 'MP3'],
    dependsOn: [],
    resolveLimit: ({ role } = {}) => (
      role === 'MP2'
        ? { min: 3000, max: 5000, unit: 'mm' }
        : role === 'MP3'
          ? { max: 5000, unit: 'mm' }
          : null
    )
  },
  'muro.corte.capacidadOsb': {
    id: 'muro.corte.capacidadOsb',
    titulo: 'Capacidad admisible de corte del OSB',
    descripcion: 'El OSB estructural verificable aporta 417 kgf/m por una cara.',
    scope: 'proyecto',
    origen: 'manual',
    severity: 'info',
    unidad: 'kgf/m',
    fuente: CINTAC_METALCON_SOURCE,
    aplicaA: ['MP1'],
    dependsOn: [],
    resolveLimit: () => ({ equal: 417, unit: 'kgf/m' })
  }
};

assertValidDomainRules(catalog);
export const DOMAIN_RULES = deepFreeze(catalog);

/** Devuelve la regla inmutable o null si el id no está declarado. */
export function getDomainRule(ruleId) {
  return Object.hasOwn(DOMAIN_RULES, ruleId) ? DOMAIN_RULES[ruleId] : null;
}

/** Comprueba aplicación exacta; un rol ausente nunca satisface una regla condicionada. */
export function ruleAppliesToRole(ruleId, role) {
  const rule = getDomainRule(ruleId);
  if (!rule) throw new TypeError(`Regla inexistente: ${ruleId}.`);
  if (role == null) return false;
  if (!isWallRole(role)) throw new TypeError(`Role de muro inválido: ${role}.`);
  return rule.aplicaA.includes(role);
}

function normalizedLimit(limit, ruleId) {
  if (limit === null) return null;
  if (!isRecord(limit) || !nonEmptyString(limit.unit)) {
    throw new TypeError(`resolveLimit de ${ruleId} devolvió un límite inválido.`);
  }
  const bounds = ['min', 'max', 'equal'].filter((field) => Object.hasOwn(limit, field));
  if (bounds.length === 0 || bounds.some((field) => !Number.isFinite(limit[field]))) {
    throw new TypeError(`resolveLimit de ${ruleId} devolvió un límite no finito.`);
  }
  if (Object.hasOwn(limit, 'equal') && bounds.length > 1) {
    throw new TypeError(`resolveLimit de ${ruleId} mezcló equal con un rango.`);
  }
  if (Object.hasOwn(limit, 'min') && Object.hasOwn(limit, 'max') && limit.min > limit.max) {
    throw new TypeError(`resolveLimit de ${ruleId} devolvió min mayor que max.`);
  }
  return Object.freeze({
    ...Object.fromEntries(bounds.map((field) => [field, limit[field]])),
    unit: limit.unit
  });
}

/** Resuelve el límite con contexto explícito; nunca agrega defaults de proyecto. */
export function resolveRuleLimit(ruleId, context = {}) {
  const rule = getDomainRule(ruleId);
  if (!rule) throw new TypeError(`Regla inexistente: ${ruleId}.`);
  return normalizedLimit(rule.resolveLimit(context), ruleId);
}
