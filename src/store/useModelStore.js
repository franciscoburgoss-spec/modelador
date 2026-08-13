// store/useModelStore.js
import { create } from 'zustand';
import { buildParamsMap } from '../core/projectParams.js';
import { buildElementsById } from '../core/elementReferences.js';
import { getLibraryFields } from '../core/libraryFields.js';
import { hasOwn } from '../core/hasOwn.js';
import { METALCON_PROFILES } from '../core/metalconCatalog.js';
import { mergeSeedTemplates } from '../core/trussTemplates.js';
import { toProjectionMode } from '../core/viewMode.js';
import { resolveElementWorldBounds } from '../core/elementBounds.js';
import { resolveElevationAxisForElement } from '../core/elevation.js';
import { migrateFoundations, migrateFoundationSections } from '../core/foundationGeometry.js';
import { planWallSplit, planWallMerge, CUT_AXIS_PLACEHOLDER } from '../core/wallSplitMerge.js';
import { createProjectInfo, normalizeProjectInfo, nextRevisionLetter } from '../core/projectInfo.js';
import {
  CURRENT_MODEL_VERSION, ModelImportError, prepareModelImport, prepareModelJsonImport
} from '../core/modelSchema.js';
import {
  createProjectDocument,
  hydrateProjectDocumentRecents,
  markProjectDocumentDirty,
  openProjectDocument,
  resetProjectDocument,
  saveProjectDocument
} from '../core/projectDocument.js';
import {
  NativeProjectError,
  openNativeProject,
  saveNativeProject
} from '../core/nativeProjectFile.js';
import { LEGACY_PROJECT_STORAGE_KEY } from '../core/legacyProjectMigration.js';
import { assertValidWallTypes, getWallType } from '../core/wallTypes.js';
import {
  applyStructuralInterfaceTransaction as applyStructuralInterfaceTransactionInModel,
  checkStructuralIntentBeforeMerge,
  clearStructuralIntent as clearStructuralIntentInModel,
  createEmptyStructuralIntent,
  reconcileStructuralIntentAfterGeometryChange,
  reconcileStructuralIntentAfterSplit,
  removeElementAndStructuralReferences,
  removeElementIntent as removeElementIntentInModel,
  removeElementIntentsBatch as removeElementIntentsBatchInModel,
  removeRoofIntent as removeRoofIntentInModel,
  removeStructuralInterfaceIntent as removeStructuralInterfaceIntentInModel,
  removeStructuralRelationIntent as removeStructuralRelationIntentInModel,
  setElementIntent as setElementIntentInModel,
  setElementIntentsBatch as setElementIntentsBatchInModel,
  setRoofIntent as setRoofIntentInModel
} from '../core/structuralIntent.js';
import {
  invalidateForMutation,
  applyWallRegeneration,
  applyWallRegenerationPatch,
  patchInvalidatesWall,
  patchInvalidatesWallTopology,
  assertNoDerivedWrites,
  DERIVED_WRITE_FIELDS
} from '../core/derivedInvalidation.js';
import {
  downloadAgnosticGeometry,
  downloadAgnosticGeometryAudit
} from '../core/agnosticGeometry.js';
import {
  EMPTY_STRUCTURAL_INTENT_LOCATOR,
  clearStructuralIntentLocatorRequestState,
  closeStructuralIntentLocatorState,
  fitStructuralIntentLocatorState,
  openStructuralIntentLocatorState,
  requestStructuralIntentLocatorTargetState,
  setStructuralIntentLocatorActiveState,
  setStructuralIntentLocatorHoverState
} from '../core/structuralIntentLocator.js';
import {
  applyStructuralProposalDecision,
  applyStructuralProposalDecisionBatch
} from '../core/applyStructuralProposalDecision.js';
import {
  createEmptyStructuralProposalReviewLog
} from '../core/structuralProposalReviews.js';
import { createEmptyConstructiveSolutions } from '../core/constructiveSolutionScenarios.js';
import {
  EMPTY_STRUCTURAL_PROPOSAL_LOCATOR,
  closeStructuralProposalLocatorState,
  consumeStructuralProposalLocationState,
  fitStructuralProposalLocatorState,
  hoverStructuralProposalLocationState,
  openStructuralProposalLocatorState,
  requestStructuralProposalLocationState
} from '../core/structuralProposalLocator.js';

// Sólo un cambio de posición/elevación reubica geometría; renombrar un eje no invalida nada.
function maybeGlobalInvalidate(model, patch, field) {
  return patch && hasOwn(patch, field)
    ? invalidateForMutation(model, 'gridGeometry')
    : model;
}

// Normalización posterior a la validación/migración pura de core/modelSchema.js.
// Los defaults completan claves opcionales, pero nunca sustituyen ni descartan datos importados.
function mergeLoadedModel(data) {
  const merged = {
    modelVersion: CURRENT_MODEL_VERSION,
    projectParams: [],
    dimensions: [],
    roofSystems: [],
    roofPlanes: [],
    wallTypes: [],
    osbDefaults: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap: 5 },
    // ★ default de proyecto para modulación metalcon (sesión 20b — habilita "Generar todos"
    // combinado desde el menú sin abrir el modal). null hasta que el usuario guarde uno.
    metalconDefaults: null,
    ...data,
    structuralIntent: data.structuralIntent ?? createEmptyStructuralIntent(),
    structuralIntentFindings: Array.isArray(data.structuralIntentFindings)
      ? data.structuralIntentFindings
      : [],
    structuralProposalReviews: data.structuralProposalReviews
      ?? createEmptyStructuralProposalReviewLog(),
    constructiveSolutions: data.constructiveSolutions ?? createEmptyConstructiveSolutions(),
    roofSystems: Array.isArray(data.roofSystems) ? data.roofSystems : [],
    roofPlanes: Array.isArray(data.roofPlanes) ? data.roofPlanes : [],
    // ★ Sesión 22: datos de proyecto del cajetín — normalizados para que un modelo guardado
    // antes de la sesión no llegue sin `revisiones` y reviente al listarlas.
    projectInfo: normalizeProjectInfo(data.projectInfo),
    // ★ Sesión 11: modelos antiguos traen cimiento y sobrecimiento como elementos separados.
    elements: migrateFoundations(data.elements || []),
    library: (() => {
      const lib = { ...getDefaultLibrary(), ...(data.library || {}) };
      return { ...lib, foundationSections: migrateFoundationSections(lib.foundationSections) };
    })()
  };
  return merged;
}

function normalizeImportError(error) {
  if (error instanceof ModelImportError) return error;
  return new ModelImportError(
    'MODEL_IMPORT_FAILED',
    error instanceof Error ? error.message : 'No se pudo importar el modelo.'
  );
}

function importErrorResult(set, error) {
  const typedError = normalizeImportError(error);
  set({
    modelImportFeedback: {
      severity: 'error',
      code: typedError.code,
      message: typedError.message,
      details: typedError.details
    }
  });
  return { ok: false, error: typedError };
}

function projectOperationErrorResult(set, error) {
  const typedError = error instanceof Error && typeof error.code === 'string'
    ? error
    : new NativeProjectError(
        'PROJECT_OPERATION_FAILED',
        error instanceof Error
          ? error.message
          : 'No se pudo completar la operación del proyecto.',
        error
      );
  set({
    modelImportFeedback: {
      severity: 'error',
      code: typedError.code || 'PROJECT_OPERATION_FAILED',
      message: typedError.message,
      details: typedError.details || []
    }
  });
  return { ok: false, error: typedError };
}

function importFeedback(prepared) {
  return prepared.warnings.length > 0
    ? {
        severity: 'warning',
        code: prepared.warnings[0].code,
        message: prepared.warnings.map((warning) => warning.message).join(' '),
        details: prepared.warnings
      }
    : null;
}

function commitPreparedImport(set, prepared) {
  set((state) => ({
    ...withHistory(state, mergeLoadedModel(prepared.model)),
    modelImportFeedback: importFeedback(prepared)
  }));
  return {
    ok: true,
    warnings: prepared.warnings,
    appliedMigrations: prepared.appliedMigrations
  };
}

const HISTORY_LIMIT = 50;

// ★ Familias con sustitución global: al editar una sección de librería, propaga sus campos
// de dimensión a toda instancia que la use (element.libraryId === id, u opening.libraryId
// para openingTemplates, anidado dentro de wall.openings).
function cascadeLibrarySubstitution(elements, key, libraryId, item) {
  const fields = getLibraryFields(key, item?.itemType);
  if (fields.length === 0) return elements;
  const applyFields = (target) => {
    const patch = {};
    for (const f of fields) patch[f] = item[f];
    return { ...target, ...patch };
  };

  const typeByKey = { wallSections: 'wall', columnSections: 'column', beamSections: 'beam', foundationSections: 'foundation' };
  if (key === 'openingTemplates') {
    return elements.map(el => (el.type === 'wall' && el.openings?.some(o => o.libraryId === libraryId))
      ? { ...el, openings: el.openings.map(o => o.libraryId === libraryId ? applyFields(o) : o) }
      : el);
  }
  if (key === 'foundationSections') {
    // Las dimensiones viven en capas (cimiento/sobrecimiento/aislada), no en la raíz.
    const slot = { cimiento: 'cimiento', sobrecimiento: 'sobrecimiento', aislada: 'aislada' }[item?.itemType];
    if (!slot) return elements;
    return elements.map(el => {
      if (el.type !== 'foundation') return el;
      const layer = el[slot];
      const usesIt = slot === 'sobrecimiento' ? layer?.libraryId === libraryId : el.libraryId === libraryId;
      if (!layer || !usesIt) return el;
      return { ...el, [slot]: applyFields(layer) };
    });
  }

  const elType = typeByKey[key];
  if (!elType) return elements;
  return elements.map(el => (el.type === elType && el.libraryId === libraryId) ? applyFields(el) : el);
}

