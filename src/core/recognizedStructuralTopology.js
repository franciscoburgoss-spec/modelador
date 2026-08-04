import {
  SPEC14_SOURCE_SCHEMA,
  Spec14InputError,
  consumeSpec14Input
} from './spec14Input.js';

export const RECOGNIZED_TOPOLOGY_SCHEMA = 'recognized-structural-topology-v1.0';
export const SPEC14_RECOGNITION_DEFAULTS = Object.freeze({
  linearTolerance: 0.1,
  levelTolerance: 0.1,
  angularToleranceDeg: 0.001,
  minimumOverlap: 0.1,
  minimumSupportOverlap: 38,
  minimumSegmentLength: 0.1,
  openingProximityReviewDistance: 150,
  defaultAssemblyEnvelope: null,
  roundDecimals: 3
});

const PHASES_EXECUTED = Object.freeze(['R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
const PHASES_PENDING = Object.freeze([
  'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'
]);
const CONFIG_KEYS = new Set(Object.keys(SPEC14_RECOGNITION_DEFAULTS));
const NODE_ROLE_PRIORITY = Object.freeze([
  'wallEnd', 'openingEdge', 'wallIntersection', 'stackBoundary', 'auxiliary'
]);
const SHA256_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export class TopologyRecognitionError extends Error {
  constructor(code, message, { path = '$', ids = [] } = {}) {
    super(message);
    this.name = 'TopologyRecognitionError';
    this.code = code;
    this.path = path;
    this.ids = [...new Set(ids)];
  }
}

function fail(code, message, path = '$', ids = []) {
  throw new TopologyRecognitionError(code, message, { path, ids });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function idToken(id) {
  return `${typeof id === 'number' ? 'n' : 's'}:${JSON.stringify(id)}`;
}

function compareIds(left, right) {
  return compareText(idToken(left), idToken(right));
}

function compareEntitiesById(left, right) {
  return compareIds(left.id, right.id);
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  return normalizeZero(Math.round((value + Number.EPSILON) * factor) / factor);
}

function strictlyGreater(value, threshold) {
  const epsilon = Math.max(
    1e-12,
    Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(threshold)) * 16
  );
  return value - threshold > epsilon;
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
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7)
        ^ rightRotate(words[index - 15], 18)
        ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17)
        ^ rightRotate(words[index - 2], 19)
        ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const first = (h + sigma1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const second = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + first) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (first + second) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
}

function normalizeConfig(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    fail('INVALID_RECOGNITION_CONFIG', 'recognitionConfig debe ser un objeto.', 'recognitionConfig');
  }
  for (const key of Object.keys(overrides)) {
    if (!CONFIG_KEYS.has(key)) {
      fail(
        'INVALID_RECOGNITION_CONFIG',
        `recognitionConfig.${key} no pertenece al contrato.`,
        'recognitionConfig'
      );
    }
  }
  const config = { ...SPEC14_RECOGNITION_DEFAULTS, ...overrides };
  for (const key of [
    'linearTolerance', 'levelTolerance', 'angularToleranceDeg', 'minimumOverlap',
    'minimumSupportOverlap', 'minimumSegmentLength', 'openingProximityReviewDistance'
  ]) {
    if (!Number.isFinite(config[key]) || config[key] < 0) {
      fail(
        'INVALID_RECOGNITION_CONFIG',
        `recognitionConfig.${key} debe ser finito y no negativo.`,
        'recognitionConfig'
      );
    }
  }
  if (config.angularToleranceDeg > 90) {
    fail(
      'INVALID_RECOGNITION_CONFIG',
      'recognitionConfig.angularToleranceDeg no puede superar 90 grados.',
      'recognitionConfig'
    );
  }
  if (
    config.defaultAssemblyEnvelope !== null
    && (!Number.isFinite(config.defaultAssemblyEnvelope) || config.defaultAssemblyEnvelope < 0)
  ) {
    fail(
      'INVALID_RECOGNITION_CONFIG',
      'recognitionConfig.defaultAssemblyEnvelope debe ser null o un número no negativo.',
      'recognitionConfig'
    );
  }
  if (!Number.isInteger(config.roundDecimals) || config.roundDecimals < 0 || config.roundDecimals > 12) {
    fail(
      'INVALID_RECOGNITION_CONFIG',
      'recognitionConfig.roundDecimals debe ser un entero entre 0 y 12.',
      'recognitionConfig'
    );
  }
  return config;
}

function mapInputError(error) {
  if (!(error instanceof Spec14InputError)) throw error;
  const code = error.code === 'DUPLICATE_ID' ? 'RT-REF-DUPLICATE-ID'
    : error.code === 'UNRESOLVED_REFERENCE' ? 'RT-REF-NOT-FOUND'
      : error.code;
  throw new TopologyRecognitionError(code, error.message, {
    path: error.path,
    ids: error.ids
  });
}

