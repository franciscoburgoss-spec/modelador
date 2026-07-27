// render/dimensions.js
// ★ Cotas vivas (ítem 6). Dibuja la cadena de cotas resuelta por core/dimensions.js y
// resuelve el hit-test para selección en canvas (clic sobre la línea de cota).
//
// Convención geométrica (ver core/dimensions.js para el porqué): la cota tiene una
// "coordenada que se mueve" (coord de cada punto de la cadena) y una "coordenada fija"
// (dim.linePos, dónde se dibuja la línea de cota, perpendicular a la cadena):
//   - plan, orientation 'x': coord = X, línea fija en Y = linePos → línea horizontal en pantalla.
//   - plan, orientation 'y': coord = Y, línea fija en X = linePos → línea vertical en pantalla.
//   - elevation, orientation 'z': coord = Z (elevación), línea fija en H = linePos → vertical en pantalla.
//   - elevation, orientation 'x'|'y' (debe calzar con el eje perpendicular del modo actual):
//     coord = posición de eje (H), línea fija en V = linePos (una elevación Z) → horizontal.
//
// Línea de extensión real: si un punto de la cadena referencia un elemento (no un ID de eje
// de grilla), se dibuja además una línea delgada desde la posición perpendicular REAL de ese
// elemento (resolveDimensionAnchor) hasta la línea de cota — igual que en un plano de obra,
// donde la cota "cuelga" de la geometría real en vez de solo indicar un número flotante.

import { project, projectPlane } from '../core/projection.js';
import { computeDimensionChain, resolveDimensionAnchor } from '../core/dimensions.js';
import { parseElevationMode } from '../core/viewMode.js';
import { pointNearSegment } from '../core/geometry.js';

const COLOR_OK = '#0f766e';
const COLOR_ERROR = '#dc2626';
const COLOR_SELECTED = '#1e40af';
const COLOR_EXTENSION = '#94a3b8';
const TICK_LEN = 6;
const HIT_MARGIN_PX = 8;

function isHorizontalLine(dim) {
  return (dim.view === 'plan' && dim.orientation === 'x') || (dim.view === 'elevation' && dim.orientation !== 'z');
}

/** Proyecta un punto de la cadena (coord numérico, sobre la línea de cota) a pantalla. */
function pointToScreen(dim, coord, view, canvasH, elevationMode) {
  if (dim.view === 'plan') {
    return dim.orientation === 'x'
      ? project(coord, dim.linePos, 0, 'plan', view, canvasH)
      : project(dim.linePos, coord, 0, 'plan', view, canvasH);
  }
  return dim.orientation === 'z'
    ? projectPlane(dim.linePos, coord, elevationMode, view, canvasH)
    : projectPlane(coord, dim.linePos, elevationMode, view, canvasH);
}

/** Proyecta el anchor real (perpendicular) de un punto a pantalla, con el mismo coord. */
function anchorToScreen(dim, coord, anchor, view, canvasH, elevationMode) {
  if (dim.view === 'plan') {
    return dim.orientation === 'x'
      ? project(coord, anchor, 0, 'plan', view, canvasH)
      : project(anchor, coord, 0, 'plan', view, canvasH);
  }
  return dim.orientation === 'z'
    ? projectPlane(anchor, coord, elevationMode, view, canvasH)
    : projectPlane(coord, anchor, elevationMode, view, canvasH);
}

function drawTick(ctx, p, horizontal, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(p.x, p.y - TICK_LEN); ctx.lineTo(p.x, p.y + TICK_LEN); }
  else { ctx.moveTo(p.x - TICK_LEN, p.y); ctx.lineTo(p.x + TICK_LEN, p.y); }
  ctx.stroke();
}

function drawExtensionLine(ctx, from, to) {
  ctx.strokeStyle = COLOR_EXTENSION;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSegmentLabel(ctx, p1, p2, text, horizontal, color) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  ctx.fillStyle = color;
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = horizontal ? 'bottom' : 'middle';
  if (horizontal) ctx.fillText(text, mx, my - TICK_LEN - 2);
  else { ctx.save(); ctx.translate(mx - TICK_LEN - 4, my); ctx.textAlign = 'right'; ctx.fillText(text, 0, 0); ctx.restore(); }
}

