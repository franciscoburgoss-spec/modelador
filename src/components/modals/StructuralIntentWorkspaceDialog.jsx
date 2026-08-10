import { useEffect, useMemo, useRef, useState } from 'react';
import StructuralIntentVisualPreview from '../StructuralIntentVisualPreview.jsx';
import StructuralInterfacesPanel from '../StructuralInterfacesPanel.jsx';
import { useModelStore } from '../../store/useModelStore.js';
import {
  STRUCTURAL_INTENT_WORKSPACE_TABS,
  buildElementIntentDraft,
  buildRoofIntentDraft,
  buildStructuralIntentWorkspace,
  prepareElementIntentBatch,
  prepareElementIntentBatchRemoval,
  structuralIntentIdToken,
  validatePreparedElementIntentBatch,
  validateElementDraft,
  validateRoofDraft
} from '../../core/structuralIntentWorkspace.js';
import { StructuralConceptHint } from '../StructuralConceptHelp.jsx';
import { structuralConceptOptions } from '../../core/structuralConceptGlossary.js';
import {
  buildStructuralIntentVisualPreview,
  compareVisualFingerprintSnapshot,
  visualFingerprintSnapshot
} from '../../core/structuralIntentVisualPresentation.js';

const TAB_LABELS = {
  summary: 'Resumen',
  elements: 'Muros y elementos',
  roof: 'Techumbre',
  interfaces: 'Interfaces',
  intersections: 'Encuentros',
  diaphragms: 'Diafragmas',
  pending: 'Pendientes',
  trace: 'Trazabilidad'
};

const STATE_LABELS = {
  declared: 'Declarado',
  undefined: 'No definido',
  invalid: 'Inválido',
  brokenReference: 'Referencia rota',
  stale: 'Geometría stale'
};

const PARTICIPATION_LABELS = {
  resistant: 'Participación resistente prevista',
  secondary: 'Participación secundaria prevista',
  undetermined: 'Participación indeterminada declarada'
};

const FUNCTION_LABELS = {
  gravityResistance: 'Resistencia gravitacional',
  inPlaneLateralResistance: 'Resistencia lateral en el plano',
  loadTransfer: 'Transferencia de cargas',
  diaphragmAction: 'Acción de diafragma',
  collectorAction: 'Acción de colector',
  support: 'Apoyo',
  stabilization: 'Estabilización',
  spaceDivision: 'División de espacios',
  buildingEnvelope: 'Envolvente del edificio'
};

const SECONDARY_LABELS = {
  solidary: 'Solidario',
  floating: 'Flotante',
  undetermined: 'Interacción indeterminada',
  notApplicable: 'No aplicable'
};

const ROOF_DISTRIBUTION_LABELS = Object.fromEntries(
  structuralConceptOptions('roofDistribution').map(({ value, label }) => [value, label])
);

const DIAPHRAGM_LABELS = Object.fromEntries(
  structuralConceptOptions('diaphragmBehavior').map(({ value, label }) => [value, label])
);

const BOUNDARY_LABELS = Object.fromEntries(
  structuralConceptOptions('roofBoundary').map(({ value, label }) => [value, label])
);

function focusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function stateBadge(state) {
  return (
    <span className="inline-flex rounded-full border border-[#d8d8d3] px-2 py-0.5 text-xs">
      {STATE_LABELS[state] || state}
    </span>
  );
}

function ErrorSummary({ validation }) {
  if (!validation || validation.ok) return null;
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <strong>No se guardó la declaración.</strong>
      <ul className="mt-1 list-disc pl-5">
        {validation.issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>{issue.message} <code>{issue.code}</code></li>
        ))}
      </ul>
    </div>
  );
}

function FieldErrors({ validation, field, id }) {
  const errors = validation?.fields?.[field] || [];
  if (errors.length === 0) return null;
  return (
    <ul id={id} className="mt-1 list-disc pl-5 text-xs text-red-700">
      {errors.map((error, index) => <li key={`${error.code}-${index}`}>{error.message} <code>{error.code}</code></li>)}
    </ul>
  );
}

function validationHasField(validation, field) {
  return (validation?.fields?.[field]?.length || 0) > 0;
}