function requireFinite(value, path, ids) {
  if (!Number.isFinite(value)) {
    fail('NON_FINITE_GEOMETRY', `${path} debe ser finito.`, path, ids);
  }
  return value;
}

function prismFrame(prism, path, id, config, subject = 'wall') {
  const ids = [id];
  if (prism?.kind !== 'oriented-prism') {
    fail(
      subject === 'wall' ? 'RT-WALL-DIRECTION-MISMATCH' : 'INVALID_OPENING_GEOMETRY',
      `${path} debe ser un prisma orientado.`,
      `${path}.kind`,
      ids
    );
  }
  const start = prism.start ?? {};
  const end = prism.end ?? {};
  for (const [name, pointValue] of [['start', start], ['end', end]]) {
    for (const coordinate of ['x', 'y', 'z']) {
      requireFinite(pointValue[coordinate], `${path}.${name}.${coordinate}`, ids);
    }
  }
  const thickness = requireFinite(prism.thickness, `${path}.thickness`, ids);
  const height = requireFinite(prism.height, `${path}.height`, ids);
  if (!(thickness > 0)) {
    fail('INVALID_DIMENSION', `${path}.thickness debe ser positivo.`, `${path}.thickness`, ids);
  }
  if (!(height > 0)) {
    fail(
      subject === 'wall' ? 'RT-WALL-Z-INVALID' : 'INVALID_OPENING_GEOMETRY',
      `${path}.height debe ser positivo.`,
      `${path}.height`,
      ids
    );
  }
  if (Math.abs(start.z - end.z) > config.levelTolerance) {
    fail(
      subject === 'wall' ? 'RT-WALL-DIRECTION-MISMATCH' : 'INVALID_OPENING_GEOMETRY',
      `${path} no es horizontal.`,
      `${path}.end`,
      ids
    );
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const projectedLength = Math.hypot(dx, dy);
  const requiredLength = subject === 'wall' ? config.minimumSegmentLength : 0;
  if (!(projectedLength > requiredLength)) {
    fail(
      subject === 'wall' ? 'RT-WALL-ZERO-LENGTH' : 'INVALID_OPENING_GEOMETRY',
      `${path} no tiene longitud positiva suficiente.`,
      path,
      ids
    );
  }
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const minor = axis === 'x' ? Math.abs(dy) : Math.abs(dx);
  const angle = Math.atan2(minor, Math.max(Math.abs(dx), Math.abs(dy))) * 180 / Math.PI;
  if (angle > config.angularToleranceDeg) {
    fail(
      subject === 'wall' ? 'RT-WALL-DIRECTION-MISMATCH' : 'INVALID_OPENING_GEOMETRY',
      `${path} no sigue un eje ortogonal dentro de la tolerancia angular.`,
      `${path}.end`,
      ids
    );
  }
  const runStart = start[axis];
  const runEnd = end[axis];
  const fixedAxis = axis === 'x' ? 'y' : 'x';
  const z0 = (start.z + end.z) / 2;
  return {
    axis,
    fixed: (start[fixedAxis] + end[fixedAxis]) / 2,
    s0: Math.min(runStart, runEnd),
    s1: Math.max(runStart, runEnd),
    z0,
    z1: z0 + height,
    length: Math.abs(runEnd - runStart),
    height,
    thickness
  };
}

function normalizeWall(wall, index, config) {
  const path = `elements[${index}].prism`;
  const frame = prismFrame(wall.prism, path, wall.id, config);
  if (!(frame.length > config.minimumSegmentLength)) {
    fail(
      'RT-WALL-ZERO-LENGTH',
      `El muro ${String(wall.id)} no supera MIN_SEGMENT.`,
      path,
      [wall.id]
    );
  }
  return {
    ...frame,
    id: wall.id,
    sourceIndex: index,
    source: wall
  };
}

function normalizeOpening(opening, openingIndex, wall, config) {
  const path = `elements[${wall.sourceIndex}].openings[${openingIndex}].void`;
  const ids = [opening.id, wall.id];
  if (!['door', 'window'].includes(opening.kind)) {
    fail(
      'UNKNOWN_ELEMENT_TYPE',
      `El vano ${String(opening.id)} no declara door o window.`,
      `elements[${wall.sourceIndex}].openings[${openingIndex}].kind`,
      ids
    );
  }
  const frame = prismFrame(opening.void, path, opening.id, config, 'opening');
  if (frame.axis !== wall.axis || Math.abs(frame.fixed - wall.fixed) > config.linearTolerance) {
    fail(
      'RT-OPENING-OUTSIDE-WALL',
      `El vano ${String(opening.id)} no sigue la línea de su muro.`,
      path,
      ids
    );
  }
  if (frame.thickness > wall.thickness + 2 * config.linearTolerance) {
    fail(
      'RT-OPENING-OUTSIDE-WALL',
      `El vano ${String(opening.id)} excede el espesor de su muro.`,
      path,
      ids
    );
  }
  if (
    frame.s0 < wall.s0 - config.linearTolerance
    || frame.s1 > wall.s1 + config.linearTolerance
  ) {
    fail(
      'RT-OPENING-OUTSIDE-WALL',
      `El vano ${String(opening.id)} queda fuera del dominio longitudinal.`,
      path,
      ids
    );
  }
  if (
    frame.z0 < wall.z0 - config.levelTolerance
    || frame.z1 > wall.z1 + config.levelTolerance
  ) {
    fail(
      'RT-OPENING-Z-OUTSIDE-WALL',
      `El vano ${String(opening.id)} queda fuera del dominio vertical.`,
      path,
      ids
    );
  }
  return {
    id: opening.id,
    kind: opening.kind,
    hostWallId: wall.id,
    axis: frame.axis,
    fixed: frame.fixed,
    s0: frame.s0,
    s1: frame.s1,
    localS0: frame.s0 - wall.s0,
    localS1: frame.s1 - wall.s0,
    z0: frame.z0,
    z1: frame.z1,
    width: frame.length,
    height: frame.height,
    thickness: frame.thickness
  };
}

function relationSort(left, right) {
  return compareText(left.id, right.id);
}

function findingSort(left, right) {
  return compareText(left.code, right.code)
    || compareText(left.ids.map(idToken).join('|'), right.ids.map(idToken).join('|'));
}

function geometrySort(left, right) {
  return left.s0 - right.s0
    || left.s1 - right.s1
    || left.z0 - right.z0
    || left.z1 - right.z1
    || compareIds(left.id, right.id);
}

function lineKey(axis, fixed, decimals) {
  return `axis=${axis}|fixed=${roundNumber(fixed, decimals).toFixed(decimals)}`;
}

function buildSupportLines(walls, config) {
  const lines = [];
  for (const axis of ['x', 'y']) {
    const candidates = walls.filter((wall) => wall.axis === axis).sort((left, right) => (
      left.fixed - right.fixed || geometrySort(left, right)
    ));
    for (const wall of candidates) {
      let line = lines.find((candidate) => (
        candidate.axis === axis
        && wall.fixed - candidate.anchor <= config.linearTolerance
      ));
      if (!line) {
        line = { axis, anchor: wall.fixed, walls: [] };
        lines.push(line);
      }
      line.walls.push(wall);
    }
  }
  return lines.map((line) => ({
    ...line,
    id: lineKey(line.axis, line.anchor, config.roundDecimals),
    walls: line.walls.sort(geometrySort)
  })).sort((left, right) => compareText(left.id, right.id));
}

function pairRelation(first, second, line, config) {
  const overlapS = Math.min(first.s1, second.s1) - Math.max(first.s0, second.s0);
  const gapS = Math.max(first.s0, second.s0) - Math.min(first.s1, second.s1);
  const overlapZ = Math.min(first.z1, second.z1) - Math.max(first.z0, second.z0);
  let type = null;
  if (
    strictlyGreater(overlapS, config.minimumOverlap)
    && strictlyGreater(overlapZ, config.minimumOverlap)
  ) {
    type = 'COLLINEAR_OVERLAP';
  } else if (
    Math.abs(gapS) <= config.linearTolerance
    && strictlyGreater(overlapZ, config.minimumOverlap)
  ) {
    type = 'COLLINEAR_CONTIGUOUS';
  } else if (gapS > config.linearTolerance) {
    type = 'COLLINEAR_SEPARATED';
  }
  if (!type) return null;
  const wallIds = [first.id, second.id].sort(compareIds);
  return {
    id: `relation|${type}|${wallIds.map((id) => `wall:${idToken(id)}`).join('|')}`,
    type,
    wallIds,
    rule: 'R-LINE-02',
    certainty: 'derived',
    evidence: {
      supportLineId: line.id,
      overlapS,
      gapS,
      overlapZ
    }
  };
}

function buildRelations(lines, config) {
  const relations = [];
  for (const line of lines) {
    for (let firstIndex = 0; firstIndex < line.walls.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < line.walls.length; secondIndex += 1) {
        const relation = pairRelation(
          line.walls[firstIndex],
          line.walls[secondIndex],
          line,
          config
        );
        if (relation) relations.push(relation);
      }
    }
  }
  return relations.sort(relationSort);
}

