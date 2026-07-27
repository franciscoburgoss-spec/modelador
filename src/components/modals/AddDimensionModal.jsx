// components/modals/AddDimensionModal.jsx
// ★ Cotas vivas (ítem 6). CRUD de cadenas de cota + preview en vivo (computeDimensionChain).
// No hay selección/hit-test de cotas en el canvas todavía → editar/eliminar se hace desde
// la lista de esta ventana (no haciendo clic en la cota dibujada).

import { useState, useEffect, useMemo } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, ErrorText, AxisRefSelect } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById, isElementRef } from '../../core/elementReferences.js';
import { computeDimensionChain } from '../../core/dimensions.js';
import { getElementShortLabel } from '../../core/naming.js';

function normalizeAxisPoint(raw) {
  return isElementRef(raw) ? raw : Number(raw);
}

// Codificación de puntos Z (nivel de grilla, o borde bottom/top de un elemento) para un <select> plano.
function encodeZOption(raw) {
  if (raw == null) return '';
  if (typeof raw.zLevelId !== 'undefined') return `lvl:${raw.zLevelId}`;
  if (typeof raw.refElementId !== 'undefined') return `ref:${raw.refElementId}:${raw.edge}`;
  return '';
}
function decodeZOption(opt) {
  if (opt.startsWith('lvl:')) return { zLevelId: Number(opt.slice(4)) };
  if (opt.startsWith('ref:')) { const [, id, edge] = opt.split(':'); return { refElementId: id, edge }; }
  return null;
}

function ZPointSelect({ value, onChange, zLevels, elements, grid }) {
  return (
    <select
      value={encodeZOption(value)}
      onChange={(e) => onChange(decodeZOption(e.target.value))}
      className="w-full text-sm border border-[#d8d8d3] rounded-md px-2 py-1.5 bg-white text-[#3d3d38] focus:outline-none focus:ring-2 focus:ring-[#3d3d3855]"
    >
      <option value="" disabled>Seleccionar…</option>
      <optgroup label="Niveles">
        {zLevels.map(z => <option key={z.id} value={`lvl:${z.id}`}>{z.label}</option>)}
      </optgroup>
      {elements.map(el => (
        <optgroup key={el.id} label={getElementShortLabel(el, grid)}>
          <option value={`ref:${el.id}:bottom`}>↳ borde inferior</option>
          <option value={`ref:${el.id}:top`}>↳ borde superior</option>
        </optgroup>
      ))}
    </select>
  );
}

const DEFAULTS = { view: 'plan', zLevelId: '', elevationMode: '', orientation: 'x', linePos: 0 };

