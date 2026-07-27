// core/metalconModulation.js
// ★ Modulación de metalcon (paso 1): despiece de montantes de un muro en base a
// perfiles Metalcon (ver core/metalconCatalog.js) y las reglas de "Paneles de Muro"
// del Manual de Diseño Metalcon Cintac 2020 (espaciamiento 400-600mm, montante doble
// en jambas de vano, montante corto bajo/sobre vano — ver §1.1 y Anexo IV).
//
// Alcance v1: geometría pura (offsets a lo largo del muro + rango vertical por montante).
// No calcula capacidad/resistencia (eso lo hace CalculiX aguas abajo) ni corta perfiles
// por largo de barra comercial (lengthsM del catálogo) — eso queda para una siguiente etapa.
//
// Vocabulario de rol (análogo al usado en tabiquería de madera del proyecto, adaptado a acero):
//   edge    → montante de extremo de muro (siempre, alma a alma con solera)
//   corner  → como 'edge', pero el extremo coincide con la esquina/T de otro muro
//   backup  → montante adicional junto a 'corner', de respaldo para anclar el muro que llega
//   stud    → montante de relleno a espaciamiento regular
//   king    → montante doble de jamba (altura completa), flanquea el vano
//   jack    → montante corto bajo el dintel (mismo offset que king), soporta el dintel
//   cripple → montante corto entre solera inferior y antepecho (bajo antepecho: jambas + relleno)
//   crippleTop → montante corto entre dintel y solera superior (sobre el dintel: solo relleno, la jamba ya es 'king' de altura completa)
//   header  → pieza HORIZONTAL (dintel) que cierra el vano por arriba, apoyada sobre los 'jack' (todo vano)
//   sill    → pieza HORIZONTAL (antepecho) que cierra el vano por abajo, apoyada sobre los 'cripple' (solo 'window')

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';

const EPS = 1; // mm — tolerancia para "misma posición" / bordes

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function nearAny(offset, offsets, tol = EPS) {
  return offsets.some(o => Math.abs(o - offset) < tol);
}

/**
 * Detecta si los extremos de `wall` coinciden con el extremo o el cuerpo de otro muro del
 * mismo nivel (condición de esquina L o encuentro en T). Solo coincidencia geométrica en
 * planta — no considera si el otro muro es estructural o el ángulo del encuentro.
 * Devuelve { start: boolean, end: boolean }.
 */
export function detectWallCorners(wall, allElements, grid, paramsMap = {}, elementsById = {}, tolerance = 5) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return { start: false, end: false };

  const others = allElements.filter(el => el.type === 'wall' && el.id !== wall.id);
  let start = false, end = false;

  for (const other of others) {
    const og = resolveWallGeometry(other, grid, paramsMap, elementsById);
    if (!og) continue;
    // Coincidencia por punto (esquina L: extremo con extremo) o por proyección sobre el
    // segmento del otro muro (encuentro en T: extremo de `wall` cae en el cuerpo de `other`).
    if (pointOnSegment(geo.p1, og.p1, og.p2, tolerance)) start = true;
    if (pointOnSegment(geo.p2, og.p1, og.p2, tolerance)) end = true;
  }
  return { start, end };
}

function pointOnSegment(p, a, b, tolerance) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return dist(p, a) < tolerance;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len), 0, 1);
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return dist(p, proj) < tolerance;
}

function dist(p, q) {
  return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
}

/**
 * Calcula el despiece de montantes de un muro. Lógica pura — no toca el store ni persiste.
 *
 * @param wall    elemento muro (con openings[])
 * @param grid    model.grid
 * @param paramsMap  buildParamsMap(model.projectParams)
 * @param elementsById  buildElementsById(model.elements)
 * @param config  { spacing (mm, formula u número; default 400), backupOffset (mm; default 100),
 *                  corners: { start, end } (de detectWallCorners; default sin esquina) }
 * @returns { resolved, length, wallHeight, studs: [{ offset, zMin, zMax, role }] }
 *          offset: distancia en mm desde el extremo "start" del muro, a lo largo de su eje.
 */
