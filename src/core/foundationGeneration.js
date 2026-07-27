// core/foundationGeneration.js
// ★ Sesión 12 — Fundaciones B: genera fundaciones corridas bajo los muros del nivel base
// (fusionando tramos colineales contiguos) y, opcionalmente, poyos aislados bajo pilares
// sueltos. Puro: no toca el store. Devuelve elementos SIN id — el caller los agrega con
// una acción batch (un solo undo), ver `addElements` en useModelStore.
//
// "Nivel base" = el zLevel con elevation === 0 (el ±0.00), salvo que options.baseLevelId
// lo indique explícito.

import { resolveWallGeometry, resolveBeamGeometry, resolveColumnGeometry, isWallXRun } from './elementGeometry.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';

const DEFAULT_TOLERANCE = 5; // mm
const DEFAULT_CIMIENTO = { width: 400, depth: 600 };
const DEFAULT_PAD = { lengthX: 1000, lengthY: 1000, depth: 400 };

const overlaps = (aMin, aMax, bMin, bMax, tol) => aMin <= bMax + tol && bMin <= aMax + tol;

function findSection(library, itemType, id) {
  if (id == null) return null;
  return (library.foundationSections || []).find((s) => s.itemType === itemType && s.id === id) || null;
}

/** Segmentos resueltos (uno por muro) con dirección, eje fijo y rango sobre el eje de corrida. */
function buildWallSegments(walls, grid, paramsMap, elementsById, errors) {
  const segments = [];
  for (const w of walls) {
    const geo = resolveWallGeometry(w, grid, paramsMap, elementsById);
    if (!geo) { errors.push(`Muro #${w.id}: geometria no resuelve, se omite.`); continue; }
    const isX = isWallXRun(w);
    const a = isX ? geo.p1.x : geo.p1.y;
    const b = isX ? geo.p2.x : geo.p2.y;
    const forward = a <= b;
    segments.push({
      direction: isX ? 'x' : 'y',
      fixed: isX ? geo.p1.y : geo.p1.x,
      fixedAxisId: isX ? w.yStart : w.xStart,
      min: Math.min(a, b),
      max: Math.max(a, b),
      startAxisId: forward ? (isX ? w.xStart : w.yStart) : (isX ? w.xEnd : w.yEnd),
      endAxisId: forward ? (isX ? w.xEnd : w.yEnd) : (isX ? w.xStart : w.yStart),
      wallIds: [w.id]
    });
  }
  return segments;
}

/** Agrupa por (direccion, eje fijo ± tolerancia) y fusiona rangos contiguos/solapados. */
function mergeCollinear(segments, tolerance) {
  const merged = [];
  for (const direction of ['x', 'y']) {
    const byFixed = [];
    for (const s of segments.filter((s) => s.direction === direction)) {
      const cluster = byFixed.find((c) => Math.abs(c.fixed - s.fixed) <= tolerance);
      if (cluster) cluster.items.push(s); else byFixed.push({ fixed: s.fixed, items: [s] });
    }
    for (const cluster of byFixed) {
      const sorted = cluster.items.slice().sort((a, b) => a.min - b.min);
      let current = null;
      for (const s of sorted) {
        if (!current) { current = { ...s, wallIds: [...s.wallIds] }; continue; }
        if (s.min <= current.max + tolerance) {
          if (s.max > current.max) { current.max = s.max; current.endAxisId = s.endAxisId; }
          current.wallIds.push(...s.wallIds);
        } else {
          merged.push(current);
          current = { ...s, wallIds: [...s.wallIds] };
        }
      }
      if (current) merged.push(current);
    }
  }
  return merged;
}

/** Traza resuelta de una fundacion corrida existente, para chequeo de duplicados. */
function resolveExistingTrace(el, grid, paramsMap, elementsById) {
  const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
  if (!geo) return null;
  const isX = el.direction === 'x';
  const a = isX ? geo.p1.x : geo.p1.y;
  const b = isX ? geo.p2.x : geo.p2.y;
  return {
    direction: el.direction,
    fixed: isX ? geo.p1.y : geo.p1.x,
    min: Math.min(a, b), max: Math.max(a, b)
  };
}

