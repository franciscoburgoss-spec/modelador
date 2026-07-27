// core/hitTest.js
import { pointNearSegment, pointInRect, pointInPolygon } from './geometry.js';
import { computeRoofPlanSegments } from './roofSegments.js';

/**
 * ¿Hay un FALDÓN (model.roofPlanes) bajo el punto (mundo, mm, planta)? Devuelve su id o null.
 * Se selecciona el faldón por su contorno (polígono de esquinas de eje): interior del polígono o
 * cerca de una arista dentro de `tolMm`. Los faldones se recorren en orden inverso para que el
 * último dibujado (encima) gane el clic. Unidad seleccionable = el faldón, no la cercha derivada.
 */
export function findRoofPlaneAtPoint(model, worldPt, tolMm = 100) {
  if (!worldPt) return null;
  const planes = model?.roofPlanes || [];
  for (let i = planes.length - 1; i >= 0; i--) {
    const poly = planes[i].polygon || [];
    if (poly.length < 3) continue;
    if (pointInPolygon(worldPt.x, worldPt.y, poly)) return planes[i].id;
    // tolerancia por arista: un contorno delgado o clic justo sobre el borde también selecciona
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      if (pointNearSegment(worldPt.x, worldPt.y, poly[b], poly[a], 0, tolMm)) return planes[i].id;
    }
  }
  return null;
}

/**
 * ¿Hay un sistema de techumbre bajo el punto (coordenadas de MUNDO en mm, planta)?
 * Devuelve el id del sistema o null. Tolerancia en mm (el llamador convierte px→mm con
 * tol/view.scale) porque los segmentos de cercha viven en mundo, no en pantalla.
 * Se selecciona el SISTEMA, no la cercha individual (las cerchas son geometría derivada).
 */
export function findRoofSystemAtPoint(model, worldPt, tolMm = 100) {
  if (!worldPt) return null;
  const segments = computeRoofPlanSegments(model || {});
  for (const s of segments) {
    if (pointNearSegment(worldPt.x, worldPt.y, { x: s.h1, y: s.v1 }, { x: s.h2, y: s.v2 }, 0, tolMm)) {
      return s.systemId ?? null;
    }
  }
  return null;
}

/** Reemplaza isPointInBeam + isPointInBeamElev + isPointInWall (parte del grosor; ver nota abajo). */
export function isPointNearSegmentElement(screenX, screenY, p1, p2, halfThickness, margin = 8) {
  return pointNearSegment(screenX, screenY, p1, p2, halfThickness, margin);
}

/** Reemplaza isPointInColumn + isPointInColumnElev. */
export function isPointInRectElement(screenX, screenY, center, w, h, margin = 8) {
  return pointInRect(screenX, screenY, center.x, center.y, w, h, margin);
}
