import { useEffect, useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import {
  buildProjectElementInventory,
  filterProjectElementRows
} from '../../core/projectElementInventory.js';
import Modal from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { ErrorText, Field, SelectInput, TextInput } from '../ui/Field.jsx';

const STATUS_LABELS = {
  complete: 'Completo',
  'untyped-wall': 'Sin tipo / rol',
  'stale-framing': 'Metalcon desactualizado',
  'stale-osb': 'OSB desactualizado'
};

const TYPE_OPTIONS = [
  ['all', 'Todos'],
  ['wall', 'Muros'],
  ['column', 'Pilares'],
  ['beam', 'Vigas'],
  ['foundation', 'Fundaciones'],
  ['door', 'Puertas'],
  ['window', 'Ventanas']
];

function resolveWallTypeId(wallTypes, raw) {
  if (raw === '__none__') return null;
  return wallTypes.find((wallType) => String(wallType.id) === String(raw))?.id;
}

export default function ElementInventoryModal({
  open,
  onClose,
  onEdit,
  canvasSize
}) {
  const model = useModelStore((state) => state.model);
  const assignWallTypesBatch = useModelStore((state) => state.assignWallTypesBatch);
  const centerOnElement = useModelStore((state) => state.centerOnElement);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [levelId, setLevelId] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedWallIds, setSelectedWallIds] = useState(() => new Set());
  const [bulkWallTypeId, setBulkWallTypeId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setType('all');
    setLevelId('all');
    setStatus('all');
    setSelectedWallIds(new Set());
    setBulkWallTypeId('');
    setError('');
  }, [open]);

  const rows = useMemo(() => buildProjectElementInventory(model), [model]);
  const filteredRows = useMemo(() => filterProjectElementRows(rows, {
    query,
    type,
    levelId,
    status
  }), [rows, query, type, levelId, status]);
  const untypedCount = rows.filter((row) => row.statuses.includes('untyped-wall')).length;
  const filteredWallIds = filteredRows
    .filter((row) => row.type === 'wall')
    .map((row) => row.id);
  const wallTypes = model.wallTypes || [];

  const toggleWall = (wallId) => {
    setSelectedWallIds((current) => {
      const next = new Set(current);
      if (next.has(wallId)) next.delete(wallId);
      else next.add(wallId);
      return next;
    });
  };

  const selectFilteredWalls = () => {
    setSelectedWallIds((current) => new Set([...current, ...filteredWallIds]));
  };

  const assign = (wallIds, rawWallTypeId, { confirmBatch = false } = {}) => {
    const wallTypeId = resolveWallTypeId(wallTypes, rawWallTypeId);
    if (rawWallTypeId !== '__none__' && wallTypeId == null) {
      setError('Selecciona un tipo de muro válido.');
      return;
    }
    if (
      confirmBatch
      && !confirm(
        `¿Asignar ${wallTypeId == null ? 'Sin tipo / rol' : wallTypes.find((item) => item.id === wallTypeId).name} a ${wallIds.length} muro(s)?`
      )
    ) return;
    try {
      assignWallTypesBatch(wallIds, wallTypeId);
      setError('');
      if (confirmBatch) setSelectedWallIds(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const locate = (row) => {
    centerOnElement(row.id, canvasSize.width, canvasSize.height);
    onClose();
  };

  const edit = (row) => {
    onEdit(
      row.type === 'door' || row.type === 'window' ? 'opening' : row.type,
      row.id,
      row.parentId
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Listado de elementos del proyecto"
      width="max-w-6xl"
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
      bodyClassName="px-5 py-4"
    >
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="text-sm text-[#5a5a55] bg-[#f2f2ee] border border-[#e4e4e0] rounded-md px-3 py-2">
          {rows.length} elementos y vanos
        </div>
        {untypedCount > 0 && (
          <button
            type="button"
            className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 hover:bg-amber-100"
            onClick={() => {
              setStatus('untyped-wall');
              setType('wall');
            }}
            aria-label={`Mostrar los ${untypedCount} sin tipo`}
          >
            {untypedCount} muros sin tipo / rol
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-2">
        <Field label="Buscar">
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, ID, sección…"
          />
        </Field>
        <Field label="Clase">
          <SelectInput value={type} onChange={(event) => setType(event.target.value)}>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Nivel">
          <SelectInput value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            <option value="all">Todos</option>
            {(model.grid?.zLevels || []).map((level) => (
              <option key={level.id} value={level.id}>{level.label ?? level.name ?? level.id}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Estado">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Todos</option>
            <option value="untyped-wall">Sin tipo / rol</option>
            <option value="stale-framing">Metalcon desactualizado</option>
            <option value="stale-osb">OSB desactualizado</option>
            <option value="complete">Completo</option>
          </SelectInput>
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 border border-[#e4e4e0] rounded-lg">
        <Button
          type="button"
          onClick={selectFilteredWalls}
          disabled={filteredWallIds.length === 0}
        >
          Seleccionar muros filtrados
        </Button>
        <Button
          type="button"
          onClick={() => setSelectedWallIds(new Set())}
          disabled={selectedWallIds.size === 0}
        >
          Deseleccionar
        </Button>
        <label className="text-sm min-w-60">
          <span className="block font-medium text-[#1a1a18] mb-1">Tipo para selección</span>
          <SelectInput
            aria-label="Tipo para selección"
            value={bulkWallTypeId}
            onChange={(event) => setBulkWallTypeId(event.target.value)}
          >
            <option value="">Seleccionar…</option>
            <option value="__none__">Quitar tipo / rol</option>
            {wallTypes.map((wallType) => (
              <option key={wallType.id} value={wallType.id}>
                {wallType.name} · {wallType.role}
              </option>
            ))}
          </SelectInput>
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={selectedWallIds.size === 0 || bulkWallTypeId === ''}
          onClick={() => assign(
            [...selectedWallIds],
            bulkWallTypeId,
            { confirmBatch: true }
          )}
        >
          Aplicar a {selectedWallIds.size} muros
        </Button>
      </div>

      <div className="border border-[#e4e4e0] rounded-lg overflow-auto max-h-[52vh]">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="sticky top-0 bg-[#f2f2ee] text-[#5a5a55]">
            <tr>
              <th className="w-9 px-2 py-2 text-left">Sel.</th>
              <th className="px-2 py-2 text-left">Elemento</th>
              <th className="px-2 py-2 text-left">Clase</th>
              <th className="px-2 py-2 text-left">Nivel</th>
              <th className="px-2 py-2 text-left">Sección</th>
              <th className="px-2 py-2 text-left min-w-52">Tipo y rol</th>
              <th className="px-2 py-2 text-left">Estado</th>
              <th className="px-2 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.key} className="border-t border-[#e4e4e0] align-top">
                <td className="px-2 py-2">
                  {row.type === 'wall' && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar muro ${row.id}`}
                      checked={selectedWallIds.has(row.id)}
                      onChange={() => toggleWall(row.id)}
                    />
                  )}
                </td>
                <td className="px-2 py-2 text-[#1a1a18]">
                  <div className="font-medium">{row.label}</div>
                  <div className="text-[#8a8a85]">#{row.id}</div>
                </td>
                <td className="px-2 py-2">{row.typeLabel}</td>
                <td className="px-2 py-2">{row.levelLabel}</td>
                <td className="px-2 py-2">{row.sectionLabel}</td>
                <td className="px-2 py-2">
                  {row.type === 'wall' ? (
                    <SelectInput
                      aria-label={`Tipo y rol del muro ${row.id}`}
                      value={row.wallTypeId == null ? '__none__' : String(row.wallTypeId)}
                      onChange={(event) => assign([row.id], event.target.value)}
                      className="!text-xs !py-1"
                    >
                      <option value="__none__">Sin tipo / rol</option>
                      {wallTypes.map((wallType) => (
                        <option key={wallType.id} value={wallType.id}>
                          {wallType.name} · {wallType.role}
                        </option>
                      ))}
                    </SelectInput>
                  ) : '—'}
                </td>
                <td className="px-2 py-2">
                  {(row.statuses.length > 0 ? row.statuses : ['complete']).map((item) => (
                    <div
                      key={item}
                      className={item === 'untyped-wall' ? 'text-amber-700 font-medium' : 'text-[#5a5a55]'}
                    >
                      {STATUS_LABELS[item] ?? item}
                    </div>
                  ))}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="text-[#3d3d38] hover:underline mr-3"
                    onClick={() => locate(row)}
                  >
                    Localizar
                  </button>
                  <button
                    type="button"
                    aria-label={`Editar ${row.typeLabel.toLocaleLowerCase('es')} ${row.id}`}
                    className="text-[#3d3d38] hover:underline font-medium"
                    onClick={() => edit(row)}
                  >
                    Editar…
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <p className="text-center text-sm text-[#8a8a85] py-8">
            No hay elementos que coincidan con los filtros.
          </p>
        )}
      </div>
    </Modal>
  );
}