function getDefaultLibrary() {
  return { wallSections: [], columnSections: [], beamSections: [], openingTemplates: [], foundationSections: [], metalconProfiles: [], materials: [], trussTemplates: [] };
}

function emptyModel() {
  return {
    modelVersion: CURRENT_MODEL_VERSION,
    grid: { xAxes: [], yAxes: [], zLevels: [] },
    elements: [],
    library: getDefaultLibrary(),
    projectParams: [],
    dimensions: [],
    wallTypes: [],
    structuralIntent: createEmptyStructuralIntent(),
    structuralIntentFindings: [],
    structuralProposalReviews: createEmptyStructuralProposalReviewLog(),
    constructiveSolutions: createEmptyConstructiveSolutions(),
    // ★ default de proyecto para modulación OSB (core/osbModulation.js). minPanelWidth tiene
    // piso duro de 200mm (ver setOsbDefaults) — por debajo no hay dónde atornillar borde+interior.
    osbDefaults: { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200, gap: 5 },
    metalconDefaults: null,
    // ★ datos de proyecto del cajetín ISO 7200 de las láminas DXF (sesión 22)
    projectInfo: createProjectInfo(),
    // ★ sistemas de techumbre (cerchas entre dos frontones — core/trussLayout.js). Array aparte
    // de elements a propósito: no se dibujan en la planta todavía (integración visual pendiente).
    roofSystems: [],
    // ★ B4.7: faldones de techumbre (roofPlanes — core/roofPlane.js). Reemplazan a roofSystems.
    // Cada faldón es un polígono de esquinas de eje con canaleta, cielo de apoyo y perfiles; el
    // solver deriva tramos, cadena global de cerchas y costaneras continuas.
    roofPlanes: [],
    currentZLevelId: null,
    selectedElementId: null,
    // Selección de sistemas de techumbre: campo PARALELO a selectedElementId (los roofSystems
    // no viven en model.elements y comparten el generador de ids → mezclarlos sería ambiguo).
    // Invariante: a lo más uno de los dos es != null.
    selectedRoofSystemId: null,
    selectedRoofPlaneId: null,
    viewMode: 'plan'
  };
}

let _idCounter = 1;
function generateId() {
  return Date.now() + (_idCounter++);
}

function cloneWallType(wallType) {
  return {
    ...wallType,
    metalconDefaults: wallType?.metalconDefaults
      && typeof wallType.metalconDefaults === 'object'
      && !Array.isArray(wallType.metalconDefaults)
      ? { ...wallType.metalconDefaults }
      : wallType?.metalconDefaults,
    osbDefaults: wallType?.osbDefaults
      && typeof wallType.osbDefaults === 'object'
      && !Array.isArray(wallType.osbDefaults)
      ? { ...wallType.osbDefaults }
      : wallType?.osbDefaults
  };
}

function mergeWallTypePatch(wallType, patch) {
  const next = { ...wallType, ...patch };
  for (const field of ['metalconDefaults', 'osbDefaults']) {
    if (!hasOwn(patch, field)) {
      next[field] = { ...wallType[field] };
    } else if (
      patch[field] !== null
      && typeof patch[field] === 'object'
      && !Array.isArray(patch[field])
    ) {
      next[field] = { ...wallType[field], ...patch[field] };
    }
  }
  return cloneWallType(next);
}

function wallTypeChangeInvalidates(before, after) {
  return ['role', 'metalconDefaults', 'osbDefaults'].some((field) => (
    JSON.stringify(before[field]) !== JSON.stringify(after[field])
  ));
}

function getCanvasSizeFallback() {
  const canvas = typeof document !== 'undefined' ? document.getElementById('canvas') : null;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width || 800, height: rect.height || 600 };
  }
  return { width: 800, height: 600 };
}

function computeZoomedView(view, factor, canvasW, canvasH) {
  const size = (canvasW && canvasH) ? { width: canvasW, height: canvasH } : getCanvasSizeFallback();
  const cx = size.width / 2;
  const cy = size.height / 2;
  const newScale = view.scale * factor;
  const worldCx = view.offsetX + cx / view.scale;
  const worldCy = view.offsetY + cy / view.scale;
  return {
    ...view,
    scale: newScale,
    offsetX: worldCx - cx / newScale,
    offsetY: worldCy - cy / newScale
  };
}

// Proyecta un bounds mundial {xMin,xMax,yMin,yMax,zMin,zMax} a extents (h,v) según el modo de
// un panel — mismo criterio de ejes que usa computeFitView (plan: x/y; elevación: eje libre/Z).
function boundsToHV(bounds, modeStr) {
  const mode = toProjectionMode(modeStr);
  if (mode === 'plan') return { hMin: bounds.xMin, hMax: bounds.xMax, vMin: bounds.yMin, vMax: bounds.yMax };
  if (mode.axis === 'x') return { hMin: bounds.yMin, hMax: bounds.yMax, vMin: bounds.zMin, vMax: bounds.zMax };
  return { hMin: bounds.xMin, hMax: bounds.xMax, vMin: bounds.zMin, vMax: bounds.zMax };
}

// Encuadre centrado con margen proporcional (con piso absoluto para elementos muy chicos, como
// un montante individual) — mismo criterio de "sobrante repartido" que computeFitView.
function fitBoundsToPanel(hv, canvasW, canvasH) {
  const spanH = Math.max(hv.hMax - hv.hMin, 1);
  const spanV = Math.max(hv.vMax - hv.vMin, 1);
  const marginH = Math.max(spanH * 0.25, 300);
  const marginV = Math.max(spanV * 0.25, 300);
  const totalH = spanH + marginH * 2;
  const totalV = spanV + marginV * 2;
  const scale = Math.min(canvasW / totalH, canvasH / totalV);
  const slackH = canvasW / scale - totalH;
  const slackV = canvasH / scale - totalV;
  return { scale, offsetX: hv.hMin - marginH - slackH / 2, offsetY: hv.vMin - marginV - slackV / 2 };
}

// ★ Fix: antes usaba siempre xAxes/yAxes para h/v, sin importar el modo. En elevación, la
// altura de pantalla es Z (niveles), no la posición Y del plano — usar yAxes ahí hacía que la
// escala se calculara para el rango de Y en planta (p.ej. 13000mm) en vez de la altura real del
// edificio (unos pocos miles de mm), dejando el contenido diminuto y corrido hacia abajo.
function computeFitView(view, grid, canvasW, canvasH, modeStr = 'plan') {
  const { xAxes, yAxes, zLevels } = grid;
  const mode = toProjectionMode(modeStr);
  let hs, vs;
  if (mode === 'plan') {
    hs = xAxes.map(a => a.position);
    vs = yAxes.map(a => a.position);
  } else if (mode.axis === 'x') {
    // Elevación mirando a lo largo de un eje X fijo: horizontal = posición Y, vertical = Z.
    hs = yAxes.map(a => a.position);
    vs = zLevels.map(z => z.elevation);
  } else {
    // Elevación mirando a lo largo de un eje Y fijo: horizontal = posición X, vertical = Z.
    hs = xAxes.map(a => a.position);
    vs = zLevels.map(z => z.elevation);
  }
  if (hs.length === 0 && vs.length === 0) return view;
  const minH = hs.length ? Math.min(...hs) : 0;
  const maxH = hs.length ? Math.max(...hs) : 1000;
  const minV = vs.length ? Math.min(...vs) : 0;
  const maxV = vs.length ? Math.max(...vs) : 1000;
  const margin = 1000;
  const spanH = Math.max(maxH - minH + margin * 2, 1000);
  const spanV = Math.max(maxV - minV + margin * 2, 1000);
  const scale = Math.min(canvasW / spanH, canvasH / spanV);
  // ★ Fix: cuando la proporción del modelo no coincide con la del canvas, uno de los dos ejes
  // queda con espacio sobrante (inevitable si no se quiere deformar el dibujo). Antes ese
  // sobrante se acumulaba entero a la derecha/abajo porque el encuadre anclaba el contenido en
  // la esquina superior izquierda. Ahora se reparte por igual a ambos lados (contenido centrado).
  const slackH = canvasW / scale - spanH;
  const slackV = canvasH / scale - spanV;
  return { ...view, scale, offsetX: minH - margin - slackH / 2, offsetY: minV - margin - slackV / 2 };
}

/** Envuelve un cambio de modelo para que quede en el historial de deshacer/rehacer. */
function withHistory(s, nextModel) {
  const reconciledModel = reconcileStructuralIntentAfterGeometryChange(s.model, nextModel);
  return {
    model: reconciledModel,
    past: [...s.past, s.model].slice(-HISTORY_LIMIT),
    future: [],
    projectDocument: markProjectDocumentDirty(s.projectDocument)
  };
}

