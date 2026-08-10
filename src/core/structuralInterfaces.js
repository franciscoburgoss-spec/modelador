import { canonicalizeRoofBoundaries } from './roofStructuralIntent.js';
import {
  canonicalizeValue,
  compareIds,
  compareText,
  geometryIndexes,
  idToken,
  roofBoundaryFrame,
  semanticId,
  sourceFingerprint,
  wallFrame
} from './structuralProposalCommon.js';

export const STRUCTURAL_INTERFACE_OWNER_KINDS = Object.freeze(['element', 'roofBoundary']);
export const STRUCTURAL_INTERFACE_LOCATOR_KINDS = Object.freeze(['face', 'end', 'region', 'boundary']);
export const STRUCTURAL_INTERFACE_FACE_SIDES = Object.freeze(['positiveN', 'negativeN']);
export const STRUCTURAL_INTERFACE_ENDS = Object.freeze(['lowS', 'highS']);
export const STRUCTURAL_INTERFACE_ROLES = Object.freeze(['receives', 'delivers']);
export const STRUCTURAL_ACTION_FAMILIES = Object.freeze(['gravity', 'lateral', 'undetermined']);
export const STRUCTURAL_RELATION_FUNCTIONS = Object.freeze([
  'support',
  'loadTransfer',
  'collectorAction',
  'diaphragmAction',
  'stabilization'
]);

const INTERFACE_KEYS = new Set([
  'interfaceId', 'ownerRef', 'locator', 'hostGeometryFingerprint', 'source', 'notes'
]);
const RELATION_KEYS = new Set([
  'relationId', 'ports', 'actionFamily', 'structuralFunction', 'carrierRegions', 'source', 'notes'
]);
const OWNER_KEYS = new Set(['kind', 'id', 'roofGeometryId', 'boundaryId']);
const LOCATOR_KEYS = new Set(['kind', 'side', 'end', 'sRange', 'zRange']);
const PORT_KEYS = new Set(['interfaceRef', 'interactionRole']);
const REGION_KEYS = new Set(['ownerRef', 'sRange', 'zRange']);
const INTERFACE_RANGE_TOLERANCE = 1e-6;

export class StructuralInterfaceError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'StructuralInterfaceError';
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
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  return value;
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function sameId(left, right) {
  return idToken(left) === idToken(right);
}

function normalizeRange(value) {
  return Array.isArray(value) && value.length === 2
    ? [Math.min(value[0], value[1]), Math.max(value[0], value[1])]
    : value;
}

function canonicalOwnerRef(ownerRef) {
  if (!isRecord(ownerRef)) return cloneJson(ownerRef);
  if (ownerRef.kind === 'element') return { kind: 'element', id: ownerRef.id };
  if (ownerRef.kind === 'roofBoundary') {
    return {
      kind: 'roofBoundary',
      roofGeometryId: ownerRef.roofGeometryId,
      boundaryId: ownerRef.boundaryId
    };
  }
  return cloneJson(ownerRef);
}

export function canonicalizeStructuralRegion(region) {
  if (!isRecord(region)) return cloneJson(region);
  return {
    ownerRef: canonicalOwnerRef(region.ownerRef),
    sRange: normalizeRange(region.sRange),
    zRange: normalizeRange(region.zRange)
  };
}

export function canonicalizeInterfaceLocator(locator) {
  if (!isRecord(locator)) return cloneJson(locator);
  const base = { kind: locator.kind };
  if (locator.kind === 'face') base.side = locator.side;
  if (locator.kind === 'end') base.end = locator.end;
  if (locator.sRange !== undefined) base.sRange = normalizeRange(locator.sRange);
  if (locator.zRange !== undefined) base.zRange = normalizeRange(locator.zRange);
  return base;
}

function interfaceIdentityPayload(ownerRef, locator) {
  return {
    ownerRef: canonicalOwnerRef(ownerRef),
    locator: canonicalizeInterfaceLocator(locator)
  };
}

export function interfaceIdFor(ownerRef, locator) {
  return semanticId('iface', interfaceIdentityPayload(ownerRef, locator));
}

