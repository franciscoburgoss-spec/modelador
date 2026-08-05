import { buildElementsById, isElementRef, resolveAxisRef } from './elementReferences.js';
import { isFormula, resolveValue } from './projectParams.js';
import { resolveFoundation } from './foundationGeometry.js';
import { guardExport } from './exportPolicy.js';
import {
  AGNOSTIC_GEOMETRY_AUDIT_FILENAME,
  AGNOSTIC_GEOMETRY_AUDIT_MIME,
  assertAgnosticGeometryAuditPass,
  auditAgnosticGeometry,
  serializeAgnosticGeometryAudit
} from './agnosticGeometryAudit.js';

export const AGNOSTIC_GEOMETRY_SCHEMA = 'agnostic-geometry-v1.0';
export const AGNOSTIC_GEOMETRY_FILENAME = 'geometria-agnostica.json';
export const AGNOSTIC_GEOMETRY_MIME = 'application/json;charset=utf-8';

const EPSILON = 1e-7;
const SUPPORTED_ELEMENT_TYPES = new Set(['wall', 'column', 'beam', 'foundation']);
const ELEMENT_TYPE_ORDER = new Map([
  ['wall', 0],
  ['column', 1],
  ['beam', 2],
  ['foundation', 3]
]);

export class AgnosticGeometryError extends Error {
  constructor(code, message, { path = '$', ids = [] } = {}) {
    super(message);
    this.name = 'AgnosticGeometryError';
    this.code = code;
    this.path = path;
    this.ids = [...new Set(ids)];
  }
}

function fail(code, message, path, ids = []) {
  throw new AgnosticGeometryError(code, message, { path, ids });
}

function idKey(id) {
  return `${typeof id}:${JSON.stringify(id)}`;
}

function compareIds(a, b) {
  const left = idKey(a.id);
  const right = idKey(b.id);
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareElements(a, b) {
  const typeOrder = ELEMENT_TYPE_ORDER.get(a.type) - ELEMENT_TYPE_ORDER.get(b.type);
  return typeOrder || compareIds(a, b);
}

function compareRoles(a, b) {
  return a.role < b.role ? -1 : a.role > b.role ? 1 : 0;
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    fail('INVALID_COLLECTION', `${path} debe ser un arreglo.`, path);
  }
  return value;
}

function requireId(value, path) {
  if (value === null || value === undefined || value === '') {
    fail('MISSING_ID', `Falta el identificador en ${path}.`, path);
  }
  if (!['string', 'number'].includes(typeof value)) {
    fail('INVALID_ID', `El identificador de ${path} debe ser string o number.`, path);
  }
  return value;
}

function registerIds(model) {
  const seen = new Map();
  const register = (id, path) => {
    requireId(id, path);
    const key = idKey(id);
    const previous = seen.get(key);
    if (previous) {
      fail(
        'DUPLICATE_ID',
        `El ID ${String(id)} aparece en ${previous} y ${path}.`,
        path,
        [id]
      );
    }
    seen.set(key, path);
  };

  for (const [collection, entries] of [
    ['grid.xAxes', model.grid.xAxes],
    ['grid.yAxes', model.grid.yAxes],
    ['grid.zLevels', model.grid.zLevels],
    ['elements', model.elements],
    ['roofSystems', model.roofSystems],
    ['roofPlanes', model.roofPlanes]
  ]) {
    entries.forEach((entry, index) => register(entry?.id, `${collection}[${index}].id`));
  }
  model.elements.forEach((element, elementIndex) => {
    if (element?.type !== 'wall') return;
    requireArray(element.openings ?? [], `elements[${elementIndex}].openings`)
      .forEach((opening, openingIndex) => register(
        opening?.id,
        `elements[${elementIndex}].openings[${openingIndex}].id`
      ));
  });
}

function buildStrictParamsMap(projectParams) {
  const map = Object.create(null);
  const names = new Set();
  for (const [index, parameter] of projectParams.entries()) {
    if (!parameter || typeof parameter.name !== 'string' || parameter.name === '') continue;
    if (names.has(parameter.name)) {
      fail(
        'DUPLICATE_ID',
        `El parámetro ${parameter.name} está duplicado.`,
        `projectParams[${index}].name`,
        [parameter.name]
      );
    }
    names.add(parameter.name);
    const value = Number(parameter.value);
    map[parameter.name] = Number.isFinite(value) ? value : NaN;
  }
  return map;
}

function numberValue(raw, context, path, ids, { optional = false, fallback = 0 } = {}) {
  if ((raw === null || raw === undefined || raw === '') && optional) return fallback;
  if (raw === null || raw === undefined || raw === '') {
    fail('UNRESOLVED_REFERENCE', `Falta un valor geométrico en ${path}.`, path, ids);
  }
  const value = resolveValue(raw, context.paramsMap, context.elementsById);
  if (!Number.isFinite(value)) {
    const code = isFormula(raw) ? 'UNRESOLVED_REFERENCE' : 'NON_FINITE_NUMBER';
    fail(code, `No se pudo resolver un número finito en ${path}.`, path, ids);
  }
  return value;
}

