import { useEffect, useMemo, useRef, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { buildStructuralProposalWorkspace } from '../../core/structuralProposalWorkspace.js';
import { prepareStructuralProposalDecision } from '../../core/applyStructuralProposalDecision.js';
import { ELEMENT_FUNCTIONS } from '../../core/structuralIntent.js';
import { StructuralConceptGlossaryPanel, StructuralConceptHint } from '../StructuralConceptHelp.jsx';

const TABS = [
  ['summary', 'Resumen'],
  ['proposals', 'Propuestas'],
  ['interfaces', 'Interfaces'],
  ['gravity', 'G↓ Gravedad'],
  ['lateral', 'L→ Lateral'],
  ['audit', 'Auditoría'],
  ['concepts', 'Conceptos']
];

const STATE_LABELS = {
  candidate: 'Candidata',
  insufficientEvidence: 'Evidencia insuficiente',
  blockedCandidate: 'Bloqueada',
  completeCandidate: 'Completa candidata',
  incompleteCandidate: 'Incompleta candidata',
  pending: 'Pendiente',
  accepted: 'Aceptada por usuario',
  modifiedAndAccepted: 'Modificada y aceptada',
  rejected: 'Rechazada por usuario',
  deferred: 'Dejada pendiente',
  superseded: 'Superada por nuevo resultado'
};

function statusLabel(value) {
  return STATE_LABELS[value] || value || 'Sin estado';
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-[#deded8] bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-[#6b6b66]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#252521]">{value}</div>
      {detail && <div className="mt-1 text-xs text-[#6b6b66]">{detail}</div>}
    </div>
  );
}

function TechnicalReference({ value }) {
  return (
    <details className="mt-2 text-xs text-[#66665f]">
      <summary className="cursor-pointer select-none">Referencia técnica</summary>
      <pre className="mt-2 max-h-36 overflow-auto rounded bg-[#f4f4f0] p-2 whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-[#cfcfc8] bg-[#fafaf7] p-6 text-sm text-[#5d5d57]">{children}</div>;
}


function InterfacesView({ presentation, onLocate }) {
  const interfaces = presentation?.entities?.interfaces || [];
  const regions = presentation?.entities?.regions || [];
  const relations = presentation?.entities?.relations || [];
  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_1.2fr]">
      <section className="min-h-0 overflow-auto rounded-lg border border-[#deded8] bg-white p-3">
        <h3 className="font-semibold">Interfaces estructurales</h3>
        <p className="mt-1 text-xs text-[#66665f]">Ubicación geométrica declarada. La cara o extremo no define por sí solo la familia de acción.</p>
        <div className="mt-3 space-y-2">
          {interfaces.length === 0 && <EmptyState>No hay interfaces declaradas. REV8 no inventa interfaces desde geometría legacy.</EmptyState>}
          {interfaces.map((entity) => {
            const locator = entity.technicalReference?.locator;
            const scopeValue = locator?.kind === 'face'
              ? (locator.side === 'positiveN' ? 'facePositiveN' : 'faceNegativeN')
              : locator?.kind === 'end'
                ? (locator.end === 'lowS' ? 'endLowS' : 'endHighS')
                : null;
            return (
              <article key={entity.entityId} className="rounded-lg border border-[#e5e5df] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{entity.title}</div>
                    <div className="mt-1 text-xs text-[#66665f]">{entity.subtitle}</div>
                  </div>
                  <span className="rounded-full bg-[#f1f1ed] px-2 py-1 text-xs">{entity.state}</span>
                </div>
                {scopeValue && <StructuralConceptHint scope="interfaceLocation" value={scopeValue} compact />}
                {entity.locate && entity.preview && (
                  <button type="button" className="mt-2 rounded border border-[#6c5ce7] px-2.5 py-1 text-xs font-medium text-[#5545cf]" onClick={() => onLocate(entity)}>Localizar interfaz</button>
                )}
                <TechnicalReference value={entity.technicalReference} />
              </article>
            );
          })}
          {regions.map((entity) => (
            <article key={entity.entityId} className="rounded-lg border border-[#e5e5df] p-3">
              <div className="font-medium">{entity.title}</div>
              <div className="mt-1 text-xs text-[#66665f]">{entity.subtitle}</div>
              <StructuralConceptHint scope="structuralRegion" value="embeddedRange" compact />
              {entity.locate && entity.preview && (
                <button type="button" className="mt-2 rounded border border-[#6c5ce7] px-2.5 py-1 text-xs font-medium text-[#5545cf]" onClick={() => onLocate(entity)}>Localizar región</button>
              )}
              <TechnicalReference value={entity.technicalReference} />
            </article>
          ))}
        </div>
      </section>
      <section className="min-h-0 overflow-auto rounded-lg border border-[#deded8] bg-white p-3">
        <h3 className="font-semibold">Relaciones estructurales</h3>
        <p className="mt-1 text-xs text-[#66665f]">La relación separa rol de interacción, familia de acción y función estructural.</p>
        <div className="mt-3 space-y-3">
          {relations.length === 0 && <EmptyState>No hay relaciones declaradas.</EmptyState>}
          {relations.map((entity) => (
            <article key={entity.entityId} className="rounded-lg border border-[#e5e5df] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{entity.title}</div>
                  <div className="mt-1 text-xs text-[#66665f]">{entity.subtitle}</div>
                </div>
                <span className="rounded-full bg-[#f1f1ed] px-2 py-1 text-xs">{entity.state}</span>
              </div>
              <StructuralConceptHint scope="actionFamily" value={entity.technicalReference?.actionFamily} compact />
              <StructuralConceptHint scope="relationFunction" value={entity.technicalReference?.structuralFunction} compact />
              {entity.locate && entity.preview && (
                <button type="button" className="mt-2 rounded border border-[#6c5ce7] px-2.5 py-1 text-xs font-medium text-[#5545cf]" onClick={() => onLocate(entity)}>Ver relación</button>
              )}
              {(entity.technicalReference?.carrierRegions || []).length > 0 && (
                <div className="mt-2 rounded bg-[#fafaf7] p-2 text-xs text-[#66665f]">
                  {(entity.technicalReference.carrierRegions || []).length} región estructural embebida{entity.technicalReference.carrierRegions.length === 1 ? '' : 's'}; no crea geometría nueva.
                </div>
              )}
              <TechnicalReference value={entity.technicalReference} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GraphView({ graph, onLocate }) {
  const nodesById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const edgesById = new Map(graph.edges.map((edge) => [edge.edgeId, edge]));
  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_1.15fr]">
      <section className="min-h-0 overflow-auto rounded-lg border border-[#deded8] bg-white p-3">
        <h3 className="font-semibold">Nodos</h3>
        <div className="mt-3 space-y-2">
          {graph.nodes.length === 0 && <EmptyState>No hay nodos para este contexto.</EmptyState>}
          {graph.nodes.map((node) => (
            <article key={node.nodeId} className="rounded-lg border border-[#e5e5df] p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#6c5ce7]">{node.roleLabel}</div>
              <div className="mt-1 font-medium text-[#292925]">{node.title}</div>
              <div className="mt-1 text-xs text-[#66665f]">{node.subtitle}</div>
              {node.entity?.locate && node.entity?.preview && (
                <button
                  type="button"
                  className="mt-2 rounded border border-[#6c5ce7] px-2.5 py-1 text-xs font-medium text-[#5545cf] hover:bg-[#f2f0ff]"
                  id={`structural-proposal-graph-locate-${node.nodeId}`}
                  onClick={() => onLocate(node.entity)}
                  aria-label={`Localizar ${node.title}`}
                >
                  Localizar
                </button>
              )}
              <TechnicalReference value={node.technicalReference} />
            </article>
          ))}
        </div>
      </section>
      <section className="min-h-0 overflow-auto rounded-lg border border-[#deded8] bg-white p-3">
        <h3 className="font-semibold">Caminos candidatos</h3>
        <div className="mt-3 space-y-3">
          {graph.paths.length === 0 && <EmptyState>No hay caminos para este contexto.</EmptyState>}
          {graph.paths.map((path) => (
            <article key={path.pathId} className="rounded-lg border border-[#e5e5df] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{path.summary}</div>
                <span className="rounded-full bg-[#f1f1ed] px-2 py-1 text-xs">{statusLabel(path.candidateState)}</span>
              </div>
              <ol className="mt-3 space-y-2 text-sm">
                {path.edgeIds.map((edgeId, index) => {
                  const edge = edgesById.get(edgeId);
                  const from = nodesById.get(edge?.fromNodeId);
                  const to = nodesById.get(edge?.toNodeId);
                  return (
                    <li key={edgeId} className="rounded bg-[#fafaf7] p-2">
                      <div className="font-medium">{index + 1}. {from?.title || 'Referencia rota'} → {to?.title || 'Referencia rota'}</div>
                      <div className="mt-1 text-xs text-[#66665f]">{edge?.kind}{Number.isFinite(edge?.gapMm) ? ` · ∥ gap ${edge.gapMm} mm` : ''}{Number.isFinite(edge?.overlapMm) ? ` · solape ${edge.overlapMm} mm` : ''}</div>
                    </li>
                  );
                })}
              </ol>
              {path.findings.length > 0 && (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  {path.findings.map((finding) => `× ${finding}`).join(' · ')}
                </div>
              )}
              <TechnicalReference value={{ pathId: path.pathId, edgeIds: path.edgeIds }} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DecisionDialog({ draft, proposal, prepared, onDraft, onPrepare, onConfirm, onCancel, error }) {
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || [])];
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      if (event.key === 'Escape') onCancel();
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && prepared) {
        event.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, prepared]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Confirmar decisión de propuesta">
      <div ref={dialogRef} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold">Confirmar revisión humana</h3>
        <p className="mt-1 text-sm text-[#66665f]">{proposal.title}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Disposición</span>
            <div className="mt-1 rounded border border-[#deded8] bg-[#f7f7f3] p-2">{statusLabel(draft.disposition)}</div>
          </label>
          <label className="text-sm">
            <span className="font-medium">Código/motivo</span>
            <input ref={firstFieldRef} className="mt-1 w-full rounded border border-[#d6d6d0] px-2 py-2" value={draft.reasonCode} onChange={(event) => onDraft({ reasonCode: event.target.value })} placeholder="Opcional" />
          </label>
        </div>
        {draft.disposition === 'modifiedAndAccepted' && (
          <fieldset className="mt-4 rounded-lg border border-[#deded8] p-3">
            <legend className="px-1 text-sm font-medium">Funciones de intención que se aplicarán</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ELEMENT_FUNCTIONS.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.functions.includes(value)}
                    onChange={(event) => onDraft({
                      functions: event.target.checked
                        ? [...new Set([...draft.functions, value])]
                        : draft.functions.filter((item) => item !== value)
                    })}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="mt-4 block text-sm">
          <span className="font-medium">Nota</span>
          <textarea className="mt-1 min-h-20 w-full rounded border border-[#d6d6d0] px-2 py-2" value={draft.note} onChange={(event) => onDraft({ note: event.target.value })} placeholder="Opcional" />
        </label>
        {!prepared ? (
          <button type="button" className="mt-4 rounded bg-[#34342f] px-4 py-2 text-sm font-medium text-white" onClick={onPrepare}>Preparar vista previa</button>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#deded8] p-3">
              <div className="text-xs font-semibold uppercase text-[#66665f]">Antes</div>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(prepared.before, null, 2)}</pre>
            </div>
            <div className="rounded-lg border border-[#deded8] p-3">
              <div className="text-xs font-semibold uppercase text-[#66665f]">Después previsto</div>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(prepared.afterPreview, null, 2)}</pre>
            </div>
            <div className="sm:col-span-2 rounded-lg bg-[#f7f7f3] p-3 text-sm">
              1 paso de historial · 1 evento de review · {prepared.expectedEffects.intentTraceEvents} evento de trace · {prepared.expectedEffects.changesIntent ? 'cambia intención' : 'no cambia intención'}
            </div>
          </div>
        )}
        {error && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded border border-[#d6d6d0] px-4 py-2 text-sm" onClick={onCancel}>Cancelar</button>
          <button type="button" disabled={!prepared} className="rounded bg-[#6c5ce7] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" onClick={onConfirm}>Confirmar <span className="text-xs opacity-80">Ctrl/Cmd+Enter</span></button>
        </div>
      </div>
    </div>
  );
}

export default function StructuralProposalWorkspaceDialog({ open, onClose, onOpenStructuralIntent = null }) {
  const model = useModelStore((state) => state.model);
  const applyDecision = useModelStore((state) => state.applyPreparedStructuralProposalDecision);
  const applyDecisionBatch = useModelStore((state) => state.applyPreparedStructuralProposalDecisionBatch);
  const openLocator = useModelStore((state) => state.openStructuralProposalLocator);
  const fitLocator = useModelStore((state) => state.fitStructuralProposalLocator);
  const closeLocator = useModelStore((state) => state.closeStructuralProposalLocator);
  const proposalLocator = useModelStore((state) => state.structuralProposalLocator);
  const [tab, setTab] = useState('summary');
  const [direction, setDirection] = useState('x');
  const [query, setQuery] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [recalculation, setRecalculation] = useState(0);
  const [decisionDraft, setDecisionDraft] = useState(null);
  const [preparedDecision, setPreparedDecision] = useState(null);
  const [decisionError, setDecisionError] = useState(null);
  const decisionOriginRef = useRef(null);
  const locatorRef = useRef(null);

  const calculation = useMemo(() => {
    if (!open) return { workspace: null, error: null };
    try {
      const projectionModel = recalculation === 0 ? model : { ...model };
      return {
        workspace: buildStructuralProposalWorkspace(projectionModel, {
          analysisContexts: [{ graph: 'lateral', direction }]
        }),
        error: null
      };
    } catch (error) {
      return { workspace: null, error };
    }
    // `recalculation` fuerza una nueva proyección aunque el modelo conserve identidad.
  }, [direction, model, open, recalculation]);

  const workspace = calculation.workspace;
  const visualByProposalId = useMemo(() => new Map(
    (workspace?.visualPresentation.proposals || []).map((proposal) => [proposal.proposalId, proposal])
  ), [workspace]);
  const reviewByProposalId = useMemo(() => new Map(
    (workspace?.reviewedProposals || []).map((item) => [item.proposal.proposalId, item])
  ), [workspace]);
  const proposals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (workspace?.visualPresentation.proposals || []).filter((proposal) => (
      normalized === ''
      || proposal.title.toLowerCase().includes(normalized)
      || proposal.subtitle.toLowerCase().includes(normalized)
      || statusLabel(reviewByProposalId.get(proposal.proposalId)?.reviewState).toLowerCase().includes(normalized)
    ));
  }, [query, reviewByProposalId, workspace]);

  useEffect(() => {
    if (!open) return;
    const ids = workspace?.visualPresentation.proposals.map((proposal) => proposal.proposalId) || [];
    if (!ids.includes(selectedProposalId)) setSelectedProposalId(ids[0] || null);
  }, [open, selectedProposalId, workspace]);

  useEffect(() => {
    const valid = new Set(
      workspace?.visualPresentation.proposals.map((proposal) => proposal.proposalId) || []
    );
    setSelectedBatchIds((current) => current.filter((proposalId) => valid.has(proposalId)));
  }, [workspace]);

  useEffect(() => {
    if (!open) closeLocator({ restoreView: true });
  }, [closeLocator, open]);

  const selectedVisual = visualByProposalId.get(selectedProposalId) || null;
  const selectedCanonical = workspace?.structuralProposals.proposals.find((proposal) => proposal.proposalId === selectedProposalId) || null;
  const selectedReview = reviewByProposalId.get(selectedProposalId) || null;

  const locate = (entity) => {
    if (!entity?.locate || !entity.preview) return;
    openLocator({
      entity: entity.locate,
      preview: { ...entity.preview, locatorLabel: entity.title },
      sourceFocusId: document.activeElement?.id || null
    });
    fitLocator();
  };

  const locateRelation = () => {
    if (!selectedVisual?.relation) return;
    openLocator({
      entity: { kind: 'relation', id: selectedVisual.proposalId },
      preview: selectedVisual.relation,
      sourceFocusId: document.activeElement?.id || null
    });
    fitLocator();
  };

  const finishLocate = (restoreView) => {
    const sourceFocusId = proposalLocator.sourceFocusId;
    closeLocator({ restoreView });
    requestAnimationFrame(() => document.getElementById(sourceFocusId)?.focus());
  };

  useEffect(() => {
    if (!open || !proposalLocator.active) return undefined;
    const frame = requestAnimationFrame(() => {
      locatorRef.current?.querySelector('button:not([disabled])')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, proposalLocator.active]);

  const startDecision = (disposition, proposalIds = [selectedProposalId]) => {
    decisionOriginRef.current = document.activeElement;
    const ids = [...new Set(proposalIds)].filter(Boolean);
    const canonical = ids.map((proposalId) => workspace?.structuralProposals.proposals.find(
      (proposal) => proposal.proposalId === proposalId
    )).filter(Boolean);
    if (canonical.length === 0) return;
    if (['accepted', 'modifiedAndAccepted'].includes(disposition)
      && canonical.some((proposal) => proposal.candidateState === 'blockedCandidate')) {
      setDecisionError('El lote contiene una propuesta bloqueada.');
      return;
    }
    setDecisionError(null);
    setPreparedDecision(null);
    setDecisionDraft({
      disposition,
      proposalIds: ids,
      reasonCode: '',
      note: '',
      functions: [...canonical[0].proposedIntentPatch.functions]
    });
  };

  const prepareDecision = () => {
    try {
      const canonical = decisionDraft.proposalIds.map((proposalId) => (
        workspace.structuralProposals.proposals.find((proposal) => proposal.proposalId === proposalId)
      ));
      if (canonical.some((proposal) => !proposal)) throw new Error('Una propuesta seleccionada ya no existe.');
      const modifiedIntentPatch = decisionDraft.disposition === 'modifiedAndAccepted'
        ? { functions: decisionDraft.functions }
        : null;
      const decisions = canonical.map((proposal) => {
        const visual = visualByProposalId.get(proposal.proposalId);
        if (!visual) throw new Error('Falta la presentación visual de una propuesta.');
        return prepareStructuralProposalDecision({
          model,
          structuralProposals: workspace.structuralProposals,
          proposalId: proposal.proposalId,
          disposition: decisionDraft.disposition,
          modifiedIntentPatch,
          reasonCode: decisionDraft.reasonCode || null,
          note: decisionDraft.note || null,
          visualFingerprint: visual.visualFingerprint
        });
      });
      if (decisions.length === 1) {
        setPreparedDecision(decisions[0]);
      } else {
        const accept = ['accepted', 'modifiedAndAccepted'].includes(decisionDraft.disposition);
        setPreparedDecision({
          batch: true,
          decisions,
          before: decisions.map((decision) => ({
            proposalId: decision.proposalId,
            intent: decision.before
          })),
          afterPreview: decisions.map((decision) => ({
            proposalId: decision.proposalId,
            intent: decision.afterPreview
          })),
          expectedEffects: {
            historySteps: 1,
            reviewEvents: 1,
            intentTraceEvents: accept ? 1 : 0,
            changesIntent: accept
          }
        });
      }
      setDecisionError(null);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : String(error));
    }
  };

  const closeDecision = () => {
    setDecisionDraft(null);
    setPreparedDecision(null);
    setDecisionError(null);
    requestAnimationFrame(() => decisionOriginRef.current?.focus());
  };

  const confirmDecision = () => {
    if (!preparedDecision) return;
    try {
      if (preparedDecision.batch) {
        applyDecisionBatch({
          structuralProposals: workspace.structuralProposals,
          preparedDecisions: preparedDecision.decisions,
          currentVisualFingerprints: Object.fromEntries(
            preparedDecision.decisions.map((decision) => [
              decision.proposalId,
              visualByProposalId.get(decision.proposalId)?.visualFingerprint ?? null
            ])
          )
        });
        setSelectedBatchIds([]);
      } else {
        applyDecision({
          structuralProposals: workspace.structuralProposals,
          preparedDecision,
          currentVisualFingerprint: selectedVisual.visualFingerprint
        });
      }
      closeDecision();
      setRecalculation((value) => value + 1);
    } catch (error) {
      setDecisionError(error?.code === 'SI-PROPOSAL-STALE'
        ? `${error.message} Recalcula antes de decidir.`
        : (error instanceof Error ? error.message : String(error)));
    }
  };

  const requestClose = () => {
    if (decisionDraft && !window.confirm('Hay una decisión sin confirmar. ¿Cerrar sin aplicarla?')) return;
    closeLocator({ restoreView: true });
    setDecisionDraft(null);
    setPreparedDecision(null);
    onClose();
  };

  useEffect(() => {
    if (!open || decisionDraft || proposalLocator.active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  if (proposalLocator.active) {
    const locatorLabel = proposalLocator.preview?.locatorLabel
      || (proposalLocator.kind === 'relation' ? 'Relación propuesta' : `Referencia ${String(proposalLocator.id)}`);
    return (
      <aside
        ref={locatorRef}
        role="dialog"
        aria-modal="false"
        aria-label="Localizador de propuesta estructural"
        className="fixed right-4 top-4 z-[70] w-[min(92vw,480px)] rounded-lg border-2 border-[#6c5ce7] bg-white p-4 shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            finishLocate(true);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Localización temporal</h2>
            <p className="mt-1 text-xs text-[#6b6b66]">{locatorLabel}</p>
          </div>
          <span className="rounded border border-[#cfc8ff] bg-[#f4f1ff] px-2 py-1 text-xs text-[#5545cf]">Vista temporal</span>
        </div>
        <p className="mt-3 text-sm">
          El workspace se compactó para dejar accesible la planta. Puede inspeccionar, hacer pan o zoom sin modificar la intención ni la selección global.
        </p>
        {proposalLocator.preview?.kind === 'proposal-relation' && (
          <div className="mt-3 rounded border border-[#deded8] bg-[#fafaf7] p-2 text-xs text-[#55554f]">
            <strong>Relación:</strong> ORIGEN y OBJETIVO se muestran simultáneamente; el borde declarado se marca discontinuo y el solape geométrico se resalta sobre la entrega.
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => fitLocator()}>Encuadrar</button>
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => finishLocate(true)}>Restaurar vista</button>
          <button type="button" className="rounded bg-[#6c5ce7] px-3 py-1.5 text-sm text-white" onClick={() => finishLocate(false)}>Conservar vista</button>
        </div>
      </aside>
    );
  }

  const reviewedCounts = countBy(workspace?.reviewedProposals || [], (item) => item.reviewState);
  const gravityPaths = workspace?.candidateLoadPaths.gravity.paths || [];
  const lateralPaths = workspace?.candidateLoadPaths.lateral.paths || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-3" role="dialog" aria-modal="true" aria-label="Propuestas estructurales y caminos candidatos">
      <div className="flex h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-[#f7f7f3] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#deded8] bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#252521]">Propuestas y caminos de carga candidatos</h2>
            <p className="mt-1 text-sm text-[#66665f]">Derivados no autoritativos · gravedad y lateral separados · ninguna ruta está verificada</p>
          </div>
          <div className="flex items-center gap-2">
            {proposalLocator.active && <span className="rounded-full bg-[#efeaff] px-3 py-1 text-xs text-[#5545cf]">Localización temporal activa</span>}
            <button type="button" className="rounded border border-[#d6d6d0] px-3 py-2 text-sm" onClick={() => setRecalculation((value) => value + 1)}>⟳ Recalcular</button>
            <button type="button" className="rounded bg-[#34342f] px-3 py-2 text-sm text-white" onClick={requestClose}>Cerrar</button>
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#deded8] bg-white px-5 py-2">
          {TABS.map(([value, label]) => (
            <button key={value} type="button" className={`rounded px-3 py-1.5 text-sm ${tab === value ? 'bg-[#6c5ce7] text-white' : 'hover:bg-[#f1f1ed]'}`} onClick={() => setTab(value)}>{label}</button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>Dirección lateral</span>
            {['x', 'y'].map((value) => <button key={value} type="button" className={`rounded border px-2.5 py-1 ${direction === value ? 'border-[#6c5ce7] bg-[#efeaff] text-[#5545cf]' : 'border-[#d6d6d0]'}`} onClick={() => setDirection(value)}>{value.toUpperCase()}</button>)}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-auto p-5">
          {calculation.error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold">No fue posible recalcular los derivados.</div>
              <div className="mt-1">{calculation.error.message}</div>
              <TechnicalReference value={{ code: calculation.error.code, details: calculation.error.details }} />
            </div>
          )}

          {workspace && tab === 'summary' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Propuestas" value={workspace.structuralProposals.proposals.length} detail={`${reviewedCounts.get('pending') || 0} pendientes`} />
                <Metric label="G↓ caminos" value={gravityPaths.length} detail={`${gravityPaths.filter((path) => path.candidateState === 'completeCandidate').length} completos candidatos`} />
                <Metric label="L→ caminos" value={lateralPaths.length} detail={`análisis ${direction.toUpperCase()}`} />
                <Metric label="Bloqueos" value={[...workspace.candidateLoadPaths.gravity.findings, ...workspace.candidateLoadPaths.lateral.findings].filter((finding) => finding.severity === 'blocking').length} />
                <Metric label="Estado verified" value="0" detail="Prohibido por contrato" />
              </div>
              {workspace.proposalReadiness?.state !== 'ready' && (
                <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <h3 className="font-semibold">{workspace.proposalReadiness.title}</h3>
                  <p className="mt-1">{workspace.proposalReadiness.message}</p>
                  {workspace.proposalReadiness.action === 'openRoofIntent' && onOpenStructuralIntent && (
                    <button type="button" className="mt-3 rounded border border-amber-500 bg-white px-3 py-1.5 text-sm" onClick={onOpenStructuralIntent}>
                      Abrir Intención estructural → Techumbre
                    </button>
                  )}
                </section>
              )}
              <section className="rounded-lg border border-[#deded8] bg-white p-4">
                <h3 className="font-semibold">Autoridades y fronteras</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {Object.entries(workspace.authorities).map(([key, value]) => <div key={key} className="rounded bg-[#f7f7f3] p-3 text-sm"><span className="font-medium">{key}</span><div className="mt-1 text-xs text-[#66665f]">{value}</div></div>)}
                </div>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[#55554f]">{workspace.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="rounded-lg border border-[#deded8] bg-white p-4">
                <h3 className="font-semibold">Fingerprints de fuentes</h3>
                <TechnicalReference value={workspace.structuralProposals.sourceFingerprints} />
              </section>
            </div>
          )}

          {workspace && tab === 'proposals' && (
            <div className="grid min-h-0 gap-4 lg:grid-cols-[380px_1fr]">
              <section className="min-h-0 rounded-lg border border-[#deded8] bg-white p-3">
                <input className="w-full rounded border border-[#d6d6d0] px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cubierta, muro o estado" />
                <div className="mt-3 rounded-lg border border-[#deded8] bg-[#fafaf7] p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>{selectedBatchIds.length} seleccionadas para lote homogéneo</span>
                    <button type="button" className="rounded border border-[#d6d6d0] px-2 py-1" onClick={() => setSelectedBatchIds([])}>Limpiar</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" disabled={selectedBatchIds.length < 2} className="rounded bg-[#3f7d4d] px-2 py-1 text-xs text-white disabled:opacity-40" onClick={() => startDecision('accepted', selectedBatchIds)}>✓ Aceptar lote</button>
                    <button type="button" disabled={selectedBatchIds.length < 2} className="rounded bg-[#6c5ce7] px-2 py-1 text-xs text-white disabled:opacity-40" onClick={() => startDecision('modifiedAndAccepted', selectedBatchIds)}>Modificar lote</button>
                    <button type="button" disabled={selectedBatchIds.length < 2} className="rounded border border-[#b94a48] px-2 py-1 text-xs text-[#9f3937] disabled:opacity-40" onClick={() => startDecision('rejected', selectedBatchIds)}>Rechazar lote</button>
                    <button type="button" disabled={selectedBatchIds.length < 2} className="rounded border border-[#8b7b43] px-2 py-1 text-xs text-[#746431] disabled:opacity-40" onClick={() => startDecision('deferred', selectedBatchIds)}>Dejar pendiente lote</button>
                  </div>
                </div>
                <div data-proposal-list className="mt-3 max-h-[56vh] space-y-2 overflow-auto">
                  {proposals.length === 0 && (
                    <EmptyState>
                      <div className="font-medium text-[#383834]">{workspace.proposalReadiness?.title || 'No hay propuestas compatibles.'}</div>
                      <div className="mt-1">{workspace.proposalReadiness?.message || 'Revise la intención y la evidencia geométrica.'}</div>
                      {workspace.proposalReadiness?.action === 'openRoofIntent' && onOpenStructuralIntent && (
                        <button type="button" className="mt-3 rounded border border-[#6c5ce7] bg-white px-3 py-1.5 text-xs text-[#5545cf]" onClick={onOpenStructuralIntent}>Abrir Intención estructural → Techumbre</button>
                      )}
                    </EmptyState>
                  )}
                  {proposals.map((proposal) => {
                    const review = reviewByProposalId.get(proposal.proposalId);
                    const checked = selectedBatchIds.includes(proposal.proposalId);
                    return (
                      <div key={proposal.proposalId} className={`flex rounded-lg border ${selectedProposalId === proposal.proposalId ? 'border-[#6c5ce7] bg-[#f4f1ff]' : 'border-[#e5e5df] hover:bg-[#fafaf7]'}`}>
                        <label className="flex cursor-pointer items-start p-3 pr-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setSelectedBatchIds((current) => (
                              event.target.checked
                                ? [...new Set([...current, proposal.proposalId])]
                                : current.filter((proposalId) => proposalId !== proposal.proposalId)
                            ))}
                            aria-label={`Seleccionar ${proposal.title} para lote`}
                          />
                        </label>
                        <button
                          type="button"
                          data-proposal-row
                          className="min-w-0 flex-1 p-3 text-left"
                          onClick={() => setSelectedProposalId(proposal.proposalId)}
                          onKeyDown={(event) => {
                            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                            const rows = [...(event.currentTarget.closest('[data-proposal-list]')
                              ?.querySelectorAll('[data-proposal-row]') || [])];
                            const index = rows.indexOf(event.currentTarget);
                            const delta = event.key === 'ArrowDown' ? 1 : -1;
                            const next = rows[(index + delta + rows.length) % rows.length];
                            event.preventDefault();
                            next?.focus();
                          }}
                        >
                          <div className="font-medium">{proposal.title}</div>
                          <div className="mt-1 text-xs text-[#66665f]">{proposal.subtitle}</div>
                          <div className="mt-2 flex flex-wrap gap-1 text-xs"><span className="rounded-full bg-white px-2 py-1">{statusLabel(proposal.candidateState)}</span><span className="rounded-full bg-white px-2 py-1">{statusLabel(review?.reviewState)}</span></div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="min-h-0 overflow-auto rounded-lg border border-[#deded8] bg-white p-4">
                {!selectedVisual || !selectedCanonical ? <EmptyState>Selecciona una propuesta.</EmptyState> : (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="text-lg font-semibold">{selectedVisual.title}</h3><p className="mt-1 text-sm text-[#66665f]">{selectedVisual.subtitle}</p></div>
                      <span className="rounded-full bg-[#f1f1ed] px-3 py-1 text-xs">{statusLabel(selectedReview?.reviewState)}</span>
                    </div>
                    {selectedVisual.relation && (
                      <button
                        id="structural-proposal-locate-relation"
                        type="button"
                        className="mt-4 rounded border-2 border-[#6c5ce7] bg-[#f4f1ff] px-3 py-2 text-sm font-medium text-[#5545cf]"
                        onClick={locateRelation}
                      >
                        Ver relación en planta · origen + borde + objetivo
                      </button>
                    )}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[['Cubierta origen', selectedVisual.source], ['Objetivo candidato', selectedVisual.target]].map(([label, entity]) => (
                        <article key={label} className="rounded-lg border border-[#e5e5df] p-3">
                          <div className="text-xs font-semibold uppercase text-[#66665f]">{label}</div><div className="mt-1 font-medium">{entity.title}</div><div className="mt-1 text-xs text-[#66665f]">{entity.subtitle}</div>
                          {entity.locate && entity.preview && <button id={`structural-proposal-locate-${label === 'Cubierta origen' ? 'source' : 'target'}`} type="button" className="mt-2 rounded border border-[#6c5ce7] px-2.5 py-1 text-xs text-[#5545cf]" onClick={() => locate(entity)}>Localizar</button>}
                          <TechnicalReference value={entity.technicalReference} />
                        </article>
                      ))}
                    </div>
                    <section className="mt-4 rounded-lg border border-[#e5e5df] p-3">
                      <h4 className="font-medium">Evidencia geométrica</h4>
                      {selectedCanonical.evidence.matches.map((match, index) => (
                        <div key={index} className="mt-2 grid gap-2 rounded bg-[#fafaf7] p-3 text-sm sm:grid-cols-3">
                          <div><span className="text-xs text-[#66665f]">Distancia de eje</span><div>{match.axisDistanceMm} mm</div></div>
                          <div><span className="text-xs text-[#66665f]">Solape</span><div>{match.overlapMm} mm</div></div>
                          <div><span className="text-xs text-[#66665f]">Cobertura borde</span><div>{Math.round(match.boundaryCoverage * 1000) / 10} %</div></div>
                          <div className="sm:col-span-3 text-xs text-[#66665f]">Vanos visibles: {match.openings.length}. Ninguno se oculta del análisis.</div>
                        </div>
                      ))}
                      <StructuralConceptHint scope="roofBoundary" value={selectedCanonical.evidence.boundaryFunction} />
                      <ul className="mt-3 list-disc pl-5 text-sm text-[#66665f]">{selectedCanonical.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                    </section>
                    <section className="mt-4 rounded-lg border border-[#e5e5df] p-3">
                      <h4 className="font-medium">Patch de intención propuesto</h4>
                      <pre className="mt-2 overflow-auto rounded bg-[#f7f7f3] p-3 text-xs">{JSON.stringify(selectedCanonical.proposedIntentPatch, null, 2)}</pre>
                    </section>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={selectedCanonical.candidateState === 'blockedCandidate'} className="rounded bg-[#3f7d4d] px-3 py-2 text-sm font-medium text-white disabled:opacity-40" onClick={() => startDecision('accepted')}>✓ Aceptar</button>
                      <button type="button" disabled={selectedCanonical.candidateState === 'blockedCandidate'} className="rounded bg-[#6c5ce7] px-3 py-2 text-sm font-medium text-white disabled:opacity-40" onClick={() => startDecision('modifiedAndAccepted')}>Modificar y aceptar</button>
                      <button type="button" className="rounded border border-[#b94a48] px-3 py-2 text-sm text-[#9f3937]" onClick={() => startDecision('rejected')}>Rechazar</button>
                      <button type="button" className="rounded border border-[#8b7b43] px-3 py-2 text-sm text-[#746431]" onClick={() => startDecision('deferred')}>Dejar pendiente</button>
                    </div>
                    <TechnicalReference value={selectedVisual.technicalReference} />
                  </div>
                )}
              </section>
            </div>
          )}

          {workspace && tab === 'interfaces' && <InterfacesView presentation={workspace.visualPresentation} onLocate={locate} />}
          {workspace && tab === 'gravity' && <GraphView graph={workspace.visualPresentation.graphs.gravity} onLocate={locate} />}
          {workspace && tab === 'lateral' && <GraphView graph={workspace.visualPresentation.graphs.lateral} onLocate={locate} />}

          {workspace && tab === 'audit' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-[#deded8] bg-white p-4"><h3 className="font-semibold">Review append-only</h3><pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-[#f7f7f3] p-3 text-xs">{JSON.stringify(model.structuralProposalReviews, null, 2)}</pre></section>
              <section className="rounded-lg border border-[#deded8] bg-white p-4"><h3 className="font-semibold">Trace de intención</h3><pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-[#f7f7f3] p-3 text-xs">{JSON.stringify(model.structuralIntentTrace || { events: [] }, null, 2)}</pre></section>
            </div>
          )}

          {workspace && tab === 'concepts' && <StructuralConceptGlossaryPanel />}
        </main>
      </div>
      {decisionDraft && selectedVisual && (
        <DecisionDialog
          draft={decisionDraft}
          proposal={{
            title: decisionDraft.proposalIds.length > 1
              ? `${decisionDraft.proposalIds.length} propuestas seleccionadas`
              : selectedVisual.title
          }}
          prepared={preparedDecision}
          error={decisionError}
          onDraft={(patch) => { setDecisionDraft((current) => ({ ...current, ...patch })); setPreparedDecision(null); }}
          onPrepare={prepareDecision}
          onConfirm={confirmDecision}
          onCancel={closeDecision}
        />
      )}
    </div>
  );
}
