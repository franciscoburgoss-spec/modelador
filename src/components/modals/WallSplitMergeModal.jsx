// components/modals/WallSplitMergeModal.jsx
// ★ Sesión 15 — dividir un muro (por eje o por distancia) y unir tramos colineales contiguos.
// Todo el cálculo vive en core/wallSplitMerge.js; acá solo se previsualiza y se confirma.
import { useMemo, useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { planWallSplit, planWallMerge, findMergeCandidates } from '../../core/wallSplitMerge.js';
import { resolveWallGeometry, isWallXRun } from '../../core/elementGeometry.js';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { getWallDisplayName } from '../../core/naming.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const mm = (v) => `${Math.round(v)} mm`;

export default function WallSplitMergeModal({ open, editId, onClose }) {
  const model = useModelStore((s) => s.model);
  const splitWall = useModelStore((s) => s.splitWall);
  const mergeWalls = useModelStore((s) => s.mergeWalls);

  const wallId = editId ?? model.selectedElementId;
  const wall = (model.elements || []).find((el) => el.id === wallId && el.type === 'wall');

  const [tab, setTab] = useState('split');
  const [mode, setMode] = useState('axis');
  const [axisId, setAxisId] = useState('');
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState([]);

  const info = useMemo(() => {
    if (!wall) return null;
    const paramsMap = buildParamsMap(model.projectParams);
    const geo = resolveWallGeometry(wall, model.grid, paramsMap, buildElementsById(model.elements));
    if (!geo) return null;
    const runX = isWallXRun(wall);
    const a = runX ? geo.p1.x : geo.p1.y;
    const b = runX ? geo.p2.x : geo.p2.y;
    const min = Math.min(a, b), max = Math.max(a, b);
    const axes = (runX ? model.grid.xAxes : model.grid.yAxes)
      .filter((ax) => ax.position > min + 1 && ax.position < max - 1)
      .sort((p, q) => p.position - q.position);
    return { runX, min, max, length: max - min, axes };
  }, [wall, model]);

  const candidates = useMemo(
    () => (wall ? findMergeCandidates(model, wall.id) : []),
    [wall, model]
  );

  useEffect(() => {
    if (!open) return;
    setTab('split'); setMode('axis'); setAxisId(''); setPicked([]);
    if (info) setOffset(Math.round(info.length / 2));
  }, [open, wallId]); // eslint-disable-line react-hooks/exhaustive-deps

  const splitOptions = mode === 'axis'
    ? { atAxisId: axisId === '' ? null : Number(axisId) }
    : { atOffset: Number(offset) || 0 };
  const splitPlan = useMemo(
    () => (wall && open ? planWallSplit(model, wall.id, splitOptions) : null),
    [wall, open, model, mode, axisId, offset] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const mergePlan = useMemo(
    () => (wall && open && picked.length ? planWallMerge(model, [wall.id, ...picked]) : null),
    [wall, open, model, picked]
  );

  const applySuggestion = (value) => { setMode('offset'); setOffset(Math.round(value - info.min)); };

  const doSplit = () => { const r = splitWall(wall.id, splitOptions); if (r.ok) onClose(); };
  const doMerge = () => { const r = mergeWalls([wall.id, ...picked]); if (r.ok) onClose(); };

  const Impacts = ({ plan }) => {
    if (!plan?.ok) return null;
    const { roofSystemIds = [], referencingElementIds = [], dimensionIds = [] } = plan.impacts || {};
    const total = roofSystemIds.length + referencingElementIds.length + dimensionIds.length;
    if (!total && !plan.warnings.length) return null;
    return (
      <div className="text-xs bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 mb-3 text-amber-900 space-y-1">
        {total > 0 && (
          <p>
            Quedarán con la referencia rota: {roofSystemIds.length} sistema(s) de techumbre,{' '}
            {referencingElementIds.length} elemento(s) y {dimensionIds.length} cota(s). Aparecerán
            en Validación para que los reasignes.
          </p>
        )}
        {plan.warnings.map((w, i) => <p key={i}>{w}</p>)}
      </div>
    );
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dividir / unir muros"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        {tab === 'split' ? (
          <Button variant="primary" disabled={!splitPlan?.ok} onClick={doSplit}>Dividir</Button>
        ) : (
          <Button variant="primary" disabled={!mergePlan?.ok} onClick={doMerge}>
            Unir {picked.length + 1} muros
          </Button>
        )}
      </>}
    >
      {!wall || !info ? (
        <p className="text-sm text-[#8a8a85]">Selecciona un muro en planta o elevación para dividirlo o unirlo.</p>
      ) : (
        <>
          <p className="text-xs text-[#8a8a85] mb-3">
            {getWallDisplayName(wall, model.grid)} · corre en {info.runX ? 'X' : 'Y'} · {mm(info.length)} ·{' '}
            {(wall.openings || []).length} vano(s)
          </p>

          <div className="flex gap-1 mb-4 border-b border-[#e4e4e0]">
            {[['split', 'Dividir'], ['merge', 'Unir']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${tab === k ? 'border-[#3d3d38] font-medium text-[#1a1a18]' : 'border-transparent text-[#8a8a85]'}`}
              >{label}</button>
            ))}
          </div>

          {tab === 'split' ? (
            <>
              <Field label="Dónde dividir">
                <SelectInput value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="axis">En un eje existente</option>
                  <option value="offset">A una distancia del extremo</option>
                </SelectInput>
              </Field>

              {mode === 'axis' ? (
                <Field label={`Eje ${info.runX ? 'X' : 'Y'} intermedio`}>
                  <SelectInput value={axisId} onChange={(e) => setAxisId(e.target.value)}>
                    <option value="">-- elegir --</option>
                    {info.axes.map((ax) => (
                      <option key={ax.id} value={ax.id}>{ax.label} ({mm(ax.position - info.min)} desde el inicio)</option>
                    ))}
                  </SelectInput>
                </Field>
              ) : (
                <Field label="Distancia desde el extremo inicial" hint={`mm — entre 0 y ${Math.round(info.length)}`}>
                  <NumberInput value={offset} onChange={(e) => setOffset(e.target.value)} />
                </Field>
              )}

              {splitPlan && !splitPlan.ok && axisId === '' && mode === 'axis' ? null : (
                <ErrorText>{splitPlan && !splitPlan.ok ? splitPlan.error : ''}</ErrorText>
              )}

              {splitPlan && !splitPlan.ok && splitPlan.suggestionSides && (
                <div className="flex gap-2 mb-3">
                  {['left', 'right'].map((side) => splitPlan.suggestionSides[side] != null && (
                    <Button key={side} variant="secondary" className="!py-1 !text-xs"
                      onClick={() => applySuggestion(splitPlan.suggestionSides[side])}>
                      Cortar {side === 'left' ? 'antes' : 'después'} del vano ({mm(splitPlan.suggestionSides[side] - info.min)})
                    </Button>
                  ))}
                </div>
              )}
              {splitPlan && !splitPlan.ok && !splitPlan.suggestionSides && splitPlan.suggestion != null && (
                <Button variant="secondary" className="!py-1 !text-xs mb-3"
                  onClick={() => applySuggestion(splitPlan.suggestion)}>
                  Usar {mm(splitPlan.suggestion - info.min)}
                </Button>
              )}

              {splitPlan?.ok && (
                <div className="text-xs bg-[#f7f7f4] border border-[#e4e4e0] rounded-md px-2.5 py-2 mb-3">
                  Tramo 1: {mm(splitPlan.lengths[0])} con {splitPlan.openingCounts[0]} vano(s) ·
                  Tramo 2: {mm(splitPlan.lengths[1])} con {splitPlan.openingCounts[1]} vano(s)
                  {splitPlan.newAxis && <> · se creará el eje auxiliar <b>{splitPlan.newAxis.label}</b> en {mm(splitPlan.newAxis.position)}</>}
                </div>
              )}
              <Impacts plan={splitPlan} />
            </>
          ) : (
            <>
              {candidates.length === 0 ? (
                <p className="text-sm text-[#8a8a85]">
                  No hay muros contiguos compatibles (mismo eje, mismos niveles, misma sección y espesor).
                </p>
              ) : (
                <>
                  <p className="text-xs text-[#8a8a85] mb-2">Muros que se pueden unir con este:</p>
                  {candidates.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm mb-1.5">
                      <input
                        type="checkbox"
                        checked={picked.includes(c.id)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))}
                      />
                      {getWallDisplayName(c, model.grid)}
                    </label>
                  ))}
                  <ErrorText>{mergePlan && !mergePlan.ok ? mergePlan.error : ''}</ErrorText>
                  {mergePlan?.ok && (
                    <div className="text-xs bg-[#f7f7f4] border border-[#e4e4e0] rounded-md px-2.5 py-2 my-3">
                      Muro resultante: {mm(mergePlan.length)} con {mergePlan.wall.openings.length} vano(s)
                    </div>
                  )}
                  <Impacts plan={mergePlan} />
                </>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
