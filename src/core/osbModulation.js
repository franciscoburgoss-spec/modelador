// core/osbModulation.js
// ★ Modulación de placas OSB: despiece de juntas verticales (ancho de placa) Y horizontales
// (cursos, cuando el muro es más alto que `panelHeight`) sobre un muro ya modulado en metalcon.
//
// Método (como lo hace Fran a mano — no equirepartición): por cada vano, se CENTRA una placa
// (o varias si el vano es muy ancho) sobre su ancho, con un margen mínimo de 100mm libre a cada
// lado (piso duro). La placa centrada CUBRE el vano y el vacío real (vidrio/puerta) se RECORTA
// de ella (`cutouts`) — como en obra: placa completa con el hueco cortado, sin juntas en las
// esquinas del vano. Solo si el vacío cubre el alto completo del curso, la columna se excluye
// (hueco pasante, no hay material que placar en ese curso). Desde los bordes de la placa-ancla
// se propagan placas COMPLETAS hacia cada lado hasta el próximo vano o el borde del muro — el
// corte no-estándar queda concentrado en el tramo final de cada corrida ("corredor"), no
// repartido parejo en todas las placas. Un muro sin vanos es un único corredor que ancla desde
// el extremo "start".
//
// Reglas (Manual LP OSB / Manual Metalcon Cintac Anexo IV):
//   - toda junta (vertical u horizontal de footprint) debe caer sobre un pie derecho que cubra
//     COMPLETO el alto del curso en ese punto (no necesariamente toda la altura del muro)
//   - el VACÍO real de un vano (vidrio/puerta, rango sillRel..topRel) se excluye completo — pero
//     arriba del dintel y bajo el antepecho hay muro sólido, y ESE se centra y placa igual que
//     cualquier vano (con cripple/crippleTop de respaldo)
//   - margen mínimo de 100mm libre a cada lado del vano dentro de la placa que lo centra (piso
//     duro, no configurable) — si no alcanza con una sola placa, se agregan más, siempre
//     centradas en el vano
//   - la placa nunca se "estira": sale de fábrica en `panelWidth` x `panelHeight` (mm) y solo se
//     puede cortar más angosta/baja. Si no hay pie derecho candidato dentro de tolerancia, se
//     agrega una placa extra en ese tramo (nunca se fuerza una placa > panelWidth)
//   - una placa resultante bajo `minPanelWidth` se fusiona con la vecina que corresponda (la
//     que la precede o la que la sigue, la que no exceda panelWidth); si ninguna sirve, se deja
//     como corte angosto y se reporta warning
//   - muro > panelHeight (2440mm): se apilan HILADAS COMPLETAS desde abajo y el remanente va
//     ARRIBA (ver computeCourseBreaks). NO se reparte parejo: repartir daba 2 cursos de 1300 en un
//     muro de 2600 — ninguna placa entera y una junta a distinta altura en cada muro. Con esta
//     regla la junta horizontal queda a cota constante (múltiplo de panelHeight) en todos los
//     muros. La junta no necesita snap horizontal — cualquier pie derecho de altura completa cruza
//     continuo los dos cursos — pero SÍ exige CADENETA: el manual LP obliga a fijar el encuentro
//     longitudinal de tableros a una pieza horizontal. Desde R3 la junta se expone en
//     `computeCourseBreaks().jointZs` y el solver Metalcon genera las piezas `role:'nogging'`;
//     este módulo sólo resuelve placas.
//   - cursos consecutivos alternan el lado de anclaje de cada corredor (`stagger`, activado por
//     defecto) para que las juntas no queden alineadas entre un curso y el siguiente ("trabar en
//     forma escalonada", recomendación del manual LP).
//
// Límite conocido: dos vanos apilados en la misma columna x (mismo oMin/oMax, distinta altura)
// se procesan de forma independiente por curso — si ambos caen en el mismo curso con relación
// vacío/sólido contradictoria entre sí, el resultado no está definido. Caso raro, no resuelto.
//
// Requiere el despiece de montantes ya calculado (wall.studs, de computeStudLayout) — la
// junta de placa depende de dónde hay respaldo real, no se recalcula desde cero acá.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';

