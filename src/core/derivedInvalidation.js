// Invalidación de resultados derivados persistidos (wall.studs/headers, wall.osbCourses,
// roofSystem.trussGeometry). Al editar la geometría de un muro o la grilla, esos despieces
// dejan de corresponder al modelo pero siguen guardados: se marcan como "stale" en vez de
// borrarse, para que el usuario decida cuándo regenerar sin perder trabajo.
// Lógica pura: no toca React ni el store, se testea con node --test.

import { getWallDisplayName } from './naming.js';

export const DERIVED_REGISTRY = Object.freeze({
  wallFraming: Object.freeze({
    entity: 'wall',
    staleField: 'studsStale',
    dataFields: Object.freeze(['studs', 'headers']),
    label: 'modulación Metalcon'
  }),
  wallOsb: Object.freeze({
    entity: 'wall',
    staleField: 'osbStale',
    dataFields: Object.freeze(['osbCourses', 'osbNoggings']),
    dependsOn: Object.freeze(['wallFraming']),
    label: 'despiece OSB'
  }),
  roofTruss: Object.freeze({
    entity: 'roofSystem',
    staleField: 'stale',
    dataFields: Object.freeze(['trussGeometry', 'trussPositions']),
    label: 'geometría de cerchas'
  })
});

// Matriz revisable de comandos persistentes. Un dominio con `derivatives: []` declara
// explícitamente que sus salidas se resuelven en vivo y que no tiene caché que invalidar.
export const MUTATION_DEPENDENCIES = Object.freeze({
  projectParams: Object.freeze({
    scope: 'all',
    derivatives: Object.freeze(['wallFraming', 'wallOsb', 'roofTruss'])
  }),
  library: Object.freeze({
    scope: 'all',
    derivatives: Object.freeze(['wallFraming', 'wallOsb', 'roofTruss'])
  }),
  gridGeometry: Object.freeze({
    scope: 'all',
    derivatives: Object.freeze(['wallFraming', 'wallOsb', 'roofTruss'])
  }),
  wallGeometry: Object.freeze({
    scope: 'wall',
    derivatives: Object.freeze(['wallFraming', 'wallOsb', 'roofTruss'])
  }),
  wallOpenings: Object.freeze({
    scope: 'wall',
    derivatives: Object.freeze(['wallFraming', 'wallOsb', 'roofTruss'])
  }),
  wallRemoval: Object.freeze({
    scope: 'dependentRoof',
    derivatives: Object.freeze(['roofTruss'])
  }),
  wallTopology: Object.freeze({
    scope: 'removedWalls',
    derivatives: Object.freeze(['roofTruss'])
  }),
  foundationGeometry: Object.freeze({
    scope: 'none',
    derivatives: Object.freeze([])
  }),
  roofSystemConfig: Object.freeze({
    scope: 'roofSystem',
    derivatives: Object.freeze(['roofTruss'])
  }),
  roofPlaneConfig: Object.freeze({
    scope: 'none',
    derivatives: Object.freeze([])
  }),
  osbDefaults: Object.freeze({
    scope: 'all',
    derivatives: Object.freeze(['wallOsb'])
  }),
  metalconDefaults: Object.freeze({
    scope: 'all',
    derivatives: Object.freeze(['wallFraming', 'wallOsb'])
  })
});

export function renderMutationMatrixMarkdown() {
  const rows = Object.entries(MUTATION_DEPENDENCIES).map(([mutation, dependency]) => {
    const derivatives = dependency.derivatives.length > 0
      ? dependency.derivatives.join(', ')
      : 'ninguno (resolución en vivo)';
    return `| \`${mutation}\` | \`${dependency.scope}\` | ${derivatives} |`;
  });
  return [
    '# Matriz de mutadores y derivados',
    '',
    '> Generada desde `MUTATION_DEPENDENCIES` en `src/core/derivedInvalidation.js`.',
    '',
    '| Mutador | Alcance | Derivados invalidados |',
    '|---|---|---|',
    ...rows,
    ''
  ].join('\n');
}

// Campos geométricos de muro que también cambian los sistemas de cerchas que lo usan de apoyo.
export const WALL_SYSTEM_GEOMETRY_FIELDS = [
  'xStart', 'xEnd', 'yStart', 'yEnd',
  'bottomZ', 'topZ',
  'thickness', 'direction',
  'sectionId', 'openings'
];

// Campos de configuración cuyo cambio vuelve obsoleto al menos un resultado del muro.
export const WALL_GEOMETRY_FIELDS = [
  ...WALL_SYSTEM_GEOMETRY_FIELDS,
  'framingStudProfileId', 'framingTrackProfileId', 'framingMaterialId', 'studSpacing',
  'osbPanelWidth', 'osbPanelHeight', 'osbMinPanelWidth', 'osbGap'
];

