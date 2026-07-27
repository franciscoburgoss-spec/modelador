// core/wallSplitMerge.js
// ★ Sesión 15 — Dividir / unir muros.
//
// Los muros referencian EJES (xStart/xEnd/yStart/yEnd), no coordenadas libres: dividir en una
// posición cualquiera obliga a crear un eje auxiliar. Por eso las funciones son "planificadoras":
// devuelven el patch completo (muros resultantes + eje nuevo si hace falta + impactos) sin tocar
// el modelo, y el store lo aplica en UNA entrada de historial.
//
// Decisión con Fran (opción C): los muros resultantes llevan IDS NUEVOS. Cualquier referencia al
// muro original (sistemas de techumbre, referencias entre elementos, cotas) queda explícitamente
// rota y aparece en la validación, en vez de reapuntarse en silencio a un muro de otro largo.
//
// `opening.position` es la coordenada de MUNDO del centro del vano (ver core/metalconModulation.js:
// `centerOffset = o.position - worldMin`), así que al dividir/unir NO hay que recalcular nada:
// cada vano se asigna al tramo que lo contiene.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';

/** Campos derivados del despiece: se descartan al dividir/unir (el largo del muro cambió). */
const DERIVED_FIELDS = ['studs', 'headers', 'osbPanels', 'osbCourses', 'osbNoggings', 'studsStale', 'osbStale'];

