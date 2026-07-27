// core/elementReferences.js
// ★ Referencias entre elementos (Tanda 3, ítem 2).
//
// Hasta ahora todo campo de eje (wall.xStart, column.axisXId, beam.startAxisId, etc.)
// era un ID de eje (string) que se resolvía con grid.xAxes/yAxes.find(...).
// Ahora ese mismo campo puede ser también una REFERENCIA a otro elemento:
//   { refElementId: 'wall_3', edge: 'max' }   // 'min' | 'max' | 'center'
// que se resuelve al borde (o centro) del bounding box en planta de ese elemento,
// sobre el eje (x o y) que corresponda al campo que se está resolviendo.
//
// Ejemplo real: "esta viga llega hasta el borde del último pilar" →
//   beam.endAxisId = { refElementId: 'col_7', edge: 'max' }  (si la viga corre en X)

import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry } from './elementGeometry.js';

/** true si raw es una referencia a otro elemento (no un ID de eje ni un número). */
export function isElementRef(raw) {
  return !!raw && typeof raw === 'object' && typeof raw.refElementId === 'string';
}

export function makeElementRef(refElementId, edge) {
  return { refElementId, edge };
}

/** Compara dos campos de eje (ID de eje o referencia a elemento) por igualdad *lógica*,
 *  no por referencia de objeto — dos referencias al mismo elemento+borde son "iguales"
 *  aunque sean objetos JS distintos (uno recién creado al decodificar el <select>). */
export function axisFieldsEqual(a, b) {
  if (isElementRef(a) && isElementRef(b)) return a.refElementId === b.refElementId && a.edge === b.edge;
  if (isElementRef(a) || isElementRef(b)) return false;
  return a === b;
}

/** Mapa id→elemento, construido una vez por operación (igual patrón que buildParamsMap). */
export function buildElementsById(elements = []) {
  const map = {};
  for (const el of elements) map[el.id] = el;
  return map;
}

function findAxis(axes, id) {
  return axes.find(a => a.id === id) || null;
}

/**
 * Bounding box en planta de un elemento (xMin/xMax/yMin/yMax), resolviendo
 * recursivamente si ese elemento a su vez referencia a otros.
 * Devuelve null si el elemento no existe, tiene referencias rotas, o hay ciclo.
 */
export function getElementBBox(el, grid, elementsById = {}, paramsMap = {}, _visiting = new Set()) {
  if (!el) return null;
  if (_visiting.has(el.id)) return null; // ciclo de referencias
  const visiting = new Set(_visiting);
  visiting.add(el.id);

  if (el.type === 'wall') {
    const geo = resolveWallGeometry(el, grid, paramsMap, elementsById, visiting);
    if (!geo) return null;
    return {
      xMin: Math.min(geo.p1.x, geo.p2.x), xMax: Math.max(geo.p1.x, geo.p2.x),
      yMin: Math.min(geo.p1.y, geo.p2.y), yMax: Math.max(geo.p1.y, geo.p2.y)
    };
  }
  if (el.type === 'column') {
    const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById, visiting);
    if (!geo) return null;
    return {
      xMin: geo.center.x - geo.w / 2, xMax: geo.center.x + geo.w / 2,
      yMin: geo.center.y - geo.h / 2, yMax: geo.center.y + geo.h / 2
    };
  }
  if (el.type === 'beam' || el.type === 'foundation') {
    const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById, visiting);
    if (!geo) return null;
    return {
      xMin: Math.min(geo.p1.x, geo.p2.x), xMax: Math.max(geo.p1.x, geo.p2.x),
      yMin: Math.min(geo.p1.y, geo.p2.y), yMax: Math.max(geo.p1.y, geo.p2.y)
    };
  }
  return null;
}

function edgeValue(bbox, axis, edge) {
  const [min, max] = axis === 'x' ? [bbox.xMin, bbox.xMax] : [bbox.yMin, bbox.yMax];
  if (edge === 'min') return min;
  if (edge === 'max') return max;
  return (min + max) / 2; // 'center' o cualquier otro valor por defecto
}

/**
 * Resuelve un campo de eje (string=ID de eje, o referencia a elemento) a una coordenada numérica.
 * axis: 'x' | 'y' — determina qué array de ejes usar y qué lado del bbox referenciado leer.
 * Devuelve null si no se puede resolver (eje inexistente, ref rota, o ciclo).
 */
export function resolveAxisRef(raw, axis, grid, elementsById = {}, paramsMap = {}, _visiting = new Set()) {
  if (raw == null) return null;

  if (isElementRef(raw)) {
    const target = elementsById[raw.refElementId];
    if (!target) return null; // referencia rota
    const bbox = getElementBBox(target, grid, elementsById, paramsMap, _visiting);
    if (!bbox) return null;
    return edgeValue(bbox, axis, raw.edge);
  }

  // Comportamiento original: raw es un ID de eje.
  const axes = axis === 'x' ? grid.xAxes : grid.yAxes;
  const found = findAxis(axes, raw);
  return found ? found.position : null;
}
