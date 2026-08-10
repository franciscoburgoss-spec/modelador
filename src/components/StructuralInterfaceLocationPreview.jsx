function svgMapper(bounds, width = 520, height = 220, padding = 28) {
  if (!bounds) return null;
  const spanX = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanY = Math.max(bounds.yMax - bounds.yMin, 1);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const usedX = spanX * scale;
  const usedY = spanY * scale;
  const offsetX = (width - usedX) / 2;
  const offsetY = (height - usedY) / 2;
  return (point) => ({
    x: offsetX + (point.x - bounds.xMin) * scale,
    y: offsetY + (point.y - bounds.yMin) * scale
  });
}

function pointsAttribute(points, mapPoint) {
  return points.map((point) => {
    const mapped = mapPoint(point);
    return `${mapped.x},${mapped.y}`;
  }).join(' ');
}

function locationName(locatorKind, faceSide, end) {
  if (locatorKind === 'end') return end === 'lowS' ? 'extremo S mínimo' : 'extremo S máximo';
  if (locatorKind === 'region') return 'región S/Z';
  return faceSide === 'negativeN' ? 'cara −N' : 'cara +N';
}

function locateButtonLabel(locatorKind) {
  if (locatorKind === 'end') return 'Localizar extremo';
  if (locatorKind === 'region') return 'Localizar región';
  return 'Localizar cara';
}

export default function StructuralInterfaceLocationPreview({
  context,
  locatorKind,
  faceSide,
  end,
  onLocate
}) {
  if (!context?.canUse) {
    return <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">No hay geometría canónica suficiente para identificar esta ubicación.</div>;
  }

  const width = 520;
  const height = 220;
  const mapPoint = svgMapper(context.displayBounds, width, height);
  const centerline = context.centerline.map(mapPoint);
  const selectedFace = context.selected.faceSegment?.map(mapPoint) || null;
  const selectedName = locationName(locatorKind, faceSide, end);
  const lowPoint = mapPoint(context.centerline[0]);
  const highPoint = mapPoint(context.centerline[1]);
  const midPoint = {
    x: (lowPoint.x + highPoint.x) / 2,
    y: (lowPoint.y + highPoint.y) / 2
  };
  const selectedEnd = locatorKind === 'end' ? end : null;

  return (
    <section className="mt-3 rounded-lg border border-[#d9ddd9] bg-[#fafcfb] p-3" aria-label={`Contexto geométrico de interfaz. ${context.labels.hostPhrase}. ${selectedName}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Marco canónico del host</div>
          <div className="mt-0.5 text-xs text-[#66665f]">{context.labels.runAxis} · {context.labels.lowSLabel}→{context.labels.highSLabel} @ {context.labels.fixedLabel}</div>
        </div>
        <button
          id="structural-interface-location-locate-button"
          type="button"
          className="rounded border border-[#2f5d50] bg-white px-2.5 py-1.5 text-xs font-medium text-[#23483e]"
          onClick={onLocate}
        >{locateButtonLabel(locatorKind)}</button>
      </div>

      <svg
        className="mt-2 h-[220px] w-full rounded border border-[#e4e4e0] bg-white"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Vista en orientación de Planta del muro ${context.labels.hostPhrase}. Seleccionada ${selectedName}. +N corresponde a ${context.normalWorld.positiveN} y −N a ${context.normalWorld.negativeN}.`}
      >
        <defs>
          <marker id="iface-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="#2f5d50" /></marker>
          <marker id="iface-arrow-muted" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="#7b827e" /></marker>
        </defs>

        <polygon points={pointsAttribute(context.hostPolygon, mapPoint)} fill="#ecefea" stroke="#4b5563" strokeWidth="2" />
        <line x1={centerline[0].x} y1={centerline[0].y} x2={centerline[1].x} y2={centerline[1].y} stroke="#6b7280" strokeWidth="1.5" strokeDasharray="6 5" />
        <polygon points={pointsAttribute(context.selected.polygon, mapPoint)} fill="rgba(47,93,80,0.22)" stroke="#2f5d50" strokeWidth="3" />
        {selectedFace && <line x1={selectedFace[0].x} y1={selectedFace[0].y} x2={selectedFace[1].x} y2={selectedFace[1].y} stroke="#0f5132" strokeWidth="5" />}

        {context.arrows.map((arrow) => {
          const from = mapPoint(arrow.from);
          const to = mapPoint(arrow.to);
          const active = locatorKind === 'face' && context.selected.selectedGuide === arrow.key;
          return <g key={arrow.key}>
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={active ? '#2f5d50' : '#7b827e'}
              strokeWidth={active ? 3 : 1.75}
              markerEnd={active ? 'url(#iface-arrow-active)' : 'url(#iface-arrow-muted)'}
            />
            <text x={to.x + (context.axis === 'x' ? 8 : 0)} y={to.y + (context.axis === 'x' ? 4 : -8)} textAnchor={context.axis === 'x' ? 'start' : 'middle'} fontSize="12" fontWeight={active ? '700' : '600'} fill={active ? '#23483e' : '#5f6662'}>{arrow.label}</text>
          </g>;
        })}

        <g>
          <circle cx={lowPoint.x} cy={lowPoint.y} r={selectedEnd === 'lowS' ? 12 : 10} fill={selectedEnd === 'lowS' ? '#2f5d50' : '#fff'} stroke="#2f5d50" strokeWidth="2" />
          <text x={lowPoint.x} y={lowPoint.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={selectedEnd === 'lowS' ? '#fff' : '#23483e'}>{context.labels.lowSLabel}</text>
          <circle cx={highPoint.x} cy={highPoint.y} r={selectedEnd === 'highS' ? 12 : 10} fill={selectedEnd === 'highS' ? '#2f5d50' : '#fff'} stroke="#2f5d50" strokeWidth="2" />
          <text x={highPoint.x} y={highPoint.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={selectedEnd === 'highS' ? '#fff' : '#23483e'}>{context.labels.highSLabel}</text>
        </g>

        <g transform={`translate(${midPoint.x},${midPoint.y})`}>
          <rect x="-22" y="-10" width="44" height="20" rx="10" fill="#fff" stroke="#9ca3af" />
          <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#4b5563">@ {context.labels.fixedLabel}</text>
        </g>
      </svg>

      <div className="mt-2 grid gap-1 text-xs text-[#555b57] sm:grid-cols-2">
        <div><strong>S canónico:</strong> crece de {context.labels.lowSLabel} hacia {context.labels.highSLabel}.</div>
        <div><strong>Normal canónica:</strong> +N = {context.normalWorld.positiveN} de Planta · −N = {context.normalWorld.negativeN}.</div>
        {locatorKind === 'region' && <div className="sm:col-span-2"><strong>Región:</strong> S {context.sRange[0]}→{context.sRange[1]} · Z {context.zRange[0]}→{context.zRange[1]} mm.</div>}
      </div>
      <p className="mt-2 text-[11px] text-[#6b6b66]">La cara/extremo resaltado identifica sólo la ubicación física. No declara acción lateral, apoyo, transferencia ni capacidad.</p>
    </section>
  );
}