const stripDerived = (wall) => {
  const out = { ...wall };
  for (const f of DERIVED_FIELDS) delete out[f];
  return out;
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Marcador que ocupa el lugar del eje del corte cuando hay que crear uno nuevo: el store lo
 *  reemplaza por el id real del eje recién creado (las funciones puras no generan ids). */
export const CUT_AXIS_PLACEHOLDER = '__CUT_AXIS__';

/** Rango en mundo del muro a lo largo de su dirección de corrida. */
function wallRunRange(wall, geo) {
  const runX = isWallXRun(wall);
  const a = runX ? geo.p1.x : geo.p1.y;
  const b = runX ? geo.p2.x : geo.p2.y;
  return { runX, a, b, min: Math.min(a, b), max: Math.max(a, b) };
}

/** Coordenada fija (perpendicular a la corrida). */
const fixedCoord = (runX, geo) => (runX ? geo.p1.y : geo.p1.x);

/** Intervalos ocupados por vanos, en coordenadas de mundo, unidos y ordenados. */
function openingIntervals(wall) {
  const raw = (wall.openings || [])
    .map((o) => {
      const w = num(o.width);
      const c = num(o.position);
      return { lo: c - w / 2, hi: c + w / 2, opening: o };
    })
    .filter((i) => i.hi > i.lo)
    .sort((a, b) => a.lo - b.lo);
  return raw;
}

/** Elementos y sistemas que apuntan a estos muros y quedarán con la referencia rota. */
function collectImpacts(model, wallIds) {
  const ids = new Set(wallIds);
  const roofSystemIds = (model.roofSystems || [])
    .filter((s) => ids.has(s.wallLowId) || ids.has(s.wallHighId))
    .map((s) => s.id);
  const referencingElementIds = (model.elements || [])
    .filter((el) => !ids.has(el.id) && JSON.stringify(el).includes('"refElementId"')
      && [...ids].some((id) => JSON.stringify(el).includes(`"refElementId":${JSON.stringify(id)}`)))
    .map((el) => el.id);
  const dimensionIds = (model.dimensions || [])
    .filter((d) => ids.has(d.elementId) || ids.has(d.refElementId))
    .map((d) => d.id);
  return { roofSystemIds, referencingElementIds, dimensionIds };
}

/** Etiqueta libre para un eje auxiliar nuevo: aux1, aux2, … sin chocar con las existentes. */
export function nextAuxLabel(axes) {
  const used = new Set((axes || []).map((a) => String(a.label || '')));
  let n = 1;
  while (used.has(`aux${n}`)) n++;
  return `aux${n}`;
}

/**
 * Punto de corte válido más cercano a `target`: fuera de todo vano y respetando el tramo mínimo.
 * @returns {number|null}
 */
export function nearestValidCut(target, min, max, intervals, minSegment) {
  const lo = min + minSegment, hi = max - minSegment;
  if (hi < lo) return null;
  const valid = (p) => p >= lo - 1e-6 && p <= hi + 1e-6 && !intervals.some((i) => p > i.lo + 1e-6 && p < i.hi - 1e-6);
  if (valid(target)) return target;
  // candidatos: bordes de cada vano + extremos del rango admisible
  const cands = [lo, hi, ...intervals.flatMap((i) => [i.lo, i.hi])].filter(valid);
  if (!cands.length) return null;
  return cands.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}

/**
 * Planifica la división de un muro. NO modifica el modelo.
 * @param options {atAxisId?, atPosition?, atOffset?, minSegment?, tolerance?}
 *   - atAxisId: eje existente de la dirección de corrida (preferido).
 *   - atPosition: coordenada de mundo del corte.
 *   - atOffset: mm medidos desde el extremo de MENOR coordenada (misma convención que los vanos).
 * @returns {{ok, error?, suggestion?, walls?, newAxis?, cutPosition?, impacts?, warnings}}
 */
export function planWallSplit(model, wallId, options = {}) {
  const warnings = [];
  const minSegment = options.minSegment ?? 200;
  const tolerance = options.tolerance ?? 1;

  const wall = (model.elements || []).find((el) => el.id === wallId);
  if (!wall || wall.type !== 'wall') return { ok: false, error: 'el elemento no existe o no es un muro', warnings };

  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(model.elements);
  const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
  if (!geo) return { ok: false, error: 'geometría del muro no resuelta (ejes faltantes o referencia rota)', warnings };

  const { runX, a, b, min, max } = wallRunRange(wall, geo);
  const axes = runX ? model.grid.xAxes : model.grid.yAxes;

  let cutPosition;
  if (options.atAxisId != null && options.atAxisId !== '') {
    const axis = axes.find((ax) => ax.id === options.atAxisId || ax.id === Number(options.atAxisId));
    if (!axis) return { ok: false, error: `el eje elegido no existe en la dirección ${runX ? 'X' : 'Y'}`, warnings };
    cutPosition = axis.position;
  } else if (options.atPosition != null) {
    cutPosition = Number(options.atPosition);
  } else if (options.atOffset != null) {
    cutPosition = min + Number(options.atOffset);
  } else {
    return { ok: false, error: 'indicar dónde dividir (eje, posición o distancia)', warnings };
  }
  if (!Number.isFinite(cutPosition)) return { ok: false, error: 'posición de corte inválida', warnings };

  const intervals = openingIntervals(wall);

  if (cutPosition <= min + minSegment - 1e-6 || cutPosition >= max - minSegment + 1e-6) {
    return {
      ok: false,
      error: `el corte deja un tramo menor a ${minSegment} mm — debe quedar entre ${Math.round(min + minSegment)} y ${Math.round(max - minSegment)} mm`,
      suggestion: nearestValidCut(cutPosition, min, max, intervals, minSegment),
      warnings
    };
  }

  const hit = intervals.find((i) => cutPosition > i.lo + 1e-6 && cutPosition < i.hi - 1e-6);
  if (hit) {
    const suggestion = nearestValidCut(cutPosition, min, max, intervals, minSegment);
    return {
      ok: false,
      error: `el corte cae dentro de un vano (${Math.round(hit.lo)} a ${Math.round(hit.hi)} mm) — partir un vano dejaría el dintel apoyado en un solo extremo`,
      suggestion,
      suggestionSides: {
        left: nearestValidCut(hit.lo, min, max, intervals, minSegment),
        right: nearestValidCut(hit.hi, min, max, intervals, minSegment)
      },
      warnings
    };
  }

  // Eje del corte: reusar uno existente si coincide, o proponer uno auxiliar nuevo.
  const existing = axes.find((ax) => Math.abs(ax.position - cutPosition) <= tolerance);
  const newAxis = existing
    ? null
    // La etiqueta se busca libre en AMBAS direcciones: tener aux1 en X y aux1 en Y confunde.
    : { axisType: runX ? 'x' : 'y', position: cutPosition, label: nextAuxLabel([...model.grid.xAxes, ...model.grid.yAxes]), type: 'aux' };
  const cutAxisId = existing ? existing.id : CUT_AXIS_PLACEHOLDER;

  // p1 corresponde a xStart/yStart y p2 a xEnd/yEnd (ver resolveWallGeometry).
  const fieldP1 = runX ? 'xStart' : 'yStart';
  const fieldP2 = runX ? 'xEnd' : 'yEnd';
  const base = stripDerived(wall);
  delete base.id;

  const segA = { ...base, [fieldP2]: cutAxisId };  // del extremo p1 hasta el corte
  const segB = { ...base, [fieldP1]: cutAxisId };  // del corte hasta el extremo p2

  const rangeA = { min: Math.min(a, cutPosition), max: Math.max(a, cutPosition) };
  const rangeB = { min: Math.min(cutPosition, b), max: Math.max(cutPosition, b) };
  const inRange = (r, o) => num(o.position) >= r.min - 1e-6 && num(o.position) <= r.max + 1e-6;
  segA.openings = (wall.openings || []).filter((o) => inRange(rangeA, o));
  segB.openings = (wall.openings || []).filter((o) => !inRange(rangeA, o) && inRange(rangeB, o));

  const lost = (wall.openings || []).length - segA.openings.length - segB.openings.length;
  if (lost > 0) warnings.push(`${lost} vano(s) quedaron fuera de ambos tramos y no se asignaron — revisar`);
  if (wall.studs || wall.osbCourses) warnings.push('se descarta el despiece de metalcon/OSB de este muro: hay que regenerarlo en los dos tramos');

  return {
    ok: true,
    cutPosition,
    newAxis,
    cutAxisId,
    walls: [segA, segB],
    lengths: [rangeA.max - rangeA.min, rangeB.max - rangeB.min],
    openingCounts: [segA.openings.length, segB.openings.length],
    impacts: collectImpacts(model, [wallId]),
    warnings
  };
}

/**
 * Planifica la unión de muros colineales contiguos. NO modifica el modelo.
 * @returns {{ok, error?, wall?, removedIds?, impacts?, warnings}}
 */
export function planWallMerge(model, wallIds, options = {}) {
  const warnings = [];
  const tolerance = options.tolerance ?? 5;

  if (!Array.isArray(wallIds) || wallIds.length < 2) return { ok: false, error: 'seleccionar al menos dos muros', warnings };
  const walls = wallIds.map((id) => (model.elements || []).find((el) => el.id === id));
  if (walls.some((w) => !w || w.type !== 'wall')) return { ok: false, error: 'alguno de los elementos no existe o no es un muro', warnings };

  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(model.elements);
  const items = [];
  for (const w of walls) {
    const geo = resolveWallGeometry(w, model.grid, paramsMap, elementsById);
    if (!geo) return { ok: false, error: `muro ${w.id}: geometría no resuelta`, warnings };
    const r = wallRunRange(w, geo);
    items.push({ wall: w, geo, ...r, fixed: fixedCoord(r.runX, geo), thickness: geo.thickness });
  }

  const ref = items[0];
  for (const it of items.slice(1)) {
    if (it.runX !== ref.runX) return { ok: false, error: 'los muros no tienen la misma dirección', warnings };
    if (Math.abs(it.fixed - ref.fixed) > tolerance) return { ok: false, error: 'los muros no están sobre el mismo eje', warnings };
    if (it.wall.bottomZ !== ref.wall.bottomZ || it.wall.topZ !== ref.wall.topZ) {
      return { ok: false, error: 'los muros no comparten nivel inferior y superior — unirlos cambiaría la coronación', warnings };
    }
    if (Math.abs(num(it.thickness) - num(ref.thickness)) > 0.5) return { ok: false, error: 'los muros tienen espesores distintos', warnings };
    if ((it.wall.libraryId ?? null) !== (ref.wall.libraryId ?? null)) return { ok: false, error: 'los muros usan secciones de librería distintas', warnings };
    if ((it.wall.wallTypeId ?? null) !== (ref.wall.wallTypeId ?? null)) {
      return {
        ok: false,
        error: 'los muros usan tipos de muro distintos — unirlos descartaría rol y defaults',
        warnings
      };
    }
  }

  const sorted = [...items].sort((p, q) => p.min - q.min);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].min - sorted[i].max;
    if (gap > tolerance) {
      return { ok: false, error: `los muros no son contiguos: hay un vacío de ${Math.round(gap)} mm entre ellos`, warnings };
    }
    if (gap < -tolerance) warnings.push(`los tramos se solapan ${Math.round(-gap)} mm — el muro resultante toma la envolvente`);
  }

  const first = sorted[0], last = sorted[sorted.length - 1];
  const runX = ref.runX;
  // Campo de eje que resuelve al extremo de menor / mayor coordenada de cada muro.
  const lowField = (it) => (it.a <= it.b ? (runX ? 'xStart' : 'yStart') : (runX ? 'xEnd' : 'yEnd'));
  const highField = (it) => (it.a <= it.b ? (runX ? 'xEnd' : 'yEnd') : (runX ? 'xStart' : 'yStart'));

  // Propiedades base: el tramo más largo manda (es el que más representa al muro resultante).
  const longest = [...items].sort((p, q) => (q.max - q.min) - (p.max - p.min))[0].wall;
  const base = stripDerived(longest);
  delete base.id;

  const merged = {
    ...base,
    direction: runX ? 'x' : 'y',
    [runX ? 'xStart' : 'yStart']: first.wall[lowField(first)],
    [runX ? 'xEnd' : 'yEnd']: last.wall[highField(last)],
    openings: items
      .flatMap((it) => it.wall.openings || [])
      .sort((p, q) => num(p.position) - num(q.position))
  };

  // Diferencias que se pierden al tomar las propiedades del tramo más largo.
  const varying = ['framingStudProfileId', 'framingTrackProfileId', 'framingMaterialId', 'studSpacing',
    'osbPanelWidth', 'osbPanelHeight', 'osbMinPanelWidth']
    .filter((f) => new Set(walls.map((w) => JSON.stringify(w[f] ?? null))).size > 1);
  if (varying.length) warnings.push(`los muros tenían valores distintos en ${varying.join(', ')} — se conservan los del tramo más largo`);
  if (walls.some((w) => w.studs || w.osbCourses)) warnings.push('se descarta el despiece de metalcon/OSB: hay que regenerarlo en el muro unido');

  return {
    ok: true,
    wall: merged,
    removedIds: walls.map((w) => w.id),
    length: last.max - first.min,
    impacts: collectImpacts(model, walls.map((w) => w.id)),
    warnings
  };
}

