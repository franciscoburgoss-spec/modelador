// components/MenuBar.jsx
import { useState, useRef, useEffect } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import { downloadDxf } from '../core/exportDxf.js';
import { downloadFramingDxf } from '../core/exportFramingDxf.js';
import { downloadOsbFramingDxf } from '../core/exportOsbDxf.js';
import { downloadTrussDxf } from '../core/exportTrussDxf.js';
import { downloadFramingSheets, downloadOsbFramingSheets, downloadTrussSheets } from '../core/exportSheetsDxf.js';
import { downloadFoundationSheets } from '../core/exportFoundationsDxf.js';
import { downloadCalculix } from '../core/exportCalculix.js';
import { downloadCalculixTruss } from '../core/exportCalculixTruss.js';
import { downloadCalculixFoundation } from '../core/exportCalculixFoundation.js';
import { modulateAllWallsFull } from '../core/batchModulation.js';
import { resolveWallTypeConfig } from '../core/wallTypes.js';
import { FORMAT_KEYS, PAPER_FORMATS } from '../core/sheetFormats.js';

function Dropdown({ label, children }) {
  const [openMenu, setOpenMenu] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenMenu(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Escape cierra el menú (y con él, cualquier flyout hijo abierto — se desmonta con el padre).
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openMenu]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`px-3 py-2.5 text-sm transition-colors rounded-t-md ${openMenu ? 'bg-[#f2f2ee] text-[#1a1a18]' : 'text-[#3d3d38] hover:bg-[#f2f2ee]'}`}
        onClick={() => setOpenMenu(v => !v)}
      >
        {label} ▾
      </button>
      {openMenu && (
        <div className="absolute left-0 top-full bg-white border border-[#e4e4e0] rounded-lg shadow-lg py-1 min-w-[220px] z-40" onClick={() => setOpenMenu(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function Item({ onClick, children, disabled, title }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${disabled ? 'text-[#b5b5ae] cursor-not-allowed' : 'text-[#3d3d38] hover:bg-[#f2f2ee]'}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/** Submenú en cascada (flyout): se abre a la derecha del ítem padre, con hover o click/Enter. */
function Flyout({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-3 py-1.5 text-sm text-[#3d3d38] hover:bg-[#f2f2ee] transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'Enter') setOpen(true); }}
      >
        <span>{label}</span>
        <span className="text-[#b5b5ae]">▸</span>
      </button>
      {open && (
        <div className="absolute left-full top-0 bg-white border border-[#e4e4e0] rounded-lg shadow-lg py-1 min-w-[240px] z-50">
          {children}
        </div>
      )}
    </div>
  );
}

/** Submenú de formatos para un export de láminas. El formato por defecto (el guardado en
 * projectInfo) se marca con un punto — exportar sin elegir formato usa ese mismo. */
function FormatFlyout({ label, onExport, defaultFormat }) {
  return (
    <Flyout label={label}>
      {FORMAT_KEYS.map((key) => (
        <Item key={key} onClick={() => onExport({ format: key })}>
          {key === defaultFormat ? '• ' : '\u00A0\u00A0'}{key} ({PAPER_FORMATS[key].w} × {PAPER_FORMATS[key].h} mm, 1:{PAPER_FORMATS[key].defaultScale})
        </Item>
      ))}
    </Flyout>
  );
}

export default function MenuBar({ onOpenModal, canvasSize }) {
  const clearAll = useModelStore((s) => s.clearAll);
  const newModel = useModelStore((s) => s.newModel);
  const toggleFilterPanel = useModelStore((s) => s.toggleFilterPanel);
  const undo = useModelStore((s) => s.undo);
  const redo = useModelStore((s) => s.redo);
  const pastLength = useModelStore((s) => s.past.length);
  const futureLength = useModelStore((s) => s.future.length);
  const saveModel = useModelStore((s) => s.saveModel);
  const loadModel = useModelStore((s) => s.loadModel);
  const exportModelToFile = useModelStore((s) => s.exportModelToFile);
  const zoomIn = useModelStore((s) => s.zoomIn);
  const zoomOut = useModelStore((s) => s.zoomOut);
  const toggleAxes = useModelStore((s) => s.toggleAxes);
  const fitToContent = useModelStore((s) => s.fitToContent);
  const showAxes = useModelStore((s) => s.view.showAxes);
  const showGhostLayer = useModelStore((s) => s.showGhostLayer);
  const toggleGhostLayer = useModelStore((s) => s.toggleGhostLayer);
  const layout = useModelStore((s) => s.layout);
  const setLayout = useModelStore((s) => s.setLayout);
  const addXAxis = useModelStore((s) => s.addXAxis);
  const addYAxis = useModelStore((s) => s.addYAxis);
  const xAxes = useModelStore((s) => s.model.grid.xAxes);
  const yAxes = useModelStore((s) => s.model.grid.yAxes);
  const zLevels = useModelStore((s) => s.model.grid.zLevels);
  const addZLevel = useModelStore((s) => s.addZLevel);
  const fileInputRef = useRef(null);
  const importModelFromFile = useModelStore((s) => s.importModelFromFile);
  const startRoofPlaneDraft = useModelStore((s) => s.startRoofPlaneDraft);
  const model = useModelStore((s) => s.model);
  const applyWallPatchesBatch = useModelStore((s) => s.applyWallPatchesBatch);
  const sheetFormat = useModelStore((s) => s.model.projectInfo?.formato) || 'A1';

  const canGenerateAllModulation = model.elements
    .filter((element) => element.type === 'wall')
    .some((wall) => {
      const effective = resolveWallTypeConfig(model, wall);
      return !!(
        effective.metalconDefaults.studProfileId
        && effective.metalconDefaults.trackProfileId
        && effective.osbDefaults.panelWidth > 0
        && effective.osbDefaults.panelHeight > 0
      );
    });

  const handleGenerateAllModulation = () => {
    const state = useModelStore.getState();
    const walls = state.model.elements.filter((el) => el.type === 'wall');
    const existingCount = walls.filter((w) => w.studs?.length > 0 || w.osbCourses?.length > 0).length;
    let skipExisting = false;
    if (existingCount > 0) {
      const overwrite = confirm(
        `${existingCount} muro(s) ya tienen despiece. ¿Sobrescribir?\nAceptar = sobrescribir todos · Cancelar = solo los sin despiece`
      );
      skipExisting = !overwrite;
    }
    const { patches, skippedMetalcon, skippedOsb, blocked } = modulateAllWallsFull(
      state.model,
      { metalcon: state.model.metalconDefaults, osb: state.model.osbDefaults },
      { skipExisting }
    );
    if (blocked.length > 0) {
      alert(
        'Generación bloqueada; no se aplicaron cambios.\n'
        + blocked.map((item) => `${item.reason}: muros ${item.wallIds.join(', ')}`).join('\n')
      );
      return;
    }
    if (patches.length > 0) applyWallPatchesBatch(patches);
    alert(
      `${patches.length} muro(s) modulados (metalcon + OSB).`
      + (skippedMetalcon.length > 0 ? `\nMetalcon omitido: ${skippedMetalcon.length}.` : '')
      + (skippedOsb.length > 0 ? `\nOSB omitido: ${skippedOsb.length}.` : '')
    );
  };

  return (
    <nav className="flex items-center border-b border-[#e4e4e0] px-1">
      <Dropdown label="Archivo">
        <Item onClick={undo} disabled={pastLength === 0}>Deshacer{pastLength > 0 ? ` (${pastLength})` : ''}</Item>
        <Item onClick={redo} disabled={futureLength === 0}>Rehacer{futureLength > 0 ? ` (${futureLength})` : ''}</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => { if (confirm('¿Crear un modelo nuevo? Se perderá lo no guardado.')) newModel(); }}>Nuevo modelo</Item>
        <Item onClick={saveModel}>Guardar</Item>
        <Item onClick={() => loadModel()}>Cargar</Item>
        <Item onClick={exportModelToFile}>Exportar JSON…</Item>
        <Item onClick={() => fileInputRef.current?.click()}>Importar JSON…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Flyout label="Exportar DXF">
          <Item onClick={() => downloadDxf(useModelStore.getState().model)}>Planta…</Item>
          <Item onClick={() => downloadFramingDxf(useModelStore.getState().model)}>Tabiquería (elevación)…</Item>
          <Item onClick={() => downloadOsbFramingDxf(useModelStore.getState().model)}>OSB (elevación)…</Item>
          <Item onClick={() => downloadTrussDxf(useModelStore.getState().model)}>Cerchas (elevación)…</Item>
          <Item onClick={() => downloadFoundationSheets(useModelStore.getState().model)}>Fundaciones (lámina A1)…</Item>
        </Flyout>
        <Flyout label="Exportar láminas">
          <FormatFlyout label="Tabiquería" defaultFormat={sheetFormat}
            onExport={(o) => downloadFramingSheets(useModelStore.getState().model, o)} />
          <FormatFlyout label="OSB" defaultFormat={sheetFormat}
            onExport={(o) => downloadOsbFramingSheets(useModelStore.getState().model, o)} />
          <FormatFlyout label="Cerchas" defaultFormat={sheetFormat}
            onExport={(o) => downloadTrussSheets(useModelStore.getState().model, o)} />
          <FormatFlyout label="Fundaciones" defaultFormat={sheetFormat}
            onExport={(o) => downloadFoundationSheets(useModelStore.getState().model, o)} />
          <div className="border-t border-[#e4e4e0] my-1" />
          <Item onClick={() => onOpenModal('projectInfo')}>Datos de proyecto (cajetín)…</Item>
        </Flyout>
        <Flyout label="Exportar CalculiX">
          <Item onClick={() => downloadCalculix(useModelStore.getState().model)}>Modelo (.inp)…</Item>
          <Item onClick={() => downloadCalculixTruss(useModelStore.getState().model)}>Cercha tipo (.inp corrible)…</Item>
          <Item onClick={() => downloadCalculixFoundation(useModelStore.getState().model)}>Fundaciones (.inp)…</Item>
        </Flyout>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => { if (confirm('¿Eliminar todos los elementos, ejes y niveles?')) clearAll(); }}>Limpiar todo</Item>
      </Dropdown>

      <Dropdown label="Librería">
        <Item onClick={() => onOpenModal('wallTypes')}>Tipos y roles de muro…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal({ name: 'library', type: 'material' })}>Materiales…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal({ name: 'library', type: 'wall' })}>Sección de muro…</Item>
        <Item onClick={() => onOpenModal({ name: 'library', type: 'column' })}>Sección de pilar…</Item>
        <Item onClick={() => onOpenModal({ name: 'library', type: 'beam' })}>Sección de viga…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal({ name: 'library', type: 'cimiento' })}>Cimiento…</Item>
        <Item onClick={() => onOpenModal({ name: 'library', type: 'sobrecimiento' })}>Sobrecimiento…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal({ name: 'library', type: 'door' })}>Puerta tipo…</Item>
        <Item onClick={() => onOpenModal({ name: 'library', type: 'window' })}>Ventana tipo…</Item>
      </Dropdown>

      <Dropdown label="Ejes">
        <Item onClick={() => addXAxis(xAxes.length * 3000, `X${xAxes.length + 1}`)}>+ Eje X</Item>
        <Item onClick={() => addYAxis(yAxes.length * 3000, `Y${yAxes.length + 1}`)}>+ Eje Y</Item>
        <Item onClick={() => addZLevel(zLevels.length * 2400, `N${zLevels.length}`)}>+ Nivel Z</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal({ name: 'auxAxis', direction: 'x' })}>+ Eje Auxiliar X</Item>
        <Item onClick={() => onOpenModal({ name: 'auxAxis', direction: 'y' })}>+ Eje Auxiliar Y</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal('grid')}>Definir grilla 3D…</Item>
      </Dropdown>

      <Dropdown label="Elementos">
        <Item onClick={() => onOpenModal('wall')}>+ Muro</Item>
        <Item onClick={() => onOpenModal('column')}>+ Pilar</Item>
        <Item onClick={() => onOpenModal('beam')}>+ Viga</Item>
        <Item onClick={() => onOpenModal('foundation')}>+ Fundación (corrida / aislada)</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal('opening')}>+ Puerta / Ventana</Item>
      </Dropdown>

      <Dropdown label="Ver">
        <Item onClick={() => fitToContent(canvasSize.width, canvasSize.height)}>Ajustar a contenido</Item>
        <Item onClick={zoomIn}>Zoom +</Item>
        <Item onClick={zoomOut}>Zoom −</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={toggleAxes}>{showAxes ? 'Ocultar ejes' : 'Mostrar ejes'}</Item>
        <Item onClick={toggleGhostLayer}>{showGhostLayer ? 'Ocultar capa fantasma' : 'Mostrar capa fantasma'}</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal('viewer3d')}>Vista 3D…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => setLayout(layout === 'split' ? 'single' : 'split')}>{layout === 'split' ? 'Vista única' : 'Vista dividida (2 paneles)'}</Item>
      </Dropdown>

      <Dropdown label="Herramientas">
        <Item onClick={() => onOpenModal('projectParams')}>Parámetros de proyecto…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Flyout label="Modulación">
          <Item onClick={() => onOpenModal('metalconModulation')}>Metalcon…</Item>
          <Item onClick={() => onOpenModal('osbModulation')}>OSB…</Item>
          <Item onClick={() => onOpenModal('osbNesting')}>OSB: optimizar despuntes…</Item>
          <Item
            onClick={handleGenerateAllModulation}
            disabled={!canGenerateAllModulation}
            title={canGenerateAllModulation ? undefined : 'Ningún muro tiene una configuración efectiva completa'}
          >
            Generar todos
          </Item>
        </Flyout>
        <Flyout label="Techumbre">
          {/* ★ B4.7.8-s2 (B-04) — «Cerchas de un agua…» sale del menú: crear sistemas legacy
              compite con la fuente única (los faldones mandan). El modal sigue accesible desde
              el panel de propiedades para EDITAR sistemas legacy que ya existan. */}
          <Item onClick={startRoofPlaneDraft}>Dibujar faldón…</Item>
        </Flyout>
        <Flyout label="Fundaciones">
          <Item onClick={() => onOpenModal('generateFoundations')}>Generar desde muros…</Item>
          <Item onClick={() => onOpenModal('foundationAnalysis')}>Análisis (CalculiX)…</Item>
        </Flyout>
        <Flyout label="Muros">
          <Item onClick={() => onOpenModal('wallSplit')}>Dividir / unir…</Item>
        </Flyout>
        <Flyout label="Verificación">
          <Item onClick={() => onOpenModal('validate')}>Validación geométrica</Item>
          <Item onClick={() => onOpenModal('audit')}>Auditoría de elementos</Item>
          <Item onClick={() => onOpenModal('analysis-readiness')}>Preparación para análisis (CalculiX)…</Item>
        </Flyout>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item onClick={() => onOpenModal('generativePlacement')}>Colocación generativa por reglas…</Item>
        <Item onClick={() => onOpenModal('takeoff')}>Metrado automático…</Item>
        <Item onClick={() => onOpenModal('dimensions')}>Cotas vivas…</Item>
        <Item onClick={toggleFilterPanel}>Filtro por atributo…</Item>
        <div className="border-t border-[#e4e4e0] my-1" />
        <Item disabled>Asignar apoyos…</Item>
        <Item disabled>Cargas y combinaciones…</Item>
        <Item disabled>Análisis (CalculiX)…</Item>
      </Dropdown>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) importModelFromFile(e.target.files[0]); e.target.value = ''; }}
      />
    </nav>
  );
}
