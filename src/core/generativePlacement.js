// core/generativePlacement.js
// ★ Colocación generativa por reglas (Tanda 4, ítem 4; generalizada en Tanda 5).
//
// Genera candidatos a pilar (axisXId/axisYId reales de la grilla) a partir de un
// "disparador" (trigger) aplicado sobre los muros existentes, con filtros opcionales
// de sección de librería y dirección — así una misma regla se puede acotar sin escribir
// código nuevo (ej. "solo intersecciones de muros de la sección Muro 15cm").
//
// Trabaja siempre en coordenadas resueltas (resolveWallGeometry ya entiende ejes O
// referencias a otro elemento) y solo emite candidatos que caen sobre un eje X y un eje Y
// realmente definidos en la grilla (con tolerancia) — un pilar necesita axisXId/axisYId
// válidos, no coordenadas sueltas.
//
// Limitación conocida (sin resolver esta sesión): no hay disparador de "cada N mm a lo
// largo del muro" (spacing) porque un pilar intermedio así casi nunca cae sobre un eje de
// grilla existente — se necesitaría primero decidir si se crean ejes auxiliares
// automáticamente o si se permite que un pilar tenga una coordenada libre (no solo axisXId/
// axisYId). Ver nota en contexto del proyecto.

import { resolveWallGeometry, resolveBeamGeometry, isWallXRun } from './elementGeometry.js';

/** Disparadores disponibles (antes "PLACEMENT_RULES"). */
export const TRIGGERS = [
  {
    id: 'intersection',
    label: 'En cada intersección (cruce de dos muros)',
    description: 'Coloca un pilar en todo cruce de grilla donde se junten un muro que corre en X y uno que corre en Y (esquinas, T y cruces). No marca puntos donde un muro solo pasa de largo.',
    supportsDirectionFilter: false
  },
  {
    id: 'endpoint',
    label: 'En cada extremo de muro',
    description: 'Coloca un pilar en el inicio y el término de cada muro, siempre que ese punto coincida con un eje X y un eje Y definidos en la grilla.',
    supportsDirectionFilter: true
  },
  {
    id: 'spacing',
    label: 'Cada N mm a lo largo de un elemento (crea ejes auxiliares)',
    description: 'Coloca pilares intermedios a distancia fija a lo largo de cada muro/viga/fundación de origen. Los puntos que no caen sobre un eje existente generan automáticamente un eje auxiliar nuevo (type: "aux-generated").',
    supportsDirectionFilter: false,
    supportsSourceType: true,
    supportsSpacing: true
  }
];

/** @deprecated usar TRIGGERS — se mantiene el nombre viejo para no romper imports existentes. */
export const PLACEMENT_RULES = TRIGGERS;

function findMatchingAxis(axes, position, tolerance) {
  return axes.find(a => Math.abs(a.position - position) <= tolerance) || null;
}

/** Candidatos únicos {xAxis, yAxis} donde un muro X y un muro Y se cruzan. */
function wallIntersectionCandidates(walls, grid, paramsMap, elementsById, tolerance) {
  const geos = walls
    .map(w => ({ isX: isWallXRun(w), geo: resolveWallGeometry(w, grid, paramsMap, elementsById) }))
    .filter(g => g.geo);

  const out = [];
  for (const xAxis of grid.xAxes) {
    for (const yAxis of grid.yAxes) {
      let xTouch = false, yTouch = false;
      for (const { isX, geo } of geos) {
        if (isX) {
          if (Math.abs(geo.p1.y - yAxis.position) > tolerance) continue;
          const xMin = Math.min(geo.p1.x, geo.p2.x), xMax = Math.max(geo.p1.x, geo.p2.x);
          if (xAxis.position >= xMin - tolerance && xAxis.position <= xMax + tolerance) xTouch = true;
        } else {
          if (Math.abs(geo.p1.x - xAxis.position) > tolerance) continue;
          const yMin = Math.min(geo.p1.y, geo.p2.y), yMax = Math.max(geo.p1.y, geo.p2.y);
          if (yAxis.position >= yMin - tolerance && yAxis.position <= yMax + tolerance) yTouch = true;
        }
        if (xTouch && yTouch) break;
      }
      if (xTouch && yTouch) out.push({ xAxis, yAxis });
    }
  }
  return out;
}