/**
 * Candidatos a unir con `wallId`: mismos ejes/niveles/sección y contiguos (encadenando).
 * Pensado para la UI: no hay selección múltiple en el canvas.
 */
export function findMergeCandidates(model, wallId, options = {}) {
  const tolerance = options.tolerance ?? 5;
  const wall = (model.elements || []).find((el) => el.id === wallId);
  if (!wall || wall.type !== 'wall') return [];

  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(model.elements);
  const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
  if (!geo) return [];
  const r = wallRunRange(wall, geo);
  const fixed = fixedCoord(r.runX, geo);

  const pool = (model.elements || [])
    .filter((el) => el.type === 'wall' && el.id !== wallId)
    .map((el) => {
      const g = resolveWallGeometry(el, model.grid, paramsMap, elementsById);
      if (!g) return null;
      const rr = wallRunRange(el, g);
      if (rr.runX !== r.runX) return null;
      if (Math.abs(fixedCoord(rr.runX, g) - fixed) > tolerance) return null;
      if (el.bottomZ !== wall.bottomZ || el.topZ !== wall.topZ) return null;
      if ((el.libraryId ?? null) !== (wall.libraryId ?? null)) return null;
      if ((el.wallTypeId ?? null) !== (wall.wallTypeId ?? null)) return null;
      if (Math.abs(num(g.thickness) - num(geo.thickness)) > 0.5) return null;
      return { wall: el, min: rr.min, max: rr.max };
    })
    .filter(Boolean);

  // Encadenado desde el muro base hacia ambos lados.
  const chain = [];
  let lo = r.min, hi = r.max;
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of pool) {
      if (chain.includes(c)) continue;
      if (Math.abs(c.max - lo) <= tolerance || Math.abs(c.min - hi) <= tolerance) {
        chain.push(c);
        lo = Math.min(lo, c.min);
        hi = Math.max(hi, c.max);
        grew = true;
      }
    }
  }
  return chain.sort((p, q) => p.min - q.min).map((c) => c.wall);
}