const EPS = 1; // mm
const MIN_EDGE_MARGIN = 100; // mm — piso duro, margen libre mínimo a cada lado de un vano centrado
// Holgura de cobertura vertical para respaldo de junta en franjas sobre/bajo un vacío: el
// cripple/crippleTop no llega hasta sillRel/topRel exactos — termina en la cara del track
// (antepecho/dintel), que ocupa ese resto y también recibe tornillo. 150mm cubre cualquier
// altura de track del catálogo sin dejar pasar un stud que realmente no respalde la franja.
const COVER_SLACK = 150; // mm
// Altura mínima razonable para la hilada de remanente (arriba). Bajo esto la tira es difícil de
// fijar y conviene bajar la junta para que caiga sobre un travesaño (config.enforceMinCourse).
const MIN_COURSE_HEIGHT = 300; // mm

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Junta lista de offsets internos [0, ...joints, segLength] en spans {start, end}. */
function toSpans(segLength, joints) {
  const points = [0, ...joints, segLength];
  const spans = [];
  for (let i = 0; i < points.length - 1; i++) spans.push({ start: points[i], end: points[i + 1] });
  return spans;
}

/**
 * Greedy de cobertura: parte [left,right] con juntas en `candidates` (offsets absolutos) tal que
 * todo span quede ≤ panelWidth, usando el MÍNIMO de juntas — cada paso toma el candidato más
 * lejano alcanzable, así las placas quedan lo más anchas posible (enteras cuando el stud layout
 * calza) y el remanente se concentra en un solo lugar, no repartido. Reemplaza al esquema previo
 * de "punto ideal + snap con tolerancia", que fallaba con soluciones válidas cuando el stud
 * correcto quedaba a más de la tolerancia del punto ideal (bug real encontrado con datos de Fran).
 * `mode`: 'left' avanza desde left (remanente a la derecha), 'right' al revés, 'both' alterna
 * desde ambos lados (remanente al medio — corredor entre dos anclas). `staggered` invierte el
 * lado (o el turno inicial en 'both') para escalonar juntas entre cursos.
 * Devuelve lista de juntas (absolutas, ordenadas) o null si es infactible.
 */
function greedyJoints(left, right, candidates, panelWidth, mode, staggered = false) {
  let effectiveMode = mode;
  if (staggered && mode === 'left') effectiveMode = 'right';
  else if (staggered && mode === 'right') effectiveMode = 'left';

  const sorted = [...candidates].filter(c => c > left + EPS && c < right - EPS).sort((a, b) => a - b);
  const joints = [];
  let posL = left, posR = right;
  let turnLeft = effectiveMode !== 'right' && !(effectiveMode === 'both' && staggered);

  let guard = sorted.length + 2;
  while (posR - posL > panelWidth + EPS && guard-- > 0) {
    if (effectiveMode === 'left' || (effectiveMode === 'both' && turnLeft)) {
      let best = null;
      for (const c of sorted) if (c > posL + EPS && c <= posL + panelWidth + EPS && c < posR - EPS) best = c;
      if (best == null) return null;
      joints.push(best);
      posL = best;
    } else {
      let best = null;
      for (const c of sorted) { if (c >= posR - panelWidth - EPS && c < posR - EPS && c > posL + EPS) { best = c; break; } }
      if (best == null) return null;
      joints.push(best);
      posR = best;
    }
    if (effectiveMode === 'both') turnLeft = !turnLeft;
  }
  if (posR - posL > panelWidth + EPS) return null;
  return joints.sort((a, b) => a - b);
}

/** Fusiona spans bajo minPanelWidth con la vecina que corresponda (la anterior o la siguiente —
 * la placa "ancla" (más angosta, típicamente en el extremo de una corrida) puede quedar tanto al
 * principio como al final del tramo según el modo de anclaje), solo si el resultado no excede
 * panelWidth. Si ninguna fusión es válida, se deja como corte angosto. */
