// components/FilterPanel.jsx
// Panel de filtro/resaltado por atributo (ítem 7): estado de UI persistente mientras se trabaja
// (no modal, no entra al historial). Destaca (no atenúa) los elementos coincidentes en planta,
// elevación y 3D.
import { useModelStore } from '../store/useModelStore.js';

const TYPE_LABELS = { wall: 'Muro', column: 'Pilar', beam: 'Viga', foundation: 'Fundación' };
const LIBRARY_KEYS = [
  ['wallSections', 'Sección de muro'],
  ['columnSections', 'Sección de pilar'],
  ['beamSections', 'Sección de viga'],
  ['foundationSections', 'Sección de fundación']
];

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

export default function FilterPanel() {
  const show = useModelStore((s) => s.showFilterPanel);
  const filter = useModelStore((s) => s.attributeFilter);
  const setFilter = useModelStore((s) => s.setAttributeFilter);
  const clearFilter = useModelStore((s) => s.clearAttributeFilter);
  const toggleFilterPanel = useModelStore((s) => s.toggleFilterPanel);
  const library = useModelStore((s) => s.model.library);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);

  if (!show) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl w-72 pointer-events-auto"
      style={{ top: 80, left: 56, zIndex: 110, maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 bg-[#f2f2ee] border-b border-[#e4e4e0] rounded-t-lg flex items-center justify-between">
        <span className="font-semibold text-sm text-[#3d3d38]">Filtro por atributo</span>
        <button className="text-[#8a8a85] hover:text-[#5a5a55] text-lg leading-none" onClick={toggleFilterPanel}>×</button>
      </div>

      <div className="p-4 text-sm overflow-y-auto space-y-4">
        <div>
          <div className="text-xs font-semibold text-[#5a5a55] mb-1">Tipo de elemento</div>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <label key={type} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={filter.types.includes(type)}
                onChange={() => setFilter({ types: toggleInArray(filter.types, type) })}
              />
              {label}
            </label>
          ))}
        </div>

        <div>
          <div className="text-xs font-semibold text-[#5a5a55] mb-1">Sección de librería</div>
          {LIBRARY_KEYS.flatMap(([key, prefix]) => (library[key] || []).map(item => (
            <label key={item.id} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={filter.libraryIds.includes(item.id)}
                onChange={() => setFilter({ libraryIds: toggleInArray(filter.libraryIds, item.id) })}
              />
              {prefix}: {item.name}
            </label>
          )))}
        </div>

        <div>
          <div className="text-xs font-semibold text-[#5a5a55] mb-1">Nivel Z</div>
          <select
            className="w-full text-sm border border-[#d8d8d3] rounded-md px-2 py-1 bg-white"
            value={filter.zLevelId ?? ''}
            onChange={(e) => setFilter({ zLevelId: e.target.value || null })}
          >
            <option value="">— cualquiera —</option>
            {zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-[#5a5a55] mb-1">Orientación de muro</div>
          <select
            className="w-full text-sm border border-[#d8d8d3] rounded-md px-2 py-1 bg-white"
            value={filter.wallOrientation ?? ''}
            onChange={(e) => setFilter({ wallOrientation: e.target.value || null })}
          >
            <option value="">— cualquiera —</option>
            <option value="x">Corre en X</option>
            <option value="y">Corre en Y</option>
          </select>
        </div>
      </div>

      <div className="p-3 border-t border-[#e4e4e0]">
        <button
          className="w-full text-center py-1.5 rounded-md border border-[#d8d8d3] hover:bg-[#f2f2ee] text-sm text-[#3d3d38]"
          onClick={clearFilter}
        >
          Limpiar filtro
        </button>
      </div>
    </div>
  );
}
