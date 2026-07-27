// render/wall.js
import { project, projectPlane } from '../core/projection.js';
import { resolveWallGeometry, isWallXRun, wallOffsetToWorldPoint } from '../core/elementGeometry.js';
import { pointNearSegment, segmentFraction } from '../core/geometry.js';
import { resolveValue } from '../core/projectParams.js';
import { ROLE_COLOR } from './metalconModulation.js';
import { studFlangeSpan } from '../core/trussLayout.js';

// ---------------------------------------------------------------------------
// PLANTA
// ---------------------------------------------------------------------------

/** Rango vertical real (cota absoluta) de un vano: puerta arranca del piso del muro, ventana
 * arranca de su antepecho. Mismo criterio que computeOpeningRects (elevación), reutilizado acá
 * para el corte estricto en planta. */
function openingVerticalRange(wall, o, grid, paramsMap = {}) {
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!bottom || !top) return null;
  const oHeight = resolveValue(o.height, paramsMap);
  const oSillHeight = o.sillHeight != null ? resolveValue(o.sillHeight, paramsMap) : 0;
  const oBottom = o.type === 'door' ? bottom.elevation : bottom.elevation + (oSillHeight || 0);
  const oTop = Math.min(oBottom + oHeight, top.elevation);
  return { bottom: oBottom, top: oTop };
}

/** ¿El vano corta el plano Z actual? Borde inclusivo (decidido con Fran). Sin nivel seleccionado
 * (currentZLevelId null) no se filtra — comportamiento previo a la sesión 21. */
function openingCutsCurrentLevel(wall, o, grid, currentZLevelId, paramsMap = {}) {
  if (currentZLevelId == null) return true;
  const current = grid.zLevels.find(l => l.id === currentZLevelId);
  if (!current) return true;
  const range = openingVerticalRange(wall, o, grid, paramsMap);
  if (!range) return true; // vano sin rango resoluble: no ocultarlo silenciosamente
  return range.bottom <= current.elevation && range.top >= current.elevation;
}

/** Reemplaza drawWall. Dibuja el muro recto con recortes de vano por longitud. Los vanos que no
 * cortan `currentZLevelId` (p.ej. ventana en cota de cielo) no recortan: el muro se ve continuo. */
export function drawWallPlan(ctx, wall, grid, view, canvasH, isSelected, selectedElementId, paramsMap = {}, elementsById = {}, currentZLevelId = null) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return;

  const p1 = project(geo.p1.x, geo.p1.y, 0, 'plan', view, canvasH);
  const p2 = project(geo.p2.x, geo.p2.y, 0, 'plan', view, canvasH);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const isVertical = Math.abs(dx) < 0.001;
  const isHorizontal = Math.abs(dy) < 0.001;
  const half = (geo.thickness / 2) * view.scale;

  ctx.fillStyle = isSelected ? '#64748b' : '#475569';
  ctx.strokeStyle = isSelected ? '#1e40af' : '#1e2937';
  ctx.lineWidth = isSelected ? 2.5 : 1.2;

  if (!isVertical && !isHorizontal) {
    // Muro diagonal: sin recorte de vanos (igual que el original).
    const ux = dx / len, uy = dy / len;
    const px = -uy * half, py = ux * half;
    ctx.beginPath();
    ctx.moveTo(p1.x + px, p1.y + py);
    ctx.lineTo(p2.x + px, p2.y + py);
    ctx.lineTo(p2.x - px, p2.y - py);
    ctx.lineTo(p1.x - px, p1.y - py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }

  drawAxisAlignedSegments(ctx, wall, grid, geo, p1, p2, isVertical, half, selectedElementId, paramsMap, currentZLevelId);
}