function mergeShortSpans(spans, minPanelWidth, panelWidth) {
  const out = spans.map(s => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    const width = out[i].end - out[i].start;
    if (width >= minPanelWidth - EPS) continue;
    if (i > 0 && (out[i - 1].end - out[i - 1].start) + width <= panelWidth + EPS) {
      out[i - 1].end = out[i].end;
      out.splice(i, 1);
      i--;
      continue;
    }
    if (i < out.length - 1 && (out[i + 1].end - out[i + 1].start) + width <= panelWidth + EPS) {
      out[i + 1].start = out[i].start;
      out.splice(i, 1);
      i--;
    }
    // si ninguna fusión es válida (ambas vecinas ya están al tope), se deja el corte angosto
  }
  return out;
}

/** Modula un corredor (tramo sólido entre vanos, o entre un vano y el borde del muro) llenando
 * con placas COMPLETAS via greedy desde el/los extremo(s) indicado(s) por `mode`. Absolutos. */
function modulateCorredor(segStart, segEnd, courseOffsets, panelWidth, minPanelWidth, mode, staggered) {
  const segLength = segEnd - segStart;
  if (segLength <= EPS) return { spans: [], warning: null };

  const joints = greedyJoints(segStart, segEnd, courseOffsets, panelWidth, mode, staggered);
  if (joints != null) {
    const rel = joints.map(j => j - segStart);
    const merged = mergeShortSpans(toSpans(segLength, rel), minPanelWidth, panelWidth);
    return {
      spans: merged.map(s => ({ start: segStart + s.start, end: segStart + s.end })),
      warning: null
    };
  }

  // Fallback: no hay combinación de studs que cubra el tramo — reparto ideal sin respaldo
  // (placas de panelWidth desde el ancla, remanente al final), marcado para revisión manual.
  const n0 = Math.max(1, Math.ceil(segLength / panelWidth));
  const rel = [];
  for (let k = 1; k < n0; k++) rel.push(Math.min(k * panelWidth, segLength - EPS));
  const merged = mergeShortSpans(toSpans(segLength, rel), minPanelWidth, panelWidth);
  return {
    spans: merged.map(s => ({ start: segStart + s.start, end: segStart + s.end })),
    warning: `tramo [${Math.round(segStart)}, ${Math.round(segEnd)}] sin junta con respaldo válido — revisar manualmente`
  };
}

/**
 * Centra una o varias placas COMPLETAS sobre el ancho de un vano (`opening`), con al menos
 * MIN_EDGE_MARGIN de margen libre a cada lado. Enumera pares de bordes candidatos (left ≤
 * oMin-100, right ≥ oMax+100, ambos con respaldo de curso completo) y llena el interior con
 * greedy sobre `interiorCandidates` (studs que cubren las franjas sólidas sobre/bajo el vacío).
 * Elige la combinación factible con MENOS placas y, a igualdad, mejor centrado sobre el vano.
 * Devuelve el "footprint" que sirve de ancla a los corredores vecinos.
 */
