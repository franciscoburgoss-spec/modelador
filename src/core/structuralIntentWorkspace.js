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
import {
  buildStructuralIntentVisualPresentation,
  buildStructuralIntentVisualPreview,
  compareVisualFingerprintSnapshot,
  visualFingerprintSnapshot
} from './structuralIntentVisualPresentation.js';

export const STRUCTURAL_INTENT_WORKSPACE_TABS = Object.freeze([
  'summary',
  'elements',
  'roof',
  'interfaces',
  'intersections',
  'diaphragms',
  'pending',
  'trace'
]);

export const STRUCTURAL_INTENT_WORKSPACE_STATES = Object.freeze([
  'declared',
  'undefined',
  'invalid',
  'brokenReference',
  'stale'
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

const ROOF_CONTEXT_AXIS_TOLERANCE = 0.1;

function roofPlanPolygon(roofGeometry) {
  const polygon = [...(roofGeometry?.surface?.boundary || [])].map((point) => ({
    x: Number(point.x),
    y: Number(point.y),
    z: Number(point.z)
  }));
  if (polygon.length > 1 && planPointKey(polygon[0]) === planPointKey(polygon.at(-1))) polygon.pop();
  return polygon;
}

function roofPlanBounds(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  return {
    xMin: Math.min(...polygon.map((point) => point.x)),
    xMax: Math.max(...polygon.map((point) => point.x)),
    yMin: Math.min(...polygon.map((point) => point.y)),
    yMax: Math.max(...polygon.map((point) => point.y))
  };
}

function normalizedPlanAxes(entries = []) {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label == null || entry.label === '' ? String(entry.id) : String(entry.label),
    coordinate: Number(entry.position)
  })).filter((entry) => Number.isFinite(entry.coordinate))
    .sort((left, right) => left.coordinate - right.coordinate || compareStructuralIntentIds(left.id, right.id));
}

function axesUsedByPolygon(entries, values) {
  return entries.filter((entry) => values.some((value) => Math.abs(entry.coordinate - value) <= ROOF_CONTEXT_AXIS_TOLERANCE));
}

function uniqueCoordinates(points, key) {
  const values = [];
  for (const point of points) {
    const value = Number(point[key]);
    if (!Number.isFinite(value)) continue;
    if (!values.some((current) => Math.abs(current - value) <= ROOF_CONTEXT_AXIS_TOLERANCE)) values.push(value);
  }
  return values.sort((left, right) => left - right);
}

function roofAxisPhrase(label, axes) {
  return `${label}: ${axes.length > 0 ? axes.map((axis) => axis.label).join(' · ') : 'sin coincidencia nominal'}`;
}

export function buildRoofPlanContext(model, roofGeometry) {
  const polygon = roofPlanPolygon(roofGeometry);
  const bounds = roofPlanBounds(polygon);
  const xAxes = axesUsedByPolygon(normalizedPlanAxes(model.grid?.xAxes), uniqueCoordinates(polygon, 'x'));
  const yAxes = axesUsedByPolygon(normalizedPlanAxes(model.grid?.yAxes), uniqueCoordinates(polygon, 'y'));
  const boundaries = buildVisualRoofBoundaries(roofGeometry);
  const primary = `${roofAxisPhrase('Ejes X', xAxes)} · ${roofAxisPhrase('Ejes Y', yAxes)}`;
  const summary = `Cubierta · ${primary} · ${boundaries.length} bordes`;
  const target = {
    id: roofGeometry.id,
    idToken: structuralIntentIdToken(roofGeometry.id),
    type: 'roof',
    targetType: 'roof',
    mark: 'R',
    descriptor: {
      typeLabel: 'Cubierta',
      primary,
      summary,
      technicalReference: `ID ${String(roofGeometry.id)}`
    },
    planGeometry: { kind: 'roof-polygon', polygon: polygon.map(({ x, y }) => ({ x, y })) },
    openings: [],
    bounds
  };
  return {
    polygon,
    bounds,
    axes: { x: xAxes, y: yAxes },
    boundaries,
    descriptor: target.descriptor,
    visualPreview: {
      canUse: polygon.length >= 3 && bounds !== null,
      selected: [target],
      context: [],
      activeId: roofGeometry.id,
      targetBounds: bounds,
      visibleBounds: bounds
    }
  };
}