export function computeStudLayout(wall, grid, paramsMap = {}, elementsById = {}, config = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return { resolved: false, length: null, wallHeight: null, studs: [] };

  const runAxis = isWallXRun(wall) ? 'x' : 'y';
  const worldMin = runAxis === 'x' ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
  const worldMax = runAxis === 'x' ? Math.max(geo.p1.x, geo.p2.x) : Math.max(geo.p1.y, geo.p2.y);
  const length = worldMax - worldMin;

  const bottomLevel = grid.zLevels.find(l => l.id === wall.bottomZ);
  const topLevel = grid.zLevels.find(l => l.id === wall.topZ);
  const wallHeight = (bottomLevel && topLevel) ? topLevel.elevation - bottomLevel.elevation : null;

  if (!(length > EPS) || !(wallHeight > 0)) {
    return { resolved: false, length: length > 0 ? length : null, wallHeight: wallHeight > 0 ? wallHeight : null, studs: [], headers: [] };
  }

  const spacing = resolveValue(config.spacing ?? 400, paramsMap, elementsById);
  const backupOffset = config.backupOffset ?? 100;
  const corners = config.corners || { start: false, end: false };

  // --- vanos: intervalo horizontal [oMin,oMax] + rango vertical relativo al pie del muro ---
  const openingSpans = (wall.openings || [])
    .filter(o => o.axisType === runAxis)
    .map(o => {
      const w = resolveValue(o.width, paramsMap, elementsById);
      const h = resolveValue(o.height, paramsMap, elementsById);
      const sill = o.type === 'window' ? resolveValue(o.sillHeight ?? 0, paramsMap, elementsById) : 0;
      const centerOffset = o.position - worldMin;
      return {
        id: o.id,
        oMin: clamp(centerOffset - w / 2, 0, length),
        oMax: clamp(centerOffset + w / 2, 0, length),
        sillRel: clamp(sill, 0, wallHeight),
        topRel: clamp(sill + h, 0, wallHeight)
      };
    })
    .filter(s => s.oMax - s.oMin > EPS);

  const studs = [];
  const placedOffsets = [];

  const pushStud = (offset, role, zMin = 0, zMax = wallHeight) => {
    studs.push({ offset: Math.round(offset * 10) / 10, zMin, zMax, role });
    placedOffsets.push(offset);
  };

  // 1) extremos (edge / corner + backup)
  pushStud(0, corners.start ? 'corner' : 'edge');
  pushStud(length, corners.end ? 'corner' : 'edge');
  if (corners.start && backupOffset < length) pushStud(backupOffset, 'backup');
  if (corners.end && length - backupOffset > 0) pushStud(length - backupOffset, 'backup');

  const findOpeningSpanAt = (offset) => openingSpans.find(s => offset > s.oMin + EPS && offset < s.oMax - EPS);

  // Subdivide [oMin,oMax] en tramos ~spacing, medidos desde los propios bordes del vano y
  // SIEMPRE centrados (todos los tramos iguales) — nunca ancla a la grilla global de relleno
  // del muro, así no queda un tramo corto pegado a un solo lado.
  const centeredFillOffsets = (oMin, oMax, step) => {
    const span = oMax - oMin;
    if (span <= EPS || step <= 0) return [];
    const n = Math.max(1, Math.round(span / step));
    const segment = span / n;
    const offsets = [];
    for (let i = 1; i < n; i++) offsets.push(oMin + i * segment);
    return offsets;
  };

  // 2) relleno a espaciamiento regular del muro (fuera del ancho de los vanos)
  if (spacing > 0) {
    for (let o = spacing; o < length - EPS; o += spacing) {
      if (nearAny(o, placedOffsets) || findOpeningSpanAt(o)) continue;
      pushStud(o, 'stud');
    }
  }

  // 3) jambas de vano: king (altura completa, una vez por posición de jamba) + montantes por zona
  // sólida (cripple/jack/crippleTop). Los vanos que comparten el mismo ancho (oMin/oMax, p.ej. dos
  // ventanas apiladas en el mismo eje Z) se agrupan: sus zonas sólidas se encadenan (piso → vano1 →
  // entrevano → vano2 → cielo) para no invadir el vidrio del vano vecino con el relleno del otro.
  const groupKey = (s) => `${Math.round(s.oMin * 10)}|${Math.round(s.oMax * 10)}`;
  const openingGroups = new Map();
  for (const span of openingSpans) {
    const key = groupKey(span);
    if (!openingGroups.has(key)) openingGroups.set(key, []);
    openingGroups.get(key).push(span);
  }

  for (const group of openingGroups.values()) {
    group.sort((a, b) => a.sillRel - b.sillRel);
    const { oMin, oMax } = group[0];

    // zonas sólidas encadenadas: [0..sillRel0], [topRel0..sillRel1], ..., [topRelN..wallHeight]
    const zones = [];
    let base = 0;
    for (const span of group) {
      if (span.sillRel - base > EPS) zones.push({ zMin: base, zMax: span.sillRel, role: 'cripple' });
      zones.push({ zMin: base, zMax: span.topRel, role: 'jack' });
      base = span.topRel;
    }
    if (wallHeight - base > EPS) zones.push({ zMin: base, zMax: wallHeight, role: 'crippleTop' });

    for (const jambOffset of [oMin, oMax]) {
      if (jambOffset > EPS && jambOffset < length - EPS && !nearAny(jambOffset, placedOffsets)) {
        pushStud(jambOffset, 'king');
      }
      for (const z of zones) pushStud(jambOffset, z.role, z.zMin, z.zMax);
    }

    for (const o of centeredFillOffsets(oMin, oMax, spacing)) {
      for (const z of zones) {
        if (z.role === 'jack') continue; // el jack es soporte de jamba — el relleno intermedio solo necesita cripple/crippleTop
        pushStud(o, z.role, z.zMin, z.zMax);
      }
    }
  }

  studs.sort((a, b) => a.offset - b.offset || a.zMin - b.zMin);

  // 4) piezas horizontales del vano: dintel (header, siempre) y antepecho (sill, solo con antepecho > 0)
  const headers = [];
  for (const span of openingSpans) {
    headers.push({ oMin: span.oMin, oMax: span.oMax, z: span.topRel, role: 'header' });
    if (span.sillRel > EPS) headers.push({ oMin: span.oMin, oMax: span.oMax, z: span.sillRel, role: 'sill' });
  }
  headers.sort((a, b) => a.oMin - b.oMin);

  return { resolved: true, length, wallHeight, studs, headers };
}