function computeVanoFootprint(opening, edgeCandidates, interiorCandidates, panelWidth, minPanelWidth, wallLength) {
  const vanoWidth = opening.oMax - opening.oMin;
  const center = (opening.oMin + opening.oMax) / 2;
  // Vano pegado (o casi) a un extremo del muro: el margen de 100mm no existe físicamente en ese
  // lado — la placa ancla en el borde del muro (respaldada por el montante de esquina).
  const touchesLeft = opening.oMin <= MIN_EDGE_MARGIN + EPS;
  const touchesRight = wallLength - opening.oMax <= MIN_EDGE_MARGIN + EPS;
  const leftBound = touchesLeft ? 0 : opening.oMin - MIN_EDGE_MARGIN;
  const rightBound = touchesRight ? wallLength : opening.oMax + MIN_EDGE_MARGIN;
  // Ancho máximo razonable del footprint: acota los pares a enumerar (los bordes muy lejos del
  // vano no son "centrar el vano", son otra modulación).
  const maxSpan = (Math.ceil((vanoWidth + 2 * MIN_EDGE_MARGIN) / panelWidth) + 2) * panelWidth;

  const lefts = touchesLeft ? [0]
    : edgeCandidates.filter(c => c <= leftBound + EPS && center - c <= maxSpan).sort((a, b) => b - a).slice(0, 6);
  const rights = touchesRight ? [wallLength]
    : edgeCandidates.filter(c => c >= rightBound - EPS && c - center <= maxSpan).sort((a, b) => a - b).slice(0, 6);

  // Juntas interiores no pueden caer pegadas al borde del vano (misma regla de margen).
  const interiorOk = interiorCandidates.filter(c =>
    !(c > opening.oMin - MIN_EDGE_MARGIN - EPS && c < opening.oMin + MIN_EDGE_MARGIN + EPS) &&
    !(c > opening.oMax - MIN_EDGE_MARGIN - EPS && c < opening.oMax + MIN_EDGE_MARGIN + EPS)
  );

  let best = null;
  for (const left of lefts) {
    for (const right of rights) {
      if (right - left > maxSpan + EPS) continue;
      const joints = greedyJoints(left, right, interiorOk, panelWidth, 'both', false);
      if (joints == null) continue;
      const spans = toSpans(right - left, joints.map(j => j - left)).map(s => ({ start: left + s.start, end: left + s.end }));
      if (!spans.every(s => s.end - s.start <= panelWidth + EPS && s.end - s.start > EPS)) continue;
      const score = { count: spans.length, offCenter: Math.abs((left + right) / 2 - center) };
      if (!best || score.count < best.score.count ||
          (score.count === best.score.count && score.offCenter < best.score.offCenter - EPS)) {
        best = { left, right, spans, score };
      }
    }
  }
  if (best) {
    return { left: best.left, right: best.right, spans: mergeShortSpans(best.spans, minPanelWidth, panelWidth), warning: null };
  }

  // Fallback: geometría ideal centrada sin respaldo, clamp a [0, wallLength], para revisión.
  const n0 = Math.max(1, Math.ceil((vanoWidth + 2 * MIN_EDGE_MARGIN) / panelWidth));
  let idealLeft = Math.max(0, center - (n0 * panelWidth) / 2);
  let idealRight = Math.min(wallLength, idealLeft + n0 * panelWidth);
  idealLeft = Math.max(0, idealRight - n0 * panelWidth);
  const step = (idealRight - idealLeft) / n0;
  const rawSpans = [];
  for (let k = 0; k < n0; k++) rawSpans.push({ start: idealLeft + k * step, end: idealLeft + (k + 1) * step });
  const spans = mergeShortSpans(rawSpans, minPanelWidth, panelWidth);
  return {
    left: idealLeft, right: idealRight, spans,
    warning: `vano [${Math.round(opening.oMin)}, ${Math.round(opening.oMax)}] sin junta con respaldo válido para centrar la placa — revisar manualmente`
  };
}

/**
 * Calcula el despiece de placas OSB de un muro.
 *
 * @param wall    elemento muro (con openings[])
 * @param grid    model.grid
 * @param paramsMap  buildParamsMap(model.projectParams)
 * @param elementsById  buildElementsById(model.elements)
 * @param studs   wall.studs ya calculado (computeStudLayout) — requerido, ver nota de alcance arriba
 * @param config  { panelWidth (mm; default 1220), panelHeight (mm; default 2440),
 *                  minPanelWidth (mm; default 200, piso duro 200),
 *                  stagger (bool; default true) }
 * @returns { resolved, length, wallHeight, panelHeight, numCourses,
 *            courses: [{ zMin, zMax, height, panels: [{start,end,width}] }],
 *            panels: [...todas las placas de todos los cursos, plano — compatibilidad],
 *            warnings: string[] }
 */
