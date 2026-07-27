// core/elementGeometry.js
// Extrae el lookup de ejes que hoy está repetido al inicio de drawWall/drawColumn/drawBeam
// (y de nuevo en isPointInWall/isPointInColumn/isPointInBeam). Un solo punto de resolución.
//
// paramsMap ({nombre: valor}, ver core/projectParams.js) es opcional en los tres resolve*:
// si un campo (thickness/widthX/width/etc.) es una fórmula "=nombre", se resuelve aquí;
// si es un número plano, resolveValue lo devuelve intacto. Por eso todo el código existente
// que llama resolve*Geometry(el, grid) sin tercer argumento sigue funcionando igual.
//
// ★ elementsById (Tanda 3, ítem 2): igual optatividad. Cada campo de eje (xStart, axisXId,
// startAxisId, etc.) puede ser un ID de eje (string, como siempre) o una referencia a otro
// elemento ({refElementId, edge}, ver core/elementReferences.js). Si se omite elementsById,
// una referencia de elemento simplemente no se resuelve (geometría null, igual que un ID de
// eje inexistente hoy) — no rompe llamadas viejas, pero tampoco resuelve refs sin el mapa.

import { resolveValue } from './projectParams.js';
import { resolveAxisRef } from './elementReferences.js';

/**
 * ★ Determina si un muro corre en X (fijo en Y) sin depender de comparar xStart===xEnd por
 * igualdad literal — necesario porque con referencias entre elementos ({refElementId, edge})
 * esa comparación ya no es fiable (dos objetos nunca son === aunque resuelvan al mismo punto).
 * Usa wall.direction si existe (walls nuevos siempre lo guardan); si no, cae al criterio
 * legado de comparar xStart/xEnd (walls guardados antes de este cambio).
 */
export function isWallXRun(wall) {
  if (wall.direction) return wall.direction === 'x';
  return wall.xStart !== wall.xEnd;
}

/** Wall: devuelve extremos en mundo + espesor. null si faltan ejes (mismo guard que hoy). */
export function resolveWallGeometry(wall, grid, paramsMap = {}, elementsById = {}, _visiting = new Set()) {
  const xStart = resolveAxisRef(wall.xStart, 'x', grid, elementsById, paramsMap, _visiting);
  const xEnd   = resolveAxisRef(wall.xEnd,   'x', grid, elementsById, paramsMap, _visiting);
  const yStart = resolveAxisRef(wall.yStart, 'y', grid, elementsById, paramsMap, _visiting);
  const yEnd   = resolveAxisRef(wall.yEnd,   'y', grid, elementsById, paramsMap, _visiting);
  if (xStart == null || xEnd == null || yStart == null || yEnd == null) return null;

  return {
    p1: { x: xStart, y: yStart },
    p2: { x: xEnd, y: yEnd },
    thickness: resolveValue(wall.thickness, paramsMap, elementsById)
  };
}

/**
 * Frame local canónico del muro resuelto. `start` siempre es el extremo de menor coordenada
 * sobre el eje de corrida, aunque la declaración xStart/xEnd o yStart/yEnd venga invertida.
 * Devuelve null para geometría incompleta o no numérica.
 */
export function resolveWallLocalFrame(wall, geo) {
  if (!geo?.p1 || !geo?.p2) return null;
  const coordinates = [geo.p1.x, geo.p1.y, geo.p2.x, geo.p2.y];
  if (!coordinates.every(Number.isFinite)) return null;

  const runAxis = isWallXRun(wall) ? 'x' : 'y';
  const declaredStartIsOrigin = geo.p1[runAxis] <= geo.p2[runAxis];
  const origin = declaredStartIsOrigin ? geo.p1 : geo.p2;
  const end = declaredStartIsOrigin ? geo.p2 : geo.p1;

  return {
    runAxis,
    origin: { x: origin.x, y: origin.y },
    end: { x: end.x, y: end.y },
    length: end[runAxis] - origin[runAxis],
    declaredStartSide: declaredStartIsOrigin ? 'start' : 'end'
  };
}

/** Proyecta un offset (mm desde el extremo local "start") a un punto {x,y} real del muro.
 * Los offsets negativos o mayores al largo se conservan: OSB puede extender la envolvente. */
export function wallOffsetToWorldPoint(wall, geo, offset) {
  const frame = resolveWallLocalFrame(wall, geo);
  if (!frame) return null;
  const spanX = frame.end.x - frame.origin.x;
  const spanY = frame.end.y - frame.origin.y;
  const t = frame.length === 0 ? 0 : offset / frame.length;
  return {
    x: frame.origin.x + t * spanX,
    y: frame.origin.y + t * spanY
  };
}

/** Column: centro en mundo + ancho/alto. */
export function resolveColumnGeometry(column, grid, paramsMap = {}, elementsById = {}, _visiting = new Set()) {
  const x = resolveAxisRef(column.axisXId, 'x', grid, elementsById, paramsMap, _visiting);
  const y = resolveAxisRef(column.axisYId, 'y', grid, elementsById, paramsMap, _visiting);
  if (x == null || y == null) return null;

  return {
    center: { x: x + (column.offsetX || 0), y: y + (column.offsetY || 0) },
    w: resolveValue(column.widthX, paramsMap, elementsById),
    h: resolveValue(column.widthY, paramsMap, elementsById)
  };
}

/** Beam: extremos en mundo + ancho. Unifica la rama direction='x'/'y' que hoy se repite en draw+hitTest. */
export function resolveBeamGeometry(beam, grid, paramsMap = {}, elementsById = {}, _visiting = new Set()) {
  // Fundación corrida: el ancho vive en la capa (cimiento/sobrecimiento), no en la raíz.
  const rawWidth = beam.width != null ? beam.width
    : (beam.type === 'foundation' ? (beam.cimiento?.width ?? beam.sobrecimiento?.width) : null);
  const width = rawWidth != null ? resolveValue(rawWidth, paramsMap, elementsById) : 300;

  if (beam.direction === 'x') {
    // Viga corre en X: rango sobre ejes X, fija en un eje Y.
    const fixed = resolveAxisRef(beam.fixedAxisId, 'y', grid, elementsById, paramsMap, _visiting);
    const start = resolveAxisRef(beam.startAxisId, 'x', grid, elementsById, paramsMap, _visiting);
    const end   = resolveAxisRef(beam.endAxisId,   'x', grid, elementsById, paramsMap, _visiting);
    if (fixed == null || start == null || end == null) return null;
    const x1 = Math.min(start, end) + (beam.offsetX || 0);
    const x2 = Math.max(start, end) + (beam.offsetX || 0);
    const y = fixed + (beam.offsetY || 0);
    return { p1: { x: x1, y }, p2: { x: x2, y }, width };
  }

  // Viga corre en Y: rango sobre ejes Y, fija en un eje X.
  const fixed = resolveAxisRef(beam.fixedAxisId, 'x', grid, elementsById, paramsMap, _visiting);
  const start = resolveAxisRef(beam.startAxisId, 'y', grid, elementsById, paramsMap, _visiting);
  const end   = resolveAxisRef(beam.endAxisId,   'y', grid, elementsById, paramsMap, _visiting);
  if (fixed == null || start == null || end == null) return null;
  const y1 = Math.min(start, end) + (beam.offsetY || 0);
  const y2 = Math.max(start, end) + (beam.offsetY || 0);
  const x = fixed + (beam.offsetX || 0);
  return { p1: { x, y: y1 }, p2: { x, y: y2 }, width };
}
