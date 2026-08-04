import { projectAgnosticGeometry } from './agnosticGeometry.js';
import {
  auditAgnosticGeometry,
  reconstructExpectedAgnosticGeometry
} from './agnosticGeometryAudit.js';

export const AGNOSTIC_COMPARISON_MODES = Object.freeze({
  SOURCE: 'source',
  EXPORTED: 'exported',
  OVERLAY: 'overlay'
});

const LAYER_STYLES = Object.freeze({
  source: Object.freeze({
    label: 'Fuente',
    representation: 'solid',
    color: '#2563eb',
    opacity: 0.34
  }),
  exported: Object.freeze({
    label: 'Exportada',
    representation: 'outline',
    color: '#f97316',
    opacity: 1
  })
});

const FAILED_COLOR = '#dc2626';

function idKey(id) {
  return `${typeof id}:${JSON.stringify(id)}`;
}

function compareIds(left, right) {
  return idKey(left).localeCompare(idKey(right));
}

function finite(value, path) {
  if (!Number.isFinite(value)) throw new TypeError(`${path} debe ser un número finito.`);
  return value;
}

export function agnosticPointToThree(point, path = 'point') {
  return {
    x: finite(point?.x, `${path}.x`),
    y: finite(point?.z, `${path}.z`),
    z: finite(point?.y, `${path}.y`)
  };
}

function orientedPrismToScene(prism, path) {
  const start = agnosticPointToThree(prism?.start, `${path}.start`);
  const end = agnosticPointToThree(prism?.end, `${path}.end`);
  const width = finite(prism?.thickness ?? prism?.width, `${path}.width`);
  const height = finite(prism?.height, `${path}.height`);
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (!(length > 0) || !(width > 0) || !(height > 0)) {
    throw new RangeError(`${path} debe definir un prisma positivo.`);
  }
  return {
    kind: 'oriented-prism',
    start,
    end,
    center: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2 + height / 2,
      z: (start.z + end.z) / 2
    },
    size: { x: length, y: height, z: width }
  };
}

function axisAlignedPrismToScene(prism, path) {
  const first = agnosticPointToThree(prism?.min, `${path}.min`);
  const second = agnosticPointToThree(prism?.max, `${path}.max`);
  const min = {
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    z: Math.min(first.z, second.z)
  };
  const max = {
    x: Math.max(first.x, second.x),
    y: Math.max(first.y, second.y),
    z: Math.max(first.z, second.z)
  };
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
  if (!(size.x > 0) || !(size.y > 0) || !(size.z > 0)) {
    throw new RangeError(`${path} debe definir un prisma positivo.`);
  }
  return {
    kind: 'axis-aligned-prism',
    min,
    max,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    },
    size
  };
}

function prismToScene(prism, path) {
  if (prism?.kind === 'oriented-prism') return orientedPrismToScene(prism, path);
  if (prism?.kind === 'axis-aligned-prism') return axisAlignedPrismToScene(prism, path);
  throw new TypeError(`${path}.kind no está soportado por el comparador.`);
}

function entityFailed(failedKeys, id) {
  return failedKeys.has(idKey(id));
}

function buildSceneLayer(snapshot, name, failedKeys) {
  const items = [];
  for (const [index, element] of snapshot.elements.entries()) {
    const path = `${name}.elements[${index}]`;
    if (element.type === 'wall') {
      const openings = element.openings.map((opening, openingIndex) => ({
        id: opening.id,
        kind: opening.kind,
        hostWallId: opening.hostWallId,
        failed: entityFailed(failedKeys, opening.id),
        prism: prismToScene(opening.void, `${path}.openings[${openingIndex}].void`)
      }));
      items.push({
        id: element.id,
        type: element.type,
        failed: entityFailed(failedKeys, element.id) || openings.some(({ failed }) => failed),
        prism: prismToScene(element.prism, `${path}.prism`),
        openings
      });
    } else if (element.type === 'foundation') {
      element.solids.forEach((solid, solidIndex) => items.push({
        id: element.id,
        type: element.type,
        role: solid.role,
        failed: entityFailed(failedKeys, element.id),
        prism: prismToScene(solid.prism, `${path}.solids[${solidIndex}].prism`)
      }));
    } else {
      items.push({
        id: element.id,
        type: element.type,
        failed: entityFailed(failedKeys, element.id),
        prism: prismToScene(element.prism, `${path}.prism`)
      });
    }
  }
  snapshot.roofGeometry.forEach((roof, index) => {
    const boundary = roof.surface?.boundary;
    if (roof.surface?.kind !== 'planar-polygon' || !Array.isArray(boundary) || boundary.length < 3) {
      throw new TypeError(`${name}.roofGeometry[${index}].surface no es una superficie válida.`);
    }
    items.push({
      id: roof.id,
      type: 'roof',
      source: roof.source,
      failed: entityFailed(failedKeys, roof.id),
      boundary: boundary.map((point, pointIndex) => agnosticPointToThree(
        point,
        `${name}.roofGeometry[${index}].surface.boundary[${pointIndex}]`
      ))
    });
  });
  return {
    name,
    style: LAYER_STYLES[name],
    items
  };
}

