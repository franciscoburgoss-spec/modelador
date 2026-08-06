import { useMemo, useState } from 'react';
import { structuralIntentVisualPolygons } from '../core/structuralIntentVisualHitTest.js';

function sameId(left, right) {
  return `${typeof left}:${String(left)}` === `${typeof right}:${String(right)}`;
}

function viewProjector(bounds, zoom, width = 560, height = 300) {
  const margin = 24;
  const spanX = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanY = Math.max(bounds.yMax - bounds.yMin, 1);
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY) * zoom;
  const cx = (bounds.xMin + bounds.xMax) / 2;
  const cy = (bounds.yMin + bounds.yMax) / 2;
  return (point) => ({
    x: width / 2 + (point.x - cx) * scale,
    y: height / 2 - (point.y - cy) * scale
  });
}

function polygonPoints(polygon, project) {
  return polygon.map((point) => {
    const screen = project(point);
    return `${screen.x},${screen.y}`;
  }).join(' ');
}

function polygonCenter(polygons, project) {
  const points = polygons.flat();
  if (points.length === 0) return { x: 0, y: 0 };
  return project({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  });
}

function PlanTarget({ target, project, context = false, active = false, hovered = false, onActivate, onHover }) {
  const polygons = structuralIntentVisualPolygons(target);
  if (polygons.length === 0) return null;
  const center = polygonCenter(polygons, project);
  const interactive = !context && typeof onActivate === 'function';
  const activate = () => interactive && onActivate(target.id);
  return (
    <g
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${target.mark || 'Objetivo'}: ${target.descriptor?.summary || String(target.id)}` : undefined}
      onClick={activate}
      onKeyDown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); activate();
        }
      }}
      onMouseEnter={() => onHover?.(target.id)}
      onMouseLeave={() => onHover?.(null)}
      className={interactive ? 'cursor-pointer outline-none' : undefined}
    >
      {polygons.map((polygon, index) => (
        <polygon
          key={index}
          points={polygonPoints(polygon, project)}
          fill={context ? 'rgba(107,114,128,0.08)' : 'rgba(124,58,237,0.16)'}
          stroke={hovered ? '#111827' : context ? '#6b7280' : '#7c3aed'}
          strokeWidth={hovered ? 5 : active ? 4 : context ? 1.5 : 3}
          strokeDasharray={context ? '5 5' : active ? undefined : '10 5'}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {!context && (target.openings || []).map((opening) => (
        <polygon
          key={`opening-${String(opening.id)}`}
          points={polygonPoints(opening.planGeometry?.polygon || [], project)}
          fill="white"
          stroke="#111827"
          strokeWidth="2"
          strokeDasharray="5 3"
          vectorEffect="non-scaling-stroke"
          aria-label={`${opening.kind} ${String(opening.id)}`}
        />
      ))}
      {!context && target.mark && (
        <g>
          <rect x={center.x - 17} y={center.y - 13} width="34" height="26" rx="3" fill="white" stroke="#111827" strokeWidth="2" />
          <text x={center.x} y={center.y + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{target.mark}</text>
        </g>
      )}
    </g>
  );
}

function ElevationPreview({ target }) {
  const geometry = target?.elevationGeometry;
  const solids = geometry?.solids || [];
  const rectangles = geometry?.rect
    ? [{ key: 'target', rect: geometry.rect, role: null }]
    : solids.map((solid, index) => ({ key: `${solid.role || 'solid'}-${index}`, rect: solid.rect, role: solid.role }));
  if (rectangles.length === 0) return <p className="p-4 text-sm text-[#6b6b66]">No existe elevación visual para este tipo.</p>;
  const openings = geometry.openings || [];
  const minS = Math.min(...rectangles.map(({ rect }) => rect.s0), ...openings.map((opening) => opening.s0));
  const maxS = Math.max(...rectangles.map(({ rect }) => rect.s1), ...openings.map((opening) => opening.s1));
  const minZ = Math.min(...rectangles.map(({ rect }) => rect.z0), ...openings.map((opening) => opening.z0));
  const maxZ = Math.max(...rectangles.map(({ rect }) => rect.z1), ...openings.map((opening) => opening.z1));
  const project = viewProjector({ xMin: minS, xMax: maxS, yMin: minZ, yMax: maxZ }, 1);
  return (
    <svg viewBox="0 0 560 300" className="h-[300px] w-full bg-white" aria-label={`Elevación de ${target.descriptor?.summary || target.id}`}>
      {rectangles.map(({ key, rect, role }) => {
        const a = project({ x: rect.s0, y: rect.z0 });
        const b = project({ x: rect.s1, y: rect.z1 });
        return (
          <g key={key}>
            <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="rgba(124,58,237,0.12)" stroke="#7c3aed" strokeWidth="4" />
            {role && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} textAnchor="middle" fontSize="11">{role}</text>}
          </g>
        );
      })}
      {openings.map((opening) => {
        const start = project({ x: opening.s0, y: opening.z0 });
        const end = project({ x: opening.s1, y: opening.z1 });
        return <rect key={String(opening.id)} x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)} width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)} fill="white" stroke="#111827" strokeWidth="2" strokeDasharray="6 3" />;
      })}
      <text x="280" y="22" textAnchor="middle" fontSize="13" fontWeight="700">T · ID {String(target.id)}</text>
    </svg>
  );
}

export default function StructuralIntentVisualPreview({
  preview,
  activeId,
  onActivate,
  onHover,
  onLocate,
  locateDisabled = false,
  locateDisabledReason = null,
  locateButtonId = undefined,
  hoveredId: externalHoveredId = null,
  title = 'Identificación visual'
}) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('plan');
  const [hoveredId, setHoveredId] = useState(null);
  const bounds = preview?.visibleBounds || preview?.targetBounds;
  const project = useMemo(() => bounds ? viewProjector(bounds, zoom) : null, [bounds, zoom]);
  const selected = preview?.selected || [];
  const active = selected.find((target) => sameId(target.id, activeId ?? preview?.activeId)) || selected[0] || null;
  const individual = selected.length === 1;
  const resolvedHoveredId = externalHoveredId ?? hoveredId;
  const handleHover = (id) => {
    setHoveredId(id);
    onHover?.(id);
  };

  if (!preview || selected.length === 0) {
    return <div className="rounded border border-dashed p-4 text-sm text-[#6b6b66]">Seleccione un elemento para visualizarlo.</div>;
  }

  return (
    <section className="overflow-hidden rounded border border-[#d8d8d3] bg-white" aria-labelledby="structural-intent-visual-title">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#fafaf7] px-3 py-2">
        <div>
          <h3 id="structural-intent-visual-title" className="font-semibold">{title}</h3>
          <p className="text-xs text-[#6b6b66]">{individual ? 'Objetivo T' : `${selected.length} objetivos S1…S${selected.length}`} · contexto geométrico, sin inferencia estructural.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Controles de preview">
          {individual && <button className={`rounded border px-2 py-1 text-xs ${view === 'plan' ? 'bg-[#e9eee9]' : ''}`} onClick={() => setView('plan')}>Planta</button>}
          {individual && <button className={`rounded border px-2 py-1 text-xs ${view === 'elevation' ? 'bg-[#e9eee9]' : ''}`} onClick={() => setView('elevation')}>Elevación</button>}
          <button aria-label="Acercar preview" className="rounded border px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.min(value * 1.25, 4))}>+</button>
          <button aria-label="Alejar preview" className="rounded border px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.max(value / 1.25, 0.5))}>−</button>
          <button className="rounded border px-2 py-1 text-xs" onClick={() => setZoom(1)}>Encuadrar</button>
          {onLocate && <button
            id={locateButtonId}
            className="rounded bg-[#2f5d50] px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={locateDisabled || !preview.canUse}
            title={locateDisabledReason || undefined}
            onClick={onLocate}
          >Localizar</button>}
        </div>
      </header>
      {preview.stale && <div role="alert" className="border-b border-amber-300 bg-amber-50 p-2 text-sm">La geometría visible está stale. Recárguela antes de guardar o localizar.</div>}
      {preview.brokenReferences?.length > 0 && <div role="alert" className="border-b border-red-300 bg-red-50 p-2 text-sm">Referencia rota: {preview.brokenReferences.map(String).join(', ')}.</div>}
      {view === 'elevation' && individual ? <ElevationPreview target={active} /> : (
        <svg viewBox="0 0 560 300" className="h-[300px] w-full bg-white" aria-label={`Preview en planta de ${selected.length} objetivo${selected.length === 1 ? '' : 's'}`}>
          {project && (preview.context || []).map((target) => <PlanTarget key={`context-${String(target.id)}`} target={target} project={project} context />)}
          {project && selected.map((target) => <PlanTarget
            key={`selected-${String(target.id)}`}
            target={target}
            project={project}
            active={sameId(target.id, active?.id)}
            hovered={sameId(target.id, resolvedHoveredId)}
            onActivate={onActivate}
            onHover={handleHover}
          />)}
        </svg>
      )}
      <div className="border-t px-3 py-2 text-xs" aria-live="polite">
        <strong>{active?.mark || 'T'}</strong> · {active?.descriptor?.summary || `ID ${String(active?.id)}`}
      </div>
    </section>
  );
}
