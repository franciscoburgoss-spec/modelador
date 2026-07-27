// lab/roofPlane/core/supportLine.js
// ★ B4.1 — Línea de apoyo de un faldón.
//
// Problema que resuelve: hoy un roofSystem apunta a UN wallId como apoyo. Pero en el modelo real
// de Fran una misma línea de apoyo está partida en varios muros colineales (frontones extendidos
// sobre dinteles para cerrar el nivel, cada uno un elemento con su propio bottomZ/topZ). Cada
// fragmento gatillaba un tramo de techumbre falso. Y "unir muros" no puede fusionarlos porque
// tienen distinto arranque vertical — correctamente, son elementos distintos con su propio
// entramado y OSB.
//
// La salida NO es fusionar muros (no se toca el modelo). Es calcular la COBERTURA de la línea de
// apoyo A LA COTA DE APOYO: proyectar sobre el eje todos los fragmentos colineales vivos a esa
// cota y unir intervalos. Cálculo derivado; ningún muro cambia de id.
//
// Criterio de pertenencia a una línea de apoyo (confirmado con Fran):
//   1. Misma dirección de corrida y misma coordenada perpendicular (±PERP_TOL).
//   2. bottomZ ≤ cotaApoyo ≤ topZ (tolerancia Z_TOL en los bordes — el muro sobre dintel arranca
//      EXACTAMENTE en la cota de cielo).
//   3. Intervalos que se tocan o solapan, con hueco ≤ GAP_TOL. Solapes se unifican (la línea es
//      un intervalo, no una suma — sin doble conteo).
//   4. Mismo espesor resuelto (±THICK_TOL). Si difiere, la cara interior tiene un escalón y la
//      luz cambia: NO se fusiona, se parte y se reporta.
//
// Huecos > GAP_TOL: la línea queda partida en varios segmentos. Eso es un vano real en el apoyo
// (o un muro que falta dibujar) — se devuelve como segmentos separados para que el faldón decida.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';

const PERP_TOL = 2;    // mm — tolerancia en la coordenada perpendicular para considerar colineal
const Z_TOL = 1;       // mm — tolerancia vertical en los bordes del rango del muro
const GAP_TOL = 10;    // mm — hueco máximo entre fragmentos para fusionarlos en una línea continua
const THICK_TOL = 1;   // mm — diferencia de espesor bajo la cual se consideran la misma cara

/** Intervalo [min,max] de un muro sobre un eje ('x' | 'y'). */
function spanOn(geo, axis) {
  const a = axis === 'x' ? geo.p1.x : geo.p1.y;
  const b = axis === 'x' ? geo.p2.x : geo.p2.y;
  return [Math.min(a, b), Math.max(a, b)];
}

/** Coordenada perpendicular de un muro (constante a lo largo de su corrida). */
function perpOn(geo, runAxis) {
  return runAxis === 'x' ? geo.p1.y : geo.p1.x;
}

/** ¿El muro está vivo a la cota de apoyo? (su rango vertical la contiene). */
function aliveAt(wall, grid, elevation) {
  const zb = grid.zLevels.find(l => l.id === wall.bottomZ)?.elevation;
  const zt = grid.zLevels.find(l => l.id === wall.topZ)?.elevation;
  if (zb == null || zt == null) return false;
  const lo = Math.min(zb, zt), hi = Math.max(zb, zt);
  return elevation >= lo - Z_TOL && elevation <= hi + Z_TOL;
}

/**
 * Resuelve la línea de apoyo colineal con `seedWallId`, a la cota `supportElevation`.
 *
 * @param opts.model              modelo completo (para elements + grid)
 * @param opts.seedWallId         un muro cualquiera de la línea (define eje, perpendicular, espesor)
 * @param opts.supportElevation   cota de apoyo de las cerchas (mm)
 * @param opts.paramsMap          mapa de parámetros del proyecto (para thickness fórmula)
 * @param opts.elementsById       mapa de referencias entre elementos
 * @returns {{
 *   resolved: boolean,
 *   runAxis: 'x'|'y'|null,
 *   perp: number|null,           // coordenada perpendicular de la línea (eje del muro semilla)
 *   thickness: number|null,      // espesor resuelto de la línea
 *   segments: Array<{from, to, wallIds: number[]}>,  // tramos continuos, ordenados por `from`
 *   coverage: number,            // largo total cubierto por muros vivos (suma de segmentos)
 *   excludedThickness: Array<{wallId, thickness}>,   // fragmentos colineales de otro espesor
 *   warnings: string[]
 * }}
 */
