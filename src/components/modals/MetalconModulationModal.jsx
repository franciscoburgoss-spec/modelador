// components/modals/MetalconModulationModal.jsx
// ★ Modulación de metalcon (paso 2). Selecciona un muro + perfiles de librería
// (metalconProfiles), calcula el despiece de montantes (core/metalconModulation.js) y lo
// persiste en wall.studs al presionar Generar/Regenerar. Preview en vivo antes de guardar.
import { useState, useEffect, useMemo, useRef } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { computeStudLayout, detectWallCorners } from '../../core/metalconModulation.js';
import { modulateAllWallsMetalcon } from '../../core/batchModulation.js';
import { drawStudLayoutElevation, METALCON_ROLE_LABELS } from '../../render/metalconModulation.js';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { getElementShortLabel } from '../../core/naming.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const DEFAULT_SPACING = 400;

export default function MetalconModulationModal({ open, onClose }) {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const metalconProfiles = useModelStore((s) => s.model.library.metalconProfiles || []);
  const materials = useModelStore((s) => s.model.library.materials || []);
  const updateElement = useModelStore((s) => s.updateElement);
  const applyWallPatchesBatch = useModelStore((s) => s.applyWallPatchesBatch);
  const loadMetalconCatalog = useModelStore((s) => s.loadMetalconCatalog);
  const metalconDefaults = useModelStore((s) => s.model.metalconDefaults);
  const setMetalconDefaults = useModelStore((s) => s.setMetalconDefaults);
  const model = useModelStore((s) => s.model);

  const paramsMap = useMemo(() => buildParamsMap(projectParams), [projectParams]);
  const elementsById = useMemo(() => buildElementsById(elements), [elements]);
  const walls = useMemo(() => elements.filter(el => el.type === 'wall'), [elements]);
  const studProfiles = useMemo(() => metalconProfiles.filter(p => p.shape === 'C'), [metalconProfiles]);
  const trackProfiles = useMemo(() => metalconProfiles.filter(p => p.shape === 'U'), [metalconProfiles]);
  const metalconMaterials = useMemo(() => materials.filter(m => m.category === 'metalcon'), [materials]);

  const [wallId, setWallId] = useState('');
  const [studProfileId, setStudProfileId] = useState('');
  const [trackProfileId, setTrackProfileId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [spacing, setSpacing] = useState(DEFAULT_SPACING);
  const [batchSummary, setBatchSummary] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const firstWall = walls[0];
    setWallId(firstWall ? firstWall.id : '');
    setStudProfileId(firstWall?.framingStudProfileId ?? metalconDefaults?.studProfileId ?? studProfiles[0]?.id ?? '');
    setTrackProfileId(firstWall?.framingTrackProfileId ?? metalconDefaults?.trackProfileId ?? trackProfiles[0]?.id ?? '');
    setMaterialId(firstWall?.framingMaterialId ?? metalconDefaults?.materialId ?? '');
    setSpacing(firstWall?.studSpacing ?? metalconDefaults?.spacing ?? DEFAULT_SPACING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Si el catálogo se carga (botón "Cargar catálogo…") con el modal ya abierto, autoselecciona
  // el primer perfil disponible de cada tipo (solo si el usuario no eligió nada todavía).
  useEffect(() => {
    if (!open) return;
    if (!studProfileId && studProfiles[0]) setStudProfileId(studProfiles[0].id);
    if (!trackProfileId && trackProfiles[0]) setTrackProfileId(trackProfiles[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studProfiles.length, trackProfiles.length]);

  const wall = walls.find(w => w.id === Number(wallId) || w.id === wallId);

  // Cambiar de muro recarga sus valores guardados (si los tiene) sin perder la selección de perfiles ya elegida a mano.
  useEffect(() => {
    if (!wall) return;
    if (wall.framingStudProfileId != null) setStudProfileId(wall.framingStudProfileId);
    if (wall.framingTrackProfileId != null) setTrackProfileId(wall.framingTrackProfileId);
    if (wall.framingMaterialId != null) setMaterialId(wall.framingMaterialId);
    if (wall.studSpacing != null) setSpacing(wall.studSpacing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallId]);

  const corners = useMemo(() => {
    if (!wall) return { start: false, end: false };
    return detectWallCorners(wall, elements, grid, paramsMap, elementsById);
  }, [wall, elements, grid, paramsMap, elementsById]);

  const layout = useMemo(() => {
    if (!wall) return { resolved: false, length: null, wallHeight: null, studs: [] };
    return computeStudLayout(wall, grid, paramsMap, elementsById, { spacing, corners });
  }, [wall, grid, paramsMap, elementsById, spacing, corners]);

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
    drawStudLayoutElevation(ctx, layout, width, height);
  }, [layout]);

  const studProfile = studProfiles.find(p => p.id === studProfileId);
  const trackProfile = trackProfiles.find(p => p.id === trackProfileId);

  // Despiece: agrupa montantes por rol, más 2 filas fijas de solera (sup/inf) con el perfil de track.
  const despieceRows = useMemo(() => {
    const byRole = new Map();
    for (const s of layout.studs) {
      const lenM = (s.zMax - s.zMin) / 1000;
      const key = s.role;
      const prev = byRole.get(key) || { role: key, count: 0, totalM: 0 };
      prev.count += 1;
      prev.totalM += lenM;
      byRole.set(key, prev);
    }
    for (const h of layout.headers || []) {
      const lenM = (h.oMax - h.oMin) / 1000;
      const prev = byRole.get(h.role) || { role: h.role, count: 0, totalM: 0 };
      prev.count += 1;
      prev.totalM += lenM;
      byRole.set(h.role, prev);
    }
    const rows = [...byRole.values()].sort((a, b) => a.role.localeCompare(b.role));
    if (layout.resolved && trackProfile) {
      rows.push({ role: 'track', count: 2, totalM: (2 * layout.length) / 1000, label: `Solera sup. + inf. (${trackProfile.catalogDesignation})` });
    }
    return rows;
  }, [layout, trackProfile]);

  const canGenerate = wall && studProfileId && trackProfileId && layout.resolved;

  const handleGenerate = () => {
    if (!canGenerate) return;
    updateElement(wall.id, {
      framingStudProfileId: studProfileId,
      framingTrackProfileId: trackProfileId,
      framingMaterialId: materialId ? Number(materialId) : null,
      studSpacing: spacing,
      studs: layout.studs,
      headers: layout.headers
    });
  };

  const existingCount = walls.filter(w => w.studs?.length > 0).length;

  const handleGenerateAll = () => {
    if (!studProfileId || !trackProfileId) return;
    let skipExisting = false;
    if (existingCount > 0) {
      const overwrite = confirm(
        `${existingCount} muro(s) ya tienen despiece. ¿Sobrescribir?\nAceptar = sobrescribir todos · Cancelar = solo los sin despiece`
      );
      skipExisting = !overwrite;
    }
    const { patches, skipped } = modulateAllWallsMetalcon(
      model,
      { spacing, studProfileId, trackProfileId, materialId: materialId ? Number(materialId) : null },
      { skipExisting }
    );
    if (patches.length > 0) applyWallPatchesBatch(patches);
    setBatchSummary(
      `${patches.length} generado(s)` + (skipped.length > 0 ? `, ${skipped.length} omitido(s) (${skipped.map(s => s.reason).join('; ')})` : '')
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modulación de metalcon"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleGenerateAll} disabled={!studProfileId || !trackProfileId || walls.length === 0}>
            Generar todos
          </Button>
          <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
            {wall?.studs ? 'Regenerar' : 'Generar'} despiece
          </Button>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {walls.length === 0 ? (
        <p className="text-xs text-[#8a8a85]">No hay muros en el modelo.</p>
      ) : metalconProfiles.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-[#8a8a85]">
            No hay perfiles metalcon en la librería. Carga el catálogo Cintac (perfiles C y U del
            Manual de Diseño Metalcon 2020) para empezar.
          </p>
          <Button variant="primary" onClick={loadMetalconCatalog}>Cargar catálogo Metalcon (Cintac)</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Muro">
            <SelectInput value={wallId} onChange={(e) => setWallId(e.target.value)}>
              {walls.map(w => (
                <option key={w.id} value={w.id}>
                  {getElementShortLabel(w, grid)}{w.studsStale && w.studs ? ' *' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
          {wall?.studsStale && wall?.studs && (
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
            <Field label="Perfil montante (C)">
              <SelectInput value={studProfileId} onChange={(e) => setStudProfileId(e.target.value)}>
                <option value="" disabled>Seleccionar…</option>
                {studProfiles.map(p => <option key={p.id} value={p.id}>{p.catalogDesignation}</option>)}
              </SelectInput>
            </Field>
            <Field label="Perfil solera (U)">
              <SelectInput value={trackProfileId} onChange={(e) => setTrackProfileId(e.target.value)}>
                <option value="" disabled>Seleccionar…</option>
                {trackProfiles.map(p => <option key={p.id} value={p.id}>{p.catalogDesignation}</option>)}
              </SelectInput>
            </Field>
          </div>

          <Field label="Material" hint={metalconMaterials.length === 0 ? '— crea uno en Librería > Materiales (categoría metalcon) para usar propiedades reales en CalculiX' : undefined}>
            <SelectInput value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Sin material asignado (genérico al exportar)</option>
              {metalconMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </SelectInput>
          </Field>

          <Field label="Espaciamiento entre montantes (mm)" hint="Manual Metalcon: 400-600mm">
            <FormulaInput value={spacing} onChange={setSpacing} paramsMap={paramsMap} projectParams={projectParams} />
          </Field>

          {(corners.start || corners.end) && (
            <p className="text-xs text-[#5a5a55]">
              Se detectó encuentro con otro muro en: {[corners.start && 'inicio', corners.end && 'fin'].filter(Boolean).join(' y ')}
              {' '}— se agregan montantes de esquina/respaldo en ese extremo.
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8a8a85]">
              {metalconDefaults?.studProfileId && metalconDefaults?.trackProfileId
                ? `Default de proyecto: ${studProfiles.find(p => p.id === metalconDefaults.studProfileId)?.catalogDesignation ?? '—'} / ${trackProfiles.find(p => p.id === metalconDefaults.trackProfileId)?.catalogDesignation ?? '—'} · ${metalconDefaults.spacing ?? DEFAULT_SPACING}mm`
                : 'Sin default de proyecto guardado — "Generar todos" desde el menú Herramientas lo necesita.'}
            </p>
            <Button
              variant="secondary"
              onClick={() => setMetalconDefaults({ spacing, studProfileId, trackProfileId, materialId: materialId ? Number(materialId) : null })}
              disabled={!studProfileId || !trackProfileId}
            >
              Guardar como default de proyecto
            </Button>
          </div>

          <canvas ref={canvasRef} className="w-full border border-[#e4e4e0] rounded-md bg-white" />

          {!layout.resolved && (
            <p className="text-xs text-[#b5502a]">El muro seleccionado no tiene geometría/nivel resuelto.</p>
          )}

          {despieceRows.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#8a8a85] uppercase tracking-wide text-[10px]">
                  <th className="pb-1.5 font-semibold">Elemento</th>
                  <th className="pb-1.5 font-semibold text-right">Cant.</th>
                  <th className="pb-1.5 font-semibold text-right">ml total</th>
                </tr>
              </thead>
              <tbody>
                {despieceRows.map(r => (
                  <tr key={r.role} className="border-t border-[#f2f2ee]">
                    <td className="py-1.5 text-[#3d3d38]">{r.label || METALCON_ROLE_LABELS[r.role] || r.role}</td>
                    <td className="py-1.5 text-right text-[#3d3d38]">{r.count}</td>
                    <td className="py-1.5 text-right text-[#3d3d38]">{r.totalM.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}
