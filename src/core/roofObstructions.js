// core/roofObstructions.js
// ★ Sesión 25 — Interferencia de cerchas con frontones y cercha de borde.
//
// `computeRoofSystemLayout` reparte las cerchas sobre el solape de los DOS muros de apoyo y no
// consulta ningún otro muro del modelo. Si hay un frontón interior dentro de ese rango, la primera
// o la última cercha queda EMBEBIDA en él: no se ve en 3D (la tapa el muro) pero sí se cuenta en
// el metrado, en el .inp y en el DXF. Este módulo detecta esos muros y acota la corrida.
//
// Regla constructiva (Fran, caso real de la L):
//   La cercha que choca con un frontón se desplaza hasta apoyarse contra su CARA INTERIOR — la
//   que da hacia la zona de cerchas — y deja de ser cercha completa: se conserva solo la CUERDA
//   SUPERIOR, atornillada en todo su largo a la cara del frontón, para mantener la pendiente y
//   dar tope a las costaneras que llegan a esa cara. No es un elemento estructural biapoyado:
//   es una solución de apoyo, y por eso NO va al .inp de CalculiX.
//
// Qué cuenta como frontón (obstáculo):
//   - muro PERPENDICULAR al eje de corrida (= paralelo a la cercha). Un muro paralelo a la
//     corrida que cruce la banda es otra cosa (apoyo intermedio, o un muro que la cercha
//     atraviesa a lo largo de su luz): se reporta aparte, no se corrige moviendo cerchas.
//   - que exista a la cota de apoyo (su rango vertical la contiene).
//   - cuya huella en planta cruce la banda entre las caras interiores de los dos apoyos.
//   - distinto de los dos muros de apoyo del sistema.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';

const EPS = 1; // mm
const BAND_TOLERANCE = 50; // mm de solape mínimo con la banda para considerar que el muro la cruza

/** Intervalo [min,max] de un muro sobre un eje ('x' | 'y'), sin espesor. */
function wallSpanOn(geo, axis) {
  const a = axis === 'x' ? geo.p1.x : geo.p1.y;
  const b = axis === 'x' ? geo.p2.x : geo.p2.y;
  return [Math.min(a, b), Math.max(a, b)];
}

/**
 * Frontones que interfieren con la corrida de un sistema de techumbre.
 *
 * @param opts.walls            muros del modelo (elements filtrados a type 'wall')
 * @param opts.runAxis          'x' | 'y' — eje sobre el que se reparten las cerchas
 * @param opts.bandFrom/bandTo  banda entre caras interiores de los apoyos, sobre el eje perpendicular
 * @param opts.supportElevation cota de apoyo de las cerchas (mm)
 * @param opts.excludeIds       ids de los dos muros de apoyo
 * @returns {{ obstacles: Array<{wallId,oMin,oMax,center,thickness}>, crossing: Array<{wallId}> }}
 *          `obstacles` ordenados por oMin; `crossing` son muros PARALELOS a la corrida dentro de
 *          la banda (informativo, no se corrigen).
 */