export function resolveSupportLine({
  model, seedWallId, supportElevation, paramsMap = {}, elementsById = {}
} = {}) {
  const warnings = [];
  const walls = (model.elements || []).filter(e => e.type === 'wall');
  const grid = model.grid;
  const seed = walls.find(w => w.id === seedWallId);
  if (!seed) {
    return { resolved: false, runAxis: null, perp: null, thickness: null, segments: [], coverage: 0, excludedThickness: [], warnings: ['el muro semilla no existe'] };
  }
  const seedGeo = resolveWallGeometry(seed, grid, paramsMap, elementsById);
  if (!seedGeo) {
    return { resolved: false, runAxis: null, perp: null, thickness: null, segments: [], coverage: 0, excludedThickness: [], warnings: ['geometría del muro semilla no resuelta'] };
  }

  const runAxis = isWallXRun(seed) ? 'x' : 'y';
  const perp = perpOn(seedGeo, runAxis);
  const thickness = seedGeo.thickness;

  // --- recolectar fragmentos colineales vivos a la cota -------------------------------------
  const fragments = [];
  const excludedThickness = [];
  for (const w of walls) {
    if (isWallXRun(w) !== isWallXRun(seed)) continue; // otra dirección
    const geo = resolveWallGeometry(w, grid, paramsMap, elementsById);
    if (!geo) continue;
    if (Math.abs(perpOn(geo, runAxis) - perp) > PERP_TOL) continue; // otra línea perpendicular
    if (!aliveAt(w, grid, supportElevation)) continue;              // no llega a la cota de apoyo

    // criterio 4: mismo espesor. Si difiere, la cara interior escalona — no es la misma línea.
    if (Math.abs(geo.thickness - thickness) > THICK_TOL) {
      excludedThickness.push({ wallId: w.id, thickness: geo.thickness });
      continue;
    }
    const [from, to] = spanOn(geo, runAxis);
    fragments.push({ from, to, wallId: w.id });
  }

  if (!fragments.length) {
    return { resolved: false, runAxis, perp, thickness, segments: [], coverage: 0, excludedThickness, warnings: ['ningún muro colineal está vivo a la cota de apoyo'] };
  }

  // --- unir por intervalo: ordenar por `from`, fusionar los que se tocan (hueco ≤ GAP_TOL) ---
  fragments.sort((a, b) => a.from - b.from);
  const segments = [];
  for (const f of fragments) {
    const last = segments[segments.length - 1];
    if (last && f.from <= last.to + GAP_TOL) {
      // contiguo o solapado: extender el segmento y registrar el muro
      last.to = Math.max(last.to, f.to);
      last.wallIds.push(f.wallId);
    } else {
      segments.push({ from: f.from, to: f.to, wallIds: [f.wallId] });
    }
  }

  const coverage = segments.reduce((s, seg) => s + (seg.to - seg.from), 0);

  // --- avisos ---------------------------------------------------------------------------------
  const composed = segments.filter(s => s.wallIds.length > 1);
  for (const s of composed) {
    warnings.push(`línea de apoyo compuesta por ${s.wallIds.length} muros colineales entre ${Math.round(s.from)}→${Math.round(s.to)}mm — se tratan como una sola línea (ids: ${s.wallIds.join(', ')})`);
  }
  if (segments.length > 1) {
    const gaps = [];
    for (let i = 0; i < segments.length - 1; i++) {
      gaps.push(`${Math.round(segments[i].to)}→${Math.round(segments[i + 1].from)}mm`);
    }
    warnings.push(`la línea de apoyo se interrumpe a la cota ${Math.round(supportElevation)}mm en: ${gaps.join(', ')} — vano real en el apoyo o muro sin dibujar`);
  }
  for (const ex of excludedThickness) {
    warnings.push(`el muro ${ex.wallId} es colineal pero tiene otro espesor (${Math.round(ex.thickness)} vs ${Math.round(thickness)}mm) — la cara interior escalona ahí; no se fusiona a esta línea`);
  }

  return { resolved: true, runAxis, perp, thickness, segments, coverage, excludedThickness, warnings };
}

/** ¿La posición `pos` (sobre el eje de corrida) tiene línea de apoyo viva bajo ella? Usado por
 * el faldón para verificar cobertura cercha por cercha. Devuelve el segmento que la cubre o null. */
export function coverageAt(supportLine, pos, tol = 0) {
  if (!supportLine?.segments?.length) return null;
  return supportLine.segments.find(s => pos >= s.from - tol && pos <= s.to + tol) || null;
}