function drawAxisAlignedSegments(ctx, wall, grid, geo, p1, p2, isVertical, half, selectedElementId, paramsMap = {}, currentZLevelId = null) {
  const openings = (wall.openings || [])
    .filter(o => o.axisType === (isVertical ? 'y' : 'x'))
    .filter(o => openingCutsCurrentLevel(wall, o, grid, currentZLevelId, paramsMap));
  const min = isVertical ? Math.min(p1.y, p2.y) : Math.min(p1.x, p2.x);
  const max = isVertical ? Math.max(p1.y, p2.y) : Math.max(p1.x, p2.x);
  const worldMin = isVertical ? Math.min(geo.p1.y, geo.p2.y) : Math.min(geo.p1.x, geo.p2.x);
  const worldMax = isVertical ? Math.max(geo.p1.y, geo.p2.y) : Math.max(geo.p1.x, geo.p2.x);

  const intervals = openings
    .map(o => {
      const oWidth = resolveValue(o.width, paramsMap);
      const w1 = Math.max(worldMin, o.position - oWidth / 2);
      const w2 = Math.min(worldMax, o.position + oWidth / 2);
      const s1 = min + (w1 - worldMin) / (worldMax - worldMin) * (max - min);
      const s2 = min + (w2 - worldMin) / (worldMax - worldMin) * (max - min);
      return { start: Math.min(s1, s2), end: Math.max(s1, s2), selected: o.id === selectedElementId };
    })
    .filter(i => i.end > i.start + 0.001)
    .sort((a, b) => a.start - b.start);

  const rect = (from, to) => isVertical
    ? [p1.x - half, from, 2 * half, to - from]
    : [from, p1.y - half, to - from, 2 * half];

  let cursor = min;
  for (const iv of intervals) {
    if (iv.start > cursor + 0.001) {
      ctx.fillRect(...rect(cursor, iv.start));
      ctx.strokeRect(...rect(cursor, iv.start));
    }
    cursor = Math.max(cursor, iv.end);
  }
  if (max > cursor + 0.001) {
    ctx.fillRect(...rect(cursor, max));
    ctx.strokeRect(...rect(cursor, max));
  }

  for (const iv of intervals.filter(i => i.selected)) {
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(...rect(iv.start, iv.end));
  }
}

/** Encuentra el vano (puerta/ventana) bajo el punto de pantalla dado, o null. Para selección directa de vanos. */
export function findOpeningAtPoint(sx, sy, wall, grid, view, canvasH, margin = 8, paramsMap = {}, elementsById = {}, currentZLevelId = null) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return null;

  const p1 = project(geo.p1.x, geo.p1.y, 0, 'plan', view, canvasH);
  const p2 = project(geo.p2.x, geo.p2.y, 0, 'plan', view, canvasH);
  const halfThick = (geo.thickness / 2) * view.scale;
  if (!pointNearSegment(sx, sy, p1, p2, halfThick, margin)) return null;

  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const isVertical = Math.abs(dx) < 0.001;
  const isHorizontal = Math.abs(dy) < 0.001;
  if (!isVertical && !isHorizontal) return null;

  const frac = segmentFraction(sx, sy, p1, p2);
  const worldMin = isVertical ? Math.min(geo.p1.y, geo.p2.y) : Math.min(geo.p1.x, geo.p2.x);
  const worldMax = isVertical ? Math.max(geo.p1.y, geo.p2.y) : Math.max(geo.p1.x, geo.p2.x);
  if (worldMax - worldMin < 0.001) return null;
  const worldPos = worldMin + frac * (worldMax - worldMin);

  const axisType = isVertical ? 'y' : 'x';
  const tol = margin / view.scale;
  return (wall.openings || []).find(o => {
    if (o.axisType !== axisType) return false;
    if (!openingCutsCurrentLevel(wall, o, grid, currentZLevelId, paramsMap)) return false;
    const oWidth = resolveValue(o.width, paramsMap);
    return worldPos >= o.position - oWidth / 2 - tol && worldPos <= o.position + oWidth / 2 + tol;
  }) || null;
}