export function findRoofObstructions({
  walls = [], grid, paramsMap = {}, elementsById = {},
  runAxis = 'x', bandFrom, bandTo, supportElevation, excludeIds = []
}) {
  const obstacles = [];
  const crossing = [];
  const perpAxis = runAxis === 'x' ? 'y' : 'x';
  const bandLo = Math.min(bandFrom, bandTo), bandHi = Math.max(bandFrom, bandTo);
  const exclude = new Set(excludeIds);

  for (const w of walls) {
    if (exclude.has(w.id)) continue;
    const geo = resolveWallGeometry(w, grid, paramsMap, elementsById);
    if (!geo) continue;

    // ¿existe a la cota de apoyo? Un muro que termina bajo la cercha no la estorba.
    const zb = grid.zLevels.find(l => l.id === w.bottomZ)?.elevation;
    const zt = grid.zLevels.find(l => l.id === w.topZ)?.elevation;
    if (zb == null || zt == null) continue;
    if (supportElevation < Math.min(zb, zt) - EPS || supportElevation > Math.max(zb, zt) + EPS) continue;

    // ¿cruza la banda entre caras interiores de los apoyos?
    const [pLo, pHi] = wallSpanOn(geo, perpAxis);
    const half = geo.thickness / 2;
    const overlap = Math.min(bandHi, pHi + half) - Math.max(bandLo, pLo - half);
    if (!(overlap > BAND_TOLERANCE)) continue;

    const wallIsXRun = isWallXRun(w);
    const wallRunAxis = wallIsXRun ? 'x' : 'y';
    if (wallRunAxis === runAxis) {
      // paralelo a la corrida: la cercha lo atraviesa a lo largo de su luz. No se resuelve
      // moviendo cerchas — o es un apoyo intermedio que Fran debe declarar, o sobra.
      crossing.push({ wallId: w.id });
      continue;
    }

    // perpendicular a la corrida = frontón. Su huella sobre el eje de corrida es su posición
    // ± medio espesor (el muro corre en el eje perpendicular, así que sobre el eje de corrida
    // solo ocupa su espesor).
    const [rLo, rHi] = wallSpanOn(geo, runAxis);
    const oMin = Math.min(rLo, rHi) - half;
    const oMax = Math.max(rLo, rHi) + half;
    obstacles.push({ wallId: w.id, oMin, oMax, center: (oMin + oMax) / 2, thickness: geo.thickness });
  }

  obstacles.sort((a, b) => a.oMin - b.oMin);
  return { obstacles, crossing };
}

/**
 * Acota la corrida [from,to] a las caras interiores de los frontones que la interfieren en los
 * extremos, y detecta los que quedan en el medio (esos no se pueden resolver moviendo una cercha:
 * la zona está mal definida y hay que partirla).
 *
 * @returns {{
 *   from, to,
 *   edgeLow:  {wallId, face}|null,   // frontón que corta el extremo inferior; `face` = cota a la que se movió
 *   edgeHigh: {wallId, face}|null,
 *   blocking: Array<{wallId, oMin, oMax}>,
 *   collapsed: boolean               // true si tras el recorte no queda corrida útil
 * }}
 */
export function applyObstructionsToRun(from, to, obstacles = []) {
  let lo = from, hi = to;
  let edgeLow = null, edgeHigh = null;

  // Extremo inferior: el frontón que contiene `from` (o que lo deja atrás) empuja el arranque a
  // su cara interior, la que mira hacia +offset.
  for (const ob of obstacles) {
    if (ob.oMax > lo + EPS && ob.oMin < lo + EPS) {
      if (ob.oMax > lo) { lo = ob.oMax; edgeLow = { wallId: ob.wallId, face: ob.oMax }; }
    }
  }
  // Extremo superior: cara interior mirando hacia −offset.
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    if (ob.oMin < hi - EPS && ob.oMax > hi - EPS) {
      if (ob.oMin < hi) { hi = ob.oMin; edgeHigh = { wallId: ob.wallId, face: ob.oMin }; }
    }
  }

  const blocking = obstacles.filter(ob => ob.oMin > lo + EPS && ob.oMax < hi - EPS);
  return { from: lo, to: hi, edgeLow, edgeHigh, blocking, collapsed: !(hi - lo > EPS) };
}

/** ¿Esta posición de cercha es una cuerda superior de borde (apoyada a la cara del frontón)? */
export function isEdgeChord(pos) {
  return pos?.kind === 'edgeChord';
}

/** Miembros que se fabrican para una cercha de borde: solo la cuerda superior. */
export function edgeChordMembers(trussGeometry) {
  return (trussGeometry?.members || []).filter(m => m.role === 'topChord');
}

/** Cerchas REALES de un sistema (excluye las cuerdas superiores de borde contra frontón). */
export function countFullTrusses(system) {
  return (system?.trussPositions || []).filter(p => p.kind !== 'edgeChord').length;
}