function canonicalPort(port) {
  return {
    interfaceRef: port.interfaceRef,
    interactionRole: port.interactionRole
  };
}

function relationIdentityPayload(relation) {
  return {
    ports: [...relation.ports]
      .map(canonicalPort)
      .sort((left, right) => (
        compareText(left.interactionRole, right.interactionRole)
        || compareText(left.interfaceRef, right.interfaceRef)
      )),
    actionFamily: relation.actionFamily,
    structuralFunction: relation.structuralFunction,
    carrierRegions: [...(relation.carrierRegions || [])]
      .map(canonicalizeStructuralRegion)
      .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
  };
}

export function relationIdFor(relation) {
  return semanticId('rel', relationIdentityPayload(relation));
}

export function canonicalizeInterfaceIntent(intent) {
  if (!isRecord(intent)) return cloneJson(intent);
  return {
    interfaceId: intent.interfaceId,
    ownerRef: canonicalOwnerRef(intent.ownerRef),
    locator: canonicalizeInterfaceLocator(intent.locator),
    hostGeometryFingerprint: intent.hostGeometryFingerprint,
    source: intent.source,
    notes: intent.notes
  };
}

export function canonicalizeRelationIntent(relation) {
  if (!isRecord(relation)) return cloneJson(relation);
  return {
    relationId: relation.relationId,
    ports: Array.isArray(relation.ports)
      ? relation.ports.map(canonicalPort).sort((left, right) => (
          compareText(left.interactionRole, right.interactionRole)
          || compareText(left.interfaceRef, right.interfaceRef)
        ))
      : relation.ports,
    actionFamily: relation.actionFamily,
    structuralFunction: relation.structuralFunction,
    carrierRegions: Array.isArray(relation.carrierRegions)
      ? relation.carrierRegions.map(canonicalizeStructuralRegion)
        .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
      : relation.carrierRegions,
    source: relation.source,
    notes: relation.notes
  };
}

export function canonicalizeInterfaceIntents(intents) {
  if (!Array.isArray(intents)) return intents;
  return intents.map(canonicalizeInterfaceIntent)
    .sort((left, right) => compareText(String(left?.interfaceId), String(right?.interfaceId)));
}

export function canonicalizeRelationIntents(relations) {
  if (!Array.isArray(relations)) return relations;
  return relations.map(canonicalizeRelationIntent)
    .sort((left, right) => compareText(String(left?.relationId), String(right?.relationId)));
}

function finiteRange(range) {
  return Array.isArray(range)
    && range.length === 2
    && range.every(Number.isFinite)
    && range[1] > range[0];
}

function ownerKey(ownerRef) {
  if (ownerRef?.kind === 'element') return `element:${idToken(ownerRef.id)}`;
  if (ownerRef?.kind === 'roofBoundary') {
    return `roofBoundary:${idToken(ownerRef.roofGeometryId)}:${String(ownerRef.boundaryId)}`;
  }
  return null;
}

function buildGeometryContext(geometry) {
  if (!isRecord(geometry) || geometry.schema !== 'agnostic-geometry-v1.0') return null;
  const indexes = geometryIndexes(geometry);
  const boundaryByKey = new Map();
  for (const roof of indexes.roofs) {
    for (const boundary of canonicalizeRoofBoundaries(roof)) {
      boundaryByKey.set(
        `roofBoundary:${idToken(roof.id)}:${String(boundary.boundaryId)}`,
        { roof, boundary }
      );
    }
  }
  return {
    indexes,
    wallById: new Map(indexes.walls.map((frame) => [idToken(frame.id), frame])),
    boundaryByKey
  };
}

export function roofBoundaryLongitudinalRange(boundary) {
  const frame = roofBoundaryFrame(boundary);
  return frame ? [frame.s0, frame.s1] : null;
}

