// components/modals/TakeoffModal.jsx
// ★ Metrado automático (ítem 5). Muestra ml/m²/m³ agrupados por tipo + sección de librería,
// con totales por tipo y un total general. "Personalizado" agrupa todo lo sin libraryId.
import { useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { computeTakeoff, downloadTakeoffCsv } from '../../core/takeoff.js';
import Modal from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

const fmt = (n) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TakeoffModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const { rows, totalsByType, osbPurchase } = useMemo(() => computeTakeoff(model), [model]);

  const grandTotal = useMemo(() => {
    const t = { count: 0, ml: 0, m2: 0, m3: 0, warnings: 0 };
    for (const r of rows) { t.count += r.count; t.ml += r.ml; t.m2 += r.m2; t.m3 += r.m3; t.warnings += r.warnings; }
    return t;
  }, [rows]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Metrado automático"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => downloadTakeoffCsv(model)}>Exportar CSV</Button>
          <Button variant="primary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="text-xs text-[#8a8a85]">Sin elementos en el modelo.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#8a8a85] uppercase tracking-wide text-[10px]">
              <th className="pb-1.5 font-semibold">Tipo</th>
              <th className="pb-1.5 font-semibold">Sección</th>
              <th className="pb-1.5 font-semibold text-right">Cant.</th>
              <th className="pb-1.5 font-semibold text-right">ml</th>
              <th className="pb-1.5 font-semibold text-right">m²</th>
              <th className="pb-1.5 font-semibold text-right">m³</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.type}|${r.section}`} className="border-t border-[#f2f2ee]">
                <td className="py-1.5 text-[#8a8a85]">{r.typeLabel}</td>
                <td className="py-1.5 text-[#3d3d38]">
                  {r.section}
                  {r.warnings > 0 && (
                    <span className="ml-1 text-[#b5502a]" title={`${r.warnings} elemento(s) con geometría/fórmula no resuelta`}>
                      ⚠︎ {r.warnings}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right text-[#3d3d38]">{r.count}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{r.ml > 0 ? fmt(r.ml) : '—'}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{r.m2 > 0 ? fmt(r.m2) : '—'}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{r.m3 > 0 ? fmt(r.m3) : '—'}</td>
              </tr>
            ))}
            {Object.entries(totalsByType).map(([type, t]) => (
              <tr key={`total-${type}`} className="border-t border-[#e4e4e0] font-semibold">
                <td className="py-1.5 text-[#3d3d38]" colSpan={2}>Total {t.typeLabel.toLowerCase()}s</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{t.count}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{t.ml > 0 ? fmt(t.ml) : '—'}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{t.m2 > 0 ? fmt(t.m2) : '—'}</td>
                <td className="py-1.5 text-right text-[#3d3d38]">{t.m3 > 0 ? fmt(t.m3) : '—'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[#26251f] font-semibold">
              <td className="py-1.5 text-[#1a1a18]" colSpan={2}>Total general</td>
              <td className="py-1.5 text-right text-[#1a1a18]">{grandTotal.count}</td>
              <td className="py-1.5 text-right text-[#1a1a18]">{fmt(grandTotal.ml)}</td>
              <td className="py-1.5 text-right text-[#1a1a18]">{fmt(grandTotal.m2)}</td>
              <td className="py-1.5 text-right text-[#1a1a18]">{fmt(grandTotal.m3)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {osbPurchase && (
        <div className="mt-4 rounded border border-[#e4e4e0] p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a85]">Compra de OSB</p>
          <p className="text-xs text-[#3d3d38]">
            {osbPurchase.boardCount} placa(s) · {fmt(osbPurchase.boughtArea)} m² comprados ·{' '}
            {fmt(osbPurchase.usedArea)} m² usados · pérdida {fmt(osbPurchase.wastePct)}%
          </p>
          <p className="text-xs text-[#5a5a55]">
            Modulando muro por muro serían {osbPurchase.baseline.perWallBoards} placa(s):{' '}
            {osbPurchase.savings.boards > 0
              ? `se ahorran ${osbPurchase.savings.boards} (${fmt(osbPurchase.savings.pct)}%) reutilizando despuntes.`
              : 'la optimización no encuentra ahorro en este modelo.'}{' '}
            {osbPurchase.reusableCount} despunte(s) reutilizable(s) ({fmt(osbPurchase.reusableArea)} m²).
          </p>
          {osbPurchase.unplaced.length > 0 && (
            <p className="text-xs text-[#b5502a]">{osbPurchase.unplaced.length} pieza(s) no caben en la placa — revisar el despiece.</p>
          )}
        </div>
      )}
      {grandTotal.warnings > 0 && (
        <p className="mt-3 text-xs text-[#b5502a]">
          {grandTotal.warnings} elemento(s) con fórmula inválida o referencia rota — no se suman. Revisa en "Verificar coherencia geométrica".
        </p>
      )}
    </Modal>
  );
}
