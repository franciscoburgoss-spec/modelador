import { projectAgnosticGeometry } from './agnosticGeometry.js';

export const STRUCTURAL_INTENT_VISUAL_CONTRACT = 'structural-intent-visual-presentation-v1.0';
export const STRUCTURAL_INTENT_VISUAL_STATES = Object.freeze([
  'available',
  'unsupportedVisualType',
  'brokenReference',
  'invalidGeometry'
]);

const GRID_TOLERANCE = 0.1;
const CONTEXT_LIMIT = 24;
const TYPE_ORDER = new Map([
  ['wall', 0], ['column', 1], ['beam', 2], ['foundation', 3]
]);

export class StructuralIntentVisualError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StructuralIntentVisualError';
    this.code = code;
    this.details = details;
  }
}

function idToken(id) {
  return `${typeof id}:${String(id)}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareIds(left, right) {
  return compareText(idToken(left), idToken(right));
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return normalizeZero(Math.round((Number(value) + Number.EPSILON) * factor) / factor);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(round(value));
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(value) {
  const source = new globalThis.TextEncoder().encode(value);
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const bitLength = source.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const words = new Uint32Array(64);
  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
  }
  return [...state].map((item) => item.toString(16).padStart(8, '0')).join('');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, canonical(value[key])]));
  }
  return typeof value === 'number' ? round(value) : value;
}

function finite(value, path) {
  if (!Number.isFinite(value)) {
    throw new StructuralIntentVisualError('SI-VISUAL-GEOMETRY-INVALID', `${path} no es finito.`, { path });
  }
  return value;
}

function buildGridIndex(model) {
  const normalize = (entries, coordinate, valueKey) => (entries || []).map((entry) => ({
    id: entry.id,
    label: entry.label == null || entry.label === '' ? String(entry.id) : String(entry.label),
    coordinate: finite(Number(entry[valueKey]), `${coordinate}.${String(entry.id)}`)
  })).sort((left, right) => left.coordinate - right.coordinate || compareIds(left.id, right.id));
  return {
    x: normalize(model.grid?.xAxes, 'grid.xAxes', 'position'),
    y: normalize(model.grid?.yAxes, 'grid.yAxes', 'position'),
    z: normalize(model.grid?.zLevels, 'grid.zLevels', 'elevation')
  };
}

function nominalAt(index, value, tolerance = GRID_TOLERANCE) {
  return index.find((entry) => Math.abs(entry.coordinate - value) <= tolerance) || null;
}

function planPolygon(start, end, breadth) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(breadth > 0)) {
    throw new StructuralIntentVisualError('SI-VISUAL-GEOMETRY-INVALID', 'El prisma orientado no tiene longitud o ancho positivo.');
  }
  const nx = -dy / length * breadth / 2;
  const ny = dx / length * breadth / 2;
  return [
    { x: round(start.x + nx), y: round(start.y + ny) },
    { x: round(end.x + nx), y: round(end.y + ny) },
    { x: round(end.x - nx), y: round(end.y - ny) },
    { x: round(start.x - nx), y: round(start.y - ny) }
  ];
}


function orientedPrismBounds(start, end, breadth, z0, z1) {
  const half = breadth / 2;
  return {
    xMin: round(Math.min(start.x, end.x) - half),
    xMax: round(Math.max(start.x, end.x) + half),
    yMin: round(Math.min(start.y, end.y) - half),
    yMax: round(Math.max(start.y, end.y) + half),
    zMin: round(z0),
    zMax: round(z1)
  };
}

function boundsFromPoints(points, z0, z1) {
  return {
    xMin: round(Math.min(...points.map((point) => point.x))),
    xMax: round(Math.max(...points.map((point) => point.x))),
    yMin: round(Math.min(...points.map((point) => point.y))),
    yMax: round(Math.max(...points.map((point) => point.y))),
    zMin: round(z0),
    zMax: round(z1)
  };
}

function unionBounds(boundsList) {
  if (boundsList.length === 0) return null;
  return {
    xMin: round(Math.min(...boundsList.map((bounds) => bounds.xMin))),
    xMax: round(Math.max(...boundsList.map((bounds) => bounds.xMax))),
    yMin: round(Math.min(...boundsList.map((bounds) => bounds.yMin))),
    yMax: round(Math.max(...boundsList.map((bounds) => bounds.yMax))),
    zMin: round(Math.min(...boundsList.map((bounds) => bounds.zMin))),
    zMax: round(Math.max(...boundsList.map((bounds) => bounds.zMax)))
  };
}

function axisDescriptor(runAxis, startRun, endRun, fixed, grid) {
  const runIndex = grid[runAxis];
  const fixedIndex = grid[runAxis === 'x' ? 'y' : 'x'];
  const from = nominalAt(runIndex, startRun);
  const to = nominalAt(runIndex, endRun);
  const at = nominalAt(fixedIndex, fixed);
  return {
    runAxis: runAxis.toUpperCase(),
    fromLabel: from?.label ?? null,
    toLabel: to?.label ?? null,
    fixedLabel: at?.label ?? null,
    nominal: from && to && at ? `${from.label}→${to.label} @ ${at.label}` : null,
    coordinates: runAxis === 'x'
      ? `x=${formatNumber(startRun)}→${formatNumber(endRun)} · y=${formatNumber(fixed)}`
      : `y=${formatNumber(startRun)}→${formatNumber(endRun)} · x=${formatNumber(fixed)}`
  };
}

function levelDescriptor(z0, z1, grid) {
  const bottom = nominalAt(grid.z, z0);
  const top = nominalAt(grid.z, z1);
  return {
    bottomLabel: bottom?.label ?? null,
    topLabel: top?.label ?? null,
    nominal: bottom && top ? `${bottom.label} ${formatNumber(z0)} → ${top.label} ${formatNumber(z1)}` : null,
    coordinates: `z=${formatNumber(z0)}→${formatNumber(z1)}`
  };
}

function wallTarget(element, grid) {
  const { start, end, thickness, height } = element.prism;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const runAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const startRun = runAxis === 'x' ? Math.min(start.x, end.x) : Math.min(start.y, end.y);
  const endRun = runAxis === 'x' ? Math.max(start.x, end.x) : Math.max(start.y, end.y);
  const fixed = runAxis === 'x' ? start.y : start.x;
  const z0 = start.z;
  const z1 = z0 + height;
  const polygon = planPolygon(start, end, thickness);
  const axis = axisDescriptor(runAxis, startRun, endRun, fixed, grid);
  const levels = levelDescriptor(z0, z1, grid);
  const openings = [...(element.openings || [])].sort((left, right) => compareIds(left.id, right.id)).map((opening) => {
    if (idToken(opening.hostWallId) !== idToken(element.id)) {
      throw new StructuralIntentVisualError(
        'SI-VISUAL-OPENING-HOST-NOT-FOUND',
        `El vano ${String(opening.id)} no referencia al muro ${String(element.id)}.`,
        { openingId: opening.id, hostWallId: opening.hostWallId }
      );
    }
    const local0 = runAxis === 'x' ? opening.void.start.x - startRun : opening.void.start.y - startRun;
    const local1 = runAxis === 'x' ? opening.void.end.x - startRun : opening.void.end.y - startRun;
    return {
      id: opening.id,
      kind: opening.kind,
      hostWallId: opening.hostWallId,
      localS0: round(Math.min(local0, local1)),
      localS1: round(Math.max(local0, local1)),
      z0: round(opening.void.start.z),
      z1: round(opening.void.start.z + opening.void.height),
      width: round(Math.abs(local1 - local0)),
      height: round(opening.void.height),
      planGeometry: { polygon: planPolygon(opening.void.start, opening.void.end, opening.void.thickness) }
    };
  });
  const descriptor = {
    typeLabel: 'Muro',
    orientation: runAxis.toUpperCase(),
    axis,
    levels,
    dimensions: {
      length: round(length), thickness: round(thickness), height: round(height), openings: openings.length
    },
    id: element.id
  };
  descriptor.summary = `Muro ${descriptor.orientation} · ${axis.nominal || axis.coordinates} · ${levels.nominal || levels.coordinates} · L ${formatNumber(length)} · e ${formatNumber(thickness)} · h ${formatNumber(height)} · ${openings.length} vano${openings.length === 1 ? '' : 's'} · ID ${String(element.id)}`;
  return {
    descriptor,
    planGeometry: { kind: 'oriented-polygon', polygon, centerline: [start, end].map(({ x, y }) => ({ x: round(x), y: round(y) })) },
    elevationGeometry: {
      kind: 'wall-elevation', axis: runAxis.toUpperCase(),
      rect: { s0: 0, s1: round(length), z0: round(z0), z1: round(z1) },
      openings: openings.map(({ id, kind, localS0, localS1, z0: openingZ0, z1: openingZ1 }) => ({ id, kind, s0: localS0, s1: localS1, z0: openingZ0, z1: openingZ1 }))
    },
    openings,
    bounds: orientedPrismBounds(start, end, thickness, z0, z1)
  };
}

function columnTarget(element, grid) {
  const { min, max } = element.prism;
  const polygon = [
    { x: min.x, y: min.y }, { x: max.x, y: min.y },
    { x: max.x, y: max.y }, { x: min.x, y: max.y }
  ].map(({ x, y }) => ({ x: round(x), y: round(y) }));
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const xAxis = nominalAt(grid.x, cx);
  const yAxis = nominalAt(grid.y, cy);
  const levels = levelDescriptor(min.z, max.z, grid);
  const descriptor = {
    typeLabel: 'Pilar',
    axes: xAxis && yAxis ? `${xAxis.label} @ ${yAxis.label}` : null,
    coordinates: `x=${formatNumber(cx)} · y=${formatNumber(cy)}`,
    levels,
    dimensions: { widthX: round(max.x - min.x), widthY: round(max.y - min.y), height: round(max.z - min.z) },
    id: element.id
  };
  descriptor.summary = `Pilar · ${descriptor.axes || descriptor.coordinates} · ${levels.nominal || levels.coordinates} · X ${formatNumber(descriptor.dimensions.widthX)} · Y ${formatNumber(descriptor.dimensions.widthY)} · h ${formatNumber(descriptor.dimensions.height)} · ID ${String(element.id)}`;
  return {
    descriptor,
    planGeometry: { kind: 'axis-aligned-polygon', polygon },
    elevationGeometry: { kind: 'column-elevation', rect: { s0: 0, s1: descriptor.dimensions.widthX, z0: round(min.z), z1: round(max.z) } },
    openings: [],
    bounds: { xMin: round(min.x), xMax: round(max.x), yMin: round(min.y), yMax: round(max.y), zMin: round(min.z), zMax: round(max.z) }
  };
}

function beamTarget(element, grid) {
  const { start, end, width, height } = element.prism;
  const runAxis = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'x' : 'y';
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const startRun = runAxis === 'x' ? Math.min(start.x, end.x) : Math.min(start.y, end.y);
  const endRun = runAxis === 'x' ? Math.max(start.x, end.x) : Math.max(start.y, end.y);
  const fixed = runAxis === 'x' ? start.y : start.x;
  const polygon = planPolygon(start, end, width);
  const axis = axisDescriptor(runAxis, startRun, endRun, fixed, grid);
  const z0 = start.z - height;
  const z1 = start.z;
  const levels = levelDescriptor(z0, z1, grid);
  const descriptor = {
    typeLabel: 'Viga', orientation: runAxis.toUpperCase(), axis, levels,
    dimensions: { length: round(length), width: round(width), height: round(height) }, id: element.id
  };
  descriptor.summary = `Viga ${descriptor.orientation} · ${axis.nominal || axis.coordinates} · ${levels.nominal || levels.coordinates} · L ${formatNumber(length)} · a ${formatNumber(width)} · h ${formatNumber(height)} · ID ${String(element.id)}`;
  return {
    descriptor,
    planGeometry: { kind: 'oriented-polygon', polygon, centerline: [start, end].map(({ x, y }) => ({ x: round(x), y: round(y) })) },
    elevationGeometry: { kind: 'beam-elevation', axis: runAxis.toUpperCase(), rect: { s0: 0, s1: round(length), z0: round(z0), z1: round(z1) } },
    openings: [], bounds: orientedPrismBounds(start, end, width, z0, z1)
  };
}

function foundationTarget(element) {
  const solids = [...(element.solids || [])].sort((left, right) => compareText(left.role, right.role)).map((solid) => ({
    role: solid.role,
    prism: canonical(solid.prism)
  }));
  if (solids.length === 0) throw new StructuralIntentVisualError('SI-VISUAL-GEOMETRY-INVALID', `La fundación ${String(element.id)} no contiene sólidos.`);
  const bounds = unionBounds(solids.map(({ prism }) => ({
    xMin: prism.min.x, xMax: prism.max.x, yMin: prism.min.y, yMax: prism.max.y,
    zMin: prism.min.z, zMax: prism.max.z
  })));
  const descriptor = {
    typeLabel: 'Fundación', kind: element.kind,
    coordinates: `x=${formatNumber(bounds.xMin)}→${formatNumber(bounds.xMax)} · y=${formatNumber(bounds.yMin)}→${formatNumber(bounds.yMax)}`,
    levels: `z=${formatNumber(bounds.zMin)}→${formatNumber(bounds.zMax)}`,
    dimensions: { solids: solids.length }, id: element.id
  };
  descriptor.summary = `Fundación ${element.kind || ''} · ${descriptor.coordinates} · ${descriptor.levels} · ${solids.length} sólido${solids.length === 1 ? '' : 's'} · ID ${String(element.id)}`;
  return {
    descriptor,
    planGeometry: {
      kind: 'foundation-solids',
      solids: solids.map(({ role, prism }) => ({ role, polygon: [
        { x: prism.min.x, y: prism.min.y }, { x: prism.max.x, y: prism.min.y },
        { x: prism.max.x, y: prism.max.y }, { x: prism.min.x, y: prism.max.y }
      ].map(({ x, y }) => ({ x: round(x), y: round(y) })) }))
    },
    elevationGeometry: {
      kind: 'foundation-elevation',
      solids: solids.map(({ role, prism }) => ({ role, rect: { s0: round(prism.min.x), s1: round(prism.max.x), z0: round(prism.min.z), z1: round(prism.max.z) } }))
    },
    openings: [], bounds: canonical(bounds), solids
  };
}

function targetFromElement(element, grid) {
  let visual;
  if (element.type === 'wall') visual = wallTarget(element, grid);
  else if (element.type === 'column') visual = columnTarget(element, grid);
  else if (element.type === 'beam') visual = beamTarget(element, grid);
  else if (element.type === 'foundation') visual = foundationTarget(element, grid);
  else {
    return {
      id: element.id, idToken: idToken(element.id), type: element.type,
      descriptor: { typeLabel: 'Tipo visual no soportado', id: element.id, summary: `Tipo ${String(element.type)} no soportado · ID ${String(element.id)}` },
      planGeometry: null, elevationGeometry: null, openings: [], bounds: null,
      geometryFingerprint: sha256(JSON.stringify(canonical({ contract: STRUCTURAL_INTENT_VISUAL_CONTRACT, id: element.id, type: element.type }))),
      state: 'unsupportedVisualType', error: { code: 'SI-VISUAL-UNSUPPORTED-TYPE', message: `No existe presentador para ${String(element.type)}.` }
    };
  }
  const fingerprintPayload = canonical({
    contract: STRUCTURAL_INTENT_VISUAL_CONTRACT,
    id: element.id,
    type: element.type,
    descriptor: visual.descriptor,
    planGeometry: visual.planGeometry,
    elevationGeometry: visual.elevationGeometry,
    openings: visual.openings,
    solids: visual.solids || null
  });
  return {
    id: element.id,
    idToken: idToken(element.id),
    type: element.type,
    ...visual,
    geometryFingerprint: sha256(JSON.stringify(fingerprintPayload)),
    state: 'available'
  };
}

function brokenTarget(intent) {
  const id = intent.elementId;
  const descriptor = {
    typeLabel: 'Referencia rota', id,
    summary: `Referencia rota · elemento ${String(id)} no existe en la geometría vigente.`
  };
  return {
    id, idToken: idToken(id), type: 'unknown', descriptor,
    planGeometry: null, elevationGeometry: null, openings: [], bounds: null,
    geometryFingerprint: sha256(JSON.stringify(canonical({ contract: STRUCTURAL_INTENT_VISUAL_CONTRACT, id, state: 'brokenReference' }))),
    state: 'brokenReference', error: { code: 'SI-VISUAL-TARGET-NOT-FOUND', message: descriptor.summary }, intent
  };
}

export function buildStructuralIntentVisualPresentation(model, options = {}) {
  const geometry = projectAgnosticGeometry(model);
  const grid = buildGridIndex(model);
  const targets = geometry.elements.map((element) => {
    try {
      return targetFromElement(element, grid);
    } catch (error) {
      return {
        id: element.id, idToken: idToken(element.id), type: element.type,
        descriptor: { typeLabel: 'Geometría inválida', id: element.id, summary: error.message },
        planGeometry: null, elevationGeometry: null, openings: [], bounds: null,
        geometryFingerprint: sha256(JSON.stringify(canonical({ contract: STRUCTURAL_INTENT_VISUAL_CONTRACT, id: element.id, state: 'invalidGeometry', message: error.message }))),
        state: 'invalidGeometry', error: { code: error.code || 'SI-VISUAL-GEOMETRY-INVALID', message: error.message }
      };
    }
  }).sort((left, right) => {
    const typeOrder = (TYPE_ORDER.get(left.type) ?? 99) - (TYPE_ORDER.get(right.type) ?? 99);
    return typeOrder || compareIds(left.id, right.id);
  });
  const targetTokens = new Set(targets.map((target) => target.idToken));
  const orphans = (model.structuralIntent?.elementIntents || [])
    .filter((intent) => !targetTokens.has(idToken(intent.elementId)))
    .map(brokenTarget)
    .sort((left, right) => compareIds(left.id, right.id));
  const output = {
    runtimeContract: STRUCTURAL_INTENT_VISUAL_CONTRACT,
    sourceSchema: geometry.schema,
    tolerance: options.gridTolerance ?? GRID_TOLERANCE,
    targets,
    orphans
  };
  output.presentationSha256 = sha256(JSON.stringify(canonical(output)));
  return output;
}

function distanceBetweenBounds(left, right) {
  const dx = Math.max(0, left.xMin - right.xMax, right.xMin - left.xMax);
  const dy = Math.max(0, left.yMin - right.yMax, right.yMin - left.yMax);
  return Math.hypot(dx, dy);
}

function zTouches(left, right, tolerance = GRID_TOLERANCE) {
  return Math.min(left.zMax, right.zMax) - Math.max(left.zMin, right.zMin) >= -tolerance;
}

export function buildStructuralIntentVisualPreview(presentation, targetIds, options = {}) {
  const uniqueTokens = new Set();
  const selected = [];
  const lookup = new Map([...presentation.targets, ...presentation.orphans].map((target) => [target.idToken, target]));
  for (const id of targetIds || []) {
    const token = idToken(id);
    if (uniqueTokens.has(token)) continue;
    uniqueTokens.add(token);
    selected.push(lookup.get(token) || brokenTarget({ elementId: id }));
  }
  selected.sort((left, right) => compareIds(left.id, right.id));
  const validTargets = selected.filter((target) => target.state === 'available' && target.bounds);
  const targetBounds = unionBounds(validTargets.map((target) => target.bounds));
  const maxDimension = targetBounds ? Math.max(targetBounds.xMax - targetBounds.xMin, targetBounds.yMax - targetBounds.yMin) : 0;
  const contextDistance = Math.max(1200, 0.15 * maxDimension);
  const selectedTokens = new Set(selected.map((target) => target.idToken));
  const context = targetBounds ? presentation.targets
    .filter((target) => target.type === 'wall' && target.state === 'available' && target.bounds && !selectedTokens.has(target.idToken))
    .map((target) => ({ target, distance: distanceBetweenBounds(targetBounds, target.bounds) }))
    .filter(({ target, distance }) => distance <= contextDistance && zTouches(targetBounds, target.bounds))
    .sort((left, right) => left.distance - right.distance || compareIds(left.target.id, right.target.id))
    .slice(0, options.contextLimit ?? CONTEXT_LIMIT)
    .map(({ target, distance }) => ({ ...target, contextDistance: round(distance) })) : [];
  const visibleBounds = unionBounds([...validTargets, ...context].map((target) => target.bounds));
  const visibleDimension = visibleBounds ? Math.max(visibleBounds.xMax - visibleBounds.xMin, visibleBounds.yMax - visibleBounds.yMin) : 0;
  const margin = Math.max(700, 0.08 * visibleDimension);
  const markByToken = new Map(selected.map((target, index) => [target.idToken, selected.length === 1 ? 'T' : `S${index + 1}`]));
  const activeToken = idToken(options.activeId ?? selected[0]?.id);
  const preview = {
    runtimeContract: STRUCTURAL_INTENT_VISUAL_CONTRACT,
    selected: selected.map((target) => ({ ...target, mark: markByToken.get(target.idToken), active: target.idToken === activeToken })),
    context,
    targetBounds,
    visibleBounds,
    margin: round(margin),
    contextDistance: round(contextDistance),
    activeId: lookup.get(activeToken)?.id ?? selected[0]?.id ?? null,
    stale: false,
    brokenReferences: selected.filter((target) => target.state === 'brokenReference').map((target) => target.id),
    invalidTargets: selected.filter((target) => !['available', 'brokenReference'].includes(target.state)).map((target) => target.id)
  };
  preview.canUse = selected.length > 0 && preview.brokenReferences.length === 0 && preview.invalidTargets.length === 0;
  return preview;
}

export function visualFingerprintSnapshot(presentation, targetIds) {
  const lookup = new Map([...presentation.targets, ...presentation.orphans].map((target) => [target.idToken, target]));
  return [...targetIds].sort(compareIds).map((id) => {
    const target = lookup.get(idToken(id));
    return { elementId: id, geometryFingerprint: target?.geometryFingerprint ?? null, state: target?.state ?? 'brokenReference' };
  });
}

export function compareVisualFingerprintSnapshot(presentation, snapshot) {
  const current = visualFingerprintSnapshot(presentation, (snapshot || []).map((item) => item.elementId));
  const expected = new Map((snapshot || []).map((item) => [idToken(item.elementId), item]));
  const conflicts = current.filter((item) => {
    const before = expected.get(idToken(item.elementId));
    return !before || before.geometryFingerprint !== item.geometryFingerprint || before.state !== item.state;
  }).map((item) => ({
    elementId: item.elementId,
    code: item.state === 'brokenReference' ? 'SI-VISUAL-TARGET-NOT-FOUND' : 'SI-VISUAL-PREVIEW-STALE',
    message: item.state === 'brokenReference'
      ? `El elemento ${String(item.elementId)} ya no existe.`
      : `La geometría de ${String(item.elementId)} cambió desde la preview.`
  }));
  return { ok: conflicts.length === 0, current, conflicts };
}
