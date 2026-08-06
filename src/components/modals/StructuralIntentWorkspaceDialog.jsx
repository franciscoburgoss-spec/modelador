import { useEffect, useMemo, useRef, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import {
  STRUCTURAL_INTENT_WORKSPACE_TABS,
  buildElementIntentDraft,
  buildRoofIntentDraft,
  buildStructuralIntentWorkspace,
  prepareElementIntentBatch,
  prepareElementIntentBatchRemoval,
  structuralIntentIdToken,
  validateElementDraft,
  validateRoofDraft
} from '../../core/structuralIntentWorkspace.js';

const TAB_LABELS = {
  summary: 'Resumen',
  elements: 'Muros y elementos',
  roof: 'Techumbre',
  intersections: 'Encuentros',
  diaphragms: 'Diafragmas',
  pending: 'Pendientes',
  trace: 'Trazabilidad'
};

const STATE_LABELS = {
  declared: 'Declarado',
  undefined: 'No definido',
  invalid: 'Inválido',
  brokenReference: 'Referencia rota'
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

const ROOF_DISTRIBUTION_LABELS = {
  oneWay: 'Una dirección',
  twoWay: 'Dos direcciones',
  local: 'Local',
  undetermined: 'Indeterminada'
};

const DIAPHRAGM_LABELS = {
  intended: 'Previsto',
  notIntended: 'No previsto',
  candidate: 'Candidato',
  undetermined: 'Indeterminado'
};

const BOUNDARY_LABELS = {
  gravitySupport: 'Apoyo gravitacional',
  lateralSupport: 'Apoyo lateral',
  gravityAndLateralSupport: 'Apoyo gravitacional y lateral',
  geometricBoundary: 'Límite geométrico',
  gutterSupport: 'Apoyo de canal',
  nonStructuralBoundary: 'Límite sin función resistente',
  undetermined: 'Indeterminado'
};

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

function ElementForm({ draft, setDraft, validation }) {
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
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
        />
        <FieldErrors validation={validation} field="notes" id="structural-intent-element-notes-errors" />
      </label>
    </div>
  );
}

function RoofPolygon({ polygon, boundaries }) {
  if (!polygon?.length) return null;
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1); const height = Math.max(maxY - minY, 1);
  const project = (point) => ({
    x: 20 + ((point.x - minX) / width) * 260,
    y: 180 - ((point.y - minY) / height) * 150
  });
  const points = polygon.map((point) => {
    const projected = project(point);
    return `${projected.x},${projected.y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 300 200" className="h-52 w-full rounded border border-[#d8d8d3] bg-white" aria-label="Polígono y bordes canónicos de la cubierta">
      <polygon points={points} fill="#f4f4f0" stroke="#55554f" strokeWidth="2" />
      {boundaries.map((boundary) => {
        const start = project(boundary.start); const end = project(boundary.end);
        return (
          <g key={boundary.boundaryId}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#2f5d50" strokeWidth="4" />
            <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 5} fontSize="12" textAnchor="middle">{boundary.label}</text>
          </g>
        );
      })}
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

export default function StructuralIntentWorkspaceDialog({ open, onClose }) {
  const model = useModelStore((state) => state.model);
  const setElementIntent = useModelStore((state) => state.setElementIntent);
  const removeElementIntent = useModelStore((state) => state.removeElementIntent);
  const setElementIntentsBatch = useModelStore((state) => state.setElementIntentsBatch);
  const removeElementIntentsBatch = useModelStore((state) => state.removeElementIntentsBatch);
  const setRoofIntent = useModelStore((state) => state.setRoofIntent);
  const removeRoofIntent = useModelStore((state) => state.removeRoofIntent);
  const dialogRef = useRef(null);
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

  const workspace = useMemo(() => {
    try {
      return buildStructuralIntentWorkspace(model);
    } catch (error) {
      return { error, summary: {}, elementRows: [], roofRows: [], pending: [], traceEvents: [], inactiveViews: {} };
    }
  }, [model]);

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
      if (!current.targetExists || current.previousFingerprint !== elementDraft.previousFingerprint) {
        setElementValidation({
          ok: false,
          state: 'brokenReference',
          issues: [{ code: 'SI-DRAFT-STALE', message: 'El modelo cambió mientras el borrador estaba abierto.' }]
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

  if (!open) return null;

  const selectedIds = workspace.elementRows
    .filter((row) => selectedTokens.has(row.idToken))
    .map((row) => row.id);
  const visibleRows = workspace.elementRows.filter((row) => (
    (!filterWallsOnly || row.type === 'wall')
    && (!search || String(row.id).toLowerCase().includes(search.toLowerCase()))
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
    if (dirty && id !== elementId) {
      setConfirmation({ type: 'switchElement', id });
      return;
    }
    setElementId(id);
    setElementDraftState(buildElementIntentDraft(model, id));
    setElementValidation(null);
    setDirty(false);
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
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[1.15fr_1fr]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Buscar por ID"
            className="min-w-48 flex-1 rounded border border-[#d8d8d3] px-2 py-1.5"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ID"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filterWallsOnly} onChange={(event) => setFilterWallsOnly(event.target.checked)} />
            Sólo muros
          </label>
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setSelectedTokens(new Set(visibleRows.map((row) => row.idToken)))}>Seleccionar visibles</button>
          <button className="rounded border px-2 py-1.5 text-sm" onClick={() => setSelectedTokens(new Set())}>Limpiar selección</button>
        </div>
        <div className="max-h-80 overflow-auto rounded border border-[#e4e4e0]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f7f7f4]"><tr><th className="p-2">Sel.</th><th>ID</th><th>Tipo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.idToken} className="border-t border-[#eeeeea]">
                  <td className="p-2"><input aria-label={`Seleccionar ${String(row.id)}`} type="checkbox" checked={selectedTokens.has(row.idToken)} onChange={() => setSelectedTokens((current) => {
                    const next = new Set(current);
                    if (next.has(row.idToken)) next.delete(row.idToken); else next.add(row.idToken);
                    return next;
                  })} /></td>
                  <td><code>{String(row.id)}</code></td><td>{row.type}</td><td>{STATE_LABELS[row.state]}</td>
                  <td className="p-1 text-right"><button className="rounded border px-2 py-1" onClick={() => openElement(row.id)}>Editar</button></td>
                </tr>
              ))}
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
        <ElementForm draft={elementDraft} setDraft={setElementDraft} validation={elementValidation} />
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
            {elementDraft.sourceIntent && <button className="rounded border border-red-300 px-3 py-1.5 text-red-700" onClick={() => setConfirmation({ type: 'deleteElement' })}>Eliminar declaración</button>}
            <button className="rounded border px-3 py-1.5" onClick={() => { setElementDraftState(buildElementIntentDraft(model, elementId)); setElementValidation(null); setDirty(false); }}>Descartar borrador</button>
            <button className="rounded bg-[#2f5d50] px-3 py-1.5 text-white" onClick={saveElement}>{elementDraft.sourceIntent ? 'Guardar cambios' : 'Declarar'}</button>
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
          {workspace.roofRows.map((row) => (
            <button key={row.idToken} className="flex w-full items-center justify-between border-b p-3 text-left hover:bg-[#f7f7f4]" onClick={() => openRoof(row.id)}>
              <span><code>{String(row.id)}</code><span className="block text-xs text-[#6b6b66]">{row.boundaries.length} bordes</span></span>
              {stateBadge(row.state)}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-4 rounded border border-[#e4e4e0] p-4">
        {!roofDraft ? <p className="text-sm text-[#6b6b66]">Seleccione una cubierta.</p> : (
          <>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Cubierta {String(roofDraft.roofGeometryId)}</h3>{stateBadge(roofValidation?.state || roofDraft.state)}</div>
            <ErrorSummary validation={roofValidation} />
            <RoofPolygon polygon={roofDraft.polygon} boundaries={roofDraft.boundaryIntents} />
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
                  <select
                    aria-label={`Función ${boundary.label}`}
                    aria-invalid={validationHasField(roofValidation, 'boundaryIntents')}
                    aria-describedby={validationHasField(roofValidation, 'boundaryIntents') ? 'structural-intent-roof-boundary-errors' : undefined}
                    className="rounded border px-2 py-1.5 text-sm"
                    value={boundary.function}
                    onChange={(event) => setRoofDraft((current) => ({
                      ...current,
                      boundaryIntents: current.boundaryIntents.map((item, itemIndex) => itemIndex === index ? { ...item, function: event.target.value } : item)
                    }))}
                  >{Object.entries(BOUNDARY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
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
    intersections: () => renderInactive('intersections'),
    diaphragms: () => renderInactive('diaphragms'),
    pending: renderPending,
    trace: renderTrace
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
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
        {confirmation?.type === 'switchElement' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const id = confirmation.id; setConfirmation(null); setDirty(false); setElementId(id); setElementDraftState(buildElementIntentDraft(model, id)); }} confirmLabel="Descartar"><p>Se abrirá el elemento {String(confirmation.id)}.</p></ConfirmPanel>}
        {confirmation?.type === 'switchRoof' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const id = confirmation.id; setConfirmation(null); setDirty(false); setRoofId(id); setRoofDraftState(buildRoofIntentDraft(model, id)); }} confirmLabel="Descartar"><p>Se abrirá la cubierta {String(confirmation.id)}.</p></ConfirmPanel>}
        {confirmation?.type === 'switchTab' && <ConfirmPanel title="¿Descartar el borrador actual?" onCancel={() => setConfirmation(null)} onConfirm={() => { const tab = confirmation.tab; setConfirmation(null); discardDrafts(); setActiveTab(tab); }} confirmLabel="Descartar y cambiar"><p>Se cambiará a {TAB_LABELS[confirmation.tab]} sin aplicar el borrador.</p></ConfirmPanel>}
        {confirmation?.type === 'deleteElement' && <ConfirmPanel title="Eliminar declaración" onCancel={() => setConfirmation(null)} onConfirm={() => {
          const latestModel = useModelStore.getState().model;
          const currentDraft = buildElementIntentDraft(latestModel, elementId);
          if (currentDraft.previousFingerprint !== elementDraft.previousFingerprint) {
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
          try {
            if (confirmation.type === 'batchSet') setElementIntentsBatch(preview.selection, batchDraft, { expectedPrevious: preview.expectedPrevious });
            else removeElementIntentsBatch(preview.selection, { expectedPrevious: preview.expectedPrevious });
            setConfirmation(null); setSelectedTokens(new Set()); setDirty(false);
          } catch (error) {
            setConfirmation((current) => ({
              ...current,
              preview: { ...current.preview, canConfirm: false, conflicts: toValidationIssues(error) }
            }));
          }
        }} confirmLabel={confirmation.type === 'batchSet'
          ? `Confirmar asignación a ${countLabel(confirmation.preview.selection.length, 'elemento', 'elementos')}`
          : `Confirmar eliminación de ${countLabel(confirmation.preview.selection.length, 'elemento', 'elementos')}`}>
          <p>{countLabel(confirmation.preview.selection.length, 'seleccionado', 'seleccionados')} · {countLabel(confirmation.preview.effectiveChanges.length, 'cambio efectivo', 'cambios efectivos')}.</p>
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
  );
}