function relationId(type, wallIds) {
  return `relation|${type}|${wallIds.map((id) => `wall:${idToken(id)}`).join('|')}`;
}

function orderedVerticalPair(first, second) {
  return [first, second].sort((left, right) => (
    left.z0 - right.z0
    || left.z1 - right.z1
    || geometrySort(left, right)
  ));
}

function stackedRelation(first, second, line, config) {
  const overlapS = Math.min(first.s1, second.s1) - Math.max(first.s0, second.s0);
  if (!strictlyGreater(overlapS, config.minimumOverlap)) return null;
  const [lower, upper] = orderedVerticalPair(first, second);
  const commonS = [Math.max(first.s0, second.s0), Math.min(first.s1, second.s1)];
  const gapZ = upper.z0 - lower.z1;
  const overlapZ = Math.min(first.z1, second.z1) - Math.max(first.z0, second.z0);
  const exactS = Math.abs(first.s0 - second.s0) <= config.linearTolerance
    && Math.abs(first.s1 - second.s1) <= config.linearTolerance;
  let type;
  let rule;
  let certainty = 'derived';
  if (strictlyGreater(overlapZ, config.minimumOverlap)) {
    type = 'STACKED_OVERLAP';
    rule = 'R-STACK-03';
  } else if (Math.abs(gapZ) <= config.levelTolerance) {
    type = exactS ? 'STACKED_EXACT' : 'STACKED_PARTIAL';
    rule = exactS ? 'R-STACK-01' : 'R-STACK-02';
  } else if (strictlyGreater(gapZ, config.levelTolerance)) {
    type = 'STACKED_GAP';
    rule = 'R-STACK-04';
    certainty = 'candidate';
  } else {
    return null;
  }
  const wallIds = [first.id, second.id].sort(compareIds);
  return {
    id: relationId(type, wallIds),
    type,
    phase: 'R3',
    wallIds,
    rule,
    certainty,
    evidence: {
      supportLineId: line.id,
      lowerWallId: lower.id,
      upperWallId: upper.id,
      overlapS,
      commonS,
      gapZ,
      zOverlap: overlapZ > 0
        ? [Math.max(first.z0, second.z0), Math.min(first.z1, second.z1)]
        : null,
      linearTolerance: config.linearTolerance,
      levelTolerance: config.levelTolerance,
      minimumOverlap: config.minimumOverlap
    }
  };
}

