import { buildElementsById, resolveAxisRef } from './elementReferences.js';
import { resolveFoundation } from './foundationGeometry.js';
import { resolveValue } from './projectParams.js';
import { cloneJson } from './structuralProposalCommon.js';

export const AGNOSTIC_GEOMETRY_AUDIT_SCHEMA = 'agnostic-geometry-audit/v1';
export const AGNOSTIC_GEOMETRY_AUDIT_FILENAME = 'auditoria-geometria-agnostica.json';
export const AGNOSTIC_GEOMETRY_AUDIT_MIME = 'application/json;charset=utf-8';
export const DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM = 0.001;

const GEOMETRY_SCHEMA = 'agnostic-geometry-v1.0';
const EPSILON = 1e-7;
const ELEMENT_ORDER = new Map([
  ['wall', 0],
  ['column', 1],
  ['beam', 2],
  ['foundation', 3]
]);

export class AgnosticGeometryAuditError extends Error {
  constructor(report) {
    const failure = report?.checks?.find(({ status }) => status === 'fail');
    const context = failure
      ? `${failure.path}: esperado ${JSON.stringify(failure.expected)}, observado ${JSON.stringify(failure.observed)}`
      : 'el informe no contiene contexto de la diferencia';
    super(`La auditoría geométrica independiente falló en ${context}.`);
    this.name = 'AgnosticGeometryAuditError';
    this.code = 'AGNOSTIC_GEOMETRY_AUDIT_FAILED';
    this.path = failure?.path ?? '$';
    this.ids = failure?.id === null || failure?.id === undefined ? [] : [failure.id];
    this.report = report;
  }
}

function idKey(id) {
  return `${typeof id}:${JSON.stringify(id)}`;
}

