// core/dimensions.js
// ★ Cotas vivas (ítem 6). Cadena de cotas: N puntos ordenados → tramos consecutivos + total.
// El valor SIEMPRE se calcula desde la geometría real (resolveAxisRef / bottomZ-topZ) — no hay
// override editable (decisión: "solo valor calculado, siempre en vivo").
//
// Un punto de cadena es una de estas dos formas:
//   - Punto XY (cota horizontal, planta o elevación): mismo raw que xStart/axisXId/etc.
//     → ID de eje de grilla (string) o referencia a elemento ({refElementId, edge:'min'|'max'|'center'}).
//     Se resuelve con resolveAxisRef (core/elementReferences.js), 'axis' = 'x' | 'y'.
//   - Punto Z (cota vertical, solo elevación): { zLevelId } o { refElementId, edge:'bottom'|'top' }.
//     Se resuelve contra grid.zLevels o bottomZ/topZ del elemento (números planos, sin fórmula).
//
// dimension = {
//   id, view: 'plan' | 'elevation',
//   zLevelId,        // planta: nivel Z donde vive/se ve la cota
//   elevationMode,   // elevación: modeStr ('elevation-x-3') donde vive la cota
//   orientation: 'x' | 'y' | 'z',  // eje que mide la cadena
//   points: [ rawPoint, ... ],     // ≥2 puntos, en orden
//   offset,          // distancia perpendicular para dibujar la línea de cota (stacking)
// }

import { resolveAxisRef, isElementRef, getElementBBox } from './elementReferences.js';
import { parseElevationMode } from './viewMode.js';

export function isZPointRef(raw) {
  return !!raw && typeof raw === 'object' && (typeof raw.zLevelId === 'string' || typeof raw.refElementId === 'string');
}

export function makeZLevelPoint(zLevelId) {
  return { zLevelId };
}

export function makeZElementPoint(refElementId, edge) {
  return { refElementId, edge }; // edge: 'bottom' | 'top'
}

/** Resuelve un punto Z (nivel de grilla o borde bottom/top de un elemento) a un número. */
function resolveZPoint(raw, grid, elementsById = {}) {
  if (raw == null) return null;
  if (typeof raw.zLevelId === 'string') {
    const lvl = grid.zLevels.find(z => z.id === raw.zLevelId);
    return lvl ? lvl.elevation : null;
  }
  if (typeof raw.refElementId === 'string') {
    const el = elementsById[raw.refElementId];
    if (!el) return null;
    if (raw.edge === 'bottom') return el.bottomZ ?? null;
    if (raw.edge === 'top') return el.topZ ?? null;
    return null;
  }
  return null;
}

/** Resuelve un único punto de la cadena según la orientación. Devuelve número o null (no resoluble). */
export function resolveDimensionPoint(raw, orientation, grid, elementsById = {}, paramsMap = {}) {
  if (orientation === 'z') return resolveZPoint(raw, grid, elementsById);
  return resolveAxisRef(raw, orientation, grid, elementsById, paramsMap);
}

/**
 * Calcula la cadena completa: coordenada de cada punto, distancia de cada tramo consecutivo, y total.
 * Devuelve null si la cadena tiene menos de 2 puntos.
 * Devuelve { points: [{raw, coord|null}], segments: [{fromIndex, toIndex, distance|null}], total|null, resolved }
 *   - coord/distance = null cuando el punto/tramo no se pudo resolver (eje o ref rota).
 *   - total = null si CUALQUIER tramo no se resolvió (no tiene sentido un total parcial).
 *   - resolved = false si algún punto o tramo quedó sin resolver (para que la UI lo marque en rojo).
 */
export function computeDimensionChain(dimension, grid, elementsById = {}, paramsMap = {}) {
  const { points, orientation } = dimension;
  if (!Array.isArray(points) || points.length < 2) return null;

  const resolvedPoints = points.map(raw => ({
    raw,
    coord: resolveDimensionPoint(raw, orientation, grid, elementsById, paramsMap),
  }));

  const segments = [];
  let total = 0;
  let resolved = true;

  for (let i = 0; i < resolvedPoints.length - 1; i++) {
    const a = resolvedPoints[i].coord;
    const b = resolvedPoints[i + 1].coord;
    const distance = (a == null || b == null) ? null : Math.abs(b - a);
    if (distance == null) resolved = false;
    segments.push({ fromIndex: i, toIndex: i + 1, distance });
    total += distance ?? 0;
  }
  if (resolvedPoints.some(p => p.coord == null)) resolved = false;

  return { points: resolvedPoints, segments, total: resolved ? total : null, resolved };
}

/**
 * ★ Línea de extensión real (no solo marca en la línea de cota): si el punto de la cadena
 * es una referencia a un elemento (no un ID de eje de grilla), devuelve la coordenada
 * perpendicular REAL de ese elemento (centro de su bounding box en el eje perpendicular),
 * para dibujar una línea desde ahí hasta la línea de cota. Un ID de eje de grilla no tiene
 * anchor real (el eje es una línea infinita) → devuelve null, y solo se dibuja la marca.
 */
export function resolveDimensionAnchor(raw, dimension, grid, elementsById = {}, paramsMap = {}) {
  if (!isElementRef(raw)) return null;
  const el = elementsById[raw.refElementId];
  if (!el) return null;

  if (dimension.view === 'plan') {
    const bbox = getElementBBox(el, grid, elementsById, paramsMap);
    if (!bbox) return null;
    return dimension.orientation === 'x' ? (bbox.yMin + bbox.yMax) / 2 : (bbox.xMin + bbox.xMax) / 2;
  }

  // elevación
  if (dimension.orientation === 'z') {
    // el punto mide Z; el anchor perpendicular es la posición en planta del elemento
    // sobre el eje horizontal (h) de ESA elevación (el complemento de axisType).
    const parsed = parseElevationMode(dimension.elevationMode);
    if (!parsed) return null;
    const bbox = getElementBBox(el, grid, elementsById, paramsMap);
    if (!bbox) return null;
    return parsed.axisType === 'x' ? (bbox.yMin + bbox.yMax) / 2 : (bbox.xMin + bbox.xMax) / 2;
  }
  // orientación x/y en elevación (cota horizontal): el anchor perpendicular es la altura (Z) real del elemento.
  if (el.bottomZ == null || el.topZ == null) return null;
  return (el.bottomZ + el.topZ) / 2;
}
