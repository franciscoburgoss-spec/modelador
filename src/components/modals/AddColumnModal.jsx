// components/modals/AddColumnModal.jsx
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput, AxisRefSelect, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';
import { isElementRef, buildElementsById } from '../../core/elementReferences.js';

const DEFAULTS = { axisXId: '', axisYId: '', bottomZ: '', topZ: '', libraryId: '', widthX: 300, widthY: 300 };

function normalizeAxisField(raw) {
  return isElementRef(raw) ? raw : Number(raw);
}

export default function AddColumnModal({ open, editingId = null, initialValues = null, onClose }) {
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const columnSections = useModelStore((s) => s.model.library.columnSections);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const addElement = useModelStore((s) => s.addElement);
  const updateElement = useModelStore((s) => s.updateElement);

  const [axisXId, setAxisXId] = useState(DEFAULTS.axisXId);
  const [axisYId, setAxisYId] = useState(DEFAULTS.axisYId);
  const [bottomZ, setBottomZ] = useState(DEFAULTS.bottomZ);
  const [topZ, setTopZ] = useState(DEFAULTS.topZ);
  const [libraryId, setLibraryId] = useState(DEFAULTS.libraryId);
  const [widthX, setWidthX] = useState(DEFAULTS.widthX);
  const [widthY, setWidthY] = useState(DEFAULTS.widthY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingId) {
      const el = useModelStore.getState().model.elements.find(e => e.id === editingId);
      if (!el) return;
      setAxisXId(el.axisXId); setAxisYId(el.axisYId);
      setBottomZ(el.bottomZ ?? ''); setTopZ(el.topZ ?? '');
      setLibraryId(el.libraryId ?? '');
      setWidthX(el.widthX); setWidthY(el.widthY);
    } else {
      setAxisXId(initialValues?.axisXId ?? DEFAULTS.axisXId);
      setAxisYId(initialValues?.axisYId ?? DEFAULTS.axisYId);
      setBottomZ(DEFAULTS.bottomZ); setTopZ(DEFAULTS.topZ);
      setLibraryId(DEFAULTS.libraryId);
      setWidthX(DEFAULTS.widthX); setWidthY(DEFAULTS.widthY);
    }
  }, [open, editingId, initialValues]);

  const handleSectionChange = (id) => {
    setLibraryId(id);
    const section = columnSections.find(s => s.id === Number(id));
    if (section) { setWidthX(section.widthX); setWidthY(section.widthY); }
  };

  const handleSubmit = () => {
    if (!axisXId || !axisYId) return setError('Selecciona ambos ejes.');
    if (!bottomZ || !topZ || bottomZ === topZ) return setError('Selecciona un nivel inferior y superior distintos.');
    const rWidthX = resolveValue(widthX, paramsMap, elementsById);
    const rWidthY = resolveValue(widthY, paramsMap, elementsById);
    if (!isFinite(rWidthX) || !isFinite(rWidthY)) return setError('Alguna dimensión referencia un parámetro inexistente o tiene una fórmula inválida.');
    if (rWidthX <= 0 || rWidthY <= 0) return setError('Las dimensiones deben ser mayores a 0.');

    const patch = {
      axisXId: normalizeAxisField(axisXId),
      axisYId: normalizeAxisField(axisYId),
      bottomZ: Number(bottomZ),
      topZ: Number(topZ),
      widthX: isFormula(widthX) ? widthX : Number(widthX),
      widthY: isFormula(widthY) ? widthY : Number(widthY),
      libraryId: libraryId ? Number(libraryId) : null
    };

    if (editingId) updateElement(editingId, patch);
    else addElement({ type: 'column', ...patch });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Editar pilar' : 'Nuevo pilar'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Crear'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Eje X">
          <AxisRefSelect value={axisXId} onChange={setAxisXId} axes={xAxes} elements={elements} excludeElementId={editingId} grid={grid} />
        </Field>
        <Field label="Eje Y">
          <AxisRefSelect value={axisYId} onChange={setAxisYId} axes={yAxes} elements={elements} excludeElementId={editingId} grid={grid} />
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
          {columnSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectInput>
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Ancho X" hint="mm, o =parametro">
          <FormulaInput value={widthX} onChange={setWidthX} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
        <Field label="Ancho Y" hint="mm, o =parametro">
          <FormulaInput value={widthY} onChange={setWidthY} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
        </Field>
      </div>
    </Modal>
  );
}