function positiveValue(raw, context, path, ids) {
  const value = numberValue(raw, context, path, ids);
  if (!(value > 0)) {
    fail('INVALID_DIMENSION', `${path} debe ser mayor que cero.`, path, ids);
  }
  return value;
}

function nonNegativeValue(raw, context, path, ids, options = {}) {
  const value = numberValue(raw, context, path, ids, options);
  if (value < 0) {
    fail('INVALID_DIMENSION', `${path} no puede ser negativo.`, path, ids);
  }
  return value;
}

function axisValue(raw, axis, context, path, ids) {
  if (isElementRef(raw) && !['min', 'max', 'center'].includes(raw.edge)) {
    fail('UNRESOLVED_REFERENCE', `El borde de referencia de ${path} no es válido.`, path, [
      ...ids,
      raw.refElementId
    ]);
  }
  const value = resolveAxisRef(
    raw,
    axis,
    context.model.grid,
    context.elementsById,
    context.paramsMap
  );
  if (!Number.isFinite(value)) {
    const referencedId = isElementRef(raw) ? raw.refElementId : raw;
    fail(
      'UNRESOLVED_REFERENCE',
      `No se pudo resolver la referencia ${String(referencedId)} de ${path}.`,
      path,
      [...ids, referencedId].filter((id) => id !== null && id !== undefined)
    );
  }
  return value;
}

function levelValue(raw, context, path, ids) {
  const level = context.model.grid.zLevels.find(({ id }) => id === raw);
  if (!level) {
    fail(
      'UNRESOLVED_REFERENCE',
      `No se pudo resolver el nivel ${String(raw)} de ${path}.`,
      path,
      [...ids, raw].filter((id) => id !== null && id !== undefined)
    );
  }
  if (!Number.isFinite(level.elevation)) {
    fail('NON_FINITE_NUMBER', `La cota del nivel ${String(level.id)} no es finita.`, path, [
      ...ids,
      level.id
    ]);
  }
  return level.elevation;
}

function wallRun(wall, points, path) {
  const dx = Math.abs(points.p2.x - points.p1.x);
  const dy = Math.abs(points.p2.y - points.p1.y);
  const direction = wall.direction ?? (dx > EPSILON && dy <= EPSILON ? 'x' : 'y');
  if (!['x', 'y'].includes(direction)) {
    fail('INVALID_GEOMETRY', `La dirección del muro ${String(wall.id)} no es válida.`, path, [wall.id]);
  }
  const along = direction === 'x' ? dx : dy;
  const across = direction === 'x' ? dy : dx;
  if (!(along > EPSILON) || across > EPSILON) {
    fail(
      'INVALID_DIMENSION',
      `El muro ${String(wall.id)} no define un tramo ortogonal de longitud positiva.`,
      path,
      [wall.id]
    );
  }
  return direction;
}

function orderedWallPoints(points, runAxis, z) {
  const [start, end] = points.p1[runAxis] <= points.p2[runAxis]
    ? [points.p1, points.p2]
    : [points.p2, points.p1];
  return {
    start: { x: start.x, y: start.y, z },
    end: { x: end.x, y: end.y, z }
  };
}

function projectOpening(opening, wall, frame, context, path) {
  const ids = [wall.id, opening.id];
  if (!['door', 'window'].includes(opening.type)) {
    fail(
      'UNKNOWN_ELEMENT_TYPE',
      `El vano ${String(opening.id)} tiene tipo desconocido ${String(opening.type)}.`,
      `${path}.type`,
      ids
    );
  }
  if (opening.axisType != null && opening.axisType !== frame.runAxis) {
    fail('INVALID_GEOMETRY', `El vano ${String(opening.id)} no sigue el eje de su muro.`, path, ids);
  }
  const width = positiveValue(opening.width, context, `${path}.width`, ids);
  const height = positiveValue(opening.height, context, `${path}.height`, ids);
  let position;
  if (opening.referenceAxisId !== null && opening.referenceAxisId !== undefined) {
    const reference = axisValue(
      opening.referenceAxisId,
      frame.runAxis,
      context,
      `${path}.referenceAxisId`,
      ids
    );
    const offset = nonNegativeValue(
      opening.edgeOffset,
      context,
      `${path}.edgeOffset`,
      ids,
      { optional: true, fallback: 0 }
    );
    if (!['left', 'right'].includes(opening.referenceEdge)) {
      fail('UNRESOLVED_REFERENCE', `El borde de referencia del vano ${String(opening.id)} no es válido.`, path, ids);
    }
    position = opening.referenceEdge === 'right'
      ? reference - offset - width / 2
      : reference + offset + width / 2;
  } else {
    position = numberValue(opening.position, context, `${path}.position`, ids);
  }

  const sill = opening.type === 'door'
    ? 0
    : nonNegativeValue(opening.sillHeight, context, `${path}.sillHeight`, ids);
  const lower = position - width / 2;
  const upper = position + width / 2;
  const runMin = frame.start[frame.runAxis];
  const runMax = frame.end[frame.runAxis];
  if (lower < runMin - EPSILON || upper > runMax + EPSILON || sill + height > frame.height + EPSILON) {
    fail('INVALID_DIMENSION', `El vano ${String(opening.id)} queda fuera del prisma del muro.`, path, ids);
  }
  const point = (run, z) => frame.runAxis === 'x'
    ? { x: run, y: frame.start.y, z }
    : { x: frame.start.x, y: run, z };
  const z = frame.bottom + sill;
  return {
    id: opening.id,
    kind: opening.type,
    hostWallId: wall.id,
    void: {
      kind: 'oriented-prism',
      start: point(lower, z),
      end: point(upper, z),
      thickness: frame.thickness,
      height
    }
  };
}

