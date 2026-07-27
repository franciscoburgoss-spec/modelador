// components/PropertiesPanel.jsx
import { useModelStore } from '../store/useModelStore.js';
import { getWallDisplayName, getOpeningDisplayName, formatAxisFieldLabel } from '../core/naming.js';
import { isFormula, resolveValue, buildParamsMap, formatDim } from '../core/projectParams.js';
import { isWallXRun } from '../core/elementGeometry.js';
import { validateRoofSystems } from '../core/trussLayout.js';
import { buildElementsById } from '../core/elementReferences.js';
import { resolveRoofPlane } from '../core/roofPlane.js';
import { getElementShortLabel } from '../core/naming.js';
import { Button } from './ui/Button.jsx';

const TYPE_LABELS = { wall: 'Muro', column: 'Pilar', beam: 'Viga', foundation: 'Fundación' };
const LIBRARY_KEY = { wall: 'wallSections', column: 'columnSections', beam: 'beamSections', foundation: 'foundationSections' };




function findLibraryName(library, type, libraryId) {
  if (!libraryId) return '—';
  const key = LIBRARY_KEY[type];
  if (!key) return '—';
  return library[key].find(i => i.id === libraryId)?.name ?? '—';
}

function ElementFields({ el, grid, library, paramsMap, elementsById }) {
  if (el.type === 'column') {
    return (
      <>
        <Field label="Eje X" value={formatAxisFieldLabel(el.axisXId, grid.xAxes, grid, elementsById)} />
        <Field label="Eje Y" value={formatAxisFieldLabel(el.axisYId, grid.yAxes, grid, elementsById)} />
        <Field label="Nivel inferior" value={grid.zLevels.find(z => z.id === el.bottomZ)?.label ?? '—'} />
        <Field label="Nivel superior" value={grid.zLevels.find(z => z.id === el.topZ)?.label ?? '—'} />
        <Field label="Ancho X" value={formatDim(el.widthX, paramsMap, elementsById)} />
        <Field label="Ancho Y" value={formatDim(el.widthY, paramsMap, elementsById)} />
        <Field label="Sección de librería" value={findLibraryName(library, 'column', el.libraryId)} />
      </>
    );
  }
  if (el.type === 'beam') {
    const fixedAxes = el.direction === 'x' ? grid.yAxes : grid.xAxes;
    const rangeAxes = el.direction === 'x' ? grid.xAxes : grid.yAxes;
    return (
      <>
        <Field label="Dirección" value={el.direction === 'x' ? 'Corre en X' : 'Corre en Y'} />
        <Field label="Eje fijo" value={formatAxisFieldLabel(el.fixedAxisId, fixedAxes, grid, elementsById)} />
        <Field label="Desde" value={formatAxisFieldLabel(el.startAxisId, rangeAxes, grid, elementsById)} />
        <Field label="Hasta" value={formatAxisFieldLabel(el.endAxisId, rangeAxes, grid, elementsById)} />
        <Field label="Nivel Z" value={grid.zLevels.find(z => z.id === el.levelZ)?.label ?? '—'} />
        <Field label="Ancho" value={formatDim(el.width, paramsMap, elementsById)} />
        <Field label="Sección de librería" value={findLibraryName(library, 'beam', el.libraryId)} />
      </>
    );
  }
  if (el.type === 'wall') {
    const isXRun = isWallXRun(el);
    return (
      <>
        <Field label="Dirección" value={isXRun ? 'Corre en X' : 'Corre en Y'} />
        <Field label="Eje fijo" value={isXRun ? formatAxisFieldLabel(el.yStart, grid.yAxes, grid, elementsById) : formatAxisFieldLabel(el.xStart, grid.xAxes, grid, elementsById)} />
        <Field label="Desde" value={isXRun ? formatAxisFieldLabel(el.xStart, grid.xAxes, grid, elementsById) : formatAxisFieldLabel(el.yStart, grid.yAxes, grid, elementsById)} />
        <Field label="Hasta" value={isXRun ? formatAxisFieldLabel(el.xEnd, grid.xAxes, grid, elementsById) : formatAxisFieldLabel(el.yEnd, grid.yAxes, grid, elementsById)} />
        <Field label="Nivel inferior" value={grid.zLevels.find(z => z.id === el.bottomZ)?.label ?? '—'} />
        <Field label="Nivel superior" value={grid.zLevels.find(z => z.id === el.topZ)?.label ?? '—'} />
        <Field label="Espesor" value={formatDim(el.thickness, paramsMap, elementsById)} />
        <Field label="Sección de librería" value={findLibraryName(library, 'wall', el.libraryId)} />
        <Field label="Vanos" value={`${(el.openings || []).length}`} />
      </>
    );
  }
  if (el.type === 'foundation') {
    if (el.foundationType === 'aislada') {
      return (
        <>
          <Field label="Tipo" value="Zapata aislada" />
          <Field label="Eje X" value={formatAxisFieldLabel(el.axisXId, grid.xAxes, grid, elementsById)} />
          <Field label="Eje Y" value={formatAxisFieldLabel(el.axisYId, grid.yAxes, grid, elementsById)} />
          <Field label="Largo X" value={formatDim(el.aislada?.lengthX, paramsMap, elementsById)} />
          <Field label="Largo Y" value={formatDim(el.aislada?.lengthY, paramsMap, elementsById)} />
          <Field label="Altura" value={formatDim(el.aislada?.depth, paramsMap, elementsById)} />
          <Field label="Nivel base" value={grid.zLevels.find(z => z.id === el.levelZ)?.label ?? 'Sin asignar'} />
          <Field label="Pilar de referencia" value={el.columnId ? `#${el.columnId}` : '—'} />
          <Field label="Emplantillado" value={el.emplantillado ? `${formatDim(el.emplantillado.thickness, paramsMap, elementsById)} (+${formatDim(el.emplantillado.overhang, paramsMap, elementsById)}/lado)` : 'No'} />
          <Field label="Sección de librería" value={findLibraryName(library, 'foundation', el.libraryId)} />
        </>
      );
    }
    const fixedAxes = el.direction === 'x' ? grid.yAxes : grid.xAxes;
    const rangeAxes = el.direction === 'x' ? grid.xAxes : grid.yAxes;
    return (
      <>
        <Field label="Tipo" value="Fundación corrida" />
        <Field label="Dirección" value={el.direction === 'x' ? 'Corre en X' : 'Corre en Y'} />
        <Field label="Eje fijo" value={formatAxisFieldLabel(el.fixedAxisId, fixedAxes, grid, elementsById)} />
        <Field label="Desde" value={formatAxisFieldLabel(el.startAxisId, rangeAxes, grid, elementsById)} />
        <Field label="Hasta" value={formatAxisFieldLabel(el.endAxisId, rangeAxes, grid, elementsById)} />
        <Field label="Cimiento" value={el.cimiento ? `${formatDim(el.cimiento.width, paramsMap, elementsById)} × ${formatDim(el.cimiento.depth, paramsMap, elementsById)}` : '—'} />
        <Field label="Sobrecimiento" value={el.sobrecimiento ? `${formatDim(el.sobrecimiento.width, paramsMap, elementsById)} × ${formatDim(el.sobrecimiento.height, paramsMap, elementsById)}` : 'No'} />
        <Field label="Emplantillado" value={el.emplantillado ? `${formatDim(el.emplantillado.thickness, paramsMap, elementsById)} (+${formatDim(el.emplantillado.overhang, paramsMap, elementsById)}/lado)` : 'No'} />
        <Field label="Nivel base" value={grid.zLevels.find(z => z.id === el.levelZ)?.label ?? 'Sin asignar'} />
        <Field label="Desfase del tope" value={formatDim(el.topOffset ?? 0, paramsMap, elementsById)} />
        <Field label="Sección de librería" value={findLibraryName(library, 'foundation', el.libraryId)} />
      </>
    );
  }
  return null;
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[#5a5a55]">{label}</span>
      <span className="font-medium text-[#1a1a18]">{value}</span>
    </div>
  );
}

