// core/roofPlaneOutputs.js
// ★ B4.7.3 — Fuente única de techumbre para el pipeline de salida (3D, DXF, metrado, .inp).
//
// A partir de B4.7 la techumbre se persiste como `model.roofPlanes[]` (faldones), no como
// `model.roofSystems[]`. En vez de reescribir cada consumidor, este módulo expande los faldones al
// shape legacy `roofSystem` (vía roofPlaneAdapter) y lo entrega ya resuelto. Los consumidores solo
// re-apuntan su fuente: `model.roofSystems || []`  →  `getRoofSystems(model)`.
//
// Compatibilidad: si el modelo TODAVÍA trae `roofSystems` con contenido (fixtures de test, modelos
// legacy no migrados), se devuelven tal cual — no se tocan. La expansión solo actúa cuando la
// fuente viva es `roofPlanes`.

import { buildParamsMap } from './projectParams.js';
import { resolveValue } from './projectParams.js';
import { resolveRoofPlane } from './roofPlane.js';
import { expandRoofPlanes } from './roofPlaneAdapter.js';
import { resolvePurlinParams } from './trussTemplates.js';
import { resolveTrussProfileDims } from './trussLayout.js';

// Cache por identidad de modelo: Zustand reemplaza el objeto `model` de forma inmutable en cada
// cambio, así que un WeakMap keyed por referencia sirve de memo entre consumidores del mismo render
// (build3d + takeoff + exportadores) sin re-resolver los faldones N veces.
const _cache = new WeakMap();

function buildContext(model) {
  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = {};
  for (const e of model.elements || []) elementsById[e.id] = e;
  return { paramsMap, elementsById };
}

function expandCached(model) {
  if (!model) return { systems: [], purlinsByPlane: [], warnings: [] };
  const hit = _cache.get(model);
  if (hit) return hit;
  const { paramsMap, elementsById } = buildContext(model);
  // ★ B4.7.2 — resolveRoofPlane consume library para heredar perfil+paso de costanera de la plantilla.
  const resolveFn = (plane) => resolveRoofPlane({ model, plane, paramsMap, elementsById, library: model.library });
  const raw = expandRoofPlanes(model, resolveFn, paramsMap, elementsById);
  const value = { systems: dedupeSharedBorder(raw.systems), purlinsByPlane: raw.purlinsByPlane, warnings: raw.warnings };
  _cache.set(model, value);
  return value;
}

// El adaptador deja la cercha del quiebre en AMBOS tramos contiguos (borde compartido). Aquí cada
// posición se asigna a un solo tramo: el primero (menor runFrom) que la reclama. Así 3D, metrado y
// .inp construyen esa cercha una sola vez, sin superponer dos luces distintas en el mismo offset.
// Además, un tramo que queda sin posiciones (totalmente absorbido, p.ej. tramos colineales de igual
// luz en la L) se descarta: no emite sistema redundante.
function dedupeSharedBorder(systems) {
  const claimed = new Map(); // planeId → Set(offset redondeado)
  const out = [];
  for (const s of systems) {
    const key = s.planeId ?? s.id;
    let set = claimed.get(key);
    if (!set) { set = new Set(); claimed.set(key, set); }
    const positions = [];
    for (const p of s.trussPositions || []) {
      const k = Math.round(p.offset);
      if (set.has(k)) continue;
      set.add(k);
      positions.push(p);
    }
    if (positions.length) out.push({ ...s, trussPositions: positions });
  }
  return out;
}

/**
 * Sistemas de techumbre que consume el pipeline. Legacy si el modelo aún los trae; si no, expande
 * los faldones. Shape idéntico a un `roofSystem` (trussGeometry + trussPositions + runAxis…).
 */
export function getRoofSystems(model) {
  // ★ B4.7.8-s2 (B-04) — precedencia INVERTIDA: manda el faldón. `roofSystems` sigue siendo la
  // fuente sólo cuando no hay faldones (modelos legacy / fixtures de test). Antes ganaba el
  // legacy, así que un modelo migrado que conservara sistemas viejos seguía exportándolos y
  // los faldones nuevos quedaban invisibles para todo el pipeline.
  if (model?.roofPlanes?.length) return expandCached(model).systems;
  return normalizeLegacyCached(model);
}

// --- ★ B4.7.8-s5 (C) — migración de lectura del alias `elevation` -----------------------------
// `model.roofSystems[].supportLedgers` es dato DERIVADO PERSISTIDO (RoofTrussModal guarda el
// `layout` completo), así que los modelos ya grabados —y `tests/fixtures/casa-L.json`— traen
// ledgers con sólo `elevation`, sin `topElevation`/`baseElevation`. Los emisores (trussLayout y
// roofPlaneAdapter) ya no escriben el alias, pero un archivo viejo no se reescribe solo: si el
// fallback se quitara de cada consumidor sin más, toda solera guardada desaparecería del 3D y
// de los DXF. Se normaliza acá, en la única puerta de entrada del pipeline, para que los
// consumidores lean un solo shape y el alias no sobreviva más allá de esta función.
const _legacyCache = new WeakMap();

