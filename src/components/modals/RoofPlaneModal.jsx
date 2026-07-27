// components/modals/RoofPlaneModal.jsx
// ★ B4.7.4b — Al cerrar el contorno del faldón (roofPlaneDraft.closed) abre este modal:
//   - canaleta = un LADO del polígono (se mapea al muro colineal, sin dividir muros — core/roofPlaneEdge.js),
//   - nivel de cielo de apoyo, plantilla (perfiles + costanera heredada, B4.7.2) y parámetros,
//   - preview en vivo con resolveRoofPlane (findings informativos, no bloquean),
//   - Crear = addRoofPlane; Cancelar/cerrar = descarta el draft.
import { useState, useEffect, useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { resolveRoofPlane } from '../../core/roofPlane.js';
import { polygonEdges, wallOnEdge, edgeLabel } from '../../core/roofPlaneEdge.js';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { getElementShortLabel } from '../../core/naming.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const SEV_COLOR = { error: 'text-red-700', warning: 'text-amber-700', info: 'text-[#6a6a63]' };

export default function RoofPlaneModal() {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const library = useModelStore((s) => s.model.library);
  const draft = useModelStore((s) => s.roofPlaneDraft);
  const addRoofPlane = useModelStore((s) => s.addRoofPlane);
  const cancelRoofPlaneDraft = useModelStore((s) => s.cancelRoofPlaneDraft);
  const loadSeedTrussTemplates = useModelStore((s) => s.loadSeedTrussTemplates);
  // ★ B4.7.4c — edición de un faldón persistido: mismo modal, precargado, confirma con updateRoofPlane.
  const editingRoofPlaneId = useModelStore((s) => s.editingRoofPlaneId);
  const roofPlanes = useModelStore((s) => s.model.roofPlanes || []);
  const updateRoofPlane = useModelStore((s) => s.updateRoofPlane);
  const cancelEditRoofPlane = useModelStore((s) => s.cancelEditRoofPlane);
  const editingPlane = editingRoofPlaneId != null ? roofPlanes.find(p => p.id === editingRoofPlaneId) : null;

  const open = draft.closed || editingPlane != null;
  const model = useMemo(() => ({ grid, elements, projectParams, library }), [grid, elements, projectParams, library]);
  const paramsMap = useMemo(() => buildParamsMap(projectParams), [projectParams]);
  const elementsById = useMemo(() => buildElementsById(elements), [elements]);
  // el contorno se edita en el lienzo (B4.7.4a); acá viene fijo del draft o del faldón en edición.
  const polygon = editingPlane ? (editingPlane.polygon || []) : (draft.vertices || []);
  const templates = library.trussTemplates || [];

  // lados del polígono con su muro colineal candidato (la canaleta se elige entre ellos)
  const edges = useMemo(() => polygonEdges(polygon).map(e => ({
    ...e, wallId: wallOnEdge(model, e.a, e.b, paramsMap, elementsById), label: edgeLabel(e.a, e.b)
  })), [polygon, model, paramsMap, elementsById]);

  const [canalEdge, setCanalEdge] = useState(0);
  const [supportLevelId, setSupportLevelId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [supportOffset, setSupportOffset] = useState(100);
  const [crownClearance, setCrownClearance] = useState(200);
  const [heelHeight, setHeelHeight] = useState(0);
  const [trussSpacing, setTrussSpacing] = useState(1200);
  const [chainOrigin, setChainOrigin] = useState('start');
  const [shortSpanThreshold, setShortSpanThreshold] = useState(500);
  const [gutterNotchWidth, setGutterNotchWidth] = useState(200);
  const [purlinCommercialLength, setPurlinCommercialLength] = useState(6000);
  const [purlinOverlap, setPurlinOverlap] = useState(100);

  // al abrir: semillas + precarga. En edición se leen los valores del faldón; en creación, defaults
  // (primer lado con muro como canaleta, nivel de cielo, 1ª plantilla).
  useEffect(() => {
    if (!open) return;
    loadSeedTrussTemplates();
    if (editingPlane) {
      const idx = edges.findIndex(e => e.wallId != null && e.wallId === editingPlane.canalWallId);
      setCanalEdge(idx >= 0 ? idx : Math.max(0, edges.findIndex(e => e.wallId != null)));
      setSupportLevelId(editingPlane.supportLevelId ?? '');
      setTemplateId(editingPlane.templateId ?? templates[0]?.id ?? '');
      setSupportOffset(editingPlane.supportOffset ?? 100);
      setCrownClearance(editingPlane.crownClearance ?? 200);
      setHeelHeight(editingPlane.heelHeight ?? 0);
      setTrussSpacing(editingPlane.trussSpacing ?? 1200);
      setChainOrigin(editingPlane.chainOrigin ?? 'start');
      setShortSpanThreshold(editingPlane.shortSpanThreshold ?? 500);
      setGutterNotchWidth(editingPlane.gutterNotchWidth ?? 200);
      setPurlinCommercialLength(editingPlane.purlinCommercialLength ?? 6000);
      setPurlinOverlap(editingPlane.purlinOverlap ?? 100);
      return;
    }
    const firstWithWall = edges.findIndex(e => e.wallId != null);
    setCanalEdge(firstWithWall >= 0 ? firstWithWall : 0);
    const cielo = grid.zLevels.find(l => l.levelType === 'cieloGeneral' || l.levelType === 'cieloAlto');
    setSupportLevelId(cielo?.id ?? grid.zLevels[0]?.id ?? '');
    setTemplateId(templates[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRoofPlaneId]);

  const template = templates.find(t => t.id === templateId);
  const canalWallId = edges[canalEdge]?.wallId ?? null;

  const plane = useMemo(() => ({
    canalWallId, supportLevelId: Number(supportLevelId) || supportLevelId,
    supportOffset, crownClearance, heelHeight, gutterNotchWidth, trussSpacing,
    chainOrigin, shortSpanThreshold, purlinCommercialLength, purlinOverlap,
    supportMode: 'lateral',
    templateId,
    postSpacing: template?.postSpacing ?? 600,
    diagonalPattern: template?.diagonalPattern ?? 'W',
    profiles: template?.profiles ?? {},
    polygon
  }), [canalWallId, supportLevelId, supportOffset, crownClearance, heelHeight, gutterNotchWidth,
    trussSpacing, chainOrigin, shortSpanThreshold, purlinCommercialLength, purlinOverlap, templateId, template, polygon]);

  // preview: resuelve el faldón (nunca bloquea; findings informativos). try/catch por robustez.
  const preview = useMemo(() => {
    if (!open || !canalWallId) return null;
    try {
      return resolveRoofPlane({ model, plane, paramsMap, elementsById, library });
    } catch (err) {
      return { resolved: false, findings: [{ severity: 'error', category: 'preview', message: `error al resolver: ${err.message}` }], tramos: [], trussPositions: [] };
    }
  }, [open, canalWallId, model, plane, paramsMap, elementsById, library]);

  const handleClose = () => { editingPlane ? cancelEditRoofPlane() : cancelRoofPlaneDraft(); };
  const handleConfirm = () => {
    if (editingPlane) { updateRoofPlane(editingRoofPlaneId, plane); cancelEditRoofPlane(); }
    else { addRoofPlane(plane); cancelRoofPlaneDraft(); }
  };

  const zLevels = grid.zLevels;
  const wallLabel = (id) => {
    const el = id == null ? null : elementsById[id];
    return el ? getElementShortLabel(el, grid) : (id == null ? '—' : `muro ${id}`);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingPlane ? 'Editar faldón de techumbre' : 'Faldón de techumbre'}
      width="max-w-lg"
      footer={
        <>
          <Button variant="primary" onClick={handleConfirm} disabled={!canalWallId}>
            {editingPlane ? 'Guardar cambios' : 'Crear faldón'}
          </Button>
          <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Canaleta (lado del polígono)" hint="Borde bajo del agua. Se apoya en el muro colineal a ese lado.">
          <SelectInput value={canalEdge} onChange={(e) => setCanalEdge(Number(e.target.value))}>
            {edges.map((e) => (
              <option key={e.index} value={e.index}>
                Lado {e.index + 1}: {e.label} — {e.wallId != null ? wallLabel(e.wallId) : 'sin muro colineal'}
              </option>
            ))}
          </SelectInput>
        </Field>
        {!canalWallId && (
          <div className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
            El lado elegido no tiene un muro colineal que sirva de canaleta. Elige otro lado o agrega el muro.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nivel de cielo (apoyo)">
            <SelectInput value={supportLevelId} onChange={(e) => setSupportLevelId(e.target.value)}>
              {zLevels.map((l) => <option key={l.id} value={l.id}>{l.name} ({Math.round(l.elevation)}mm)</option>)}
            </SelectInput>
          </Field>
          <Field label="Plantilla (perfiles + costanera)">
            <SelectInput value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Offset apoyo (mm)">
            <FormulaInput value={supportOffset} onChange={setSupportOffset} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Holgura coronación (mm)">
            <FormulaInput value={crownClearance} onChange={setCrownClearance} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Talón (mm)">
            <FormulaInput value={heelHeight} onChange={setHeelHeight} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Paso de cerchas (mm)">
            <FormulaInput value={trussSpacing} onChange={setTrussSpacing} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Origen de cadena">
            <SelectInput value={chainOrigin} onChange={(e) => setChainOrigin(e.target.value)}>
              <option value="start">Inicio</option>
              <option value="end">Fin</option>
            </SelectInput>
          </Field>
          <Field label="Umbral vano corto (mm)">
            <FormulaInput value={shortSpanThreshold} onChange={setShortSpanThreshold} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Rebaje canaleta (mm)">
            <FormulaInput value={gutterNotchWidth} onChange={setGutterNotchWidth} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Largo comercial costanera (mm)">
            <FormulaInput value={purlinCommercialLength} onChange={setPurlinCommercialLength} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
          <Field label="Traslapo costanera (mm)">
            <FormulaInput value={purlinOverlap} onChange={setPurlinOverlap} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>
        </div>

        {/* preview */}
        {preview && (
          <div className="rounded border border-[#e4e4e0] bg-[#faf9f6] px-3 py-2 text-xs">
            {preview.resolved ? (
              <div className="text-[#3d3d38]">
                Pendiente <b>{preview.slopePercent?.toFixed(2)}%</b> · {preview.tramos.length} tramo(s) ·{' '}
                {preview.trussPositions.length} cercha(s)
              </div>
            ) : (
              <div className="text-red-700">No resuelto — revisa los avisos.</div>
            )}
            {preview.findings?.length > 0 && (
              <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                {preview.findings.map((f, i) => (
                  <li key={i} className={SEV_COLOR[f.severity] || 'text-[#6a6a63]'}>· {f.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