/** Resumen de solo lectura de un sistema de techumbre (la edición sigue en RoofTrussModal). */
function RoofSystemPanel({ system, grid, library, onEdit, findings }) {
  const selectRoofSystem = useModelStore((s) => s.selectRoofSystem);
  const removeRoofSystem = useModelStore((s) => s.removeRoofSystem);
  const geo = system.trussGeometry;
  const template = (library.trussTemplates || []).find(t => t.id === system.templateId);

  const handleDelete = () => {
    if (window.confirm('¿Eliminar el sistema de techumbre y sus cerchas?')) removeRoofSystem(system.id);
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl w-80 pointer-events-auto"
      style={{ top: 80, right: 24, zIndex: 110 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 bg-[#f2f2ee] border-b border-[#e4e4e0] rounded-t-lg flex items-center justify-between">
        <span className="font-semibold text-sm text-[#3d3d38]">Techumbre #{system.id}</span>
        <button className="text-[#8a8a85] hover:text-[#5a5a55] text-lg leading-none" onClick={() => selectRoofSystem(null)}>×</button>
      </div>
      <div className="p-4 text-sm max-h-[60vh] overflow-y-auto">
        <Field label="Luz" value={geo?.span != null ? `${(geo.span / 1000).toFixed(2)} m` : '—'} />
        <Field label="Pendiente" value={`${system.slopePercent ?? '—'} %`} />
        <Field label="N° de cerchas" value={`${(system.trussPositions || []).length}`} />
        <Field label="Espaciamiento" value={`${system.trussSpacing ?? '—'} mm`} />
        <Field label="Cota de apoyo" value={system.supportElevation != null ? `${Math.round(system.supportElevation)} mm` : '—'} />
        <Field label="Avance" value={system.runAxis === 'x' ? 'Cerchas sobre ejes X' : 'Cerchas sobre ejes Y'} />
        <Field label="Plantilla" value={template?.name ?? '—'} />
        <Field label="Alturas talón / cumbrera" value={geo?.resolved ? `${Math.round(geo.heightLow)} / ${Math.round(geo.heightHigh)} mm` : '—'} />
        {system.stale && <div className="mt-2 text-xs text-amber-700">Geometría desactualizada: regenerar en el modal.</div>}
        {(findings || []).map((f, i) => (
          <div key={i} className={`mt-2 text-xs ${f.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
            {f.message}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[#e4e4e0] space-y-2">
        <Button variant="primary" className="w-full text-center" onClick={() => onEdit('roofTruss', system.id)}>
          Editar…
        </Button>
        <Button variant="danger" className="w-full text-center" onClick={handleDelete}>
          Eliminar sistema
        </Button>
        <Button variant="secondary" className="w-full text-center" onClick={() => selectRoofSystem(null)}>
          Deseleccionar
        </Button>
      </div>
    </div>
  );
}

const SEV_COLOR = { error: 'text-red-700', warning: 'text-amber-700', info: 'text-[#6a6a63]' };

/** ★ B4.7.4c — Resumen del faldón seleccionado (la edición reabre RoofPlaneModal). Resuelve el
 * faldón en vivo para mostrar pendiente/tramos/cerchas + findings; nunca bloquea. */
function RoofPlanePanel({ plane, model, paramsMap, elementsById }) {
  const grid = model.grid;
  const library = model.library;
  const selectRoofPlane = useModelStore((s) => s.selectRoofPlane);
  const removeRoofPlane = useModelStore((s) => s.removeRoofPlane);
  const startEditRoofPlane = useModelStore((s) => s.startEditRoofPlane);

  let resolved = null;
  try {
    resolved = resolveRoofPlane({ model, plane, paramsMap, elementsById, library });
  } catch (err) {
    resolved = { resolved: false, findings: [{ severity: 'error', message: `error al resolver: ${err.message}` }], tramos: [], trussPositions: [] };
  }
  const template = (library.trussTemplates || []).find(t => t.id === plane.templateId);
  const canalWall = plane.canalWallId != null ? elementsById[plane.canalWallId] : null;
  const level = grid.zLevels.find(l => l.id === plane.supportLevelId);

  const handleDelete = () => {
    if (window.confirm('¿Eliminar el faldón de techumbre?')) removeRoofPlane(plane.id);
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl w-80 pointer-events-auto"
      style={{ top: 80, right: 24, zIndex: 110 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 bg-[#f2f2ee] border-b border-[#e4e4e0] rounded-t-lg flex items-center justify-between">
        <span className="font-semibold text-sm text-[#3d3d38]">Faldón #{plane.id}</span>
        <button className="text-[#8a8a85] hover:text-[#5a5a55] text-lg leading-none" onClick={() => selectRoofPlane(null)}>×</button>
      </div>
      <div className="p-4 text-sm max-h-[60vh] overflow-y-auto">
        <Field label="Pendiente" value={resolved?.resolved ? `${resolved.slopePercent?.toFixed(2)} %` : '—'} />
        <Field label="N° de tramos" value={`${(resolved?.tramos || []).length}`} />
        <Field label="N° de cerchas" value={`${(resolved?.trussPositions || []).length}`} />
        <Field label="Paso de cerchas" value={`${plane.trussSpacing ?? '—'} mm`} />
        <Field label="Canaleta" value={canalWall ? getElementShortLabel(canalWall, grid) : '—'} />
        <Field label="Nivel de cielo" value={level ? `${level.name} (${Math.round(level.elevation)}mm)` : '—'} />
        <Field label="Plantilla" value={template?.name ?? '—'} />
        <Field label="Vértices del contorno" value={`${(plane.polygon || []).length}`} />
        {(resolved?.findings || []).length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs">
            {resolved.findings.map((f, i) => (
              <li key={i} className={SEV_COLOR[f.severity] || 'text-[#6a6a63]'}>· {f.message}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-4 border-t border-[#e4e4e0] space-y-2">
        <Button variant="primary" className="w-full text-center" onClick={() => startEditRoofPlane(plane.id)}>
          Editar…
        </Button>
        <Button variant="danger" className="w-full text-center" onClick={handleDelete}>
          Eliminar faldón
        </Button>
        <Button variant="secondary" className="w-full text-center" onClick={() => selectRoofPlane(null)}>
          Deseleccionar
        </Button>
      </div>
    </div>
  );
}

export default function PropertiesPanel({ onEdit }) {
  const model = useModelStore((s) => s.model);
  const selectedElementId = useModelStore((s) => s.model.selectedElementId);
  const selectedRoofSystemId = useModelStore((s) => s.model.selectedRoofSystemId);
  const selectedRoofPlaneId = useModelStore((s) => s.model.selectedRoofPlaneId);
  const roofSystems = useModelStore((s) => s.model.roofSystems || []);
  const roofPlanes = useModelStore((s) => s.model.roofPlanes || []);
  const elements = useModelStore((s) => s.model.elements);
  const grid = useModelStore((s) => s.model.grid);
  const library = useModelStore((s) => s.model.library);
  const projectParams = useModelStore((s) => s.model.projectParams || []);
  const selectElement = useModelStore((s) => s.selectElement);
  const deleteSelectedElement = useModelStore((s) => s.deleteSelectedElement);
  const paramsMap = buildParamsMap(projectParams);
  const elementsById = buildElementsById(elements);

  const selectedRoof = selectedRoofSystemId != null ? roofSystems.find(r => r.id === selectedRoofSystemId) : null;
  const selectedRoofFindings = selectedRoof
    ? validateRoofSystems(model).filter(f => f.roofSystemIds.includes(selectedRoof.id))
    : [];

  let el = elements.find(e => e.id === selectedElementId);
  let parentWall = null;
  if (!el) {
    for (const wall of elements) {
      const opening = (wall.openings || []).find(o => o.id === selectedElementId);
      if (opening) { el = opening; parentWall = wall; break; }
    }
  }
  const selectedPlane = selectedRoofPlaneId != null ? roofPlanes.find(p => p.id === selectedRoofPlaneId) : null;
  if (selectedPlane) return <RoofPlanePanel plane={selectedPlane} model={model} paramsMap={paramsMap} elementsById={elementsById} />;
  if (selectedRoof) return <RoofSystemPanel system={selectedRoof} grid={grid} library={library} onEdit={onEdit} findings={selectedRoofFindings} />;
  if (!el) return null;

  const title = parentWall
    ? getOpeningDisplayName(el, parentWall, grid)
    : (el.type === 'wall' ? getWallDisplayName(el, grid) : `${TYPE_LABELS[el.type] || el.type} #${el.id}`);

  const handleEdit = () => {
    if (parentWall) onEdit('opening', el.id, parentWall.id);
    else onEdit(el.type, el.id);
  };

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl w-80 pointer-events-auto"
      style={{ top: 80, right: 24, zIndex: 110 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 bg-[#f2f2ee] border-b border-[#e4e4e0] rounded-t-lg flex items-center justify-between">
        <span className="font-semibold text-sm text-[#3d3d38]">{title} #{el.id}</span>
        <button className="text-[#8a8a85] hover:text-[#5a5a55] text-lg leading-none" onClick={() => selectElement(null)}>×</button>
      </div>
      <div className="p-4 text-sm max-h-[60vh] overflow-y-auto">
        {parentWall ? (
          <>
            <Field label="Posición en el muro" value={`${el.position} mm`} />
            <Field label="Ancho" value={formatDim(el.width, paramsMap, elementsById)} />
            <Field label="Alto" value={formatDim(el.height, paramsMap, elementsById)} />
            {el.type === 'window' && <Field label="Altura de antepecho" value={formatDim(el.sillHeight, paramsMap, elementsById)} />}
            <Field label="Sección de librería" value={findLibraryName(library, el.type, el.libraryId)} />
            <Button variant="secondary" className="mt-2 !py-1 !text-xs" onClick={() => selectElement(parentWall.id)}>
              Ir al muro contenedor
            </Button>
          </>
        ) : (
          <ElementFields el={el} grid={grid} library={library} paramsMap={paramsMap} elementsById={elementsById} />
        )}
      </div>
      <div className="p-4 border-t border-[#e4e4e0] space-y-2">
        <Button variant="primary" className="w-full text-center" onClick={handleEdit}>
          Editar
        </Button>
        {el.type === 'wall' && !parentWall && (
          <Button variant="secondary" className="w-full text-center" onClick={() => onEdit('wallSplit', el.id)}>
            Dividir / unir…
          </Button>
        )}
        <Button variant="danger" className="w-full text-center" onClick={deleteSelectedElement}>
          Eliminar seleccionado
        </Button>
        <Button variant="secondary" className="w-full text-center" onClick={() => selectElement(null)}>
          Deseleccionar
        </Button>
      </div>
    </div>
  );
}