/**
 * Nivel base sobre el que se generan las fundaciones.
 *
 * ★ BUGFIX — antes era `grid.zLevels.find(l => l.elevation === 0)`. En la práctica chilena el
 * ±0.00 es el **NTN** (terreno natural) y la tabiquería arranca en el **NPT** (piso terminado,
 * típicamente +450 por el sobrecimiento y el radier). Con esa regla el filtro
 * `wall.bottomZ === baseLevelId` no encontraba NINGÚN muro y la función devolvía
 * `{created: [], skipped: [], errors: []}` — cero fundaciones y cero explicación.
 *
 * `foundationGeometry.js` ya documenta la convención correcta: «`levelZ` es el NPT del nivel
 * base». Se resuelve entonces por significado, con degradación ordenada:
 *   1. `options.baseLevelId` explícito (lo que elija el usuario manda);
 *   2. el nivel tipado `pisoTerminado` (NPT), si tiene muros encima — es la respuesta semántica;
 *   3. el nivel MÁS BAJO que efectivamente tiene muros — funciona sin niveles tipados y es lo
 *      correcto también con subterráneo, donde el NPT no es el nivel más bajo;
 *   4. el de elevación 0 — comportamiento histórico, último recurso.
 * @returns {{level, motivo: string, nota: string|null}}
 */
function resolveBaseLevel(grid, elements, options) {
  const zLevels = grid.zLevels || [];
  const conMuros = new Set(elements.filter(e => e.type === 'wall' && e.bottomZ != null).map(e => e.bottomZ));

  if (options.baseLevelId != null) {
    const level = zLevels.find(l => l.id === options.baseLevelId);
    return { level: level || null, motivo: 'seleccionado por el usuario', nota: null };
  }

  const masBajoConMuros = zLevels
    .filter(l => conMuros.has(l.id))
    .sort((a, b) => a.elevation - b.elevation)[0] || null;

  const npt = zLevels.find(l => l.levelType === 'pisoTerminado');
  if (npt && conMuros.has(npt.id)) {
    const nota = masBajoConMuros && masBajoConMuros.id !== npt.id
      ? `hay muros en un nivel más bajo (${masBajoConMuros.name || masBajoConMuros.label} = ${Math.round(masBajoConMuros.elevation)}mm) — si son de subterráneo, seleccionar ese nivel a mano`
      : null;
    return { level: npt, motivo: 'nivel de piso terminado (NPT)', nota };
  }

  if (masBajoConMuros) {
    return {
      level: masBajoConMuros, motivo: 'nivel más bajo con muros',
      nota: npt ? null : 'ningún nivel está tipado como piso terminado (NPT) — tipar los niveles hace la elección inequívoca'
    };
  }

  const cero = zLevels.find(l => l.elevation === 0);
  return { level: cero || null, motivo: 'elevación 0 (sin muros en ningún nivel)', nota: null };
}

/**
 * @param {object} model - { grid, elements, library, projectParams }
 * @param {object} options
 *   - baseLevelId: id de zLevel a usar (default: se resuelve, ver resolveBaseLevel)
 *   - defaultSectionId: id de foundationSections (itemType 'cimiento') para el cimiento
 *   - tolerance: mm (default 5)
 *   - includeIsolatedUnderColumns: bool — genera poyo bajo pilares sin muro encima
 *   - defaultPadSectionId: id de foundationSections (itemType 'aislada') para el poyo
 * @returns {{created, skipped, errors, warnings, baseLevel:{id,name,elevation,motivo}|null}}
 */