export function roofBoundarySegmentForLocator(boundary, locator = { kind: 'boundary' }) {
  const frame = roofBoundaryFrame(boundary);
  if (!frame) return null;
  const range = locator?.sRange === undefined
    ? [frame.s0, frame.s1]
    : normalizeRange(locator.sRange);
  if (!finiteRange(range)) return null;
  if (range[0] < frame.s0 - INTERFACE_RANGE_TOLERANCE
    || range[1] > frame.s1 + INTERFACE_RANGE_TOLERANCE) return null;
  const startS = frame.axis === 'x' ? boundary.start.x : boundary.start.y;
  const endS = frame.axis === 'x' ? boundary.end.x : boundary.end.y;
  const deltaS = endS - startS;
  if (!Number.isFinite(deltaS) || Math.abs(deltaS) <= Number.EPSILON) return null;
  const pointAt = (s) => {
    const t = (s - startS) / deltaS;
    return {
      x: boundary.start.x + (boundary.end.x - boundary.start.x) * t,
      y: boundary.start.y + (boundary.end.y - boundary.start.y) * t,
      z: boundary.start.z + (boundary.end.z - boundary.start.z) * t
    };
  };
  return { start: pointAt(range[0]), end: pointAt(range[1]) };
}

function canonicalOwnerGeometry(context, ownerRef) {
  if (!context) return null;
  if (ownerRef?.kind === 'element') {
    const element = context.indexes.elementById.get(idToken(ownerRef.id));
    if (!element) return null;
    const frame = wallFrame(element);
    if (frame) {
      return canonicalizeValue({
        ownerKind: 'element',
        ownerId: element.id,
        type: 'wall',
        axis: frame.axis,
        fixed: frame.fixed,
        sRange: [frame.s0, frame.s1],
        zRange: [frame.z0, frame.z1],
        thickness: element.prism.thickness
      });
    }
    return canonicalizeValue({ ownerKind: 'element', ownerId: element.id, element });
  }
  if (ownerRef?.kind === 'roofBoundary') {
    const entry = context.boundaryByKey.get(ownerKey(ownerRef));
    if (!entry) return null;
    const boundary = entry.boundary;
    return canonicalizeValue({
      ownerKind: 'roofBoundary',
      roofGeometryId: entry.roof.id,
      boundaryId: boundary.boundaryId,
      start: boundary.start,
      end: boundary.end
    });
  }
  return null;
}

export function currentHostGeometryFingerprint(geometry, ownerRef) {
  const context = buildGeometryContext(geometry);
  const canonical = canonicalOwnerGeometry(context, ownerRef);
  return canonical ? sourceFingerprint(canonical) : null;
}

function locatorContainedByOwner(context, ownerRef, locator) {
  if (!context) return { ok: true, reason: null };
  if (ownerRef?.kind === 'element') {
    const frame = context.wallById.get(idToken(ownerRef.id));
    if (!frame) return { ok: false, reason: 'ownerMissing' };
    if (!['face', 'end', 'region'].includes(locator?.kind)) {
      return { ok: false, reason: 'locatorOwnerMismatch' };
    }
    const sRange = locator?.sRange ?? [frame.s0, frame.s1];
    const zRange = locator?.zRange ?? [frame.z0, frame.z1];
    const tolerance = INTERFACE_RANGE_TOLERANCE;
    if (!finiteRange(sRange) || !finiteRange(zRange)) return { ok: false, reason: 'rangeInvalid' };
    if (sRange[0] < frame.s0 - tolerance || sRange[1] > frame.s1 + tolerance
      || zRange[0] < frame.z0 - tolerance || zRange[1] > frame.z1 + tolerance) {
      return { ok: false, reason: 'rangeOutsideOwner' };
    }
    return { ok: true, reason: null };
  }
  if (ownerRef?.kind === 'roofBoundary') {
    const entry = context.boundaryByKey.get(ownerKey(ownerRef));
    if (!entry) return { ok: false, reason: 'ownerMissing' };
    if (locator?.kind !== 'boundary') return { ok: false, reason: 'locatorOwnerMismatch' };
    if (locator.sRange === undefined) return { ok: true, reason: null };
    const frame = roofBoundaryFrame(entry.boundary);
    const sRange = normalizeRange(locator.sRange);
    if (!frame || !finiteRange(sRange)) return { ok: false, reason: 'rangeInvalid' };
    if (sRange[0] < frame.s0 - INTERFACE_RANGE_TOLERANCE
      || sRange[1] > frame.s1 + INTERFACE_RANGE_TOLERANCE) {
      return { ok: false, reason: 'rangeOutsideOwner' };
    }
    return { ok: true, reason: null };
  }
  return { ok: false, reason: 'ownerInvalid' };
}

