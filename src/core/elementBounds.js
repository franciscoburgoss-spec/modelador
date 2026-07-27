// core/elementBounds.js
import { resolveColumnGeometry, resolveBeamGeometry, resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveFoundation } from './foundationGeometry.js';
import { resolveValue } from './projectParams.js';

/** Bounds mundiales {xMin,xMax,yMin,yMax,zMin,zMax} de un elemento (o de un vano, pasando su
 * muro contenedor como `parentWall`). Devuelve null si la geometría no se puede resolver.
 * Un solo lugar para esta lógica — la usan tanto centerOnElement (paneo) como zoomToElement
 * (encuadre) en el store, para no duplicar el resolver de geometría por tipo de elemento. */
export function resolveElementWorldBounds(el, parentWall, grid, elementsById, paramsMap) {
  if (parentWall) {
    const geo = resolveWallGeometry(parentWall, grid, paramsMap, elementsById);
    const bottom = grid.zLevels.find(l => l.id === parentWall.bottomZ);
    const top = grid.zLevels.find(l => l.id === parentWall.topZ);
    if (!geo || !bottom || !top) return null;
    const runX = isWallXRun(parentWall);
    const oWidth = resolveValue(el.width, paramsMap, elementsById);
    const half = oWidth / 2;
    const sillHeight = el.sillHeight != null ? resolveValue(el.sillHeight, paramsMap, elementsById) : 0;
    const oHeight = resolveValue(el.height, paramsMap, elementsById);
    const zMin = bottom.elevation + sillHeight;
    const zMax = zMin + oHeight;
    if (runX) {
      return { xMin: el.position - half, xMax: el.position + half, yMin: Math.min(geo.p1.y, geo.p2.y), yMax: Math.max(geo.p1.y, geo.p2.y), zMin, zMax };
    }
    return { xMin: Math.min(geo.p1.x, geo.p2.x), xMax: Math.max(geo.p1.x, geo.p2.x), yMin: el.position - half, yMax: el.position + half, zMin, zMax };
  }

  if (el.type === 'wall') {
    const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!geo || !bottom || !top) return null;
    return { xMin: Math.min(geo.p1.x, geo.p2.x), xMax: Math.max(geo.p1.x, geo.p2.x), yMin: Math.min(geo.p1.y, geo.p2.y), yMax: Math.max(geo.p1.y, geo.p2.y), zMin: bottom.elevation, zMax: top.elevation };
  }

  if (el.type === 'column') {
    const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!geo || !bottom || !top) return null;
    return { xMin: geo.center.x - geo.w / 2, xMax: geo.center.x + geo.w / 2, yMin: geo.center.y - geo.h / 2, yMax: geo.center.y + geo.h / 2, zMin: bottom.elevation, zMax: top.elevation };
  }

  if (el.type === 'beam') {
    const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
    const level = grid.zLevels.find(l => l.id === el.levelZ);
    if (!geo || !level) return null;
    const height = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : geo.width;
    return { xMin: Math.min(geo.p1.x, geo.p2.x), xMax: Math.max(geo.p1.x, geo.p2.x), yMin: Math.min(geo.p1.y, geo.p2.y), yMax: Math.max(geo.p1.y, geo.p2.y), zMin: level.elevation, zMax: level.elevation + height };
  }

  if (el.type === 'foundation') {
    const f = resolveFoundation(el, grid, paramsMap, elementsById);
    if (!f) return null;
    const zMin = f.emplantillado ? f.emplantillado.bottom : f.sealElevation;
    if (f.kind === 'aislada') {
      return {
        xMin: f.center.x - f.lengthX / 2, xMax: f.center.x + f.lengthX / 2,
        yMin: f.center.y - f.lengthY / 2, yMax: f.center.y + f.lengthY / 2,
        zMin, zMax: f.topElevation
      };
    }
    return {
      xMin: Math.min(f.p1.x, f.p2.x), xMax: Math.max(f.p1.x, f.p2.x),
      yMin: Math.min(f.p1.y, f.p2.y), yMax: Math.max(f.p1.y, f.p2.y),
      zMin, zMax: f.topElevation
    };
  }

  return null;
}