/**
 * Cotas [z0=0, z1, ..., zn=wallHeight] de las hiladas de placa, apilando PLACAS COMPLETAS desde
 * abajo y dejando el remanente ARRIBA. Así la junta horizontal cae siempre en un múltiplo de
 * `panelHeight` (2440 constante en todos los muros) y solo la hilada superior se corta en altura.
 *
 * Si el remanente es menor a `minCourseHeight` la tira de arriba queda impracticable: se emite
 * warning y, con `enforceMinCourse`, se BAJA la última junta a `wallHeight - minCourseHeight`
 * (la hilada de abajo se corta un poco para que la de arriba tenga altura fijable).
 *
 * @returns { bounds: number[], warning: string|null }
 */
export function computeCourseBreaks(wallHeight, panelHeight, minCourseHeight = MIN_COURSE_HEIGHT, enforceMinCourse = false) {
  const result = (bounds, warning = null) => ({
    bounds,
    jointZs: bounds.slice(1, -1),
    warning
  });
  if (!(wallHeight > panelHeight + EPS)) return result([0, wallHeight]);

  const full = Math.floor(wallHeight / panelHeight);
  const remainder = wallHeight - full * panelHeight;
  const bounds = [];
  for (let i = 0; i < full; i++) bounds.push(i * panelHeight);

  if (remainder <= EPS) { // altura múltiplo exacto: la última hilada completa cierra en el cielo
    bounds.push(wallHeight);
    return result(bounds);
  }

  let lastBreak = full * panelHeight;
  let warning = null;
  if (remainder < minCourseHeight) {
    warning = enforceMinCourse
      ? `hilada superior de ${Math.round(remainder)}mm (< ${Math.round(minCourseHeight)}mm): junta bajada a z=${Math.round(wallHeight - minCourseHeight)}mm`
      : `hilada superior de ${Math.round(remainder)}mm (< ${Math.round(minCourseHeight)}mm): revisar respaldo de la junta o activar el ajuste de junta`;
    if (enforceMinCourse) lastBreak = wallHeight - minCourseHeight;
  }
  bounds.push(lastBreak, wallHeight);
  return result(bounds, warning);
}

