export const EMPTY_STRUCTURAL_INTENT_LOCATOR = Object.freeze({
  active: false,
  targetIds: [],
  activeId: null,
  hoveredId: null,
  requestedId: null,
  preview: null,
  sourceFocusId: null,
  snapshot: null
});

function sameId(left, right) {
  return `${typeof left}:${String(left)}` === `${typeof right}:${String(right)}`;
}

function cloneEmptyLocator() {
  return {
    active: false, targetIds: [], activeId: null, hoveredId: null,
    requestedId: null, preview: null, sourceFocusId: null, snapshot: null
  };
}

function fitPlanBounds(bounds, canvasW, canvasH) {
  const spanH = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanV = Math.max(bounds.yMax - bounds.yMin, 1);
  const marginH = Math.max(spanH * 0.25, 300);
  const marginV = Math.max(spanV * 0.25, 300);
  const totalH = spanH + marginH * 2;
  const totalV = spanV + marginV * 2;
  const scale = Math.min(canvasW / totalH, canvasH / totalV);
  const slackH = canvasW / scale - totalH;
  const slackV = canvasH / scale - totalV;
  return {
    scale,
    offsetX: bounds.xMin - marginH - slackH / 2,
    offsetY: bounds.yMin - marginV - slackV / 2
  };
}

export function openStructuralIntentLocatorState(state, { preview, activeId = null, sourceFocusId = null } = {}) {
  if (!preview?.canUse || !Array.isArray(preview.selected) || preview.selected.length === 0) return state;
  const targetIds = preview.selected.map((target) => target.id);
  const resolvedActiveId = activeId ?? preview.activeId ?? targetIds[0];
  const snapshot = state.structuralIntentLocator?.active && state.structuralIntentLocator.snapshot
    ? state.structuralIntentLocator.snapshot
    : {
        layout: state.layout,
        view: { ...state.view },
        viewB: { ...state.viewB },
        viewMode: state.model.viewMode,
        viewModeB: state.viewModeB,
        currentZLevelId: state.model.currentZLevelId,
        selectedElementId: state.model.selectedElementId,
        selectedRoofSystemId: state.model.selectedRoofSystemId,
        selectedRoofPlaneId: state.model.selectedRoofPlaneId
      };
  return {
    ...state,
    structuralIntentLocator: {
      active: true,
      targetIds,
      activeId: resolvedActiveId,
      hoveredId: null,
      requestedId: null,
      preview,
      sourceFocusId,
      snapshot
    }
  };
}

export function setStructuralIntentLocatorActiveState(state, id) {
  const locator = state.structuralIntentLocator;
  if (!locator?.active || !locator.targetIds.some((targetId) => sameId(targetId, id))) return state;
  return { ...state, structuralIntentLocator: { ...locator, activeId: id, requestedId: null } };
}

export function setStructuralIntentLocatorHoverState(state, id) {
  const locator = state.structuralIntentLocator;
  if (!locator?.active) return state;
  return { ...state, structuralIntentLocator: { ...locator, hoveredId: id ?? null } };
}

export function requestStructuralIntentLocatorTargetState(state, id) {
  const locator = state.structuralIntentLocator;
  if (!locator?.active || !locator.targetIds.some((targetId) => sameId(targetId, id))) return state;
  return { ...state, structuralIntentLocator: { ...locator, requestedId: id } };
}

export function clearStructuralIntentLocatorRequestState(state) {
  const locator = state.structuralIntentLocator;
  if (!locator || locator.requestedId == null) return state;
  return { ...state, structuralIntentLocator: { ...locator, requestedId: null } };
}

export function fitStructuralIntentLocatorState(state, canvasW = 800, canvasH = 600) {
  const locator = state.structuralIntentLocator;
  const bounds = locator?.preview?.visibleBounds || locator?.preview?.targetBounds;
  if (!locator?.active || !bounds) return state;
  return {
    ...state,
    model: { ...state.model, viewMode: 'plan' },
    view: { ...state.view, ...fitPlanBounds(bounds, canvasW, canvasH) }
  };
}

export function closeStructuralIntentLocatorState(state, { restoreView = true } = {}) {
  const locator = state.structuralIntentLocator;
  if (!locator?.active) return state;
  const snapshot = locator.snapshot;
  if (!snapshot) return { ...state, structuralIntentLocator: cloneEmptyLocator() };
  const selection = {
    selectedElementId: snapshot.selectedElementId,
    selectedRoofSystemId: snapshot.selectedRoofSystemId,
    selectedRoofPlaneId: snapshot.selectedRoofPlaneId
  };
  if (!restoreView) {
    return {
      ...state,
      model: { ...state.model, ...selection },
      structuralIntentLocator: cloneEmptyLocator()
    };
  }
  return {
    ...state,
    layout: snapshot.layout,
    view: { ...snapshot.view },
    viewB: { ...snapshot.viewB },
    viewModeB: snapshot.viewModeB,
    model: {
      ...state.model,
      ...selection,
      viewMode: snapshot.viewMode,
      currentZLevelId: snapshot.currentZLevelId
    },
    structuralIntentLocator: cloneEmptyLocator()
  };
}
