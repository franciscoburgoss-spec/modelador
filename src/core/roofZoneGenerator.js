// core/roofZoneGenerator.js
// ★ Sesión 26 — Generador de zonas de techumbre por tramos (alternativa C del análisis).
//
// El problema: una planta en L (o T, o U) necesita varios sistemas de un agua, uno por tramo,
// porque la LUZ cambia de un brazo a otro — todos descargan al mismo frontón bajo, pero el
// frontón alto está a distinta distancia. Definirlos a mano es donde aparecían los tres bugs de
// la sesión 25 (cerchas embebidas, offsets duplicados en la junta, tramos mal acotados).
//
// La solución NO es una entidad nueva. Un "polígono de techumbre" persistido obligaría a que un
// sistema tenga varias luces a la vez, y `trussGeometry` es único por sistema — se romperían
// metrado, 3D, .inp y DXF de golpe. En vez de eso este módulo es un GENERADOR: Fran elige el muro
// de apoyo bajo y la herramienta emite N sistemas rectangulares normales, ya acotados. Se editan
// después uno por uno como cualquier sistema.
//
// Algoritmo (barrido sobre el eje de corrida):
//   1. Candidatos a muro alto: paralelos al bajo, vivos a la cota de apoyo, del mismo lado y con
//      solape sobre el eje de corrida.
//   2. Eventos de corte: los extremos de cada candidato + los frontones perpendiculares que
//      cruzan la banda (sesión 25 — un frontón en el MEDIO parte la zona en dos, que es
//      justamente el caso que la 25 detectaba pero no resolvía).
//   3. En cada intervalo elemental gana el candidato activo MÁS CERCANO al muro bajo: es el
//      primero que la cercha encuentra, y por lo tanto su apoyo real.
//   4. Se fusionan intervalos consecutivos con el mismo muro alto y sin frontón entre medio.
//
// Lo que sale es una lista de bandas listas para `addRoofSystem`, no sistemas ya creados: el
// módulo es puro y la decisión de crearlos es de la UI.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { findRoofObstructions } from './roofObstructions.js';

const EPS = 1;          // mm
const MIN_BAND = 200;   // mm — bajo esto el tramo no da ni para una cercha; se descarta

/** Intervalo [min,max] de un muro sobre un eje ('x' | 'y'). */
function spanOn(geo, axis) {
  const a = axis === 'x' ? geo.p1.x : geo.p1.y;
  const b = axis === 'x' ? geo.p2.x : geo.p2.y;
  return [Math.min(a, b), Math.max(a, b)];
}

/** Coordenada perpendicular de un muro (constante a lo largo de su corrida). */
function perpOf(geo, runAxis) {
  return runAxis === 'x' ? geo.p1.y : geo.p1.x;
}

/**
 * Planifica las zonas de techumbre que apoyan en `wallLowId`.
 *
 * @param model
 * @param opts.wallLowId        muro de apoyo bajo (el frontón contra el que descargan todas)
 * @param opts.supportElevation cota de apoyo de las cerchas (mm) — define qué muros están vivos
 * @param opts.side             'auto' | 'positive' | 'negative' — lado perpendicular donde buscar
 *                              los muros altos. 'auto' toma el lado con más candidatos.
 * @param opts.template         campos comunes a copiar en cada banda (perfiles, spacing, etc.)
 * @returns {{ bands, warnings, candidates, runAxis, side }}
 *   bands: [{ from, to, wallLowId, wallHighId, span, length, splitByWallId }]
 */
