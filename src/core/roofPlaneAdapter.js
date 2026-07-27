// core/roofPlaneAdapter.js
// ★ B4.7 — Adapta un faldón (roofPlane) resuelto a la forma `roofSystem` que YA consume todo el
// pipeline (build3d, takeoff, exportTrussDxf, exportCalculixTruss, render de planta/elevación).
//
// El faldón tiene N tramos con DISTINTA luz; el pipeline espera objetos con UNA trussGeometry y sus
// trussPositions. En vez de reescribir todos los consumidores, expandimos el faldón a una lista de
// "sistemas virtuales", uno por tramo, cada uno con:
//   - su trussGeometry real (computeMonoTrussGeometry con la luz del tramo y la pendiente ÚNICA),
//   - las trussPositions de la cadena global que caen en su rango,
//   - la misma supportElevation, runAxis, spanDir, perfiles.
//
// Las costaneras son del FALDÓN (continuas por el quiebre), no de la cercha tipo: por eso cada
// sistema virtual lleva trussGeometry.purlins = [] y se adjunta la modulación de faldón aparte,
// para que build3d dibuje una sola tira continua por costanera en vez de una por tramo.
//
// Puro; reusa computeMonoTrussGeometry (misma geometría de cercha que hoy).

import { computeMonoTrussGeometry } from './trussLayout.js';
import { resolveValue } from './projectParams.js';

const EPS = 0.5;
const SPAN_TOL = 1;   // mm: dos tramos con luz dentro de esta tolerancia se consideran la misma
const GAP_TOL = 50;   // mm: hueco máximo entre rangos para considerarlos el mismo apoyo continuo

/**
 * ★ B4.7.6 — Fusiona tramos colineales redundantes: mismo apoyo alto fragmentado en varios muros
 * (frontones extendidos) produce tramos con la MISMA luz y rango solapado/contiguo. Sin fusionar,
 * cada uno emite un sistema/.inp/cercha idéntico → duplicados. La pendiente es única por faldón,
 * así que el discriminador es la luz; los rangos se unen. No toca geometría.
 * @param tramos  ya ordenados por runFrom (salida de resolveRoofPlane)
 * @returns {{ merged: Array, warnings: string[] }}
 */
export function mergeCollinearTramos(tramos) {
  const warnings = [];
  if (!Array.isArray(tramos) || tramos.length < 2) return { merged: tramos || [], warnings };

  const src = [...tramos].sort((a, b) => a.runFrom - b.runFrom);
  const merged = [];
  let group = { ...src[0], _members: [src[0].wallHighId] };

  const flush = () => {
    if (group._members.length > 1) {
      warnings.push(`fusionados ${group._members.length} tramos colineales de luz ${Math.round(group.span)}mm`);
    }
    const { _members, ...t } = group;
    t.wallHighIds = _members;               // trazabilidad: todos los muros altos del tramo fusionado
    merged.push(t);
  };

  for (let i = 1; i < src.length; i++) {
    const t = src[i];
    const sameSpan = Math.abs(t.span - group.span) <= SPAN_TOL;
    const touches = t.runFrom <= group.runTo + GAP_TOL;   // solapado o contiguo
    if (sameSpan && touches) {
      group.runFrom = Math.min(group.runFrom, t.runFrom);
      group.runTo = Math.max(group.runTo, t.runTo);
      // hiddenBy: conservar el más restrictivo (menor) por si algún fragmento avisa incompatibilidad
      if (t.hiddenBy != null && (group.hiddenBy == null || t.hiddenBy < group.hiddenBy)) group.hiddenBy = t.hiddenBy;
      group._members.push(t.wallHighId);
    } else {
      flush();
      group = { ...t, _members: [t.wallHighId] };
    }
  }
  flush();
  return { merged, warnings };
}

/**
 * Expande un faldón resuelto (salida de resolveRoofPlane) a sistemas legacy.
 * @param plane     el roofPlane persistido (perfiles, spacing, etc.)
 * @param resolved  salida de resolveRoofPlane({model, plane, ...})
 * @param paramsMap
 * @param elementsById
 * @returns {{ systems: Array<roofSystemLike>, purlinLines: Array, warnings: string[] }}
 *   systems: uno por tramo, con trussGeometry + trussPositions, shape roofSystem.
 *   purlinLines: costaneras del faldón (continuas), para build3d de purlins.
 */
