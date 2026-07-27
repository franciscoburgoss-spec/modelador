// components/modals/GenerativePlacementModal.jsx
import { useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { buildParamsMap, resolveValue, isFormula } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { TRIGGERS, computeGenerativeCandidates } from '../../core/generativePlacement.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, FormulaInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const DEFAULT_WIDTH = 300;
const SOURCE_LIBRARY_KEY = { wall: 'wallSections', beam: 'beamSections', foundation: 'foundationSections' };
const SOURCE_LABEL = { wall: 'muros', beam: 'vigas', foundation: 'fundaciones' };

export default function GenerativePlacementModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const addElements = useModelStore((s) => s.addElements);
  const addAxesAndElements = useModelStore((s) => s.addAxesAndElements);
  const columnSections = model.library.columnSections;
  const wallSections = model.library.wallSections;
  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = buildElementsById(model.elements);

  const [trigger, setTrigger] = useState(TRIGGERS[0].id);
  const [sectionFilter, setSectionFilter] = useState(''); // '' = todos los elementos de origen
  const [directionFilter, setDirectionFilter] = useState('both'); // solo aplica a 'endpoint'
  const [sourceType, setSourceType] = useState('wall'); // solo aplica a 'spacing'
  const [spacingRaw, setSpacingRaw] = useState(2000); // mm, o =parametro — solo 'spacing'
  const [startMode, setStartMode] = useState('start'); // solo 'spacing'
  const [tolerance, setTolerance] = useState(1);
  const [bottomZ, setBottomZ] = useState('');
  const [topZ, setTopZ] = useState('');
  const [libraryId, setLibraryId] = useState('');
  const [widthX, setWidthX] = useState(DEFAULT_WIDTH);
  const [widthY, setWidthY] = useState(DEFAULT_WIDTH);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // null hasta generar

  const triggerDef = TRIGGERS.find(t => t.id === trigger);
  const sourceSections = model.library[SOURCE_LIBRARY_KEY[sourceType]] || [];

  const handleSectionChange = (id) => {
    setLibraryId(id);
    const section = columnSections.find(s => s.id === Number(id));
    if (section) { setWidthX(section.widthX); setWidthY(section.widthY); }
  };

  const handlePreview = () => {
    setError('');
    if (!bottomZ || !topZ || bottomZ === topZ) return setError('Selecciona un nivel inferior y superior distintos.');
    const rWidthX = resolveValue(widthX, paramsMap, elementsById);
    const rWidthY = resolveValue(widthY, paramsMap, elementsById);
    if (!isFinite(rWidthX) || !isFinite(rWidthY)) return setError('Alguna dimensión referencia un parámetro inexistente o tiene una fórmula inválida.');
    if (rWidthX <= 0 || rWidthY <= 0) return setError('Las dimensiones deben ser mayores a 0.');
    if (!Number.isFinite(tolerance) || tolerance < 0) return setError('La tolerancia debe ser un número ≥ 0.');

    let rSpacing;
    if (trigger === 'spacing') {
      rSpacing = resolveValue(spacingRaw, paramsMap, elementsById);
      if (!isFinite(rSpacing)) return setError('El espaciamiento referencia un parámetro inexistente o tiene una fórmula inválida.');
      if (rSpacing <= 0) return setError('El espaciamiento debe ser mayor a 0.');
    }

    const result = computeGenerativeCandidates(
      {
        trigger,
        tolerance,
        sectionFilter: sectionFilter ? Number(sectionFilter) : null,
        directionFilter: triggerDef.supportsDirectionFilter ? directionFilter : 'both',
        sourceType,
        spacing: rSpacing,
        startMode,
        bottomZ: Number(bottomZ),
        topZ: Number(topZ)
      },
      model, paramsMap, elementsById
    );
    setPreview(result);
  };

  const toCreate = useMemo(() => (preview?.candidates || []).filter(c => !c.exists), [preview]);

  const handleConfirm = () => {
    if (toCreate.length === 0) return;
    const patch = {
      bottomZ: Number(bottomZ),
      topZ: Number(topZ),
      widthX: isFormula(widthX) ? widthX : Number(widthX),
      widthY: isFormula(widthY) ? widthY : Number(widthY),
      libraryId: libraryId ? Number(libraryId) : null
    };
    const newElements = toCreate.map(c => ({ type: 'column', axisXId: c.xAxis.id, axisYId: c.yAxis.id, ...patch }));
    const axesToCreate = preview.axesToCreate || [];
    if (axesToCreate.length > 0) addAxesAndElements(axesToCreate, newElements);
    else addElements(newElements);
    setPreview(null);
    onClose();
  };

  const resetAndClose = () => { setPreview(null); setError(''); onClose(); };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Colocación generativa por reglas"
      width="max-w-lg"
      footer={<>
        <Button variant="secondary" onClick={resetAndClose}>Cancelar</Button>
        {preview === null ? (
          <Button variant="primary" onClick={handlePreview}>Previsualizar</Button>
        ) : (
          <Button variant="primary" onClick={handleConfirm} disabled={toCreate.length === 0}>
            Crear {toCreate.length} pilar{toCreate.length === 1 ? '' : 'es'}
          </Button>
        )}
      </>}
    >
      <ErrorText>{error}</ErrorText>

      <Field label="Regla">
        <SelectInput value={trigger} onChange={(e) => { setTrigger(e.target.value); setDirectionFilter('both'); setPreview(null); }}>
          {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </SelectInput>
      </Field>
      <p className="text-xs text-[#8a8a85] -mt-2 mb-3">{triggerDef.description}</p>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label={triggerDef.supportsSourceType ? 'Elemento de origen' : 'Muros de origen'} hint="filtra por sección">
          {triggerDef.supportsSourceType && (
            <SelectInput
              value={sourceType}
              onChange={(e) => { setSourceType(e.target.value); setSectionFilter(''); setPreview(null); }}
              className="mb-1.5"
            >
              <option value="wall">Muros</option>
              <option value="beam">Vigas</option>
              <option value="foundation">Fundaciones</option>
            </SelectInput>
          )}
          <SelectInput value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setPreview(null); }}>
            <option value="">-- Todos los {SOURCE_LABEL[triggerDef.supportsSourceType ? sourceType : 'wall']} --</option>
            {(triggerDef.supportsSourceType ? sourceSections : wallSections).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Dirección" hint={triggerDef.supportsDirectionFilter ? undefined : 'no aplica a esta regla'}>
          <SelectInput
            value={directionFilter}
            onChange={(e) => { setDirectionFilter(e.target.value); setPreview(null); }}
            disabled={!triggerDef.supportsDirectionFilter}
          >
            <option value="both">Ambas (X e Y)</option>
            <option value="x">Solo muros en X</option>
            <option value="y">Solo muros en Y</option>
          </SelectInput>
        </Field>
      </div>

      {triggerDef.supportsSpacing && (
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Espaciamiento" hint="mm, o =parametro">
            <FormulaInput value={spacingRaw} onChange={(v) => { setSpacingRaw(v); setPreview(null); }} paramsMap={paramsMap} elementsById={elementsById} projectParams={model.projectParams} />
          </Field>
          <Field label="Modo de arranque">
            <SelectInput value={startMode} onChange={(e) => { setStartMode(e.target.value); setPreview(null); }}>
              <option value="start">Desde el inicio</option>
              <option value="center">Centrado (desde el medio)</option>
              <option value="symmetric">Simétrico (desde ambos extremos, resto al medio)</option>
            </SelectInput>
          </Field>
        </div>
      )}

      <Field label="Tolerancia" hint="mm — distancia máx. para considerar que un punto coincide con un eje">
        <NumberInput value={tolerance} onChange={(e) => { setTolerance(Number(e.target.value)); setPreview(null); }} min={0} step={1} />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Nivel inferior">
          <SelectInput value={bottomZ} onChange={(e) => { setBottomZ(e.target.value); setPreview(null); }}>
            <option value="">--</option>
            {model.grid.zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Nivel superior">
          <SelectInput value={topZ} onChange={(e) => { setTopZ(e.target.value); setPreview(null); }}>
            <option value="">--</option>
            {model.grid.zLevels.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </SelectInput>
        </Field>
      </div>

      <Field label="Sección de librería">
        <SelectInput value={libraryId} onChange={(e) => { handleSectionChange(e.target.value); setPreview(null); }}>
          <option value="">-- Personalizado --</option>
          {columnSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectInput>
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Ancho X" hint="mm, o =parametro">
          <FormulaInput value={widthX} onChange={(v) => { setWidthX(v); setPreview(null); }} paramsMap={paramsMap} elementsById={elementsById} projectParams={model.projectParams} />
        </Field>
        <Field label="Ancho Y" hint="mm, o =parametro">
          <FormulaInput value={widthY} onChange={(v) => { setWidthY(v); setPreview(null); }} paramsMap={paramsMap} elementsById={elementsById} projectParams={model.projectParams} />
        </Field>
      </div>

      {preview !== null && (
        <div className="mt-3 border-t border-[#e4e4e0] pt-3">
          {preview.candidates.length === 0 ? (
            <p className="text-sm text-[#8a8a85]">La regla no encontró ningún punto candidato.</p>
          ) : (
            <>
              <p className="text-xs text-[#5a5a55] mb-1.5">
                {preview.candidates.length} punto{preview.candidates.length === 1 ? '' : 's'} encontrado{preview.candidates.length === 1 ? '' : 's'} —
                {' '}{toCreate.length} nuevo{toCreate.length === 1 ? '' : 's'}, {preview.candidates.length - toCreate.length} ya tiene{preview.candidates.length - toCreate.length === 1 ? '' : 'n'} pilar.
                {preview.axesToCreate?.length > 0 && ` También se crearán ${preview.axesToCreate.length} eje(s) auxiliar(es) nuevo(s).`}
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {preview.candidates.map((c, i) => (
                  <li key={i} className={`text-sm px-3 py-1.5 rounded-md border ${c.exists ? 'bg-[#f2f2ee] border-[#e4e4e0] text-[#8a8a85]' : 'bg-purple-50 border-purple-200 text-purple-900'}`}>
                    {c.xAxis.label} × {c.yAxis.label} {c.exists ? '— ya existe' : (c.xAxis.isNew || c.yAxis.isNew) ? '— nuevo (con eje auxiliar)' : '— nuevo'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