/** Reemplaza isPointInWall. Grosor + exclusión de vanos, en espacio de pantalla. */
export function isPointInWallPlan(sx, sy, wall, grid, view, canvasH, margin = 8, paramsMap = {}, elementsById = {}, currentZLevelId = null) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return false;

  const p1 = project(geo.p1.x, geo.p1.y, 0, 'plan', view, canvasH);
  const p2 = project(geo.p2.x, geo.p2.y, 0, 'plan', view, canvasH);
  const halfThick = (geo.thickness / 2) * view.scale;
  if (!pointNearSegment(sx, sy, p1, p2, halfThick, margin)) return false;

  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const isVertical = Math.abs(dx) < 0.001;
  const isHorizontal = Math.abs(dy) < 0.001;
  if (!isVertical && !isHorizontal) return true;

  const frac = segmentFraction(sx, sy, p1, p2);
  const worldMin = isVertical ? Math.min(geo.p1.y, geo.p2.y) : Math.min(geo.p1.x, geo.p2.x);
  const worldMax = isVertical ? Math.max(geo.p1.y, geo.p2.y) : Math.max(geo.p1.x, geo.p2.x);
  if (worldMax - worldMin < 0.001) return true;
  const worldPos = worldMin + frac * (worldMax - worldMin);

  const openings = wall.openings || [];
  const axisType = isVertical ? 'y' : 'x';
  const tol = margin / view.scale;
  return !openings.some(o => {
    if (o.axisType !== axisType) return false;
    if (!openingCutsCurrentLevel(wall, o, grid, currentZLevelId, paramsMap)) return false;
    const oWidth = resolveValue(o.width, paramsMap);
    return worldPos >= o.position - oWidth / 2 - tol && worldPos <= o.position + oWidth / 2 + tol;
  });
}

// ---------------------------------------------------------------------------
// ELEVACIÓN
// ---------------------------------------------------------------------------

function getPointOnWallByPosition(geo, position, axisType) {
  // Muro paralelo a un eje: interpola sobre su propio eje según 'position'.
  const t = axisType === 'y'
    ? (position - Math.min(geo.p1.y, geo.p2.y)) / (Math.max(geo.p1.y, geo.p2.y) - Math.min(geo.p1.y, geo.p2.y) || 1)
    : (position - Math.min(geo.p1.x, geo.p2.x)) / (Math.max(geo.p1.x, geo.p2.x) - Math.min(geo.p1.x, geo.p2.x) || 1);
  return { x: geo.p1.x + (geo.p2.x - geo.p1.x) * t, y: geo.p1.y + (geo.p2.y - geo.p1.y) * t };
}

/** Reemplaza getElevationWallSegments. Devuelve rectángulos {hMin,hMax,vMin,vMax} en espacio de plano. */
function computeOpeningRects(wall, geo, bottom, top, mode, paramsMap = {}) {
  const project1D = (x, y) => mode.axis === 'x' ? y : x;
  const vMin = bottom.elevation, vMax = top.elevation;
  return (wall.openings || []).map(o => {
    const point = getPointOnWallByPosition(geo, o.position, o.axisType);
    const centerH = project1D(point.x, point.y);
    const oWidth = resolveValue(o.width, paramsMap);
    const oHeight = resolveValue(o.height, paramsMap);
    const oSillHeight = o.sillHeight != null ? resolveValue(o.sillHeight, paramsMap) : 0;
    const halfW = oWidth / 2;
    const oVBottom = o.type === 'door' ? vMin : vMin + (oSillHeight || 0);
    const oVTop = Math.min(oVBottom + oHeight, vMax);
    return { opening: o, hMin: centerH - halfW, hMax: centerH + halfW, vMin: oVBottom, vMax: oVTop };
  });
}

export function getWallElevationSegments(wall, grid, mode, paramsMap = {}, elementsById = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!geo || !bottom || !top) return [];

  const project1D = (x, y) => mode.axis === 'x' ? y : x;
  const h1 = project1D(geo.p1.x, geo.p1.y);
  const h2 = project1D(geo.p2.x, geo.p2.y);
  const hMin = Math.min(h1, h2), hMax = Math.max(h1, h2);
  const vMin = bottom.elevation, vMax = top.elevation;

  const rects = computeOpeningRects(wall, geo, bottom, top, mode, paramsMap);

  if (rects.length === 0) return [{ hMin, hMax, vMin, vMax }];

  const vCuts = Array.from(new Set([vMin, vMax, ...rects.flatMap(r => [r.vMin, r.vMax])])).sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < vCuts.length - 1; i++) {
    const v1 = vCuts[i], v2 = vCuts[i + 1];
    if (v2 - v1 < 0.001) continue;
    const covering = rects.filter(r => r.vMin <= v1 + 0.001 && r.vMax >= v2 - 0.001).sort((a, b) => a.hMin - b.hMin);
    if (covering.length === 0) { segments.push({ hMin, hMax, vMin: v1, vMax: v2 }); continue; }

    const merged = [];
    for (const r of covering) {
      if (merged.length === 0 || r.hMin > merged[merged.length - 1].hMax + 0.001) merged.push({ ...r });
      else merged[merged.length - 1].hMax = Math.max(merged[merged.length - 1].hMax, r.hMax);
    }
    let cursor = hMin;
    for (const r of merged) {
      if (r.hMin > cursor + 0.001) segments.push({ hMin: cursor, hMax: r.hMin, vMin: v1, vMax: v2 });
      cursor = Math.max(cursor, r.hMax);
    }
    if (cursor < hMax - 0.001) segments.push({ hMin: cursor, hMax, vMin: v1, vMax: v2 });
  }
  return segments;
}