/** ¿El patch de updateElement toca geometría relevante? */
export function patchInvalidatesWall(patch) {
  if (!patch) return false;
  return WALL_GEOMETRY_FIELDS.some((f) => Object.hasOwn(patch, f));
}

export function patchInvalidatesRoofSystemsForWall(patch) {
  if (!patch) return false;
  return WALL_SYSTEM_GEOMETRY_FIELDS.some((field) => Object.hasOwn(patch, field));
}

export const DERIVED_WRITE_FIELDS = Object.freeze(
  [...new Set(Object.values(DERIVED_REGISTRY).flatMap(
    (entry) => [...entry.dataFields, entry.staleField]
  ))]
);

export function assertNoDerivedWrites(patch) {
  const fields = DERIVED_WRITE_FIELDS.filter((field) => Object.hasOwn(patch || {}, field));
  if (fields.length > 0) {
    throw new Error(
      `Los resultados derivados (${fields.join(', ')}) sólo pueden escribirse mediante un comando de regeneración.`
    );
  }
}

/**
 * ¿El patch es una regeneración de despiece? Devuelve qué se regeneró.
 * Regenerar la modulación metalcon vuelve stale el OSB (depende de wall.studs).
 */
export function patchRegenerates(patch) {
  return {
    studs: Boolean(patch)
      && (Object.hasOwn(patch, 'studs') || Object.hasOwn(patch, 'headers')),
    osb: Boolean(patch)
      && (Object.hasOwn(patch, 'osbCourses') || Object.hasOwn(patch, 'osbNoggings'))
  };
}

function wallHasDerived(wall, kind) {
  return DERIVED_REGISTRY[kind].dataFields.some((field) => wall[field] != null);
}

function markWall(wall, derivatives) {
  const next = { ...wall };
  let changed = false;
  if (
    derivatives.includes('wallFraming')
    && wallHasDerived(wall, 'wallFraming')
    && wall.studsStale !== true
  ) {
    next.studsStale = true;
    changed = true;
  }
  if (
    derivatives.includes('wallOsb')
    && wallHasDerived(wall, 'wallOsb')
    && wall.osbStale !== true
  ) {
    next.osbStale = true;
    changed = true;
  }
  return changed ? next : wall;
}

function markSystem(system, derivatives) {
  if (
    !derivatives.includes('roofTruss')
    || system.trussGeometry == null
    || system.stale === true
  ) return system;
  return { ...system, stale: true };
}

export function invalidateForMutation(model, mutation, context = {}) {
  const dependency = MUTATION_DEPENDENCIES[mutation];
  if (!dependency) throw new Error(`Comando de mutación no registrado: ${mutation}`);
  if (dependency.scope === 'none' || dependency.derivatives.length === 0) return model;

  const wallIds = new Set(context.wallIds || []);
  if (context.wallId != null) wallIds.add(context.wallId);
  const all = dependency.scope === 'all';
  const affectsWalls = all || dependency.scope === 'wall';
  let touched = false;

  const elements = (model.elements || []).map((element) => {
    if (element.type !== 'wall' || !affectsWalls) return element;
    if (!all && !wallIds.has(element.id)) return element;
    const next = markWall(element, dependency.derivatives);
    if (next !== element) touched = true;
    return next;
  });

  const roofSystems = (model.roofSystems || []).map((system) => {
    let selected = all;
    if (dependency.scope === 'wall' || dependency.scope === 'dependentRoof') {
      selected = wallIds.has(system.wallLowId) || wallIds.has(system.wallHighId);
    } else if (dependency.scope === 'removedWalls') {
      selected = wallIds.has(system.wallLowId) || wallIds.has(system.wallHighId);
    } else if (dependency.scope === 'roofSystem') {
      selected = system.id === context.roofSystemId;
    }
    if (!selected) return system;
    const next = markSystem(system, dependency.derivatives);
    if (next !== system) touched = true;
    return next;
  });

  return touched ? { ...model, elements, roofSystems } : model;
}

/**
 * Marca como stale todo lo derivado que dependa de `target`.
 * @param {object} model
 * @param {string|'all'} target id de muro, o 'all' para invalidación global (grilla).
 * @returns {object} modelo nuevo si hubo cambios, o el mismo por referencia si no.
 */
export function invalidateDerived(model, target) {
  return invalidateForMutation(
    model,
    target === 'all' ? 'gridGeometry' : 'wallGeometry',
    target === 'all' ? {} : { wallId: target }
  );
}

