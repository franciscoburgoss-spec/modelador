// components/modals/RoofTrussModal.jsx
// ★ Techumbre: sistema de cerchas de un agua entre dos frontones (muros de apoyo paralelos).
// Selecciona muro bajo/alto, pendiente, talón, rebaje de canaleta, plantilla de entramado
// (library.trussTemplates, con semilla Cintac), spacing de cerchas y costanera OMA. Preview de
// la cercha (core/trussLayout.js). Persiste en model.roofSystems al Generar.
import { useState, useEffect, useMemo, useRef } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { planRoofSystemsFromLowWall, findBandConflicts } from '../../core/roofZoneGenerator.js';
import { computeRoofSystemLayout } from '../../core/trussLayout.js';
import { drawTrussElevation } from '../../render/trussLayout.js';
import { drawRoofZonePreview } from '../../render/roofZonePreview.js';
import { buildParamsMap } from '../../core/projectParams.js';
import { buildElementsById } from '../../core/elementReferences.js';
import { getElementShortLabel } from '../../core/naming.js';
import { LEVEL_TYPES } from '../../core/levelTypes.js';
import Modal from '../ui/Modal.jsx';
import { Field, SelectInput, FormulaInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

export default function RoofTrussModal({ open, onClose, initialSystemId = null }) {
  const grid = useModelStore((s) => s.model.grid);
  const elements = useModelStore((s) => s.model.elements);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const library = useModelStore((s) => s.model.library);
  const roofSystems = useModelStore((s) => s.model.roofSystems || []);
  const addRoofSystem = useModelStore((s) => s.addRoofSystem);
  const commitRoofSystemRegeneration = useModelStore((s) => s.commitRoofSystemRegeneration);
  const removeRoofSystem = useModelStore((s) => s.removeRoofSystem);
  const duplicateRoofSystem = useModelStore((s) => s.duplicateRoofSystem);
  const loadSeedTrussTemplates = useModelStore((s) => s.loadSeedTrussTemplates);

  const paramsMap = useMemo(() => buildParamsMap(projectParams), [projectParams]);
  const elementsById = useMemo(() => buildElementsById(elements), [elements]);
  const walls = useMemo(() => elements.filter(el => el.type === 'wall'), [elements]);
  const templates = library.trussTemplates || [];
  const ledgerProfiles = useMemo(() => (library.metalconProfiles || []).filter(p => p.shape === 'C'), [library.metalconProfiles]);
  const purlinProfiles = useMemo(() => (library.metalconProfiles || []).filter(p => p.shape === 'OMA'), [library.metalconProfiles]);

  const [systemId, setSystemId] = useState('new');
  const [wallLowId, setWallLowId] = useState('');
  const [wallHighId, setWallHighId] = useState('');
  const [slopePercent, setSlopePercent] = useState(30);
  const [slopeMode, setSlopeMode] = useState('manual');
  const [heelHeight, setHeelHeight] = useState(200);
  const [gutterNotchWidth, setGutterNotchWidth] = useState(0);
  const [supportLevelId, setSupportLevelId] = useState('');
  const [supportOffset, setSupportOffset] = useState(100);
  const [crownClearance, setCrownClearance] = useState(200);
  const [supportMode, setSupportMode] = useState('coronacion');
  const [supportProfile, setSupportProfile] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [trussSpacing, setTrussSpacing] = useState(1200);
  const [purlinProfile, setPurlinProfile] = useState('');
  const [purlinSpacing, setPurlinSpacing] = useState(800);
  // Zona de techumbre (sesión 23): '' = sin límite por ese lado → solape completo del muro.
  const [runFrom, setRunFrom] = useState('');
  const [runTo, setRunTo] = useState('');
  const canvasRef = useRef(null);
  const zoneCanvasRef = useRef(null);

  // al abrir: sembrar plantillas si faltan y cargar el primer sistema (o modo nuevo)
  useEffect(() => {
    if (!open) return;
    loadSeedTrussTemplates();
    // Precarga el sistema pedido desde el panel de propiedades (Editar…); si no, el primero.
    const target = initialSystemId != null
      ? roofSystems.find(r => r.id === initialSystemId)
      : roofSystems[0];
    setSystemId(target ? target.id : 'new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSystemId]);

  const system = roofSystems.find(r => r.id === Number(systemId) || r.id === systemId);

  // cambiar de sistema recarga sus valores (o defaults para "nuevo")
  useEffect(() => {
    if (system) {
      setWallLowId(system.wallLowId ?? '');
      setWallHighId(system.wallHighId ?? '');
      setSlopePercent(system.slopePercent ?? 30);
      setSlopeMode(system.slopeMode ?? 'manual'); // compatibilidad: sistemas guardados sin slopeMode → manual
      setHeelHeight(system.heelHeight ?? 200);
      setGutterNotchWidth(system.gutterNotchWidth ?? 0);
      setSupportLevelId(system.supportLevelId ?? '');
      setSupportOffset(system.supportOffset ?? 100);
      setCrownClearance(system.crownClearance ?? 200);
      setSupportMode(system.supportMode ?? 'coronacion'); // compatibilidad: sistemas guardados sin modo
      setSupportProfile(system.supportProfile ?? '');
      setTemplateId(system.templateId ?? (templates[0]?.id ?? ''));
      setTrussSpacing(system.trussSpacing ?? 1200);
      setPurlinProfile(system.purlinProfile ?? (purlinProfiles[0]?.code ?? ''));
      setPurlinSpacing(system.purlinSpacing ?? 800);
      setRunFrom(system.runRange?.from ?? '');
      setRunTo(system.runRange?.to ?? '');
    } else {
      const cieloLevel = grid.zLevels.find(l => l.levelType === 'cieloGeneral' || l.levelType === 'cieloAlto');
      setSlopeMode('manual');
      setSupportLevelId(cieloLevel?.id ?? '');
      setSupportOffset(100);
      setCrownClearance(200);
      setSupportMode('coronacion');
      setSupportProfile('');
      setWallLowId(walls[0]?.id ?? '');
      setWallHighId(walls[1]?.id ?? '');
      setTemplateId(templates[0]?.id ?? '');
      setPurlinProfile(purlinProfiles[0]?.code ?? '');
      setRunFrom('');
      setRunTo('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId, open, templates.length, purlinProfiles.length]);

  const template = templates.find(t => t.id === templateId);

  const draftSystem = useMemo(() => ({
    wallLowId: Number(wallLowId) || wallLowId,
    wallHighId: Number(wallHighId) || wallHighId,
    slopePercent, slopeMode, heelHeight, gutterNotchWidth,
    supportLevelId, supportOffset, crownClearance,
    supportMode, supportProfile,
    templateId,
    postSpacing: template?.postSpacing ?? 600,
    diagonalPattern: template?.diagonalPattern ?? 'W',
    profiles: template?.profiles ?? {},
    trussSpacing, purlinProfile, purlinSpacing,
    // null cuando ambos extremos están vacíos: un sistema sin zona debe guardarse idéntico a
    // como se guardaba antes de la sesión 23 (migración por ausencia del campo).
    runRange: (runFrom === '' && runTo === '') ? null
      : { from: runFrom === '' ? null : runFrom, to: runTo === '' ? null : runTo }
  }), [runFrom, runTo, wallLowId, wallHighId, slopePercent, slopeMode, heelHeight, gutterNotchWidth, supportLevelId, supportOffset, crownClearance, supportMode, supportProfile, templateId, template, trussSpacing, purlinProfile, purlinSpacing]);

  const layout = useMemo(
    () => computeRoofSystemLayout(draftSystem, grid, paramsMap, elementsById, elements, library),
    [draftSystem, grid, paramsMap, elementsById, elements, library]
  );

  // Cambiar de auto→manual precarga el valor calculado (no vuelve a 30 por defecto).
  const handleSlopeModeChange = (mode) => {
    if (mode === 'manual' && slopeMode === 'auto' && layout.slopePercent > 0) {
      setSlopePercent(Math.round(layout.slopePercent * 100) / 100);
    }
    setSlopeMode(mode);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 480;
    const height = 240;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawTrussElevation(ctx, layout.trussGeometry ?? { resolved: false, warnings: layout.warnings }, width, height, library);
  }, [layout]);

  useEffect(() => {
    const canvas = zoneCanvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 480;
    const height = 130;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawRoofZonePreview(ctx, layout, width, height);
  }, [layout]);

  const canGenerate = layout.resolved && !layout.heightViolation && !layout.supportViolation;

  const handleGenerate = () => {
    if (!canGenerate) return;
    const payload = {
      ...draftSystem,
      // en modo auto, persistir el valor YA calculado (no el default 30 sin usar) para que la
      // lista de sistemas y una futura carga muestren la pendiente real.
      slopePercent: layout.slopePercent,
      // resultado computado persistido (mismo criterio que wall.studs/wall.osbCourses)
      span: layout.span,
      supportElevation: layout.supportElevation,
      supportLedgers: layout.supportLedgers,
      runAxis: layout.runAxis,
      spanDir: layout.spanDir,
      trussPositions: layout.trussPositions,
      trussGeometry: layout.trussGeometry
    };
    if (system) commitRoofSystemRegeneration(system.id, payload);
    else addRoofSystem(payload);
  };

  // Duplica el sistema activo para partir un paño en L: la copia queda seleccionada para que
  // el usuario ajuste muros/rango y pulse Regenerar (trussGeometry se descarta al duplicar).
  // Los ids son crecientes (Date.now()-based) → el nuevo es siempre el de mayor id tras duplicar.
  const handleDuplicate = () => {
    if (!system) return;
    const beforeIds = new Set(roofSystems.map(r => r.id));
    duplicateRoofSystem(system.id);
    const after = useModelStore.getState().model.roofSystems || [];
    const created = after.find(r => !beforeIds.has(r.id));
    if (created) setSystemId(created.id);
  };

  // ★ Sesión 26 — genera de una vez todos los tramos que apoyan en el muro bajo elegido. Una
  // planta en L necesita un sistema por brazo (la luz cambia); armarlos a mano es donde salían
  // las cerchas embebidas y los offsets duplicados. Emite sistemas normales, editables después.
  const [bandPlan, setBandPlan] = useState(null);

  const handlePlanBands = () => {
    if (!wallLowId) return;
    const plan = planRoofSystemsFromLowWall(
      { ...useModelStore.getState().model },
      {
        wallLowId: Number(wallLowId) || wallLowId,
        supportElevation: layout.supportElevation ?? null,
        paramsMap, elementsById,
        template: {
          slopePercent, slopeMode, heelHeight, gutterNotchWidth,
          supportLevelId, supportOffset, crownClearance, supportMode, supportProfile,
          templateId,
          postSpacing: template?.postSpacing ?? 600,
          diagonalPattern: template?.diagonalPattern ?? 'W',
          profiles: template?.profiles ?? {},
          trussSpacing, purlinProfile, purlinSpacing
        }
      }
    );
    plan.conflicts = findBandConflicts(plan.bands, roofSystems);
    setBandPlan(plan);
  };

  const handleCreateBands = () => {
    if (!bandPlan?.bands?.length) return;
    for (const band of bandPlan.bands) {
      const { span, length, ...payload } = band;
      const l = computeRoofSystemLayout(payload, grid, paramsMap, elementsById, elements, library);
      if (!l.resolved) continue;
      addRoofSystem({
        ...payload,
        slopePercent: l.slopePercent, span: l.span, supportElevation: l.supportElevation,
        supportLedgers: l.supportLedgers, runAxis: l.runAxis, spanDir: l.spanDir,
        trussPositions: l.trussPositions, trussGeometry: l.trussGeometry
      });
      void span; void length;
    }
    setBandPlan(null);
  };

  const handleRemove = () => {
    if (!system) return;
    if (confirm('¿Eliminar este sistema de techumbre?')) {
      removeRoofSystem(system.id);
      setSystemId('new');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Techumbre — cerchas de un agua"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
            {system ? 'Regenerar' : 'Generar'} sistema
          </Button>
          {!system && (
            <Button variant="secondary" onClick={handlePlanBands} disabled={!wallLowId || !layout.supportElevation}>
              Generar por tramos…
            </Button>
          )}
          {system && <Button variant="secondary" onClick={handleDuplicate}>Duplicar sistema</Button>}
          {system && <Button variant="secondary" onClick={handleRemove}>Eliminar</Button>}
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {walls.length < 2 ? (
        <p className="text-xs text-[#8a8a85]">
          Se necesitan al menos dos muros paralelos (frontón bajo y frontón alto) para apoyar las cerchas.
        </p>
      ) : (
        <div className="space-y-3">
          <Field label="Sistema">
            <SelectInput value={systemId} onChange={(e) => setSystemId(e.target.value)}>
              <option value="new">+ Nuevo sistema…</option>
              {roofSystems.map(r => (
                <option key={r.id} value={r.id}>
                  Sistema {r.id} — {(r.span / 1000).toFixed(2)}m @ {r.slopePercent}%{r.stale && r.trussGeometry ? ' *' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
          {system?.stale && system?.trussGeometry && (
            <div className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Despiece desactualizado: el modelo cambió después de generarlo. Regenerar.
            </div>
          )}

          {bandPlan && (
            <div className="rounded border border-[#d8d8d3] bg-[#f7f7f5] p-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8a8a85]">
                Tramos detectados sobre el frontón bajo
              </p>
              {bandPlan.bands.length === 0 ? (
                <p className="text-xs text-[#b5502a]">No se encontró ningún tramo con apoyo alto válido.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[#8a8a85]">
                      <th className="pb-1 font-semibold">Tramo ({bandPlan.runAxis?.toUpperCase()})</th>
                      <th className="pb-1 font-semibold">Largo</th>
                      <th className="pb-1 font-semibold">Luz</th>
                      <th className="pb-1 font-semibold">Apoyo alto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandPlan.bands.map((b, i) => (
                      <tr key={i} className="border-t border-[#e4e4e0]">
                        <td className="py-1 text-[#3d3d38]">{Math.round(b.runRange.from)} → {Math.round(b.runRange.to)}</td>
                        <td className="py-1 text-[#3d3d38]">{(b.length / 1000).toFixed(2)} m</td>
                        <td className="py-1 text-[#3d3d38]">{(b.span / 1000).toFixed(2)} m</td>
                        <td className="py-1 text-[#8a8a85]">{getElementShortLabel(elementsById[b.wallHighId] || { type: 'wall', id: b.wallHighId }, grid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {bandPlan.warnings.map((w, i) => <p key={i} className="text-xs text-[#b5502a]">⚠ {w}</p>)}
              {bandPlan.conflicts?.length > 0 && (
                <p className="text-xs text-[#b5502a]">
                  {bandPlan.conflicts.length} tramo(s) ya existen como sistema — crearlos duplicaría la techumbre.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="primary"
                  onClick={handleCreateBands}
                  disabled={!bandPlan.bands.length || bandPlan.conflicts?.length > 0}
                >
                  Crear {bandPlan.bands.length} sistema(s)
                </Button>
                <Button variant="secondary" onClick={() => setBandPlan(null)}>Descartar</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Frontón bajo (canaleta)" hint="La luz se mide entre caras interiores">
              <SelectInput value={wallLowId} onChange={(e) => setWallLowId(e.target.value)}>
                {walls.map(w => <option key={w.id} value={w.id}>{getElementShortLabel(w, grid)}</option>)}
              </SelectInput>
            </Field>
            <Field label="Frontón alto">
              <SelectInput value={wallHighId} onChange={(e) => setWallHighId(e.target.value)}>
                {walls.map(w => <option key={w.id} value={w.id}>{getElementShortLabel(w, grid)}</option>)}
              </SelectInput>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Pendiente (%)"
              hint={
                <span className="inline-flex gap-1 ml-1.5">
                  <button
                    type="button"
                    onClick={() => handleSlopeModeChange('manual')}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${slopeMode === 'manual' ? 'bg-[#3d3d38] text-white' : 'bg-[#f2f2ee] text-[#5a5a55]'}`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlopeModeChange('auto')}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${slopeMode === 'auto' ? 'bg-[#3d3d38] text-white' : 'bg-[#f2f2ee] text-[#5a5a55]'}`}
                  >
                    Auto
                  </button>
                </span>
              }
            >
              {slopeMode === 'auto' ? (
                <div className={`${'w-full border rounded-md px-2.5 py-1.5 text-sm font-mono'} ${layout.slopePercent > 0 ? 'border-[#e4e4e0] text-[#1a1a18] bg-[#f9f9f7]' : 'border-[#e4a68a] text-[#b5502a] bg-[#fdf3ee]'}`}>
                  {layout.slopePercent > 0 ? `${layout.slopePercent.toFixed(2)}% (calculada)` : 'sin holgura disponible'}
                </div>
              ) : (
                <FormulaInput value={slopePercent} onChange={setSlopePercent} paramsMap={paramsMap} projectParams={projectParams} />
              )}
            </Field>
            <Field label="Talón (mm)" hint="Altura del extremo bajo">
              <FormulaInput value={heelHeight} onChange={setHeelHeight} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
            <Field label="Rebaje canaleta (mm)" hint="0 = sin rebaje">
              <FormulaInput value={gutterNotchWidth} onChange={setGutterNotchWidth} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Nivel de cielo (apoyo)" hint="Apoyo = cielo + offset — la cercha queda dentro del frontón">
              <SelectInput value={supportLevelId} onChange={(e) => setSupportLevelId(e.target.value)}>
                <option value="">— nivel sup. del muro —</option>
                {grid.zLevels.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.levelType && LEVEL_TYPES[l.levelType] ? `${LEVEL_TYPES[l.levelType].sigla} · ` : ''}{l.label ?? l.id} ({l.elevation}mm)
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Offset de apoyo (mm)" hint="Encintado + instalaciones sobre el cielo falso">
              <FormulaInput value={supportOffset} onChange={setSupportOffset} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
            <Field label="Holgura coronación (mm)" hint="Punto más alto + costanera bajo la coronación">
              <FormulaInput value={crownClearance} onChange={setCrownClearance} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Modo de apoyo" hint="Lateral = solera fijada a la cara del frontón">
              <SelectInput value={supportMode} onChange={(e) => setSupportMode(e.target.value)}>
                <option value="coronacion">Sobre el muro (coronación)</option>
                <option value="lateral">Lateral (solera en la cara)</option>
              </SelectInput>
            </Field>
            {supportMode === 'lateral' && (
              <Field label="Perfil de solera" hint="Vacío = mismo perfil que la cuerda inferior">
                <SelectInput value={supportProfile} onChange={(e) => setSupportProfile(e.target.value)}>
                  <option value="">— como cuerda inferior —</option>
                  {ledgerProfiles.map(p => <option key={p.code} value={p.code}>{p.code} ({p.catalogDesignation})</option>)}
                </SelectInput>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entramado (plantilla)" hint="Editables en la librería (trussTemplates)">
              <SelectInput value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Distancia entre cerchas (mm)" hint="Cintac usa S=120cm en sus tablas">
              <FormulaInput value={trussSpacing} onChange={setTrussSpacing} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Costanera" hint="Perfiles OMA del catálogo Metalcon">
              <SelectInput value={purlinProfile} onChange={(e) => setPurlinProfile(e.target.value)}>
                <option value="">— sin costaneras —</option>
                {purlinProfiles.map(p => <option key={p.code} value={p.code}>{p.code} ({p.catalogDesignation})</option>)}
              </SelectInput>
            </Field>
            <Field label="Distancia entre costaneras (mm)" hint="Medida inclinada sobre la cuerda superior">
              <FormulaInput value={purlinSpacing} onChange={setPurlinSpacing} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Zona: desde (${layout.runAxis === 'y' ? 'Y' : 'X'}, mm)`}
              hint={layout.overlapRange
                ? `Solape disponible ${Math.round(layout.overlapRange.from)}→${Math.round(layout.overlapRange.to)}mm`
                : 'Vacío = todo el solape'}
            >
              <FormulaInput value={runFrom} onChange={setRunFrom} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
            <Field
              label={`Zona: hasta (${layout.runAxis === 'y' ? 'Y' : 'X'}, mm)`}
              hint={
                <button
                  type="button"
                  onClick={() => { setRunFrom(''); setRunTo(''); }}
                  className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-[#f2f2ee] text-[#5a5a55]"
                >
                  Todo el solape
                </button>
              }
            >
              <FormulaInput value={runTo} onChange={setRunTo} paramsMap={paramsMap} projectParams={projectParams} />
            </Field>
          </div>

          <canvas ref={zoneCanvasRef} className="w-full border border-[#e4e4e0] rounded-md bg-white" />

          <canvas ref={canvasRef} className="w-full border border-[#e4e4e0] rounded-md bg-white" />

          {!layout.resolved && (
            <p className="text-xs text-[#b5502a]">{layout.warnings?.[0] || 'Sistema no resuelto.'}</p>
          )}

          {layout.resolved && (
            <p className="text-xs text-[#5a5a55]">
              Luz {(layout.span / 1000).toFixed(2)}m · {layout.trussPositions.length} cerchas ·
              alto {Math.round(layout.trussGeometry.heightLow)}→{Math.round(layout.trussGeometry.heightHigh)}mm ·
              {layout.trussGeometry.purlins.length > 0 ? ` ${layout.trussGeometry.purlins.length} costaneras/agua` : ' sin costaneras'} ·
              cota apoyo {layout.supportElevation}mm
            </p>
          )}

          {layout.warnings?.length > 0 && layout.resolved && (
            <div className="text-xs text-[#b5502a] space-y-0.5">
              {layout.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}

          {template && (
            <p className="text-xs text-[#8a8a85]">
              Plantilla: C.S. {template.profiles.topChord} · C.I. {template.profiles.bottomChord} ·
              M. {template.profiles.post} @{template.postSpacing}mm · D. {template.profiles.diagonal} ({template.diagonalPattern})
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