export function computeOsbPanelLayout(wall, grid, paramsMap = {}, elementsById = {}, studs = [], config = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return { resolved: false, length: null, wallHeight: null, courses: [], panels: [], warnings: [] };

  const runAxis = isWallXRun(wall) ? 'x' : 'y';
  const worldMin = runAxis === 'x' ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
  const worldMax = runAxis === 'x' ? Math.max(geo.p1.x, geo.p2.x) : Math.max(geo.p1.y, geo.p2.y);
  const length = worldMax - worldMin;

  const bottomLevel = grid.zLevels.find(l => l.id === wall.bottomZ);
  const topLevel = grid.zLevels.find(l => l.id === wall.topZ);
  const wallHeight = (bottomLevel && topLevel) ? topLevel.elevation - bottomLevel.elevation : null;

  if (!(length > EPS) || !(wallHeight > 0)) {
    return { resolved: false, length: length > 0 ? length : null, wallHeight: wallHeight > 0 ? wallHeight : null, courses: [], panels: [], warnings: [] };
  }
  if (!studs || studs.length === 0) {
    return { resolved: false, length, wallHeight, courses: [], panels: [], warnings: ['el muro no tiene modulación de metalcon (wall.studs) — generarla primero'] };
  }

  const panelWidth = resolveValue(config.panelWidth ?? 1220, paramsMap, elementsById);
  const panelHeight = resolveValue(config.panelHeight ?? 2440, paramsMap, elementsById);
  const minPanelWidth = Math.max(200, resolveValue(config.minPanelWidth ?? 200, paramsMap, elementsById));
  const stagger = config.stagger !== false;

  if (!(panelWidth > minPanelWidth)) {
    return { resolved: false, length, wallHeight, courses: [], panels: [], warnings: ['panelWidth debe ser mayor que minPanelWidth'] };
  }
  if (!(panelHeight > 0)) {
    return { resolved: false, length, wallHeight, courses: [], panels: [], warnings: ['panelHeight debe ser mayor que 0'] };
  }
  if (panelWidth < 2 * MIN_EDGE_MARGIN) {
    return { resolved: false, length, wallHeight, courses: [], panels: [], warnings: [`panelWidth debe ser mayor que 2x el margen mínimo (${2 * MIN_EDGE_MARGIN}mm)`] };
  }

  // --- vanos: mismo intervalo [oMin,oMax]+[sillRel,topRel] que computeStudLayout. El VACÍO real
  // (lo que de verdad no tiene muro) es solo [sillRel,topRel] en z — arriba del dintel y bajo el
  // antepecho hay muro sólido que sí necesita placa (centrada, ver computeVanoFootprint). ---
  const openings = (wall.openings || [])
    .filter(o => o.axisType === runAxis)
    .map(o => {
      const w = resolveValue(o.width, paramsMap, elementsById);
      const h = resolveValue(o.height, paramsMap, elementsById);
      const sill = o.type === 'window' ? resolveValue(o.sillHeight ?? 0, paramsMap, elementsById) : 0;
      const centerOffset = o.position - worldMin;
      return {
        oMin: clamp(centerOffset - w / 2, 0, length),
        oMax: clamp(centerOffset + w / 2, 0, length),
        sillRel: clamp(sill, 0, wallHeight),
        topRel: clamp(sill + h, 0, wallHeight)
      };
    })
    .filter(s => s.oMax - s.oMin > EPS)
    .sort((a, b) => a.oMin - b.oMin);

  // --- cursos: hiladas completas desde abajo, remanente arriba (ver computeCourseBreaks). ---
  const minCourseHeight = Math.max(0, resolveValue(config.minCourseHeight ?? MIN_COURSE_HEIGHT, paramsMap, elementsById));
  const { bounds, warning: courseWarning } = computeCourseBreaks(
    wallHeight, panelHeight, minCourseHeight, config.enforceMinCourse === true
  );
  const numCourses = bounds.length - 1;

  const round1 = (v) => Math.round(v * 10) / 10;
  const courses = [];
  const warnings = [];
  if (courseWarning) warnings.push(courseWarning);

  // Mapa offset → lista de rangos [zMin,zMax] de studs a ese offset. Un offset "cubre" una
  // franja si alguno de sus studs la contiene completa (el cripple bajo antepecho y el
  // crippleTop sobre dintel son studs distintos en el mismo offset).
  const studsByOffset = new Map();
  for (const s of studs.filter((piece) => piece.role !== 'nogging')) {
    if (!studsByOffset.has(s.offset)) studsByOffset.set(s.offset, []);
    studsByOffset.get(s.offset).push([s.zMin, s.zMax]);
  }
  const offsetsCoveringStrips = (strips) => [...studsByOffset.entries()]
    .filter(([, ranges]) => strips.every(([lo, hi]) => ranges.some(([a, b]) => a <= lo + EPS && b >= hi - EPS)))
    .map(([offset]) => offset);

  for (let c = 0; c < numCourses; c++) {
    const zMin = bounds[c];
    const zMax = bounds[c + 1];
    const staggered = stagger && c % 2 === 1; // cursos impares invierten el anclaje → juntas escalonadas vs. el curso anterior

    // Respaldo válido para juntas de curso completo (corredores y bordes de footprint): pie
    // derecho cuyo rango vertical CONTIENE el rango del curso.
    const courseOffsets = offsetsCoveringStrips([[zMin, zMax]]);

    // Clasificar cada vano para ESTE curso según cómo su VACÍO real [sillRel,topRel] intersecta
    // el rango vertical del curso:
    //   - sin intersección → columna sólida (antepecho/dintel completo en este curso): placa
    //     centrada normal, sin recorte.
    //   - intersección PARCIAL → placa centrada que CUBRE el vano, con el vacío recortado
    //     (`cutouts`) — así se hace en obra: se coloca la placa completa y se recorta el hueco,
    //     evitando juntas en las esquinas del vano. Las franjas sólidas que quedan (bajo el
    //     antepecho / sobre el dintel dentro del curso) son parte de la MISMA pieza.
    //   - intersección TOTAL (el vacío cubre todo el alto del curso) → columna excluida, como un
    //     hueco pasante (no hay material que placar en este curso).
    const obstacles = [];
    for (const o of openings) {
      const voidLo = Math.max(o.sillRel, zMin);
      const voidHi = Math.min(o.topRel, zMax);
      const hasVoid = voidHi - voidLo > EPS;
      const fullVoid = hasVoid && voidLo <= zMin + EPS && voidHi >= zMax - EPS;

      if (fullVoid) {
        obstacles.push({ left: o.oMin, right: o.oMax, panels: [] });
        continue;
      }

      const strips = [];
      if (hasVoid) {
        // La exigencia de cobertura se recorta COVER_SLACK en el lado que toca el vacío — ahí
        // está el track (antepecho/dintel), que completa el respaldo. Si la franja queda
        // trivial tras el recorte, el track solo la respalda y no se exige stud.
        if (voidLo - COVER_SLACK - zMin > EPS) strips.push([zMin, voidLo - COVER_SLACK]);
        if (zMax - (voidHi + COVER_SLACK) > EPS) strips.push([voidHi + COVER_SLACK, zMax]);
      } else {
        strips.push([zMin, zMax]);
      }
      // Juntas interiores del footprint caen sobre el vano → su respaldo debe cubrir TODAS las
      // franjas sólidas de esta columna (cripple abajo + crippleTop arriba en el mismo offset).
      const interiorCandidates = offsetsCoveringStrips(strips);

      const fp = computeVanoFootprint(o, courseOffsets, interiorCandidates, panelWidth, minPanelWidth, length);
      if (fp.warning) warnings.push(`curso ${c + 1}: ${fp.warning}`);

      const panels = fp.spans.map(s => {
        const overlap = Math.min(s.end, o.oMax) - Math.max(s.start, o.oMin);
        if (hasVoid && overlap > EPS) {
          return {
            ...s,
            cutouts: [{
              start: Math.max(s.start, o.oMin), end: Math.min(s.end, o.oMax),
              zMin: voidLo, zMax: voidHi
            }]
          };
        }
        return s;
      });
      obstacles.push({ left: fp.left, right: fp.right, panels });
    }
    obstacles.sort((a, b) => a.left - b.left);

    const panels = [];
    for (const ob of obstacles) for (const s of ob.panels) panels.push(s);

    // Corredores: entre obstáculos consecutivos, y desde/hacia los bordes del muro. Se ancla en
    // el/los obstáculo(s) vecino(s); si no hay ninguno en todo el curso, se ancla en el extremo
    // "start" del muro (offset 0) — pedido explícito de Fran para el caso sin vanos.
    let cursor = 0;
    for (let i = 0; i <= obstacles.length; i++) {
      const segStart = cursor;
      const segEnd = i < obstacles.length ? obstacles[i].left : length;
      const hasLeftAnchor = i > 0;
      const hasRightAnchor = i < obstacles.length;
      const mode = hasLeftAnchor && hasRightAnchor ? 'both' : hasLeftAnchor ? 'left' : hasRightAnchor ? 'right' : 'left';

      if (segEnd - segStart > EPS) {
        const { spans, warning } = modulateCorredor(segStart, segEnd, courseOffsets, panelWidth, minPanelWidth, mode, staggered);
        for (const s of spans) panels.push(s);
        if (warning) warnings.push(`curso ${c + 1}: ${warning}`);
      }
      cursor = i < obstacles.length ? obstacles[i].right : cursor;
    }

    panels.sort((a, b) => a.start - b.start);
    const roundedPanels = panels.map(s => ({
      start: round1(s.start), end: round1(s.end), width: round1(s.end - s.start),
      ...(s.cutouts ? {
        cutouts: s.cutouts.map(ct => ({
          start: round1(ct.start), end: round1(ct.end), zMin: round1(ct.zMin), zMax: round1(ct.zMax)
        }))
      } : {})
    }));
    courses.push({ zMin: round1(zMin), zMax: round1(zMax), height: round1(zMax - zMin), panels: roundedPanels });
  }

  const panels = courses.flatMap(c => c.panels);
  // Compatibilidad transitoria del shape: una regeneración OSB limpia el subproducto heredado.
  // La fuente vigente de cadenetas es wall.studs (role:'nogging'), nunca este resultado.
  return {
    resolved: true,
    length,
    wallHeight,
    panelHeight,
    numCourses,
    courses,
    panels,
    noggings: [],
    warnings
  };
}

