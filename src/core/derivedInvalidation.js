// Invalidación de resultados derivados persistidos (wall.studs/headers, wall.osbCourses,
// roofSystem.trussGeometry). Al editar la geometría de un muro o la grilla, esos despieces
// dejan de corresponder al modelo pero siguen guardados: se marcan como "stale" en vez de
// borrarse, para que el usuario decida cuándo regenerar sin perder trabajo.
// Lógica pura: no toca React ni el store, se testea con node --test.

import { getWallDisplayName } from './naming.js';

// Campos de un muro cuyo cambio invalida cualquier despiece derivado de él.
// `openings` entra porque los vanos definen dinteles, jambas y huecos del OSB.
export const WALL_GEOMETRY_FIELDS = [
  'xStart', 'xEnd', 'yStart', 'yEnd',
  'bottomZ', 'topZ',
  'thickness', 'direction',
  'sectionId', 'openings'
];

/** ¿El patch de updateElement toca geometría relevante? */
export function patchInvalidatesWall(patch) {
  if (!patch) return false;
  return WALL_GEOMETRY_FIELDS.some((f) => Object.hasOwn(patch, f));
}

/**
 * ¿El patch es una regeneración de despiece? Devuelve qué se regeneró.
 * Regenerar la modulación metalcon vuelve stale el OSB (depende de wall.studs).
 */
export function patchRegenerates(patch) {
  return {
    studs: Boolean(patch) && Object.hasOwn(patch, 'studs'),
    osb: Boolean(patch) && Object.hasOwn(patch, 'osbCourses')
  };
}

function markWall(wall, { studs = false, osb = false } = {}) {
  const next = { ...wall };
  let changed = false;
  if (studs && wall.studs && wall.studsStale !== true) { next.studsStale = true; changed = true; }
  if (osb && wall.osbCourses && wall.osbStale !== true) { next.osbStale = true; changed = true; }
  return changed ? next : wall;
}

function markSystem(system) {
  if (!system.trussGeometry || system.stale === true) return system;
  return { ...system, stale: true };
}

/**
 * Marca como stale todo lo derivado que dependa de `target`.
 * @param {object} model
 * @param {string|'all'} target id de muro, o 'all' para invalidación global (grilla).
 * @returns {object} modelo nuevo si hubo cambios, o el mismo por referencia si no.
 */
export function invalidateDerived(model, target) {
  const all = target === 'all';
  let touched = false;

  const elements = (model.elements || []).map((el) => {
    if (el.type !== 'wall') return el;
    if (!all && el.id !== target) return el;
    const next = markWall(el, { studs: true, osb: true });
    if (next !== el) touched = true;
    return next;
  });

  const roofSystems = (model.roofSystems || []).map((sys) => {
    const refs = all || sys.wallLowId === target || sys.wallHighId === target;
    if (!refs) return sys;
    const next = markSystem(sys);
    if (next !== sys) touched = true;
    return next;
  });

  if (!touched) return model;
  return { ...model, elements, roofSystems };
}

/** Marca stale sólo los roofSystems que referencian al muro (el muro ya se trató aparte). */
export function invalidateSystemsForWall(model, wallId) {
  let touched = false;
  const roofSystems = (model.roofSystems || []).map((sys) => {
    if (sys.wallLowId !== wallId && sys.wallHighId !== wallId) return sys;
    const next = markSystem(sys);
    if (next !== sys) touched = true;
    return next;
  });
  return touched ? { ...model, roofSystems } : model;
}

/**
 * Aplica un patch a un muro resolviendo los flags stale: los campos geométricos invalidan,
 * los campos de resultado (studs/osbCourses) limpian su propio flag.
 */
export function applyWallPatchFlags(wall, patch) {
  const regen = patchRegenerates(patch);
  const next = { ...wall, ...patch };

  if (regen.studs) {
    next.studsStale = false;
    // el OSB se apoya en la modulación: si existía, queda desactualizado
    if (next.osbCourses) next.osbStale = true;
  }
  if (regen.osb) next.osbStale = false;

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
    'Se exportarán los datos guardados, que pueden no corresponder al modelo actual.',
    '¿Continuar de todas formas?'
  ].join('\n');
}

/**
 * Guard para los `download*`. Devuelve true si se puede continuar.
 * Inyectable para tests (por defecto usa window.confirm).
 */
export function confirmIfStale(model, scope = 'all', confirmFn) {
  const msg = formatStaleWarning(model, scope);
  if (!msg) return true;
  const ask = confirmFn || (typeof globalThis.confirm === 'function' ? globalThis.confirm : null);
  if (!ask) return true; // entorno sin UI (tests/node): no bloquear
  return Boolean(ask(msg));
}