/** Candidatos en cada extremo de cada muro, snapeados al eje X/Y más cercano de la grilla. */
function wallEndpointCandidates(walls, grid, paramsMap, elementsById, tolerance) {
  const seen = new Set();
  const out = [];
  for (const wall of walls) {
    const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
    if (!geo) continue;
    for (const p of [geo.p1, geo.p2]) {
      const xAxis = findMatchingAxis(grid.xAxes, p.x, tolerance);
      const yAxis = findMatchingAxis(grid.yAxes, p.y, tolerance);
      if (!xAxis || !yAxis) continue; // sin eje real coincidente: no se puede crear el pilar
      const key = `${xAxis.id}:${yAxis.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ xAxis, yAxis });
    }
  }
  return out;
}

/** Genera un id de eje temporal (string) — distinto del generador numérico del store,
 *  pero funciona igual como opaco: los elementos y la grilla lo referencian tal cual. */
let _tempAxisCounter = 1;
function tempAxisId() { return `gen_${Date.now()}_${_tempAxisCounter++}`; }

/** Busca un eje real (grid.xAxes/yAxes) o uno ya pendiente-de-crear dentro de tolerancia;
 *  si no hay ninguno, crea uno pendiente nuevo y lo registra en `pending` para reusarlo
 *  si otro punto de la misma pasada cae en la misma posición. */
function resolveOrCreateAxis(realAxes, pending, position, tolerance, prefix, axisType) {
  const real = realAxes.find(a => Math.abs(a.position - position) <= tolerance);
  if (real) return real;
  const existing = pending.find(a => Math.abs(a.position - position) <= tolerance);
  if (existing) return existing;
  const created = { id: tempAxisId(), position, label: `${prefix}${pending.length + 1}`, type: 'aux-generated', axis: axisType, isNew: true };
  pending.push(created);
  return created;
}

const SOURCE_GEOMETRY = {
  wall: resolveWallGeometry,
  beam: resolveBeamGeometry,
  foundation: resolveBeamGeometry // fundación reusa los mismos campos fixedAxisId/start/end que viga
};

/** Posiciones intermedias (0 < t < length) según el modo de arranque. */
function spacingPositions(length, spacing, startMode, tolerance) {
  const ts = [];
  if (startMode === 'center') {
    const half = length / 2;
    ts.push(half);
    for (let k = 1; half - k * spacing > tolerance; k++) {
      ts.push(half - k * spacing);
      if (half + k * spacing < length - tolerance) ts.push(half + k * spacing);
    }
  } else if (startMode === 'symmetric') {
    const half = length / 2;
    for (let d = spacing; d < half - tolerance; d += spacing) {
      if (length - d - d > tolerance) { ts.push(d); ts.push(length - d); }
      else ts.push(d); // se juntan al medio: un solo pilar central
    }
  } else { // 'start'
    for (let d = spacing; d < length - tolerance; d += spacing) ts.push(d);
  }
  return ts;
}

/** Candidatos de la regla de spacing sobre muros/vigas/fundaciones de origen. */
function spacingCandidates(sourceElements, grid, paramsMap, elementsById, tolerance, spacing, startMode) {
  const pendingX = [];
  const pendingY = [];
  const out = [];
  for (const el of sourceElements) {
    const resolveGeo = SOURCE_GEOMETRY[el.type];
    const geo = resolveGeo ? resolveGeo(el, grid, paramsMap, elementsById) : null;
    if (!geo) continue;
    const dx = geo.p2.x - geo.p1.x, dy = geo.p2.y - geo.p1.y;
    const length = Math.hypot(dx, dy);
    if (length <= tolerance) continue;
    const ux = dx / length, uy = dy / length;

    for (const t of spacingPositions(length, spacing, startMode, tolerance)) {
      const point = { x: geo.p1.x + ux * t, y: geo.p1.y + uy * t };
      const xAxis = resolveOrCreateAxis(grid.xAxes, pendingX, point.x, tolerance, 'aux-x-', 'x');
      const yAxis = resolveOrCreateAxis(grid.yAxes, pendingY, point.y, tolerance, 'aux-y-', 'y');
      out.push({ xAxis, yAxis });
    }
  }
  return { candidates: out, axesToCreate: [...pendingX, ...pendingY] };
}

/**
 * Devuelve candidatos {xAxis, yAxis, exists} para la configuración dada.
 *
 * @param {object} config
 * @param {'intersection'|'endpoint'|'spacing'} config.trigger
 * @param {number} [config.tolerance=1] - mm de tolerancia al comparar contra ejes de grilla.
 * @param {string|null} [config.sectionFilter=null] - libraryId de la sección del elemento
 *   de origen; si se da, solo se consideran elementos de esa sección.
 * @param {'x'|'y'|'both'} [config.directionFilter='both'] - solo aplica al trigger 'endpoint'.
 * @param {'wall'|'beam'|'foundation'} [config.sourceType='wall'] - solo aplica a 'spacing':
 *   tipo de elemento a lo largo del cual espaciar los pilares.
 * @param {number} [config.spacing] - mm entre pilares (ya resuelto, no fórmula) — solo 'spacing'.
 * @param {'start'|'center'|'symmetric'} [config.startMode='start'] - solo 'spacing'.
 * @param {string} config.bottomZ, config.topZ - nivel del pilar a crear, para chequear duplicados.
 * @returns {{candidates: Array<{xAxis, yAxis, exists:boolean}>, axesToCreate: Array}}
 *   axesToCreate viene vacío salvo en 'spacing': son los ejes auxiliares nuevos que hay
 *   que crear en la grilla ANTES de insertar los pilares (mismo id ya asignado en xAxis/yAxis).
 */
export function computeGenerativeCandidates(config, model, paramsMap, elementsById) {
  const {
    trigger, tolerance = 1, sectionFilter = null, directionFilter = 'both',
    sourceType = 'wall', spacing, startMode = 'start', bottomZ, topZ
  } = config;
  const { elements, grid } = model;

  let candidates, axesToCreate = [];

  if (trigger === 'spacing') {
    let sourceElements = elements.filter(el => el.type === sourceType);
    if (sectionFilter) sourceElements = sourceElements.filter(el => el.libraryId === sectionFilter);
    const result = spacingCandidates(sourceElements, grid, paramsMap, elementsById, tolerance, spacing, startMode);
    candidates = result.candidates;
    axesToCreate = result.axesToCreate;
  } else {
    let walls = elements.filter(el => el.type === 'wall');
    if (sectionFilter) walls = walls.filter(w => w.libraryId === sectionFilter);
    if (trigger === 'endpoint') {
      const filtered = directionFilter === 'both'
        ? walls
        : walls.filter(w => isWallXRun(w) === (directionFilter === 'x'));
      candidates = wallEndpointCandidates(filtered, grid, paramsMap, elementsById, tolerance);
    } else {
      candidates = wallIntersectionCandidates(walls, grid, paramsMap, elementsById, tolerance);
    }
  }

  const existingColumns = elements.filter(el => el.type === 'column');
  return {
    candidates: candidates.map(({ xAxis, yAxis }) => ({
      xAxis, yAxis,
      exists: !xAxis.isNew && !yAxis.isNew && existingColumns.some(c =>
        c.axisXId === xAxis.id && c.axisYId === yAxis.id && c.bottomZ === bottomZ && c.topZ === topZ)
    })),
    axesToCreate
  };
}
