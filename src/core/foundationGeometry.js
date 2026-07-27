// core/foundationGeometry.js
// ★ Sesión 11 — Fundaciones. Única fuente de verdad de la geometría de una fundación.
//
// Modelo de datos (decidido con Fran):
//   corrida  → UN elemento con dos capas: `cimiento {width, depth}` +
//              `sobrecimiento {width, height} | null`. Ejes como una viga
//              (direction + fixedAxisId/startAxisId/endAxisId), así resolveBeamGeometry
//              sigue sirviendo para elevaciones/naming/CalculiX sin duplicar lógica.
//   aislada  → intersección de ejes (axisXId × axisYId) + `aislada {lengthX, lengthY, depth}`
//              + `columnId` opcional (informativo, no crea dependencia geométrica).
//
// Cotas: `levelZ` es el NPT del nivel base. `topOffset` (default 0) desplaza el tope del
// sobrecimiento respecto de ese NPT; si es ≠ 0 la validación avisa (el tope debería empatar
// con el NPT). Hacia abajo: sobrecimiento → cimiento → sello → emplantillado.
//
// Todo en mm. Cualquier campo numérico puede ser fórmula → resolveValue SIEMPRE.

import { resolveBeamGeometry, resolveColumnGeometry } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';

export const FOUNDATION_TYPES = ['corrida', 'aislada'];

const num = (raw, fallback, paramsMap, elementsById) => {
  if (raw == null || raw === '') return fallback;
  const v = resolveValue(raw, paramsMap, elementsById);
  return Number.isFinite(v) ? v : fallback;
};

/** ¿Es una fundación corrida? (incluye el legacy 'cimiento'/'sobrecimiento' ya migrado) */
export function isCorrida(el) {
  return el.type === 'foundation' && el.foundationType !== 'aislada';
}

/**
 * Resuelve la fundación a capas con cotas y volúmenes.
 * @returns {null | {
 *   kind, npt, topElevation, sealElevation,
 *   layers: Array<{name, label, width, height, top, bottom, volume, libraryId}>,
 *   emplantillado: null | {thickness, overhang, area, volume, top, bottom},
 *   formworkArea, excavationLength,
 *   p1?, p2?, length?, center?, lengthX?, lengthY?
 * }}
 */
export function resolveFoundation(el, grid, paramsMap = {}, elementsById = {}) {
  if (!el || el.type !== 'foundation') return null;
  const level = grid.zLevels.find((l) => l.id === el.levelZ);
  const npt = level ? level.elevation : 0; // fallback: fundaciones sin nivel base asignado
  const topElevation = npt + num(el.topOffset, 0, paramsMap, elementsById);

  return el.foundationType === 'aislada'
    ? resolveAislada(el, grid, paramsMap, elementsById, npt, topElevation)
    : resolveCorrida(el, grid, paramsMap, elementsById, npt, topElevation);
}

function resolveCorrida(el, grid, paramsMap, elementsById, npt, topElevation) {
  const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
  if (!geo) return null;
  const length = Math.hypot(geo.p2.x - geo.p1.x, geo.p2.y - geo.p1.y);

  const layers = [];
  let cursor = topElevation;

  const sc = el.sobrecimiento;
  if (sc) {
    const width = num(sc.width, 0, paramsMap, elementsById);
    const height = num(sc.height, 0, paramsMap, elementsById);
    layers.push({
      name: 'sobrecimiento', label: 'Sobrecimiento', width, height,
      top: cursor, bottom: cursor - height, volume: width * height * length,
      libraryId: sc.libraryId ?? null
    });
    cursor -= height;
  }

  const ci = el.cimiento;
  if (ci) {
    const width = num(ci.width, 0, paramsMap, elementsById);
    const height = num(ci.depth, 0, paramsMap, elementsById);
    layers.push({
      name: 'cimiento', label: 'Cimiento', width, height,
      top: cursor, bottom: cursor - height, volume: width * height * length,
      libraryId: el.libraryId ?? null
    });
    cursor -= height;
  }

  const sealElevation = cursor;
  const base = layers.find((l) => l.name === 'cimiento') || layers[0] || null;
  const emplantillado = buildEmplantillado(el, paramsMap, elementsById, sealElevation,
    base ? base.width : 0, length, 'corrida');
  const scLayer = layers.find((l) => l.name === 'sobrecimiento');

  return {
    kind: 'corrida', npt, topElevation, sealElevation, layers, emplantillado,
    formworkArea: scLayer ? 2 * length * scLayer.height : 0,
    excavationLength: length,
    p1: geo.p1, p2: geo.p2, length,
    width: base ? base.width : 0 // ancho de referencia para dibujo en planta
  };
}