function emptyBounds() {
  return {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
}

function includePoint(bounds, point) {
  for (const axis of ['x', 'y', 'z']) {
    bounds.min[axis] = Math.min(bounds.min[axis], finite(point[axis], `bounds.${axis}`));
    bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
  }
}

function includePrism(bounds, prism) {
  if (prism.kind === 'axis-aligned-prism') {
    includePoint(bounds, prism.min);
    includePoint(bounds, prism.max);
    return;
  }
  const dx = prism.end.x - prism.start.x;
  const dz = prism.end.z - prism.start.z;
  const length = Math.hypot(dx, dz);
  const nx = -dz / length;
  const nz = dx / length;
  const halfWidth = prism.size.z / 2;
  for (const endpoint of [prism.start, prism.end]) {
    for (const sign of [-1, 1]) {
      includePoint(bounds, {
        x: endpoint.x + nx * halfWidth * sign,
        y: endpoint.y,
        z: endpoint.z + nz * halfWidth * sign
      });
      includePoint(bounds, {
        x: endpoint.x + nx * halfWidth * sign,
        y: endpoint.y + prism.size.y,
        z: endpoint.z + nz * halfWidth * sign
      });
    }
  }
}

function sceneBounds(layers) {
  const bounds = emptyBounds();
  for (const layer of layers) {
    for (const item of layer.items) {
      if (item.prism) includePrism(bounds, item.prism);
      item.openings?.forEach(({ prism }) => includePrism(bounds, prism));
      item.boundary?.forEach((point) => includePoint(bounds, point));
    }
  }
  if (!Number.isFinite(bounds.min.x)) {
    return {
      min: { x: -500, y: -500, z: -500 },
      max: { x: 500, y: 500, z: 500 },
      center: { x: 0, y: 0, z: 0 },
      size: { x: 1000, y: 1000, z: 1000 },
      span: 1000
    };
  }
  const size = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z
  };
  return {
    ...bounds,
    center: {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2
    },
    size,
    span: Math.max(size.x, size.y, size.z, 1000)
  };
}

export function visibleAgnosticComparisonLayers(comparison, mode) {
  if (mode === AGNOSTIC_COMPARISON_MODES.SOURCE) return [comparison.layers.source];
  if (mode === AGNOSTIC_COMPARISON_MODES.EXPORTED) return [comparison.layers.exported];
  if (mode === AGNOSTIC_COMPARISON_MODES.OVERLAY) {
    return [comparison.layers.source, comparison.layers.exported];
  }
  throw new RangeError(`Modo de comparación desconocido: ${String(mode)}.`);
}

export function prepareAgnosticGeometryComparison(model, options = {}) {
  const projectGeometry = options.projectGeometry ?? projectAgnosticGeometry;
  const source = reconstructExpectedAgnosticGeometry(model);
  const exported = projectGeometry(model);
  const report = auditAgnosticGeometry(model, exported, { toleranceMm: options.toleranceMm });
  const failedChecks = report.checks.filter(({ status }) => status === 'fail');
  const failedEntityIds = [...new Map(failedChecks
    .filter(({ id }) => id !== null && id !== undefined)
    .map(({ id }) => [idKey(id), id])).values()].sort(compareIds);
  const failedKeys = new Set(failedEntityIds.map(idKey));
  const sourceLayer = buildSceneLayer(source, 'source', failedKeys);
  const exportedLayer = buildSceneLayer(exported, 'exported', failedKeys);
  const layers = { source: sourceLayer, exported: exportedLayer };
  return {
    source,
    exported,
    report,
    failedEntityIds,
    firstDifference: failedChecks[0] ?? null,
    layers,
    bounds: sceneBounds([sourceLayer, exportedLayer]),
    legend: [
      { ...LAYER_STYLES.source },
      { ...LAYER_STYLES.exported },
      { label: 'Diferencia', representation: 'highlight', color: FAILED_COLOR, opacity: 1 }
    ]
  };
}

export const AGNOSTIC_COMPARISON_FAILED_COLOR = FAILED_COLOR;
