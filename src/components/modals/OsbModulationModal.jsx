// components/modals/OsbModulationModal.jsx
// ★ Modulación de placas OSB (paso 2). Selecciona un muro que YA tenga wall.studs generado
// (ver MetalconModulationModal.jsx — es un requisito, no un fallback: la junta de placa
// necesita saber dónde hay respaldo real de pie derecho) y calcula el despiece de placas
// (core/osbModulation.js). Persiste en wall.osbPanels al presionar Generar/Regenerar.
import { useState, useEffect, useMemo, useRef } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { computeOsbPanelLayout } from '../../core/osbModulation.js';
import { modulateAllWallsOsb } from '../../core/batchModulation.js';
import { drawOsbLayoutElevation } from '../../render/osbModulation.js';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { getElementShortLabel } from '../../core/naming.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

export default function OsbModulationModal({ open, onClose }) {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const osbDefaults = useModelStore((s) => s.model.osbDefaults || { panelWidth: 1220, minPanelWidth: 200, gap: 5 });
  const commitWallRegeneration = useModelStore((s) => s.commitWallRegeneration);
  const setOsbDefaults = useModelStore((s) => s.setOsbDefaults);
  const applyWallPatchesBatch = useModelStore((s) => s.applyWallPatchesBatch);
  const model = useModelStore((s) => s.model);

  const paramsMap = useMemo(() => buildParamsMap(projectParams), [projectParams]);
  const elementsById = useMemo(() => buildElementsById(elements), [elements]);
  // Solo muros con modulación de metalcon ya generada — es el input obligatorio del algoritmo.
  const walls = useMemo(() => elements.filter(el => el.type === 'wall' && el.studs?.length > 0), [elements]);

  const [wallId, setWallId] = useState('');
  const [panelWidth, setPanelWidth] = useState(osbDefaults.panelWidth);
  const [panelHeight, setPanelHeight] = useState(osbDefaults.panelHeight ?? 2440);
  const [minPanelWidth, setMinPanelWidth] = useState(osbDefaults.minPanelWidth);
  const [gap, setGap] = useState(osbDefaults.gap ?? 5);
  const [batchSummary, setBatchSummary] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const firstWall = walls[0];
    setWallId(firstWall ? firstWall.id : '');
    setPanelWidth(firstWall?.osbPanelWidth ?? osbDefaults.panelWidth);
    setPanelHeight(firstWall?.osbPanelHeight ?? osbDefaults.panelHeight ?? 2440);
    setMinPanelWidth(firstWall?.osbMinPanelWidth ?? osbDefaults.minPanelWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const wall = walls.find(w => w.id === Number(wallId) || w.id === wallId);

  // Cambiar de muro recarga su override guardado (si tiene) o vuelve al default de proyecto.
  useEffect(() => {
    if (!wall) return;
    setPanelWidth(wall.osbPanelWidth ?? osbDefaults.panelWidth);
    setPanelHeight(wall.osbPanelHeight ?? osbDefaults.panelHeight ?? 2440);
    setMinPanelWidth(wall.osbMinPanelWidth ?? osbDefaults.minPanelWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallId]);

  const layout = useMemo(() => {
    if (!wall) return { resolved: false, length: null, wallHeight: null, courses: [], warnings: [] };
    return computeOsbPanelLayout(wall, grid, paramsMap, elementsById, wall.studs, {
      panelWidth,
      panelHeight,
      minPanelWidth
    });
  }, [wall, grid, paramsMap, elementsById, panelWidth, panelHeight, minPanelWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 480;
    const height = 220;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    drawOsbLayoutElevation(ctx, { ...layout, studs: wall?.studs || [] }, width, height, { gap });
  }, [layout, gap, wall?.studs]);

  const canGenerate = wall && layout.resolved;
  const totalPanels = layout.courses?.reduce((a, c) => a + c.panels.length, 0) ?? 0;
  const totalNoggings = wall?.studs?.filter((piece) => piece.role === 'nogging').length ?? 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    commitWallRegeneration(wall.id, 'wallOsb', {
      osbPanelWidth: panelWidth,
      osbPanelHeight: panelHeight,
      osbMinPanelWidth: minPanelWidth,
      osbCourses: layout.courses,
      osbNoggings: layout.noggings
    });
  };

  const existingCount = walls.filter(w => w.osbCourses?.length > 0).length;

  const handleGenerateAll = () => {
    let skipExisting = false;
    if (existingCount > 0) {
      const overwrite = confirm(
        `${existingCount} muro(s) ya tienen despiece OSB. ¿Sobrescribir?\nAceptar = sobrescribir todos · Cancelar = solo los sin despiece`
      );
      skipExisting = !overwrite;
    }
    const { patches, skipped } = modulateAllWallsOsb(model, { panelWidth, panelHeight, minPanelWidth }, { skipExisting });
    if (patches.length > 0) applyWallPatchesBatch(patches);
    setBatchSummary(
      `${patches.length} generado(s)` + (skipped.length > 0 ? `, ${skipped.length} omitido(s) (${skipped.map(s => s.reason).join('; ')})` : '')
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modulación de placas OSB"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleGenerateAll} disabled={walls.length === 0}>
            Generar todos
          </Button>
          <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
            {wall?.osbCourses ? 'Regenerar' : 'Generar'} despiece
          </Button>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {walls.length === 0 ? (
        <p className="text-xs text-[#8a8a85]">
          Ningún muro tiene modulación de metalcon generada todavía. Generá primero el despiece de
          montantes en "Modulación de metalcon…" — la junta de placa necesita saber dónde hay
          respaldo real de pie derecho.
        </p>
      ) : (
        <div className="space-y-3">
          <Field label="Muro">
            <SelectInput value={wallId} onChange={(e) => setWallId(e.target.value)}>
              {walls.map(w => (
                <option key={w.id} value={w.id}>
                  {getElementShortLabel(w, grid)}{w.osbStale && w.osbCourses ? ' *' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
          {wall?.osbStale && wall?.osbCourses && (
            <div className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Despiece desactualizado: el modelo cambió después de generarlo. Regenerar.
            </div>
          )}
          {batchSummary && (
            <div className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
              {batchSummary}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ancho de placa (mm)" hint="LP OSB: 1220mm de fábrica">
              <FormulaInput value={panelWidth} onChange={setPanelWidth} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
            <Field label="Alto de placa (mm)" hint="LP OSB: 2440mm de fábrica — muros más altos se reparten en cursos">
              <FormulaInput value={panelHeight} onChange={setPanelHeight} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ancho mínimo de corte (mm)" hint="Piso duro 200mm — configurable por muro">
              <FormulaInput
                value={minPanelWidth}
                onChange={(v) => setMinPanelWidth(Math.max(200, Number(v) || 200))}
                paramsMap={paramsMap}
                projectParams={projectParams}
              />
            </Field>
            <Field label="Dilatación entre placas (mm)" hint="Manual Práctico LP, cap. Muros: 5mm">
              <FormulaInput
                value={gap}
                onChange={(v) => setGap(Math.max(0, Number(v) || 0))}
                paramsMap={paramsMap}
                projectParams={projectParams}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8a8a85]">
              Default de proyecto: {osbDefaults.panelWidth}x{osbDefaults.panelHeight ?? 2440}mm / mín. {osbDefaults.minPanelWidth}mm / dilatación {osbDefaults.gap ?? 5}mm
            </p>
            <Button
              variant="secondary"
              onClick={() => setOsbDefaults({ panelWidth, panelHeight, minPanelWidth, gap })}
            >
              Guardar como default de proyecto
            </Button>
          </div>

          <canvas ref={canvasRef} className="w-full border border-[#e4e4e0] rounded-md bg-white" />

          {!layout.resolved && (
            <p className="text-xs text-[#b5502a]">{layout.warnings?.[0] || 'El muro seleccionado no tiene geometría/nivel resuelto.'}</p>
          )}

          {layout.resolved && (
            <p className="text-xs text-[#5a5a55]">
              {layout.numCourses} curso(s) · {totalPanels} placas · ancho total {(layout.length / 1000).toFixed(2)}m
              {layout.numCourses > 1 ? ` · ${totalNoggings} cadeneta(s) en la junta horizontal` : ''}
            </p>
          )}

          {layout.warnings?.length > 0 && layout.resolved && (
            <div className="text-xs text-[#b5502a] space-y-0.5">
              {layout.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
