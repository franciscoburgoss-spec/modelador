// core/snapEngine.js
// Snap tipo OSNAP de AutoCAD, con matiz pedido por Fran: un solo tipo de punto candidato
// (no se distingue endpoint de intersección de cara al usuario — un único glifo), sin punto
// medio. Funciona igual en planta y en elevación: el llamador (Canvas.jsx) arma la lista de
// segmentos en espacio de PLANO (h,v en mm — el mismo sistema que usa core/projection.js) según
// el modo activo, y este motor encuentra el punto más cercano al cursor dentro de una
// tolerancia. Puro (sin canvas ni React) — testeable con node --test.
import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry, isWallXRun } from './elementGeometry.js';
import { getElementElevationCategory, getElevationAxis, getColumnElevationRect, getBeamElevationRect } from './elevation.js';
import { getWallElevationSegments } from '../render/wall.js';
import { resolveValue } from './projectParams.js';
import { computeRoofPlanSegments, computeRoofElevationSegments } from './roofSegments.js';

const EPS = 1e-6;

/** Intersección de dos segmentos [a1,a2] y [b1,b2] en el plano (h,v). null si no se cruzan
 * dentro de ambos segmentos (tolerancia pequeña en los parámetros t/u para incluir extremos). */
function segmentIntersection(a1, a2, b1, b2) {
  const d1h = a2.h - a1.h, d1v = a2.v - a1.v;
  const d2h = b2.h - b1.h, d2v = b2.v - b1.v;
  const denom = d1h * d2v - d1v * d2h;
  if (Math.abs(denom) < EPS) return null; // paralelos o coincidentes — sin punto único
  const dh = b1.h - a1.h, dv = b1.v - a1.v;
  const t = (dh * d2v - dv * d2h) / denom;
  const u = (dh * d1v - dv * d1h) / denom;
  const tol = 1e-4;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
  return { h: a1.h + t * d1h, v: a1.v + t * d1v };
}

/** Punto candidato (extremo o intersección real) más cercano al cursor, dentro de
 * `tolerancePlane` (mm de plano — ya convertido desde píxeles por el llamador según
 * view.scale). null si ninguno cae dentro de tolerancia.
 * @param segments [{h1,v1,h2,v2}] */
export function findSnapPoint(segments, cursor, tolerancePlane) {
  let best = null, bestDist = tolerancePlane;
  const consider = (p) => {
    const d = Math.hypot(p.h - cursor.h, p.v - cursor.v);
    if (d < bestDist) { bestDist = d; best = p; }
  };

  for (const s of segments) {
    consider({ h: s.h1, v: s.v1 });
    consider({ h: s.h2, v: s.v2 });
  }

  // intersecciones: solo entre segmentos cuya caja (expandida por la tolerancia) alcanza al
  // cursor — evita el O(n²) completo cuando hay muchos segmentos en el modelo.
  const near = segments.filter(s => {
    const hMin = Math.min(s.h1, s.h2) - tolerancePlane, hMax = Math.max(s.h1, s.h2) + tolerancePlane;
    const vMin = Math.min(s.v1, s.v2) - tolerancePlane, vMax = Math.max(s.v1, s.v2) + tolerancePlane;
    return cursor.h >= hMin && cursor.h <= hMax && cursor.v >= vMin && cursor.v <= vMax;
  });
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const p = segmentIntersection(
        { h: near[i].h1, v: near[i].v1 }, { h: near[i].h2, v: near[i].v2 },
        { h: near[j].h1, v: near[j].v1 }, { h: near[j].h2, v: near[j].v2 }
      );
      if (p) consider(p);
    }
  }

  return best;
}

const seg = (h1, v1, h2, v2) => ({ h1, v1, h2, v2 });

/** Divide [lo,hi] quitando la unión de `ranges` ([a,b]) → tramos [start,end] restantes.
 * Mismo criterio de "partir un segmento por rangos" que exportFramingDxf.js:osbEntities. */