/** Encuentra el vano bajo el punto (h,v) del plano de elevación, o null. Reemplaza la falta de selección de vanos en elevación. */
export function findOpeningAtPointElevation(h, v, wall, grid, mode, margin = 8, paramsMap = {}, elementsById = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!geo || !bottom || !top) return null;

  const rects = computeOpeningRects(wall, geo, bottom, top, mode, paramsMap);
  const hit = rects.find(r => h >= r.hMin - margin && h <= r.hMax + margin && v >= r.vMin - margin && v <= r.vMax + margin);
  return hit ? hit.opening : null;
}

/** Reemplaza drawElevationWall. */
export function drawWallElevation(ctx, wall, grid, mode, view, canvasH, isSelected, color, paramsMap = {}, elementsById = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!geo || !bottom || !top) return;

  const isPerpendicular = mode.axis === 'x'
    ? Math.abs(geo.p1.y - geo.p2.y) < 0.001
    : Math.abs(geo.p1.x - geo.p2.x) < 0.001;

  ctx.fillStyle = isSelected ? '#64748b' : color.fill;
  ctx.strokeStyle = isSelected ? '#1e40af' : color.stroke;
  ctx.lineWidth = isSelected ? 2.5 : 1.2;

  if (isPerpendicular) {
    const pos = mode.axis === 'x' ? geo.p1.y : geo.p1.x;
    const thickness = geo.thickness || 200;
    const p1 = projectPlane(pos - thickness / 2, bottom.elevation, mode, view, canvasH);
    const p2 = projectPlane(pos + thickness / 2, top.elevation, mode, view, canvasH);
    ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
    ctx.strokeRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
    return;
  }

  const segments = getWallElevationSegments(wall, grid, mode, paramsMap, elementsById);
  if (segments.length === 0) return;

  let outerHMin = Infinity, outerHMax = -Infinity, outerVMin = Infinity, outerVMax = -Infinity;
  ctx.beginPath();
  for (const seg of segments) {
    const p1 = projectPlane(seg.hMin, seg.vMin, mode, view, canvasH);
    const p2 = projectPlane(seg.hMax, seg.vMax, mode, view, canvasH);
    ctx.rect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
    outerHMin = Math.min(outerHMin, p1.x, p2.x);
    outerHMax = Math.max(outerHMax, p1.x, p2.x);
    outerVMin = Math.min(outerVMin, p1.y, p2.y);
    outerVMax = Math.max(outerVMax, p1.y, p2.y);
  }
  ctx.fill();
  ctx.strokeRect(outerHMin, outerVMin, outerHMax - outerHMin, outerVMax - outerVMin);
}

/** Dibuja `wall.studs` sobre la Elevación (perpendicular al muro, no en planta/3D).
 * `studProfile` es el perfil real de librería (H/B en mm) para el ancho aparente del montante;
 * si no hay perfil asignado, usa un ancho de línea fijo (fallback visual, no estructural). */