export function planRoofSystemsFromLowWall(model, opts = {}) {
  const { wallLowId, supportElevation, side = 'auto', template = {} } = opts;
  const warnings = [];
  const walls = (model.elements || []).filter(e => e.type === 'wall');
  const wallLow = walls.find(w => w.id === wallLowId);
  if (!wallLow) return { bands: [], warnings: ['el muro de apoyo bajo no existe'], candidates: [], runAxis: null, side: null };

  const paramsMap = opts.paramsMap || {};
  const elementsById = opts.elementsById || {};
  const geoLow = resolveWallGeometry(wallLow, model.grid, paramsMap, elementsById);
  if (!geoLow) return { bands: [], warnings: ['geometría del muro de apoyo bajo no resuelta'], candidates: [], runAxis: null, side: null };

  const runAxis = isWallXRun(wallLow) ? 'x' : 'y';
  const perpLow = perpOf(geoLow, runAxis);
  const [lowFrom, lowTo] = spanOn(geoLow, runAxis);

  // --- 1. candidatos a muro alto -------------------------------------------------------------
  const zOf = (w, key) => model.grid.zLevels.find(l => l.id === w[key])?.elevation;
  const candidates = [];
  for (const w of walls) {
    if (w.id === wallLow.id) continue;
    if (isWallXRun(w) !== isWallXRun(wallLow)) continue; // debe ser paralelo al bajo
    const geo = resolveWallGeometry(w, model.grid, paramsMap, elementsById);
    if (!geo) continue;
    const zb = zOf(w, 'bottomZ'), zt = zOf(w, 'topZ');
    if (zb == null || zt == null) continue;
    if (supportElevation < Math.min(zb, zt) - EPS || supportElevation > Math.max(zb, zt) + EPS) continue;

    const perp = perpOf(geo, runAxis);
    const delta = perp - perpLow;
    if (Math.abs(delta) < EPS) continue; // colineal con el bajo: no es apoyo alto
    const [f, t] = spanOn(geo, runAxis);
    const overlapFrom = Math.max(lowFrom, f), overlapTo = Math.min(lowTo, t);
    if (!(overlapTo - overlapFrom > MIN_BAND)) continue;

    candidates.push({
      wallId: w.id, perp, delta, sign: Math.sign(delta),
      from: overlapFrom, to: overlapTo,
      dist: Math.abs(delta) - geoLow.thickness / 2 - geo.thickness / 2 // luz entre caras interiores
    });
  }

  if (!candidates.length) {
    return { bands: [], warnings: ['ningún muro paralelo puede servir de apoyo alto a esa cota — revisar la cota de apoyo o los niveles de los muros'], candidates: [], runAxis, side: null };
  }

  // --- 2. lado ---------------------------------------------------------------------------------
  let chosenSign;
  if (side === 'positive') chosenSign = 1;
  else if (side === 'negative') chosenSign = -1;
  else {
    const pos = candidates.filter(c => c.sign > 0).length;
    const neg = candidates.length - pos;
    chosenSign = pos >= neg ? 1 : -1;
    if (pos > 0 && neg > 0) {
      warnings.push('hay muros paralelos a ambos lados del muro bajo — se generó solo el lado con más candidatos; para el otro, repetir eligiendo el lado opuesto');
    }
  }
  const active = candidates.filter(c => c.sign === chosenSign);
  if (!active.length) {
    return { bands: [], warnings: ['no hay muros de apoyo alto del lado elegido'], candidates, runAxis, side: chosenSign > 0 ? 'positive' : 'negative' };
  }

  // --- 3. eventos de corte ---------------------------------------------------------------------
  // Extremos de cada candidato + frontones perpendiculares que cruzan la banda. Un frontón en el
  // medio parte la zona: a cada lado queda una techumbre independiente, cada una con su cuerda de
  // borde contra la cara correspondiente (sesión 25).
  const nearest = active.reduce((a, c) => (c.dist < a.dist ? c : a));
  const { obstacles } = findRoofObstructions({
    walls, grid: model.grid, paramsMap, elementsById,
    runAxis,
    bandFrom: perpLow + chosenSign * geoLow.thickness / 2,
    bandTo: nearest.perp - chosenSign * geoLow.thickness / 2,
    supportElevation,
    excludeIds: [wallLow.id, ...active.map(c => c.wallId)]
  });

  const cuts = new Set([lowFrom, lowTo]);
  for (const c of active) { cuts.add(c.from); cuts.add(c.to); }
  const splitters = [];
  for (const ob of obstacles) {
    // solo parte la zona si cae DENTRO del rango del muro bajo, no si es la testera de un extremo
    if (ob.center > lowFrom + MIN_BAND && ob.center < lowTo - MIN_BAND) {
      cuts.add(ob.oMin); cuts.add(ob.oMax);
      splitters.push(ob);
    }
  }
  const points = [...cuts].sort((a, b) => a - b);

  // --- 4. banda por intervalo elemental, fusionando las contiguas equivalentes ------------------
  const raw = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i], to = points[i + 1];
    if (!(to - from > EPS)) continue;
    const mid = (from + to) / 2;

    // ¿este intervalo cae dentro del espesor de un frontón divisorio? Ahí no va techumbre: es el
    // muro. La cuerda de borde de cada lado se apoya en sus caras (la 25 lo resuelve al generar).
    if (splitters.some(ob => mid > ob.oMin - EPS && mid < ob.oMax + EPS)) continue;

    const here = active.filter(c => mid > c.from - EPS && mid < c.to + EPS);
    if (!here.length) {
      warnings.push(`tramo ${Math.round(from)}→${Math.round(to)}mm sin muro de apoyo alto — queda sin techumbre`);
      continue;
    }
    const best = here.reduce((a, c) => (c.dist < a.dist ? c : a)); // el más cercano es el apoyo real
    raw.push({ from, to, wallHighId: best.wallId, span: best.dist });
  }

  const bands = [];
  for (const b of raw) {
    const prev = bands[bands.length - 1];
    const contiguous = prev && prev.wallHighId === b.wallHighId && Math.abs(prev.to - b.from) < EPS;
    if (contiguous) prev.to = b.to;
    else bands.push({ ...b });
  }

  const out = bands
    .filter(b => b.to - b.from > MIN_BAND)
    .map(b => ({
      ...template,
      wallLowId: wallLow.id,
      wallHighId: b.wallHighId,
      runRange: { from: Math.round(b.from * 10) / 10, to: Math.round(b.to * 10) / 10 },
      span: Math.round(b.span * 10) / 10,
      length: Math.round((b.to - b.from) * 10) / 10
    }));

  if (splitters.length) {
    warnings.push(`${splitters.length} frontón(es) cruzan la techumbre: la zona se partió ahí en vez de dejar cerchas embebidas`);
  }
  if (!out.length) warnings.push('no quedó ningún tramo con largo útil');

  return { bands: out, warnings, candidates, runAxis, side: chosenSign > 0 ? 'positive' : 'negative' };
}

/**
 * ¿Alguna banda planificada choca con un sistema de techumbre ya existente? Evita duplicar la
 * techumbre al regenerar. Compara par de apoyos + solape de rango sobre el eje de corrida.
 */
export function findBandConflicts(bands, existingSystems = []) {
  const conflicts = [];
  for (const b of bands) {
    for (const sys of existingSystems) {
      if (sys.wallLowId !== b.wallLowId || sys.wallHighId !== b.wallHighId) continue;
      const sFrom = sys.runRange?.from, sTo = sys.runRange?.to;
      if (typeof sFrom !== 'number' || typeof sTo !== 'number') {
        conflicts.push({ band: b, systemId: sys.id, reason: 'ya existe un sistema sobre el mismo par de muros sin zona acotada' });
        continue;
      }
      const overlap = Math.min(b.runRange.to, sTo) - Math.max(b.runRange.from, sFrom);
      if (overlap > MIN_BAND) {
        conflicts.push({ band: b, systemId: sys.id, reason: `se superpone ${Math.round(overlap)}mm con el sistema ${sys.id}` });
      }
    }
  }
  return conflicts;
}