function resolveAislada(el, grid, paramsMap, elementsById, npt, topElevation) {
  const a = el.aislada || {};
  const lengthX = num(a.lengthX, 0, paramsMap, elementsById);
  const lengthY = num(a.lengthY, 0, paramsMap, elementsById);
  const depth = num(a.depth, 0, paramsMap, elementsById);
  const geo = resolveColumnGeometry(
    { axisXId: el.axisXId, axisYId: el.axisYId, offsetX: el.offsetX, offsetY: el.offsetY, widthX: lengthX, widthY: lengthY },
    grid, paramsMap, elementsById
  );
  if (!geo) return null;

  const layers = [{
    name: 'zapata', label: 'Zapata aislada', width: lengthX, height: depth,
    top: topElevation, bottom: topElevation - depth,
    volume: lengthX * lengthY * depth, libraryId: el.libraryId ?? null
  }];
  const sealElevation = topElevation - depth;
  const emplantillado = buildEmplantillado(el, paramsMap, elementsById, sealElevation, lengthX, lengthY, 'aislada');

  return {
    kind: 'aislada', npt, topElevation, sealElevation, layers, emplantillado,
    formworkArea: 2 * (lengthX + lengthY) * depth,
    excavationLength: 0,
    center: geo.center, lengthX, lengthY
  };
}

/** Emplantillado: capa de pobre bajo el sello, con sobreancho a cada lado. Solo metrado
 *  (no se dibuja en planta; sí en cortes). Campos opcionales en `el.emplantillado`. */
function buildEmplantillado(el, paramsMap, elementsById, sealElevation, dimA, dimB, kind) {
  const e = el.emplantillado;
  if (!e) return null;
  const thickness = num(e.thickness, 0, paramsMap, elementsById);
  if (thickness <= 0) return null;
  const overhang = num(e.overhang, 0, paramsMap, elementsById);
  const a = dimA + 2 * overhang;
  const b = kind === 'aislada' ? dimB + 2 * overhang : dimB; // corrida: el largo no crece
  const area = a * b;
  return { thickness, overhang, area, volume: area * thickness, top: sealElevation, bottom: sealElevation - thickness };
}

/** Extremo superior e inferior absolutos (para visibilidad en planta y bbox de elevación). */
export function foundationVerticalRange(el, grid, paramsMap = {}, elementsById = {}) {
  const f = resolveFoundation(el, grid, paramsMap, elementsById);
  if (!f) return null;
  const bottom = f.emplantillado ? f.emplantillado.bottom : f.sealElevation;
  return { top: f.topElevation, bottom };
}

// ---- migración de modelos guardados ------------------------------------------------------
// Antes: dos elementos separados con foundationType 'cimiento' | 'sobrecimiento' y campos
// planos width/depth. Ahora: un elemento 'corrida' con dos capas. Se fusiona el sobrecimiento
// dentro del cimiento que comparte ejes + nivel; los huérfanos quedan como corrida sin cimiento.

const sameAxis = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function sameRun(a, b) {
  return a.direction === b.direction &&
    sameAxis(a.fixedAxisId, b.fixedAxisId) &&
    sameAxis(a.startAxisId, b.startAxisId) &&
    sameAxis(a.endAxisId, b.endAxisId) &&
    a.levelZ === b.levelZ;
}

/** Migra `elements` al modelo de fundación de dos capas. Idempotente. */
export function migrateFoundations(elements) {
  if (!Array.isArray(elements)) return elements;
  const legacy = elements.filter((el) => el.type === 'foundation' && (el.foundationType === 'cimiento' || el.foundationType === 'sobrecimiento'));
  if (legacy.length === 0) return elements;

  const absorbed = new Set();
  const out = [];
  for (const el of elements) {
    if (!legacy.includes(el)) { out.push(el); continue; }
    if (absorbed.has(el.id)) continue;

    if (el.foundationType === 'cimiento') {
      const sc = legacy.find((o) => o.foundationType === 'sobrecimiento' && !absorbed.has(o.id) && sameRun(o, el));
      if (sc) absorbed.add(sc.id);
      out.push(toCorrida(el, { width: el.width, depth: el.depth }, sc ? { width: sc.width, height: sc.depth, libraryId: sc.libraryId ?? null } : null));
    } else {
      // sobrecimiento huérfano: se conserva como corrida sin cimiento (no se inventa geometría)
      out.push(toCorrida(el, null, { width: el.width, height: el.depth, libraryId: el.libraryId ?? null }));
    }
  }
  return out;
}