export function generateFoundationsFromWalls(model, options = {}) {
  const { grid, elements, library = {}, projectParams = [] } = model;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const result = { created: [], skipped: [], errors: [], warnings: [], baseLevel: null };

  const { level: baseLevel, motivo, nota } = resolveBaseLevel(grid, elements, options);
  if (!baseLevel) {
    result.errors.push('No se pudo resolver el nivel base: la grilla no tiene niveles Z, o el nivel seleccionado no existe.');
    return result;
  }
  const baseLevelId = baseLevel.id;
  const nombreNivel = baseLevel.name || baseLevel.label || `z=${Math.round(baseLevel.elevation)}`;
  result.baseLevel = { id: baseLevelId, name: nombreNivel, elevation: baseLevel.elevation, motivo };
  if (nota) result.warnings.push(nota);

  const ciSection = findSection(library, 'cimiento', options.defaultSectionId);
  const cimiento = ciSection ? { width: ciSection.width, depth: ciSection.depth } : { ...DEFAULT_CIMIENTO };
  const cimientoLibraryId = ciSection ? ciSection.id : null;

  const walls = elements.filter((e) => e.type === 'wall' && e.bottomZ === baseLevelId);
  // ★ El fallo silencioso que motivó el bugfix: cero muros en el nivel elegido devolvía cero de
  // todo, sin una sola línea de explicación. Ahora se dice qué nivel se usó y dónde SÍ hay muros.
  if (!walls.length) {
    const totalMuros = elements.filter((e) => e.type === 'wall').length;
    const dondeSi = [...new Set(elements.filter((e) => e.type === 'wall').map((e) => e.bottomZ))]
      .map((id) => grid.zLevels.find((l) => l.id === id))
      .filter(Boolean)
      .sort((a, b) => a.elevation - b.elevation)
      .map((l) => `${l.name || l.label} (${Math.round(l.elevation)}mm)`);
    result.errors.push(totalMuros === 0
      ? 'El modelo no tiene muros: no hay nada bajo lo que generar fundaciones.'
      : `Ningún muro arranca en el nivel base "${nombreNivel}" (${Math.round(baseLevel.elevation)}mm, ${motivo}). Los ${totalMuros} muros del modelo arrancan en: ${dondeSi.join(', ')}.`);
    return result;
  }

  const segments = buildWallSegments(walls, grid, paramsMap, elementsById, result.errors);
  const mergedSegments = mergeCollinear(segments, tolerance);

  const existingCorridas = elements
    .filter((e) => e.type === 'foundation' && e.foundationType !== 'aislada' && e.levelZ === baseLevelId)
    .map((e) => resolveExistingTrace(e, grid, paramsMap, elementsById))
    .filter(Boolean);

  for (const seg of mergedSegments) {
    const dup = existingCorridas.some((ex) => ex.direction === seg.direction
      && Math.abs(ex.fixed - seg.fixed) <= tolerance
      && overlaps(ex.min, ex.max, seg.min, seg.max, tolerance));
    if (dup) {
      result.skipped.push({ wallIds: [...new Set(seg.wallIds)], reason: 'ya existe fundacion bajo esta traza' });
      continue;
    }
    result.created.push({
      type: 'foundation', foundationType: 'corrida', direction: seg.direction,
      fixedAxisId: seg.fixedAxisId, startAxisId: seg.startAxisId, endAxisId: seg.endAxisId,
      levelZ: baseLevelId, topOffset: 0, libraryId: cimientoLibraryId,
      cimiento: { ...cimiento }, sobrecimiento: null, emplantillado: null
    });
  }

  if (options.includeIsolatedUnderColumns) {
    const padSection = findSection(library, 'aislada', options.defaultPadSectionId);
    const pad = padSection
      ? { lengthX: padSection.lengthX, lengthY: padSection.lengthY, depth: padSection.depth }
      : { ...DEFAULT_PAD };
    const padLibraryId = padSection ? padSection.id : null;

    const existingAisladas = elements.filter((e) => e.type === 'foundation' && e.foundationType === 'aislada' && e.levelZ === baseLevelId);
    const columns = elements.filter((e) => e.type === 'column' && e.bottomZ === baseLevelId);

    for (const col of columns) {
      const geo = resolveColumnGeometry(col, grid, paramsMap, elementsById);
      if (!geo) { result.errors.push(`Pilar #${col.id}: geometria no resuelve, se omite.`); continue; }

      const coveredByWall = segments.some((s) => {
        const coord = s.direction === 'x' ? geo.center.x : geo.center.y;
        const fixedCoord = s.direction === 'x' ? geo.center.y : geo.center.x;
        return Math.abs(s.fixed - fixedCoord) <= tolerance && coord >= s.min - tolerance && coord <= s.max + tolerance;
      });
      if (coveredByWall) continue;

      const dup = existingAisladas.some((ex) => ex.axisXId === col.axisXId && ex.axisYId === col.axisYId);
      if (dup) { result.skipped.push({ columnId: col.id, reason: 'ya existe poyo bajo este pilar' }); continue; }

      result.created.push({
        type: 'foundation', foundationType: 'aislada',
        axisXId: col.axisXId, axisYId: col.axisYId,
        levelZ: baseLevelId, topOffset: 0, libraryId: padLibraryId,
        aislada: { ...pad }, columnId: col.id, emplantillado: null
      });
    }
  }

  return result;
}
