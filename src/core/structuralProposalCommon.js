export const STRUCTURAL_PROPOSAL_DEFAULTS = Object.freeze({
  linearToleranceMm: 0.1,
  levelToleranceMm: 0.1,
  minimumOverlapMm: 0.1,
  minimumSupportOverlapMm: 38,
  roundDecimals: 3
});

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

export class StructuralProposalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StructuralProposalError';
    this.code = code;
    this.details = details;
  }
}

export function failProposal(code, message, details = {}) {
  throw new StructuralProposalError(code, message, details);
}

export function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function idToken(id) {
  return `${typeof id === 'number' ? 'n' : 's'}:${JSON.stringify(id)}`;
}

export function compareIds(left, right) {
  return compareText(idToken(left), idToken(right));
}

export function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

export function roundNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    failProposal('SI-PROPOSAL-NON-FINITE', 'Se encontró un valor numérico no finito.', { value });
  }
  const factor = 10 ** decimals;
  return normalizeZero(Math.round((value + Number.EPSILON) * factor) / factor);
}

export function canonicalizeValue(value, decimals = 3) {
  if (Array.isArray(value)) return value.map((item) => canonicalizeValue(item, decimals));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareText)
        .map((key) => [key, canonicalizeValue(value[key], decimals)])
    );
  }
  return typeof value === 'number' ? roundNumber(value, decimals) : value;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256(value) {
  const source = new globalThis.TextEncoder().encode(String(value));
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
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
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
      h = g; g = f; f = e; e = (d + first) >>> 0;
      d = c; c = b; b = a; a = (first + second) >>> 0;
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


const SEMANTIC_ID_KEYS = Object.freeze([
  'id', 'elementId', 'roofGeometryId', 'wallId', 'openingId', 'foundationId',
  'relationId', 'nodeId', 'edgeId', 'pathId', 'proposalId', 'boundaryId',
  'intentId', 'interfaceId', 'findingId', 'eventId'
]);
const SEMANTIC_SET_ARRAY_KEYS = new Set([
  'functions', 'phasesExecuted', 'phasesPending', 'roles', 'removedBoundaryIds'
]);
const SEMANTIC_ORDERLESS_ARRAY_KEYS = new Set([
  'xAxes', 'yAxes', 'zLevels', 'elements', 'roofGeometry',
  'elementIntents', 'roofIntents', 'intersectionIntents', 'supportIntents',
  'interfaceIntents', 'relationIntents', 'carrierRegions', 'ports',
  'diaphragmIntents', 'overrides', 'boundaryIntents',
  'walls', 'openings', 'relations', 'nodes', 'findings', 'axes', 'levels',
  'foundations', 'roofSupports', 'verticalSupports', 'segments', 'sourceFindings'
]);

function semanticIdentity(item) {
  if (!isRecord(item)) return null;
  for (const key of SEMANTIC_ID_KEYS) {
    if (item[key] !== undefined && item[key] !== null) return `${key}:${idToken(item[key])}`;
  }
  if (item.wallAId !== undefined && item.wallBId !== undefined) {
    return `pair:${idToken(item.wallAId)}:${idToken(item.wallBId)}`;
  }
  return null;
}

export function canonicalizeSourceValue(value, decimals = 3, parentKey = '') {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeSourceValue(item, decimals, parentKey));
    const identities = items.map(semanticIdentity);
    if (items.length > 0 && identities.every(Boolean)) {
      return items.map((item, index) => ({ item, identity: identities[index] }))
        .sort((a, b) => compareText(a.identity, b.identity) || compareText(JSON.stringify(a.item), JSON.stringify(b.item)))
        .map((entry) => entry.item);
    }
    if (SEMANTIC_SET_ARRAY_KEYS.has(parentKey) || SEMANTIC_ORDERLESS_ARRAY_KEYS.has(parentKey)) {
      return [...items].sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));
    }
    return items;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort(compareText).map((key) => [
        key,
        canonicalizeSourceValue(value[key], decimals, key)
      ])
    );
  }
  return typeof value === 'number' ? roundNumber(value, decimals) : value;
}

export function sourceFingerprint(value, decimals = 3) {
  return sha256(JSON.stringify(canonicalizeSourceValue(value, decimals)));
}

export function canonicalJson(value, decimals = 3) {
  return JSON.stringify(canonicalizeValue(value, decimals));
}

export function fingerprint(value, decimals = 3) {
  return sha256(canonicalJson(value, decimals));
}

export function semanticId(prefix, payload) {
  return `${prefix}:sha256:${sha256(typeof payload === 'string' ? payload : canonicalJson(payload))}`;
}

export function normalizeConfig(input = {}) {
  if (input === undefined) return { ...STRUCTURAL_PROPOSAL_DEFAULTS };
  if (!isRecord(input)) {
    failProposal('SI-PROPOSAL-INPUT-INVALID', 'config debe ser un objeto.');
  }
  const config = { ...STRUCTURAL_PROPOSAL_DEFAULTS };
  for (const [key, value] of Object.entries(input)) {
    if (!(key in config)) {
      failProposal('SI-PROPOSAL-INPUT-INVALID', `La configuración no admite ${key}.`, { key });
    }
    if (!Number.isFinite(value) || value < 0) {
      failProposal('SI-PROPOSAL-NON-FINITE', `${key} debe ser finito y no negativo.`, { key, value });
    }
    config[key] = value;
  }
  if (!Number.isInteger(config.roundDecimals) || config.roundDecimals < 0 || config.roundDecimals > 9) {
    failProposal('SI-PROPOSAL-INPUT-INVALID', 'roundDecimals debe ser un entero entre 0 y 9.');
  }
  return config;
}