export function buildElementIntentDraft(model, elementId) {
  const target = model.elements?.find((element) => sameId(element?.id, elementId));
  const current = elementIntent(model, elementId);
  const visualPresentation = buildStructuralIntentVisualPresentation(model);
  const visualTarget = [...visualPresentation.targets, ...visualPresentation.orphans]
    .find((item) => sameId(item.id, target?.id ?? elementId));
  const previousIntentFingerprint = fingerprintStructuralIntentTarget('element', target?.id ?? elementId, current);
  const previousGeometryFingerprint = visualTarget?.geometryFingerprint ?? null;
  return {
    targetExists: !!target,
    elementId: target?.id ?? elementId,
    participation: current?.participation ?? '',
    functions: current ? [...current.functions] : [],
    secondaryInteraction: current?.secondaryInteraction ?? 'notApplicable',
    notes: current?.notes ?? '',
    previousFingerprint: previousIntentFingerprint,
    previousIntentFingerprint,
    previousGeometryFingerprint,
    visualSnapshot: visualFingerprintSnapshot(visualPresentation, [target?.id ?? elementId]),
    visualPreview: buildStructuralIntentVisualPreview(visualPresentation, [target?.id ?? elementId]),
    lastVisualDescriptor: visualTarget?.descriptor ?? null,
    visualTarget: visualTarget ?? null,
    state: classifyWorkspaceState({ targetExists: !!target, intent: current }),
    sourceIntent: current
  };
}

