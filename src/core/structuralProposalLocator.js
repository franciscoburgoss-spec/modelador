import { cloneJson, isRecord } from './structuralProposalCommon.js';

export const EMPTY_STRUCTURAL_PROPOSAL_LOCATOR = Object.freeze({
  active: false,
  kind: null,
  id: null,
  requested: null,
  hovered: null,
  snapshot: null,
  sourceFocusId: null
});

function empty() {
  return { ...EMPTY_STRUCTURAL_PROPOSAL_LOCATOR };
}

export function openStructuralProposalLocatorState(state, { entity, preview, sourceFocusId = null }) {
  if (!isRecord(state) || !entity || !preview) return state;
  return {
    ...state,
    structuralProposalLocator: {
      active: true,
      kind: entity.kind,
      id: entity.id,
      requested: { kind: entity.kind, id: entity.id },
      hovered: null,
      preview: cloneJson(preview),
      snapshot: {
        layout: state.layout,
        view: cloneJson(state.view),
        viewB: cloneJson(state.viewB),
        viewMode: state.model?.viewMode ?? 'plan',
        viewModeB: state.viewModeB,
        currentZLevelId: state.model?.currentZLevelId ?? null,
        selectedElementId: state.model?.selectedElementId ?? null,
        selectedRoofSystemId: state.model?.selectedRoofSystemId ?? null,
        selectedRoofPlaneId: state.model?.selectedRoofPlaneId ?? null,
        historyLength: state.past?.length ?? 0,
        futureLength: state.future?.length ?? 0,
        structuralIntent: cloneJson(state.model?.structuralIntent),
        structuralIntentTrace: cloneJson(state.model?.structuralIntentTrace),
        structuralProposalReviews: cloneJson(state.model?.structuralProposalReviews)
      },
      sourceFocusId
    }
  };
}

export function requestStructuralProposalLocationState(state, entity) {
  const locator = state.structuralProposalLocator;
  if (!locator?.active || !entity) return state;
  return {
    ...state,
    structuralProposalLocator: {
      ...locator,
      kind: entity.kind,
      id: entity.id,
      requested: { kind: entity.kind, id: entity.id }
    }
  };
}

export function hoverStructuralProposalLocationState(state, entity = null) {
  const locator = state.structuralProposalLocator;
  if (!locator?.active) return state;
  return {
    ...state,
    structuralProposalLocator: {
      ...locator,
      hovered: entity ? { kind: entity.kind, id: entity.id } : null
    }
  };
}

export function consumeStructuralProposalLocationState(state) {
  const locator = state.structuralProposalLocator;
  if (!locator?.active || !locator.requested) return state;
  return {
    ...state,
    structuralProposalLocator: { ...locator, requested: null }
  };
}

function previewBounds(preview) {
  const bounds = preview?.bounds;
  if (!bounds) return null;
  const xMin = bounds.xMin ?? bounds.minX;
  const xMax = bounds.xMax ?? bounds.maxX;
  const yMin = bounds.yMin ?? bounds.minY;
  const yMax = bounds.yMax ?? bounds.maxY;
  return [xMin, xMax, yMin, yMax].every(Number.isFinite)
    ? { xMin, xMax, yMin, yMax }
    : null;
}

function fitPlanBounds(bounds, canvasW, canvasH) {
  const spanX = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanY = Math.max(bounds.yMax - bounds.yMin, 1);
  const marginX = Math.max(spanX * 0.25, 300);
  const marginY = Math.max(spanY * 0.25, 300);
  const totalX = spanX + marginX * 2;
  const totalY = spanY + marginY * 2;
  const scale = Math.min(canvasW / totalX, canvasH / totalY);
  const slackX = canvasW / scale - totalX;
  const slackY = canvasH / scale - totalY;
  return {
    scale,
    offsetX: bounds.xMin - marginX - slackX / 2,
    offsetY: bounds.yMin - marginY - slackY / 2
  };
}

export function fitStructuralProposalLocatorState(state, canvasW = 800, canvasH = 600) {
  const locator = state.structuralProposalLocator;
  const bounds = previewBounds(locator?.preview);
  if (!locator?.active || !bounds) return state;
  return {
    ...state,
    model: { ...state.model, viewMode: 'plan' },
    view: { ...state.view, ...fitPlanBounds(bounds, canvasW, canvasH) }
  };
}

export function closeStructuralProposalLocatorState(state, { restoreView = true } = {}) {
  const locator = state.structuralProposalLocator;
  if (!locator?.active) return state;
  const snapshot = locator.snapshot;
  if (!snapshot) return { ...state, structuralProposalLocator: empty() };
  const selection = {
    selectedElementId: snapshot.selectedElementId,
    selectedRoofSystemId: snapshot.selectedRoofSystemId,
    selectedRoofPlaneId: snapshot.selectedRoofPlaneId
  };
  if (!restoreView) {
    return {
      ...state,
      model: { ...state.model, ...selection },
      structuralProposalLocator: empty()
    };
  }
  return {
    ...state,
    layout: snapshot.layout,
    view: cloneJson(snapshot.view),
    viewB: cloneJson(snapshot.viewB),
    viewModeB: snapshot.viewModeB,
    model: {
      ...state.model,
      ...selection,
      viewMode: snapshot.viewMode,
      currentZLevelId: snapshot.currentZLevelId
    },
    structuralProposalLocator: empty()
  };
}
