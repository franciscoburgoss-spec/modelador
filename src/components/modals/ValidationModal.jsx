// components/modals/ValidationModal.jsx
import { useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { validateModel } from '../../core/modelValidation.js';
import { validateRoofSystems } from '../../core/trussLayout.js';
import { validateRoofPlanes } from '../../core/roofPlaneValidation.js';
import Modal from '../ui/Modal.jsx';
import { NumberInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

export default function ValidationModal({ open, onClose, canvasSize }) {
  const model = useModelStore((s) => s.model);
  const centerOnElement = useModelStore((s) => s.centerOnElement);
  const selectRoofSystem = useModelStore((s) => s.selectRoofSystem);
  const selectRoofPlane = useModelStore((s) => s.selectRoofPlane);
  const [extraMargin, setExtraMargin] = useState(0);

  const issues = useMemo(() => (open ? validateModel(model, Number(extraMargin) || 0) : []), [open, model, extraMargin]);
  // roofSystems quedó vacío desde B4.7 (lo reemplazan faldones); se conserva por si carga un modelo legacy.
  const roofFindings = useMemo(
    () => (open ? [...validateRoofSystems(model), ...validateRoofPlanes(model)] : []),
    [open, model]
  );
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const connectivityWarnings = warnings.filter(i => ['Sin apoyo', 'Sin conexión superior', 'Extremo sin apoyo'].includes(i.category));
  const otherWarnings = warnings.filter(i => !['Sin apoyo', 'Sin conexión superior', 'Extremo sin apoyo'].includes(i.category));
  const totalCount = issues.length + roofFindings.length;

  const goTo = (elementIds) => {
    if (elementIds[0] != null) centerOnElement(elementIds[0], canvasSize.width, canvasSize.height);
    onClose();
  };

  const goToRoof = (f) => {
    if (f.roofPlaneIds?.[0] != null) selectRoofPlane(f.roofPlaneIds[0]);
    else if (f.roofSystemIds?.[0] != null) selectRoofSystem(f.roofSystemIds[0]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verificación de coherencia geométrica"
      width="max-w-lg"
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="flex items-end gap-3 mb-4 bg-[#f2f2ee] border border-[#e4e4e0] rounded-md px-3 py-2.5">
        <label className="text-sm flex-1">
          <span className="block font-medium text-[#3d3d38] mb-1">Margen extra de conectividad</span>
          <span className="block text-xs text-[#8a8a85] mb-1.5">Se suma a la tolerancia (ya calculada por el ancho real de cada par de elementos). Súbelo si tienes ménsulas o desfases intencionales.</span>
          <NumberInput value={extraMargin} onChange={(e) => setExtraMargin(e.target.value)} className="w-28" />
          <span className="text-xs text-[#8a8a85] ml-2">mm</span>
        </label>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm font-medium text-[#1a1a18]">Sin problemas detectados.</p>
          <p className="text-xs text-[#8a8a85] mt-1">Referencias, largos, traslapes, conectividad, vanos y techumbre revisados — el modelo está geométricamente sano.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {errors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">Errores ({errors.length}) — bloquean una exportación confiable</h3>
              <ul className="space-y-1.5">
                {errors.map((iss, i) => (
                  <li key={i} className="text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 flex justify-between items-start gap-2">
                    <span className="text-red-800"><span className="font-medium">{iss.category}: </span>{iss.message}</span>
                    <button className="text-red-700 hover:underline text-xs shrink-0" onClick={() => goTo(iss.elementIds)}>Centrar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {connectivityWarnings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Conectividad ({connectivityWarnings.length}) — crítico para CalculiX</h3>
              <ul className="space-y-1.5">
                {connectivityWarnings.map((iss, i) => (
                  <li key={i} className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex justify-between items-start gap-2">
                    <span className="text-amber-800"><span className="font-medium">{iss.category}: </span>{iss.message}</span>
                    <button className="text-amber-700 hover:underline text-xs shrink-0" onClick={() => goTo(iss.elementIds)}>Centrar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherWarnings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Otras advertencias ({otherWarnings.length})</h3>
              <ul className="space-y-1.5">
                {otherWarnings.map((iss, i) => (
                  <li key={i} className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex justify-between items-start gap-2">
                    <span className="text-amber-800"><span className="font-medium">{iss.category}: </span>{iss.message}</span>
                    <button className="text-amber-700 hover:underline text-xs shrink-0" onClick={() => goTo(iss.elementIds)}>Centrar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {roofFindings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Techumbre ({roofFindings.length})</h3>
              <ul className="space-y-1.5">
                {roofFindings.map((f, i) => (
                  <li
                    key={i}
                    className={`text-sm rounded-md px-3 py-2 flex justify-between items-start gap-2 ${f.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}
                  >
                    <span className={f.severity === 'error' ? 'text-red-800' : 'text-amber-800'}>
                      <span className="font-medium">{f.category}: </span>{f.message}
                    </span>
                    {(f.roofPlaneIds?.[0] != null || f.roofSystemIds?.[0] != null) && (
                      <button
                        className={`hover:underline text-xs shrink-0 ${f.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}
                        onClick={() => goToRoof(f)}
                      >
                        {f.roofPlaneIds ? 'Ver faldón' : 'Ver sistema'}
                      </button>
                    )}
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