export function drawWallStudsElevation(ctx, wall, grid, mode, view, canvasH, studProfile, paramsMap = {}, elementsById = {}) {
  if (!wall.studs?.length) return;
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  if (!geo || !bottom) return;

  const isPerpendicular = mode.axis === 'x'
    ? Math.abs(geo.p1.y - geo.p2.y) < 0.001
    : Math.abs(geo.p1.x - geo.p2.x) < 0.001;
  if (isPerpendicular) return; // el muro se ve de canto: los montantes no son legibles acá

  const project1D = (x, y) => mode.axis === 'x' ? y : x;
  const studWidth = studProfile?.B ?? 90; // mm, ancho de perfil (fallback ~90mm)
  const baseZ = bottom.elevation;

  // Fase de cada pieza: la resuelve `studFlangeSpan` (core), la misma función que usa el DXF de
  // tabiquería. Antes este bloque estaba duplicado literal en `exportFramingDxf.js` (R2).
  const runSpan = isWallXRun(wall) ? geo.p2.x - geo.p1.x : geo.p2.y - geo.p1.y;
  const flangeCtx = {
    length: Math.abs(runSpan),
    jambMins: (wall.headers || []).map(h => h.oMin),
    jambMaxs: (wall.headers || []).map(h => h.oMax)
  };

  for (const s of wall.studs) {
    // el span viene en offsets locales: se lleva a mundo por los DOS extremos (no por el centro
    // + ancho) para que valga también si el muro corre de p1 a p2 en sentido decreciente.
    const span = s.role === 'nogging'
      ? { xMin: s.oMin, xMax: s.oMax }
      : studFlangeSpan(s, flangeCtx, studWidth);
    const a = wallOffsetToWorldPoint(wall, geo, span.xMin);
    const b = wallOffsetToWorldPoint(wall, geo, span.xMax);
    const ha = project1D(a.x, a.y), hb = project1D(b.x, b.y);
    const hMin = Math.min(ha, hb), hMax = Math.max(ha, hb);
    const p1 = projectPlane(hMin, baseZ + s.zMin, mode, view, canvasH);
    const p2 = projectPlane(hMax, baseZ + s.zMax, mode, view, canvasH);
    ctx.fillStyle = ROLE_COLOR[s.role] || '#475569';
    ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
  }
}

/** Dibuja `wall.headers` (dintel/antepecho, piezas horizontales de vano) sobre la Elevación.
 * `trackProfile` es el perfil real de solera (H en mm) para el espesor aparente; sin perfil
 * asignado usa un espesor de línea fijo (fallback visual). */
export function drawWallHeadersElevation(ctx, wall, grid, mode, view, canvasH, trackProfile, paramsMap = {}, elementsById = {}) {
  if (!wall.headers?.length) return;
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  if (!geo || !bottom) return;

  const isPerpendicular = mode.axis === 'x'
    ? Math.abs(geo.p1.y - geo.p2.y) < 0.001
    : Math.abs(geo.p1.x - geo.p2.x) < 0.001;
  if (isPerpendicular) return;

  const project1D = (x, y) => mode.axis === 'x' ? y : x;
  const trackThickness = trackProfile?.H ?? 90;
  const baseZ = bottom.elevation;

  for (const hdr of wall.headers) {
    const pMin = wallOffsetToWorldPoint(wall, geo, hdr.oMin);
    const pMax = wallOffsetToWorldPoint(wall, geo, hdr.oMax);
    const hMin = project1D(pMin.x, pMin.y);
    const hMax = project1D(pMax.x, pMax.y);
    const z = baseZ + hdr.z;
    // Dintel: afuera del vano hacia arriba. Antepecho: afuera del vano hacia abajo.
    const isSill = hdr.role === 'sill';
    const zMin = isSill ? z - trackThickness : z;
    const zMax = isSill ? z : z + trackThickness;
    const p1 = projectPlane(hMin, zMin, mode, view, canvasH);
    const p2 = projectPlane(hMax, zMax, mode, view, canvasH);
    ctx.fillStyle = ROLE_COLOR[hdr.role] || '#475569';
    ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
  }
}

/** Reemplaza isPointInWallElev. Opera en espacio de plano (h,v), no de pantalla. */
export function isPointInWallElevation(h, v, wall, grid, mode, margin = 8, paramsMap = {}, elementsById = {}) {
  const segments = getWallElevationSegments(wall, grid, mode, paramsMap, elementsById);
  return segments.some(seg =>
    h >= seg.hMin - margin && h <= seg.hMax + margin && v >= seg.vMin - margin && v <= seg.vMax + margin
  );
}
