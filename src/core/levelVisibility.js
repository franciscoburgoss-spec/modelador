// core/levelVisibility.js
// Regla de corte estricto: un elemento se ve en planta si el nivel Z seleccionado
// cae dentro de su rango vertical real. No hay proyección hacia arriba ni hacia abajo
// (igual criterio que ya usan las elevaciones con sus categorías 1-4).
import { resolveValue } from './projectParams.js';
import { foundationVerticalRange } from './foundationGeometry.js';
import { roofSystemVerticalRange } from './trussLayout.js';
import { getRoofSystems } from './roofPlaneOutputs.js';

/** ¿El elemento es visible en planta al nivel Z actual? paramsMap: ver core/projectParams.js */
export function isVisibleAtCurrentLevel(el, grid, currentZLevelId, paramsMap = {}, elementsById = {}) {
  const current = grid.zLevels.find(l => l.id === currentZLevelId);
  if (!current) return true; // sin nivel seleccionado: no filtrar (comportamiento previo)

  if (el.type === 'wall' || el.type === 'column') {
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!bottom || !top) return false;
    return bottom.elevation <= current.elevation && top.elevation >= current.elevation;
  }

  if (el.type === 'beam') {
    const level = grid.zLevels.find(l => l.id === el.levelZ);
    if (!level) return false;
    const beamHeight = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : 500;
    const vBottom = level.elevation - beamHeight; // la viga cuelga bajo el nivel de piso
    const vTop = level.elevation;
    return vBottom <= current.elevation && vTop >= current.elevation;
  }

  if (el.type === 'foundation') {
    // Sin "Nivel base" asignado (fundaciones creadas antes de este campo): no filtrar,
    // para no hacerlas desaparecer silenciosamente. Se marca en la auditoría para corregir.
    if (el.levelZ == null) return true;
    if (!grid.zLevels.find(l => l.id === el.levelZ)) return false;
    const range = foundationVerticalRange(el, grid, paramsMap, elementsById);
    if (!range) return false;
    return range.bottom <= current.elevation && range.top >= current.elevation;
  }

  return true;
}

/** Sistemas de techumbre (model.roofSystems) que efectivamente cortan el nivel Z actual — mismo
 * criterio inclusivo que el resto de levelVisibility. Sin nivel seleccionado no se filtra. Un
 * sistema sin geometría resuelta no se oculta (se marca en la auditoría, no acá). */
export function visibleRoofSystems(model, library = null) {
  const roofSystems = getRoofSystems(model);
  if (model.currentZLevelId == null) return roofSystems;
  const current = model.grid.zLevels.find(l => l.id === model.currentZLevelId);
  if (!current) return roofSystems;
  return roofSystems.filter(sys => {
    const range = roofSystemVerticalRange(sys, library);
    if (!range) return true;
    return range.bottom <= current.elevation && range.top >= current.elevation;
  });
}
