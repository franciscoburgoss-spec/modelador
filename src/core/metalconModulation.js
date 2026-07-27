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
//   corner  → pieza de altura completa que integra un pilar conformado L/T
//   backup  → rol legacy: se conserva al importar, pero este solver nunca lo genera
//   stud    → montante de relleno a espaciamiento regular
//   king    → montante doble de jamba (altura completa), flanquea el vano
//   jack    → montante corto bajo el dintel (mismo offset que king), soporta el dintel
//   cripple → montante corto entre solera inferior y antepecho (bajo antepecho: jambas + relleno)
//   crippleTop → montante corto entre dintel y solera superior (sobre el dintel: solo relleno, la jamba ya es 'king' de altura completa)
//   header  → pieza HORIZONTAL (dintel) que cierra el vano por arriba, apoyada sobre los 'jack' (todo vano)
//   sill    → pieza HORIZONTAL (antepecho) que cierra el vano por abajo, apoyada sobre los 'cripple' (solo 'window')

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';
import { studFlangeSpan } from './trussLayout.js';
import {
  analyzeWallJunctions,
  compareStableWallIds,
  getWallJunctionView
} from './wallJunctions.js';

const EPS = 1; // mm — tolerancia para "misma posición" / bordes

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function nearAny(offset, offsets, tol = EPS) {
  return offsets.some(o => Math.abs(o - offset) < tol);
}

/** Adaptador booleano temporal. La autoridad es `analyzeWallJunctions`; ningún consumidor nuevo
 * debe volver a recorrer muros localmente. */
export function detectWallCorners(wall, allElements, grid, paramsMap = {}, elementsById = {}, tolerance = 5) {
  const topology = analyzeWallJunctions(
    { grid, elements: allElements },
    { tolerance, paramsMap, elementsById }
  );
  const view = getWallJunctionView(topology, wall.id);
  const isJunction = (endpoint) => endpoint?.tipo === 'L' || endpoint?.tipo === 'T';
  return {
    start: isJunction(view?.start),
    end: isJunction(view?.end)
  };
}

function computeNoggingPieces(studs, openingSpans, jointZs, length, flangeWidth) {
  if (!(flangeWidth > 0) || !jointZs?.length) return [];

  const round1 = (value) => Math.round(value * 10) / 10;
  const jambMins = openingSpans.map((opening) => opening.oMin);
  const jambMaxs = openingSpans.map((opening) => opening.oMax);
  const ctx = { length, jambMins, jambMaxs };
  const pieces = [];

  for (const jointZ of jointZs) {
    const voids = openingSpans
      .filter((opening) => (
        opening.sillRel < jointZ - EPS && opening.topRel > jointZ + EPS
      ))
      .map((opening) => [opening.oMin, opening.oMax]);
    const byOffset = new Map();
    for (const stud of studs) {
      if (
        stud.role !== 'nogging'
        && Number.isFinite(stud.offset)
        && stud.zMin <= jointZ + EPS
        && stud.zMax >= jointZ - EPS
        && !byOffset.has(stud.offset)
      ) {
        byOffset.set(stud.offset, stud);
      }
    }
    const supports = [...byOffset.values()]
      .map((stud) => ({ stud, ...studFlangeSpan(stud, ctx, flangeWidth) }))
      .sort((a, b) => a.stud.offset - b.stud.offset);

    for (let index = 0; index < supports.length - 1; index++) {
      const left = supports[index];
      const right = supports[index + 1];
      const oMin = left.xMax;
      const oMax = right.xMin;
      if (!(oMax - oMin > EPS)) continue;
      const crossesVoid = voids.some(([voidMin, voidMax]) => (
        Math.min(oMax, voidMax) - Math.max(oMin, voidMin) > EPS
      ));
      if (crossesVoid) continue;
      pieces.push({
        oMin: round1(oMin),
        oMax: round1(oMax),
        zMin: round1(jointZ - flangeWidth / 2),
        zMax: round1(jointZ + flangeWidth / 2),
        role: 'nogging'
      });
    }
  }
  return pieces;
}

function sortedWallIds(ids) {
  return [...new Map(ids.map((id) => [`${typeof id}:${String(id)}`, id])).values()]
    .sort(compareStableWallIds);
}

function framingError(reason, wallIds, nodeIds = []) {
  return {
    reason,
    wallIds: sortedWallIds(wallIds),
    nodeIds: [...new Set(nodeIds)].sort()
  };
}

function legacyJunctionView(corners) {
  return {
    start: corners?.start ? { tipo: 'L', wallId: null, matches: [], lapState: null } : null,
    end: corners?.end ? { tipo: 'L', wallId: null, matches: [], lapState: null } : null,
    interior: [],
    unsupported: []
  };
}