// ---- código de pieza + tabla de despiece ------------------------------------------------------
// Antes cada placa mostraba su ANCHO como etiqueta en el DXF — poco legible con muchas placas y
// no distingue placas del mismo ancho en distintas posiciones. Ahora cada placa recibe un código
// correlativo (P1, P2, ...) y el detalle (ancho/alto/cortes) va en una tabla de despiece aparte,
// debajo de la elevación — ver core/exportFramingDxf.js:drawTable y core/exportOsbDxf.js.

/** Código correlativo por placa (P1, P2, ...), recorriendo curso por curso (de abajo hacia
 * arriba, según wall.osbCourses) y dentro de cada curso de izquierda a derecha — mismo orden en
 * que se dibuja/lista. Retorna un Map placa(objeto) → código, para usar tanto al dibujar la
 * etiqueta en el DXF como al construir la tabla (mismo código en ambos lados, siempre). */
export function assignOsbPieceCodes(osbCourses) {
  const codes = new Map();
  let n = 1;
  for (const course of osbCourses || []) {
    for (const p of course.panels) codes.set(p, `P${n++}`);
  }
  return codes;
}

/** ¿El despiece trae asignada la placa madre de cada pieza (`sourcePanel`, ver
 * core/osbNesting.js)? Si sí, la tabla del DXF suma una columna PLACA; si no, mantiene el formato
 * de 5 columnas de siempre. Se decide por muro: mientras Fran no corra la optimización, nada
 * cambia en el plano. */