function normalizeLegacyCached(model) {
  const systems = model?.roofSystems || [];
  if (!systems.length) return systems;
  const hit = _legacyCache.get(model);
  if (hit) return hit;
  const out = systems.map(s => {
    const leds = s.supportLedgers || [];
    if (!leds.some(l => l && l.elevation != null)) return s;
    return { ...s, supportLedgers: leds.map(l => normalizeLedger(l, model.library)) };
  });
  _legacyCache.set(model, out);
  return out;
}

/** Ledger persistido → shape s5: `topElevation`/`baseElevation`, sin el alias `elevation`. */
function normalizeLedger(led, library) {
  const { elevation, ...rest } = led;
  const topElevation = rest.topElevation ?? elevation;
  if (topElevation == null) return rest;
  const h = rest.profile ? resolveTrussProfileDims(library, rest.profile, 0, 0).h : 0;
  return { ...rest, topElevation, baseElevation: rest.baseElevation ?? (topElevation - h) };
}

/**
 * Cajas de costaneras del faldón para build3d. A diferencia del legacy (una costanera por sistema,
 * cortada en cada quiebre), aquí cada costanera es CONTINUA por la corrida del faldón, troceada por
 * largo comercial (cada `piece` = una caja). Vacío si la fuente es legacy (esas costaneras las sigue
 * armando build3d por sistema).
 * @returns Array<{ planeId, profile, center:{x,y,z}, size:{x,y,z} }>
 */
export function getRoofPurlinBoxes(model, defaultProfileH = 35, profileB = 40) {
  if (!model?.roofPlanes?.length) return [];
  const { paramsMap, elementsById } = buildContext(model);
  const planeById = {};
  for (const pl of model.roofPlanes) planeById[pl.id] = pl;

  const boxes = [];
  for (const pb of expandCached(model).purlinsByPlane) {
    const plane = planeById[pb.planeId] || {};
    // ★ B4.7.2 — perfil+altura heredados de la plantilla del proyecto (mismo resolver que resolveRoofPlane).
    const purlinParams = resolvePurlinParams({ plane, library: model.library });
    const h = purlinParams.profileH || defaultProfileH;
    // ★ B.2 — el ancho sale de la librería igual que la altura; `profileB` (default 40) es fallback.
    const b = purlinParams.profileB || profileB;
    const heel = resolveValue(plane.heelHeight ?? 0, paramsMap, elementsById) || 0;
    const slope = (pb.slopePercent || 0) / 100;
    const norm = Math.hypot(1, slope); // longitud inclinada por unidad horizontal
    const cos = 1 / norm, sin = slope / norm;
    const spanDir = pb.spanDir ?? 1;

    for (const purlin of pb.purlins || []) {
      // s = distancia INCLINADA desde la canaleta (sobre la cuerda superior).
      const xLocal = purlin.s * cos;         // avance perpendicular horizontal
      const yLocal = heel + purlin.s * sin;  // altura sobre la cota de apoyo, apoyada en la cuerda
      const perp = pb.perp + spanDir * xLocal;
      for (const piece of purlin.pieces || []) {
        const len = Math.abs(piece.runTo - piece.runFrom);
        if (!(len > 0)) continue;
        const mid = (piece.runFrom + piece.runTo) / 2;
        const wx = pb.runAxis === 'x' ? mid : perp;
        const wz = pb.runAxis === 'x' ? perp : mid;
        boxes.push({
          planeId: pb.planeId, profile: purlinParams.profile || null,
          center: { x: wx, y: pb.supportElevation + yLocal + h / 2, z: wz },
          size: pb.runAxis === 'x' ? { x: len, y: h, z: b } : { x: b, y: h, z: len }
        });
      }
    }
  }
  return boxes;
}

/** ml totales de costanera del faldón (para metrado), agrupados por perfil. */
export function roofPurlinTakeoff(model) {
  const boxes = getRoofPurlinBoxes(model);
  const byProfile = new Map();
  for (const b of boxes) {
    const key = b.profile || 'Costanera';
    const lenMm = Math.max(b.size.x, b.size.z); // el largo va sobre runAxis (x o z)
    const g = byProfile.get(key) || { count: 0, ml: 0 };
    g.count += 1;
    g.ml += lenMm;
    byProfile.set(key, g);
  }
  return byProfile; // Map<profile, {count, ml_en_mm}>
}
