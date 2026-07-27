// components/modals/AuditModal.jsx
import { useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { getWallDisplayName, getOpeningDisplayName } from '../../core/naming.js';
import { buildParamsMap, formatDim } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import Modal from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

const TYPE_LABELS = { wall: 'Muro', column: 'Pilar', beam: 'Viga', foundation: 'Fundación' };

export default function AuditModal({ open, onClose, canvasSize }) {
  const elements = useModelStore((s) => s.model.elements);
  const grid = useModelStore((s) => s.model.grid);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const centerOnElement = useModelStore((s) => s.centerOnElement);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);

  const grouped = useMemo(() => {
    const groups = {};
    for (const el of elements) {
      groups[el.type] = groups[el.type] || [];
      groups[el.type].push(el);
    }
    return groups;
  }, [elements]);

  const openings = useMemo(() => {
    const list = [];
    for (const wall of elements) {
      if (wall.type !== 'wall') continue;
      for (const o of wall.openings || []) list.push({ ...o, wallId: wall.id, wall });
    }
    return list;
  }, [elements]);

  const goTo = (id) => {
    centerOnElement(id, canvasSize.width, canvasSize.height);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Auditoría de elementos" width="max-w-lg" footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}>
      <div className="flex gap-4 text-sm text-[#5a5a55] mb-4 bg-[#f2f2ee] rounded-lg px-3 py-2 border border-[#e4e4e0]">
        <span>Total elementos: <b className="text-[#1a1a18]">{elements.length}</b></span>
        <span>Vanos: <b className="text-[#1a1a18]">{openings.length}</b></span>
      </div>

      <div className="space-y-4">
        {Object.keys(TYPE_LABELS).map(type => (
          <div key={type}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8a8a85] mb-1">{TYPE_LABELS[type]}s ({(grouped[type] || []).length})</h3>
            {(grouped[type] || []).length === 0 ? (
              <p className="text-xs text-[#8a8a85]">Sin elementos.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {grouped[type].map(el => (
                    <tr key={el.id} className="border-t border-[#f2f2ee]">
                      <td className="py-1.5 text-[#8a8a85] w-10">#{el.id}</td>
                      <td className="py-1.5 text-[#3d3d38]">
                        {type === 'wall' && `${getWallDisplayName(el, grid)}, ${(el.openings || []).length} vano(s)`}
                        {type === 'column' && `${formatDim(el.widthX, paramsMap, elementsById)}×${formatDim(el.widthY, paramsMap, elementsById)}`}
                        {type === 'beam' && `${formatDim(el.width, paramsMap, elementsById)}, ${el.direction === 'x' ? 'corre en X' : 'corre en Y'}`}
                        {type === 'foundation' && (el.foundationType === 'aislada'
                          ? `aislada, ${formatDim(el.aislada?.lengthX, paramsMap, elementsById)}×${formatDim(el.aislada?.lengthY, paramsMap, elementsById)}`
                          : `corrida, cim ${formatDim(el.cimiento?.width, paramsMap, elementsById)}×${formatDim(el.cimiento?.depth, paramsMap, elementsById)}${el.sobrecimiento ? ' + sobrec.' : ''}`)}
                      </td>
                      <td className="py-1.5 text-right">
                        <button className="text-[#3d3d38] hover:text-[#26251f] hover:underline font-medium" onClick={() => goTo(el.id)}>Centrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8a8a85] mb-1">Vanos ({openings.length})</h3>
          {openings.length === 0 ? (
            <p className="text-xs text-[#8a8a85]">Sin vanos.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {openings.map(o => (
                  <tr key={o.id} className="border-t border-[#f2f2ee]">
                    <td className="py-1.5 text-[#8a8a85] w-10">#{o.id}</td>
                    <td className="py-1.5 text-[#3d3d38]">
                      {getOpeningDisplayName(o, o.wall, grid)}
                      <span className="text-[#8a8a85]"> — {formatDim(o.width, paramsMap, elementsById)}×{formatDim(o.height, paramsMap, elementsById)}{o.type === 'window' ? `, antepecho ${formatDim(o.sillHeight, paramsMap, elementsById)}` : ''}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <button className="text-[#3d3d38] hover:text-[#26251f] hover:underline font-medium" onClick={() => goTo(o.id)}>Centrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
