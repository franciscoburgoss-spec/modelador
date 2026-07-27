// core/roofPlaneEdge.js
// ★ B4.7.4b — Mapea un LADO del polígono del faldón a un muro colineal (la canaleta).
//
// Decisión de Fran: la canaleta se elige como un lado del polígono dibujado (no un muro directo),
// para no depender de dividir muros. Pero resolveRoofPlane necesita un `canalWallId` (la línea de
// apoyo baja se siembra desde ese muro). Aquí resolvemos el muro que corre sobre ese lado: mismo
// eje (X-run/Y-run), misma coordenada perpendicular (±TOL) y con solape útil sobre el lado.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';

const TOL = 50; // mm — holgura para coincidencia perpendicular y solape mínimo

/** Lados del polígono cerrado como pares consecutivos (incluye el cierre vN→v0). */
export function polygonEdges(polygon = []) {
  const out = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) out.push({ index: i, a: polygon[i], b: polygon[(i + 1) % n] });
  return out;
}

/**
 * Muro colineal a un lado [vA,vB]. Devuelve el id del muro con mayor solape útil, o null si el lado
 * es diagonal/degenerado o ningún muro corre sobre él.
 */
export function wallOnEdge(model, vA, vB, paramsMap = {}, elementsById = {}) {
  if (!vA || !vB) return null;
  const horizontal = Math.abs(vA.y - vB.y) <= TOL; // corre en X (perp = Y)
  const vertical = Math.abs(vA.x - vB.x) <= TOL;   // corre en Y (perp = X)
  if (horizontal === vertical) return null;        // diagonal o punto: sin muro colineal claro
  const runAxis = horizontal ? 'x' : 'y';
  const perp = horizontal ? (vA.y + vB.y) / 2 : (vA.x + vB.x) / 2;
  const lo = horizontal ? Math.min(vA.x, vB.x) : Math.min(vA.y, vB.y);
  const hi = horizontal ? Math.max(vA.x, vB.x) : Math.max(vA.y, vB.y);

  let best = null, bestOverlap = TOL;
  for (const w of model.elements || []) {
    if (w.type !== 'wall') continue;
    if ((isWallXRun(w) ? 'x' : 'y') !== runAxis) continue;
    const geo = resolveWallGeometry(w, model.grid, paramsMap, elementsById);
    if (!geo) continue;
    const wPerp = runAxis === 'x' ? geo.p1.y : geo.p1.x;
    if (Math.abs(wPerp - perp) > TOL) continue;
    const a = runAxis === 'x' ? geo.p1.x : geo.p1.y;
    const b = runAxis === 'x' ? geo.p2.x : geo.p2.y;
    const overlap = Math.min(hi, Math.max(a, b)) - Math.max(lo, Math.min(a, b));
    if (overlap > bestOverlap) { bestOverlap = overlap; best = w.id; }
  }
  return best;
}

/** Etiqueta corta de un lado para la UI: orientación + coordenada fija + rango. */
export function edgeLabel(vA, vB) {
  const horizontal = Math.abs(vA.y - vB.y) <= TOL;
  const vertical = Math.abs(vA.x - vB.x) <= TOL;
  if (horizontal && !vertical) return `horizontal Y=${Math.round((vA.y + vB.y) / 2)} (X ${Math.round(Math.min(vA.x, vB.x))}→${Math.round(Math.max(vA.x, vB.x))})`;
  if (vertical && !horizontal) return `vertical X=${Math.round((vA.x + vB.x) / 2)} (Y ${Math.round(Math.min(vA.y, vB.y))}→${Math.round(Math.max(vA.y, vB.y))})`;
  return `diagonal (${Math.round(vA.x)},${Math.round(vA.y)})→(${Math.round(vB.x)},${Math.round(vB.y)})`;
}