function buildStackedRelations(lines, config) {
  const relations = [];
  for (const line of lines) {
    for (let firstIndex = 0; firstIndex < line.walls.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < line.walls.length; secondIndex += 1) {
        const relation = stackedRelation(
          line.walls[firstIndex],
          line.walls[secondIndex],
          line,
          config
        );
        if (relation) relations.push(relation);
      }
    }
  }
  return relations.sort(relationSort);
}

function longitudinalState(position, wall, tolerance) {
  if (position < wall.s0 - tolerance || position > wall.s1 + tolerance) return 'OUTSIDE';
  if (Math.abs(position - wall.s0) <= tolerance) return 'START';
  if (Math.abs(position - wall.s1) <= tolerance) return 'END';
  if (position > wall.s0 + tolerance && position < wall.s1 - tolerance) return 'MID';
  return 'OUTSIDE';
}

function intersectionType(stateA, stateB) {
  const endA = stateA === 'START' || stateA === 'END';
  const endB = stateB === 'START' || stateB === 'END';
  if (endA && endB) return 'CORNER_END_END';
  if (endA && stateB === 'MID') return 'T_END_MID';
  if (stateA === 'MID' && endB) return 'T_MID_END';
  if (stateA === 'MID' && stateB === 'MID') return 'CROSS_MID_MID';
  return null;
}

function isFullCoverage(coverage, wall, config) {
  return Math.abs(coverage - 1) <= config.levelTolerance / wall.height;
}

function contactType(coverageA, coverageB, wallA, wallB, config) {
  const fullA = isFullCoverage(coverageA, wallA, config);
  const fullB = isFullCoverage(coverageB, wallB, config);
  if (fullA && fullB) return 'FULL_BOTH';
  if (fullA) return 'FULL_A_PARTIAL_B';
  if (fullB) return 'PARTIAL_A_FULL_B';
  return 'PARTIAL_BOTH';
}

function buildVerticalBands(wallA, wallB) {
  const boundaries = [...new Set([wallA.z0, wallA.z1, wallB.z0, wallB.z1])]
    .sort((left, right) => left - right);
  const bands = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const z0 = boundaries[index];
    const z1 = boundaries[index + 1];
    if (!(z1 > z0)) continue;
    const midpoint = (z0 + z1) / 2;
    const inA = midpoint >= wallA.z0 && midpoint <= wallA.z1;
    const inB = midpoint >= wallB.z0 && midpoint <= wallB.z1;
    if (!inA && !inB) continue;
    bands.push({
      z0,
      z1,
      state: inA && inB ? 'intersectionActive' : inA ? 'wallAOnly' : 'wallBOnly'
    });
  }
  return bands;
}