function projectWall(wall, context, path) {
  const ids = [wall.id];
  const points = {
    p1: {
      x: axisValue(wall.xStart, 'x', context, `${path}.xStart`, ids),
      y: axisValue(wall.yStart, 'y', context, `${path}.yStart`, ids)
    },
    p2: {
      x: axisValue(wall.xEnd, 'x', context, `${path}.xEnd`, ids),
      y: axisValue(wall.yEnd, 'y', context, `${path}.yEnd`, ids)
    }
  };
  const runAxis = wallRun(wall, points, path);
  const bottom = levelValue(wall.bottomZ, context, `${path}.bottomZ`, ids);
  const top = levelValue(wall.topZ, context, `${path}.topZ`, ids);
  const thickness = positiveValue(wall.thickness, context, `${path}.thickness`, ids);
  if (!(top > bottom)) {
    fail('INVALID_DIMENSION', `El muro ${String(wall.id)} no tiene altura positiva.`, path, ids);
  }
  const ordered = orderedWallPoints(points, runAxis, bottom);
  const frame = {
    ...ordered,
    runAxis,
    bottom,
    top,
    thickness,
    height: top - bottom
  };
  const openings = requireArray(wall.openings ?? [], `${path}.openings`)
    .map((opening, index) => projectOpening(opening, wall, frame, context, `${path}.openings[${index}]`))
    .sort(compareIds);
  return {
    output: {
      id: wall.id,
      type: 'wall',
      prism: {
        kind: 'oriented-prism',
        start: ordered.start,
        end: ordered.end,
        thickness,
        height: top - bottom
      },
      openings
    },
    frame
  };
}

function projectColumn(column, context, path) {
  const ids = [column.id];
  const x = axisValue(column.axisXId, 'x', context, `${path}.axisXId`, ids)
    + numberValue(column.offsetX, context, `${path}.offsetX`, ids, { optional: true });
  const y = axisValue(column.axisYId, 'y', context, `${path}.axisYId`, ids)
    + numberValue(column.offsetY, context, `${path}.offsetY`, ids, { optional: true });
  const widthX = positiveValue(column.widthX, context, `${path}.widthX`, ids);
  const widthY = positiveValue(column.widthY, context, `${path}.widthY`, ids);
  const bottom = levelValue(column.bottomZ, context, `${path}.bottomZ`, ids);
  const top = levelValue(column.topZ, context, `${path}.topZ`, ids);
  if (!(top > bottom)) {
    fail('INVALID_DIMENSION', `La columna ${String(column.id)} no tiene altura positiva.`, path, ids);
  }
  return {
    id: column.id,
    type: 'column',
    prism: {
      kind: 'axis-aligned-prism',
      min: { x: x - widthX / 2, y: y - widthY / 2, z: bottom },
      max: { x: x + widthX / 2, y: y + widthY / 2, z: top }
    }
  };
}

