// core/attributeFilter.js
// Filtrado/resaltado por atributo (ítem 7) — lógica pura, sin canvas/three.
// Semántica acordada: SOLO destaca lo coincidente, no toca el resto (no hay "dim").
import { isVisibleAtCurrentLevel } from './levelVisibility.js';

export function isFilterActive(filter) {
  if (!filter) return false;
  return !!(filter.types?.length || filter.libraryIds?.length || filter.zLevelId || filter.wallOrientation);
}

/** ¿El elemento coincide con TODOS los criterios activos del filtro? (AND entre categorías, OR dentro de cada una) */
export function elementMatchesFilter(el, filter, grid, paramsMap = {}, elementsById = {}) {
  if (!isFilterActive(filter)) return false;
  const { types, libraryIds, zLevelId, wallOrientation } = filter;
  if (types?.length && !types.includes(el.type)) return false;
  if (libraryIds?.length && !libraryIds.includes(el.libraryId)) return false;
  if (wallOrientation && (el.type !== 'wall' || el.direction !== wallOrientation)) return false;
  if (zLevelId && !isVisibleAtCurrentLevel(el, grid, zLevelId, paramsMap, elementsById)) return false;
  return true;
}