function perpendicularRelation(wallA, wallB, config) {
  const x = wallB.fixed;
  const y = wallA.fixed;
  const stateA = longitudinalState(x, wallA, config.linearTolerance);
  const stateB = longitudinalState(y, wallB, config.linearTolerance);
  const type = intersectionType(stateA, stateB);
  if (!type) return null;
  const z0 = Math.max(wallA.z0, wallB.z0);
  const z1 = Math.min(wallA.z1, wallB.z1);
  const overlapZ = z1 - z0;
  if (!strictlyGreater(overlapZ, config.minimumOverlap)) return null;
  const coverageA = overlapZ / wallA.height;
  const coverageB = overlapZ / wallB.height;
  const verticalContactType = contactType(coverageA, coverageB, wallA, wallB, config);
  const wallIds = [wallA.id, wallB.id].sort(compareIds);
  const ambiguous = type === 'CROSS_MID_MID';
  return {
    id: relationId(type, wallIds),
    type,
    phase: 'R4',
    wallIds,
    wallAId: wallA.id,
    wallBId: wallB.id,
    rule: 'R-INT-02',
    certainty: ambiguous ? 'ambiguous' : 'derived',
    ambiguous,
    zOverlap: [z0, z1],
    overlapZ,
    coverageA,
    coverageB,
    verticalContactType,
    visibleInFlow: true,
    verticalBands: buildVerticalBands(wallA, wallB),
    evidence: {
      point: { x, y },
      stateA,
      stateB,
      sA: x,
      sB: y,
      localSA: x - wallA.s0,
      localSB: y - wallB.s0,
      linearTolerance: config.linearTolerance,
      minimumOverlap: config.minimumOverlap
    }
  };
}

function buildPerpendicularRelations(walls, config) {
  const horizontal = walls.filter(({ axis }) => axis === 'x').sort(geometrySort);
  const vertical = walls.filter(({ axis }) => axis === 'y').sort(geometrySort);
  const relations = [];
  for (const wallA of horizontal) {
    for (const wallB of vertical) {
      const relation = perpendicularRelation(wallA, wallB, config);
      if (relation) relations.push(relation);
    }
  }
  return relations.sort(relationSort);
}