function projectBeam(beam, context, path) {
  const ids = [beam.id];
  if (!['x', 'y'].includes(beam.direction)) {
    fail('INVALID_GEOMETRY', `La viga ${String(beam.id)} no declara una dirección válida.`, path, ids);
  }
  const runAxis = beam.direction;
  const fixedAxis = runAxis === 'x' ? 'y' : 'x';
  const fixed = axisValue(beam.fixedAxisId, fixedAxis, context, `${path}.fixedAxisId`, ids);
  const run1 = axisValue(beam.startAxisId, runAxis, context, `${path}.startAxisId`, ids);
  const run2 = axisValue(beam.endAxisId, runAxis, context, `${path}.endAxisId`, ids);
  const offsetX = numberValue(beam.offsetX, context, `${path}.offsetX`, ids, { optional: true });
  const offsetY = numberValue(beam.offsetY, context, `${path}.offsetY`, ids, { optional: true });
  const width = positiveValue(beam.width, context, `${path}.width`, ids);
  const height = positiveValue(beam.height, context, `${path}.height`, ids);
  const z = levelValue(beam.levelZ, context, `${path}.levelZ`, ids);
  const from = Math.min(run1, run2);
  const to = Math.max(run1, run2);
  if (!(to > from)) {
    fail('INVALID_DIMENSION', `La viga ${String(beam.id)} no tiene longitud positiva.`, path, ids);
  }
  const start = runAxis === 'x'
    ? { x: from + offsetX, y: fixed + offsetY, z }
    : { x: fixed + offsetX, y: from + offsetY, z };
  const end = runAxis === 'x'
    ? { x: to + offsetX, y: fixed + offsetY, z }
    : { x: fixed + offsetX, y: to + offsetY, z };
  return {
    id: beam.id,
    type: 'beam',
    prism: { kind: 'oriented-prism', start, end, width, height }
  };
}

function boxPrism(min, max, path, ids) {
  if (!(max.x > min.x && max.y > min.y && max.z > min.z)) {
    fail('INVALID_DIMENSION', `El sólido ${path} no tiene volumen positivo.`, path, ids);
  }
  return { kind: 'axis-aligned-prism', min, max };
}

function projectFoundation(foundation, context, path) {
  const ids = [foundation.id];
  levelValue(foundation.levelZ, context, `${path}.levelZ`, ids);
  numberValue(foundation.topOffset, context, `${path}.topOffset`, ids, { optional: true });
  if (!['corrida', 'aislada'].includes(foundation.foundationType)) {
    fail(
      'INVALID_GEOMETRY',
      `La fundación ${String(foundation.id)} no declara un tipo vigente.`,
      `${path}.foundationType`,
      ids
    );
  }

  if (foundation.foundationType === 'corrida') {
    if (!['x', 'y'].includes(foundation.direction)) {
      fail('INVALID_GEOMETRY', `La fundación ${String(foundation.id)} no declara dirección.`, path, ids);
    }
    const runAxis = foundation.direction;
    const fixedAxis = runAxis === 'x' ? 'y' : 'x';
    axisValue(foundation.fixedAxisId, fixedAxis, context, `${path}.fixedAxisId`, ids);
    axisValue(foundation.startAxisId, runAxis, context, `${path}.startAxisId`, ids);
    axisValue(foundation.endAxisId, runAxis, context, `${path}.endAxisId`, ids);
    if (!foundation.cimiento && !foundation.sobrecimiento) {
      fail('INVALID_DIMENSION', `La fundación ${String(foundation.id)} no contiene capas.`, path, ids);
    }
    if (foundation.cimiento) {
      positiveValue(foundation.cimiento.width, context, `${path}.cimiento.width`, ids);
      positiveValue(foundation.cimiento.depth, context, `${path}.cimiento.depth`, ids);
    }
    if (foundation.sobrecimiento) {
      positiveValue(foundation.sobrecimiento.width, context, `${path}.sobrecimiento.width`, ids);
      positiveValue(foundation.sobrecimiento.height, context, `${path}.sobrecimiento.height`, ids);
    }
  } else {
    axisValue(foundation.axisXId, 'x', context, `${path}.axisXId`, ids);
    axisValue(foundation.axisYId, 'y', context, `${path}.axisYId`, ids);
    positiveValue(foundation.aislada?.lengthX, context, `${path}.aislada.lengthX`, ids);
    positiveValue(foundation.aislada?.lengthY, context, `${path}.aislada.lengthY`, ids);
    positiveValue(foundation.aislada?.depth, context, `${path}.aislada.depth`, ids);
  }
  if (foundation.emplantillado) {
    positiveValue(
      foundation.emplantillado.thickness,
      context,
      `${path}.emplantillado.thickness`,
      ids
    );
    nonNegativeValue(
      foundation.emplantillado.overhang,
      context,
      `${path}.emplantillado.overhang`,
      ids,
      { optional: true }
    );
  }

  const resolved = resolveFoundation(
    foundation,
    context.model.grid,
    context.paramsMap,
    context.elementsById
  );
  if (!resolved) {
    fail('UNRESOLVED_REFERENCE', `No se pudo resolver la fundación ${String(foundation.id)}.`, path, ids);
  }
  const solids = resolved.layers.map((layer) => {
    if (resolved.kind === 'aislada') {
      return {
        role: layer.name,
        prism: boxPrism(
          {
            x: resolved.center.x - resolved.lengthX / 2,
            y: resolved.center.y - resolved.lengthY / 2,
            z: layer.bottom
          },
          {
            x: resolved.center.x + resolved.lengthX / 2,
            y: resolved.center.y + resolved.lengthY / 2,
            z: layer.top
          },
          `${path}.${layer.name}`,
          ids
        )
      };
    }
    const minRun = Math.min(resolved.p1[foundation.direction], resolved.p2[foundation.direction]);
    const maxRun = Math.max(resolved.p1[foundation.direction], resolved.p2[foundation.direction]);
    const fixedAxis = foundation.direction === 'x' ? 'y' : 'x';
    const fixed = resolved.p1[fixedAxis];
    const min = foundation.direction === 'x'
      ? { x: minRun, y: fixed - layer.width / 2, z: layer.bottom }
      : { x: fixed - layer.width / 2, y: minRun, z: layer.bottom };
    const max = foundation.direction === 'x'
      ? { x: maxRun, y: fixed + layer.width / 2, z: layer.top }
      : { x: fixed + layer.width / 2, y: maxRun, z: layer.top };
    return { role: layer.name, prism: boxPrism(min, max, `${path}.${layer.name}`, ids) };
  });

  if (resolved.emplantillado) {
    const overhang = resolved.emplantillado.overhang;
    if (resolved.kind === 'aislada') {
      solids.push({
        role: 'emplantillado',
        prism: boxPrism(
          {
            x: resolved.center.x - resolved.lengthX / 2 - overhang,
            y: resolved.center.y - resolved.lengthY / 2 - overhang,
            z: resolved.emplantillado.bottom
          },
          {
            x: resolved.center.x + resolved.lengthX / 2 + overhang,
            y: resolved.center.y + resolved.lengthY / 2 + overhang,
            z: resolved.emplantillado.top
          },
          `${path}.emplantillado`,
          ids
        )
      });
    } else {
      const width = resolved.width + 2 * overhang;
      const minRun = Math.min(resolved.p1[foundation.direction], resolved.p2[foundation.direction]);
      const maxRun = Math.max(resolved.p1[foundation.direction], resolved.p2[foundation.direction]);
      const fixedAxis = foundation.direction === 'x' ? 'y' : 'x';
      const fixed = resolved.p1[fixedAxis];
      const min = foundation.direction === 'x'
        ? { x: minRun, y: fixed - width / 2, z: resolved.emplantillado.bottom }
        : { x: fixed - width / 2, y: minRun, z: resolved.emplantillado.bottom };
      const max = foundation.direction === 'x'
        ? { x: maxRun, y: fixed + width / 2, z: resolved.emplantillado.top }
        : { x: fixed + width / 2, y: maxRun, z: resolved.emplantillado.top };
      solids.push({
        role: 'emplantillado',
        prism: boxPrism(min, max, `${path}.emplantillado`, ids)
      });
    }
  }

  solids.sort(compareRoles);
  return { id: foundation.id, type: 'foundation', kind: resolved.kind, solids };
}

