import { canonicalizeRoofIntent } from './roofStructuralIntent.js';

export const STRUCTURAL_INTENT_TRACE_SCHEMA = 'structural-intent-trace-v1.0';
export const STRUCTURAL_INTENT_TRACE_ACTION = 'structuralIntentUpdated';
export const STRUCTURAL_INTENT_TRACE_OPERATIONS = Object.freeze([
  'set',
  'remove',
  'batchSet',
  'batchRemove'
]);
export const STRUCTURAL_INTENT_TRACE_TARGET_TYPES = Object.freeze(['element', 'roof']);
export const STRUCTURAL_INTENT_TRACE_CHANGE_KINDS = Object.freeze([
  'created',
  'modified',
  'removed'
]);

const TRACE_KEYS = new Set(['schema', 'events']);
const EVENT_KEYS = new Set([
  'sequence',
  'action',
  'operation',
  'targetType',
  'changes',
  'source'
]);
const CHANGE_KEYS = new Set([
  'targetType',
  'targetId',
  'changeKind',
  'previousFingerprint',
  'nextFingerprint'
]);
const ELEMENT_FUNCTION_ORDER = new Map([
  'gravityResistance',
  'inPlaneLateralResistance',
  'loadTransfer',
  'diaphragmAction',
  'collectorAction',
  'support',
  'stabilization',
  'spaceDivision',
  'buildingEnvelope'
].map((value, index) => [value, index]));
const SHA256_CONSTANTS = new Uint32Array([
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

export class StructuralIntentTraceError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'StructuralIntentTraceError';
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

function idToken(id) {
  if (typeof id === 'number') return `number:${String(id)}`;
  if (typeof id === 'string') return `string:${id}`;
  return `${typeof id}:${String(id)}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareIds(left, right) {
  return compareText(idToken(left), idToken(right));
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

function canonicalElementIntent(intent) {
  if (!isRecord(intent)) return cloneJson(intent);
  return {
    intentId: intent.intentId,
    elementId: intent.elementId,
    participation: intent.participation,
    functions: Array.isArray(intent.functions)
      ? [...intent.functions].sort((left, right) => (
          (ELEMENT_FUNCTION_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER)
          - (ELEMENT_FUNCTION_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
          || compareText(String(left), String(right))
        ))
      : intent.functions,
    secondaryInteraction: intent.secondaryInteraction,
    status: intent.status,
    source: intent.source,
    notes: intent.notes
  };
}

function canonicalTargetIntent(targetType, intent) {
  if (intent === null) return null;
  if (targetType === 'element') return canonicalElementIntent(intent);
  if (targetType === 'roof') return canonicalizeRoofIntent(intent);
  throw new StructuralIntentTraceError(
    'SI-TRACE-TARGET-TYPE-INVALID',
    `targetType ${String(targetType)} no está permitido.`
  );
}

export function createEmptyStructuralIntentTrace() {
  return { schema: STRUCTURAL_INTENT_TRACE_SCHEMA, events: [] };
}

export function fingerprintStructuralIntentTarget(targetType, targetId, intentOrNull) {
  if (!STRUCTURAL_INTENT_TRACE_TARGET_TYPES.includes(targetType)) {
    throw new StructuralIntentTraceError(
      'SI-TRACE-TARGET-TYPE-INVALID',
      `targetType ${String(targetType)} no está permitido.`
    );
  }
  if (!['number', 'string'].includes(typeof targetId) || targetId === '') {
    throw new StructuralIntentTraceError(
      'SI-TRACE-TARGET-ID-INVALID',
      'targetId debe ser string o number no vacío.'
    );
  }
  const envelope = {
    targetType,
    targetId,
    intent: canonicalTargetIntent(targetType, intentOrNull)
  };
  return sha256(JSON.stringify(envelope));
}

function canonicalChange(change) {
  return {
    targetType: change.targetType,
    targetId: change.targetId,
    changeKind: change.changeKind,
    previousFingerprint: change.previousFingerprint,
    nextFingerprint: change.nextFingerprint
  };
}

function canonicalEvent(event) {
  return {
    sequence: event.sequence,
    action: event.action,
    operation: event.operation,
    targetType: event.targetType,
    changes: Array.isArray(event.changes)
      ? event.changes.map(canonicalChange).sort((left, right) => (
          compareText(String(left.targetType), String(right.targetType))
          || compareIds(left.targetId, right.targetId)
        ))
      : event.changes,
    source: event.source
  };
}

export function canonicalizeStructuralIntentTrace(trace) {
  if (trace === undefined) return undefined;
  if (!isRecord(trace)) return trace;
  return {
    schema: trace.schema,
    events: Array.isArray(trace.events)
      ? trace.events.map(canonicalEvent).sort((left, right) => left.sequence - right.sequence)
      : trace.events
  };
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

export function validateStructuralIntentTrace(trace) {
  if (trace === undefined) return [];
  const issues = [];
  if (!isRecord(trace)) {
    return [{
      path: 'structuralIntentTrace',
      code: 'SI-TRACE-EXPECTED-OBJECT',
      message: 'structuralIntentTrace debe ser un objeto.'
    }];
  }
  for (const key of Object.keys(trace)) {
    if (!TRACE_KEYS.has(key)) {
      addIssue(issues, `structuralIntentTrace.${key}`, 'SI-TRACE-UNKNOWN-FIELD', `El campo ${key} no pertenece al registro.`);
    }
  }
  if (trace.schema !== STRUCTURAL_INTENT_TRACE_SCHEMA) {
    addIssue(issues, 'structuralIntentTrace.schema', 'SI-TRACE-SCHEMA-INVALID', `schema debe ser ${STRUCTURAL_INTENT_TRACE_SCHEMA}.`);
  }
  if (!Array.isArray(trace.events)) {
    addIssue(issues, 'structuralIntentTrace.events', 'SI-TRACE-EXPECTED-ARRAY', 'events debe ser un arreglo.');
    return issues;
  }
  trace.events.forEach((event, index) => {
    const path = `structuralIntentTrace.events[${index}]`;
    if (!isRecord(event)) {
      addIssue(issues, path, 'SI-TRACE-EXPECTED-OBJECT', 'El evento debe ser un objeto.');
      return;
    }
    for (const key of Object.keys(event)) {
      if (!EVENT_KEYS.has(key)) addIssue(issues, `${path}.${key}`, 'SI-TRACE-UNKNOWN-FIELD', `El campo ${key} no pertenece al evento.`);
    }
    if (event.sequence !== index + 1) {
      addIssue(issues, `${path}.sequence`, 'SI-TRACE-SEQUENCE-INVALID', `sequence debe ser ${index + 1}.`);
    }
    if (event.action !== STRUCTURAL_INTENT_TRACE_ACTION) {
      addIssue(issues, `${path}.action`, 'SI-TRACE-ACTION-INVALID', `action debe ser ${STRUCTURAL_INTENT_TRACE_ACTION}.`);
    }
    if (!STRUCTURAL_INTENT_TRACE_OPERATIONS.includes(event.operation)) {
      addIssue(issues, `${path}.operation`, 'SI-TRACE-OPERATION-INVALID', 'operation no está permitida.');
    }
    if (!STRUCTURAL_INTENT_TRACE_TARGET_TYPES.includes(event.targetType)) {
      addIssue(issues, `${path}.targetType`, 'SI-TRACE-TARGET-TYPE-INVALID', 'targetType no está permitido.');
    }
    if (event.source !== 'userAction') {
      addIssue(issues, `${path}.source`, 'SI-TRACE-SOURCE-INVALID', 'source debe ser userAction.');
    }
    if (!Array.isArray(event.changes) || event.changes.length === 0) {
      addIssue(issues, `${path}.changes`, 'SI-TRACE-CHANGES-INVALID', 'changes debe contener al menos un cambio efectivo.');
      return;
    }
    let previousToken = null;
    event.changes.forEach((change, changeIndex) => {
      const changePath = `${path}.changes[${changeIndex}]`;
      if (!isRecord(change)) {
        addIssue(issues, changePath, 'SI-TRACE-EXPECTED-OBJECT', 'El cambio debe ser un objeto.');
        return;
      }
      for (const key of Object.keys(change)) {
        if (!CHANGE_KEYS.has(key)) addIssue(issues, `${changePath}.${key}`, 'SI-TRACE-UNKNOWN-FIELD', `El campo ${key} no pertenece al cambio.`);
      }
      if (change.targetType !== event.targetType) {
        addIssue(issues, `${changePath}.targetType`, 'SI-TRACE-TARGET-TYPE-MISMATCH', 'El tipo del cambio debe coincidir con el evento.');
      }
      if (!['number', 'string'].includes(typeof change.targetId) || change.targetId === '') {
        addIssue(issues, `${changePath}.targetId`, 'SI-TRACE-TARGET-ID-INVALID', 'targetId debe ser string o number no vacío.');
      }
      if (!STRUCTURAL_INTENT_TRACE_CHANGE_KINDS.includes(change.changeKind)) {
        addIssue(issues, `${changePath}.changeKind`, 'SI-TRACE-CHANGE-KIND-INVALID', 'changeKind no está permitido.');
      }
      for (const field of ['previousFingerprint', 'nextFingerprint']) {
        if (!/^[a-f0-9]{64}$/.test(change[field])) {
          addIssue(issues, `${changePath}.${field}`, 'SI-TRACE-FINGERPRINT-INVALID', `${field} debe ser SHA-256 hexadecimal minúsculo.`);
        }
      }
      if (change.previousFingerprint === change.nextFingerprint) {
        addIssue(issues, changePath, 'SI-TRACE-NO-OP-CHANGE', 'Un evento no puede registrar un no-op.');
      }
      const token = `${change.targetType}|${idToken(change.targetId)}`;
      if (previousToken !== null && compareText(previousToken, token) >= 0) {
        addIssue(issues, changePath, 'SI-TRACE-CHANGE-ORDER-INVALID', 'changes debe estar ordenado y no contener objetivos repetidos.');
      }
      previousToken = token;
    });
  });
  return issues;
}

export function assertValidStructuralIntentTrace(trace) {
  const issues = validateStructuralIntentTrace(trace);
  if (issues.length > 0) {
    throw new StructuralIntentTraceError(
      'SI-TRACE-VALIDATION-FAILED',
      `La trazabilidad no cumple el contrato (${issues.length} problema${issues.length === 1 ? '' : 's'}).`,
      issues
    );
  }
  return canonicalizeStructuralIntentTrace(trace);
}

export function appendStructuralIntentUserEvent(model, eventInput) {
  if (!isRecord(model) || !isRecord(eventInput)) {
    throw new StructuralIntentTraceError('SI-TRACE-INVALID-INPUT', 'Modelo y evento deben ser objetos.');
  }
  const { operation, targetType } = eventInput;
  if (!STRUCTURAL_INTENT_TRACE_OPERATIONS.includes(operation)) {
    throw new StructuralIntentTraceError('SI-TRACE-OPERATION-INVALID', 'operation no está permitida.');
  }
  if (!STRUCTURAL_INTENT_TRACE_TARGET_TYPES.includes(targetType)) {
    throw new StructuralIntentTraceError('SI-TRACE-TARGET-TYPE-INVALID', 'targetType no está permitido.');
  }
  if (!Array.isArray(eventInput.changes) || eventInput.changes.length === 0) return model;
  const effectiveChanges = eventInput.changes.map((change) => {
    if (!isRecord(change)) {
      throw new StructuralIntentTraceError('SI-TRACE-CHANGE-INVALID', 'Cada cambio debe ser un objeto.');
    }
    const previousIntent = change.previousIntent ?? null;
    const nextIntent = change.nextIntent ?? null;
    const previousFingerprint = fingerprintStructuralIntentTarget(targetType, change.targetId, previousIntent);
    const nextFingerprint = fingerprintStructuralIntentTarget(targetType, change.targetId, nextIntent);
    if (previousFingerprint === nextFingerprint) return null;
    return {
      targetType,
      targetId: change.targetId,
      changeKind: previousIntent === null ? 'created' : nextIntent === null ? 'removed' : 'modified',
      previousFingerprint,
      nextFingerprint
    };
  }).filter(Boolean).sort((left, right) => compareIds(left.targetId, right.targetId));
  if (effectiveChanges.length === 0) return model;

  const currentTrace = model.structuralIntentTrace === undefined
    ? createEmptyStructuralIntentTrace()
    : assertValidStructuralIntentTrace(model.structuralIntentTrace);
  const event = canonicalEvent({
    sequence: currentTrace.events.length + 1,
    action: STRUCTURAL_INTENT_TRACE_ACTION,
    operation,
    targetType,
    changes: effectiveChanges,
    source: 'userAction'
  });
  const trace = assertValidStructuralIntentTrace({
    schema: STRUCTURAL_INTENT_TRACE_SCHEMA,
    events: [...currentTrace.events, event]
  });
  return { ...model, structuralIntentTrace: trace };
}