export function hasNestingSource(osbCourses) {
  return (osbCourses || []).some(c => c.panels.some(p => p.sourcePanel));
}

/** Filas [código, curso, ancho, alto, corte] para la tabla de despiece de un muro. `corte`
 * describe cada cutout de la placa (vacío de vano recortado de ella — ver
 * computeOsbPanelLayout) como "anchoxalto @z=zMin"; "-" si la placa no tiene cutout. Más de un
 * cutout en la misma placa (raro) se listan separados por "; ". */
export function buildOsbPieceScheduleRows(osbCourses, osbNoggings = []) {
  const codes = assignOsbPieceCodes(osbCourses);
  const nested = hasNestingSource(osbCourses);
  const rows = [];
  (osbCourses || []).forEach((course, ci) => {
    for (const p of course.panels) {
      const width = Math.round(p.end - p.start);
      const height = Math.round(course.zMax - course.zMin);
      const cuts = (p.cutouts || []).map(ct =>
        `${Math.round(ct.end - ct.start)}x${Math.round(ct.zMax - ct.zMin)} @z=${Math.round(ct.zMin)}`
      );
      const row = [codes.get(p), String(ci + 1), String(width), String(height), cuts.length ? cuts.join('; ') : '-'];
      if (nested) row.splice(1, 0, p.sourcePanel || '-');
      rows.push(row);
    }
  });

  // Cadenetas de la junta horizontal: sin ellas el despiece no es construible (manual LP).
  // Se listan al final, con el índice de las dos hiladas que unen ("1-2").
  (osbNoggings || []).forEach((n, i) => {
    const below = (osbCourses || []).findIndex(c => Math.abs(c.zMax - n.z) < 1);
    const label = below >= 0 ? `${below + 1}-${below + 2}` : '-';
    const row = [`C${i + 1}`, label, String(Math.round(n.oMax - n.oMin)), '-', `CADENETA @z=${Math.round(n.z)}`];
    if (nested) row.splice(1, 0, '-'); // la cadeneta es perfil metálico, no sale de una placa OSB
    rows.push(row);
  });
  return rows;
}