export const useModelStore = create((set, get) => ({
  model: emptyModel(),
  projectDocument: createProjectDocument(),
  view: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
  past: [],
  future: [],
  modelImportFeedback: null,

  // ---- SPEC-015-C-1: localizador visual transitorio ----
  // Vive fuera de `model`: no se persiste, no crea historial y no registra trazabilidad.
  structuralIntentLocator: { ...EMPTY_STRUCTURAL_INTENT_LOCATOR },
  openStructuralIntentLocator: (payload) => set((s) => {
    const next = openStructuralIntentLocatorState(s, payload);
    return next === s ? {} : { structuralIntentLocator: next.structuralIntentLocator };
  }),
  setStructuralIntentLocatorActive: (id) => set((s) => {
    const next = setStructuralIntentLocatorActiveState(s, id);
    return next === s ? {} : { structuralIntentLocator: next.structuralIntentLocator };
  }),
  setStructuralIntentLocatorHover: (id) => set((s) => {
    const next = setStructuralIntentLocatorHoverState(s, id);
    return next === s ? {} : { structuralIntentLocator: next.structuralIntentLocator };
  }),
  requestStructuralIntentLocatorTarget: (id) => set((s) => {
    const next = requestStructuralIntentLocatorTargetState(s, id);
    return next === s ? {} : { structuralIntentLocator: next.structuralIntentLocator };
  }),
  clearStructuralIntentLocatorRequest: () => set((s) => {
    const next = clearStructuralIntentLocatorRequestState(s);
    return next === s ? {} : { structuralIntentLocator: next.structuralIntentLocator };
  }),
  fitStructuralIntentLocator: (canvasW, canvasH) => set((s) => {
    const size = (canvasW && canvasH) ? { width: canvasW, height: canvasH } : getCanvasSizeFallback();
    const next = fitStructuralIntentLocatorState(s, size.width, size.height);
    return next === s ? {} : { model: next.model, view: next.view };
  }),
  closeStructuralIntentLocator: (options) => set((s) => {
    const next = closeStructuralIntentLocatorState(s, options);
    if (next === s) return {};
    return {
      model: next.model,
      layout: next.layout,
      view: next.view,
      viewB: next.viewB,
      viewModeB: next.viewModeB,
      structuralIntentLocator: next.structuralIntentLocator
    };
  }),

  // ---- SPEC-015-D: localizador efímero de propuestas y grafos ----
  // Los IDs se conservan como referencias técnicas; la UI usa descriptor y preview.
  structuralProposalLocator: { ...EMPTY_STRUCTURAL_PROPOSAL_LOCATOR },
  openStructuralProposalLocator: (payload) => set((s) => {
    const next = openStructuralProposalLocatorState(s, payload);
    return next === s ? {} : { structuralProposalLocator: next.structuralProposalLocator };
  }),
  requestStructuralProposalLocation: (entity) => set((s) => {
    const next = requestStructuralProposalLocationState(s, entity);
    return next === s ? {} : { structuralProposalLocator: next.structuralProposalLocator };
  }),
  hoverStructuralProposalLocation: (entity) => set((s) => {
    const next = hoverStructuralProposalLocationState(s, entity);
    return next === s ? {} : { structuralProposalLocator: next.structuralProposalLocator };
  }),
  consumeStructuralProposalLocation: () => set((s) => {
    const next = consumeStructuralProposalLocationState(s);
    return next === s ? {} : { structuralProposalLocator: next.structuralProposalLocator };
  }),
  fitStructuralProposalLocator: (canvasW, canvasH) => set((s) => {
    const size = (canvasW && canvasH) ? { width: canvasW, height: canvasH } : getCanvasSizeFallback();
    const next = fitStructuralProposalLocatorState(s, size.width, size.height);
    return next === s ? {} : { model: next.model, view: next.view };
  }),
  closeStructuralProposalLocator: (options) => set((s) => {
    const next = closeStructuralProposalLocatorState(s, options);
    if (next === s) return {};
    return {
      model: next.model,
      layout: next.layout,
      view: next.view,
      viewB: next.viewB,
      viewModeB: next.viewModeB,
      structuralProposalLocator: next.structuralProposalLocator
    };
  }),

  // ---- deshacer / rehacer ----
  undo: () => set((s) => {
    if (s.past.length === 0) return s;
    const previous = s.past[s.past.length - 1];
    return {
      model: previous,
      past: s.past.slice(0, -1),
      future: [s.model, ...s.future].slice(0, HISTORY_LIMIT),
      projectDocument: markProjectDocumentDirty(s.projectDocument)
    };
  }),
  redo: () => set((s) => {
    if (s.future.length === 0) return s;
    const [next, ...rest] = s.future;
    return {
      model: next,
      future: rest,
      past: [...s.past, s.model].slice(-HISTORY_LIMIT),
      projectDocument: markProjectDocumentDirty(s.projectDocument)
    };
  }),

  // ---- filtro/resaltado por atributo (ítem 7): estado de UI, no entra al historial ni al JSON exportado ----
  attributeFilter: { types: [], libraryIds: [], zLevelId: null, wallOrientation: null },
  showFilterPanel: false,
  showGhostLayer: false, // capa fantasma (sesión 21): apagada por defecto, toggle en menú Ver
  setAttributeFilter: (patch) => set((s) => ({ attributeFilter: { ...s.attributeFilter, ...patch } })),
  clearAttributeFilter: () => set(() => ({ attributeFilter: { types: [], libraryIds: [], zLevelId: null, wallOrientation: null } })),
  toggleFilterPanel: () => set((s) => ({ showFilterPanel: !s.showFilterPanel })),
  toggleGhostLayer: () => set((s) => ({ showGhostLayer: !s.showGhostLayer })),

  // ---- B4.7.4a: dibujo del polígono del faldón (esquinas de eje) ----
  // Estado de UI transitorio (como `view`): NO entra al modelo ni al historial. `vertices` son
  // puntos world {x,y} snapeados a intersección de eje. `closed:true` (≥3 vértices) = contorno
  // cerrado listo para que el modal del faldón (B4.7.4b) lo consuma; `active:false` deja de
  // capturar clics en el canvas.
  roofPlaneDraft: { active: false, closed: false, vertices: [] },
  startRoofPlaneDraft: () => set(() => ({ roofPlaneDraft: { active: true, closed: false, vertices: [] } })),
  addRoofPlaneDraftVertex: (pt) => set((s) => (
    s.roofPlaneDraft.active
      ? { roofPlaneDraft: { ...s.roofPlaneDraft, vertices: [...s.roofPlaneDraft.vertices, pt] } }
      : {}
  )),
  undoRoofPlaneDraftVertex: () => set((s) => (
    s.roofPlaneDraft.active
      ? { roofPlaneDraft: { ...s.roofPlaneDraft, vertices: s.roofPlaneDraft.vertices.slice(0, -1) } }
      : {}
  )),
  closeRoofPlaneDraft: () => set((s) => (
    s.roofPlaneDraft.active && s.roofPlaneDraft.vertices.length >= 3
      ? { roofPlaneDraft: { ...s.roofPlaneDraft, active: false, closed: true } }
      : {}
  )),
  cancelRoofPlaneDraft: () => set(() => ({ roofPlaneDraft: { active: false, closed: false, vertices: [] } })),

  // ★ B4.7.4c — Edición de un faldón ya persistido: reabre RoofPlaneModal precargado. Estado
  // transitorio de UI (como roofPlaneDraft), NO va en el modelo. Confirmar = updateRoofPlane.
  editingRoofPlaneId: null,
  startEditRoofPlane: (id) => set(() => ({ editingRoofPlaneId: id })),
  cancelEditRoofPlane: () => set(() => ({ editingRoofPlaneId: null })),

  // ---- leyenda colapsable por panel (sesión 20): estado de UI, no entra al historial ----
  legendCollapsedA: false,
  legendCollapsedB: false,
  toggleLegendCollapsed: (panelId) => set((s) => (
    panelId === 'a' ? { legendCollapsedA: !s.legendCollapsedA } : { legendCollapsedB: !s.legendCollapsedB }
  )),

  // ---- panel B (vista dividida) ----
  layout: 'single', // 'single' | 'split'
  viewModeB: 'plan',
  viewB: { scale: 0.04, offsetX: -3000, offsetY: -2000, showAxes: true },
  setLayout: (layout) => set(() => ({ layout })),
  setViewModeB: (mode) => set(() => ({ viewModeB: mode })),
  zoomInB: (canvasW, canvasH) => set((s) => ({ viewB: computeZoomedView(s.viewB, 1.25, canvasW, canvasH) })),
  zoomOutB: (canvasW, canvasH) => set((s) => ({ viewB: computeZoomedView(s.viewB, 1 / 1.25, canvasW, canvasH) })),
  setViewOffsetB: (offsetX, offsetY) => set((s) => ({ viewB: { ...s.viewB, offsetX, offsetY } })),
  toggleAxesB: () => set((s) => ({ viewB: { ...s.viewB, showAxes: !s.viewB.showAxes } })),
  fitToContentB: (canvasW, canvasH) => set((s) => ({ viewB: computeFitView(s.viewB, s.model.grid, canvasW, canvasH, s.viewModeB) })),

  // ---- selección / modo de vista (no entran al historial: son navegación, no datos) ----
  selectElement: (id) => set((s) => ({ model: { ...s.model, selectedElementId: id, selectedRoofSystemId: null, selectedRoofPlaneId: null } })),
  selectRoofSystem: (id) => set((s) => ({ model: { ...s.model, selectedRoofSystemId: id, selectedElementId: null, selectedRoofPlaneId: null } })),
  setViewMode: (mode) => set((s) => ({ model: { ...s.model, viewMode: mode } })),
  setCurrentZLevel: (id) => set((s) => ({ model: { ...s.model, currentZLevelId: id } })),
  goToPreviousZLevel: () => set((s) => {
    const { zLevels } = s.model.grid;
    const idx = zLevels.findIndex(l => l.id === s.model.currentZLevelId);
    if (idx <= 0) return s;
    return { model: { ...s.model, currentZLevelId: zLevels[idx - 1].id } };
  }),
  goToNextZLevel: () => set((s) => {
    const { zLevels } = s.model.grid;
    const idx = zLevels.findIndex(l => l.id === s.model.currentZLevelId);
    if (idx === -1 || idx >= zLevels.length - 1) return s;
    return { model: { ...s.model, currentZLevelId: zLevels[idx + 1].id } };
  }),

  // ---- vista (zoom/pan) — no entran al historial ----
  zoomIn: (canvasW, canvasH) => set((s) => ({ view: computeZoomedView(s.view, 1.25, canvasW, canvasH) })),
  zoomOut: (canvasW, canvasH) => set((s) => ({ view: computeZoomedView(s.view, 1 / 1.25, canvasW, canvasH) })),
  setViewOffset: (offsetX, offsetY) => set((s) => ({ view: { ...s.view, offsetX, offsetY } })),
  toggleAxes: () => set((s) => ({ view: { ...s.view, showAxes: !s.view.showAxes } })),
  fitToContent: (canvasW, canvasH) => set((s) => ({ view: computeFitView(s.view, s.model.grid, canvasW, canvasH, s.model.viewMode) })),

  // ---- parámetros de proyecto ----
  addProjectParam: (param) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, projectParams: [...(s.model.projectParams || []), { ...param, id: generateId() }]
  }, 'projectParams'))),
  updateProjectParam: (id, patch) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, projectParams: (s.model.projectParams || []).map(p => p.id === id ? { ...p, ...patch } : p)
  }, 'projectParams'))),
  removeProjectParam: (id) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, projectParams: (s.model.projectParams || []).filter(p => p.id !== id)
  }, 'projectParams'))),

  // ---- default de proyecto para modulación OSB ----
  // minPanelWidth siempre se clampea a un piso duro de 200mm, sin importar lo que llegue en
  // el patch (ver decisión con Fran: es configurable pero nunca por debajo de eso).
  setOsbDefaults: (patch) => set((s) => {
    const next = { ...(s.model.osbDefaults || {}), ...patch };
    if (next.minPanelWidth != null) next.minPanelWidth = Math.max(200, Number(next.minPanelWidth));
    return withHistory(s, invalidateForMutation({ ...s.model, osbDefaults: next }, 'osbDefaults'));
  }),

  // ---- default de proyecto para modulación metalcon (sesión 20b) ----
  setMetalconDefaults: (patch) => set((s) => {
    const next = { ...(s.model.metalconDefaults || {}), ...patch };
    return withHistory(s, invalidateForMutation({ ...s.model, metalconDefaults: next }, 'metalconDefaults'));
  }),

  // ---- tipos y roles de muro (R5-B) ----
  addWallType: (input) => {
    const wallType = cloneWallType({ ...input, id: generateId() });
    const current = get().model;
    const wallTypes = [...(current.wallTypes || []), wallType];
    assertValidWallTypes(wallTypes, current.library);
    set((s) => withHistory(s, { ...s.model, wallTypes }));
    return { ok: true, wallTypeId: wallType.id };
  },
  updateWallType: (id, patch) => {
    if (hasOwn(patch || {}, 'id')) {
      throw new TypeError('El id de un tipo de muro es inmutable.');
    }
    const current = get().model;
    const index = (current.wallTypes || []).findIndex((item) => item.id === id);
    if (index < 0) throw new TypeError(`El tipo de muro ${id} no existe.`);
    const before = current.wallTypes[index];
    const updated = mergeWallTypePatch(before, patch || {});
    const wallTypes = current.wallTypes.map((item, itemIndex) => (
      itemIndex === index ? updated : item
    ));
    assertValidWallTypes(wallTypes, current.library);
    const invalidates = wallTypeChangeInvalidates(before, updated);
    set((s) => {
      const next = { ...s.model, wallTypes };
      return withHistory(
        s,
        invalidates
          ? invalidateForMutation(next, 'wallTypeConfig', { wallTypeId: id })
          : next
      );
    });
    return { ok: true, wallTypeId: id, invalidated: invalidates };
  },
  removeWallType: (id) => {
    const current = get().model;
    if (!(current.wallTypes || []).some((item) => item.id === id)) {
      return { ok: false, error: `El tipo ${id} no existe.`, wallIds: [] };
    }
    const wallIds = (current.elements || [])
      .filter((element) => element.type === 'wall' && element.wallTypeId === id)
      .map((element) => element.id);
    if (wallIds.length > 0) {
      return {
        ok: false,
        error: `El tipo ${id} está asignado a ${wallIds.length} muro(s).`,
        wallIds
      };
    }
    set((s) => withHistory(s, {
      ...s.model,
      wallTypes: (s.model.wallTypes || []).filter((item) => item.id !== id)
    }));
    return { ok: true, wallTypeId: id };
  },
  assignWallType: (wallId, wallTypeId) => {
    const current = get().model;
    const wall = (current.elements || []).find((element) => element.id === wallId);
    if (!wall || wall.type !== 'wall') {
      throw new TypeError(`El muro ${wallId} no existe.`);
    }
    const requested = wallTypeId ?? null;
    if (requested !== null && !getWallType(current, requested)) {
      throw new TypeError(`El tipo de muro ${requested} no existe.`);
    }
    if ((wall.wallTypeId ?? null) === requested) return { ok: true, changed: false };

    set((s) => {
      const elements = s.model.elements.map((element) => {
        if (element.id !== wallId) return element;
        const next = { ...element };
        if (requested === null) delete next.wallTypeId;
        else next.wallTypeId = requested;
        return next;
      });
      return withHistory(s, invalidateForMutation(
        { ...s.model, elements },
        'wallTypeAssignment',
        { wallId }
      ));
    });
    return { ok: true, changed: true };
  },
  assignWallTypesBatch: (wallIds, wallTypeId) => {
    if (!Array.isArray(wallIds)) {
      throw new TypeError('wallIds debe ser un array.');
    }
    const current = get().model;
    const requested = wallTypeId ?? null;
    if (requested !== null && !getWallType(current, requested)) {
      throw new TypeError(`El tipo de muro ${requested} no existe.`);
    }

    const uniqueIds = [...new Set(wallIds)];
    const wallsById = new Map();
    for (const wallId of uniqueIds) {
      const element = (current.elements || []).find((candidate) => candidate.id === wallId);
      if (!element) throw new TypeError(`El muro ${wallId} no existe.`);
      if (element.type !== 'wall') {
        throw new TypeError(`El elemento ${wallId} no existe como muro.`);
      }
      wallsById.set(wallId, element);
    }

    const changedIds = uniqueIds.filter((wallId) => (
      (wallsById.get(wallId).wallTypeId ?? null) !== requested
    ));
    if (changedIds.length === 0) {
      return { ok: true, changed: false, wallIds: [] };
    }

    const changedSet = new Set(changedIds);
    set((s) => {
      const elements = s.model.elements.map((element) => {
        if (!changedSet.has(element.id)) return element;
        const next = { ...element };
        if (requested === null) delete next.wallTypeId;
        else next.wallTypeId = requested;
        return next;
      });
      return withHistory(s, invalidateForMutation(
        { ...s.model, elements },
        'wallTypeAssignment',
        { wallIds: changedIds }
      ));
    });
    return { ok: true, changed: true, wallIds: changedIds };
  },

  // ---- datos de proyecto del cajetín (sesión 22) ----
  // Entran al historial: son datos del modelo y un cambio de mandante/obra debe poder deshacerse
  // igual que cualquier otra edición.
  setProjectInfo: (patch) => set((s) => withHistory(s, {
    ...s.model, projectInfo: { ...normalizeProjectInfo(s.model.projectInfo), ...patch }
  })),
  addRevision: (rev = {}) => set((s) => {
    const info = normalizeProjectInfo(s.model.projectInfo);
    const revisiones = [...info.revisiones, {
      rev: rev.rev || nextRevisionLetter(info.revisiones),
      fecha: rev.fecha || new Date().toLocaleDateString('es-CL'),
      descripcion: rev.descripcion || '',
      autor: rev.autor || info.dibujo || ''
    }];
    return withHistory(s, { ...s.model, projectInfo: { ...info, revisiones } });
  }),
  updateRevision: (index, patch) => set((s) => {
    const info = normalizeProjectInfo(s.model.projectInfo);
    const revisiones = info.revisiones.map((r, i) => (i === index ? { ...r, ...patch } : r));
    return withHistory(s, { ...s.model, projectInfo: { ...info, revisiones } });
  }),
  removeRevision: (index) => set((s) => {
    const info = normalizeProjectInfo(s.model.projectInfo);
    return withHistory(s, { ...s.model, projectInfo: { ...info, revisiones: info.revisiones.filter((_, i) => i !== index) } });
  }),

  // ---- librería ----
  addLibraryItem: (key, item) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, library: { ...s.model.library, [key]: [...s.model.library[key], { ...item, id: generateId() }] }
  }, 'library'))),
  updateLibraryItem: (key, id, patch) => set((s) => {
    const nextSection = s.model.library[key].map(i => i.id === id ? { ...i, ...patch } : i);
    const updatedItem = nextSection.find(i => i.id === id);
    const nextElements = cascadeLibrarySubstitution(s.model.elements, key, id, updatedItem);
    return withHistory(s, invalidateForMutation({
      ...s.model,
      library: { ...s.model.library, [key]: nextSection },
      elements: nextElements
    }, 'library'));
  }),
  removeLibraryItem: (key, id) => {
    if (key === 'metalconProfiles') {
      const wallTypeIds = (get().model.wallTypes || [])
        .filter((wallType) => (
          String(wallType.metalconDefaults?.studProfileId) === String(id)
          || String(wallType.metalconDefaults?.trackProfileId) === String(id)
        ))
        .map((wallType) => wallType.id);
      if (wallTypeIds.length > 0) {
        return {
          ok: false,
          error: `El perfil ${id} está referenciado por ${wallTypeIds.length} tipo(s) de muro.`,
          wallTypeIds
        };
      }
    }
    set((s) => withHistory(s, invalidateForMutation({
      ...s.model,
      library: {
        ...s.model.library,
        [key]: s.model.library[key].filter((item) => item.id !== id)
      }
    }, 'library')));
    return { ok: true, key, id };
  },
  // ★ Carga (una vez) el catálogo de perfiles Metalcon Cintac en library.metalconProfiles.
  // No duplica: si un `code` ya existe en la librería, se omite. Un solo paso de historial.
  loadMetalconCatalog: () => set((s) => {
    const existingCodes = new Set((s.model.library.metalconProfiles || []).map(p => p.code));
    const toAdd = METALCON_PROFILES.filter(p => !existingCodes.has(p.code)).map(p => ({ ...p, id: generateId() }));
    if (toAdd.length === 0) return s;
    return withHistory(s, invalidateForMutation({
      ...s.model,
      library: { ...s.model.library, metalconProfiles: [...(s.model.library.metalconProfiles || []), ...toAdd] }
    }, 'library'));
  }),

  // ---- techumbre: sistemas de cerchas + plantillas de entramado ----
  addRoofSystem: (system) => set((s) => withHistory(s, {
    ...s.model, roofSystems: [...(s.model.roofSystems || []), { ...system, id: generateId() }]
  })),
  updateRoofSystem: (id, patch) => {
    const derivedFields = DERIVED_WRITE_FIELDS.filter((field) => hasOwn(patch || {}, field));
    if (derivedFields.length > 0) {
      throw new Error(
        `Los resultados derivados (${derivedFields.join(', ')}) sólo pueden escribirse mediante un comando de regeneración.`
      );
    }
    set((s) => withHistory(s, invalidateForMutation({
      ...s.model,
      roofSystems: (s.model.roofSystems || []).map(r => r.id === id ? { ...r, ...patch } : r)
    }, 'roofSystemConfig', { roofSystemId: id })));
  },
  commitRoofSystemRegeneration: (id, result) => {
    if (!result?.trussGeometry || !Array.isArray(result?.trussPositions)) {
      throw new Error('Regeneración roofTruss incompleta: faltan trussGeometry o trussPositions.');
    }
    set((s) => withHistory(s, {
      ...s.model,
      roofSystems: (s.model.roofSystems || []).map((system) => (
        system.id === id ? { ...system, ...result, stale: false } : system
      ))
    }));
  },
  removeRoofSystem: (id) => set((s) => withHistory(s, {
    ...s.model,
    roofSystems: (s.model.roofSystems || []).filter(r => r.id !== id),
    selectedRoofSystemId: s.model.selectedRoofSystemId === id ? null : s.model.selectedRoofSystemId
  })),
  // ★ Duplica un sistema para partir un paño en L en dos sin reingresar todo (sesión 10): copia
  // la config (muros/pendiente/talón/etc.), desplaza trussPositions un `trussSpacing` en su eje
  // de corrida (solo referencial — se recalculan al Generar) y descarta trussGeometry: el
  // usuario ajusta muros/rango en el modal y regenera. Un solo paso de historial; undo la elimina.
  duplicateRoofSystem: (id) => set((s) => {
    const source = (s.model.roofSystems || []).find(r => r.id === id);
    if (!source) return s;
    const shift = source.trussSpacing || 1200;
    const trussPositions = (source.trussPositions || []).map(p => ({
      offset: p.offset + shift,
      world: source.runAxis === 'x' ? { x: p.world.x + shift, y: p.world.y } : { x: p.world.x, y: p.world.y + shift }
    }));
    const { trussGeometry, ...rest } = source;
    // Zona (sesión 23): si el original tiene rango numérico, la copia arranca justo donde termina
    // — el caso real de duplicar es "la zona de al lado". Con fórmulas se copia tal cual.
    const rr = source.runRange;
    const runRange = (rr && typeof rr.from === 'number' && typeof rr.to === 'number')
      ? { from: rr.to, to: rr.to + (rr.to - rr.from) }
      : rr ?? null;
    const copy = { ...rest, runRange, trussPositions, id: generateId(), stale: false };
    return withHistory(s, { ...s.model, roofSystems: [...(s.model.roofSystems || []), copy] });
  }),
  // Carga (una vez) las plantillas semilla de entramado (core/trussTemplates.js). No duplica por id.
  loadSeedTrussTemplates: () => set((s) => {
    const merged = mergeSeedTemplates(s.model.library.trussTemplates || []);
    if (merged.length === (s.model.library.trussTemplates || []).length) return s;
    return withHistory(s, invalidateForMutation({
      ...s.model,
      library: { ...s.model.library, trussTemplates: merged }
    }, 'library'));
  }),

  // ---- B4.7: faldones de techumbre (roofPlanes) ----
  addRoofPlane: (plane) => set((s) => {
    const id = generateId();
    return withHistory(s, {
      ...s.model,
      roofPlanes: [...(s.model.roofPlanes || []), { ...plane, id }],
      selectedRoofPlaneId: id, selectedElementId: null, selectedRoofSystemId: null
    });
  }),
  updateRoofPlane: (id, patch) => set((s) => withHistory(s, {
    ...s.model,
    roofPlanes: (s.model.roofPlanes || []).map(p => p.id === id ? { ...p, ...patch } : p)
  })),
  removeRoofPlane: (id) => set((s) => withHistory(s, {
    ...s.model,
    roofPlanes: (s.model.roofPlanes || []).filter(p => p.id !== id),
    selectedRoofPlaneId: s.model.selectedRoofPlaneId === id ? null : s.model.selectedRoofPlaneId
  })),
  selectRoofPlane: (id) => set((s) => ({
    model: { ...s.model, selectedRoofPlaneId: id, selectedElementId: null, selectedRoofSystemId: null }
  })),
  dismissModelImportFeedback: () => set({ modelImportFeedback: null }),


  // ---- ejes / niveles ----
  addXAxis: (position, label) => set((s) => withHistory(s, {
    ...s.model, grid: { ...s.model.grid, xAxes: [...s.model.grid.xAxes, { id: generateId(), position, label }] }
  })),
  addYAxis: (position, label) => set((s) => withHistory(s, {
    ...s.model, grid: { ...s.model.grid, yAxes: [...s.model.grid.yAxes, { id: generateId(), position, label }] }
  })),
  addAuxXAxis: (refAxisId, offset, label) => set((s) => {
    const ref = s.model.grid.xAxes.find(a => a.id === refAxisId);
    if (!ref) return s;
    return withHistory(s, { ...s.model, grid: { ...s.model.grid, xAxes: [...s.model.grid.xAxes, { id: generateId(), position: ref.position + offset, label, type: 'aux' }] } });
  }),
  addAuxYAxis: (refAxisId, offset, label) => set((s) => {
    const ref = s.model.grid.yAxes.find(a => a.id === refAxisId);
    if (!ref) return s;
    return withHistory(s, { ...s.model, grid: { ...s.model.grid, yAxes: [...s.model.grid.yAxes, { id: generateId(), position: ref.position + offset, label, type: 'aux' }] } });
  }),
  addZLevel: (elevation, label) => set((s) => {
    const zLevels = [...s.model.grid.zLevels, { id: generateId(), elevation, label }];
    return withHistory(s, {
      ...s.model,
      grid: { ...s.model.grid, zLevels },
      currentZLevelId: s.model.currentZLevelId ?? zLevels[0].id
    });
  }),
  // Mover un eje/nivel cambia la geometría de todo lo que lo referencia: invalidación global
  // (rastreo fino no compensa; marcar de más es seguro, marcar de menos no).
  updateXAxis: (id, patch) => set((s) => withHistory(s, maybeGlobalInvalidate({
    ...s.model, grid: { ...s.model.grid, xAxes: s.model.grid.xAxes.map(a => a.id === id ? { ...a, ...patch } : a) }
  }, patch, 'position'))),
  updateYAxis: (id, patch) => set((s) => withHistory(s, maybeGlobalInvalidate({
    ...s.model, grid: { ...s.model.grid, yAxes: s.model.grid.yAxes.map(a => a.id === id ? { ...a, ...patch } : a) }
  }, patch, 'position'))),
  updateZLevel: (id, patch) => set((s) => withHistory(s, maybeGlobalInvalidate({
    ...s.model, grid: { ...s.model.grid, zLevels: s.model.grid.zLevels.map(z => z.id === id ? { ...z, ...patch } : z) }
  }, patch, 'elevation'))),
  removeXAxis: (id) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, grid: { ...s.model.grid, xAxes: s.model.grid.xAxes.filter(a => a.id !== id) }
  }, 'gridGeometry'))),
  removeYAxis: (id) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model, grid: { ...s.model.grid, yAxes: s.model.grid.yAxes.filter(a => a.id !== id) }
  }, 'gridGeometry'))),
  removeZLevel: (id) => set((s) => {
    const zLevels = s.model.grid.zLevels.filter(z => z.id !== id);
    const currentZLevelId = s.model.currentZLevelId === id ? (zLevels[0]?.id ?? null) : s.model.currentZLevelId;
    return withHistory(s, invalidateForMutation(
      { ...s.model, grid: { ...s.model.grid, zLevels }, currentZLevelId },
      'gridGeometry'
    ));
  }),

  // ---- cotas vivas ----
  addDimension: (dimension) => set((s) => withHistory(s, {
    ...s.model, dimensions: [...(s.model.dimensions || []), { ...dimension, id: generateId() }]
  })),
  updateDimension: (id, patch) => set((s) => withHistory(s, {
    ...s.model, dimensions: (s.model.dimensions || []).map(d => d.id === id ? { ...d, ...patch } : d)
  })),
  removeDimension: (id) => set((s) => withHistory(s, {
    ...s.model, dimensions: (s.model.dimensions || []).filter(d => d.id !== id)
  })),

  // ---- intención estructural agnóstica (SPEC-015-A/B) ----
  setElementIntent: (elementId, intent) => {
    let outcome;
    set((s) => {
      outcome = setElementIntentInModel(s.model, elementId, intent, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  removeElementIntent: (elementId) => {
    let outcome;
    set((s) => {
      outcome = removeElementIntentInModel(s.model, elementId, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  setElementIntentsBatch: (elementIds, intent, options = {}) => {
    let outcome;
    set((s) => {
      outcome = setElementIntentsBatchInModel(s.model, elementIds, intent, {
        ...options,
        recordUserAction: true
      });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives,
      changes: outcome.changes || []
    };
  },
  removeElementIntentsBatch: (elementIds, options = {}) => {
    let outcome;
    set((s) => {
      outcome = removeElementIntentsBatchInModel(s.model, elementIds, {
        ...options,
        recordUserAction: true
      });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives,
      changes: outcome.changes || []
    };
  },
  setRoofIntent: (roofGeometryId, intent) => {
    let outcome;
    set((s) => {
      outcome = setRoofIntentInModel(s.model, roofGeometryId, intent, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  removeRoofIntent: (roofGeometryId) => {
    let outcome;
    set((s) => {
      outcome = removeRoofIntentInModel(s.model, roofGeometryId, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },

  // ---- interfaces estructurales agnósticas (SPEC-015-D REV8) ----
  applyStructuralInterfaceTransaction: (transaction) => {
    let outcome;
    set((s) => {
      outcome = applyStructuralInterfaceTransactionInModel(s.model, transaction, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedInterfaceIds: outcome.affectedInterfaceIds || [],
      affectedRelationIds: outcome.affectedRelationIds || [],
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  removeStructuralInterfaceIntent: (interfaceId) => {
    let outcome;
    set((s) => {
      outcome = removeStructuralInterfaceIntentInModel(s.model, interfaceId, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedInterfaceIds: outcome.affectedInterfaceIds || [],
      affectedRelationIds: outcome.affectedRelationIds || [],
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  removeStructuralRelationIntent: (relationId) => {
    let outcome;
    set((s) => {
      outcome = removeStructuralRelationIntentInModel(s.model, relationId, { recordUserAction: true });
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedInterfaceIds: outcome.affectedInterfaceIds || [],
      affectedRelationIds: outcome.affectedRelationIds || [],
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },
  clearStructuralIntent: () => {
    let outcome;
    set((s) => {
      outcome = clearStructuralIntentInModel(s.model);
      return outcome.model === s.model ? s : withHistory(s, outcome.model);
    });
    return {
      affectedElementIds: outcome.affectedElementIds,
      affectedRoofGeometryIds: outcome.affectedRoofGeometryIds,
      invalidatedStructuralDerivatives: outcome.invalidatedStructuralDerivatives
    };
  },

  // ---- revisión humana de propuestas (SPEC-015-D) ----
  // La preparación ocurre fuera del store. Sólo una decisión confirmada llega a este mutador.
  applyPreparedStructuralProposalDecision: ({
    structuralProposals,
    preparedDecision,
    currentVisualFingerprint = null
  }) => {
    let outcome;
    set((s) => {
      outcome = applyStructuralProposalDecision({
        model: s.model,
        structuralProposals,
        preparedDecision,
        confirmed: true,
        currentVisualFingerprint
      });
      return withHistory(s, outcome.model);
    });
    return outcome;
  },
  applyPreparedStructuralProposalDecisionBatch: ({
    structuralProposals,
    preparedDecisions,
    currentVisualFingerprints = {}
  }) => {
    let outcome;
    set((s) => {
      outcome = applyStructuralProposalDecisionBatch({
        model: s.model,
        structuralProposals,
        preparedDecisions,
        confirmed: true,
        currentVisualFingerprints
      });
      return withHistory(s, outcome.model);
    });
    return outcome;
  },
  // ---- elementos ----
  addElement: (element) => set((s) => {
    const entry = { ...element, id: generateId() };
    const next = { ...s.model, elements: [...s.model.elements, entry] };
    return withHistory(
      s,
      entry.type === 'wall'
        ? invalidateForMutation(next, 'wallTopology', { wallId: entry.id })
        : next
    );
  }),
  // ★ Colocación generativa: agrega varios elementos como un solo paso de deshacer/rehacer.
  addElements: (newElements) => set((s) => {
    const entries = newElements.map((element) => ({ ...element, id: generateId() }));
    const wallIds = entries.filter((entry) => entry.type === 'wall').map((entry) => entry.id);
    const next = { ...s.model, elements: [...s.model.elements, ...entries] };
    return withHistory(
      s,
      wallIds.length > 0
        ? invalidateForMutation(next, 'wallTopology', { wallIds })
        : next
    );
  }),
  // ★ Colocación generativa (spacing): crea ejes auxiliares nuevos + los pilares que los
  // referencian, en un solo paso de historial. newAxes trae el id ya asignado (generado en
  // generativePlacement.js) porque los elementos ya lo referencian en axisXId/axisYId.
  addAxesAndElements: (newAxes, newElements) => set((s) => {
    let xAxes = s.model.grid.xAxes;
    let yAxes = s.model.grid.yAxes;
    for (const ax of newAxes) {
      const entry = { id: ax.id, position: ax.position, label: ax.label, type: ax.type || 'aux-generated' };
      if (ax.axis === 'x') xAxes = [...xAxes, entry];
      else yAxes = [...yAxes, entry];
    }
    const entries = newElements.map(e => ({ ...e, id: generateId() }));
    const next = {
      ...s.model,
      grid: { ...s.model.grid, xAxes, yAxes },
      elements: [...s.model.elements, ...entries]
    };
    const wallIds = entries.filter((entry) => entry.type === 'wall').map((entry) => entry.id);
    return withHistory(
      s,
      wallIds.length > 0
        ? invalidateForMutation(next, 'wallTopology', { wallIds })
        : next
    );
  }),
  // ★ Sesión 15 — dividir un muro: crea el eje del corte si hace falta, reemplaza el muro
  // original por sus dos tramos (ids NUEVOS, ver core/wallSplitMerge.js) y deja todo en UNA
  // entrada de historial. Devuelve el plan para que la UI informe el resultado.
  splitWall: (wallId, options = {}) => {
    const plan = planWallSplit(get().model, wallId, options);
    if (!plan.ok) return plan;
    let intentOutcome = null;
    set((s) => {
      let { xAxes, yAxes } = s.model.grid;
      let cutAxisId = plan.cutAxisId;
      if (plan.newAxis) {
        cutAxisId = generateId();
        const entry = { id: cutAxisId, position: plan.newAxis.position, label: plan.newAxis.label, type: 'aux' };
        if (plan.newAxis.axisType === 'x') xAxes = [...xAxes, entry];
        else yAxes = [...yAxes, entry];
      }
      const resolveCut = (w) => {
        const out = { ...w, id: generateId() };
        for (const k of ['xStart', 'xEnd', 'yStart', 'yEnd']) {
          if (out[k] === CUT_AXIS_PLACEHOLDER) out[k] = cutAxisId;
        }
        return out;
      };
      const segments = plan.walls.map(resolveCut);
      const idx = s.model.elements.findIndex((el) => el.id === wallId);
      const elements = [...s.model.elements];
      elements.splice(idx, 1, ...segments);
      const splitModel = {
        ...s.model,
        grid: { ...s.model.grid, xAxes, yAxes },
        elements,
        selectedElementId: segments[0].id
      };
      intentOutcome = reconcileStructuralIntentAfterSplit(
        s.model,
        splitModel,
        wallId,
        segments.map((segment) => segment.id)
      );
      return withHistory(s, invalidateForMutation(
        intentOutcome.model,
        'wallTopology',
        { wallIds: [wallId] }
      ));
    });
    return {
      ...plan,
      affectedElementIds: intentOutcome.affectedElementIds,
      structuralIntentFinding: intentOutcome.finding
    };
  },
  // ★ Sesión 15 — unir muros colineales contiguos en uno solo (id nuevo), un solo undo.
  mergeWalls: (wallIds, options = {}) => {
    const intentCheck = checkStructuralIntentBeforeMerge(get().model, wallIds);
    if (!intentCheck.ok) return intentCheck;
    const plan = planWallMerge(get().model, wallIds, options);
    if (!plan.ok) return plan;
    set((s) => {
      const merged = { ...plan.wall, id: generateId() };
      const idx = s.model.elements.findIndex((el) => plan.removedIds.includes(el.id));
      const elements = s.model.elements.filter((el) => !plan.removedIds.includes(el.id));
      elements.splice(Math.max(0, idx), 0, merged);
      return withHistory(s, invalidateForMutation(
        { ...s.model, elements, selectedElementId: merged.id },
        'wallTopology',
        { wallIds: plan.removedIds }
      ));
    });
    return plan;
  },
  // Editar geometría de un muro deja obsoletos sus despieces persistidos: se marcan stale
  // (ver core/derivedInvalidation.js). Los roofSystems que lo referencian también.
  updateElement: (id, patch) => {
    assertNoDerivedWrites(patch);
    set((s) => {
    const target = s.model.elements.find(el => el.id === id);
    const next = {
      ...s.model,
      elements: s.model.elements.map(el =>
        el.id !== id ? el : { ...el, ...patch }
      )
    };
    if (target?.type === 'wall' && patchInvalidatesWall(patch)) {
      const mutation = patchInvalidatesWallTopology(patch)
        ? 'wallTopology'
        : 'wallGeometry';
      return withHistory(s, invalidateForMutation(next, mutation, { wallId: id }));
    }
    if (target?.type === 'foundation') {
      return withHistory(s, invalidateForMutation(next, 'foundationGeometry', { foundationId: id }));
    }
    return withHistory(s, next);
    });
  },
  commitWallRegeneration: (wallId, kind, result) => set((s) => withHistory(s, {
    ...s.model,
    elements: s.model.elements.map((element) => (
      element.id === wallId && element.type === 'wall'
        ? applyWallRegeneration(element, kind, result)
        : element
    ))
  })),
  // ★ "Generar todos" (sesión 09): aplica N patches de despiece (metalcon u OSB) en UNA sola
  // entrada de historial — un solo undo revierte el batch completo. patches: [{wallId, patch}].
  applyWallPatchesBatch: (patches) => set((s) => {
    const patchMap = new Map(patches.map((p) => [p.wallId, p.patch]));
    if (patchMap.size === 0) return s;
    const elements = s.model.elements.map((el) => {
      const patch = patchMap.get(el.id);
      if (!patch) return el;
      return el.type === 'wall' ? applyWallRegenerationPatch(el, patch) : el;
    });
    return withHistory(s, { ...s.model, elements });
  }),
  addOpeningToWall: (wallId, opening) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model,
    elements: s.model.elements.map(el =>
      el.id === wallId
        ? { ...el, openings: [...(el.openings || []), { ...opening, id: generateId() }] }
        : el
    )
  }, 'wallOpenings', { wallId }))),
  updateOpening: (wallId, openingId, patch) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model,
    elements: s.model.elements.map(el =>
      el.id === wallId
        ? { ...el, openings: (el.openings || []).map(o => o.id === openingId ? { ...o, ...patch } : o) }
        : el
    )
  }, 'wallOpenings', { wallId }))),
  removeOpening: (wallId, openingId) => set((s) => withHistory(s, invalidateForMutation({
    ...s.model,
    elements: s.model.elements.map(el =>
      el.id === wallId
        ? { ...el, openings: (el.openings || []).filter(o => o.id !== openingId) }
        : el
    )
  }, 'wallOpenings', { wallId }))),
  centerOnElement: (id, canvasW, canvasH) => set((s) => {
    const { grid, elements } = s.model;
    let el = elements.find(e => e.id === id);
    let parentWall = null;
    if (!el) {
      for (const wall of elements) {
        const opening = (wall.openings || []).find(o => o.id === id);
        if (opening) { el = opening; parentWall = wall; break; }
      }
    }
    if (!el) return s;

    const elementsById = buildElementsById(elements);
    const paramsMap = buildParamsMap(s.model.projectParams);
    const bounds = resolveElementWorldBounds(el, parentWall, grid, elementsById, paramsMap);
    const levelId = parentWall ? parentWall.bottomZ : (el.bottomZ ?? el.levelZ ?? s.model.currentZLevelId);
    const selectedElementId = parentWall ? el.id : (elements.find(e => e.id === id)?.id ?? id);

    if (!bounds) {
      return { model: { ...s.model, selectedElementId, currentZLevelId: levelId ?? s.model.currentZLevelId } };
    }

    const cx = (bounds.xMin + bounds.xMax) / 2;
    const cy = (bounds.yMin + bounds.yMax) / 2;
    // ★ Fix: antes solo tocaba el panel A (view) y forzaba viewMode a 'plan' sin avisarle al
    // panel B — con panel dividido abierto, el panel B se quedaba con el zoom/encuadre previo,
    // desfasado del elemento recién centrado. Ahora ambos paneles se sincronizan a planta.
    return {
      model: { ...s.model, viewMode: 'plan', selectedElementId, currentZLevelId: levelId ?? s.model.currentZLevelId },
      viewModeB: 'plan',
      view: { ...s.view, offsetX: cx - canvasW / 2 / s.view.scale, offsetY: cy - canvasH / 2 / s.view.scale },
      viewB: { ...s.viewB, offsetX: cx - canvasW / 2 / s.viewB.scale, offsetY: cy - canvasH / 2 / s.viewB.scale }
    };
  }),

  /** ★ Nuevo: "zoom a selección" — a diferencia de centerOnElement, no cambia de modo de vista
   * (respeta si estás en planta o elevación en cada panel) y sí ajusta la escala para encuadrar
   * el elemento con margen, en vez de solo desplazar manteniendo el zoom actual. Útil para
   * revisar un vano o volver a un montante puntual sin perder el contexto de elevación en el
   * que estabas trabajando. */
  zoomToElement: (id, canvasW, canvasH) => set((s) => {
    const { grid, elements } = s.model;
    let el = elements.find(e => e.id === id);
    let parentWall = null;
    if (!el) {
      for (const wall of elements) {
        const opening = (wall.openings || []).find(o => o.id === id);
        if (opening) { el = opening; parentWall = wall; break; }
      }
    }
    if (!el) return s;

    const elementsById = buildElementsById(elements);
    const paramsMap = buildParamsMap(s.model.projectParams);
    const bounds = resolveElementWorldBounds(el, parentWall, grid, elementsById, paramsMap);
    if (!bounds) return s;

    const widthPerPanel = s.layout === 'split' ? canvasW / 2 : canvasW;
    const fitA = fitBoundsToPanel(boundsToHV(bounds, s.model.viewMode), widthPerPanel, canvasH);
    const fitB = fitBoundsToPanel(boundsToHV(bounds, s.viewModeB), widthPerPanel, canvasH);
    return { view: { ...s.view, ...fitA }, viewB: { ...s.viewB, ...fitB } };
  }),

  /** ★ Nuevo (sesión 21, parte B): doble click en planta sobre un elemento → deja la planta
   * centrada en él (mismo criterio de paneo que centerOnElement, sin cambiar de modo) y abre/
   * actualiza el OTRO panel en la elevación por eje que lo muestra a lo largo (ver
   * resolveElevationAxisForElement), centrada y encuadrada en él. Si el layout no estaba en
   * split, pasa a split. `panelId` es el panel donde ocurrió el doble click ('a' | 'b');
   * panelW/panelH son el ancho/alto de CADA panel ya resultante tras el split (no el total). */
  goToElevationFromPlan: (id, panelId, panelW, panelH) => set((s) => {
    const { grid, elements } = s.model;
    const el = elements.find(e => e.id === id);
    if (!el) return s;

    const elementsById = buildElementsById(elements);
    const paramsMap = buildParamsMap(s.model.projectParams);
    const bounds = resolveElementWorldBounds(el, null, grid, elementsById, paramsMap);
    if (!bounds) return s;

    const isA = panelId === 'a';
    const planView = isA ? s.view : s.viewB;
    const cx = (bounds.xMin + bounds.xMax) / 2;
    const cy = (bounds.yMin + bounds.yMax) / 2;
    const planOffset = { offsetX: cx - panelW / 2 / planView.scale, offsetY: cy - panelH / 2 / planView.scale };
    const selection = { selectedElementId: id, selectedRoofSystemId: null };

    const planPatch = isA
      ? { model: { ...s.model, ...selection, viewMode: 'plan' }, view: { ...planView, ...planOffset } }
      : { model: { ...s.model, ...selection }, viewModeB: 'plan', viewB: { ...planView, ...planOffset } };

    // Elemento fuera de cualquier eje de grilla (ubicado por offset/referencia): no hay corte de
    // elevación de eje que lo muestre — solo recentramos la planta, sin tocar el otro panel.
    const axisInfo = resolveElevationAxisForElement(el, grid, elementsById, paramsMap);
    if (!axisInfo) return planPatch;

    const elevModeStr = `elevation-${axisInfo.axisType}-${axisInfo.axisId}`;
    const otherView = isA ? s.viewB : s.view;
    const fit = fitBoundsToPanel(boundsToHV(bounds, elevModeStr), panelW, panelH);

    return {
      ...planPatch,
      layout: 'split',
      ...(isA
        ? { viewModeB: elevModeStr, viewB: { ...otherView, ...fit } }
        : { model: { ...planPatch.model, viewMode: elevModeStr }, view: { ...otherView, ...fit } })
    };
  }),

  deleteSelectedElement: () => set((s) => {
    const roofId = s.model.selectedRoofSystemId;
    if (roofId != null) {
      return withHistory(s, {
        ...s.model,
        roofSystems: (s.model.roofSystems || []).filter(r => r.id !== roofId),
        selectedRoofSystemId: null
      });
    }
    const id = s.model.selectedElementId;
    if (id == null) return s;

    const isDimension = (s.model.dimensions || []).some(d => d.id === id);
    if (isDimension) {
      return withHistory(s, { ...s.model, dimensions: s.model.dimensions.filter(d => d.id !== id), selectedElementId: null });
    }

    const topLevel = s.model.elements.find(el => el.id === id);
    if (topLevel) {
      const intentOutcome = removeElementAndStructuralReferences(s.model, id);
      const next = { ...intentOutcome.model, selectedElementId: null };
      return withHistory(
        s,
        topLevel.type === 'wall'
          ? invalidateForMutation(next, 'wallTopology', { wallId: id })
          : next
      );
    }

    // Puede ser un vano anidado dentro de un muro.
    const parentWall = s.model.elements.find((element) => (
      element.type === 'wall' && (element.openings || []).some((opening) => opening.id === id)
    ));
    const next = {
      ...s.model,
      elements: s.model.elements.map(el =>
        el.type === 'wall' && (el.openings || []).some(o => o.id === id)
          ? { ...el, openings: el.openings.filter(o => o.id !== id) }
          : el
      ),
      selectedElementId: null
    };
    return withHistory(
      s,
      parentWall
        ? invalidateForMutation(next, 'wallOpenings', { wallId: parentWall.id })
        : next
    );
  }),

  // ---- ciclo de vida del modelo ----
  clearAll: () => set((s) => withHistory(s, emptyModel())),
  newModel: () => set((s) => ({
    model: emptyModel(),
    past: [],
    future: [],
    projectDocument: resetProjectDocument(s.projectDocument),
    modelImportFeedback: null,
    view: { scale: 0.04, offsetX: 0, offsetY: 0, showAxes: true }
  })),

  // ---- persistencia ----
  openProjectFromPath: async (fileSystem, projectPath) => {
    if (typeof projectPath !== 'string' || projectPath.length === 0) {
      return projectOperationErrorResult(
        set,
        new NativeProjectError(
          'PROJECT_PATH_REQUIRED',
          'Debes elegir un archivo de proyecto para abrir.'
        )
      );
    }
    let opened;
    try {
      opened = await openNativeProject(fileSystem, projectPath);
    } catch (error) {
      return projectOperationErrorResult(set, error);
    }
    set((state) => ({
      model: mergeLoadedModel(opened.prepared.model),
      past: [],
      future: [],
      projectDocument: openProjectDocument(state.projectDocument, projectPath),
      modelImportFeedback: importFeedback(opened.prepared)
    }));
    return {
      ok: true,
      warnings: opened.prepared.warnings,
      appliedMigrations: opened.prepared.appliedMigrations
    };
  },
  saveProjectToPath: async (fileSystem, requestedPath = undefined) => {
    const stateAtStart = get();
    const projectPath = requestedPath ?? stateAtStart.projectDocument.path;
    if (typeof projectPath !== 'string' || projectPath.length === 0) {
      return projectOperationErrorResult(
        set,
        new NativeProjectError(
          'PROJECT_PATH_REQUIRED',
          'Debes elegir un destino mediante Guardar como.'
        )
      );
    }
    const modelAtStart = stateAtStart.model;
    try {
      await saveNativeProject(fileSystem, projectPath, modelAtStart);
    } catch (error) {
      return projectOperationErrorResult(set, error);
    }
    set((state) => {
      const savedDocument = saveProjectDocument(state.projectDocument, projectPath);
      return {
        projectDocument: state.model === modelAtStart
          ? savedDocument
          : markProjectDocumentDirty(savedDocument),
        modelImportFeedback: null
      };
    });
    return { ok: true, path: projectPath };
  },
  hydrateProjectRecentPaths: (recentPaths) => set((state) => ({
    projectDocument: hydrateProjectDocumentRecents(state.projectDocument, recentPaths)
  })),
  restoreRecoveryCandidate: (candidate) => {
    let prepared;
    try {
      prepared = prepareModelImport(candidate?.model);
    } catch (error) {
      return importErrorResult(set, error);
    }
    set((state) => ({
      model: mergeLoadedModel(prepared.model),
      past: [],
      future: [],
      projectDocument: createProjectDocument({
        path: candidate.projectPath ?? null,
        dirty: true,
        recentPaths: state.projectDocument.recentPaths
      }),
      modelImportFeedback: importFeedback(prepared)
    }));
    return {
      ok: true,
      warnings: prepared.warnings,
      appliedMigrations: prepared.appliedMigrations
    };
  },
  reportProjectOperationError: (error) => projectOperationErrorResult(set, error),
  saveModel: () => {
    localStorage.setItem(LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(get().model));
  },
  loadModel: (incoming) => {
    if (incoming !== undefined) {
      try {
        return commitPreparedImport(set, prepareModelImport(incoming));
      } catch (error) {
        return importErrorResult(set, error);
      }
    }
    const raw = globalThis.localStorage?.getItem(LEGACY_PROJECT_STORAGE_KEY);
    if (!raw) {
      return {
        ok: false,
        error: new ModelImportError('MODEL_NOT_FOUND', 'No existe un modelo guardado.')
      };
    }
    try {
      return commitPreparedImport(set, prepareModelJsonImport(raw));
    } catch (error) {
      return importErrorResult(set, error);
    }
  },
  importModelText: (raw) => {
    try {
      return commitPreparedImport(set, prepareModelJsonImport(raw));
    } catch (error) {
      return importErrorResult(set, error);
    }
  },
  exportModelToFile: (environment = {}) => {
    const model = get().model;
    try {
      return downloadAgnosticGeometry(model, environment);
    } catch (error) {
      const notify = environment.notify
        || (typeof globalThis.alert === 'function' ? globalThis.alert : null);
      if (notify) notify(`No se pudo exportar la geometría agnóstica: ${error.message}`);
      return false;
    }
  },
  exportAgnosticGeometryAudit: (environment = {}) => {
    const model = get().model;
    try {
      const report = downloadAgnosticGeometryAudit(model, environment);
      if (report?.status === 'fail') {
        const failure = report.checks.find(({ status }) => status === 'fail');
        const notify = environment.notify
          || (typeof globalThis.alert === 'function' ? globalThis.alert : null);
        if (notify) notify(`La auditoría geométrica detectó una diferencia en ${failure?.path ?? '$'}.`);
      }
      return report;
    } catch (error) {
      const notify = environment.notify
        || (typeof globalThis.alert === 'function' ? globalThis.alert : null);
      if (notify) notify(`No se pudo exportar la auditoría geométrica: ${error.message}`);
      return false;
    }
  },
  importModelFromFile: (file, environment = {}) => {
    const FileReaderCtor = environment.FileReader ?? globalThis.FileReader;
    if (typeof FileReaderCtor !== 'function') {
      return importErrorResult(
        set,
        new ModelImportError(
          'FILE_READER_UNAVAILABLE',
          'El entorno no permite leer el archivo seleccionado.'
        )
      );
    }
    const reader = new FileReaderCtor();
    reader.onload = (ev) => {
      get().importModelText(String(ev.target.result));
    };
    reader.onerror = () => importErrorResult(
      set,
      new ModelImportError('FILE_READ_FAILED', 'No se pudo leer el archivo seleccionado.')
    );
    try {
      reader.readAsText(file);
    } catch (error) {
      return importErrorResult(set, error);
    }
    return { ok: true };
  }
}));