function compareIdValues(left, right) {
  const a = idKey(left);
  const b = idKey(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareById(left, right) {
  return compareIdValues(left?.id, right?.id);
}

function compareElements(left, right) {
  const byType = (ELEMENT_ORDER.get(left?.type) ?? 99) - (ELEMENT_ORDER.get(right?.type) ?? 99);
  return byType || compareById(left, right);
}

function requireArray(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} debe ser un arreglo.`);
  return value;
}

function finiteNumber(value, path) {
  if (!Number.isFinite(value)) throw new Error(`${path} no es un número finito.`);
  return value;
}

function buildStrictParamsMap(parameters) {
  const result = Object.create(null);
  for (const [index, parameter] of parameters.entries()) {
    if (!parameter || typeof parameter.name !== 'string' || parameter.name === '') continue;
    if (Object.prototype.hasOwnProperty.call(result, parameter.name)) {
      throw new Error(`projectParams[${index}].name está duplicado.`);
    }
    result[parameter.name] = finiteNumber(Number(parameter.value), `projectParams[${index}].value`);
  }
  return result;
}

function resolvedNumber(raw, context, path, { optional = false, fallback = 0 } = {}) {
  if ((raw === null || raw === undefined || raw === '') && optional) return fallback;
  const value = resolveValue(raw, context.paramsMap, context.elementsById);
  return finiteNumber(value, path);
}

function axisNumber(raw, axis, context, path) {
  return finiteNumber(
    resolveAxisRef(raw, axis, context.model.grid, context.elementsById, context.paramsMap),
    path
  );
}

function levelNumber(id, context, path) {
  const level = context.model.grid.zLevels.find((candidate) => candidate.id === id);
  if (!level) throw new Error(`${path} referencia un nivel inexistente.`);
  return finiteNumber(level.elevation, path);
}

function wallFrame(wall, context, path) {
  const p1 = {
    x: axisNumber(wall.xStart, 'x', context, `${path}.xStart`),
    y: axisNumber(wall.yStart, 'y', context, `${path}.yStart`)
  };
  const p2 = {
    x: axisNumber(wall.xEnd, 'x', context, `${path}.xEnd`),
    y: axisNumber(wall.yEnd, 'y', context, `${path}.yEnd`)
  };
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const runAxis = wall.direction ?? (dx > EPSILON && dy <= EPSILON ? 'x' : 'y');
  if (!['x', 'y'].includes(runAxis)) throw new Error(`${path}.direction no es válida.`);
  const [origin, end] = p1[runAxis] <= p2[runAxis] ? [p1, p2] : [p2, p1];
  const bottom = levelNumber(wall.bottomZ, context, `${path}.bottomZ`);
  const top = levelNumber(wall.topZ, context, `${path}.topZ`);
  const thickness = resolvedNumber(wall.thickness, context, `${path}.thickness`);
  return {
    runAxis,
    bottom,
    top,
    thickness,
    height: top - bottom,
    start: { x: origin.x, y: origin.y, z: bottom },
    end: { x: end.x, y: end.y, z: bottom }
  };
}

function expectedOpening(opening, wall, frame, context, path) {
  const width = resolvedNumber(opening.width, context, `${path}.width`);
  const height = resolvedNumber(opening.height, context, `${path}.height`);
  let center;
  if (opening.referenceAxisId !== null && opening.referenceAxisId !== undefined) {
    const reference = axisNumber(opening.referenceAxisId, frame.runAxis, context, `${path}.referenceAxisId`);
    const offset = resolvedNumber(opening.edgeOffset, context, `${path}.edgeOffset`, {
      optional: true,
      fallback: 0
    });
    center = opening.referenceEdge === 'right'
      ? reference - offset - width / 2
      : reference + offset + width / 2;
  } else {
    center = resolvedNumber(opening.position, context, `${path}.position`);
  }
  const sill = opening.type === 'door'
    ? 0
    : resolvedNumber(opening.sillHeight, context, `${path}.sillHeight`);
  const point = (run) => frame.runAxis === 'x'
    ? { x: run, y: frame.start.y, z: frame.bottom + sill }
    : { x: frame.start.x, y: run, z: frame.bottom + sill };
  return {
    id: opening.id,
    kind: opening.type,
    hostWallId: wall.id,
    void: {
      kind: 'oriented-prism',
      start: point(center - width / 2),
      end: point(center + width / 2),
      thickness: frame.thickness,
      height
    }
  };
}

function expectedWall(wall, context, path) {
  const frame = wallFrame(wall, context, path);
  return {
    geometry: {
      id: wall.id,
      type: 'wall',
      prism: {
        kind: 'oriented-prism',
        start: frame.start,
        end: frame.end,
        thickness: frame.thickness,
        height: frame.height
      },
      openings: requireArray(wall.openings ?? [], `${path}.openings`)
        .map((opening, index) => expectedOpening(
          opening,
          wall,
          frame,
          context,
          `${path}.openings[${index}]`
        ))
        .sort(compareById)
    },
    frame
  };
}

function expectedColumn(column, context, path) {
  const x = axisNumber(column.axisXId, 'x', context, `${path}.axisXId`)
    + resolvedNumber(column.offsetX, context, `${path}.offsetX`, { optional: true });
  const y = axisNumber(column.axisYId, 'y', context, `${path}.axisYId`)
    + resolvedNumber(column.offsetY, context, `${path}.offsetY`, { optional: true });
  const widthX = resolvedNumber(column.widthX, context, `${path}.widthX`);
  const widthY = resolvedNumber(column.widthY, context, `${path}.widthY`);
  const bottom = levelNumber(column.bottomZ, context, `${path}.bottomZ`);
  const top = levelNumber(column.topZ, context, `${path}.topZ`);
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

function expectedBeam(beam, context, path) {
  const runAxis = beam.direction;
  const fixedAxis = runAxis === 'x' ? 'y' : 'x';
  const fixed = axisNumber(beam.fixedAxisId, fixedAxis, context, `${path}.fixedAxisId`);
  const first = axisNumber(beam.startAxisId, runAxis, context, `${path}.startAxisId`);
  const second = axisNumber(beam.endAxisId, runAxis, context, `${path}.endAxisId`);
  const offsetX = resolvedNumber(beam.offsetX, context, `${path}.offsetX`, { optional: true });
  const offsetY = resolvedNumber(beam.offsetY, context, `${path}.offsetY`, { optional: true });
  const z = levelNumber(beam.levelZ, context, `${path}.levelZ`);
  const from = Math.min(first, second);
  const to = Math.max(first, second);
  const start = runAxis === 'x'
    ? { x: from + offsetX, y: fixed + offsetY, z }
    : { x: fixed + offsetX, y: from + offsetY, z };
  const end = runAxis === 'x'
    ? { x: to + offsetX, y: fixed + offsetY, z }
    : { x: fixed + offsetX, y: to + offsetY, z };
  return {
    id: beam.id,
    type: 'beam',
    prism: {
      kind: 'oriented-prism',
      start,
      end,
      width: resolvedNumber(beam.width, context, `${path}.width`),
      height: resolvedNumber(beam.height, context, `${path}.height`)
    }
  };
}

function box(min, max) {
  return { kind: 'axis-aligned-prism', min, max };
}

function expectedFoundation(foundation, context, path) {
  const resolved = resolveFoundation(
    foundation,
    context.model.grid,
    context.paramsMap,
    context.elementsById
  );
  if (!resolved) throw new Error(`${path} no se pudo resolver.`);
  const solids = resolved.layers.map((layer) => {
    if (resolved.kind === 'aislada') {
      return {
        role: layer.name,
        prism: box(
          {
            x: resolved.center.x - resolved.lengthX / 2,
            y: resolved.center.y - resolved.lengthY / 2,
            z: layer.bottom
          },
          {
            x: resolved.center.x + resolved.lengthX / 2,
            y: resolved.center.y + resolved.lengthY / 2,
            z: layer.top
          }
        )
      };
    }
    const runAxis = foundation.direction;
    const fixedAxis = runAxis === 'x' ? 'y' : 'x';
    const from = Math.min(resolved.p1[runAxis], resolved.p2[runAxis]);
    const to = Math.max(resolved.p1[runAxis], resolved.p2[runAxis]);
    const fixed = resolved.p1[fixedAxis];
    return {
      role: layer.name,
      prism: runAxis === 'x'
        ? box(
          { x: from, y: fixed - layer.width / 2, z: layer.bottom },
          { x: to, y: fixed + layer.width / 2, z: layer.top }
        )
        : box(
          { x: fixed - layer.width / 2, y: from, z: layer.bottom },
          { x: fixed + layer.width / 2, y: to, z: layer.top }
        )
    };
  });
  if (resolved.emplantillado) {
    const overhang = resolved.emplantillado.overhang;
    if (resolved.kind === 'aislada') {
      solids.push({
        role: 'emplantillado',
        prism: box(
          {
            x: resolved.center.x - resolved.lengthX / 2 - overhang,
            y: resolved.center.y - resolved.lengthY / 2 - overhang,
            z: resolved.emplantillado.bottom
          },
          {
            x: resolved.center.x + resolved.lengthX / 2 + overhang,
            y: resolved.center.y + resolved.lengthY / 2 + overhang,
            z: resolved.emplantillado.top
          }
        )
      });
    } else {
      const runAxis = foundation.direction;
      const fixedAxis = runAxis === 'x' ? 'y' : 'x';
      const from = Math.min(resolved.p1[runAxis], resolved.p2[runAxis]);
      const to = Math.max(resolved.p1[runAxis], resolved.p2[runAxis]);
      const fixed = resolved.p1[fixedAxis];
      const halfWidth = resolved.width / 2 + overhang;
      solids.push({
        role: 'emplantillado',
        prism: runAxis === 'x'
          ? box(
            { x: from, y: fixed - halfWidth, z: resolved.emplantillado.bottom },
            { x: to, y: fixed + halfWidth, z: resolved.emplantillado.top }
          )
          : box(
            { x: fixed - halfWidth, y: from, z: resolved.emplantillado.bottom },
            { x: fixed + halfWidth, y: to, z: resolved.emplantillado.top }
          )
      });
    }
  }
  solids.sort((left, right) => left.role.localeCompare(right.role));
  return { id: foundation.id, type: 'foundation', kind: resolved.kind, solids };
}

function boundaryPoint(runAxis, run, perpendicular, z) {
  return runAxis === 'x'
    ? { x: run, y: perpendicular, z }
    : { x: perpendicular, y: run, z };
}

function expectedLegacyRoof(system, context, frames, path) {
  const low = frames.get(idKey(system.wallLowId));
  const high = frames.get(idKey(system.wallHighId));
  if (!low || !high) throw new Error(`${path} referencia apoyos inexistentes.`);
  const runAxis = low.runAxis;
  const perpendicularAxis = runAxis === 'x' ? 'y' : 'x';
  const lowPerpendicular = low.start[perpendicularAxis];
  const highPerpendicular = high.start[perpendicularAxis];
  const span = Math.abs(highPerpendicular - lowPerpendicular);
  let from = Math.max(low.start[runAxis], high.start[runAxis]);
  let to = Math.min(low.end[runAxis], high.end[runAxis]);
  if (system.runRange && (system.runRange.from != null || system.runRange.to != null)) {
    const requestedFrom = system.runRange.from == null
      ? from
      : resolvedNumber(system.runRange.from, context, `${path}.runRange.from`);
    const requestedTo = system.runRange.to == null
      ? to
      : resolvedNumber(system.runRange.to, context, `${path}.runRange.to`);
    from = Math.max(from, Math.min(requestedFrom, requestedTo));
    to = Math.min(to, Math.max(requestedFrom, requestedTo));
  }
  const lowZ = levelNumber(system.supportLevelId, context, `${path}.supportLevelId`)
    + resolvedNumber(system.supportOffset, context, `${path}.supportOffset`)
    + resolvedNumber(system.heelHeight, context, `${path}.heelHeight`);
  const highZ = lowZ + span * resolvedNumber(system.slopePercent, context, `${path}.slopePercent`) / 100;
  return {
    id: system.id,
    source: 'roof-system',
    surface: {
      kind: 'planar-polygon',
      boundary: [
        boundaryPoint(runAxis, from, lowPerpendicular, lowZ),
        boundaryPoint(runAxis, to, lowPerpendicular, lowZ),
        boundaryPoint(runAxis, to, highPerpendicular, highZ),
        boundaryPoint(runAxis, from, highPerpendicular, highZ)
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

function normalizeSourcePolygon(points) {
  const result = [...points];
  if (
    result.length > 3
    && result[0].x === result.at(-1).x
    && result[0].y === result.at(-1).y
  ) result.pop();
  if (polygonArea(result) < 0) result.reverse();
  let first = 0;
  for (let index = 1; index < result.length; index++) {
    if (
      result[index].x < result[first].x
      || (result[index].x === result[first].x && result[index].y < result[first].y)
    ) first = index;
  }
  return [...result.slice(first), ...result.slice(0, first)];
}

function expectedRoofPlane(plane, context, frames, path) {
  const canal = frames.get(idKey(plane.canalWallId));
  if (!canal) throw new Error(`${path} no tiene canaleta resoluble.`);
  const polygon = normalizeSourcePolygon(requireArray(plane.polygon, `${path}.polygon`).map((point, index) => ({
    x: resolvedNumber(point?.x, context, `${path}.polygon[${index}].x`),
    y: resolvedNumber(point?.y, context, `${path}.polygon[${index}].y`)
  })));
  const runAxis = canal.runAxis;
  const perpendicularAxis = runAxis === 'x' ? 'y' : 'x';
  const lowPerpendicular = canal.start[perpendicularAxis];
  const values = polygon.map((point) => point[perpendicularAxis]);
  const extremes = [Math.min(...values), Math.max(...values)];
  const highPerpendicular = Math.abs(extremes[0] - lowPerpendicular)
    > Math.abs(extremes[1] - lowPerpendicular) ? extremes[0] : extremes[1];
  const spanDirection = Math.sign(highPerpendicular - lowPerpendicular);
  const span = Math.abs(highPerpendicular - lowPerpendicular);
  const runMin = Math.min(...polygon.map((point) => point[runAxis]));
  const runMax = Math.max(...polygon.map((point) => point[runAxis]));
  const candidates = [...frames.values()].filter((frame) => (
    frame.runAxis === runAxis
    && Math.abs(frame.start[perpendicularAxis] - highPerpendicular) <= EPSILON
    && Math.min(frame.end[runAxis], runMax) - Math.max(frame.start[runAxis], runMin) > EPSILON
  ));
  if (candidates.length === 0) throw new Error(`${path} no tiene apoyo alto resoluble.`);
  const lowZ = levelNumber(plane.supportLevelId, context, `${path}.supportLevelId`)
    + resolvedNumber(plane.supportOffset, context, `${path}.supportOffset`)
    + resolvedNumber(plane.heelHeight, context, `${path}.heelHeight`);
  const highZ = Math.min(...candidates.map((candidate) => candidate.top))
    - resolvedNumber(plane.crownClearance, context, `${path}.crownClearance`);
  const slope = (highZ - lowZ) / span;
  return {
    id: plane.id,
    source: 'roof-plane',
    surface: {
      kind: 'planar-polygon',
      boundary: polygon.map((point) => ({
        x: point.x,
        y: point.y,
        z: lowZ + (point[perpendicularAxis] - lowPerpendicular) * spanDirection * slope
      }))
    }
  };
}

export function reconstructExpectedAgnosticGeometry(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    throw new Error('El modelo fuente debe ser un objeto.');
  }
  const normalized = {
    ...model,
    grid: {
      ...model.grid,
      xAxes: requireArray(model.grid?.xAxes, 'grid.xAxes'),
      yAxes: requireArray(model.grid?.yAxes, 'grid.yAxes'),
      zLevels: requireArray(model.grid?.zLevels, 'grid.zLevels')
    },
    elements: requireArray(model.elements, 'elements'),
    projectParams: requireArray(model.projectParams ?? [], 'projectParams'),
    roofSystems: requireArray(model.roofSystems ?? [], 'roofSystems'),
    roofPlanes: requireArray(model.roofPlanes ?? [], 'roofPlanes')
  };
  const context = {
    model: normalized,
    elementsById: buildElementsById(normalized.elements),
    paramsMap: buildStrictParamsMap(normalized.projectParams)
  };
  const frames = new Map();
  const elements = normalized.elements.map((element, index) => {
    const path = `elements[${index}]`;
    if (element.type === 'wall') {
      const expected = expectedWall(element, context, path);
      frames.set(idKey(element.id), expected.frame);
      return expected.geometry;
    }
    if (element.type === 'column') return expectedColumn(element, context, path);
    if (element.type === 'beam') return expectedBeam(element, context, path);
    if (element.type === 'foundation') return expectedFoundation(element, context, path);
    throw new Error(`${path}.type no está soportado.`);
  }).sort(compareElements);
  const expected = {
    schema: GEOMETRY_SCHEMA,
    units: { length: 'millimeter' },
    coordinates: {
      type: 'cartesian',
      handedness: 'right-handed',
      axes: { x: 'plan', y: 'plan', z: 'vertical-up' }
    },
    grid: {
      xAxes: normalized.grid.xAxes.map(({ id, position }) => ({
        id,
        x: finiteNumber(position, `grid.xAxes[${String(id)}].position`)
      })).sort(compareById),
      yAxes: normalized.grid.yAxes.map(({ id, position }) => ({
        id,
        y: finiteNumber(position, `grid.yAxes[${String(id)}].position`)
      })).sort(compareById),
      zLevels: normalized.grid.zLevels.map(({ id, elevation }) => ({
        id,
        z: finiteNumber(elevation, `grid.zLevels[${String(id)}].elevation`)
      })).sort(compareById)
    },
    elements,
    roofGeometry: [
      ...normalized.roofSystems.map((system, index) => expectedLegacyRoof(
        system,
        context,
        frames,
        `roofSystems[${index}]`
      )),
      ...normalized.roofPlanes.map((plane, index) => expectedRoofPlane(
        plane,
        context,
        frames,
        `roofPlanes[${index}]`
      ))
    ].sort(compareById)
  };
  return expected;
}

function sanitize(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN';
    return value > 0 ? 'Infinity' : '-Infinity';
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value === undefined ? '<missing>' : value;
}

function pathForId(path, id) {
  return `${path}[${JSON.stringify(id)}]`;
}

function valuesByKey(collection, keyOf) {
  const map = new Map();
  for (const item of Array.isArray(collection) ? collection : []) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

function cycleKey(points) {
  return JSON.stringify(points);
}

function normalizeBoundary(points) {
  if (!Array.isArray(points) || points.length < 2) return points;
  const candidates = [];
  for (const direction of [points, [...points].reverse()]) {
    for (let index = 0; index < direction.length; index++) {
      candidates.push([...direction.slice(index), ...direction.slice(0, index)]);
    }
  }
  candidates.sort((left, right) => cycleKey(left).localeCompare(cycleKey(right)));
  return candidates[0];
}

function canonicalEntity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = cloneJson(value);
  if (Array.isArray(copy.openings)) copy.openings.sort(compareById);
  if (Array.isArray(copy.solids)) copy.solids.sort((a, b) => String(a?.role).localeCompare(String(b?.role)));
  if (Array.isArray(copy.surface?.boundary)) copy.surface.boundary = normalizeBoundary(copy.surface.boundary);
  return copy;
}

function rawCounts(value) {
  const grid = value?.grid && typeof value.grid === 'object' ? value.grid : {};
  const elements = Array.isArray(value?.elements) ? value.elements : [];
  const walls = elements.filter((element) => element?.type === 'wall');
  const foundations = elements.filter((element) => element?.type === 'foundation');
  return {
    xAxes: Array.isArray(grid.xAxes) ? grid.xAxes.length : 0,
    yAxes: Array.isArray(grid.yAxes) ? grid.yAxes.length : 0,
    zLevels: Array.isArray(grid.zLevels) ? grid.zLevels.length : 0,
    elements: elements.length,
    walls: walls.length,
    openings: walls.reduce((sum, wall) => sum + (Array.isArray(wall.openings) ? wall.openings.length : 0), 0),
    columns: elements.filter((element) => element?.type === 'column').length,
    beams: elements.filter((element) => element?.type === 'beam').length,
    foundations: foundations.length,
    foundationLayers: foundations.reduce((sum, foundation) => (
      sum + (Array.isArray(foundation.solids) ? foundation.solids.length : 0)
    ), 0),
    roofs: Array.isArray(value?.roofGeometry) ? value.roofGeometry.length : 0
  };
}

function sourceCounts(expected) {
  return rawCounts(expected);
}

function makeComparator(toleranceMm) {
  const checks = [];
  let maximumDeviationMm = 0;
  const add = ({ status, code, entityType, id, path, expected, observed, deviationMm = null }) => {
    checks.push({
      status,
      code,
      entityType,
      id: id ?? null,
      path,
      expected: sanitize(expected),
      observed: sanitize(observed),
      deviationMm
    });
  };

  const compare = (expected, observed, path, entityType = 'contract', id = null) => {
    if (typeof expected === 'number') {
      if (!Number.isFinite(observed)) {
        add({ status: 'fail', code: 'NON_FINITE_NUMBER', entityType, id, path, expected, observed });
        return;
      }
      const deviationMm = Math.abs(expected - observed);
      maximumDeviationMm = Math.max(maximumDeviationMm, deviationMm);
      const roundingAllowance = Number.EPSILON * Math.max(1, Math.abs(expected), Math.abs(observed));
      add({
        status: deviationMm <= toleranceMm + roundingAllowance ? 'pass' : 'fail',
        code: 'NUMERIC_EQUIVALENCE',
        entityType,
        id,
        path,
        expected,
        observed,
        deviationMm
      });
      return;
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(observed)) {
        add({ status: 'fail', code: 'TYPE', entityType, id, path, expected: 'array', observed: typeof observed });
        return;
      }
      add({
        status: expected.length === observed.length ? 'pass' : 'fail',
        code: 'CARDINALITY',
        entityType,
        id,
        path,
        expected: expected.length,
        observed: observed.length
      });
      const length = Math.min(expected.length, observed.length);
      for (let index = 0; index < length; index++) {
        compare(expected[index], observed[index], `${path}[${index}]`, entityType, id);
      }
      return;
    }
    if (expected && typeof expected === 'object') {
      if (!observed || typeof observed !== 'object' || Array.isArray(observed)) {
        add({ status: 'fail', code: 'TYPE', entityType, id, path, expected: 'object', observed: observed === null ? 'null' : typeof observed });
        return;
      }
      const expectedKeys = Object.keys(expected).sort();
      const observedKeys = Object.keys(observed).sort();
      add({
        status: JSON.stringify(expectedKeys) === JSON.stringify(observedKeys) ? 'pass' : 'fail',
        code: 'MEMBERS',
        entityType,
        id,
        path,
        expected: expectedKeys,
        observed: observedKeys
      });
      for (const key of expectedKeys) {
        compare(expected[key], observed[key], `${path}.${key}`, entityType, id);
      }
      return;
    }
    add({
      status: Object.is(expected, observed) ? 'pass' : 'fail',
      code: 'EXACT_VALUE',
      entityType,
      id,
      path,
      expected,
      observed
    });
  };

  const bijection = (expected, observed, path, entityType, keyOf = (item) => idKey(item?.id)) => {
    const expectedItems = Array.isArray(expected) ? expected : [];
    const observedItems = Array.isArray(observed) ? observed : [];
    const expectedKeys = expectedItems.map(keyOf).sort();
    const observedKeys = observedItems.map(keyOf).sort();
    add({
      status: Array.isArray(observed)
        && JSON.stringify(expectedKeys) === JSON.stringify(observedKeys) ? 'pass' : 'fail',
      code: 'ID_BIJECTION',
      entityType,
      id: null,
      path,
      expected: expectedKeys,
      observed: Array.isArray(observed) ? observedKeys : '<not-array>'
    });
  };

  return { add, bijection, checks, compare, getMaximumDeviationMm: () => maximumDeviationMm };
}

function auditCollections(expected, observed, comparator) {
  comparator.compare(
    { schema: expected.schema, units: expected.units, coordinates: expected.coordinates },
    observed && typeof observed === 'object'
      ? { schema: observed.schema, units: observed.units, coordinates: observed.coordinates }
      : observed,
    '$'
  );
  const expectedRootKeys = Object.keys(expected).sort();
  const observedRootKeys = observed && typeof observed === 'object' && !Array.isArray(observed)
    ? Object.keys(observed).sort()
    : [];
  comparator.add({
    status: JSON.stringify(expectedRootKeys) === JSON.stringify(observedRootKeys) ? 'pass' : 'fail',
    code: 'MEMBERS',
    entityType: 'contract',
    id: null,
    path: '$',
    expected: expectedRootKeys,
    observed: observedRootKeys
  });
  const expectedGridKeys = Object.keys(expected.grid).sort();
  const observedGridKeys = observed?.grid
    && typeof observed.grid === 'object'
    && !Array.isArray(observed.grid)
    ? Object.keys(observed.grid).sort()
    : [];
  comparator.add({
    status: JSON.stringify(expectedGridKeys) === JSON.stringify(observedGridKeys) ? 'pass' : 'fail',
    code: 'MEMBERS',
    entityType: 'grid',
    id: null,
    path: 'grid',
    expected: expectedGridKeys,
    observed: observedGridKeys
  });

  for (const [collection, entityType] of [
    ['xAxes', 'x-axis'],
    ['yAxes', 'y-axis'],
    ['zLevels', 'z-level']
  ]) {
    const expectedItems = expected.grid[collection];
    const rawObservedItems = observed?.grid?.[collection];
    const observedItems = Array.isArray(rawObservedItems) ? rawObservedItems : [];
    const path = `grid.${collection}`;
    comparator.bijection(expectedItems, rawObservedItems, path, entityType);
    const actualById = valuesByKey(observedItems, (item) => idKey(item?.id));
    for (const item of expectedItems) {
      comparator.compare(item, actualById.get(idKey(item.id)), pathForId(path, item.id), entityType, item.id);
    }
  }

  const rawObservedElements = observed?.elements;
  const observedElements = Array.isArray(rawObservedElements) ? rawObservedElements : [];
  comparator.bijection(expected.elements, rawObservedElements, 'elements', 'element');
  const actualElementsById = valuesByKey(observedElements, (item) => idKey(item?.id));
  for (const expectedElement of expected.elements) {
    const actualElement = actualElementsById.get(idKey(expectedElement.id));
    const entityType = expectedElement.type;
    const path = pathForId('elements', expectedElement.id);
    if (expectedElement.type === 'wall') {
      const expectedWithoutOpenings = { ...expectedElement };
      const actualWithoutOpenings = actualElement && typeof actualElement === 'object'
        ? { ...actualElement }
        : actualElement;
      delete expectedWithoutOpenings.openings;
      if (actualWithoutOpenings && typeof actualWithoutOpenings === 'object') delete actualWithoutOpenings.openings;
      comparator.compare(expectedWithoutOpenings, actualWithoutOpenings, path, entityType, expectedElement.id);
      const expectedOpenings = expectedElement.openings;
      const actualOpenings = Array.isArray(actualElement?.openings) ? actualElement.openings : [];
      comparator.bijection(expectedOpenings, actualOpenings, `${path}.openings`, 'opening');
      const actualOpeningsById = valuesByKey(actualOpenings, (item) => idKey(item?.id));
      for (const opening of expectedOpenings) {
        comparator.compare(
          opening,
          actualOpeningsById.get(idKey(opening.id)),
          pathForId(`${path}.openings`, opening.id),
          'opening',
          opening.id
        );
      }
    } else {
      comparator.compare(
        canonicalEntity(expectedElement),
        canonicalEntity(actualElement),
        path,
        entityType,
        expectedElement.id
      );
    }
    if (expectedElement.type === 'foundation') {
      const expectedSolids = expectedElement.solids;
      const actualSolids = Array.isArray(actualElement?.solids) ? actualElement.solids : [];
      comparator.bijection(
        expectedSolids,
        actualSolids,
        `${path}.solids`,
        'foundation-layer',
        (item) => `${idKey(expectedElement.id)}:${String(item?.role)}`
      );
    }
  }

  const rawObservedRoofs = observed?.roofGeometry;
  const observedRoofs = Array.isArray(rawObservedRoofs) ? rawObservedRoofs : [];
  comparator.bijection(expected.roofGeometry, rawObservedRoofs, 'roofGeometry', 'roof');
  const actualRoofsById = valuesByKey(observedRoofs, (item) => idKey(item?.id));
  for (const roof of expected.roofGeometry) {
    comparator.compare(
      canonicalEntity(roof),
      canonicalEntity(actualRoofsById.get(idKey(roof.id))),
      pathForId('roofGeometry', roof.id),
      'roof',
      roof.id
    );
  }
}

export function auditAgnosticGeometry(model, geometry, options = {}) {
  const toleranceMm = options.toleranceMm ?? DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM;
  if (!Number.isFinite(toleranceMm) || toleranceMm < 0) {
    throw new RangeError('La tolerancia de auditoría debe ser un número finito no negativo.');
  }
  let expected;
  try {
    expected = reconstructExpectedAgnosticGeometry(model);
  } catch (error) {
    const check = {
      status: 'fail',
      code: 'SOURCE_GEOMETRY',
      entityType: 'source',
      id: null,
      path: '$',
      expected: 'geometría fuente resoluble',
      observed: error.message,
      deviationMm: null
    };
    return {
      schema: AGNOSTIC_GEOMETRY_AUDIT_SCHEMA,
      status: 'fail',
      toleranceMm,
      summary: {
        source: rawCounts(model),
        exported: rawCounts(geometry),
        checks: 1,
        passedChecks: 0,
        failedChecks: 1,
        maximumDeviationMm: 0
      },
      checks: [check]
    };
  }
  const comparator = makeComparator(toleranceMm);
  auditCollections(expected, geometry, comparator);
  comparator.checks.sort((left, right) => {
    const a = `${left.path}\u0000${left.code}\u0000${left.entityType}\u0000${idKey(left.id)}`;
    const b = `${right.path}\u0000${right.code}\u0000${right.entityType}\u0000${idKey(right.id)}`;
    return a.localeCompare(b);
  });
  const failedChecks = comparator.checks.filter(({ status }) => status === 'fail').length;
  return {
    schema: AGNOSTIC_GEOMETRY_AUDIT_SCHEMA,
    status: failedChecks === 0 ? 'pass' : 'fail',
    toleranceMm,
    summary: {
      source: sourceCounts(expected),
      exported: rawCounts(geometry),
      checks: comparator.checks.length,
      passedChecks: comparator.checks.length - failedChecks,
      failedChecks,
      maximumDeviationMm: comparator.getMaximumDeviationMm()
    },
    checks: comparator.checks
  };
}

export function serializeAgnosticGeometryAudit(report) {
  if (!report || report.schema !== AGNOSTIC_GEOMETRY_AUDIT_SCHEMA) {
    throw new TypeError('El informe no cumple agnostic-geometry-audit/v1.');
  }
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function assertAgnosticGeometryAuditPass(report) {
  if (report?.status !== 'pass') throw new AgnosticGeometryAuditError(report);
  return report;
}
