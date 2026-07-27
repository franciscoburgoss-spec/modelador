// components/modals/OsbNestingModal.jsx
// ★ Sesión 24 — Optimización de despuntes OSB y reporte de compra. Consume el despiece ya
// persistido (wall.osbCourses) y resuelve de qué placa madre sale cada pieza (core/osbNesting.js).
// "Aplicar" solo anota `sourcePanel` en cada placa: NO re-modula nada.
import { useMemo, useState, useRef, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import {
  computeOsbNesting, buildNestingPatches, buildPurchaseReportRows,
  buildOffcutRows, buildCutPlanRows
} from '../../core/osbNesting.js';
import Modal from '../ui/Modal.jsx';
import { Field, FormulaInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const fmt = (n) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Croquis del plan de corte de una placa madre: piezas colocadas + despuntes. */
function BoardPreview({ board, height = 190 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !board) return;
    const scale = height / board.height;
    const width = Math.max(40, board.width * scale);
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // y del modelo crece hacia arriba; el canvas al revés
    const toY = (y, h) => height - (y + h) * scale;

    ctx.fillStyle = '#faf9f5';
    ctx.fillRect(0, 0, width, height);
    for (const o of board.offcuts) {
      ctx.fillStyle = o.reusable ? '#dff0e4' : '#f3e6e0';
      ctx.fillRect(o.x * scale, toY(o.y, o.height), o.width * scale, o.height * scale);
    }
    for (const p of board.placements) {
      ctx.fillStyle = '#e8e6dd';
      ctx.strokeStyle = '#26251f';
      ctx.lineWidth = 1;
      const x = p.x * scale, y = toY(p.y, p.h), w = p.w * scale, h = p.h * scale;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      if (w > 26 && h > 14) {
        ctx.fillStyle = '#3d3d38';
        ctx.font = '9px sans-serif';
        ctx.fillText(p.code, x + 3, y + 11);
      }
    }
    ctx.strokeStyle = '#26251f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [board, height]);

  return <canvas ref={canvasRef} className="rounded border border-[#e4e4e0] bg-white" />;
}

export default function OsbNestingModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const applyWallPatchesBatch = useModelStore((s) => s.applyWallPatchesBatch);

  const [kerf, setKerf] = useState(model.osbDefaults?.gap ?? 5);
  const [minOffcutWidth, setMinOffcutWidth] = useState(300);
  const [minOffcutHeight, setMinOffcutHeight] = useState(300);
  const [applied, setApplied] = useState(null);
  const [tab, setTab] = useState('compra');

  const wallsWithOsb = useMemo(
    () => model.elements.filter((el) => el.type === 'wall' && el.osbCourses?.length > 0),
    [model.elements]
  );

  const result = useMemo(
    () => computeOsbNesting(model, { kerf, minOffcutWidth, minOffcutHeight }),
    [model, kerf, minOffcutWidth, minOffcutHeight]
  );

  const reportRows = useMemo(() => buildPurchaseReportRows(result), [result]);
  const offcutRows = useMemo(() => buildOffcutRows(result), [result]);
  const planRows = useMemo(() => buildCutPlanRows(result), [result]);

  const handleApply = () => {
    const patches = buildNestingPatches(model, result);
    if (patches.length > 0) applyWallPatchesBatch(patches);
    setApplied(`${patches.length} muro(s) actualizados: cada placa quedó con su placa madre asignada (columna PLACA en el DXF de OSB).`);
  };

  const t = result.totals;
  const stale = wallsWithOsb.some((w) => w.osbStale);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Optimización de despuntes OSB"
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleApply} disabled={t.boardCount === 0}>
            Aplicar trazabilidad al despiece
          </Button>
          <Button variant="primary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {wallsWithOsb.length === 0 ? (
        <p className="text-xs text-[#8a8a85]">
          Ningún muro tiene despiece de placas generado. Generalo primero en
          "Modulación &gt; OSB…" — esta herramienta no re-modula, solo optimiza el corte del
          despiece existente.
        </p>
      ) : (
        <div className="space-y-3">
          {stale && (
            <div className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Hay muros con despiece desactualizado. Regeneralo antes de comprar: el plan de corte
              se calcula sobre el despiece guardado, no sobre el modelo actual.
            </div>
          )}
          {applied && (
            <div className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{applied}</div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Corte de sierra (mm)" hint="Se descuenta en cada corte">
              <FormulaInput value={kerf} onChange={(v) => setKerf(Math.max(0, Number(v) || 0))} projectParams={projectParams} />
            </Field>
            <Field label="Despunte mínimo — ancho (mm)" hint="Bajo esto se descarta">
              <FormulaInput value={minOffcutWidth} onChange={(v) => setMinOffcutWidth(Math.max(0, Number(v) || 0))} projectParams={projectParams} />
            </Field>
            <Field label="Despunte mínimo — alto (mm)">
              <FormulaInput value={minOffcutHeight} onChange={(v) => setMinOffcutHeight(Math.max(0, Number(v) || 0))} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded border border-[#e4e4e0] p-2">
              <div className="text-lg font-semibold text-[#1a1a18]">{t.boardCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#8a8a85]">placas a comprar</div>
            </div>
            <div className="rounded border border-[#e4e4e0] p-2">
              <div className="text-lg font-semibold text-[#1a1a18]">{fmt(t.wastePct)}%</div>
              <div className="text-[10px] uppercase tracking-wide text-[#8a8a85]">pérdida</div>
            </div>
            <div className="rounded border border-[#e4e4e0] p-2">
              <div className="text-lg font-semibold text-[#1a1a18]">{result.baseline.perWallBoards}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#8a8a85]">antes (muro a muro)</div>
            </div>
            <div className={`rounded border p-2 ${result.savings.boards > 0 ? 'border-emerald-400 bg-emerald-50' : 'border-[#e4e4e0]'}`}>
              <div className="text-lg font-semibold text-[#1a1a18]">−{result.savings.boards}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#8a8a85]">ahorro ({fmt(result.savings.pct)}%)</div>
            </div>
          </div>

          {result.unplaced.length > 0 && (
            <div className="rounded border border-[#b5502a] bg-[#fdf0eb] px-2 py-1 text-xs text-[#b5502a]">
              {result.unplaced.length} pieza(s) sin asignar: {result.unplaced[0].reason}
            </div>
          )}

          <div className="flex gap-1 border-b border-[#e4e4e0] text-xs">
            {[['compra', 'Reporte de compra'], ['plan', 'Plan de corte'], ['despuntes', `Despuntes (${offcutRows.length})`]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-2 py-1 ${tab === id ? 'border-b-2 border-[#26251f] font-semibold text-[#1a1a18]' : 'text-[#8a8a85]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-auto">
            {tab === 'compra' && (
              <table className="w-full text-xs">
                <tbody>
                  {reportRows.map((r, i) => (
                    <tr key={i} className="border-t border-[#f2f2ee]">
                      <td className="py-1 text-[#3d3d38] whitespace-pre">{r.label}</td>
                      <td className="py-1 text-right font-semibold text-[#1a1a18]">{r.value}</td>
                      <td className="py-1 pl-3 text-[#8a8a85]">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'plan' && (
              <div className="space-y-3">
                {result.groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8a8a85]">Placa {g.key} mm</p>
                    <div className="flex flex-wrap gap-2">
                      {g.boards.map((b) => (
                        <div key={b.code} className="text-center">
                          <BoardPreview board={b} />
                          <p className="mt-0.5 text-[10px] text-[#8a8a85]">{b.code} · {b.placements.length} pza</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[#8a8a85]">
                      <th className="pb-1 font-semibold">Placa</th>
                      <th className="pb-1 font-semibold">Pza</th>
                      <th className="pb-1 font-semibold">Muro</th>
                      <th className="pb-1 font-semibold">Medida</th>
                      <th className="pb-1 font-semibold">Posición</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.map((r, i) => (
                      <tr key={i} className="border-t border-[#f2f2ee]">
                        {r.map((c, j) => <td key={j} className="py-1 text-[#3d3d38]">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'despuntes' && (
              offcutRows.length === 0 ? (
                <p className="text-xs text-[#8a8a85]">Sin despuntes sobre el mínimo: todo el sobrante es merma.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[#8a8a85]">
                      <th className="pb-1 font-semibold">Origen</th>
                      <th className="pb-1 font-semibold">Medida (mm)</th>
                      <th className="pb-1 font-semibold">Área</th>
                      <th className="pb-1 font-semibold">Formato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offcutRows.map((r, i) => (
                      <tr key={i} className="border-t border-[#f2f2ee]">
                        {r.map((c, j) => <td key={j} className="py-1 text-[#3d3d38]">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>

          <p className="text-[10px] text-[#8a8a85]">
            Sin rotación de piezas: el OSB estructural de muro va con la hebra vertical (Manual
            Metalcon, Anexo IV). El recorte interior de los vanos no se reutiliza (corte no guillotina).
          </p>
        </div>
      )}
    </Modal>
  );
}
