import { projectAgnosticRoofGeometry } from './agnosticGeometry.js';

export const ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE =
  'SI-ROOF-BOUNDARY-REVIEW-AFTER-GEOMETRY-CHANGE';
export const ROOF_BOUNDARY_CONFIG = Object.freeze({
  linearToleranceMm: 0.1,
  minimumPlanLengthMm: 0.1,
  coordinateRoundDecimals: 3,
  directionRoundDecimals: 6,
  angularToleranceDeg: 0.001,
  hashAlgorithm: 'SHA-256',
  payloadVersion: 'roof-boundary-v1'
});
export const ROOF_LOAD_DISTRIBUTIONS = Object.freeze([
  'oneWay', 'twoWay', 'local', 'undetermined'
]);
export const ROOF_DIAPHRAGM_BEHAVIORS = Object.freeze([
  'intended', 'notIntended', 'candidate', 'undetermined'
]);
export const ROOF_BOUNDARY_FUNCTIONS = Object.freeze([
  'gravitySupport',
  'lateralSupport',
  'gravityAndLateralSupport',
  'geometricBoundary',
  'gutterSupport',
  'nonStructuralBoundary',
  'undetermined'
]);

const ROOF_INTENT_KEYS = new Set([
  'intentId',
  'roofGeometryId',
  'loadDistribution',
  'primaryResistanceDirection',
  'secondaryResistanceDirection',
  'diaphragmBehavior',
  'boundaryIntents',
  'status',
  'source',
  'notes'
]);
const BOUNDARY_INTENT_KEYS = new Set(['boundaryId', 'function', 'source']);
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

export class RoofStructuralIntentError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'RoofStructuralIntentError';
    this.code = code;
    this.details = details;
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  }
  return value;
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  return normalizeZero(Math.round((value + Number.EPSILON) * factor) / factor);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function roofIdToken(id) {
  if (typeof id === 'number') return `n:${JSON.stringify(id)}`;
  if (typeof id === 'string') return `s:${JSON.stringify(id)}`;
  return `${typeof id}:${JSON.stringify(id)}`;
}

export function compareRoofIds(left, right) {
  return compareText(roofIdToken(left), roofIdToken(right));
}