function validateOwnerRef(ownerRef, path, context, issues, { allowBroken = false } = {}) {
  if (!isRecord(ownerRef)) {
    addIssue(issues, path, 'SI-INTERFACE-OWNER-INVALID', 'ownerRef debe ser un objeto.');
    return;
  }
  for (const key of Object.keys(ownerRef)) {
    if (!OWNER_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece a ownerRef.`);
  }
  if (!STRUCTURAL_INTERFACE_OWNER_KINDS.includes(ownerRef.kind)) {
    addIssue(issues, `${path}.kind`, 'SI-INTERFACE-OWNER-KIND-INVALID', 'ownerRef.kind no está permitido.');
    return;
  }
  if (ownerRef.kind === 'element') {
    if (!['number', 'string'].includes(typeof ownerRef.id) || ownerRef.id === '') {
      addIssue(issues, `${path}.id`, 'SI-INTERFACE-OWNER-ID-INVALID', 'ownerRef.id debe ser string o number no vacío.');
    } else if (context && !context.indexes.elementById.has(idToken(ownerRef.id)) && !allowBroken) {
      addIssue(issues, `${path}.id`, 'SI-INTERFACE-OWNER-NOT-FOUND', `El elemento ${String(ownerRef.id)} no existe.`);
    }
  } else {
    if (!['number', 'string'].includes(typeof ownerRef.roofGeometryId) || ownerRef.roofGeometryId === '') {
      addIssue(issues, `${path}.roofGeometryId`, 'SI-INTERFACE-OWNER-ID-INVALID', 'roofGeometryId debe ser string o number no vacío.');
    }
    if (typeof ownerRef.boundaryId !== 'string' || ownerRef.boundaryId === '') {
      addIssue(issues, `${path}.boundaryId`, 'SI-INTERFACE-BOUNDARY-ID-INVALID', 'boundaryId debe ser texto no vacío.');
    } else if (context && !context.boundaryByKey.has(ownerKey(ownerRef)) && !allowBroken) {
      addIssue(issues, path, 'SI-INTERFACE-OWNER-NOT-FOUND', 'La referencia de borde de cubierta no existe.');
    }
  }
}

function validateLocator(locator, ownerRef, path, context, issues, { allowStale = true } = {}) {
  if (!isRecord(locator)) {
    addIssue(issues, path, 'SI-INTERFACE-LOCATOR-INVALID', 'locator debe ser un objeto.');
    return;
  }
  for (const key of Object.keys(locator)) {
    if (!LOCATOR_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece al locator.`);
  }
  if (!STRUCTURAL_INTERFACE_LOCATOR_KINDS.includes(locator.kind)) {
    addIssue(issues, `${path}.kind`, 'SI-INTERFACE-LOCATOR-KIND-INVALID', 'locator.kind no está permitido.');
  }
  if (locator.kind === 'face' && !STRUCTURAL_INTERFACE_FACE_SIDES.includes(locator.side)) {
    addIssue(issues, `${path}.side`, 'SI-INTERFACE-FACE-SIDE-INVALID', 'side debe ser positiveN o negativeN.');
  }
  if (locator.kind === 'end' && !STRUCTURAL_INTERFACE_ENDS.includes(locator.end)) {
    addIssue(issues, `${path}.end`, 'SI-INTERFACE-END-INVALID', 'end debe ser lowS o highS.');
  }
  if (locator.sRange !== undefined && !finiteRange(normalizeRange(locator.sRange))) {
    addIssue(issues, `${path}.sRange`, 'SI-INTERFACE-RANGE-INVALID', 'sRange debe contener dos números finitos y longitud positiva.');
  }
  if (locator.zRange !== undefined && !finiteRange(normalizeRange(locator.zRange))) {
    addIssue(issues, `${path}.zRange`, 'SI-INTERFACE-RANGE-INVALID', 'zRange debe contener dos números finitos y altura positiva.');
  }
  if (context) {
    const resolution = locatorContainedByOwner(context, ownerRef, canonicalizeInterfaceLocator(locator));
    if (!resolution.ok && (!allowStale || ['ownerInvalid', 'locatorOwnerMismatch', 'rangeInvalid'].includes(resolution.reason))) {
      addIssue(issues, path, 'SI-INTERFACE-LOCATOR-NOT-RESOLVABLE', `El locator no es resoluble sobre su owner (${resolution.reason}).`);
    }
  }
}