function toValidationIssues(error) {
  if (Array.isArray(error?.details) && error.details.length > 0) return error.details;
  return [{ code: error?.code || 'SI-UNEXPECTED', message: error?.message || 'Error inesperado.' }];
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function DraftComparison({ previous, next }) {
  return (
    <details className="rounded border border-amber-300 bg-amber-50 p-3 text-sm" open>
      <summary className="cursor-pointer font-semibold">Revisión de diferencias</summary>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div><strong>Vigente</strong><pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-xs">{JSON.stringify(previous, null, 2)}</pre></div>
        <div><strong>Borrador</strong><pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-xs">{JSON.stringify(next, null, 2)}</pre></div>
      </div>
    </details>
  );
}

function ElementForm({ draft, setDraft, validation, disabled = false }) {
  if (!draft) return <p className="text-sm text-[#6b6b66]">Seleccione un elemento para revisar su declaración.</p>;
  const toggleFunction = (value) => setDraft((current) => ({
    ...current,
    functions: current.functions.includes(value)
      ? current.functions.filter((item) => item !== value)
      : [...current.functions, value]
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Elemento {String(draft.elementId)}</h3>
          <p className="text-xs text-[#6b6b66]">La geometría sólo sirve como referencia visual.</p>
        </div>
        {stateBadge(validation?.state || draft.state)}
      </div>
      <ErrorSummary validation={validation} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Participación prevista</span>
        <select
          id="structural-intent-element-participation"
          aria-invalid={validation?.fields?.participation?.length > 0}
          aria-describedby={validation?.fields?.participation?.length ? 'structural-intent-element-participation-errors' : undefined}
          className="w-full rounded border border-[#d8d8d3] px-2 py-1.5"
          disabled={disabled}
          value={draft.participation}
          onChange={(event) => setDraft((current) => {
            const participation = event.target.value;
            return {
              ...current,
              participation,
              secondaryInteraction: participation === 'secondary'
                ? (current.secondaryInteraction === 'notApplicable' ? 'undetermined' : current.secondaryInteraction)
                : 'notApplicable'
            };
          })}
        >
          <option value="">Seleccione…</option>
          {Object.entries(PARTICIPATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <FieldErrors validation={validation} field="participation" id="structural-intent-element-participation-errors" />
      </label>
      <fieldset
        disabled={disabled}
        aria-invalid={validation?.fields?.functions?.length > 0}
        aria-describedby={validation?.fields?.functions?.length ? 'structural-intent-element-functions-errors' : undefined}
      >
        <legend className="mb-1 text-sm font-medium">Funciones previstas</legend>
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
          {Object.entries(FUNCTION_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.functions.includes(value)}
                onChange={() => toggleFunction(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <FieldErrors validation={validation} field="functions" id="structural-intent-element-functions-errors" />
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Interacción secundaria</span>
        <select
          id="structural-intent-element-secondary"
          aria-invalid={validation?.fields?.secondaryInteraction?.length > 0}
          aria-describedby={validation?.fields?.secondaryInteraction?.length ? 'structural-intent-element-secondary-errors' : undefined}
          className="w-full rounded border border-[#d8d8d3] px-2 py-1.5"
          disabled={disabled}
          value={draft.secondaryInteraction}
          onChange={(event) => setDraft((current) => ({ ...current, secondaryInteraction: event.target.value }))}
        >
          {Object.entries(SECONDARY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <FieldErrors validation={validation} field="secondaryInteraction" id="structural-intent-element-secondary-errors" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notas</span>
        <textarea
          id="structural-intent-element-notes"
          aria-invalid={validation?.fields?.notes?.length > 0}
          aria-describedby={validation?.fields?.notes?.length ? 'structural-intent-element-notes-errors' : undefined}
          className="min-h-20 w-full rounded border border-[#d8d8d3] px-2 py-1.5"
          disabled={disabled}
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
        />
        <FieldErrors validation={validation} field="notes" id="structural-intent-element-notes-errors" />
      </label>
    </div>
  );
}

function RoofPolygon({ polygon, boundaries, planContext }) {
  if (!polygon?.length) return null;
  const xs = polygon.map((point) => Number(point.x));
  const ys = polygon.map((point) => Number(point.y));
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1); const spanY = Math.max(maxY - minY, 1);
  const padWorld = Math.max(Math.max(spanX, spanY) * 0.08, 250);
  const world = {
    xMin: minX - padWorld, xMax: maxX + padWorld,
    yMin: minY - padWorld, yMax: maxY + padWorld
  };
  const canvas = { x: 56, y: 38, width: 540, height: 260 };
  const scale = Math.min(
    canvas.width / Math.max(world.xMax - world.xMin, 1),
    canvas.height / Math.max(world.yMax - world.yMin, 1)
  );
  const usedWidth = (world.xMax - world.xMin) * scale;
  const usedHeight = (world.yMax - world.yMin) * scale;
  const slackX = (canvas.width - usedWidth) / 2;
  const slackY = (canvas.height - usedHeight) / 2;
  const project = (point) => ({
    x: canvas.x + slackX + (Number(point.x) - world.xMin) * scale,
    // Planta del modelador: Y mundo crece hacia abajo en pantalla.
    y: canvas.y + slackY + (Number(point.y) - world.yMin) * scale
  });
  const points = polygon.map((point) => {
    const projected = project(point);
    return `${projected.x},${projected.y}`;
  }).join(' ');
  const axisSummary = planContext?.descriptor?.primary || 'sin ejes nominales';
  return (
    <svg
      viewBox="0 0 640 340"
      className="h-64 w-full rounded border border-[#d8d8d3] bg-white"
      role="img"
      aria-label={`Planta contextual de cubierta. ${axisSummary}. Misma orientación y proporción X/Y que la planta del proyecto.`}
    >
      <rect x="0" y="0" width="640" height="340" fill="#ffffff" />
      {(planContext?.axes?.x || []).map((axis) => {
        const a = project({ x: axis.coordinate, y: world.yMin });
        const b = project({ x: axis.coordinate, y: world.yMax });
        return (
          <g key={`x-${String(axis.id)}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#78909c" strokeWidth="1" strokeDasharray="5 4" />
            <circle cx={a.x} cy="22" r="11" fill="#ffffff" stroke="#36566f" strokeWidth="1.5" />
            <text x={a.x} y="26" fontSize="10" fontWeight="700" textAnchor="middle" fill="#263746">{axis.label}</text>
          </g>
        );
      })}
      {(planContext?.axes?.y || []).map((axis) => {
        const a = project({ x: world.xMin, y: axis.coordinate });
        const b = project({ x: world.xMax, y: axis.coordinate });
        return (
          <g key={`y-${String(axis.id)}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#78909c" strokeWidth="1" strokeDasharray="5 4" />
            <circle cx="24" cy={a.y} r="11" fill="#ffffff" stroke="#36566f" strokeWidth="1.5" />
            <text x="24" y={a.y + 4} fontSize="10" fontWeight="700" textAnchor="middle" fill="#263746">{axis.label}</text>
          </g>
        );
      })}
      <polygon points={points} fill="rgba(47,93,80,0.10)" stroke="#55554f" strokeWidth="2" />
      {boundaries.map((boundary) => {
        const startPoint = project(boundary.start); const endPoint = project(boundary.end);
        const dx = endPoint.x - startPoint.x; const dy = endPoint.y - startPoint.y;
        const length = Math.hypot(dx, dy) || 1;
        const labelOffsetX = -dy / length * 10;
        const labelOffsetY = dx / length * 10;
        return (
          <g key={boundary.boundaryId}>
            <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke="#2f5d50" strokeWidth="4" />
            <text
              x={(startPoint.x + endPoint.x) / 2 + labelOffsetX}
              y={(startPoint.y + endPoint.y) / 2 + labelOffsetY + 4}
              fontSize="12"
              fontWeight="700"
              textAnchor="middle"
              fill="#1f3f36"
            >{boundary.label}</text>
          </g>
        );
      })}
      <text x="612" y="326" fontSize="10" textAnchor="end" fill="#6b6b66">Misma orientación X/Y que Planta</text>
    </svg>
  );
}

function ConfirmPanel({ title, children, onConfirm, onCancel, confirmLabel = 'Confirmar', confirmDisabled = false }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="structural-intent-confirm-title" className="absolute inset-6 z-20 flex items-center justify-center rounded bg-black/30 p-4">
      <div className="w-full max-w-lg rounded bg-white p-5 shadow-xl">
        <h3 id="structural-intent-confirm-title" className="font-semibold">{title}</h3>
        <div className="mt-3 max-h-72 overflow-auto text-sm">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button autoFocus className="rounded border px-3 py-1.5" onClick={onCancel}>Cancelar</button>
          <button
            className="rounded bg-[#2f5d50] px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function StructuralIntentWorkspaceDialog({ open, onClose, initialTab = null }) {
  const model = useModelStore((state) => state.model);
  const setElementIntent = useModelStore((state) => state.setElementIntent);
  const removeElementIntent = useModelStore((state) => state.removeElementIntent);
  const setElementIntentsBatch = useModelStore((state) => state.setElementIntentsBatch);
  const removeElementIntentsBatch = useModelStore((state) => state.removeElementIntentsBatch);
  const setRoofIntent = useModelStore((state) => state.setRoofIntent);
  const removeRoofIntent = useModelStore((state) => state.removeRoofIntent);
  const structuralIntentLocator = useModelStore((state) => state.structuralIntentLocator);
  const openStructuralIntentLocator = useModelStore((state) => state.openStructuralIntentLocator);
  const setStructuralIntentLocatorActive = useModelStore((state) => state.setStructuralIntentLocatorActive);
  const setStructuralIntentLocatorHover = useModelStore((state) => state.setStructuralIntentLocatorHover);
  const clearStructuralIntentLocatorRequest = useModelStore((state) => state.clearStructuralIntentLocatorRequest);
  const fitStructuralIntentLocator = useModelStore((state) => state.fitStructuralIntentLocator);
  const closeStructuralIntentLocator = useModelStore((state) => state.closeStructuralIntentLocator);
  const dialogRef = useRef(null);
  const locatorRef = useRef(null);
  const openerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedTokens, setSelectedTokens] = useState(() => new Set());
  const [elementId, setElementId] = useState(null);
  const [elementDraft, setElementDraftState] = useState(null);
  const [elementValidation, setElementValidation] = useState(null);
  const [roofId, setRoofId] = useState(null);
  const [roofDraft, setRoofDraftState] = useState(null);
  const [roofValidation, setRoofValidation] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [filterWallsOnly, setFilterWallsOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [batchDraft, setBatchDraft] = useState({
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve', notes: null
  });
  const [unexpectedError, setUnexpectedError] = useState(null);
  const [batchActiveId, setBatchActiveId] = useState(null);
  const [visualHoverId, setVisualHoverId] = useState(null);

  useEffect(() => {
    if (open && initialTab && STRUCTURAL_INTENT_WORKSPACE_TABS.includes(initialTab)) setActiveTab(initialTab);
  }, [initialTab, open]);

  const workspace = useMemo(() => {
    try {
      return buildStructuralIntentWorkspace(model);
    } catch (error) {
      return { error, summary: {}, elementRows: [], roofRows: [], pending: [], traceEvents: [], inactiveViews: {}, visualPresentation: { targets: [], orphans: [] } };
    }
  }, [model]);

  const selectedIds = useMemo(() => workspace.elementRows
    .filter((row) => selectedTokens.has(row.idToken))
    .map((row) => row.id), [workspace.elementRows, selectedTokens]);
  const visualTargetIds = useMemo(() => (selectedIds.length > 0
    ? selectedIds
    : elementId !== null ? [elementId] : []), [selectedIds, elementId]);
  const elementVisualPreview = useMemo(() => {
    if (!workspace.visualPresentation || visualTargetIds.length === 0) return null;
    return buildStructuralIntentVisualPreview(workspace.visualPresentation, visualTargetIds, {
      activeId: batchActiveId ?? elementId ?? visualTargetIds[0]
    });
  }, [workspace.visualPresentation, visualTargetIds, batchActiveId, elementId]);

  const setElementDraft = (updater) => {
    setElementDraftState(updater);
    setDirty(true);
    setElementValidation(null);
  };
  const setRoofDraft = (updater) => {
    setRoofDraftState(updater);
    setDirty(true);
    setRoofValidation(null);
  };

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    setActiveTab('summary');
    setSelectedTokens(new Set());
    setElementId(null); setElementDraftState(null); setElementValidation(null);
    setRoofId(null); setRoofDraftState(null); setRoofValidation(null);
    setDirty(false); setConfirmation(null); setUnexpectedError(null);
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector('[role="tab"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) openerRef.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open || !dirty) return;
    if (elementDraft && elementId !== null) {
      const current = buildElementIntentDraft(model, elementId);
      if (!current.targetExists) {
        setElementValidation({
          ok: false,
          state: 'brokenReference',
          issues: [{ code: 'SI-VISUAL-TARGET-NOT-FOUND', message: 'El elemento desapareció. Se conserva el último descriptor del borrador.' }],
          fields: { target: [{ code: 'SI-VISUAL-TARGET-NOT-FOUND', message: 'Recargue la declaración o copie sus notas antes de descartarla.' }] }
        });
      } else if (current.previousIntentFingerprint !== elementDraft.previousIntentFingerprint) {
        setElementValidation({
          ok: false,
          state: 'brokenReference',
          issues: [{ code: 'SI-DRAFT-STALE', message: 'La declaración cambió mientras el borrador estaba abierto.' }],
          fields: { target: [{ code: 'SI-DRAFT-STALE', message: 'Recargue la declaración antes de continuar.' }] }
        });
      } else if (current.previousGeometryFingerprint !== elementDraft.previousGeometryFingerprint) {
        setElementValidation({
          ok: false,
          state: 'stale',
          issues: [{ code: 'SI-VISUAL-PREVIEW-STALE', message: 'La geometría cambió mientras el borrador estaba abierto.' }],
          fields: { target: [{ code: 'SI-VISUAL-PREVIEW-STALE', message: 'Recargue la geometría antes de guardar o localizar.' }] }
        });
      }
    }
    if (roofDraft && roofId !== null) {
      const current = buildRoofIntentDraft(model, roofId);
      if (!current.targetExists || current.previousFingerprint !== roofDraft.previousFingerprint) {
        setRoofValidation({
          ok: false,
          state: 'brokenReference',
          issues: [{ code: 'SI-DRAFT-STALE', message: 'La cubierta cambió mientras el borrador estaba abierto.' }]
        });
      }
    }
  }, [model, open, dirty, elementDraft, elementId, roofDraft, roofId]);

  useEffect(() => {
    const requestedId = structuralIntentLocator.requestedId;
    if (!open || !structuralIntentLocator.active || requestedId == null) return;
    const requestedTarget = structuralIntentLocator.preview?.selected?.find((target) => (
      structuralIntentIdToken(target.id) === structuralIntentIdToken(requestedId)
    ));
    clearStructuralIntentLocatorRequest();
    if (requestedTarget?.targetType === 'roof') {
      setStructuralIntentLocatorActive(requestedId);
      return;
    }
    if (dirty && elementId !== null && structuralIntentIdToken(requestedId) !== structuralIntentIdToken(elementId)) {
      setElementValidation({
        ok: false,
        state: elementValidation?.state || elementDraft?.state || 'declared',
        issues: [{ code: 'SI-DRAFT-TARGET-CHANGE-BLOCKED', message: 'El borrador actual bloquea el cambio de objetivo desde el viewport.' }],
        fields: { target: [{ code: 'SI-DRAFT-TARGET-CHANGE-BLOCKED', message: 'Guarde o descarte el borrador antes de activar otro elemento.' }] }
      });
      return;
    }
    setBatchActiveId(requestedId);
    setStructuralIntentLocatorActive(requestedId);
    if (!dirty) {
      setElementId(requestedId);
      setElementDraftState(buildElementIntentDraft(model, requestedId));
      setElementValidation(null);
    }
  }, [open, structuralIntentLocator.active, structuralIntentLocator.requestedId, structuralIntentLocator.preview, dirty, elementId, elementDraft, elementValidation, model, clearStructuralIntentLocatorRequest, setStructuralIntentLocatorActive]);

  const currentVisualReview = elementDraft?.visualSnapshot
    ? compareVisualFingerprintSnapshot(workspace.visualPresentation, elementDraft.visualSnapshot)
    : { ok: true, conflicts: [] };
  const dirtyBatchIncludesTarget = elementDraft && dirty && elementId !== null && selectedIds.length > 1
    && selectedIds.some((id) => structuralIntentIdToken(id) === structuralIntentIdToken(elementId));
  const staleVisual = !currentVisualReview.ok
    && currentVisualReview.conflicts.some((conflict) => conflict.code === 'SI-VISUAL-PREVIEW-STALE');
  const displayVisualPreview = elementDraft && dirty
    ? dirtyBatchIncludesTarget
      ? {
          ...elementVisualPreview,
          selected: (elementVisualPreview?.selected || []).map((target) => (
            structuralIntentIdToken(target.id) === structuralIntentIdToken(elementId)
              ? { ...elementDraft.visualTarget, mark: target.mark, active: target.active }
              : target
          )),
          stale: staleVisual
        }
      : { ...elementDraft.visualPreview, stale: staleVisual }
    : elementVisualPreview;
  const locateTargetIds = dirtyBatchIncludesTarget ? visualTargetIds
    : elementDraft && dirty && elementId !== null ? [elementId] : visualTargetIds;
  const elementReferenceBroken = elementDraft?.state === 'brokenReference'
    || elementValidation?.state === 'brokenReference';
  const locateBlocked = !displayVisualPreview?.canUse
    || elementValidation?.state === 'stale'
    || elementReferenceBroken
    || !currentVisualReview.ok;
  const locateBlockedReason = elementValidation?.state === 'stale'
    ? 'Recargue la geometría antes de localizar.'
    : elementValidation?.state === 'brokenReference'
      ? 'La referencia está rota.'
      : !currentVisualReview.ok ? 'La preview no coincide con la geometría vigente.' : null;

  const activateVisualTarget = (id) => {
    setBatchActiveId(id);
    if (structuralIntentLocator.active) setStructuralIntentLocatorActive(id);
    if (dirty && elementId !== null && structuralIntentIdToken(id) !== structuralIntentIdToken(elementId)) {
      setConfirmation({ type: 'switchElement', id });
      return;
    }
    setElementId(id);
    setElementDraftState(buildElementIntentDraft(model, id));
    setElementValidation(null);
    setDirty(false);
  };

  const startLocate = () => {
    if (!displayVisualPreview || locateBlocked) return;
    const preview = {
      ...displayVisualPreview,
      geometrySnapshot: visualFingerprintSnapshot(workspace.visualPresentation, locateTargetIds)
    };
    openStructuralIntentLocator({
      preview,
      activeId: batchActiveId ?? elementId ?? preview.activeId,
      sourceFocusId: 'structural-intent-locate-button'
    });
    requestAnimationFrame(() => fitStructuralIntentLocator());
  };


  const roofLocateBlocked = !roofDraft?.visualPreview?.canUse || roofValidation?.state === 'brokenReference';
  const startLocateRoof = () => {
    if (roofLocateBlocked || !roofDraft?.visualPreview) return;
    openStructuralIntentLocator({
      preview: roofDraft.visualPreview,
      activeId: roofDraft.roofGeometryId,
      sourceFocusId: 'structural-intent-roof-locate-button'
    });
    requestAnimationFrame(() => fitStructuralIntentLocator());
  };

  const reloadElementGeometry = () => {
    if (!elementDraft || elementId === null) return;
    const latestModel = useModelStore.getState().model;
    const current = buildElementIntentDraft(latestModel, elementId);
    if (current.previousIntentFingerprint !== elementDraft.previousIntentFingerprint) {
      setElementValidation({
        ok: false,
        state: 'brokenReference',
        issues: [{ code: 'SI-DRAFT-STALE', message: 'La intención también cambió; no se puede conservar automáticamente el borrador.' }],
        fields: { target: [{ code: 'SI-DRAFT-STALE', message: 'Recargue la declaración o copie las notas antes de descartarla.' }] }
      });
      return;
    }
    setElementDraftState({
      ...elementDraft,
      targetExists: current.targetExists,
      previousGeometryFingerprint: current.previousGeometryFingerprint,
      visualSnapshot: current.visualSnapshot,
      visualPreview: current.visualPreview,
      lastVisualDescriptor: current.lastVisualDescriptor,
      visualTarget: current.visualTarget,
      state: current.state
    });
    setElementValidation(null);
  };

  const finishLocate = (restoreView) => {
    const sourceFocusId = structuralIntentLocator.sourceFocusId;
    closeStructuralIntentLocator({ restoreView });
    requestAnimationFrame(() => document.getElementById(sourceFocusId)?.focus());
  };

  useEffect(() => {
    if (!open || !structuralIntentLocator.active) return;
    const frame = requestAnimationFrame(() => {
      locatorRef.current?.querySelector('button:not([disabled])')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, structuralIntentLocator.active]);

  if (!open) return null;

  const structuralIntentLocatorDialog = structuralIntentLocator.active ? (() => {
    const activeTarget = structuralIntentLocator.preview?.selected?.find((target) => structuralIntentIdToken(target.id) === structuralIntentIdToken(structuralIntentLocator.activeId));
    return (
      <aside
        ref={locatorRef}
        role="dialog"
        aria-modal="false"
        aria-label="Localizador de intención estructural"
        className="fixed right-4 top-4 z-50 w-[min(92vw,430px)] rounded-lg border-2 border-[#2f5d50] bg-white p-4 shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            finishLocate(true);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{activeTarget?.targetType === 'roof' ? 'Localizando cubierta' : `Localizando ${activeTarget?.mark || 'T'}`}</h2>
            <p className="mt-1 text-xs text-[#6b6b66]">{activeTarget?.descriptor?.summary || `ID ${String(structuralIntentLocator.activeId)}`}</p>
          </div>
          <span className="rounded border px-2 py-1 text-xs">Vista temporal</span>
        </div>
        <p className="mt-3 text-sm">Pase el cursor o haga clic sobre los objetivos marcados en la planta. La selección global del modelo permanece intacta.</p>
        {activeTarget?.targetType !== 'roof' && elementValidation && !elementValidation.ok && <ErrorSummary validation={elementValidation} />}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="rounded border px-3 py-1.5 text-sm" onClick={() => fitStructuralIntentLocator()}>Encuadrar</button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={() => finishLocate(true)}>Restaurar vista</button>
          <button className="rounded bg-[#2f5d50] px-3 py-1.5 text-sm text-white" onClick={() => finishLocate(false)}>Conservar vista</button>
        </div>
        <div className="sr-only" aria-live="polite">Objetivo activo {activeTarget?.mark || 'T'}, ID {String(structuralIntentLocator.activeId)}.</div>
      </aside>
    );
  })() : null;

  const visibleRows = workspace.elementRows.filter((row) => (
    (!filterWallsOnly || row.type === 'wall' || row.state === 'brokenReference')
    && (!search || `${String(row.id)} ${row.descriptor?.summary || ''}`.toLowerCase().includes(search.toLowerCase()))
  ));

  const discardDrafts = () => {
    try {
      setElementDraftState(elementId !== null ? buildElementIntentDraft(model, elementId) : null);
      setRoofDraftState(roofId !== null ? buildRoofIntentDraft(model, roofId) : null);
      setElementValidation(null);
      setRoofValidation(null);
    } catch (error) {
      setElementDraftState(null);
      setRoofDraftState(null);
      setUnexpectedError(error);
    }
    setDirty(false);
  };

  const activateTab = (tab) => {
    if (tab === activeTab) return;
    if (dirty) setConfirmation({ type: 'switchTab', tab });
    else setActiveTab(tab);
  };

  const requestClose = () => {
    if (dirty) setConfirmation({ type: 'close' });
    else onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (confirmation) setConfirmation(null);
      else requestClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusRoot = confirmation
        ? dialogRef.current?.querySelector('[role="alertdialog"]')
        : dialogRef.current;
      const focusable = focusableElements(focusRoot);
      if (focusable.length === 0) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  };

  const handleTabKey = (event, index) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % STRUCTURAL_INTENT_WORKSPACE_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + STRUCTURAL_INTENT_WORKSPACE_TABS.length) % STRUCTURAL_INTENT_WORKSPACE_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = STRUCTURAL_INTENT_WORKSPACE_TABS.length - 1;
    else return;
    event.preventDefault();
    const tab = STRUCTURAL_INTENT_WORKSPACE_TABS[next];
    activateTab(tab);
    if (!dirty) dialogRef.current?.querySelector(`#structural-intent-tab-${tab}`)?.focus();
  };

  const openElement = (id) => {
    activateVisualTarget(id);
  };

  const saveElement = () => {
    const latestModel = useModelStore.getState().model;
    const validation = validateElementDraft(latestModel, elementId, elementDraft);
    setElementValidation(validation);
    if (!validation.ok || validation.noOp) {
      if (validation.noOp) setDirty(false);
      return;
    }
    try {
      setElementIntent(elementId, validation.input);
      setDirty(false);
      setElementValidation(null);
      setElementDraftState(buildElementIntentDraft(useModelStore.getState().model, elementId));
    } catch (error) {
      setUnexpectedError(error);
    }
  };

  const openRoof = (id) => {
    if (dirty && id !== roofId) {
      setConfirmation({ type: 'switchRoof', id });
      return;
    }
    setRoofId(id);
    setRoofDraftState(buildRoofIntentDraft(model, id));
    setRoofValidation(null);
    setDirty(false);
  };

  const saveRoof = () => {
    const latestModel = useModelStore.getState().model;
    const validation = validateRoofDraft(latestModel, roofId, roofDraft);
    setRoofValidation(validation);
    if (!validation.ok || validation.noOp) {
      if (validation.noOp) setDirty(false);
      return;
    }
    try {
      setRoofIntent(roofId, validation.input);
      setDirty(false);
      setRoofValidation(null);
      setRoofDraftState(buildRoofIntentDraft(useModelStore.getState().model, roofId));
    } catch (error) {
      setUnexpectedError(error);
    }
  };

  const previewBatch = () => setConfirmation({
    type: 'batchSet',
    preview: prepareElementIntentBatch(model, selectedIds, batchDraft)
  });
  const previewBatchRemoval = () => setConfirmation({
    type: 'batchRemove',
    preview: prepareElementIntentBatchRemoval(model, selectedIds)
  });

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Elementos', workspace.summary.elementsTotal],
          ['Muros', workspace.summary.wallsTotal],
          ['Cubiertas', workspace.summary.roofsTotal],
          ['Operaciones', workspace.summary.userOperations]
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-[#e4e4e0] p-3">
            <div className="text-xs text-[#6b6b66]">{label}</div>
            <div className="text-2xl font-semibold">{value ?? '—'}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-[#e4e4e0] p-3 text-sm">
          <strong>Elementos</strong>
          <p>{workspace.summary.elementsDeclared} declarados · {workspace.summary.elementsUndefined} no definidos</p>
        </div>
        <div className="rounded border border-[#e4e4e0] p-3 text-sm">
          <strong>Techumbre</strong>
          <p>{workspace.summary.roofsDeclared} declaradas · {workspace.summary.roofsUndefined} no definidas</p>
        </div>
      </div>
      <button className="rounded bg-[#2f5d50] px-3 py-2 text-white" onClick={() => activateTab('elements')}>Revisar declaraciones</button>
    </div>
  );

  const renderElements = () => (
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[1.1fr_1fr]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Buscar por ID"
            className="min-w-48 flex-1 rounded border border-[#d8d8d3] px-2 py-1.5"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ID, eje o coordenada"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filterWallsOnly} onChange={(event) => setFilterWallsOnly(event.target.checked)} />
            Sólo muros
          </label>
          <button disabled={dirty} title={dirty ? 'Guarde o descarte el borrador antes de cambiar el lote.' : undefined} className="rounded border px-2 py-1.5 text-sm disabled:opacity-50" onClick={() => { setSelectedTokens(new Set(visibleRows.map((row) => row.idToken))); setBatchActiveId(visibleRows[0]?.id ?? null); }}>Seleccionar visibles</button>
          <button disabled={dirty} className="rounded border px-2 py-1.5 text-sm disabled:opacity-50" onClick={() => { setSelectedTokens(new Set()); setBatchActiveId(null); }}>Limpiar selección</button>
        </div>
        <div className="max-h-80 overflow-auto rounded border border-[#e4e4e0]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f7f7f4]"><tr><th className="p-2">Sel.</th><th>Identificación</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const active = elementId !== null && structuralIntentIdToken(elementId) === row.idToken;
                return (
                  <tr
                    key={row.idToken}
                    aria-current={active ? 'true' : undefined}
                    className={`border-t border-[#eeeeea] ${active ? 'bg-[#eef4f0]' : ''}`}
                    onMouseEnter={() => setVisualHoverId(row.id)}
                    onMouseLeave={() => setVisualHoverId(null)}
                  >
                    <td className="p-2"><input
                      aria-label={`Seleccionar ${String(row.id)}`}
                      type="checkbox"
                      disabled={dirty}
                      checked={selectedTokens.has(row.idToken)}
                      onChange={() => setSelectedTokens((current) => {
                        const next = new Set(current);
                        if (next.has(row.idToken)) next.delete(row.idToken); else next.add(row.idToken);
                        const ids = workspace.elementRows.filter((item) => next.has(item.idToken)).map((item) => item.id);
                        setBatchActiveId(ids[0] ?? null);
                        return next;
                      })}
                    /></td>
                    <td className="max-w-[26rem] py-2 pr-2">
                      <div className="flex items-center gap-2"><code>{String(row.id)}</code><span className="rounded border px-1.5 py-0.5 text-[10px] uppercase">{row.type}</span></div>
                      <p className="mt-1 line-clamp-2 text-xs text-[#6b6b66]" title={row.descriptor?.summary}>{row.descriptor?.summary || 'Sin descriptor geométrico.'}</p>
                    </td>
                    <td>{STATE_LABELS[row.state]}</td>
                    <td className="p-1 text-right"><button className="rounded border px-2 py-1" onClick={() => openElement(row.id)}>{active ? 'Abierto' : 'Editar'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selectedIds.length > 0 && (
          <div className="space-y-2 rounded border border-[#d8d8d3] bg-[#fafaf7] p-3">
            <strong className="text-sm">Asignación masiva: {selectedIds.length} seleccionados</strong>
            <div className="grid gap-2 md:grid-cols-2">
              <select aria-label="Participación masiva" className="rounded border px-2 py-1.5" value={batchDraft.participation} onChange={(event) => setBatchDraft((current) => ({ ...current, participation: event.target.value }))}>
                {Object.entries(PARTICIPATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Interacción masiva" className="rounded border px-2 py-1.5" value={batchDraft.secondaryInteraction} onChange={(event) => setBatchDraft((current) => ({ ...current, secondaryInteraction: event.target.value }))}>
                {Object.entries(SECONDARY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={batchDraft.functions.includes('spaceDivision')} onChange={(event) => setBatchDraft((current) => ({ ...current, functions: event.target.checked ? ['spaceDivision'] : [] }))} />División de espacios</label>
            <label className="block text-sm">Política de notas <select className="ml-2 rounded border px-2 py-1" value={batchDraft.notesMode} onChange={(event) => setBatchDraft((current) => ({ ...current, notesMode: event.target.value }))}><option value="preserve">Preservar</option><option value="replace">Reemplazar</option></select></label>
            <div className="flex gap-2">
              <button className="rounded bg-[#2f5d50] px-3 py-1.5 text-sm text-white" onClick={previewBatch}>Previsualizar asignación</button>
              <button className="rounded border px-3 py-1.5 text-sm" onClick={previewBatchRemoval}>Previsualizar eliminación</button>
            </div>
          </div>
        )}
      </section>
      <section className="space-y-4 rounded border border-[#e4e4e0] p-4">
        <StructuralIntentVisualPreview
          preview={displayVisualPreview}
          activeId={batchActiveId ?? elementId}
          onActivate={activateVisualTarget}
          hoveredId={visualHoverId}
          onHover={(id) => { setVisualHoverId(id); setStructuralIntentLocatorHover(id); }}
          onLocate={startLocate}
          locateButtonId="structural-intent-locate-button"
          locateDisabled={locateBlocked}
          locateDisabledReason={locateBlockedReason}
          title={selectedIds.length > 0 ? 'Preview del lote' : 'Identificación del elemento'}
        />
        {elementValidation?.state === 'stale' && <div className="flex items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><span>La preview conserva la geometría con la que se abrió el borrador.</span><button className="rounded border border-amber-500 bg-white px-2 py-1" onClick={reloadElementGeometry}>Recargar geometría</button></div>}
        <ElementForm draft={elementDraft} setDraft={setElementDraft} validation={elementValidation} disabled={elementReferenceBroken} />
        {elementDraft && dirty && (
          <DraftComparison
            previous={elementDraft.sourceIntent}
            next={{
              participation: elementDraft.participation,
              functions: elementDraft.functions,
              secondaryInteraction: elementDraft.secondaryInteraction,
              notes: elementDraft.notes || null
            }}
          />
        )}
        {elementDraft && (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            {elementDraft.sourceIntent && <button disabled={elementReferenceBroken} className="rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50" onClick={() => setConfirmation({ type: 'deleteElement' })}>Eliminar declaración</button>}
            <button className="rounded border px-3 py-1.5" onClick={() => { setElementDraftState(buildElementIntentDraft(model, elementId)); setElementValidation(null); setDirty(false); }}>Descartar borrador</button>
            <button disabled={elementValidation?.state === 'stale' || elementReferenceBroken} className="rounded bg-[#2f5d50] px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={saveElement}>{elementDraft.sourceIntent ? 'Guardar cambios' : 'Declarar'}</button>
          </div>
        )}
      </section>
    </div>
  );

  const renderRoof = () => (
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded border border-[#e4e4e0]">
        <h3 className="border-b p-3 font-semibold">Cubiertas ({workspace.roofRows.length})</h3>
        <div className="max-h-[460px] overflow-auto">
          {workspace.roofRows.map((row) => {
            const active = roofId !== null && structuralIntentIdToken(roofId) === row.idToken;
            return (
              <button
                key={row.idToken}
                aria-current={active ? 'true' : undefined}
                aria-label={`Abrir cubierta. ${row.descriptor?.summary || String(row.id)}`}
                className={`flex w-full items-start justify-between gap-3 border-b p-3 text-left hover:bg-[#f7f7f4] ${active ? 'bg-[#eef4f0]' : ''}`}
                onClick={() => openRoof(row.id)}
              >
                <span className="min-w-0">
                  <strong className="block text-sm font-medium">{row.descriptor?.primary || `Cubierta ${String(row.id)}`}</strong>
                  <span className="mt-1 block text-xs text-[#6b6b66]">{row.boundaries.length} bordes · referencia técnica <code>{String(row.id)}</code></span>
                </span>
                {stateBadge(row.state)}
              </button>
            );
          })}
        </div>
      </section>
      <section className="space-y-4 rounded border border-[#e4e4e0] p-4">
        {!roofDraft ? <p className="text-sm text-[#6b6b66]">Seleccione una cubierta.</p> : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Cubierta · {roofDraft.planContext?.descriptor?.primary || 'sin descriptor geométrico'}</h3>
                <p className="mt-1 text-xs text-[#6b6b66]">Referencia técnica <code>{String(roofDraft.roofGeometryId)}</code></p>
              </div>
              <div className="flex items-center gap-2">
                {stateBadge(roofValidation?.state || roofDraft.state)}
                <button
                  id="structural-intent-roof-locate-button"
                  className="rounded border border-[#2f5d50] px-3 py-1.5 text-sm text-[#23483e] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={roofLocateBlocked}
                  title={roofLocateBlocked ? 'La cubierta no tiene una geometría localizable vigente.' : 'Mostrar esta cubierta en la planta real del proyecto.'}
                  onClick={startLocateRoof}
                >Localizar cubierta</button>
              </div>
            </div>
            <ErrorSummary validation={roofValidation} />
            <RoofPolygon polygon={roofDraft.polygon} boundaries={roofDraft.boundaryIntents} planContext={roofDraft.planContext} />
            <p className="rounded border border-[#e4e4e0] bg-[#fafaf7] p-2 text-xs text-[#5c5c57]">
              El preview conserva la orientación y proporción X/Y de Planta. Sólo se dibujan los ejes nominales que intervienen en los vértices del faldón; B1…Bn mantienen su borde canónico.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">Distribución
                <select
                  id="structural-intent-roof-distribution"
                  aria-invalid={validationHasField(roofValidation, 'loadDistribution')}
                  aria-describedby={validationHasField(roofValidation, 'loadDistribution') ? 'structural-intent-roof-distribution-errors' : undefined}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={roofDraft.loadDistribution}
                  onChange={(event) => setRoofDraft((current) => {
                    const loadDistribution = event.target.value;
                    return {
                      ...current,
                      loadDistribution,
                      primaryResistanceDirection: loadDistribution === 'oneWay' || loadDistribution === 'twoWay' ? (current.primaryResistanceDirection || { x: 1, y: 0 }) : null,
                      secondaryResistanceDirection: loadDistribution === 'twoWay' ? (current.secondaryResistanceDirection || { x: 0, y: 1 }) : null
                    };
                  })}
                >{Object.entries(ROOF_DISTRIBUTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <FieldErrors validation={roofValidation} field="loadDistribution" id="structural-intent-roof-distribution-errors" />
                <StructuralConceptHint scope="roofDistribution" value={roofDraft.loadDistribution} compact />
              </label>
              <label className="text-sm">Comportamiento de diafragma
                <select
                  id="structural-intent-roof-diaphragm"
                  aria-invalid={validationHasField(roofValidation, 'diaphragmBehavior')}
                  aria-describedby={validationHasField(roofValidation, 'diaphragmBehavior') ? 'structural-intent-roof-diaphragm-errors' : undefined}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={roofDraft.diaphragmBehavior}
                  onChange={(event) => setRoofDraft((current) => ({ ...current, diaphragmBehavior: event.target.value }))}
                >{Object.entries(DIAPHRAGM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <FieldErrors validation={roofValidation} field="diaphragmBehavior" id="structural-intent-roof-diaphragm-errors" />
                <StructuralConceptHint scope="diaphragmBehavior" value={roofDraft.diaphragmBehavior} compact />
              </label>
              {(roofDraft.loadDistribution === 'oneWay' || roofDraft.loadDistribution === 'twoWay') && <label className="text-sm">Dirección primaria
                <select
                  id="structural-intent-roof-primary-direction"
                  aria-invalid={validationHasField(roofValidation, 'primaryResistanceDirection')}
                  aria-describedby={validationHasField(roofValidation, 'primaryResistanceDirection') ? 'structural-intent-roof-primary-direction-errors' : undefined}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={roofDraft.primaryResistanceDirection?.x === 1 ? 'x' : 'y'}
                  onChange={(event) => setRoofDraft((current) => ({ ...current, primaryResistanceDirection: event.target.value === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 } }))}
                ><option value="x">Eje X</option><option value="y">Eje Y</option></select>
                <FieldErrors validation={roofValidation} field="primaryResistanceDirection" id="structural-intent-roof-primary-direction-errors" />
              </label>}
              {roofDraft.loadDistribution === 'twoWay' && <label className="text-sm">Dirección secundaria
                <select
                  id="structural-intent-roof-secondary-direction"
                  aria-invalid={validationHasField(roofValidation, 'secondaryResistanceDirection')}
                  aria-describedby={validationHasField(roofValidation, 'secondaryResistanceDirection') ? 'structural-intent-roof-secondary-direction-errors' : undefined}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={roofDraft.secondaryResistanceDirection?.x === 1 ? 'x' : 'y'}
                  onChange={(event) => setRoofDraft((current) => ({ ...current, secondaryResistanceDirection: event.target.value === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 } }))}
                ><option value="x">Eje X</option><option value="y">Eje Y</option></select>
                <FieldErrors validation={roofValidation} field="secondaryResistanceDirection" id="structural-intent-roof-secondary-direction-errors" />
              </label>}
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Bordes canónicos</h4>
              {roofDraft.boundaryIntents.map((boundary, index) => (
                <div key={boundary.boundaryId} className="grid gap-2 rounded border p-2 md:grid-cols-[3rem_1fr_1.3fr] md:items-center">
                  <strong>{boundary.label}</strong>
                  <code className="truncate text-xs" title={boundary.boundaryId}>{boundary.boundaryId}</code>
                  <div>
                    <select
                      aria-label={`Función ${boundary.label}`}
                      aria-invalid={validationHasField(roofValidation, 'boundaryIntents')}
                      aria-describedby={validationHasField(roofValidation, 'boundaryIntents') ? 'structural-intent-roof-boundary-errors' : undefined}
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={boundary.function}
                      onChange={(event) => setRoofDraft((current) => ({
                        ...current,
                        boundaryIntents: current.boundaryIntents.map((item, itemIndex) => itemIndex === index ? { ...item, function: event.target.value } : item)
                      }))}
                    >{Object.entries(BOUNDARY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <StructuralConceptHint scope="roofBoundary" value={boundary.function} compact />
                  </div>
                </div>
              ))}
              <FieldErrors validation={roofValidation} field="boundaryIntents" id="structural-intent-roof-boundary-errors" />
            </div>
            <label className="block text-sm">Notas
              <textarea
                id="structural-intent-roof-notes"
                aria-invalid={validationHasField(roofValidation, 'notes')}
                aria-describedby={validationHasField(roofValidation, 'notes') ? 'structural-intent-roof-notes-errors' : undefined}
                className="mt-1 min-h-16 w-full rounded border px-2 py-1.5"
                value={roofDraft.notes}
                onChange={(event) => setRoofDraft((current) => ({ ...current, notes: event.target.value }))}
              />
              <FieldErrors validation={roofValidation} field="notes" id="structural-intent-roof-notes-errors" />
            </label>
            {dirty && (
              <DraftComparison
                previous={roofDraft.sourceIntent}
                next={{
                  loadDistribution: roofDraft.loadDistribution,
                  primaryResistanceDirection: roofDraft.primaryResistanceDirection,
                  secondaryResistanceDirection: roofDraft.secondaryResistanceDirection,
                  diaphragmBehavior: roofDraft.diaphragmBehavior,
                  boundaryIntents: roofDraft.boundaryIntents.map(({ boundaryId, function: boundaryFunction }) => ({ boundaryId, function: boundaryFunction })),
                  notes: roofDraft.notes || null
                }}
              />
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              {roofDraft.sourceIntent && <button className="rounded border border-red-300 px-3 py-1.5 text-red-700" onClick={() => setConfirmation({ type: 'deleteRoof' })}>Eliminar declaración</button>}
              <button className="rounded border px-3 py-1.5" onClick={() => { setRoofDraftState(buildRoofIntentDraft(model, roofId)); setRoofValidation(null); setDirty(false); }}>Descartar borrador</button>
              <button className="rounded bg-[#2f5d50] px-3 py-1.5 text-white" onClick={saveRoof}>{roofDraft.sourceIntent ? 'Guardar cambios' : 'Declarar'}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );

  const renderInactive = (key) => (
    <div className="rounded border border-dashed border-[#c8c8c2] p-8 text-center">
      <h3 className="font-semibold">{TAB_LABELS[key]}</h3>
      <p className="mt-2 text-sm text-[#6b6b66]">{workspace.inactiveViews[key]}</p>
      <button disabled className="mt-4 rounded border px-3 py-2">Edición no disponible</button>
    </div>
  );

  const renderPending = () => (
    <div className="space-y-3">
      {workspace.pending.map((item) => <div key={item.id} className="rounded border border-[#e4e4e0] p-3 text-sm"><strong>{item.code}</strong><p>{item.message}</p></div>)}
    </div>
  );

  const renderTrace = () => (
    <div className="space-y-3">
      {workspace.traceEvents.length === 0 && <p className="text-sm text-[#6b6b66]">Todavía no existen operaciones efectivas del usuario.</p>}
      {workspace.traceEvents.map((event) => (
        <article key={event.sequence} className="rounded border border-[#e4e4e0] p-3 text-sm">
          <div className="flex justify-between"><strong>Operación {event.sequence}</strong><code>{event.operation}</code></div>
          <p>{countLabel(event.changes.length, 'cambio', 'cambios')} sobre {event.targetType}.</p>
          <ul className="mt-1 space-y-2">{event.changes.map((change) => (
            <li key={`${change.targetType}-${structuralIntentIdToken(change.targetId)}`} className="rounded bg-[#f7f7f4] p-2">
              <div><code>{String(change.targetId)}</code> · {change.changeKind}</div>
              <div className="mt-1 grid gap-1 text-xs md:grid-cols-2">
                <span title={change.previousFingerprint}>Anterior: <code>{change.previousFingerprint.slice(0, 12)}…</code></span>
                <span title={change.nextFingerprint}>Nuevo: <code>{change.nextFingerprint.slice(0, 12)}…</code></span>
              </div>
            </li>
          ))}</ul>
        </article>
      ))}
      {workspace.pending.filter((item) => item.kind === 'finding').map((item) => <article key={item.id} className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"><strong>Reconciliación pendiente</strong><p>{item.message}</p></article>)}
    </div>
  );

  const panels = {
    summary: renderSummary,
    elements: renderElements,
    roof: renderRoof,
    interfaces: () => <StructuralInterfacesPanel workspace={workspace} />,
    intersections: () => renderInactive('intersections'),
    diaphragms: () => renderInactive('diaphragms'),
    pending: renderPending,
    trace: renderTrace
  };

  return (
    <>
      {structuralIntentLocatorDialog}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        style={structuralIntentLocator.active ? { display: 'none' } : undefined}
        onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="structural-intent-dialog-title"
        className="relative flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <header className="flex items-center justify-between border-b px-5 py-3">
          <div><h2 id="structural-intent-dialog-title" className="font-semibold">Intención estructural</h2><p className="text-xs text-[#6b6b66]">Intención declarada. No constituye comprobación de capacidad ni camino de cargas.</p></div>
          <button aria-label="Cerrar intención estructural" className="h-8 w-8 rounded hover:bg-[#f2f2ee]" onClick={requestClose}>×</button>
        </header>
        <nav role="tablist" aria-label="Secciones de intención estructural" className="flex overflow-x-auto border-b bg-[#fafaf7] px-3">
          {STRUCTURAL_INTENT_WORKSPACE_TABS.map((tab, index) => (
            <button
              id={`structural-intent-tab-${tab}`}
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`structural-intent-panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${activeTab === tab ? 'border-[#2f5d50] font-semibold' : 'border-transparent'}`}
              onClick={() => activateTab(tab)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >{TAB_LABELS[tab]}</button>
          ))}
        </nav>
        <main id={`structural-intent-panel-${activeTab}`} role="tabpanel" aria-labelledby={`structural-intent-tab-${activeTab}`} className="flex-1 overflow-auto p-5">
          {workspace.error ? <div role="alert">No fue posible construir el espacio de trabajo: {workspace.error.message}</div> : panels[activeTab]()}
          {unexpectedError && <div role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm">{unexpectedError.message} <code>{unexpectedError.code}</code></div>}
        </main>
        {confirmation?.type === 'close' && <ConfirmPanel title="¿Descartar cambios no guardados?" onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); setDirty(false); onClose(); }} confirmLabel="Descartar y cerrar"><p>El borrador no fue aplicado al proyecto.</p></ConfirmPanel>}
        {confirmation?.type === 'switchElement' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const id = confirmation.id; setConfirmation(null); setDirty(false); setBatchActiveId(id); setElementId(id); setElementDraftState(buildElementIntentDraft(model, id)); setElementValidation(null); }} confirmLabel="Descartar"><p>Se abrirá el elemento {String(confirmation.id)}.</p></ConfirmPanel>}
        {confirmation?.type === 'switchRoof' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const id = confirmation.id; setConfirmation(null); setDirty(false); setRoofId(id); setRoofDraftState(buildRoofIntentDraft(model, id)); }} confirmLabel="Descartar"><p>Se abrirá la cubierta {String(confirmation.id)}.</p></ConfirmPanel>}
        {confirmation?.type === 'switchTab' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const tab = confirmation.tab; setConfirmation(null); discardDrafts(); setActiveTab(tab); }} confirmLabel="Descartar y cambiar"><p>Se cambiará a {TAB_LABELS[confirmation.tab]} sin aplicar el borrador.</p></ConfirmPanel>}
        {confirmation?.type === 'deleteElement' && <ConfirmPanel title="Eliminar declaración" onCancel={() => setConfirmation(null)} onConfirm={() => {
          const latestModel = useModelStore.getState().model;
          const currentDraft = buildElementIntentDraft(latestModel, elementId);
          if (currentDraft.previousIntentFingerprint !== elementDraft.previousIntentFingerprint
            || currentDraft.previousGeometryFingerprint !== elementDraft.previousGeometryFingerprint) {
            setConfirmation(null);
            setElementValidation({ ok: false, state: 'brokenReference', issues: [{ code: 'SI-DRAFT-STALE', message: 'El elemento cambió mientras se confirmaba la eliminación.' }], fields: { target: [{ code: 'SI-DRAFT-STALE', message: 'Recargue la declaración antes de eliminar.' }] } });
            return;
          }
          removeElementIntent(elementId); setConfirmation(null); setDirty(false); setElementDraftState(buildElementIntentDraft(useModelStore.getState().model, elementId));
        }} confirmLabel="Eliminar"><p>Se eliminará sólo la declaración del elemento {String(elementId)}. La geometría permanece.</p></ConfirmPanel>}
        {confirmation?.type === 'deleteRoof' && <ConfirmPanel title="Eliminar declaración" onCancel={() => setConfirmation(null)} onConfirm={() => {
          const latestModel = useModelStore.getState().model;
          const currentDraft = buildRoofIntentDraft(latestModel, roofId);
          if (currentDraft.previousFingerprint !== roofDraft.previousFingerprint) {
            setConfirmation(null);
            setRoofValidation({ ok: false, state: 'brokenReference', issues: [{ code: 'SI-DRAFT-STALE', message: 'La cubierta cambió mientras se confirmaba la eliminación.' }], fields: { target: [{ code: 'SI-DRAFT-STALE', message: 'Recargue la declaración antes de eliminar.' }] } });
            return;
          }
          removeRoofIntent(roofId); setConfirmation(null); setDirty(false); setRoofDraftState(buildRoofIntentDraft(useModelStore.getState().model, roofId));
        }} confirmLabel="Eliminar"><p>Se eliminará sólo la declaración de la cubierta {String(roofId)}.</p></ConfirmPanel>}
        {(confirmation?.type === 'batchSet' || confirmation?.type === 'batchRemove') && <ConfirmPanel title={confirmation.type === 'batchSet' ? 'Confirmar asignación masiva' : 'Confirmar eliminación masiva'} onCancel={() => setConfirmation(null)} confirmDisabled={!confirmation.preview.canConfirm} onConfirm={() => {
          const preview = confirmation.preview;
          if (!preview.canConfirm) return;
          const latestModel = useModelStore.getState().model;
          const batchReview = validatePreparedElementIntentBatch(latestModel, preview);
          if (!batchReview.ok) {
            setConfirmation((current) => ({
              ...current,
              preview: { ...current.preview, canConfirm: false, conflicts: batchReview.conflicts, stale: batchReview.state === 'stale' }
            }));
            return;
          }
          try {
            if (confirmation.type === 'batchSet') setElementIntentsBatch(preview.selection, batchDraft, { expectedPrevious: preview.expectedPrevious });
            else removeElementIntentsBatch(preview.selection, { expectedPrevious: preview.expectedPrevious });
            setConfirmation(null); setSelectedTokens(new Set()); setBatchActiveId(null); setDirty(false);
          } catch (error) {
            setConfirmation((current) => ({
              ...current,
              preview: { ...current.preview, canConfirm: false, conflicts: toValidationIssues(error) }
            }));
          }
        }} confirmLabel={confirmation.type === 'batchSet'
          ? `Confirmar asignación a ${countLabel(confirmation.preview.selection.length, 'elemento', 'elementos')}`
          : `Confirmar eliminación de ${countLabel(confirmation.preview.selection.length, 'elemento', 'elementos')}`}>
          <StructuralIntentVisualPreview
            preview={{ ...confirmation.preview.visualPreview, stale: confirmation.preview.stale === true }}
            activeId={batchActiveId ?? confirmation.preview.visualPreview?.activeId}
            onActivate={setBatchActiveId}
            title="Preview masiva verificable"
          />
          <p className="mt-3">{countLabel(confirmation.preview.selection.length, 'seleccionado', 'seleccionados')} · {countLabel(confirmation.preview.effectiveChanges.length, 'cambio efectivo', 'cambios efectivos')}.</p>
          <p className="mt-1">Se creará un solo paso de historial y una operación de trazabilidad.</p>
          <h4 className="mt-3 font-semibold">Valores anteriores agrupados</h4>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-[#f7f7f4] p-2 text-xs">{JSON.stringify(confirmation.preview.previousGroups, null, 2)}</pre>
          <h4 className="mt-3 font-semibold">Valor nuevo y política de notas</h4>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-[#f7f7f4] p-2 text-xs">{JSON.stringify(confirmation.preview.nextDeclaration, null, 2)}</pre>
          {confirmation.preview.conflicts.length > 0 && <div role="alert" className="mt-2 rounded border border-red-300 p-2">{confirmation.preview.conflicts.map((item) => <p key={item.code}>{item.message} <code>{item.code}</code></p>)}</div>}
          <ul className="mt-2 list-disc pl-5">{confirmation.preview.selection.map((id) => <li key={structuralIntentIdToken(id)}><code>{String(id)}</code></li>)}</ul>
        </ConfirmPanel>}
      </div>
      </div>
    </>
  );
}