function boundaryPoint(runAxis, run, perp, z) {
  return runAxis === 'x' ? { x: run, y: perp, z } : { x: perp, y: run, z };
}

function projectLegacyRoof(system, context, wallFrames, path) {
  const ids = [system.id, system.wallLowId, system.wallHighId];
  const low = wallFrames.get(idKey(system.wallLowId));
  const high = wallFrames.get(idKey(system.wallHighId));
  if (!low || !high) {
    fail('UNRESOLVED_REFERENCE', `La cubierta ${String(system.id)} referencia un muro inexistente.`, path, ids);
  }
  if (low.runAxis !== high.runAxis) {
    fail('INVALID_GEOMETRY', `Los apoyos de la cubierta ${String(system.id)} no son paralelos.`, path, ids);
  }
  const runAxis = low.runAxis;
  const perpAxis = runAxis === 'x' ? 'y' : 'x';
  const lowPerp = low.start[perpAxis];
  const highPerp = high.start[perpAxis];
  const span = Math.abs(highPerp - lowPerp);
  if (!(span > EPSILON)) {
    fail('INVALID_DIMENSION', `La cubierta ${String(system.id)} no tiene luz positiva.`, path, ids);
  }
  let from = Math.max(low.start[runAxis], high.start[runAxis]);
  let to = Math.min(low.end[runAxis], high.end[runAxis]);
  if (system.runRange && (system.runRange.from != null || system.runRange.to != null)) {
    const requestedFrom = system.runRange.from == null
      ? from
      : numberValue(system.runRange.from, context, `${path}.runRange.from`, ids);
    const requestedTo = system.runRange.to == null
      ? to
      : numberValue(system.runRange.to, context, `${path}.runRange.to`, ids);
    from = Math.max(from, Math.min(requestedFrom, requestedTo));
    to = Math.min(to, Math.max(requestedFrom, requestedTo));
  }
  if (!(to > from)) {
    fail('INVALID_DIMENSION', `La cubierta ${String(system.id)} no tiene límite de corrida positivo.`, path, ids);
  }
  const support = levelValue(system.supportLevelId, context, `${path}.supportLevelId`, ids);
  const supportOffset = numberValue(system.supportOffset, context, `${path}.supportOffset`, ids);
  const heelHeight = nonNegativeValue(system.heelHeight, context, `${path}.heelHeight`, ids);
  const slopePercent = nonNegativeValue(system.slopePercent, context, `${path}.slopePercent`, ids);
  const lowZ = support + supportOffset + heelHeight;
  const highZ = lowZ + span * slopePercent / 100;
  return {
    id: system.id,
    source: 'roof-system',
    surface: {
      kind: 'planar-polygon',
      boundary: [
        boundaryPoint(runAxis, from, lowPerp, lowZ),
        boundaryPoint(runAxis, to, lowPerp, lowZ),
        boundaryPoint(runAxis, to, highPerp, highZ),
        boundaryPoint(runAxis, from, highPerp, highZ)
      ]
    }
  };
}

function polygonArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function normalizePolygon(points, path, ids) {
  const cleaned = [...points];
  if (
    cleaned.length > 3
    && cleaned[0].x === cleaned.at(-1).x
    && cleaned[0].y === cleaned.at(-1).y
  ) cleaned.pop();
  if (cleaned.length < 3 || Math.abs(polygonArea(cleaned)) <= EPSILON) {
    fail('INVALID_DIMENSION', 'El polígono de cubierta no tiene área positiva.', path, ids);
  }
  if (polygonArea(cleaned) < 0) cleaned.reverse();
  let first = 0;
  for (let index = 1; index < cleaned.length; index++) {
    if (
      cleaned[index].x < cleaned[first].x
      || (cleaned[index].x === cleaned[first].x && cleaned[index].y < cleaned[first].y)
    ) first = index;
  }
  return [...cleaned.slice(first), ...cleaned.slice(0, first)];
}

function projectRoofPlane(plane, context, wallFrames, path) {
  const ids = [plane.id, plane.canalWallId];
  const canal = wallFrames.get(idKey(plane.canalWallId));
  if (!canal) {
    fail('UNRESOLVED_REFERENCE', `El faldón ${String(plane.id)} no tiene canaleta resoluble.`, path, ids);
  }
  const rawPolygon = requireArray(plane.polygon, `${path}.polygon`);
  const polygon = normalizePolygon(rawPolygon.map((point, index) => ({
    x: numberValue(point?.x, context, `${path}.polygon[${index}].x`, ids),
    y: numberValue(point?.y, context, `${path}.polygon[${index}].y`, ids)
  })), `${path}.polygon`, ids);
  const runAxis = canal.runAxis;
  const perpAxis = runAxis === 'x' ? 'y' : 'x';
  const lowPerp = canal.start[perpAxis];
  const perpValues = polygon.map((point) => point[perpAxis]);
  const extremes = [Math.min(...perpValues), Math.max(...perpValues)];
  const highPerp = Math.abs(extremes[0] - lowPerp) > Math.abs(extremes[1] - lowPerp)
    ? extremes[0]
    : extremes[1];
  const spanDirection = Math.sign(highPerp - lowPerp);
  const span = Math.abs(highPerp - lowPerp);
  if (!(span > EPSILON)) {
    fail('INVALID_DIMENSION', `El faldón ${String(plane.id)} no tiene luz positiva.`, path, ids);
  }

  const candidates = [...wallFrames.values()].filter((wall) => (
    wall.runAxis === runAxis
    && Math.abs(wall.start[perpAxis] - highPerp) <= EPSILON
    && Math.min(wall.end[runAxis], Math.max(...polygon.map((point) => point[runAxis])))
      - Math.max(wall.start[runAxis], Math.min(...polygon.map((point) => point[runAxis]))) > EPSILON
  ));
  if (candidates.length === 0) {
    fail('UNRESOLVED_REFERENCE', `El faldón ${String(plane.id)} no tiene apoyo alto resoluble.`, path, ids);
  }
  const governingCrown = Math.min(...candidates.map((candidate) => candidate.top));
  const support = levelValue(plane.supportLevelId, context, `${path}.supportLevelId`, ids);
  const supportOffset = numberValue(plane.supportOffset, context, `${path}.supportOffset`, ids);
  const heelHeight = nonNegativeValue(plane.heelHeight, context, `${path}.heelHeight`, ids);
  const crownClearance = nonNegativeValue(
    plane.crownClearance,
    context,
    `${path}.crownClearance`,
    ids
  );
  const lowZ = support + supportOffset + heelHeight;
  const highZ = governingCrown - crownClearance;
  if (!(highZ >= lowZ)) {
    fail('INVALID_DIMENSION', `El faldón ${String(plane.id)} produce una pendiente negativa.`, path, ids);
  }
  const slope = (highZ - lowZ) / span;
  const boundary = polygon.map((point) => {
    const signedDistance = (point[perpAxis] - lowPerp) * spanDirection;
    if (signedDistance < -EPSILON || signedDistance > span + EPSILON) {
      fail('INVALID_GEOMETRY', `El polígono del faldón ${String(plane.id)} cruza sus apoyos.`, path, ids);
    }
    return { x: point.x, y: point.y, z: lowZ + signedDistance * slope };
  });
  return {
    id: plane.id,
    source: 'roof-plane',
    surface: { kind: 'planar-polygon', boundary }
  };
}