function validateRegion(region, path, context, issues, options = {}) {
  if (!isRecord(region)) {
    addIssue(issues, path, 'SI-STRUCTURAL-REGION-INVALID', 'La región debe ser un objeto.');
    return;
  }
  for (const key of Object.keys(region)) {
    if (!REGION_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece a structuralRegion.`);
  }
  validateOwnerRef(region.ownerRef, `${path}.ownerRef`, context, issues, options);
  if (region.ownerRef?.kind !== 'element') {
    addIssue(issues, `${path}.ownerRef.kind`, 'SI-STRUCTURAL-REGION-OWNER-INVALID', 'Una región estructural REV8 debe pertenecer a un elemento.');
  }
  const locator = { kind: 'region', sRange: region.sRange, zRange: region.zRange };
  validateLocator(locator, region.ownerRef, path, context, issues, options);
}

export function validateInterfaceIntents(intents, geometry = null, options = {}) {
  const issues = [];
  if (!Array.isArray(intents)) return [{ path: 'structuralIntent.interfaceIntents', code: 'SI-EXPECTED-ARRAY', message: 'interfaceIntents debe ser un arreglo.' }];
  const context = buildGeometryContext(geometry);
  const ids = new Set();
  intents.forEach((intent, index) => {
    const path = `structuralIntent.interfaceIntents[${index}]`;
    if (!isRecord(intent)) {
      addIssue(issues, path, 'SI-INTERFACE-EXPECTED-OBJECT', 'La interfaz debe ser un objeto.');
      return;
    }
    for (const key of Object.keys(intent)) {
      if (!INTERFACE_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece a interfaceIntent.`);
    }
    validateOwnerRef(intent.ownerRef, `${path}.ownerRef`, context, issues, options);
    validateLocator(intent.locator, intent.ownerRef, `${path}.locator`, context, issues, options);
    const expectedId = interfaceIdFor(intent.ownerRef, intent.locator);
    if (intent.interfaceId !== expectedId) addIssue(issues, `${path}.interfaceId`, 'SI-INTERFACE-ID-INVALID', `interfaceId debe ser ${expectedId}.`);
    if (ids.has(intent.interfaceId)) addIssue(issues, `${path}.interfaceId`, 'SI-INTERFACE-ID-DUPLICATE', 'interfaceId está duplicado.');
    ids.add(intent.interfaceId);
    if (typeof intent.hostGeometryFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(intent.hostGeometryFingerprint)) {
      addIssue(issues, `${path}.hostGeometryFingerprint`, 'SI-INTERFACE-FINGERPRINT-INVALID', 'hostGeometryFingerprint debe ser SHA-256 hexadecimal.');
    }
    if (intent.source !== 'userDeclared') addIssue(issues, `${path}.source`, 'SI-INTERFACE-SOURCE-INVALID', 'source debe ser userDeclared.');
    if (intent.notes !== null && typeof intent.notes !== 'string') addIssue(issues, `${path}.notes`, 'SI-INTERFACE-NOTES-INVALID', 'notes debe ser texto o null.');
  });
  return issues;
}

