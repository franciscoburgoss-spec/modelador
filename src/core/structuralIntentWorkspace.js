import { projectAgnosticGeometry } from './agnosticGeometry.js';
import {
  ELEMENT_FUNCTIONS,
  ELEMENT_PARTICIPATIONS,
  SECONDARY_INTERACTIONS,
  StructuralIntentError,
  removeElementIntentsBatch,
  setElementIntent,
  setElementIntentsBatch,
  setRoofIntent
} from './structuralIntent.js';
import {
  ROOF_BOUNDARY_FUNCTIONS,
  ROOF_DIAPHRAGM_BEHAVIORS,
  ROOF_LOAD_DISTRIBUTIONS,
  canonicalizeRoofBoundaries
} from './roofStructuralIntent.js';
import { fingerprintStructuralIntentTarget } from './structuralIntentTrace.js';

export const STRUCTURAL_INTENT_WORKSPACE_TABS = Object.freeze([
  'summary',
  'elements',
  'roof',
  'intersections',
  'diaphragms',
  'pending',
  'trace'
]);

export const STRUCTURAL_INTENT_WORKSPACE_STATES = Object.freeze([
  'declared',
  'undefined',
  'invalid',
  'brokenReference'
]);

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function structuralIntentIdToken(id) {
  return `${typeof id}:${String(id)}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareStructuralIntentIds(left, right) {
  return compareText(structuralIntentIdToken(left), structuralIntentIdToken(right));
}

function sameId(left, right) {
  return structuralIntentIdToken(left) === structuralIntentIdToken(right);
}

function elementIntent(model, elementId) {
  return model.structuralIntent?.elementIntents?.find((intent) => sameId(intent.elementId, elementId)) ?? null;
}

function roofIntent(model, roofGeometryId) {
  return model.structuralIntent?.roofIntents?.find((intent) => sameId(intent.roofGeometryId, roofGeometryId)) ?? null;
}

function issueList(error) {
  if (Array.isArray(error?.details) && error.details.length > 0) return error.details;
  return [{ path: '$', code: error?.code || 'SI-UNEXPECTED', message: error?.message || 'Error inesperado.' }];
}

export function mapStructuralIntentIssuesToFields(issues = []) {
  const fields = {};
  for (const issue of issues) {
    const path = String(issue?.path || 'general');
    let field = 'general';
    if (path.includes('participation')) field = 'participation';
    else if (path.includes('functions')) field = 'functions';
    else if (path.includes('secondaryInteraction')) field = 'secondaryInteraction';
    else if (path.includes('notes')) field = 'notes';
    else if (path.includes('loadDistribution')) field = 'loadDistribution';
    else if (path.includes('primaryResistanceDirection')) field = 'primaryResistanceDirection';
    else if (path.includes('secondaryResistanceDirection')) field = 'secondaryResistanceDirection';
    else if (path.includes('diaphragmBehavior')) field = 'diaphragmBehavior';
    else if (path.includes('boundary')) field = 'boundaryIntents';
    else if (path.includes('elementId') || path.includes('roofGeometryId')) field = 'target';
    fields[field] ||= [];
    fields[field].push({ code: issue?.code, message: issue?.message, path });
  }
  return fields;
}

export function classifyWorkspaceState({ targetExists = true, intent = null, issues = [] } = {}) {
  if (!targetExists) return 'brokenReference';
  if (Array.isArray(issues) && issues.length > 0) return 'invalid';
  if (intent !== null) return 'declared';
  return 'undefined';
}

function geometrySummary(element) {
  if (element.type === 'wall' && element.prism) {
    const length = Math.hypot(
      element.prism.end.x - element.prism.start.x,
      element.prism.end.y - element.prism.start.y
    );
    return {
      kind: 'wall',
      length,
      thickness: element.prism.thickness,
      height: element.prism.height,
      openings: element.openings?.length || 0
    };
  }
  if (element.type === 'foundation') {
    return { kind: 'foundation', solids: element.solids?.length || 0 };
  }
  return { kind: element.type };
}

function planPointKey(point) {
  return `${Number(point.x).toFixed(3)},${Number(point.y).toFixed(3)}`;
}

function edgeKey(left, right) {
  return [planPointKey(left), planPointKey(right)].sort(compareText).join('|');
}

export function buildVisualRoofBoundaries(roofGeometry) {
  const canonical = canonicalizeRoofBoundaries(roofGeometry);
  const byEdge = new Map(canonical.map((boundary) => [edgeKey(boundary.start, boundary.end), boundary]));
  const polygon = [...roofGeometry.surface.boundary];
  if (polygon.length > 1 && planPointKey(polygon[0]) === planPointKey(polygon.at(-1))) polygon.pop();
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const boundary = byEdge.get(edgeKey(point, next));
    if (!boundary) {
      throw new StructuralIntentError(
        'SI-WORKSPACE-BOUNDARY-NOT-FOUND',
        `No fue posible vincular el borde visual B${index + 1}.`
      );
    }
    return { ...boundary, label: `B${index + 1}`, traversalIndex: index };
  });
}

export function buildElementIntentDraft(model, elementId) {
  const target = model.elements?.find((element) => sameId(element?.id, elementId));
  const current = elementIntent(model, elementId);
  return {
    targetExists: !!target,
    elementId: target?.id ?? elementId,
    participation: current?.participation ?? '',
    functions: current ? [...current.functions] : [],
    secondaryInteraction: current?.secondaryInteraction ?? 'notApplicable',
    notes: current?.notes ?? '',
    previousFingerprint: fingerprintStructuralIntentTarget('element', target?.id ?? elementId, current),
    state: classifyWorkspaceState({ targetExists: !!target, intent: current }),
    sourceIntent: current
  };
}

export function buildRoofIntentDraft(model, roofGeometryId) {
  const geometry = projectAgnosticGeometry(model).roofGeometry.find((roof) => sameId(roof.id, roofGeometryId));
  const current = roofIntent(model, roofGeometryId);
  const boundaries = geometry ? buildVisualRoofBoundaries(geometry) : [];
  const currentBoundaries = new Map((current?.boundaryIntents || []).map((item) => [item.boundaryId, item.function]));
  return {
    targetExists: !!geometry,
    roofGeometryId: geometry?.id ?? roofGeometryId,
    loadDistribution: current?.loadDistribution ?? 'undetermined',
    primaryResistanceDirection: current?.primaryResistanceDirection ?? null,
    secondaryResistanceDirection: current?.secondaryResistanceDirection ?? null,
    diaphragmBehavior: current?.diaphragmBehavior ?? 'undetermined',
    boundaryIntents: boundaries.map((boundary) => ({
      ...boundary,
      function: currentBoundaries.get(boundary.boundaryId) ?? 'undetermined'
    })),
    notes: current?.notes ?? '',
    previousFingerprint: fingerprintStructuralIntentTarget('roof', geometry?.id ?? roofGeometryId, current),
    state: classifyWorkspaceState({ targetExists: !!geometry, intent: current }),
    sourceIntent: current,
    polygon: geometry?.surface?.boundary || []
  };
}

function elementDraftInput(draft) {
  return {
    participation: draft.participation,
    functions: Array.isArray(draft.functions) ? draft.functions : [],
    secondaryInteraction: draft.secondaryInteraction,
    notes: draft.notes === '' ? null : draft.notes
  };
}

function roofDraftInput(draft) {
  return {
    loadDistribution: draft.loadDistribution,
    primaryResistanceDirection: draft.primaryResistanceDirection,
    secondaryResistanceDirection: draft.secondaryResistanceDirection,
    diaphragmBehavior: draft.diaphragmBehavior,
    boundaryIntents: (draft.boundaryIntents || []).map((item) => ({
      boundaryId: item.boundaryId,
      function: item.function
    })),
    notes: draft.notes === '' ? null : draft.notes
  };
}

export function validateElementDraft(model, elementId, draft) {
  if (!model.elements?.some((element) => sameId(element?.id, elementId))) {
    const issues = [{
      path: 'elementId',
      code: 'SI-ELEMENT-REFERENCE-NOT-FOUND',
      message: `No existe el elemento ${String(elementId)}.`
    }];
    return { ok: false, state: 'brokenReference', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
  const current = elementIntent(model, elementId);
  const actualFingerprint = fingerprintStructuralIntentTarget('element', elementId, current);
  if (typeof draft?.previousFingerprint === 'string'
    && draft.previousFingerprint !== actualFingerprint) {
    const issues = [{
      path: 'elementId',
      code: 'SI-DRAFT-STALE',
      message: 'El elemento cambió mientras el borrador estaba abierto.'
    }];
    return { ok: false, state: 'brokenReference', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
  try {
    const outcome = setElementIntent(model, elementId, elementDraftInput(draft));
    return {
      ok: true,
      state: 'declared',
      issues: [],
      fields: {},
      noOp: outcome.model === model,
      input: elementDraftInput(draft)
    };
  } catch (error) {
    const issues = issueList(error);
    return { ok: false, state: 'invalid', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
}

export function validateRoofDraft(model, roofGeometryId, draft) {
  const geometry = projectAgnosticGeometry(model).roofGeometry.find((roof) => sameId(roof.id, roofGeometryId));
  if (!geometry) {
    const issues = [{
      path: 'roofGeometryId',
      code: 'SI-ROOF-REFERENCE-NOT-FOUND',
      message: `No existe la cubierta ${String(roofGeometryId)}.`
    }];
    return { ok: false, state: 'brokenReference', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
  const current = roofIntent(model, roofGeometryId);
  const actualFingerprint = fingerprintStructuralIntentTarget('roof', roofGeometryId, current);
  if (typeof draft?.previousFingerprint === 'string'
    && draft.previousFingerprint !== actualFingerprint) {
    const issues = [{
      path: 'roofGeometryId',
      code: 'SI-DRAFT-STALE',
      message: 'La cubierta cambió mientras el borrador estaba abierto.'
    }];
    return { ok: false, state: 'brokenReference', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
  try {
    const outcome = setRoofIntent(model, roofGeometryId, roofDraftInput(draft));
    return {
      ok: true,
      state: 'declared',
      issues: [],
      fields: {},
      noOp: outcome.model === model,
      input: roofDraftInput(draft)
    };
  } catch (error) {
    const issues = issueList(error);
    return { ok: false, state: 'invalid', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
}

function groupPrevious(intents) {
  const groups = new Map();
  for (const entry of intents) {
    const key = JSON.stringify(entry.intent);
    if (!groups.has(key)) groups.set(key, { intent: entry.intent, elementIds: [] });
    groups.get(key).elementIds.push(entry.elementId);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    elementIds: group.elementIds.sort(compareStructuralIntentIds)
  }));
}

export function prepareElementIntentBatch(model, elementIds, input) {
  const selection = [...elementIds].sort(compareStructuralIntentIds);
  const previous = selection.map((elementId) => ({
    elementId,
    intent: elementIntent(model, elementId),
    fingerprint: fingerprintStructuralIntentTarget('element', elementId, elementIntent(model, elementId))
  }));
  const preview = {
    selection,
    previousGroups: groupPrevious(previous),
    nextDeclaration: { ...input },
    effectiveChanges: [],
    conflicts: [],
    expectedPrevious: previous.map(({ elementId, fingerprint }) => ({ elementId, fingerprint })),
    canConfirm: false
  };
  try {
    const outcome = setElementIntentsBatch(model, selection, input, {
      expectedPrevious: preview.expectedPrevious
    });
    preview.effectiveChanges = (outcome.changes || []).map((change) => ({
      elementId: change.elementId,
      previousIntent: change.previousIntent,
      nextIntent: change.nextIntent
    }));
    preview.canConfirm = preview.effectiveChanges.length > 0;
  } catch (error) {
    preview.conflicts = issueList(error);
  }
  return preview;
}

export function prepareElementIntentBatchRemoval(model, elementIds) {
  const selection = [...elementIds].sort(compareStructuralIntentIds);
  const previous = selection.map((elementId) => ({
    elementId,
    intent: elementIntent(model, elementId),
    fingerprint: fingerprintStructuralIntentTarget('element', elementId, elementIntent(model, elementId))
  }));
  const preview = {
    selection,
    previousGroups: groupPrevious(previous),
    nextDeclaration: null,
    effectiveChanges: [],
    conflicts: [],
    expectedPrevious: previous.map(({ elementId, fingerprint }) => ({ elementId, fingerprint })),
    canConfirm: false
  };
  try {
    const outcome = removeElementIntentsBatch(model, selection, {
      expectedPrevious: preview.expectedPrevious
    });
    preview.effectiveChanges = (outcome.changes || []).map((change) => ({
      elementId: change.elementId,
      previousIntent: change.previousIntent,
      nextIntent: null
    }));
    preview.canConfirm = preview.effectiveChanges.length > 0;
  } catch (error) {
    preview.conflicts = issueList(error);
  }
  return preview;
}

export function buildStructuralIntentSummary(model, workspace = null) {
  const geometry = workspace?.geometry || projectAgnosticGeometry(model);
  const elementIntents = model.structuralIntent?.elementIntents || [];
  const roofIntents = model.structuralIntent?.roofIntents || [];
  return {
    elementsTotal: geometry.elements.length,
    wallsTotal: geometry.elements.filter((element) => element.type === 'wall').length,
    foundationsTotal: geometry.elements.filter((element) => element.type === 'foundation').length,
    elementsDeclared: elementIntents.length,
    elementsUndefined: geometry.elements.length - elementIntents.length,
    roofsTotal: geometry.roofGeometry.length,
    roofsDeclared: roofIntents.length,
    roofsUndefined: geometry.roofGeometry.length - roofIntents.length,
    undetermined: elementIntents.filter((intent) => intent.participation === 'undetermined').length
      + roofIntents.filter((intent) => intent.loadDistribution === 'undetermined').length,
    pending: Array.isArray(model.structuralIntentFindings) ? model.structuralIntentFindings.length : 0,
    userOperations: model.structuralIntentTrace?.events?.length || 0
  };
}

export function buildPendingIntentItems(model) {
  const findings = (model.structuralIntentFindings || []).map((finding) => ({
    kind: 'finding',
    id: finding.findingId,
    code: finding.code,
    severity: finding.severity,
    message: finding.message || 'Revisión estructural pendiente.'
  }));
  return [
    ...findings,
    {
      kind: 'scope',
      id: 'pending:load-transfer',
      code: 'SI-LOAD-TRANSFER-OUT-OF-SCOPE',
      severity: 'info',
      message: 'La continuidad de transferencia y los caminos de carga permanecen pendientes de una SPEC posterior.'
    }
  ];
}

export function buildStructuralIntentWorkspace(model) {
  const geometry = projectAgnosticGeometry(model);
  const elementRows = geometry.elements.map((element) => {
    const intent = elementIntent(model, element.id);
    return {
      id: element.id,
      idToken: structuralIntentIdToken(element.id),
      type: element.type,
      geometry: geometrySummary(element),
      intent,
      state: classifyWorkspaceState({ intent })
    };
  }).sort((left, right) => compareStructuralIntentIds(left.id, right.id));
  const roofRows = geometry.roofGeometry.map((roof) => {
    const intent = roofIntent(model, roof.id);
    return {
      id: roof.id,
      idToken: structuralIntentIdToken(roof.id),
      source: roof.source,
      polygon: roof.surface.boundary,
      boundaries: buildVisualRoofBoundaries(roof),
      intent,
      state: classifyWorkspaceState({ intent })
    };
  }).sort((left, right) => compareStructuralIntentIds(left.id, right.id));
  const workspace = {
    geometry,
    elementRows,
    roofRows,
    pending: buildPendingIntentItems(model),
    traceEvents: model.structuralIntentTrace?.events || [],
    inactiveViews: {
      intersections: 'Edición no disponible en este corte.',
      diaphragms: 'Edición no disponible en este corte.'
    },
    vocabularies: {
      participations: ELEMENT_PARTICIPATIONS,
      functions: ELEMENT_FUNCTIONS,
      secondaryInteractions: SECONDARY_INTERACTIONS,
      roofLoadDistributions: ROOF_LOAD_DISTRIBUTIONS,
      roofDiaphragmBehaviors: ROOF_DIAPHRAGM_BEHAVIORS,
      roofBoundaryFunctions: ROOF_BOUNDARY_FUNCTIONS
    }
  };
  workspace.summary = buildStructuralIntentSummary(model, workspace);
  return workspace;
}