function connectedComponents(walls, relations) {
  const neighbors = new Map(walls.map((wall) => [idToken(wall.id), new Set()]));
  for (const relation of relations.filter(({ type }) => type === 'COLLINEAR_CONTIGUOUS')) {
    const [first, second] = relation.wallIds.map(idToken);
    neighbors.get(first).add(second);
    neighbors.get(second).add(first);
  }
  const wallsByToken = new Map(walls.map((wall) => [idToken(wall.id), wall]));
  const visited = new Set();
  const components = [];
  for (const wall of walls) {
    const start = idToken(wall.id);
    if (visited.has(start) || neighbors.get(start).size === 0) continue;
    const pending = [start];
    const component = [];
    visited.add(start);
    while (pending.length > 0) {
      const current = pending.pop();
      component.push(wallsByToken.get(current));
      for (const neighbor of [...neighbors.get(current)].sort(compareText)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
    components.push(component.sort(geometrySort));
  }
  return components;
}

function buildChains(lines, relations) {
  return lines.flatMap((line) => connectedComponents(
    line.walls,
    relations.filter(({ evidence }) => evidence.supportLineId === line.id)
  ).map((walls) => {
    const wallIds = walls.map(({ id }) => id);
    return {
      id: `chain|line:${line.id}|walls:${wallIds.map(idToken).join('|')}`,
      supportLineId: line.id,
      wallIds,
      rule: 'R-LINE-03',
      certainty: 'derived'
    };
  })).sort((left, right) => compareText(left.id, right.id));
}

function openingOverlapFindings(openings, config) {
  const findings = [];
  const hosts = new Map();
  for (const opening of openings) {
    const key = idToken(opening.hostWallId);
    if (!hosts.has(key)) hosts.set(key, []);
    hosts.get(key).push(opening);
  }
  for (const hostOpenings of hosts.values()) {
    hostOpenings.sort(compareEntitiesById);
    for (let firstIndex = 0; firstIndex < hostOpenings.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < hostOpenings.length; secondIndex += 1) {
        const first = hostOpenings[firstIndex];
        const second = hostOpenings[secondIndex];
        const overlapS = Math.min(first.s1, second.s1) - Math.max(first.s0, second.s0);
        const overlapZ = Math.min(first.z1, second.z1) - Math.max(first.z0, second.z0);
        if (
          !strictlyGreater(overlapS, config.minimumOverlap)
          || !strictlyGreater(overlapZ, config.minimumOverlap)
        ) continue;
        findings.push({
          code: 'RT-OPENING-OVERLAP',
          severity: 'error',
          ids: [first.id, second.id, first.hostWallId].sort(compareIds),
          rule: 'R-NORM-04',
          evidence: { overlapS, overlapZ }
        });
      }
    }
  }
  return findings;
}

function collinearFindings(relations) {
  return relations.filter(({ type }) => type === 'COLLINEAR_OVERLAP').map((relation) => ({
    code: 'RT-COLLINEAR-DUPLICATE',
    severity: 'error',
    ids: [...relation.wallIds],
    rule: 'R-LINE-02',
    evidence: { ...relation.evidence }
  }));
}

function stackedFindings(relations) {
  return relations.flatMap((relation) => {
    if (relation.type === 'STACKED_OVERLAP') {
      return [{
        code: 'RT-WALL-VOLUME-OVERLAP',
        severity: 'error',
        ids: [...relation.wallIds],
        rule: 'R-STACK-03',
        evidence: {
          relationId: relation.id,
          overlapS: relation.evidence.overlapS,
          zOverlap: relation.evidence.zOverlap
        }
      }];
    }
    if (relation.type === 'STACKED_GAP') {
      return [{
        code: 'RT-VERTICAL-LOAD-PATH-GAP',
        severity: 'warning',
        ids: [...relation.wallIds],
        rule: 'R-STACK-04',
        evidence: {
          relationId: relation.id,
          overlapS: relation.evidence.overlapS,
          gapZ: relation.evidence.gapZ
        }
      }];
    }
    return [];
  });
}

function intersectionFindings(relations) {
  return relations.flatMap((relation) => {
    const findings = [];
    if (relation.verticalContactType !== 'FULL_BOTH') {
      findings.push({
        code: 'RT-INTERSECTION-PARTIAL-Z',
        severity: 'warning',
        ids: [...relation.wallIds],
        rule: 'R-INT-05',
        evidence: {
          relationId: relation.id,
          zOverlap: relation.zOverlap,
          verticalContactType: relation.verticalContactType
        }
      });
    }
    if (relation.type === 'CROSS_MID_MID') {
      findings.push({
        code: 'RT-CROSS-STRUCTURAL-INTENT-REQUIRED',
        severity: 'blocking',
        ids: [...relation.wallIds],
        rule: 'R-INT-04',
        evidence: { relationId: relation.id }
      });
    }
    return findings;
  });
}

function nodeRoleSort(left, right) {
  const leftPriority = NODE_ROLE_PRIORITY.indexOf(left);
  const rightPriority = NODE_ROLE_PRIORITY.indexOf(right);
  return (leftPriority === -1 ? NODE_ROLE_PRIORITY.length : leftPriority)
    - (rightPriority === -1 ? NODE_ROLE_PRIORITY.length : rightPriority)
    || compareText(left, right);
}

function snapWallPosition(position, wall, tolerance) {
  if (Math.abs(position - wall.s0) <= tolerance) return wall.s0;
  if (Math.abs(position - wall.s1) <= tolerance) return wall.s1;
  return position;
}

function nodeEvent(wall, position, role, {
  z0 = wall.z0,
  z1 = wall.z1,
  openingIds = [],
  relationIds = [],
  sourceKey
} = {}, config) {
  const s = snapWallPosition(position, wall, config.linearTolerance);
  return {
    wallId: wall.id,
    s,
    localS: s - wall.s0,
    role,
    z0,
    z1,
    openingIds,
    relationIds,
    sourceKey
  };
}

function buildNodeEvents(walls, openings, stackedRelations, intersections, config) {
  const eventsByWall = new Map(walls.map((wall) => [idToken(wall.id), []]));
  const wallsById = new Map(walls.map((wall) => [idToken(wall.id), wall]));
  const push = (wallId, event) => eventsByWall.get(idToken(wallId)).push(event);
  for (const wall of walls) {
    push(wall.id, nodeEvent(wall, wall.s0, 'wallEnd', {
      sourceKey: `wall:${idToken(wall.id)}|START`
    }, config));
    push(wall.id, nodeEvent(wall, wall.s1, 'wallEnd', {
      sourceKey: `wall:${idToken(wall.id)}|END`
    }, config));
  }
  for (const opening of openings) {
    const wall = wallsById.get(idToken(opening.hostWallId));
    for (const [edge, position] of [['START', opening.s0], ['END', opening.s1]]) {
      push(wall.id, nodeEvent(wall, position, 'openingEdge', {
        z0: opening.z0,
        z1: opening.z1,
        openingIds: [opening.id],
        sourceKey: `opening:${idToken(opening.id)}|${edge}`
      }, config));
    }
  }
  for (const relation of intersections) {
    for (const [wallId, position] of [
      [relation.wallAId, relation.evidence.sA],
      [relation.wallBId, relation.evidence.sB]
    ]) {
      const wall = wallsById.get(idToken(wallId));
      push(wall.id, nodeEvent(wall, position, 'wallIntersection', {
        z0: relation.zOverlap[0],
        z1: relation.zOverlap[1],
        relationIds: [relation.id],
        sourceKey: `intersection:${relation.id}`
      }, config));
    }
  }
  for (const relation of stackedRelations) {
    for (const wallId of relation.wallIds) {
      const wall = wallsById.get(idToken(wallId));
      for (const [boundary, position] of [
        ['START', relation.evidence.commonS[0]],
        ['END', relation.evidence.commonS[1]]
      ]) {
        push(wall.id, nodeEvent(wall, position, 'stackBoundary', {
          z0: wall.z0,
          z1: wall.z1,
          relationIds: [relation.id],
          sourceKey: `stack:${relation.id}|${boundary}`
        }, config));
      }
    }
  }
  return eventsByWall;
}

function uniqueIds(values) {
  return [...new Map(values.map((value) => [idToken(value), value])).values()].sort(compareIds);
}

function clusterNodeEvents(events, config) {
  const sorted = [...events].sort((left, right) => (
    left.s - right.s
    || nodeRoleSort(left.role, right.role)
    || compareText(left.sourceKey, right.sourceKey)
  ));
  const clusters = [];
  for (const event of sorted) {
    const current = clusters[clusters.length - 1];
    const previous = current?.[current.length - 1];
    const sameRoundedPosition = previous
      && roundNumber(event.localS, config.roundDecimals)
        === roundNumber(previous.localS, config.roundDecimals);
    if (
      !current
      || (event.s - previous.s > config.linearTolerance && !sameRoundedPosition)
    ) clusters.push([event]);
    else current.push(event);
  }
  return clusters;
}

function nodeFromCluster(wall, cluster, config) {
  const primary = [...cluster].sort((left, right) => (
    nodeRoleSort(left.role, right.role)
    || left.s - right.s
    || compareText(left.sourceKey, right.sourceKey)
  ))[0];
  const roles = [...new Set(cluster.map(({ role }) => role))].sort(nodeRoleSort);
  const zCoverage = [...new Map(cluster.map(({ z0, z1 }) => [
    `${z0}|${z1}`,
    { z0, z1 }
  ])).values()].sort((left, right) => left.z0 - right.z0 || left.z1 - right.z1);
  const localToken = roundNumber(primary.localS, config.roundDecimals)
    .toFixed(config.roundDecimals);
  const stableId = `node|wall:${idToken(wall.id)}|localS:${localToken}`;
  const global = wall.axis === 'x'
    ? { x: primary.s, y: wall.fixed }
    : { x: wall.fixed, y: primary.s };
  return {
    id: stableId,
    stableId,
    wallId: wall.id,
    localS: primary.localS,
    global,
    z0: Math.min(...zCoverage.map(({ z0 }) => z0)),
    z1: Math.max(...zCoverage.map(({ z1 }) => z1)),
    nodeType: roles[0],
    roles,
    openingIds: uniqueIds(cluster.flatMap(({ openingIds }) => openingIds)),
    relationIds: [...new Set(cluster.flatMap(({ relationIds }) => relationIds))].sort(compareText),
    zCoverage
  };
}

function nodeSort(left, right) {
  return compareIds(left.wallId, right.wallId)
    || left.localS - right.localS
    || left.z0 - right.z0
    || compareText(left.nodeType, right.nodeType)
    || compareText(left.stableId, right.stableId);
}

function buildNodes(walls, openings, stackedRelations, intersections, config) {
  const eventsByWall = buildNodeEvents(
    walls,
    openings,
    stackedRelations,
    intersections,
    config
  );
  const nodes = walls.flatMap((wall) => (
    clusterNodeEvents(eventsByWall.get(idToken(wall.id)), config)
      .map((cluster) => nodeFromCluster(wall, cluster, config))
  )).sort(nodeSort);
  const nodeIdsByWall = new Map(walls.map((wall) => [idToken(wall.id), []]));
  for (const node of nodes) nodeIdsByWall.get(idToken(node.wallId)).push(node.id);
  return { nodes, nodeIdsByWall };
}

function roundedEvidence(value, decimals) {
  return roundDeep(value, decimals);
}

function roundDeep(value, decimals, key = '') {
  if (typeof value === 'number') {
    return key === 'id' || key.endsWith('Id') ? value : roundNumber(value, decimals);
  }
  if (Array.isArray(value)) return value.map((item) => roundDeep(item, decimals));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [
    childKey,
    roundDeep(item, decimals, childKey)
  ]));
}