/** Dibuja una cota ya resuelta (chain de core/dimensions.js) sobre el canvas. */
function drawResolvedDimension(ctx, dim, chain, view, canvasH, elevationMode, elementsById, paramsMap, isSelected) {
  const horizontal = isHorizontalLine(dim);
  const color = isSelected ? COLOR_SELECTED : (chain.resolved ? COLOR_OK : COLOR_ERROR);
  const screenPoints = chain.points.map(p => p.coord == null ? null : pointToScreen(dim, p.coord, view, canvasH, elevationMode));

  const validScreenPoints = screenPoints.filter(Boolean);
  if (validScreenPoints.length >= 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(validScreenPoints[0].x, validScreenPoints[0].y);
    for (const sp of validScreenPoints.slice(1)) ctx.lineTo(sp.x, sp.y);
    ctx.stroke();
  }

  screenPoints.forEach(sp => { if (sp) drawTick(ctx, sp, horizontal, color); });

  chain.segments.forEach((seg, i) => {
    const a = screenPoints[seg.fromIndex];
    const b = screenPoints[seg.toIndex];
    if (!a || !b) return;
    const label = seg.distance == null ? '?' : `${Math.round(seg.distance)}`;
    drawSegmentLabel(ctx, a, b, label, horizontal, color);
  });

  // Total al final de la cadena, entre paréntesis (si hay 3+ puntos y todo resolvió).
  if (chain.total != null && chain.points.length > 2) {
    const last = screenPoints[screenPoints.length - 1];
    if (last) {
      ctx.fillStyle = color;
      ctx.font = 'italic 10px system-ui';
      if (horizontal) { ctx.textAlign = 'left'; ctx.fillText(`(${Math.round(chain.total)})`, last.x + 6, last.y); }
      else { ctx.textAlign = 'left'; ctx.fillText(`(${Math.round(chain.total)})`, last.x, last.y - 10); }
    }
  }
}

/** Dibuja las líneas de extensión reales (anchor de elemento → línea de cota), antes de la línea de cota. */
function drawExtensions(ctx, dim, chain, grid, view, canvasH, elevationMode, elementsById, paramsMap) {
  chain.points.forEach((p) => {
    if (p.coord == null) return;
    const anchor = resolveDimensionAnchor(p.raw, dim, grid, elementsById, paramsMap);
    if (anchor == null) return;
    const from = anchorToScreen(dim, p.coord, anchor, view, canvasH, elevationMode);
    const to = pointToScreen(dim, p.coord, view, canvasH, elevationMode);
    drawExtensionLine(ctx, from, to);
  });
}

function drawDimension(ctx, dim, grid, view, canvasH, elevationMode, elementsById, paramsMap, isSelected) {
  const chain = computeDimensionChain(dim, grid, elementsById, paramsMap);
  if (!chain) return;
  drawExtensions(ctx, dim, chain, grid, view, canvasH, elevationMode, elementsById, paramsMap);
  drawResolvedDimension(ctx, dim, chain, view, canvasH, elevationMode, elementsById, paramsMap, isSelected);
}

/** Cotas de planta: solo las que viven en el nivel Z actualmente seleccionado. */
export function drawDimensionsPlan(ctx, model, view, canvasH, elementsById, paramsMap) {
  const dims = (model.dimensions || []).filter(d => d.view === 'plan' && d.zLevelId === model.currentZLevelId);
  for (const dim of dims) {
    drawDimension(ctx, dim, model.grid, view, canvasH, null, elementsById, paramsMap, dim.id === model.selectedElementId);
  }
}

/** Cotas de elevación: solo las que viven en el modo de elevación actualmente activo. */
export function drawDimensionsElevation(ctx, model, modeStr, view, canvasH, elementsById, paramsMap) {
  const parsed = parseElevationMode(modeStr);
  if (!parsed) return;
  const elevationMode = { axis: parsed.axisType };
  const dims = (model.dimensions || []).filter(d => d.view === 'elevation' && d.elevationMode === modeStr);
  for (const dim of dims) {
    drawDimension(ctx, dim, model.grid, view, canvasH, elevationMode, elementsById, paramsMap, dim.id === model.selectedElementId);
  }
}

/** ¿El clic (sx,sy en pantalla) cae sobre algún tramo de alguna cota visible? Devuelve su id, o null. */
function hitTestDimensionList(sx, sy, dims, grid, view, canvasH, elevationMode, elementsById, paramsMap) {
  for (let i = dims.length - 1; i >= 0; i--) {
    const dim = dims[i];
    const chain = computeDimensionChain(dim, grid, elementsById, paramsMap);
    if (!chain) continue;
    const screenPoints = chain.points.map(p => p.coord == null ? null : pointToScreen(dim, p.coord, view, canvasH, elevationMode));
    for (const seg of chain.segments) {
      const a = screenPoints[seg.fromIndex];
      const b = screenPoints[seg.toIndex];
      if (a && b && pointNearSegment(sx, sy, a, b, 0, HIT_MARGIN_PX)) return dim.id;
    }
  }
  return null;
}

export function hitTestDimensionsPlan(sx, sy, model, view, canvasH, elementsById, paramsMap) {
  const dims = (model.dimensions || []).filter(d => d.view === 'plan' && d.zLevelId === model.currentZLevelId);
  return hitTestDimensionList(sx, sy, dims, model.grid, view, canvasH, null, elementsById, paramsMap);
}

export function hitTestDimensionsElevation(sx, sy, model, modeStr, view, canvasH, elementsById, paramsMap) {
  const parsed = parseElevationMode(modeStr);
  if (!parsed) return null;
  const elevationMode = { axis: parsed.axisType };
  const dims = (model.dimensions || []).filter(d => d.view === 'elevation' && d.elevationMode === modeStr);
  return hitTestDimensionList(sx, sy, dims, model.grid, view, canvasH, elevationMode, elementsById, paramsMap);
}
