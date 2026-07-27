// components/modals/AddFoundationModal.jsx
// ★ Sesión 11 — una fundación corrida es UN elemento con dos capas (cimiento + sobrecimiento
// opcional); la aislada se ubica por intersección de ejes. Ver core/foundationGeometry.js.
import { useState, useEffect } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput, AxisRefSelect, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';
import { resolveValue, buildParamsMap, isFormula } from '../../core/projectParams.js';
import { isElementRef, axisFieldsEqual, buildElementsById } from '../../core/elementReferences.js';

const D = {
  foundationType: 'corrida', direction: 'x',
  fixedAxisId: '', startAxisId: '', endAxisId: '', axisXId: '', axisYId: '',
  levelZ: '', topOffset: 0, libraryId: '',
  ciWidth: 400, ciDepth: 600,
  hasSobre: true, scLibraryId: '', scWidth: 200, scHeight: 400,
  padX: 1000, padY: 1000, padDepth: 400, columnId: '',
  hasEmp: false, empThickness: 50, empOverhang: 50
};

const normalizeAxis = (raw) => (isElementRef(raw) ? raw : Number(raw));
const numOrFormula = (v) => (isFormula(v) ? v : Number(v));

export default function AddFoundationModal({ open, editingId = null, onClose }) {
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const foundationSections = useModelStore((s) => s.model.library.foundationSections);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);
  const addElement = useModelStore((s) => s.addElement);
  const updateElement = useModelStore((s) => s.updateElement);

  const [f, setF] = useState(D);
  const [error, setError] = useState('');
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!open) return;
    setError('');
    if (!editingId) return setF(D);
    const el = useModelStore.getState().model.elements.find((e) => e.id === editingId);
    if (!el) return;
    setF({
      ...D,
      foundationType: el.foundationType === 'aislada' ? 'aislada' : 'corrida',
      direction: el.direction ?? D.direction,
      fixedAxisId: el.fixedAxisId ?? '', startAxisId: el.startAxisId ?? '', endAxisId: el.endAxisId ?? '',
      axisXId: el.axisXId ?? '', axisYId: el.axisYId ?? '',
      levelZ: el.levelZ ?? '', topOffset: el.topOffset ?? 0, libraryId: el.libraryId ?? '',
      ciWidth: el.cimiento?.width ?? D.ciWidth, ciDepth: el.cimiento?.depth ?? D.ciDepth,
      hasSobre: !!el.sobrecimiento,
      scLibraryId: el.sobrecimiento?.libraryId ?? '',
      scWidth: el.sobrecimiento?.width ?? D.scWidth, scHeight: el.sobrecimiento?.height ?? D.scHeight,
      padX: el.aislada?.lengthX ?? D.padX, padY: el.aislada?.lengthY ?? D.padY, padDepth: el.aislada?.depth ?? D.padDepth,
      columnId: el.columnId ?? '',
      hasEmp: !!el.emplantillado,
      empThickness: el.emplantillado?.thickness ?? D.empThickness,
      empOverhang: el.emplantillado?.overhang ?? D.empOverhang
    });
  }, [open, editingId]);

  const isPad = f.foundationType === 'aislada';
  const fixedAxes = f.direction === 'x' ? yAxes : xAxes;
  const rangeAxes = f.direction === 'x' ? xAxes : yAxes;
  const columns = elements.filter((e) => e.type === 'column');
  const sectionsOf = (itemType) => foundationSections.filter((s) => s.itemType === itemType);

  const pickSection = (itemType, id) => {
    const sec = sectionsOf(itemType).find((s) => s.id === Number(id));
    if (itemType === 'sobrecimiento') {
      set({ scLibraryId: id, ...(sec ? { scWidth: sec.width, scHeight: sec.height } : {}) });
    } else if (itemType === 'aislada') {
      set({ libraryId: id, ...(sec ? { padX: sec.lengthX, padY: sec.lengthY, padDepth: sec.depth } : {}) });
    } else {
      set({ libraryId: id, ...(sec ? { ciWidth: sec.width, ciDepth: sec.depth } : {}) });
    }
  };

  const handleSubmit = () => {
    if (!f.levelZ) return setError('Selecciona el nivel base (a qué piso pertenece esta fundación).');
    const bad = (v) => { const r = resolveValue(v, paramsMap, elementsById); return !isFinite(r) || r <= 0; };

    const common = {
      levelZ: Number(f.levelZ),
      topOffset: numOrFormula(f.topOffset || 0),
      emplantillado: f.hasEmp
        ? { thickness: numOrFormula(f.empThickness), overhang: numOrFormula(f.empOverhang) }
        : null
    };

    let patch;
    if (isPad) {
      if (!f.axisXId || !f.axisYId) return setError('Selecciona los ejes X e Y de la intersección.');
      if ([f.padX, f.padY, f.padDepth].some(bad)) return setError('Largo X, largo Y y altura deben resolver a un número mayor a 0.');
      patch = {
        ...common, foundationType: 'aislada',
        axisXId: normalizeAxis(f.axisXId), axisYId: normalizeAxis(f.axisYId),
        aislada: { lengthX: numOrFormula(f.padX), lengthY: numOrFormula(f.padY), depth: numOrFormula(f.padDepth) },
        columnId: f.columnId ? Number(f.columnId) : null,
        libraryId: f.libraryId ? Number(f.libraryId) : null
      };
    } else {
      if (!f.fixedAxisId || !f.startAxisId || !f.endAxisId) return setError('Selecciona los tres ejes.');
      if (axisFieldsEqual(f.startAxisId, f.endAxisId)) return setError('El eje de inicio y término no pueden ser el mismo.');
      if ([f.ciWidth, f.ciDepth].some(bad)) return setError('Ancho y profundidad del cimiento deben resolver a un número mayor a 0.');
      if (f.hasSobre && [f.scWidth, f.scHeight].some(bad)) return setError('Ancho y altura del sobrecimiento deben resolver a un número mayor a 0.');
      patch = {
        ...common, foundationType: 'corrida', direction: f.direction,
        fixedAxisId: normalizeAxis(f.fixedAxisId),
        startAxisId: normalizeAxis(f.startAxisId),
        endAxisId: normalizeAxis(f.endAxisId),
        cimiento: { width: numOrFormula(f.ciWidth), depth: numOrFormula(f.ciDepth) },
        sobrecimiento: f.hasSobre
          ? { width: numOrFormula(f.scWidth), height: numOrFormula(f.scHeight), libraryId: f.scLibraryId ? Number(f.scLibraryId) : null }
          : null,
        libraryId: f.libraryId ? Number(f.libraryId) : null
      };
    }

    if (editingId) updateElement(editingId, patch);
    else addElement({ type: 'foundation', ...patch });
    onClose();
  };

  const formula = (value, onChange) => (
    <FormulaInput value={value} onChange={onChange} paramsMap={paramsMap} elementsById={elementsById} projectParams={projectParams} />
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Editar fundación' : 'Nueva fundación'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Guardar cambios' : 'Crear'}</Button>
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <Field label="Tipo">
        <SelectInput value={f.foundationType} onChange={(e) => set({ foundationType: e.target.value, libraryId: '' })}>
          <option value="corrida">Corrida (cimiento + sobrecimiento)</option>
          <option value="aislada">Aislada (poyo / zapata bajo pilar)</option>
        </SelectInput>
      </Field>

      {isPad ? (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Eje X"><AxisRefSelect value={f.axisXId} onChange={(v) => set({ axisXId: v })} axes={xAxes} elements={elements} excludeElementId={editingId} grid={grid} /></Field>
            <Field label="Eje Y"><AxisRefSelect value={f.axisYId} onChange={(v) => set({ axisYId: v })} axes={yAxes} elements={elements} excludeElementId={editingId} grid={grid} /></Field>
          </div>
          <Field label="Pilar de referencia" hint="informativo, no crea dependencia geométrica">
            <SelectInput value={f.columnId} onChange={(e) => set({ columnId: e.target.value })}>
              <option value="">-- Ninguno --</option>
              {columns.map((c) => <option key={c.id} value={c.id}>Pilar #{c.id}</option>)}
            </SelectInput>
          </Field>
        </>
      ) : (
        <>
          <Field label="Dirección">
            <SelectInput value={f.direction} onChange={(e) => set({ direction: e.target.value, fixedAxisId: '', startAxisId: '', endAxisId: '' })}>
              <option value="x">Corre en X (fija en eje Y)</option>
              <option value="y">Corre en Y (fija en eje X)</option>
            </SelectInput>
          </Field>
          <Field label={`Eje fijo (${f.direction === 'x' ? 'Y' : 'X'})`}>
            <AxisRefSelect value={f.fixedAxisId} onChange={(v) => set({ fixedAxisId: v })} axes={fixedAxes} elements={elements} excludeElementId={editingId} grid={grid} />
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label={`Desde (${f.direction === 'x' ? 'X' : 'Y'})`}>
              <AxisRefSelect value={f.startAxisId} onChange={(v) => set({ startAxisId: v })} axes={rangeAxes} elements={elements} excludeElementId={editingId} grid={grid} />
            </Field>
            <Field label={`Hasta (${f.direction === 'x' ? 'X' : 'Y'})`} hint="puede referenciar el borde de otro elemento">
              <AxisRefSelect value={f.endAxisId} onChange={(v) => set({ endAxisId: v })} axes={rangeAxes} elements={elements} excludeElementId={editingId} grid={grid} />
            </Field>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Nivel base (NPT)" hint="la fundación queda debajo">
          <SelectInput value={f.levelZ} onChange={(e) => set({ levelZ: e.target.value })}>
            <option value="">--</option>
            {zLevels.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Desfase del tope" hint="mm respecto al NPT; 0 = empatan">
          {formula(f.topOffset, (v) => set({ topOffset: v }))}
        </Field>
      </div>

      {isPad ? (
        <>
          <Field label="Sección de librería">
            <SelectInput value={f.libraryId} onChange={(e) => pickSection('aislada', e.target.value)}>
              <option value="">-- Personalizado --</option>
              {sectionsOf('aislada').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-3 gap-x-3">
            <Field label="Largo X" hint="mm">{formula(f.padX, (v) => set({ padX: v }))}</Field>
            <Field label="Largo Y" hint="mm">{formula(f.padY, (v) => set({ padY: v }))}</Field>
            <Field label="Altura" hint="mm">{formula(f.padDepth, (v) => set({ padDepth: v }))}</Field>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Cimiento</div>
          <Field label="Sección de librería">
            <SelectInput value={f.libraryId} onChange={(e) => pickSection('cimiento', e.target.value)}>
              <option value="">-- Personalizado --</option>
              {sectionsOf('cimiento').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Ancho" hint="mm, o =parametro">{formula(f.ciWidth, (v) => set({ ciWidth: v }))}</Field>
            <Field label="Profundidad" hint="mm, o =parametro">{formula(f.ciDepth, (v) => set({ ciDepth: v }))}</Field>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.hasSobre} onChange={(e) => set({ hasSobre: e.target.checked })} />
            Lleva sobrecimiento
          </label>
          {f.hasSobre && (
            <>
              <Field label="Sección de librería">
                <SelectInput value={f.scLibraryId} onChange={(e) => pickSection('sobrecimiento', e.target.value)}>
                  <option value="">-- Personalizado --</option>
                  {sectionsOf('sobrecimiento').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectInput>
              </Field>
              <div className="grid grid-cols-2 gap-x-3">
                <Field label="Ancho" hint="mm, o =parametro">{formula(f.scWidth, (v) => set({ scWidth: v }))}</Field>
                <Field label="Altura" hint="mm, o =parametro">{formula(f.scHeight, (v) => set({ scHeight: v }))}</Field>
              </div>
            </>
          )}
        </>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={f.hasEmp} onChange={(e) => set({ hasEmp: e.target.checked })} />
        Lleva emplantillado
      </label>
      {f.hasEmp && (
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Espesor" hint="mm">{formula(f.empThickness, (v) => set({ empThickness: v }))}</Field>
          <Field label="Sobreancho" hint="mm por lado">{formula(f.empOverhang, (v) => set({ empOverhang: v }))}</Field>
        </div>
      )}
    </Modal>
  );
}