export function sourceFingerprints({ geometry, structuralIntent, roofStructuralIntent, topology }, decimals = 3) {
  const result = {
    geometrySha256: sourceFingerprint(geometry, decimals),
    elementIntentSha256: sourceFingerprint(structuralIntent, decimals),
    roofIntentSha256: sourceFingerprint(roofStructuralIntent, decimals),
    topologySha256: sourceFingerprint(topology, decimals)
  };
  result.aggregateSha256 = fingerprint(result, decimals);
  return result;
}

export function sameFingerprintSet(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  return value;
}

export function assertUniqueIds(items, label, selector = (item) => item?.id) {
  const seen = new Set();
  for (const item of items) {
    const id = selector(item);
    const token = idToken(id);
    if (seen.has(token)) {
      failProposal('SI-PROPOSAL-DUPLICATE-ID', `${label} contiene el ID duplicado ${String(id)}.`, { label, id });
    }
    seen.add(token);
  }
}

export function overlap1d(a0, a1, b0, b1) {
  const start = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const end = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return { start, end, length: end - start };
}

export function wallFrame(wall) {
  if (wall?.type !== 'wall' || wall?.prism?.kind !== 'oriented-prism') return null;
  const { start, end, height } = wall.prism;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(height > 0)) {
    failProposal('SI-PROPOSAL-INPUT-INVALID', `El muro ${String(wall.id)} no tiene geometría positiva.`, { id: wall.id });
  }
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const sStart = axis === 'x' ? start.x : start.y;
  const sEnd = axis === 'x' ? end.x : end.y;
  return {
    id: wall.id,
    axis,
    fixed: axis === 'x' ? (start.y + end.y) / 2 : (start.x + end.x) / 2,
    s0: Math.min(sStart, sEnd),
    s1: Math.max(sStart, sEnd),
    z0: start.z,
    z1: start.z + height,
    length,
    wall
  };
}

export function foundationFrames(foundation) {
  if (foundation?.type !== 'foundation' || !Array.isArray(foundation.solids)) return [];
  return foundation.solids.map((solid) => {
    const prism = solid?.prism;
    if (prism?.kind !== 'axis-aligned-prism') return null;
    const xLength = prism.max.x - prism.min.x;
    const yLength = prism.max.y - prism.min.y;
    const axis = xLength >= yLength ? 'x' : 'y';
    return {
      foundationId: foundation.id,
      role: solid.role,
      axis,
      fixed0: axis === 'x' ? prism.min.y : prism.min.x,
      fixed1: axis === 'x' ? prism.max.y : prism.max.x,
      s0: axis === 'x' ? prism.min.x : prism.min.y,
      s1: axis === 'x' ? prism.max.x : prism.max.y,
      z0: prism.min.z,
      z1: prism.max.z,
      prism
    };
  }).filter(Boolean);
}

export function roofBoundaryFrame(boundary) {
  const dx = boundary.end.x - boundary.start.x;
  const dy = boundary.end.y - boundary.start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const sStart = axis === 'x' ? boundary.start.x : boundary.start.y;
  const sEnd = axis === 'x' ? boundary.end.x : boundary.end.y;
  return {
    boundaryId: boundary.boundaryId,
    roofGeometryId: boundary.roofGeometryId,
    axis,
    fixed: axis === 'x'
      ? (boundary.start.y + boundary.end.y) / 2
      : (boundary.start.x + boundary.end.x) / 2,
    s0: Math.min(sStart, sEnd),
    s1: Math.max(sStart, sEnd),
    z0: Math.min(boundary.start.z, boundary.end.z),
    z1: Math.max(boundary.start.z, boundary.end.z),
    length,
    boundary
  };
}

export function openingEvidenceForWall(frame, overlap, config) {
  const results = [];
  for (const opening of frame.wall.openings || []) {
    const prism = opening?.void;
    if (prism?.kind !== 'oriented-prism') continue;
    const oStart = frame.axis === 'x' ? prism.start.x : prism.start.y;
    const oEnd = frame.axis === 'x' ? prism.end.x : prism.end.y;
    const longitudinal = overlap1d(overlap.start, overlap.end, oStart, oEnd);
    if (longitudinal.length <= config.minimumOverlapMm) continue;
    const z0 = prism.start.z;
    const z1 = prism.start.z + prism.height;
    results.push({
      openingId: opening.id,
      kind: opening.kind,
      longitudinalOverlapMm: longitudinal.length,
      sRange: [Math.min(oStart, oEnd), Math.max(oStart, oEnd)],
      zRange: [z0, z1]
    });
  }
  return results.sort((a, b) => compareIds(a.openingId, b.openingId));
}

export function geometryIndexes(geometry) {
  if (!isRecord(geometry) || geometry.schema !== 'agnostic-geometry-v1.0') {
    failProposal('SI-PROPOSAL-INPUT-INVALID', 'geometry debe usar agnostic-geometry-v1.0.');
  }
  const elements = Array.isArray(geometry.elements) ? geometry.elements : [];
  const roofs = Array.isArray(geometry.roofGeometry) ? geometry.roofGeometry : [];
  assertUniqueIds(elements, 'geometry.elements');
  assertUniqueIds(roofs, 'geometry.roofGeometry');
  return {
    elements,
    roofs,
    walls: elements.map(wallFrame).filter(Boolean).sort((a, b) => compareIds(a.id, b.id)),
    foundations: elements.filter((element) => element?.type === 'foundation'),
    elementById: new Map(elements.map((item) => [idToken(item.id), item])),
    roofById: new Map(roofs.map((item) => [idToken(item.id), item]))
  };
}

export function findById(map, id, label) {
  const value = map.get(idToken(id));
  if (!value) {
    failProposal('SI-PROPOSAL-REFERENCE-NOT-FOUND', `${label} ${String(id)} no existe.`, { label, id });
  }
  return value;
}