export function buildRoofIntentDraft(model, roofGeometryId) {
  const geometry = projectAgnosticGeometry(model).roofGeometry.find((roof) => sameId(roof.id, roofGeometryId));
  const current = roofIntent(model, roofGeometryId);
  const planContext = geometry ? buildRoofPlanContext(model, geometry) : null;
  const boundaries = planContext?.boundaries || [];
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
    polygon: planContext?.polygon || [],
    planContext,
    visualPreview: planContext?.visualPreview || null
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
  const expectedIntentFingerprint = draft?.previousIntentFingerprint ?? draft?.previousFingerprint;
  if (typeof expectedIntentFingerprint === 'string'
    && expectedIntentFingerprint !== actualFingerprint) {
    const issues = [{
      path: 'elementId',
      code: 'SI-DRAFT-STALE',
      message: 'La declaración cambió mientras el borrador estaba abierto.'
    }];
    return { ok: false, state: 'brokenReference', issues, fields: mapStructuralIntentIssuesToFields(issues) };
  }
  if (Array.isArray(draft?.visualSnapshot)) {
    const visualPresentation = buildStructuralIntentVisualPresentation(model);
    const visualReview = compareVisualFingerprintSnapshot(visualPresentation, draft.visualSnapshot);
    if (!visualReview.ok) {
      const broken = visualReview.conflicts.some((conflict) => conflict.code === 'SI-VISUAL-TARGET-NOT-FOUND');
      const issues = visualReview.conflicts.map((conflict) => ({
        path: 'elementId', code: conflict.code, message: conflict.message
      }));
      return {
        ok: false,
        state: broken ? 'brokenReference' : 'stale',
        issues,
        fields: mapStructuralIntentIssuesToFields(issues),
        visualReview
      };
    }
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
  const visualPresentation = buildStructuralIntentVisualPresentation(model);
  const visualPreview = buildStructuralIntentVisualPreview(visualPresentation, selection);
  const geometrySnapshot = visualFingerprintSnapshot(visualPresentation, selection);
  const previous = selection.map((elementId) => ({
    elementId,
    intent: elementIntent(model, elementId),
    fingerprint: fingerprintStructuralIntentTarget('element', elementId, elementIntent(model, elementId)),
    geometryFingerprint: geometrySnapshot.find((item) => sameId(item.elementId, elementId))?.geometryFingerprint ?? null
  }));
  const preview = {
    selection,
    previousGroups: groupPrevious(previous),
    nextDeclaration: { ...input },
    effectiveChanges: [],
    conflicts: [],
    expectedPrevious: previous.map(({ elementId, fingerprint }) => ({ elementId, fingerprint })),
    expectedGeometry: geometrySnapshot,
    visualPreview,
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
    preview.canConfirm = preview.effectiveChanges.length > 0 && visualPreview.canUse;
  } catch (error) {
    preview.conflicts = issueList(error);
  }
  return preview;
}

export function prepareElementIntentBatchRemoval(model, elementIds) {
  const selection = [...elementIds].sort(compareStructuralIntentIds);
  const visualPresentation = buildStructuralIntentVisualPresentation(model);
  const visualPreview = buildStructuralIntentVisualPreview(visualPresentation, selection);
  const geometrySnapshot = visualFingerprintSnapshot(visualPresentation, selection);
  const previous = selection.map((elementId) => ({
    elementId,
    intent: elementIntent(model, elementId),
    fingerprint: fingerprintStructuralIntentTarget('element', elementId, elementIntent(model, elementId)),
    geometryFingerprint: geometrySnapshot.find((item) => sameId(item.elementId, elementId))?.geometryFingerprint ?? null
  }));
  const preview = {
    selection,
    previousGroups: groupPrevious(previous),
    nextDeclaration: null,
    effectiveChanges: [],
    conflicts: [],
    expectedPrevious: previous.map(({ elementId, fingerprint }) => ({ elementId, fingerprint })),
    expectedGeometry: geometrySnapshot,
    visualPreview,
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
    preview.canConfirm = preview.effectiveChanges.length > 0 && visualPreview.canUse;
  } catch (error) {
    preview.conflicts = issueList(error);
  }
  return preview;
}

export function validatePreparedElementIntentBatch(model, preview) {
  const visualPresentation = buildStructuralIntentVisualPresentation(model);
  const visualReview = compareVisualFingerprintSnapshot(visualPresentation, preview?.expectedGeometry || []);
  if (!visualReview.ok) {
    return {
      ok: false,
      state: visualReview.conflicts.some((conflict) => conflict.code === 'SI-VISUAL-TARGET-NOT-FOUND')
        ? 'brokenReference'
        : 'stale',
      conflicts: visualReview.conflicts,
      visualReview
    };
  }
  const intentConflicts = (preview?.expectedPrevious || []).filter(({ elementId, fingerprint }) => (
    fingerprintStructuralIntentTarget('element', elementId, elementIntent(model, elementId)) !== fingerprint
  )).map(({ elementId }) => ({
    elementId,
    code: 'SI-DRAFT-STALE',
    message: `La declaración del elemento ${String(elementId)} cambió desde la preview.`
  }));
  return {
    ok: intentConflicts.length === 0,
    state: intentConflicts.length === 0 ? 'declared' : 'stale',
    conflicts: intentConflicts,
    visualReview
  };
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
  const visualPresentation = buildStructuralIntentVisualPresentation(model);
  const visualByToken = new Map([...visualPresentation.targets, ...visualPresentation.orphans]
    .map((target) => [target.idToken, target]));
  const elementRows = geometry.elements.map((element) => {
    const intent = elementIntent(model, element.id);
    const visual = visualByToken.get(structuralIntentIdToken(element.id));
    return {
      id: element.id,
      idToken: structuralIntentIdToken(element.id),
      type: element.type,
      geometry: geometrySummary(element),
      descriptor: visual?.descriptor ?? null,
      planGeometry: visual?.planGeometry ?? null,
      elevationGeometry: visual?.elevationGeometry ?? null,
      openings: visual?.openings ?? [],
      bounds: visual?.bounds ?? null,
      geometryFingerprint: visual?.geometryFingerprint ?? null,
      visualState: visual?.state ?? 'invalidGeometry',
      intent,
      state: classifyWorkspaceState({ intent, issues: visual?.state === 'invalidGeometry' ? [visual.error] : [] })
    };
  }).concat(visualPresentation.orphans.map((visual) => ({
    id: visual.id,
    idToken: visual.idToken,
    type: visual.type,
    geometry: { kind: 'brokenReference' },
    descriptor: visual.descriptor,
    planGeometry: null,
    elevationGeometry: null,
    openings: [],
    bounds: null,
    geometryFingerprint: visual.geometryFingerprint,
    visualState: visual.state,
    intent: visual.intent,
    state: 'brokenReference'
  }))).sort((left, right) => compareStructuralIntentIds(left.id, right.id));
  const roofRows = geometry.roofGeometry.map((roof) => {
    const intent = roofIntent(model, roof.id);
    const planContext = buildRoofPlanContext(model, roof);
    return {
      id: roof.id,
      idToken: structuralIntentIdToken(roof.id),
      source: roof.source,
      polygon: planContext.polygon,
      boundaries: planContext.boundaries,
      planContext,
      descriptor: planContext.descriptor,
      visualPreview: planContext.visualPreview,
      intent,
      state: classifyWorkspaceState({ intent })
    };
  }).sort((left, right) => compareStructuralIntentIds(left.id, right.id));
  const workspace = {
    geometry,
    visualPresentation,
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
