// components/modals/AddWallModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput, AxisRefSelect, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';
import { isElementRef, axisFieldsEqual, buildElementsById } from '../../core/elementReferences.js';
import { isWallXRun } from '../../core/elementGeometry.js';

const DEFAULTS = { direction: 'x', fixedAxisId: '', startAxisId: '', endAxisId: '', bottomZ: '', topZ: '', libraryId: '', wallTypeId: '', thickness: 140 };

function normalizeAxisField(raw) {
  return isElementRef(raw) ? raw : Number(raw);
}

export default function AddWallModal({ open, editingId = null, onClose }) {
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const wallSections = useModelStore((s) => s.model.library.wallSections);
  const wallTypes = useModelStore((s) => s.model.wallTypes || []);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const addElement = useModelStore((s) => s.addElement);
  const updateElement = useModelStore((s) => s.updateElement);
  const assignWallType = useModelStore((s) => s.assignWallType);

  const [direction, setDirection] = useState(DEFAULTS.direction);
  const [fixedAxisId, setFixedAxisId] = useState(DEFAULTS.fixedAxisId);
  const [startAxisId, setStartAxisId] = useState(DEFAULTS.startAxisId);
  const [endAxisId, setEndAxisId] = useState(DEFAULTS.endAxisId);
  const [bottomZ, setBottomZ] = useState(DEFAULTS.bottomZ);
  const [topZ, setTopZ] = useState(DEFAULTS.topZ);
  const [libraryId, setLibraryId] = useState(DEFAULTS.libraryId);
  const [wallTypeId, setWallTypeId] = useState(DEFAULTS.wallTypeId);
  const [thickness, setThickness] = useState(DEFAULTS.thickness);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingId) {
      const el = useModelStore.getState().model.elements.find(e => e.id === editingId);
      if (!el) return;
      const isXRun = isWallXRun(el);
      setDirection(isXRun ? 'x' : 'y');
      setFixedAxisId(isXRun ? el.yStart : el.xStart);
      setStartAxisId(isXRun ? el.xStart : el.yStart);
      setEndAxisId(isXRun ? el.xEnd : el.yEnd);
      setBottomZ(el.bottomZ ?? '');
      setTopZ(el.topZ ?? '');
      setLibraryId(el.libraryId ?? '');
      setWallTypeId(el.wallTypeId ?? '');
      setThickness(el.thickness);
    } else {
      setDirection(DEFAULTS.direction);
      setFixedAxisId(DEFAULTS.fixedAxisId);
      setStartAxisId(DEFAULTS.startAxisId);
      setEndAxisId(DEFAULTS.endAxisId);
      setBottomZ(DEFAULTS.bottomZ);
      setTopZ(DEFAULTS.topZ);
      setLibraryId(DEFAULTS.libraryId);
      setWallTypeId(DEFAULTS.wallTypeId);
      setThickness(DEFAULTS.thickness);
    }
  }, [open, editingId]);

  const fixedAxes = direction === 'x' ? yAxes : xAxes;
  const rangeAxes = direction === 'x' ? xAxes : yAxes;

  const handleSectionChange = (id) => {
    setLibraryId(id);
    const section = wallSections.find(s => s.id === Number(id));
    if (section) setThickness(section.thickness);
  };

  const handleSubmit = () => {
    if (!fixedAxisId || !startAxisId || !endAxisId) return setError('Selecciona los ejes de planta.');
    if (axisFieldsEqual(startAxisId, endAxisId)) return setError('El eje de inicio y término no pueden ser el mismo.');
    if (!bottomZ || !topZ || bottomZ === topZ) return setError('Selecciona un nivel inferior y superior distintos.');
    const resolvedThickness = resolveValue(thickness, paramsMap, elementsById);
    if (!isFinite(resolvedThickness)) return setError('El espesor referencia un parámetro inexistente o tiene una fórmula inválida.');
    if (resolvedThickness <= 0) return setError('El espesor debe ser mayor a 0.');

    const fixed = normalizeAxisField(fixedAxisId);
    const start = normalizeAxisField(startAxisId);
    const end = normalizeAxisField(endAxisId);
    const wall = direction === 'x'
      ? { xStart: start, xEnd: end, yStart: fixed, yEnd: fixed }
      : { yStart: start, yEnd: end, xStart: fixed, xEnd: fixed };

    const patch = {
      ...wall,
      direction,
      bottomZ: Number(bottomZ),
      topZ: Number(topZ),
      thickness: isFormula(thickness) ? thickness : Number(thickness),
      libraryId: libraryId ? Number(libraryId) : null
    };
    const selectedWallTypeId = wallTypeId === ''
      ? null
      : wallTypes.find((type) => String(type.id) === String(wallTypeId))?.id;

    if (editingId) {
      updateElement(editingId, patch);
      assignWallType(editingId, selectedWallTypeId);
    } else {
      addElement({
        type: 'wall',
        ...patch,
        ...(selectedWallTypeId != null ? { wallTypeId: selectedWallTypeId } : {}),
        openings: []
      });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Editar muro' : 'Nuevo muro'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Crear'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>
      {zLevels.length < 2 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
          Necesitas al menos 2 niveles Z creados (Menú Ejes → + Nivel Z).
        </p>
      )}

      <Field label="Dirección">
        <SelectInput value={direction} onChange={(e) => {
          setDirection(e.target.value);
          setFixedAxisId(''); setStartAxisId(''); setEndAxisId('');
        }}>
          <option value="x">Corre en X (fijo en eje Y)</option>
          <option value="y">Corre en Y (fijo en eje X)</option>
        </SelectInput>
      </Field>

      <Field label={`Eje fijo (${direction === 'x' ? 'Y' : 'X'})`}>
        <AxisRefSelect value={fixedAxisId} onChange={setFixedAxisId} axes={fixedAxes} elements={elements} excludeElementId={editingId} grid={grid} />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label={`Desde (${direction === 'x' ? 'X' : 'Y'})`}>
          <AxisRefSelect value={startAxisId} onChange={setStartAxisId} axes={rangeAxes} elements={elements} excludeElementId={editingId} grid={grid} />
        </Field>
        <Field label={`Hasta (${direction === 'x' ? 'X' : 'Y'})`} hint="puede referenciar el borde de otro elemento">
          <AxisRefSelect value={endAxisId} onChange={setEndAxisId} axes={rangeAxes} elements={elements} excludeElementId={editingId} grid={grid} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Nivel inferior">
          <SelectInput value={bottomZ} onChange={(e) => setBottomZ(e.target.value)}>
            <option value="">--</option>
            {zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Nivel superior">
          <SelectInput value={topZ} onChange={(e) => setTopZ(e.target.value)}>
            <option value="">--</option>
            {zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </SelectInput>
        </Field>
      </div>

      <Field label="Sección de librería">
        <SelectInput value={libraryId} onChange={(e) => handleSectionChange(e.target.value)}>
          <option value="">-- Personalizado --</option>
          {wallSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectInput>
      </Field>

      <Field
        label="Tipo y rol de muro"
        hint={wallTypeId ? 'la configuración de modulación vive en el tipo' : 'compatibilidad legacy: usa defaults/overrides históricos'}
      >
        <SelectInput value={wallTypeId} onChange={(e) => setWallTypeId(e.target.value)}>
          <option value="">Sin tipo / rol (legacy)</option>
          {wallTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name} · {type.role}</option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Espesor" hint="mm, o =nombre_parametro">
        <FormulaInput value={thickness} onChange={setThickness} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
      </Field>
    </Modal>
  );
}
