// components/modals/GenerateFoundationsModal.jsx
// ★ Sesión 12 — genera fundaciones corridas bajo los muros del nivel base (fusionando
// tramos colineales) y, opcionalmente, poyos aislados bajo pilares sueltos.
import { useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { generateFoundationsFromWalls } from '../../core/foundationGeneration.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, NumberInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

export default function GenerateFoundationsModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const addElements = useModelStore((s) => s.addElements);
  const ciSections = (model.library.foundationSections || []).filter((s) => s.itemType === 'cimiento');
  const padSections = (model.library.foundationSections || []).filter((s) => s.itemType === 'aislada');

  const [sectionId, setSectionId] = useState('');
  const [includePads, setIncludePads] = useState(false);
  const [padSectionId, setPadSectionId] = useState('');
  const [tolerance, setTolerance] = useState(5);
  // ★ BUGFIX — antes el nivel base era implícito (elevación 0 = NTN) y en un proyecto normal,
  // con la tabiquería arrancando en NPT (+450), no encontraba un solo muro. Ahora es visible y
  // elegible; '' = automático (ver resolveBaseLevel).
  const [baseLevelId, setBaseLevelId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // null hasta generar

  const handlePreview = () => {
    setError('');
    const out = generateFoundationsFromWalls(model, {
      baseLevelId: baseLevelId === '' ? null : Number(baseLevelId),
      defaultSectionId: sectionId ? Number(sectionId) : null,
      includeIsolatedUnderColumns: includePads,
      defaultPadSectionId: padSectionId ? Number(padSectionId) : null,
      tolerance: Number(tolerance) || 5
    });
    if (out.created.length === 0 && out.errors.length > 0) return setError(out.errors.join(' '));
    setResult(out);
  };

  const handleConfirm = () => {
    if (!result || result.created.length === 0) return;
    addElements(result.created);
    setResult(null);
    onClose();
  };

  const resetAndClose = () => { setResult(null); setError(''); onClose(); };

  // muros por nivel, para que el selector diga de una dónde hay tabiquería
  const wallsPorNivel = useMemo(() => {
    const acc = {};
    for (const e of model.elements) if (e.type === 'wall' && e.bottomZ != null) acc[e.bottomZ] = (acc[e.bottomZ] || 0) + 1;
    return acc;
  }, [model.elements]);

  const corridas = useMemo(() => (result?.created || []).filter((f) => f.foundationType === 'corrida').length, [result]);
  const aisladas = useMemo(() => (result?.created || []).filter((f) => f.foundationType === 'aislada').length, [result]);

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Generar fundaciones desde muros"
      footer={<>
        <Button variant="secondary" onClick={resetAndClose}>Cancelar</Button>
        {result === null ? (
          <Button variant="primary" onClick={handlePreview}>Previsualizar</Button>
        ) : (
          <Button variant="primary" onClick={handleConfirm} disabled={result.created.length === 0}>
            Crear {result.created.length} fundación{result.created.length === 1 ? '' : 'es'}
          </Button>
        )}
      </>}
    >
      <ErrorText>{error}</ErrorText>
      <p className="text-xs text-[#8a8a85] mb-3">
        Genera un cimiento corrido bajo cada muro del nivel base, fusionando tramos colineales
        contiguos. Los muros que ya tienen fundación debajo se omiten.
      </p>

      <Field label="Nivel base" hint="dónde arranca la tabiquería — normalmente el NPT, no el NTN">
        <SelectInput value={baseLevelId} onChange={(e) => { setBaseLevelId(e.target.value); setResult(null); }}>
          <option value="">-- Automático (nivel de piso terminado) --</option>
          {(model.grid.zLevels || []).map((l) => (
            <option key={l.id} value={l.id}>
              {(l.name || l.label)} ({Math.round(l.elevation)} mm){wallsPorNivel[l.id] ? ` — ${wallsPorNivel[l.id]} muros` : ' — sin muros'}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Sección de cimiento">
        <SelectInput value={sectionId} onChange={(e) => { setSectionId(e.target.value); setResult(null); }}>
          <option value="">-- Por defecto (400×600) --</option>
          {ciSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectInput>
      </Field>

      <Field label="Tolerancia" hint="mm — para fusionar tramos y detectar duplicados">
        <NumberInput value={tolerance} onChange={(e) => { setTolerance(Number(e.target.value)); setResult(null); }} min={0} step={1} />
      </Field>

      <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={includePads} onChange={(e) => { setIncludePads(e.target.checked); setResult(null); }} />
        También generar poyo aislado bajo pilares sin muro encima
      </label>
      {includePads && (
        <Field label="Sección de poyo">
          <SelectInput value={padSectionId} onChange={(e) => { setPadSectionId(e.target.value); setResult(null); }}>
            <option value="">-- Por defecto (1000×1000×400) --</option>
            {padSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
      )}

      {result !== null && (
        <div className="mt-3 border-t border-[#e4e4e0] pt-3 text-sm">
          {result.baseLevel && (
            <p className="text-xs text-[#8a8a85] mb-1">
              Nivel base usado: <strong>{result.baseLevel.name}</strong> ({Math.round(result.baseLevel.elevation)} mm) — {result.baseLevel.motivo}.
            </p>
          )}
          <p className="text-[#5a5a55] mb-1.5">
            {result.created.length} creada{result.created.length === 1 ? '' : 's'}
            {corridas > 0 && ` (${corridas} corrida${corridas === 1 ? '' : 's'}`}
            {includePads && corridas > 0 && `, ${aisladas} poyo${aisladas === 1 ? '' : 's'})`}
            {includePads && corridas === 0 && ` (${aisladas} poyo${aisladas === 1 ? '' : 's'})`}
            {!includePads && corridas > 0 && ')'}
            {' — '}{result.skipped.length} omitida{result.skipped.length === 1 ? '' : 's'} (ya tenía fundación).
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-600 space-y-0.5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {(result.warnings || []).length > 0 && (
            <ul className="text-xs text-amber-600 space-y-0.5">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