function assertFiniteOutput(value, path = '$') {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail('NON_FINITE_NUMBER', `La salida contiene un número no finito en ${path}.`, path);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteOutput(item, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertFiniteOutput(item, `${path}.${key}`));
  }
}

export function projectAgnosticRoofGeometry(model, requestedRoofGeometryIds = null) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    fail('INVALID_MODEL', 'El modelo debe ser un objeto.', '$');
  }
  if (!model.grid || typeof model.grid !== 'object') {
    fail('INVALID_COLLECTION', 'El modelo debe declarar grid.', 'grid');
  }
  const normalized = {
    ...model,
    grid: {
      ...model.grid,
      xAxes: requireArray(model.grid.xAxes, 'grid.xAxes'),
      yAxes: requireArray(model.grid.yAxes, 'grid.yAxes'),
      zLevels: requireArray(model.grid.zLevels, 'grid.zLevels')
    },
    elements: requireArray(model.elements, 'elements'),
    projectParams: requireArray(model.projectParams ?? [], 'projectParams'),
    roofSystems: requireArray(model.roofSystems ?? [], 'roofSystems'),
    roofPlanes: requireArray(model.roofPlanes ?? [], 'roofPlanes')
  };
  registerIds(normalized);

  const requested = requestedRoofGeometryIds == null
    ? null
    : new Set(requireArray(requestedRoofGeometryIds, 'requestedRoofGeometryIds').map(idKey));
  const selected = (entry) => requested == null || requested.has(idKey(entry?.id));
  const context = {
    model: normalized,
    paramsMap: buildStrictParamsMap(normalized.projectParams),
    elementsById: buildElementsById(normalized.elements)
  };
  const wallFrames = new Map();
  normalized.elements.forEach((element, index) => {
    if (element?.type !== 'wall') return;
    const projected = projectWall(element, context, `elements[${index}]`);
    wallFrames.set(idKey(element.id), { id: element.id, ...projected.frame });
  });
  const roofGeometry = [
    ...normalized.roofSystems.flatMap((system, index) => (
      selected(system)
        ? [projectLegacyRoof(system, context, wallFrames, `roofSystems[${index}]`)]
        : []
    )),
    ...normalized.roofPlanes.flatMap((plane, index) => (
      selected(plane)
        ? [projectRoofPlane(plane, context, wallFrames, `roofPlanes[${index}]`)]
        : []
    ))
  ].sort(compareIds);
  assertFiniteOutput(roofGeometry, 'roofGeometry');
  return roofGeometry;
}