function canonicalizeResult(draft, decimals) {
  const roundGeometry = (entity) => Object.fromEntries(Object.entries(entity).map(([key, value]) => {
    if (typeof value === 'number' && key !== 'id') return [key, roundNumber(value, decimals)];
    if (key === 'evidence') return [key, roundedEvidence(value, decimals)];
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      return [key, roundDeep(value, decimals, key)];
    }
    return [key, value];
  }));
  return {
    ...draft,
    axes: draft.axes.map(roundGeometry),
    levels: draft.levels.map(roundGeometry),
    walls: draft.walls.map(roundGeometry),
    openings: draft.openings.map(roundGeometry),
    supportLines: draft.supportLines.map(roundGeometry),
    relations: draft.relations.map(roundGeometry),
    nodes: draft.nodes.map(roundGeometry),
    findings: draft.findings.map(roundGeometry)
  };
}

export function recognizeStructuralTopology(input, recognitionConfig = {}) {
  const config = normalizeConfig(recognitionConfig);
  let consumed;
  try {
    consumed = consumeSpec14Input(input);
  } catch (error) {
    mapInputError(error);
  }

  const sourceIndexByWall = new Map();
  input.elements.forEach((element, index) => {
    if (element.type === 'wall') sourceIndexByWall.set(idToken(element.id), index);
  });
  const normalizedWalls = consumed.walls.map((item) => (
    normalizeWall(item, sourceIndexByWall.get(idToken(item.id)), config)
  ));
  const openings = normalizedWalls.flatMap((normalizedWall) => (
    normalizedWall.source.openings.map((item, index) => (
      normalizeOpening(item, index, normalizedWall, config)
    ))
  )).sort(compareEntitiesById);
  const supportLines = buildSupportLines(normalizedWalls, config);
  const lineByWall = new Map(supportLines.flatMap((line) => (
    line.walls.map((wall) => [idToken(wall.id), line])
  )));
  const collinearRelations = buildRelations(supportLines, config);
  const stackedRelations = buildStackedRelations(supportLines, config);
  const intersections = buildPerpendicularRelations(normalizedWalls, config);
  const relations = [
    ...collinearRelations,
    ...stackedRelations,
    ...intersections
  ].sort(relationSort);
  const relationIdsByWall = new Map(normalizedWalls.map((wall) => [idToken(wall.id), []]));
  for (const relation of relations) {
    relation.wallIds.forEach((id) => relationIdsByWall.get(idToken(id)).push(relation.id));
  }
  const chains = buildChains(supportLines, collinearRelations);
  const chainByWall = new Map(chains.flatMap((chain) => (
    chain.wallIds.map((id) => [idToken(id), chain.id])
  )));
  const { nodes, nodeIdsByWall } = buildNodes(
    normalizedWalls,
    openings,
    stackedRelations,
    intersections,
    config
  );
  const walls = normalizedWalls.map((wall) => ({
    id: wall.id,
    axis: wall.axis,
    fixed: wall.fixed,
    s0: wall.s0,
    s1: wall.s1,
    z0: wall.z0,
    z1: wall.z1,
    length: wall.length,
    height: wall.height,
    thickness: wall.thickness,
    supportLineId: lineByWall.get(idToken(wall.id)).id,
    relationIds: relationIdsByWall.get(idToken(wall.id)).sort(compareText),
    nodeIds: nodeIdsByWall.get(idToken(wall.id)),
    chainId: chainByWall.get(idToken(wall.id)) ?? null
  })).sort(compareEntitiesById);
  const findings = [
    ...openingOverlapFindings(openings, config),
    ...collinearFindings(collinearRelations),
    ...stackedFindings(stackedRelations),
    ...intersectionFindings(intersections)
  ].sort(findingSort);

  const draft = {
    schema: RECOGNIZED_TOPOLOGY_SCHEMA,
    sourceSchema: SPEC14_SOURCE_SCHEMA,
    specVersion: 'SPEC-14-v0.3',
    config,
    phasesExecuted: [...PHASES_EXECUTED],
    phasesPending: [...PHASES_PENDING],
    eligibleForSpec08: false,
    axes: [
      ...consumed.grid.xAxes.map(({ id, x }) => ({ id, axis: 'x', coordinate: x })),
      ...consumed.grid.yAxes.map(({ id, y }) => ({ id, axis: 'y', coordinate: y }))
    ].sort((left, right) => compareText(left.axis, right.axis) || compareIds(left.id, right.id)),
    levels: consumed.grid.zLevels.map(({ id, z }) => ({ id, z })).sort(compareEntitiesById),
    walls,
    openings,
    foundations: [],
    roofSupports: [],
    verticalSupports: [],
    supportLines: supportLines.map((line) => ({
      id: line.id,
      axis: line.axis,
      fixed: line.anchor,
      wallIds: line.walls.map(({ id }) => id)
    })),
    chains,
    relations,
    nodes,
    segments: [],
    findings
  };
  const canonical = canonicalizeResult(draft, config.roundDecimals);
  return {
    ...canonical,
    canonicalSha256: sha256(JSON.stringify(canonical))
  };
}
