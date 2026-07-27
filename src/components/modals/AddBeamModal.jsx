// components/modals/AddBeamModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput, AxisRefSelect, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';
import { isElementRef, axisFieldsEqual, buildElementsById } from '../../core/elementReferences.js';

const DEFAULTS = { direction: 'x', fixedAxisId: '', startAxisId: '', endAxisId: '', levelZ: '', libraryId: '', width: 300, height: 500 };

// Un campo de eje puede ser ID de eje (Number-ificar al guardar) o referencia a elemento (dejar tal cual).
function normalizeAxisField(raw) {
  return isElementRef(raw) ? raw : Number(raw);
}

export default function AddBeamModal({ open, editingId = null, onClose }) {
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const beamSections = useModelStore((s) => s.model.library.beamSections);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const addElement = useModelStore((s) => s.addElement);
  const updateElement = useModelStore((s) => s.updateElement);

  const [direction, setDirection] = useState(DEFAULTS.direction);
  const [fixedAxisId, setFixedAxisId] = useState(DEFAULTS.fixedAxisId);
  const [startAxisId, setStartAxisId] = useState(DEFAULTS.startAxisId);
  const [endAxisId, setEndAxisId] = useState(DEFAULTS.endAxisId);
  const [levelZ, setLevelZ] = useState(DEFAULTS.levelZ);
  const [libraryId, setLibraryId] = useState(DEFAULTS.libraryId);
  const [width, setWidth] = useState(DEFAULTS.width);
  const [height, setHeight] = useState(DEFAULTS.height);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingId) {
      const el = useModelStore.getState().model.elements.find(e => e.id === editingId);
      if (!el) return;
      setDirection(el.direction);
      setFixedAxisId(el.fixedAxisId); setStartAxisId(el.startAxisId); setEndAxisId(el.endAxisId);
      setLevelZ(el.levelZ ?? '');
      setLibraryId(el.libraryId ?? '');
      setWidth(el.width); setHeight(el.height ?? DEFAULTS.height);
    } else {
      setDirection(DEFAULTS.direction);
      setFixedAxisId(DEFAULTS.fixedAxisId); setStartAxisId(DEFAULTS.startAxisId); setEndAxisId(DEFAULTS.endAxisId);
      setLevelZ(DEFAULTS.levelZ);
      setLibraryId(DEFAULTS.libraryId);
      setWidth(DEFAULTS.width); setHeight(DEFAULTS.height);
    }
  }, [open, editingId]);

  const fixedAxes = direction === 'x' ? yAxes : xAxes;
  const rangeAxes = direction === 'x' ? xAxes : yAxes;

  const handleSectionChange = (id) => {
    setLibraryId(id);
    const section = beamSections.find(s => s.id === Number(id));
    if (section) { setWidth(section.width); setHeight(section.height); }
  };

  const handleSubmit = () => {
    if (!fixedAxisId || !startAxisId || !endAxisId) return setError('Selecciona los tres ejes.');
    if (axisFieldsEqual(startAxisId, endAxisId)) return setError('El eje de inicio y término no pueden ser el mismo.');
    if (!levelZ) return setError('Selecciona el nivel Z de la viga.');
    const rWidth = resolveValue(width, paramsMap, elementsById);
    if (!isFinite(rWidth)) return setError('El ancho referencia un parámetro inexistente o tiene una fórmula inválida.');
    if (rWidth <= 0) return setError('El ancho debe ser mayor a 0.');
    const rHeight = resolveValue(height, paramsMap, elementsById);
    if (!isFinite(rHeight)) return setError('El alto referencia un parámetro inexistente o tiene una fórmula inválida.');
    if (rHeight <= 0) return setError('El alto debe ser mayor a 0.');

    const patch = {
      direction,
      fixedAxisId: normalizeAxisField(fixedAxisId),
      startAxisId: normalizeAxisField(startAxisId),
      endAxisId: normalizeAxisField(endAxisId),
      levelZ: Number(levelZ),
      width: isFormula(width) ? width : Number(width),
      height: isFormula(height) ? height : Number(height),
      libraryId: libraryId ? Number(libraryId) : null
    };

    if (editingId) updateElement(editingId, patch);
    else addElement({ type: 'beam', ...patch });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Editar viga' : 'Nueva viga'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Crear'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <Field label="Dirección">
        <SelectInput value={direction} onChange={(e) => {
          setDirection(e.target.value);
          setFixedAxisId(''); setStartAxisId(''); setEndAxisId('');
        }}>
          <option value="x">Corre en X (fija en eje Y)</option>
          <option value="y">Corre en Y (fija en eje X)</option>
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

      <Field label="Nivel Z">
        <SelectInput value={levelZ} onChange={(e) => setLevelZ(e.target.value)}>
          <option value="">--</option>
          {zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
        </SelectInput>
      </Field>

      <Field label="Sección de librería">
        <SelectInput value={libraryId} onChange={(e) => handleSectionChange(e.target.value)}>
          <option value="">-- Personalizado --</option>
          {beamSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectInput>
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Ancho" hint="mm, o =parametro">
          <FormulaInput value={width} onChange={setWidth} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
        <Field label="Alto" hint="mm, o =parametro">
          <FormulaInput value={height} onChange={setHeight} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
      </div>
    </Modal>
  );
}
