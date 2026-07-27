// components/modals/AnalysisReadinessModal.jsx
import { useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { checkAnalysisReadiness } from '../../core/analysisReadiness.js';
import Modal from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

export default function AnalysisReadinessModal({ open, onClose, canvasSize }) {
  const model = useModelStore((s) => s.model);
  const centerOnElement = useModelStore((s) => s.centerOnElement);

  const issues = useMemo(() => (open ? checkAnalysisReadiness(model) : []), [open, model]);
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  const goTo = (elementIds) => {
    if (elementIds[0] != null) centerOnElement(elementIds[0], canvasSize.width, canvasSize.height);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preparación para análisis (CalculiX)"
      width="max-w-lg"
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <p className="text-xs text-[#8a8a85] mb-4">
        Revisa qué pilares, vigas y muros van a usar material/perfil real de catálogo vs un
        genérico de respaldo al exportar. No verifica resistencia — eso requiere correr CalculiX
        y revisar los resultados.
      </p>

      {issues.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm font-medium text-[#1a1a18]">Todo listo.</p>
          <p className="text-xs text-[#8a8a85] mt-1">Todos los pilares, vigas y muros con metalcon asignado tienen material y perfil real de catálogo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Requieren acción ({warnings.length})</h3>
              <ul className="space-y-1.5">
                {warnings.map((iss, i) => (
                  <li key={i} className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex justify-between items-start gap-2">
                    <span className="text-amber-800"><span className="font-medium">{iss.category}: </span>{iss.message}</span>
                    <button className="text-amber-700 hover:underline text-xs shrink-0" onClick={() => goTo(iss.elementIds)}>Centrar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {infos.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5a5a55] mb-1">Usarán respaldo genérico ({infos.length})</h3>
              <ul className="space-y-1.5">
                {infos.map((iss, i) => (
                  <li key={i} className="text-sm bg-[#f2f2ee] border border-[#e4e4e0] rounded-md px-3 py-2 flex justify-between items-start gap-2">
                    <span className="text-[#3d3d38]"><span className="font-medium">{iss.category}: </span>{iss.message}</span>
                    <button className="text-[#5a5a55] hover:underline text-xs shrink-0" onClick={() => goTo(iss.elementIds)}>Centrar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