function junctionAmbiguities(wallId, junctions) {
  const errors = [];
  for (const event of junctions?.unsupported || []) {
    if (event.tipo !== 'ambiguous') continue;
    errors.push(framingError(
      'ambiguous-junction',
      event.wallIds || [wallId],
      [event.nodeId]
    ));
  }
  return errors;
}

/**
 * Calcula el despiece de montantes de un muro. Lógica pura — no toca el store ni persiste.
 *
 * @param wall    elemento muro (con openings[])
 * @param grid    model.grid
 * @param paramsMap  buildParamsMap(model.projectParams)
 * @param elementsById  buildElementsById(model.elements)
 * @param config  { spacing (mm, formula u número; default 400),
 *                  junctions: vista de getWallJunctionView (corners booleano sólo legacy),
 *                  jointZs: juntas horizontales de placa, flangeWidth: B real del perfil }
 * @returns { resolved, length, wallHeight,
 *            studs: [{ offset, zMin, zMax, role } |
 *                    { oMin, oMax, zMin, zMax, role:'nogging' }] }
 *          offset/oMin/oMax: distancia en mm desde el extremo "start" del muro.
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
  const junctions = config.junctions || legacyJunctionView(config.corners);
  const jointZs = config.jointZs || [];
  const flangeWidth = Number(config.flangeWidth);
  const ambiguous = junctionAmbiguities(wall.id, junctions);
  if (ambiguous.length > 0) {
    return {
      resolved: false,
      length,
      wallHeight,
      studs: [],
      headers: [],
      warnings: [],
      errors: ambiguous
    };
  }

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

  const endpointIsJunction = (endpoint) => (
    endpoint?.tipo === 'L'
    || endpoint?.tipo === 'T'
    || (
      endpoint?.matches?.length > 0
      && endpoint.matches.every((match) => match.tipo === 'L' || match.tipo === 'T')
    )
  );

  // 1) extremos: cada participante L/T aporta su pieza contigua del pilar, sin backup separado.
  pushStud(0, endpointIsJunction(junctions.start) ? 'corner' : 'edge');
  pushStud(length, endpointIsJunction(junctions.end) ? 'corner' : 'edge');

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

  // 4) llegada T al cuerpo: una sola pieza de altura completa en el anfitrión. Si el paso regular
  // ya la puso, se reclasifica; un vano, jamba o pieza parcial bloquea en vez de atravesarse.
  const supportGroups = new Map();
  for (const event of junctions.interior || []) {
    if (event.tipo !== 'T') continue;
    const key = Math.round(event.offset * 10) / 10;
    if (!supportGroups.has(key)) supportGroups.set(key, []);
    supportGroups.get(key).push(event);
  }
  const supportErrors = [];
  for (const [offset, events] of supportGroups) {
    const wallIds = [wall.id, ...events.map((event) => event.wallId)];
    const nodeIds = events.map((event) => event.nodeId);
    if (findOpeningSpanAt(offset)) {
      supportErrors.push(framingError('t-support-in-opening', wallIds, nodeIds));
      continue;
    }

    const existing = studs.filter((piece) => (
      piece.role !== 'nogging'
      && Number.isFinite(piece.offset)
      && Math.abs(piece.offset - offset) < EPS
    ));
    const regular = existing.length === 1
      && existing[0].role === 'stud'
      && existing[0].zMin <= EPS
      && existing[0].zMax >= wallHeight - EPS;
    if (regular) {
      existing[0].role = 'corner';
    } else if (existing.length === 0) {
      pushStud(offset, 'corner');
    } else {
      supportErrors.push(framingError(
        't-support-incompatible-piece',
        wallIds,
        nodeIds
      ));
    }
  }
  if (supportErrors.length > 0) {
    return {
      resolved: false,
      length,
      wallHeight,
      studs: [],
      headers: [],
      warnings: [],
      errors: supportErrors
    };
  }

  studs.sort((a, b) => a.offset - b.offset || a.zMin - b.zMin);

  // 5) piezas horizontales del vano: dintel (header, siempre) y antepecho (sill, solo con antepecho > 0)
  const headers = [];
  for (const span of openingSpans) {
    headers.push({ oMin: span.oMin, oMax: span.oMax, z: span.topRel, role: 'header' });
    if (span.sillRel > EPS) headers.push({ oMin: span.oMin, oMax: span.oMax, z: span.sillRel, role: 'sill' });
  }
  headers.sort((a, b) => a.oMin - b.oMin);

  const warnings = [];
  if (jointZs.length > 0 && !(flangeWidth > 0)) {
    warnings.push('no se generaron cadenetas: el perfil de montante no tiene ancho B resoluble');
  } else {
    studs.push(...computeNoggingPieces(
      studs, openingSpans, jointZs, length, flangeWidth
    ));
  }

  return { resolved: true, length, wallHeight, studs, headers, warnings, errors: [] };
}