export function roofPlaneToSystems(plane, resolved, paramsMap = {}, elementsById = {}) {
  const warnings = [];
  if (!resolved?.resolved) return { systems: [], purlinLines: [], warnings: ['faldón no resuelto'] };

  const { runAxis, supportElevation, slopePercent, trussPositions, perp } = resolved;
  const perpInner = resolved.perpInner ?? perp; // cara interior de la canaleta = x_local 0
  const supportMode = plane.supportMode || 'lateral';
  // ★ A-01 — alto de la solera de apoyo. supportElevation es la CARA SUPERIOR (= cara inferior de
  // la cuerda inferior, y_local = 0); la solera cuelga hacia abajo dentro de la holgura del cielo.
  const hLedger = resolved.supportLedgerProfile?.h ?? 0;
  // ★ B4.7.6 — fusionar tramos colineales redundantes antes de expandir a sistemas
  const { merged: tramos, warnings: mergeWarns } = mergeCollinearTramos(resolved.tramos);
  warnings.push(...mergeWarns);
  const spanDir = resolved.spanDir ?? (Math.sign((tramos[0]?.perpHigh ?? perp) - perp) || 1);

  const commonGeoCfg = {
    slopePercent,
    heelHeight: resolveValue(plane.heelHeight ?? 0, paramsMap, elementsById),
    gutterNotchWidth: resolveValue(plane.gutterNotchWidth ?? 0, paramsMap, elementsById),
    postSpacing: resolveValue(plane.postSpacing ?? 600, paramsMap, elementsById),
    diagonalPattern: plane.diagonalPattern || 'W',
    profiles: plane.profiles || {},
    // purlins NO por tramo: se generan a nivel de faldón (continuas). Aquí sin costaneras.
    purlinProfile: null, purlinSpacing: 0
  };

  /** Las dos soleras de apoyo lateral de un tramo (baja sobre la canaleta, alta sobre el frontón).
   *  Shape legacy (trussLayout.js) + los campos verticales explícitos de A-01. */
  function buildLedgers(t) {
    if (supportMode !== 'lateral') return [];
    const profile = plane.supportProfile || plane.profiles?.bottomChord || null;
    return [
      { wallId: plane.canalWallId, side: 'low', perp: perpInner },
      { wallId: t.wallHighId, side: 'high', perp: t.perpHighInner }
    ].filter(l => l.perp != null).map(({ wallId, side, perp: pp }) => ({
      wallId, side, profile,
      topElevation: supportElevation,             // cara superior = cara inferior de la cuerda inferior
      baseElevation: supportElevation - hLedger,  // base, dentro de la holgura del cielo falso
      length: t.runTo - t.runFrom,
      runAxis,
      p1: runAxis === 'x' ? { x: t.runFrom, y: pp } : { x: pp, y: t.runFrom },
      p2: runAxis === 'x' ? { x: t.runTo, y: pp } : { x: pp, y: t.runTo }
    }));
  }

  const systems = [];
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    const geo = computeMonoTrussGeometry({ ...commonGeoCfg, span: t.span });
    if (!geo.resolved) { warnings.push(`tramo ${i} (luz ${Math.round(t.span)}): ${geo.warnings.join('; ')}`); continue; }

    // posiciones de la cadena global que caen en este tramo (incluye bordes compartidos)
    const positions = trussPositions
      .filter(p => p.offset >= t.runFrom - EPS && p.offset <= t.runTo + EPS)
      .map(p => ({
        offset: p.offset,
        kind: p.kind === 'shifted' ? 'full' : (p.kind || 'full'),
        world: runAxis === 'x'
          ? { x: p.offset, y: perpInner } // cara interior de la canaleta = x_local 0 de la cercha
          : { x: perpInner, y: p.offset }
      }));
    if (!positions.length) continue;

    systems.push({
      id: `${plane.id}__t${i}`,
      planeId: plane.id,
      tramoIndex: i,
      wallLowId: plane.canalWallId,
      wallHighId: t.wallHighId,
      wallHighIds: t.wallHighIds || [t.wallHighId],
      runAxis, spanDir,
      span: t.span,
      supportElevation,
      slopePercent,
      supportMode,
      supportLedgers: buildLedgers(t),
      profiles: plane.profiles || {},
      trussSpacing: resolveValue(plane.trussSpacing ?? 1200, paramsMap, elementsById),
      runRange: { from: t.runFrom, to: t.runTo },
      trussPositions: positions,
      trussGeometry: geo
    });
  }

  return { systems, purlinLines: resolved.purlins || [], warnings };
}

/** Expande TODOS los faldones de un modelo a sistemas legacy. `resolveFn` = resolveRoofPlane
 * parcial ya ligado al modelo. Devuelve el array plano que el pipeline consume como roofSystems. */
export function expandRoofPlanes(model, resolveFn, paramsMap = {}, elementsById = {}) {
  const all = [];
  const purlinsByPlane = [];
  const warnings = [];
  for (const plane of model.roofPlanes || []) {
    const resolved = resolveFn(plane);
    const { systems, purlinLines, warnings: w } = roofPlaneToSystems(plane, resolved, paramsMap, elementsById);
    all.push(...systems);
    purlinsByPlane.push({ planeId: plane.id, runAxis: resolved.runAxis, perp: resolved.perpInner ?? resolved.perp,
      supportElevation: resolved.supportElevation, slopePercent: resolved.slopePercent,
      spanDir: resolved.spanDir, purlins: purlinLines });
    warnings.push(...w.map(x => `faldón ${plane.id}: ${x}`));
  }
  return { systems: all, purlinsByPlane, warnings };
}
