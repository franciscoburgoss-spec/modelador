// components/modals/GridDefinitionModal.jsx
import { useState, useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { LEVEL_TYPE_OPTIONS } from '../../core/levelTypes.js';
import { TextInput, NumberInput, SelectInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

/** ★ Corregido: antes solo contaba xStart/xEnd/axisXId (muro/pilar) — vigas y fundaciones
 *  nunca se contaban como "en uso" de un eje X/Y, ni como uso de un nivel Z (levelZ). Eso
 *  permitía borrar un eje o nivel usado por una viga/fundación sin ninguna advertencia.
 *  Además: una referencia a otro elemento ({refElementId, edge}) nunca cuenta como "uso
 *  directo" de un eje — el === contra un objeto siempre da false, que es el comportamiento
 *  correcto aquí (no está usando ESTE eje directamente, usa a otro elemento). */
function isElementUsingAxis(el, axisId, tab) {
  if (tab === 'z') {
    return el.bottomZ === axisId || el.topZ === axisId || el.levelZ === axisId;
  }
  if (el.type === 'wall') {
    return tab === 'x' ? (el.xStart === axisId || el.xEnd === axisId) : (el.yStart === axisId || el.yEnd === axisId);
  }
  if (el.type === 'column' || (el.type === 'foundation' && el.foundationType === 'aislada')) {
    return tab === 'x' ? el.axisXId === axisId : el.axisYId === axisId;
  }
  if (el.type === 'beam' || el.type === 'foundation') {
    const fixedIsXType = el.direction === 'y'; // dirección 'y' -> el eje fijo es de tipo X
    if (tab === 'x') {
      return fixedIsXType ? el.fixedAxisId === axisId : (el.startAxisId === axisId || el.endAxisId === axisId);
    }
    return !fixedIsXType ? el.fixedAxisId === axisId : (el.startAxisId === axisId || el.endAxisId === axisId);
  }
  return false;
}

function countUsage(axisId, elements, tab) {
  return elements.filter(el => isElementUsingAxis(el, axisId, tab)).length;
}

export default function GridDefinitionModal({ open, onClose }) {
  const [tab, setTab] = useState('x');
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const addXAxis = useModelStore((s) => s.addXAxis);
  const addYAxis = useModelStore((s) => s.addYAxis);
  const addZLevel = useModelStore((s) => s.addZLevel);
  const updateXAxis = useModelStore((s) => s.updateXAxis);
  const updateYAxis = useModelStore((s) => s.updateYAxis);
  const updateZLevel = useModelStore((s) => s.updateZLevel);
  const removeXAxis = useModelStore((s) => s.removeXAxis);
  const removeYAxis = useModelStore((s) => s.removeYAxis);
  const removeZLevel = useModelStore((s) => s.removeZLevel);

  const config = {
    x: { rows: grid.xAxes, add: () => addXAxis(0, `X${grid.xAxes.length + 1}`), update: updateXAxis, remove: removeXAxis, valueKey: 'position', valueLabel: 'Posición (mm)' },
    y: { rows: grid.yAxes, add: () => addYAxis(0, `Y${grid.yAxes.length + 1}`), update: updateYAxis, remove: removeYAxis, valueKey: 'position', valueLabel: 'Posición (mm)' },
    z: { rows: grid.zLevels, add: () => addZLevel(0, `N${grid.zLevels.length}`), update: updateZLevel, remove: removeZLevel, valueKey: 'elevation', valueLabel: 'Cota (mm)' }
  }[tab];

  const usageCounts = useMemo(
    () => Object.fromEntries(config.rows.map(r => [r.id, countUsage(r.id, elements, tab)])),
    [config.rows, tab, elements]
  );

  const handleRemove = (row) => {
    const count = usageCounts[row.id];
    if (count > 0 && !confirm(`Este eje/nivel está usado por ${count} elemento(s). Al eliminarlo esos elementos dejarán de dibujarse. ¿Continuar?`)) {
      return;
    }
    config.remove(row.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Definir grilla"
      width="max-w-lg"
      bodyClassName="px-5 py-3"
      headerAction={<Button variant="secondary" className="!py-1 !text-xs" onClick={config.add}>+ Agregar fila</Button>}
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="flex gap-1 border-b border-[#e4e4e0] mb-3 -mx-5 px-5">
        {['x', 'y', 'z'].map(t => (
          <button
            key={t}
            className={`px-3 py-1.5 text-sm ${tab === t ? 'text-[#3d3d38] border-b-2 border-[#3d3d38] font-medium' : 'text-[#5a5a55] hover:text-[#3d3d38]'}`}
            onClick={() => setTab(t)}
          >
            {t === 'x' ? 'Ejes X' : t === 'y' ? 'Ejes Y' : 'Niveles Z'}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#5a5a55] text-xs">
            <th className="py-1 font-medium">Etiqueta</th>
            <th className="py-1 font-medium">{config.valueLabel}</th>
            {tab === 'z' && <th className="py-1 font-medium">Tipo</th>}
            <th className="py-1 font-medium">Uso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {config.rows.length === 0 && (
            <tr><td colSpan={tab === 'z' ? 5 : 4} className="py-3 text-xs text-[#8a8a85]">Sin filas todavía.</td></tr>
          )}
          {config.rows.map(row => (
            <tr key={row.id} className="border-t border-[#f2f2ee]">
              <td className="py-1.5 pr-2">
                <TextInput value={row.label} onChange={(e) => config.update(row.id, { label: e.target.value })} />
                {row.type === 'aux' && <span className="text-xs text-[#8a8a85] ml-1">Auxiliar</span>}
              </td>
              <td className="py-1.5 pr-2">
                <NumberInput value={row[config.valueKey]} onChange={(e) => config.update(row.id, { [config.valueKey]: Number(e.target.value) })} />
              </td>
              {tab === 'z' && (
                <td className="py-1.5 pr-2">
                  <SelectInput value={row.levelType || ''} onChange={(e) => config.update(row.id, { levelType: e.target.value || null })}>
                    {LEVEL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </SelectInput>
                </td>
              )}
              <td className="py-1.5 pr-2 text-xs text-[#5a5a55] whitespace-nowrap">{usageCounts[row.id]} elem.</td>
              <td className="py-1.5 text-right">
                <button className="text-[#8a8a85] hover:text-red-600 text-lg leading-none w-6 h-6" title="Eliminar" onClick={() => handleRemove(row)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