/** Marca stale sólo los roofSystems que referencian al muro (el muro ya se trató aparte). */
export function invalidateSystemsForWall(model, wallId) {
  return invalidateForMutation(model, 'wallRemoval', { wallId });
}

function requireArrays(result, fields, kind) {
  const missing = fields.filter((field) => !Array.isArray(result?.[field]));
  if (missing.length > 0) {
    throw new Error(
      `Regeneración ${kind} incompleta: faltan resultados válidos para ${missing.join(', ')}.`
    );
  }
}

export function applyWallRegeneration(wall, kind, result) {
  if (kind === 'wallFraming') {
    requireArrays(result, DERIVED_REGISTRY.wallFraming.dataFields, kind);
    const next = { ...wall, ...result, studsStale: false };
    if (wallHasDerived(next, 'wallOsb')) next.osbStale = true;
    return next;
  }
  if (kind === 'wallOsb') {
    if (wall.studsStale === true) {
      throw new Error('Regeneración wallOsb bloqueada: wallFraming sigue desactualizado.');
    }
    requireArrays(result, DERIVED_REGISTRY.wallOsb.dataFields, kind);
    return { ...wall, ...result, osbStale: false };
  }
  throw new Error(`Derivado de muro no registrado: ${kind}`);
}

export function applyWallRegenerationPatch(wall, patch) {
  const regen = patchRegenerates(patch);
  if (!regen.studs && !regen.osb) {
    throw new Error('El comando de regeneración no contiene resultados derivados.');
  }
  let next = wall;
  if (regen.studs) next = applyWallRegeneration(next, 'wallFraming', patch);
  if (regen.osb) next = applyWallRegeneration(next, 'wallOsb', patch);
  return next;
}

/**
 * Aplica un patch a un muro resolviendo los flags stale: los campos geométricos invalidan,
 * los campos de resultado (studs/osbCourses) limpian su propio flag.
 */
export function applyWallPatchFlags(wall, patch) {
  const regen = patchRegenerates(patch);
  let next = regen.studs || regen.osb
    ? applyWallRegenerationPatch(wall, patch)
    : { ...wall, ...patch };

  if (patchInvalidatesWall(patch)) {
    if (next.studs && !regen.studs) next.studsStale = true;
    if (next.osbCourses && !regen.osb) next.osbStale = true;
  }
  return next;
}

/** Lista lo que quedó desactualizado, para los avisos previos a exportar. */
export function collectStale(model) {
  const grid = model.grid;
  const walls = [];
  for (const el of model.elements || []) {
    if (el.type !== 'wall') continue;
    const studs = el.studsStale === true && Boolean(el.studs);
    const osb = el.osbStale === true && Boolean(el.osbCourses);
    if (studs || osb) walls.push({ id: el.id, name: getWallDisplayName(el, grid), studs, osb });
  }
  const systems = (model.roofSystems || [])
    .filter((s) => s.stale === true && s.trussGeometry)
    .map((s) => ({ id: s.id, name: s.name || `Sistema ${s.id}` }));

  return { walls, systems, isEmpty: walls.length === 0 && systems.length === 0 };
}

const SCOPE_FILTERS = {
  framing: (st) => ({ walls: st.walls.filter((w) => w.studs), systems: [] }),
  osb: (st) => ({ walls: st.walls.filter((w) => w.osb), systems: [] }),
  truss: (st) => ({ walls: [], systems: st.systems }),
  all: (st) => ({ walls: st.walls, systems: st.systems })
};

/**
 * Mensaje de advertencia acotado al alcance del exportador.
 * @param {object} model
 * @param {'framing'|'osb'|'truss'|'all'} scope
 * @returns {string|null} null si no hay nada stale en ese alcance.
 */
export function formatStaleWarning(model, scope = 'all') {
  const filter = SCOPE_FILTERS[scope] || SCOPE_FILTERS.all;
  const { walls, systems } = filter(collectStale(model));
  if (walls.length === 0 && systems.length === 0) return null;

  const lines = [];
  for (const w of walls) {
    const kinds = [w.studs && 'modulación', w.osb && 'OSB'].filter(Boolean).join(' + ');
    lines.push(`  • ${w.name}: ${kinds}`);
  }
  for (const s of systems) lines.push(`  • ${s.name}: cerchas`);

  return [
    'Hay despieces desactualizados (el modelo cambió después de generarlos):',
    ...lines,
    '',
    'Los datos guardados pueden no corresponder al modelo actual.',
    'Regenera los despieces indicados antes de usarlos como vigentes.'
  ].join('\n');
}