function toCorrida(el, cimiento, sobrecimiento) {
  const { width, depth, foundationType, ...rest } = el;
  return { ...rest, foundationType: 'corrida', cimiento, sobrecimiento, topOffset: el.topOffset ?? 0 };
}

/** Librería: el sobrecimiento guardaba su altura en `depth`; ahora es `height`. Idempotente. */
export function migrateFoundationSections(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((sec) => {
    if (sec.itemType !== 'sobrecimiento' || sec.height != null) return sec;
    const { depth, ...rest } = sec;
    return { ...rest, height: depth };
  });
}

// ---- helpers de render (planta / elevación) ----------------------------------------------

/** Forma en planta: segmento con ancho (corrida) o rectángulo centrado (aislada). */
export function foundationPlanShape(el, grid, paramsMap = {}, elementsById = {}) {
  const f = resolveFoundation(el, grid, paramsMap, elementsById);
  if (!f) return null;
  return f.kind === 'aislada'
    ? { kind: 'aislada', center: f.center, lengthX: f.lengthX, lengthY: f.lengthY }
    : { kind: 'corrida', p1: f.p1, p2: f.p2, width: f.width };
}

/**
 * Rectángulos por capa en el plano de una elevación.
 * @param axis 'x' | 'y' — eje del corte (mode.axis): 'x' proyecta la coordenada Y como horizontal.
 * @returns [{name, label, hMin, hMax, vBottom, vTop}] de arriba hacia abajo (incl. emplantillado)
 */
export function foundationElevationRects(el, grid, axis, paramsMap = {}, elementsById = {}) {
  const f = resolveFoundation(el, grid, paramsMap, elementsById);
  if (!f) return [];

  let hMinBase, hMaxBase;
  if (f.kind === 'corrida') {
    const h1 = axis === 'x' ? f.p1.y : f.p1.x;
    const h2 = axis === 'x' ? f.p2.y : f.p2.x;
    hMinBase = Math.min(h1, h2);
    hMaxBase = Math.max(h1, h2);
  } else {
    const c = axis === 'x' ? f.center.y : f.center.x;
    const len = axis === 'x' ? f.lengthY : f.lengthX;
    hMinBase = c - len / 2;
    hMaxBase = c + len / 2;
  }
  // El plano de corte es x=const cuando axis==='x'; la fundación se ve a lo largo (y no de
  // canto) cuando su eje es paralelo a ese plano.
  const onCut = f.kind === 'corrida' && (axis === 'x' ? f.p1.x === f.p2.x : f.p1.y === f.p2.y);

  const rects = f.layers.map((l) => {
    // Corrida cortada a lo largo: el ancho real de la capa no se ve; se ve su longitud.
    const half = onCut ? 0 : l.width / 2;
    return {
      name: l.name, label: l.label,
      hMin: onCut ? hMinBase : hMinBase - half, hMax: onCut ? hMaxBase : hMaxBase + half,
      vBottom: l.bottom, vTop: l.top
    };
  });
  if (f.emplantillado) {
    const extra = f.kind === 'corrida' && onCut ? 0 : f.emplantillado.overhang;
    rects.push({
      name: 'emplantillado', label: 'Emplantillado',
      hMin: hMinBase - extra, hMax: hMaxBase + extra,
      vBottom: f.emplantillado.bottom, vTop: f.emplantillado.top
    });
  }
  return rects;
}

/** Bounding box en el plano de elevación (para hitTest y resaltado). */
export function foundationElevationBBox(el, grid, axis, paramsMap = {}, elementsById = {}) {
  const rects = foundationElevationRects(el, grid, axis, paramsMap, elementsById);
  if (!rects.length) return null;
  return {
    hMin: Math.min(...rects.map(r => r.hMin)),
    hMax: Math.max(...rects.map(r => r.hMax)),
    vBottom: Math.min(...rects.map(r => r.vBottom)),
    vTop: Math.max(...rects.map(r => r.vTop))
  };
}