export function projectAgnosticGeometry(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    fail('INVALID_MODEL', 'El modelo debe ser un objeto.', '$');
  }
  if (!model.grid || typeof model.grid !== 'object') {
    fail('INVALID_COLLECTION', 'El modelo debe declarar grid.', 'grid');
  }
  const normalized = {
    ...model,
    grid: {
      ...model.grid,
      xAxes: requireArray(model.grid.xAxes, 'grid.xAxes'),
      yAxes: requireArray(model.grid.yAxes, 'grid.yAxes'),
      zLevels: requireArray(model.grid.zLevels, 'grid.zLevels')
    },
    elements: requireArray(model.elements, 'elements'),
    projectParams: requireArray(model.projectParams ?? [], 'projectParams'),
    roofSystems: requireArray(model.roofSystems ?? [], 'roofSystems'),
    roofPlanes: requireArray(model.roofPlanes ?? [], 'roofPlanes')
  };
  registerIds(normalized);
  normalized.elements.forEach((element, index) => {
    if (!SUPPORTED_ELEMENT_TYPES.has(element?.type)) {
      fail(
        'UNKNOWN_ELEMENT_TYPE',
        `El elemento ${String(element?.id)} tiene tipo desconocido ${String(element?.type)}.`,
        `elements[${index}].type`,
        [element?.id].filter((id) => id !== undefined)
      );
    }
  });

  const context = {
    model: normalized,
    paramsMap: buildStrictParamsMap(normalized.projectParams),
    elementsById: buildElementsById(normalized.elements)
  };
  const grid = {
    xAxes: normalized.grid.xAxes.map((axis, index) => {
      if (!Number.isFinite(axis.position)) {
        fail('NON_FINITE_NUMBER', `La coordenada del eje ${String(axis.id)} no es finita.`, `grid.xAxes[${index}].position`, [axis.id]);
      }
      return { id: axis.id, x: axis.position };
    }).sort(compareIds),
    yAxes: normalized.grid.yAxes.map((axis, index) => {
      if (!Number.isFinite(axis.position)) {
        fail('NON_FINITE_NUMBER', `La coordenada del eje ${String(axis.id)} no es finita.`, `grid.yAxes[${index}].position`, [axis.id]);
      }
      return { id: axis.id, y: axis.position };
    }).sort(compareIds),
    zLevels: normalized.grid.zLevels.map((level, index) => {
      if (!Number.isFinite(level.elevation)) {
        fail('NON_FINITE_NUMBER', `La cota del nivel ${String(level.id)} no es finita.`, `grid.zLevels[${index}].elevation`, [level.id]);
      }
      return { id: level.id, z: level.elevation };
    }).sort(compareIds)
  };

  const walls = [];
  const columns = [];
  const beams = [];
  const foundations = [];
  const wallFrames = new Map();
  normalized.elements.forEach((element, index) => {
    const path = `elements[${index}]`;
    if (element.type === 'wall') {
      const projected = projectWall(element, context, path);
      walls.push(projected.output);
      wallFrames.set(idKey(element.id), { id: element.id, ...projected.frame });
    } else if (element.type === 'column') {
      columns.push(projectColumn(element, context, path));
    } else if (element.type === 'beam') {
      beams.push(projectBeam(element, context, path));
    } else {
      foundations.push(projectFoundation(element, context, path));
    }
  });
  walls.sort(compareIds);
  columns.sort(compareIds);
  beams.sort(compareIds);
  foundations.sort(compareIds);
  const elements = [...walls, ...columns, ...beams, ...foundations].sort(compareElements);
  const roofGeometry = [
    ...normalized.roofSystems.map((system, index) => projectLegacyRoof(
      system,
      context,
      wallFrames,
      `roofSystems[${index}]`
    )),
    ...normalized.roofPlanes.map((plane, index) => projectRoofPlane(
      plane,
      context,
      wallFrames,
      `roofPlanes[${index}]`
    ))
  ].sort(compareIds);

  const output = {
    schema: AGNOSTIC_GEOMETRY_SCHEMA,
    units: { length: 'millimeter' },
    coordinates: {
      type: 'cartesian',
      handedness: 'right-handed',
      axes: { x: 'plan', y: 'plan', z: 'vertical-up' }
    },
    grid,
    elements,
    roofGeometry
  };
  assertFiniteOutput(output);
  return output;
}

export function serializeAgnosticGeometry(model) {
  return `${JSON.stringify(projectAgnosticGeometry(model), null, 2)}\n`;
}

function downloadJson(content, filename, mime, environment, unavailableMessage) {
  const BlobCtor = environment.Blob ?? globalThis.Blob;
  const documentRef = environment.document ?? globalThis.document;
  const urlApi = environment.URL ?? globalThis.URL;
  if (
    typeof BlobCtor !== 'function'
    || typeof documentRef?.createElement !== 'function'
    || typeof urlApi?.createObjectURL !== 'function'
    || typeof urlApi?.revokeObjectURL !== 'function'
  ) {
    throw new TypeError(unavailableMessage);
  }
  const blob = new BlobCtor([content], { type: mime });
  const objectUrl = urlApi.createObjectURL(blob);
  try {
    const anchor = documentRef.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
  } finally {
    urlApi.revokeObjectURL(objectUrl);
  }
}

function auditedProjection(model, environment) {
  const projectGeometry = environment.projectGeometry ?? projectAgnosticGeometry;
  const geometry = projectGeometry(model);
  const audit = auditAgnosticGeometry(model, geometry, {
    toleranceMm: environment.toleranceMm
  });
  return { geometry, audit };
}

export function downloadAgnosticGeometry(model, environment = {}) {
  const { geometry, audit } = auditedProjection(model, environment);
  assertAgnosticGeometryAuditPass(audit);
  const content = `${JSON.stringify(geometry, null, 2)}\n`;
  const policy = guardExport(model, 'agnostic-geometry-json');
  if (!policy.allowed) return false;
  downloadJson(
    content,
    AGNOSTIC_GEOMETRY_FILENAME,
    AGNOSTIC_GEOMETRY_MIME,
    environment,
    'El entorno no permite descargar la geometría agnóstica.'
  );
  return audit;
}

export function downloadAgnosticGeometryAudit(model, environment = {}) {
  const { audit } = auditedProjection(model, environment);
  const content = serializeAgnosticGeometryAudit(audit);
  const policy = guardExport(model, 'agnostic-geometry-audit-json');
  if (!policy.allowed) return false;
  downloadJson(
    content,
    AGNOSTIC_GEOMETRY_AUDIT_FILENAME,
    AGNOSTIC_GEOMETRY_AUDIT_MIME,
    environment,
    'El entorno no permite descargar la auditoría geométrica.'
  );
  return audit;
}