function sameRoofId(left, right) {
  return roofIdToken(left) === roofIdToken(right);
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

function fail(code, message, path = '$', ids = []) {
  throw new RoofStructuralIntentError(code, message, [{ path, ids }]);
}

function coordinate(value, path, roofGeometryId) {
  if (!Number.isFinite(value)) {
    fail(
      'SI-ROOF-BOUNDARY-NON-FINITE',
      `La coordenada ${path} debe ser finita.`,
      path,
      [roofGeometryId]
    );
  }
  return roundNumber(value, ROOF_BOUNDARY_CONFIG.coordinateRoundDecimals);
}

function samePoint3d(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function comparePlanPoints(left, right) {
  return left.x - right.x || left.y - right.y;
}

function fixedCoordinate(value) {
  return value.toFixed(ROOF_BOUNDARY_CONFIG.coordinateRoundDecimals);
}

function boundaryPayload(roofGeometryId, start, end) {
  return `${ROOF_BOUNDARY_CONFIG.payloadVersion}`
    + `|roof=${roofIdToken(roofGeometryId)}`
    + `|a=${fixedCoordinate(start.x)},${fixedCoordinate(start.y)}`
    + `|b=${fixedCoordinate(end.x)},${fixedCoordinate(end.y)}`;
}

export function canonicalizeRoofBoundaries(roofGeometry) {
  if (!isRecord(roofGeometry)) {
    fail('SI-ROOF-GEOMETRY-INVALID', 'La cubierta debe ser un objeto.', 'roofGeometry');
  }
  const roofGeometryId = roofGeometry.id;
  if (!['number', 'string'].includes(typeof roofGeometryId) || roofGeometryId === '') {
    fail('SI-ROOF-ID-INVALID', 'roofGeometry.id debe ser string o number.', 'roofGeometry.id');
  }
  if (roofGeometry.surface?.kind !== 'planar-polygon') {
    fail(
      'SI-ROOF-SURFACE-NOT-PLANAR-POLYGON',
      `La cubierta ${String(roofGeometryId)} debe declarar surface.kind=planar-polygon.`,
      'roofGeometry.surface.kind',
      [roofGeometryId]
    );
  }
  if (!Array.isArray(roofGeometry.surface.boundary)) {
    fail(
      'SI-ROOF-BOUNDARY-EXPECTED-ARRAY',
      `La cubierta ${String(roofGeometryId)} debe declarar surface.boundary[].`,
      'roofGeometry.surface.boundary',
      [roofGeometryId]
    );
  }
  const points = roofGeometry.surface.boundary.map((point, index) => {
    const path = `roofGeometry.surface.boundary[${index}]`;
    if (!isRecord(point)) {
      fail('SI-ROOF-BOUNDARY-POINT-INVALID', 'Cada vértice debe ser un objeto.', path, [roofGeometryId]);
    }
    return {
      x: coordinate(point.x, `${path}.x`, roofGeometryId),
      y: coordinate(point.y, `${path}.y`, roofGeometryId),
      z: coordinate(point.z, `${path}.z`, roofGeometryId)
    };
  });
  if (points.length > 1 && samePoint3d(points[0], points.at(-1))) points.pop();
  if (points.length < 3) {
    fail(
      'SI-ROOF-BOUNDARY-TOO-SHORT',
      `La cubierta ${String(roofGeometryId)} requiere al menos tres vértices distintos.`,
      'roofGeometry.surface.boundary',
      [roofGeometryId]
    );
  }

  const seen = new Set();
  const boundaries = [];
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const planLength = Math.hypot(second.x - first.x, second.y - first.y);
    if (!(planLength > ROOF_BOUNDARY_CONFIG.minimumPlanLengthMm)) {
      fail(
        'SI-ROOF-BOUNDARY-DEGENERATE',
        `El borde ${index} de la cubierta ${String(roofGeometryId)} no supera 0.1 mm en planta.`,
        `roofGeometry.surface.boundary[${index}]`,
        [roofGeometryId]
      );
    }
    const [start, end] = comparePlanPoints(first, second) <= 0
      ? [first, second]
      : [second, first];
    const payload = boundaryPayload(roofGeometryId, start, end);
    const boundaryId = `roof:${String(roofGeometryId)}:edge:${sha256(payload)}`;
    if (seen.has(boundaryId)) {
      fail(
        'SI-ROOF-BOUNDARY-DUPLICATE',
        `La cubierta ${String(roofGeometryId)} contiene el borde duplicado ${boundaryId}.`,
        `roofGeometry.surface.boundary[${index}]`,
        [roofGeometryId]
      );
    }
    seen.add(boundaryId);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    boundaries.push({
      boundaryId,
      roofGeometryId,
      start: { ...start },
      end: { ...end },
      length3d: roundNumber(
        Math.hypot(dx, dy, end.z - start.z),
        ROOF_BOUNDARY_CONFIG.coordinateRoundDecimals
      ),
      planDirection: {
        x: roundNumber(dx / planLength, ROOF_BOUNDARY_CONFIG.directionRoundDecimals),
        y: roundNumber(dy / planLength, ROOF_BOUNDARY_CONFIG.directionRoundDecimals)
      },
      zRange: [Math.min(start.z, end.z), Math.max(start.z, end.z)]
    });
  }
  return boundaries.sort((left, right) => compareText(left.boundaryId, right.boundaryId));
}

export function canonicalizeResistanceDirection(direction, path = 'direction') {
  if (!isRecord(direction) || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) {
    fail('SI-ROOF-DIRECTION-INVALID', `${path} debe declarar x e y finitos.`, path);
  }
  const magnitude = Math.hypot(direction.x, direction.y);
  if (!(magnitude > 0)) {
    fail('SI-ROOF-DIRECTION-ZERO', `${path} debe tener magnitud positiva.`, path);
  }
  let x = direction.x / magnitude;
  let y = direction.y / magnitude;
  const firstIsX = Math.abs(x) > 1e-15;
  if ((firstIsX && x < 0) || (!firstIsX && y < 0)) {
    x *= -1;
    y *= -1;
  }
  return {
    x: roundNumber(x, ROOF_BOUNDARY_CONFIG.directionRoundDecimals),
    y: roundNumber(y, ROOF_BOUNDARY_CONFIG.directionRoundDecimals)
  };
}

function compareDirections(left, right) {
  return left.x - right.x || left.y - right.y;
}

function angularSeparationDeg(left, right) {
  const dot = Math.min(1, Math.max(-1, left.x * right.x + left.y * right.y));
  return Math.acos(Math.abs(dot)) * 180 / Math.PI;
}

export function intentIdForRoof(roofGeometryId) {
  return `intent:roof:${String(roofGeometryId)}`;
}

function canonicalBoundaryIntent(boundaryIntent) {
  return {
    boundaryId: boundaryIntent.boundaryId,
    function: boundaryIntent.function,
    source: boundaryIntent.source
  };
}

export function canonicalizeRoofIntent(intent) {
  if (!isRecord(intent)) return cloneJson(intent);
  let primary = intent.primaryResistanceDirection;
  let secondary = intent.secondaryResistanceDirection;
  if (primary != null) primary = canonicalizeResistanceDirection(primary, 'primaryResistanceDirection');
  if (secondary != null) secondary = canonicalizeResistanceDirection(secondary, 'secondaryResistanceDirection');
  if (intent.loadDistribution === 'twoWay' && primary && secondary && compareDirections(primary, secondary) > 0) {
    [primary, secondary] = [secondary, primary];
  }
  return {
    intentId: intent.intentId,
    roofGeometryId: intent.roofGeometryId,
    loadDistribution: intent.loadDistribution,
    primaryResistanceDirection: primary,
    secondaryResistanceDirection: secondary,
    diaphragmBehavior: intent.diaphragmBehavior,
    boundaryIntents: Array.isArray(intent.boundaryIntents)
      ? intent.boundaryIntents.map(canonicalBoundaryIntent)
        .sort((left, right) => compareText(left.boundaryId, right.boundaryId))
      : intent.boundaryIntents,
    status: intent.status,
    source: intent.source,
    notes: intent.notes
  };
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function roofGeometryMap(roofGeometry) {
  const map = new Map();
  for (const roof of Array.isArray(roofGeometry) ? roofGeometry : []) {
    const key = roofIdToken(roof?.id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(roof);
  }
  return map;
}

export function validateRoofIntents(roofIntents, roofGeometry = []) {
  const issues = [];
  if (!Array.isArray(roofIntents)) {
    return [{ path: 'structuralIntent.roofIntents', code: 'SI-EXPECTED-ARRAY', message: 'roofIntents debe ser un arreglo.' }];
  }
  const roofs = roofGeometryMap(roofGeometry);
  const intentIds = new Set();
  const targets = new Set();
  roofIntents.forEach((rawIntent, index) => {
    const path = `structuralIntent.roofIntents[${index}]`;
    if (!isRecord(rawIntent)) {
      addIssue(issues, path, 'SI-EXPECTED-OBJECT', 'La intención de cubierta debe ser un objeto.');
      return;
    }
    for (const key of Object.keys(rawIntent)) {
      if (!ROOF_INTENT_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-UNKNOWN-FIELD', `El campo ${key} no pertenece al contrato.`);
    }
    const intent = (() => {
      try {
        return canonicalizeRoofIntent(rawIntent);
      } catch (error) {
        addIssue(issues, path, error.code || 'SI-ROOF-DIRECTION-INVALID', error.message);
        return rawIntent;
      }
    })();
    const targetKey = roofIdToken(intent.roofGeometryId);
    const matches = roofs.get(targetKey) || [];
    if (matches.length !== 1) {
      addIssue(
        issues,
        `${path}.roofGeometryId`,
        matches.length === 0 ? 'SI-ROOF-REFERENCE-NOT-FOUND' : 'SI-ROOF-REFERENCE-AMBIGUOUS',
        `roofGeometryId ${String(intent.roofGeometryId)} debe resolver exactamente una cubierta.`
      );
    }
    const expectedIntentId = intentIdForRoof(intent.roofGeometryId);
    if (intent.intentId !== expectedIntentId) addIssue(issues, `${path}.intentId`, 'SI-INVALID-INTENT-ID', `intentId debe ser ${expectedIntentId}.`);
    if (intentIds.has(intent.intentId)) addIssue(issues, `${path}.intentId`, 'SI-DUPLICATE-INTENT-ID', `intentId ${String(intent.intentId)} está duplicado.`);
    intentIds.add(intent.intentId);
    if (targets.has(targetKey)) addIssue(issues, `${path}.roofGeometryId`, 'SI-DUPLICATE-ROOF-INTENT', 'Sólo puede existir una intención por cubierta.');
    targets.add(targetKey);

    if (!ROOF_LOAD_DISTRIBUTIONS.includes(intent.loadDistribution)) {
      addIssue(issues, `${path}.loadDistribution`, 'SI-ROOF-LOAD-DISTRIBUTION-INVALID', 'loadDistribution no está permitido.');
    }
    const primary = intent.primaryResistanceDirection;
    const secondary = intent.secondaryResistanceDirection;
    if (intent.loadDistribution === 'oneWay') {
      if (!primary || secondary !== null) addIssue(issues, path, 'SI-ROOF-DIRECTION-COMBINATION-INVALID', 'oneWay requiere primary y secondary=null.');
    } else if (intent.loadDistribution === 'twoWay') {
      if (!primary || !secondary) {
        addIssue(issues, path, 'SI-ROOF-DIRECTION-COMBINATION-INVALID', 'twoWay requiere ambas direcciones.');
      } else if (angularSeparationDeg(primary, secondary) <= ROOF_BOUNDARY_CONFIG.angularToleranceDeg) {
        addIssue(issues, path, 'SI-ROOF-DIRECTIONS-PARALLEL', 'Las direcciones twoWay no pueden ser paralelas ni antiparalelas.');
      }
    } else if (primary !== null || secondary !== null) {
      addIssue(issues, path, 'SI-ROOF-DIRECTION-COMBINATION-INVALID', 'local y undetermined requieren ambas direcciones null.');
    }
    if (!ROOF_DIAPHRAGM_BEHAVIORS.includes(intent.diaphragmBehavior)) {
      addIssue(issues, `${path}.diaphragmBehavior`, 'SI-ROOF-DIAPHRAGM-BEHAVIOR-INVALID', 'diaphragmBehavior no está permitido.');
    }
    if (!Array.isArray(intent.boundaryIntents)) {
      addIssue(issues, `${path}.boundaryIntents`, 'SI-EXPECTED-ARRAY', 'boundaryIntents debe ser un arreglo.');
    } else {
      let validBoundaries = new Map();
      if (matches.length === 1) {
        try {
          validBoundaries = new Map(canonicalizeRoofBoundaries(matches[0]).map((boundary) => [boundary.boundaryId, boundary]));
        } catch (error) {
          addIssue(issues, `${path}.roofGeometryId`, error.code || 'SI-ROOF-GEOMETRY-INVALID', error.message);
        }
      }
      const seen = new Set();
      intent.boundaryIntents.forEach((boundaryIntent, boundaryIndex) => {
        const boundaryPath = `${path}.boundaryIntents[${boundaryIndex}]`;
        if (!isRecord(boundaryIntent)) {
          addIssue(issues, boundaryPath, 'SI-EXPECTED-OBJECT', 'La declaración de borde debe ser un objeto.');
          return;
        }
        for (const key of Object.keys(boundaryIntent)) {
          if (!BOUNDARY_INTENT_KEYS.has(key)) addIssue(issues, `${boundaryPath}.${key}`, 'SI-UNKNOWN-FIELD', `El campo ${key} no pertenece al contrato.`);
        }
        if (typeof boundaryIntent.boundaryId !== 'string' || boundaryIntent.boundaryId.length === 0) {
          addIssue(issues, `${boundaryPath}.boundaryId`, 'SI-ROOF-BOUNDARY-ID-INVALID', 'boundaryId debe ser texto no vacío.');
        } else if (seen.has(boundaryIntent.boundaryId)) {
          addIssue(issues, `${boundaryPath}.boundaryId`, 'SI-ROOF-BOUNDARY-INTENT-DUPLICATE', 'El borde está repetido.');
        } else if (!validBoundaries.has(boundaryIntent.boundaryId)) {
          addIssue(issues, `${boundaryPath}.boundaryId`, 'SI-ROOF-BOUNDARY-REFERENCE-NOT-FOUND', 'El borde no existe o pertenece a otra cubierta.');
        }
        seen.add(boundaryIntent.boundaryId);
        if (!ROOF_BOUNDARY_FUNCTIONS.includes(boundaryIntent.function)) {
          addIssue(issues, `${boundaryPath}.function`, 'SI-ROOF-BOUNDARY-FUNCTION-INVALID', 'La función de borde no está permitida.');
        }
        if (boundaryIntent.source !== 'userDeclared') addIssue(issues, `${boundaryPath}.source`, 'SI-INVALID-SOURCE', 'source debe ser userDeclared.');
      });
    }
    if (intent.status !== 'declared') addIssue(issues, `${path}.status`, 'SI-INVALID-STATUS', 'status debe ser declared.');
    if (intent.source !== 'userDeclared') addIssue(issues, `${path}.source`, 'SI-INVALID-SOURCE', 'source debe ser userDeclared.');
    if (intent.notes !== null && typeof intent.notes !== 'string') addIssue(issues, `${path}.notes`, 'SI-INVALID-NOTES', 'notes debe ser texto o null.');
  });
  return issues;
}

export function buildRoofIntent(roofGeometryId, input) {
  if (!isRecord(input)) fail('SI-INVALID-INTENT', 'La intención de cubierta debe ser un objeto.');
  for (const key of Object.keys(input)) {
    if (!ROOF_INTENT_KEYS.has(key)) fail('SI-UNKNOWN-FIELD', `El campo ${key} no pertenece al contrato de cubierta.`);
  }
  if (input.roofGeometryId !== undefined && !sameRoofId(input.roofGeometryId, roofGeometryId)) {
    fail('SI-ROOF-ID-MISMATCH', 'roofGeometryId no coincide con el objetivo de la mutación.');
  }
  const intentId = intentIdForRoof(roofGeometryId);
  if (input.intentId !== undefined && input.intentId !== intentId) fail('SI-INTENT-ID-MISMATCH', `intentId debe ser ${intentId}.`);
  return canonicalizeRoofIntent({
    intentId,
    roofGeometryId,
    loadDistribution: input.loadDistribution ?? 'undetermined',
    primaryResistanceDirection: input.primaryResistanceDirection ?? null,
    secondaryResistanceDirection: input.secondaryResistanceDirection ?? null,
    diaphragmBehavior: input.diaphragmBehavior ?? 'undetermined',
    boundaryIntents: Array.isArray(input.boundaryIntents)
      ? input.boundaryIntents.map((boundaryIntent) => ({
          boundaryId: boundaryIntent?.boundaryId,
          function: boundaryIntent?.function,
          source: boundaryIntent?.source ?? 'userDeclared'
        }))
      : input.boundaryIntents ?? [],
    status: input.status ?? 'declared',
    source: input.source ?? 'userDeclared',
    notes: input.notes ?? null
  });
}

function projectRequestedRoofs(model, ids) {
  try {
    return projectAgnosticRoofGeometry(model, ids);
  } catch (error) {
    throw new RoofStructuralIntentError(
      'SI-ROOF-GEOMETRY-UNRESOLVABLE',
      error instanceof Error ? error.message : 'La geometría de cubierta no es resoluble.',
      error?.details || [{ code: error?.code, path: error?.path, ids: error?.ids }]
    );
  }
}

function modelRoofIds(model) {
  return new Map([
    ...(Array.isArray(model?.roofSystems) ? model.roofSystems : []),
    ...(Array.isArray(model?.roofPlanes) ? model.roofPlanes : [])
  ].map((roof) => [roofIdToken(roof?.id), roof?.id]));
}

export function resolveRoofGeometryForIntent(model, roofGeometryId) {
  const roofs = projectRequestedRoofs(model, [roofGeometryId]);
  const matches = roofs.filter((roof) => sameRoofId(roof.id, roofGeometryId));
  if (matches.length !== 1) {
    fail(
      matches.length === 0 ? 'SI-ROOF-REFERENCE-NOT-FOUND' : 'SI-ROOF-REFERENCE-AMBIGUOUS',
      `roofGeometryId ${String(roofGeometryId)} debe resolver exactamente una cubierta.`,
      'roofGeometryId',
      [roofGeometryId]
    );
  }
  canonicalizeRoofBoundaries(matches[0]);
  return matches[0];
}

export function roofBoundaryFindingId(roofGeometryId, removedBoundaryIds) {
  return `finding:${ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE}:roof:${roofIdToken(roofGeometryId)}`
    + `:boundaries:${[...removedBoundaryIds].sort(compareText).join('|')}`;
}

export function canonicalizeRoofBoundaryFinding(finding) {
  return {
    ...cloneJson(finding),
    removedBoundaryIds: Array.isArray(finding.removedBoundaryIds)
      ? [...finding.removedBoundaryIds].sort(compareText)
      : finding.removedBoundaryIds,
    removedBoundaryIntents: Array.isArray(finding.removedBoundaryIntents)
      ? finding.removedBoundaryIntents.map(canonicalBoundaryIntent)
        .sort((left, right) => compareText(left.boundaryId, right.boundaryId))
      : finding.removedBoundaryIntents
  };
}

export function validateRoofBoundaryFinding(finding, path, roofGeometryIds, issues) {
  if (finding.code !== ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE) return false;
  if (finding.status !== 'open' || finding.severity !== 'warning') {
    addIssue(issues, path, 'SI-INVALID-FINDING-STATE', 'El finding de cubierta debe permanecer open/warning.');
  }
  if (!roofGeometryIds.has(roofIdToken(finding.roofGeometryId))) {
    addIssue(issues, `${path}.roofGeometryId`, 'SI-ROOF-REFERENCE-NOT-FOUND', 'La cubierta del finding no existe.');
  }
  if (!Array.isArray(finding.removedBoundaryIds) || finding.removedBoundaryIds.length === 0) {
    addIssue(issues, `${path}.removedBoundaryIds`, 'SI-ROOF-FINDING-BOUNDARIES-INVALID', 'El finding debe conservar los bordes removidos.');
  }
  if (!Array.isArray(finding.removedBoundaryIntents)
      || finding.removedBoundaryIntents.length !== finding.removedBoundaryIds?.length) {
    addIssue(issues, `${path}.removedBoundaryIntents`, 'SI-ROOF-FINDING-DECLARATIONS-INVALID', 'El finding debe conservar cada declaración removida.');
  }
  return true;
}

export function reconcileRoofIntentsAfterGeometryChange(originalModel, nextModel, helpers) {
  void originalModel;
  const root = helpers.currentRoot(nextModel);
  if (!Array.isArray(root.roofIntents) || root.roofIntents.length === 0) return nextModel;
  const existingIds = modelRoofIds(nextModel);
  const survivingIds = root.roofIntents
    .map((intent) => intent.roofGeometryId)
    .filter((id) => existingIds.has(roofIdToken(id)));
  const resolvedRoofs = projectRequestedRoofs(nextModel, survivingIds);
  const resolvedMap = roofGeometryMap(resolvedRoofs);
  const nextIntents = [];
  const newFindings = [];

  for (const intent of root.roofIntents) {
    const key = roofIdToken(intent.roofGeometryId);
    if (!existingIds.has(key)) continue;
    const matches = resolvedMap.get(key) || [];
    if (matches.length !== 1) {
      fail('SI-ROOF-REFERENCE-AMBIGUOUS', `La cubierta ${String(intent.roofGeometryId)} no resolvió exactamente una geometría.`);
    }
    const validBoundaryIds = new Set(canonicalizeRoofBoundaries(matches[0]).map((boundary) => boundary.boundaryId));
    const removed = intent.boundaryIntents.filter((boundaryIntent) => !validBoundaryIds.has(boundaryIntent.boundaryId));
    if (removed.length === 0) {
      nextIntents.push(intent);
      continue;
    }
    const removedBoundaryIds = removed.map((boundaryIntent) => boundaryIntent.boundaryId).sort(compareText);
    nextIntents.push({
      ...intent,
      boundaryIntents: intent.boundaryIntents.filter((boundaryIntent) => validBoundaryIds.has(boundaryIntent.boundaryId))
    });
    newFindings.push(canonicalizeRoofBoundaryFinding({
      findingId: roofBoundaryFindingId(intent.roofGeometryId, removedBoundaryIds),
      code: ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE,
      severity: 'warning',
      status: 'open',
      roofGeometryId: intent.roofGeometryId,
      removedBoundaryIds,
      removedBoundaryIntents: removed,
      message: 'La geometría cambió y se retiraron declaraciones de bordes que ya no existen; no se reasignaron por proximidad ni por índice.'
    }));
  }

  const survivingRoofKeys = new Set(nextIntents.map((intent) => roofIdToken(intent.roofGeometryId)));
  const previousFindings = (Array.isArray(nextModel.structuralIntentFindings)
    ? nextModel.structuralIntentFindings
    : []).filter((finding) => (
    finding?.code !== ROOF_BOUNDARY_REVIEW_AFTER_GEOMETRY_CHANGE
    || survivingRoofKeys.has(roofIdToken(finding.roofGeometryId))
  ));
  const newIds = new Set(newFindings.map((finding) => finding.findingId));
  const findings = [
    ...previousFindings.filter((finding) => !newIds.has(finding?.findingId)),
    ...newFindings
  ].sort((left, right) => compareText(String(left?.findingId), String(right?.findingId)));
  const structuralIntent = helpers.canonicalizeRoot({ ...root, roofIntents: nextIntents });
  const changed = JSON.stringify(structuralIntent.roofIntents) !== JSON.stringify(root.roofIntents)
    || JSON.stringify(findings) !== JSON.stringify(nextModel.structuralIntentFindings || []);
  return changed ? { ...nextModel, structuralIntent, structuralIntentFindings: findings } : nextModel;
}