function subtractRanges(lo, hi, ranges) {
  const sorted = ranges
    .map(([a, b]) => [Math.max(lo, Math.min(a, b)), Math.min(hi, Math.max(a, b))])
    .filter(([a, b]) => b - a > EPS)
    .sort((r1, r2) => r1[0] - r2[0]);
  const out = [];
  let cursor = lo;
  for (const [a, b] of sorted) {
    if (a > cursor + EPS) out.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (hi > cursor + EPS) out.push([cursor, hi]);
  return out;
}

/** Rangos de vanos de un muro a lo largo de su eje de corrida, en coordenadas de MUNDO
 * ([worldMin+oMin, worldMin+oMax]). Deriva oMin/oMax igual que metalconModulation.js
 * (centerOffset = o.position − worldMin, span ±width/2). runAxis: 'x' | 'y'. */
function wallOpeningWorldRanges(wall, runAxis, worldMin, length, paramsMap, elementsById) {
  return (wall.openings || [])
    .filter(o => o.axisType === runAxis)
    .map(o => {
      const w = resolveValue(o.width, paramsMap, elementsById);
      const centerOffset = o.position - worldMin;
      const oMin = Math.max(0, Math.min(centerOffset - w / 2, length));
      const oMax = Math.max(0, Math.min(centerOffset + w / 2, length));
      return [worldMin + oMin, worldMin + oMax];
    })
    .filter(([a, b]) => b - a > EPS);
}

/** Rango [min,max] de todas las posiciones de eje (con margen) — usado para largo de las líneas
 * de eje/nivel; no afecta el resultado del snap, solo evita segmentos de largo arbitrario. */
function axisRange(axes, margin = 3000) {
  if (!axes.length) return [-margin, margin];
  const vals = axes.map(a => a.position);
  return [Math.min(...vals) - margin, Math.max(...vals) + margin];
}

/** Segmentos de planta: contorno de muros (caras partidas en los vanos + jambas en los bordes
 * del vano, sesión 6), columnas/vigas/fundaciones, ejes de grilla y líneas de referencia de
 * cerchas. En espacio de plano PLANTA: h=x, v=y. */
export function buildPlanSnapSegments(model, paramsMap = {}, elementsById = {}) {
  const { grid, elements } = model;
  const segments = [];

  const [yMin, yMax] = axisRange(grid.yAxes);
  for (const a of grid.xAxes) segments.push(seg(a.position, yMin, a.position, yMax));
  const [xMin, xMax] = axisRange(grid.xAxes);
  for (const a of grid.yAxes) segments.push(seg(xMin, a.position, xMax, a.position));

  for (const el of elements) {
    if (el.type === 'wall') {
      const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
      if (!geo) continue;
      const half = geo.thickness / 2;
      if (isWallXRun(el)) {
        const y0 = geo.p1.y;
        const lo = Math.min(geo.p1.x, geo.p2.x), hi = Math.max(geo.p1.x, geo.p2.x);
        const openRanges = wallOpeningWorldRanges(el, 'x', lo, hi - lo, paramsMap, elementsById);
        // caras longitudinales partidas en los vanos
        for (const [s, e] of subtractRanges(lo, hi, openRanges)) {
          segments.push(seg(s, y0 - half, e, y0 - half), seg(s, y0 + half, e, y0 + half));
        }
        // tapas de extremo + jambas (bordes de vano cruzando el espesor)
        segments.push(seg(lo, y0 - half, lo, y0 + half), seg(hi, y0 - half, hi, y0 + half));
        for (const [a, b] of openRanges) segments.push(seg(a, y0 - half, a, y0 + half), seg(b, y0 - half, b, y0 + half));
      } else {
        const x0 = geo.p1.x;
        const lo = Math.min(geo.p1.y, geo.p2.y), hi = Math.max(geo.p1.y, geo.p2.y);
        const openRanges = wallOpeningWorldRanges(el, 'y', lo, hi - lo, paramsMap, elementsById);
        for (const [s, e] of subtractRanges(lo, hi, openRanges)) {
          segments.push(seg(x0 - half, s, x0 - half, e), seg(x0 + half, s, x0 + half, e));
        }
        segments.push(seg(x0 - half, lo, x0 + half, lo), seg(x0 - half, hi, x0 + half, hi));
        for (const [a, b] of openRanges) segments.push(seg(x0 - half, a, x0 + half, a), seg(x0 - half, b, x0 + half, b));
      }
    } else if (el.type === 'column') {
      const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
      if (!geo) continue;
      const { x, y } = geo.center, hw = geo.w / 2, hh = geo.h / 2;
      segments.push(
        seg(x - hw, y - hh, x + hw, y - hh), seg(x + hw, y - hh, x + hw, y + hh),
        seg(x + hw, y + hh, x - hw, y + hh), seg(x - hw, y + hh, x - hw, y - hh)
      );
    } else if (el.type === 'beam' || el.type === 'foundation') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      if (!geo) continue;
      const hw = geo.width / 2;
      const dx = geo.p2.x - geo.p1.x, dy = geo.p2.y - geo.p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * hw, ny = dx / len * hw; // normal unitaria * medio ancho
      const a1 = { x: geo.p1.x + nx, y: geo.p1.y + ny }, a2 = { x: geo.p2.x + nx, y: geo.p2.y + ny };
      const b1 = { x: geo.p1.x - nx, y: geo.p1.y - ny }, b2 = { x: geo.p2.x - nx, y: geo.p2.y - ny };
      segments.push(seg(a1.x, a1.y, a2.x, a2.y), seg(b1.x, b1.y, b2.x, b2.y), seg(a1.x, a1.y, b1.x, b1.y), seg(a2.x, a2.y, b2.x, b2.y));
    }
  }

  segments.push(...computeRoofPlanSegments(model));
  return segments;
}