export default function AddDimensionModal({ open, onClose }) {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const dimensions = useModelStore((s) => s.model.dimensions || []);
  const addDimension = useModelStore((s) => s.addDimension);
  const updateDimension = useModelStore((s) => s.updateDimension);
  const removeDimension = useModelStore((s) => s.removeDimension);

  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);

  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState(DEFAULTS.view);
  const [zLevelId, setZLevelId] = useState(DEFAULTS.zLevelId);
  const [elevationMode, setElevationMode] = useState(DEFAULTS.elevationMode);
  const [orientation, setOrientation] = useState(DEFAULTS.orientation);
  const [linePos, setLinePos] = useState(DEFAULTS.linePos);
  const [points, setPoints] = useState([null, null]);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setView(DEFAULTS.view); setZLevelId(DEFAULTS.zLevelId); setElevationMode(DEFAULTS.elevationMode);
    setOrientation(DEFAULTS.orientation); setLinePos(DEFAULTS.linePos); setPoints([null, null]);
    setError('');
  };

  useEffect(() => { if (open) resetForm(); }, [open]);

  // Eje perpendicular de la elevación elegida ('x'|'y'), único válido para cotas horizontales en esa vista.
  const perpAxisType = useMemo(() => {
    if (view !== 'elevation' || !elevationMode) return null;
    const [, axisType] = elevationMode.split('-');
    return axisType === 'x' ? 'y' : 'x';
  }, [view, elevationMode]);

  const loadForEdit = (dim) => {
    setEditingId(dim.id);
    setView(dim.view);
    setZLevelId(dim.view === 'plan' ? dim.zLevelId : '');
    setElevationMode(dim.view === 'elevation' ? dim.elevationMode : '');
    setOrientation(dim.orientation);
    setLinePos(dim.linePos);
    setPoints(dim.points);
    setError('');
  };

  const handleViewChange = (v) => {
    setView(v);
    setOrientation(v === 'plan' ? 'x' : (perpAxisType || 'z'));
    setPoints([null, null]);
  };
  const handleElevationModeChange = (modeStr) => {
    setElevationMode(modeStr);
    const [, axisType] = modeStr.split('-');
    setOrientation(axisType === 'x' ? 'y' : 'x'); // por defecto, horizontal
    setPoints([null, null]);
  };
  const handleOrientationChange = (o) => { setOrientation(o); setPoints([null, null]); };

  const updatePoint = (idx, raw) => setPoints(pts => pts.map((p, i) => i === idx ? raw : p));
  const addPointRow = () => setPoints(pts => [...pts, null]);
  const removePointRow = (idx) => setPoints(pts => pts.length > 2 ? pts.filter((_, i) => i !== idx) : pts);

  // ---- preview en vivo ----
  const previewDim = { view, orientation, linePos: Number(linePos) || 0, points };
  const chain = useMemo(() => {
    if (points.some(p => p == null)) return null;
    return computeDimensionChain(previewDim, grid, elementsById, paramsMap);
  }, [JSON.stringify(points), orientation, grid, elementsById, paramsMap]);

  const handleSubmit = () => {
    if (view === 'plan' && !zLevelId) return setError('Selecciona el nivel Z donde vive la cota.');
    if (view === 'elevation' && !elevationMode) return setError('Selecciona la elevación donde vive la cota.');
    if (points.length < 2 || points.some(p => p == null)) return setError('Completa los puntos de la cadena (mínimo 2).');
    if (linePos === '' || isNaN(Number(linePos))) return setError('La posición de la línea de cota debe ser un número.');

    const dimension = {
      view,
      zLevelId: view === 'plan' ? Number(zLevelId) : null,
      elevationMode: view === 'elevation' ? elevationMode : null,
      orientation,
      linePos: Number(linePos),
      points,
    };
    if (editingId) updateDimension(editingId, dimension);
    else addDimension(dimension);
    resetForm();
  };

  const axisOptions = orientation === 'x' ? grid.xAxes : orientation === 'y' ? grid.yAxes : null;
  const linePosLabel = view === 'plan'
    ? (orientation === 'x' ? 'Posición Y de la línea de cota' : 'Posición X de la línea de cota')
    : (orientation === 'z' ? 'Posición horizontal de la línea (perpendicular)' : 'Elevación (Z) de la línea de cota');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cotas vivas"
      width="max-w-2xl"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Agregar cota'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      {dimensions.length > 0 && (
        <div className="mb-4 border border-[#e4e4e0] rounded-md divide-y divide-[#e4e4e0]">
          {dimensions.map(d => (
            <div key={d.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="text-[#3d3d38]">
                {d.view === 'plan' ? `Planta · ${grid.zLevels.find(z => z.id === d.zLevelId)?.label ?? '?'}` : `Elevación · ${d.elevationMode}`}
                {' · '}{d.orientation.toUpperCase()} · {d.points.length} puntos
              </span>
              <span className="flex gap-2">
                <button className="text-[#5a5a55] hover:text-[#1a1a18]" onClick={() => loadForEdit(d)}>Editar</button>
                <button className="text-red-600 hover:text-red-800" onClick={() => removeDimension(d.id)}>Eliminar</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Vista">
          <SelectInput value={view} onChange={(e) => handleViewChange(e.target.value)}>
            <option value="plan">Planta</option>
            <option value="elevation">Elevación</option>
          </SelectInput>
        </Field>

        {view === 'plan' ? (
          <Field label="Nivel Z">
            <SelectInput value={zLevelId} onChange={(e) => setZLevelId(e.target.value)}>
              <option value="">--</option>
              {grid.zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </SelectInput>
          </Field>
        ) : (
          <Field label="Elevación">
            <SelectInput value={elevationMode} onChange={(e) => handleElevationModeChange(e.target.value)}>
              <option value="">--</option>
              {grid.xAxes.map(a => <option key={`ex${a.id}`} value={`elevation-x-${a.id}`}>Elevación X: {a.label}</option>)}
              {grid.yAxes.map(a => <option key={`ey${a.id}`} value={`elevation-y-${a.id}`}>Elevación Y: {a.label}</option>)}
            </SelectInput>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Orientación (qué mide la cadena)">
          <SelectInput value={orientation} onChange={(e) => handleOrientationChange(e.target.value)}>
            {view === 'plan' && <option value="x">Horizontal (a lo largo de X)</option>}
            {view === 'plan' && <option value="y">Vertical (a lo largo de Y)</option>}
            {view === 'elevation' && perpAxisType && <option value={perpAxisType}>Horizontal (ejes {perpAxisType.toUpperCase()})</option>}
            {view === 'elevation' && <option value="z">Vertical (altura, entre niveles/bordes)</option>}
          </SelectInput>
        </Field>
        <Field label={linePosLabel} hint="mm, coordenada absoluta">
          <NumberInput value={linePos} onChange={(e) => setLinePos(e.target.value)} />
        </Field>
      </div>

      <Field label="Puntos de la cadena (en orden)">
        <div className="space-y-1.5">
          {points.map((p, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-xs text-[#8a8a85] w-4">{idx + 1}</span>
              {orientation === 'z'
                ? <ZPointSelect value={p} onChange={(raw) => updatePoint(idx, raw)} zLevels={grid.zLevels} elements={elements} grid={grid} />
                : <AxisRefSelect value={p ?? ''} onChange={(raw) => updatePoint(idx, normalizeAxisPoint(raw))} axes={axisOptions || []} elements={elements} grid={grid} />}
              {points.length > 2 && (
                <button className="text-[#8a8a85] hover:text-red-600 text-sm px-1" onClick={() => removePointRow(idx)}>×</button>
              )}
            </div>
          ))}
        </div>
        <button className="mt-1.5 text-xs text-[#5a5a55] hover:text-[#1a1a18] underline" onClick={addPointRow}>+ agregar punto</button>
      </Field>

      {chain && (
        <div className="mt-3 border border-[#e4e4e0] rounded-md px-3 py-2 text-xs">
          <div className="font-medium text-[#3d3d38] mb-1">Preview</div>
          {chain.segments.map((seg, i) => (
            <div key={i} className={seg.distance == null ? 'text-red-600' : 'text-[#5a5a55]'}>
              Tramo {i + 1}: {seg.distance == null ? 'no resoluble' : `${Math.round(seg.distance)} mm`}
            </div>
          ))}
          <div className={chain.resolved ? 'text-[#0f766e] font-medium mt-1' : 'text-red-600 font-medium mt-1'}>
            Total: {chain.total == null ? 'no resoluble' : `${Math.round(chain.total)} mm`}
          </div>
        </div>
      )}
    </Modal>
  );
}