export function validateRelationIntents(relations, interfaceIntents, geometry = null, options = {}) {
  const issues = [];
  if (!Array.isArray(relations)) return [{ path: 'structuralIntent.relationIntents', code: 'SI-EXPECTED-ARRAY', message: 'relationIntents debe ser un arreglo.' }];
  const context = buildGeometryContext(geometry);
  const interfaces = new Map((Array.isArray(interfaceIntents) ? interfaceIntents : []).map((item) => [item.interfaceId, item]));
  const ids = new Set();
  relations.forEach((relation, index) => {
    const path = `structuralIntent.relationIntents[${index}]`;
    if (!isRecord(relation)) {
      addIssue(issues, path, 'SI-RELATION-EXPECTED-OBJECT', 'La relación debe ser un objeto.');
      return;
    }
    for (const key of Object.keys(relation)) {
      if (!RELATION_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece a relationIntent.`);
    }
    if (!Array.isArray(relation.ports) || relation.ports.length < 2) {
      addIssue(issues, `${path}.ports`, 'SI-RELATION-PORTS-INVALID', 'Una relación requiere al menos dos puertos.');
    } else {
      const seenPorts = new Set();
      let receives = 0;
      let delivers = 0;
      relation.ports.forEach((port, portIndex) => {
        const portPath = `${path}.ports[${portIndex}]`;
        if (!isRecord(port)) {
          addIssue(issues, portPath, 'SI-RELATION-PORT-INVALID', 'El puerto debe ser un objeto.');
          return;
        }
        for (const key of Object.keys(port)) {
          if (!PORT_KEYS.has(key)) addIssue(issues, `${portPath}.${key}`, 'SI-INTERFACE-UNKNOWN-FIELD', `El campo ${key} no pertenece al puerto.`);
        }
        if (typeof port.interfaceRef !== 'string' || port.interfaceRef === '') {
          addIssue(issues, `${portPath}.interfaceRef`, 'SI-RELATION-INTERFACE-REF-INVALID', 'interfaceRef debe ser texto no vacío.');
        } else if (!interfaces.has(port.interfaceRef) && !options.allowBroken) {
          addIssue(issues, `${portPath}.interfaceRef`, 'SI-RELATION-INTERFACE-NOT-FOUND', `La interfaz ${port.interfaceRef} no existe.`);
        }
        if (!STRUCTURAL_INTERFACE_ROLES.includes(port.interactionRole)) {
          addIssue(issues, `${portPath}.interactionRole`, 'SI-RELATION-ROLE-INVALID', 'interactionRole debe ser receives o delivers.');
        }
        if (port.interactionRole === 'receives') receives += 1;
        if (port.interactionRole === 'delivers') delivers += 1;
        const key = `${port.interactionRole}:${port.interfaceRef}`;
        if (seenPorts.has(key)) addIssue(issues, portPath, 'SI-RELATION-PORT-DUPLICATE', 'La relación repite literalmente un puerto.');
        seenPorts.add(key);
      });
      if (receives === 0 || delivers === 0) addIssue(issues, `${path}.ports`, 'SI-RELATION-DIRECTION-INCOMPLETE', 'La relación requiere al menos un receives y un delivers.');
    }
    if (!STRUCTURAL_ACTION_FAMILIES.includes(relation.actionFamily)) {
      addIssue(issues, `${path}.actionFamily`, 'SI-RELATION-ACTION-FAMILY-INVALID', 'actionFamily no está permitida.');
    }
    if (!STRUCTURAL_RELATION_FUNCTIONS.includes(relation.structuralFunction)) {
      addIssue(issues, `${path}.structuralFunction`, 'SI-RELATION-FUNCTION-INVALID', 'structuralFunction no está permitida.');
    }
    if (!Array.isArray(relation.carrierRegions)) {
      addIssue(issues, `${path}.carrierRegions`, 'SI-EXPECTED-ARRAY', 'carrierRegions debe ser un arreglo.');
    } else {
      relation.carrierRegions.forEach((region, regionIndex) => validateRegion(
        region,
        `${path}.carrierRegions[${regionIndex}]`,
        context,
        issues,
        options
      ));
    }
    const expectedId = relationIdFor(relation);
    if (relation.relationId !== expectedId) addIssue(issues, `${path}.relationId`, 'SI-RELATION-ID-INVALID', `relationId debe ser ${expectedId}.`);
    if (ids.has(relation.relationId)) addIssue(issues, `${path}.relationId`, 'SI-RELATION-ID-DUPLICATE', 'relationId está duplicado.');
    ids.add(relation.relationId);
    if (relation.source !== 'userDeclared') addIssue(issues, `${path}.source`, 'SI-RELATION-SOURCE-INVALID', 'source debe ser userDeclared.');
    if (relation.notes !== null && typeof relation.notes !== 'string') addIssue(issues, `${path}.notes`, 'SI-RELATION-NOTES-INVALID', 'notes debe ser texto o null.');
  });
  return issues;
}

export function buildInterfaceIntent(geometry, input) {
  if (!isRecord(input)) throw new StructuralInterfaceError('SI-INTERFACE-INVALID', 'La interfaz debe ser un objeto.');
  const ownerRef = canonicalOwnerRef(input.ownerRef);
  const locator = canonicalizeInterfaceLocator(input.locator);
  const context = buildGeometryContext(geometry);
  const issues = [];
  validateOwnerRef(ownerRef, 'ownerRef', context, issues);
  validateLocator(locator, ownerRef, 'locator', context, issues, { allowStale: false });
  const canonicalOwner = canonicalOwnerGeometry(context, ownerRef);
  if (!canonicalOwner) addIssue(issues, 'ownerRef', 'SI-INTERFACE-OWNER-NOT-FOUND', 'El owner de la interfaz no es resoluble.');
  if (issues.length > 0) throw new StructuralInterfaceError('SI-INTERFACE-VALIDATION-FAILED', 'La interfaz no cumple el contrato.', issues);
  return canonicalizeInterfaceIntent({
    interfaceId: interfaceIdFor(ownerRef, locator),
    ownerRef,
    locator,
    hostGeometryFingerprint: sourceFingerprint(canonicalOwner),
    source: 'userDeclared',
    notes: input.notes ?? null
  });
}

export function buildRelationIntent(geometry, interfaceIntents, input) {
  if (!isRecord(input)) throw new StructuralInterfaceError('SI-RELATION-INVALID', 'La relación debe ser un objeto.');
  const relation = {
    relationId: '',
    ports: Array.isArray(input.ports) ? input.ports.map(canonicalPort) : input.ports,
    actionFamily: input.actionFamily,
    structuralFunction: input.structuralFunction,
    carrierRegions: Array.isArray(input.carrierRegions)
      ? input.carrierRegions.map(canonicalizeStructuralRegion)
      : input.carrierRegions ?? [],
    source: 'userDeclared',
    notes: input.notes ?? null
  };
  relation.relationId = relationIdFor(relation);
  const issues = validateRelationIntents([relation], interfaceIntents, geometry, { allowStale: false });
  if (issues.length > 0) throw new StructuralInterfaceError('SI-RELATION-VALIDATION-FAILED', 'La relación no cumple el contrato.', issues);
  return canonicalizeRelationIntent(relation);
}

export function evaluateInterfaceFreshness(geometry, interfaceIntent) {
  const context = buildGeometryContext(geometry);
  const currentGeometry = canonicalOwnerGeometry(context, interfaceIntent?.ownerRef);
  if (!currentGeometry) {
    return {
      state: 'brokenReference',
      currentHostGeometryFingerprint: null,
      reason: 'ownerMissing'
    };
  }
  const locator = locatorContainedByOwner(context, interfaceIntent.ownerRef, interfaceIntent.locator);
  if (!locator.ok) {
    return {
      state: 'stale',
      currentHostGeometryFingerprint: sourceFingerprint(currentGeometry),
      reason: locator.reason
    };
  }
  const current = sourceFingerprint(currentGeometry);
  return {
    state: current === interfaceIntent.hostGeometryFingerprint ? 'fresh' : 'stale',
    currentHostGeometryFingerprint: current,
    reason: current === interfaceIntent.hostGeometryFingerprint ? null : 'hostGeometryChanged'
  };
}

export function evaluateRelationFreshness(geometry, relationIntent, interfaceIntents) {
  const byId = new Map((interfaceIntents || []).map((intent) => [intent.interfaceId, intent]));
  const interfaces = [];
  for (const port of relationIntent?.ports || []) {
    const intent = byId.get(port.interfaceRef);
    if (!intent) return { state: 'brokenReference', reason: 'interfaceMissing', interfaces };
    const freshness = evaluateInterfaceFreshness(geometry, intent);
    interfaces.push({ interfaceId: intent.interfaceId, ...freshness });
    if (freshness.state !== 'fresh') return { state: freshness.state, reason: freshness.reason, interfaces };
  }
  const context = buildGeometryContext(geometry);
  for (const region of relationIntent?.carrierRegions || []) {
    const resolution = locatorContainedByOwner(context, region.ownerRef, {
      kind: 'region', sRange: region.sRange, zRange: region.zRange
    });
    if (!resolution.ok) return { state: resolution.reason === 'ownerMissing' ? 'brokenReference' : 'stale', reason: resolution.reason, interfaces };
  }
  return { state: 'fresh', reason: null, interfaces };
}

export function wallInterfaceNormal(frame) {
  if (!frame) return null;
  return frame.axis === 'x' ? { x: 0, y: 1 } : { x: -1, y: 0 };
}

export function describeInterfaceIntent(geometry, interfaceIntent) {
  const context = buildGeometryContext(geometry);
  const owner = interfaceIntent?.ownerRef;
  if (owner?.kind === 'element') {
    const frame = context?.wallById.get(idToken(owner.id));
    if (!frame) return { title: 'Referencia rota', subtitle: `Elemento ${String(owner.id)}`, ownerType: 'element' };
    const locator = interfaceIntent.locator;
    const location = locator.kind === 'face'
      ? (locator.side === 'positiveN' ? 'cara +N' : 'cara −N')
      : locator.kind === 'end'
        ? (locator.end === 'lowS' ? 'extremo S mínimo' : 'extremo S máximo')
        : 'región estructural';
    return {
      title: `${location} · muro ${frame.axis.toUpperCase()}`,
      subtitle: `S ${frame.s0}→${frame.s1} · Z ${frame.z0}→${frame.z1}`,
      ownerType: 'element',
      ownerId: frame.id
    };
  }
  if (owner?.kind === 'roofBoundary') {
    const entry = context?.boundaryByKey.get(ownerKey(owner));
    return entry
      ? { title: 'Borde canónico de cubierta', subtitle: String(owner.boundaryId), ownerType: 'roofBoundary', roofGeometryId: owner.roofGeometryId }
      : { title: 'Referencia rota', subtitle: String(owner.boundaryId), ownerType: 'roofBoundary' };
  }
  return { title: 'Interfaz estructural', subtitle: String(interfaceIntent?.interfaceId ?? ''), ownerType: null };
}

export function relationEndpoints(relationIntent, interfaceIntents) {
  const byId = new Map((interfaceIntents || []).map((intent) => [intent.interfaceId, intent]));
  const delivers = [];
  const receives = [];
  for (const port of relationIntent?.ports || []) {
    const value = { ...port, interfaceIntent: byId.get(port.interfaceRef) ?? null };
    if (port.interactionRole === 'delivers') delivers.push(value);
    if (port.interactionRole === 'receives') receives.push(value);
  }
  return {
    delivers: delivers.sort((a, b) => compareText(a.interfaceRef, b.interfaceRef)),
    receives: receives.sort((a, b) => compareText(a.interfaceRef, b.interfaceRef))
  };
}

export function compareInterfaceOwnerRefs(left, right) {
  const leftKind = String(left?.kind ?? '');
  const rightKind = String(right?.kind ?? '');
  if (leftKind !== rightKind) return compareText(leftKind, rightKind);
  if (leftKind === 'element') return compareIds(left.id, right.id);
  return compareIds(left?.roofGeometryId, right?.roofGeometryId)
    || compareText(String(left?.boundaryId ?? ''), String(right?.boundaryId ?? ''));
}