/** Segmentos de elevación: caras de muro (opening-aware, vía getWallElevationSegments — solo
 * para muros que SÍ aparecen en este corte), niveles Z, eje perpendicular de referencia,
 * geometría de cerchas y columnas/vigas en su cota Z real (rectángulo entre sus niveles,
 * vía getColumn/BeamElevationRect — sesión 6). */
export function buildElevationSnapSegments(model, modeStr, paramsMap = {}, elementsById = {}) {
  const { grid, elements } = model;
  const segments = [];
  const mode = { axis: modeStr.split('-')[1] };

  const hRange = mode.axis === 'x' ? axisRange(grid.yAxes) : axisRange(grid.xAxes);
  for (const lvl of grid.zLevels) segments.push(seg(hRange[0], lvl.elevation, hRange[1], lvl.elevation));

  const crossAxes = mode.axis === 'x' ? grid.yAxes : grid.xAxes;
  const vRange = axisRange(grid.zLevels.map(l => ({ position: l.elevation })), 1000);
  for (const a of crossAxes) segments.push(seg(a.position, vRange[0], a.position, vRange[1]));

  for (const el of elements) {
    const category = getElementElevationCategory(el, modeStr, grid, elementsById, paramsMap);
    if (category == null) continue;

    if (el.type === 'wall') {
      for (const r of getWallElevationSegments(el, grid, mode, paramsMap, elementsById)) {
        segments.push(
          seg(r.hMin, r.vMin, r.hMax, r.vMin), seg(r.hMax, r.vMin, r.hMax, r.vMax),
          seg(r.hMax, r.vMax, r.hMin, r.vMax), seg(r.hMin, r.vMax, r.hMin, r.vMin)
        );
      }
    } else if (el.type === 'column' || el.type === 'beam') {
      const r = el.type === 'column'
        ? getColumnElevationRect(el, grid, mode, paramsMap, elementsById)
        : getBeamElevationRect(el, grid, mode, category, paramsMap, elementsById);
      if (r) {
        segments.push(
          seg(r.hMin, r.vBottom, r.hMax, r.vBottom), seg(r.hMax, r.vBottom, r.hMax, r.vTop),
          seg(r.hMax, r.vTop, r.hMin, r.vTop), seg(r.hMin, r.vTop, r.hMin, r.vBottom)
        );
      }
    }
  }

  segments.push(...computeRoofElevationSegments(model, modeStr));
  return segments;
}
