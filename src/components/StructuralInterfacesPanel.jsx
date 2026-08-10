import { useEffect, useMemo, useState } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import { structuralConceptOptions } from '../core/structuralConceptGlossary.js';
import { StructuralConceptHint } from './StructuralConceptHelp.jsx';
import { canonicalizeRoofBoundaries } from '../core/roofStructuralIntent.js';
import {
  describeInterfaceIntent,
  evaluateInterfaceFreshness,
  evaluateRelationFreshness,
  roofBoundaryLongitudinalRange,
  roofBoundarySegmentForLocator
} from '../core/structuralInterfaces.js';
import { wallFrame } from '../core/structuralProposalCommon.js';
import { buildStructuralInterfaceWallContext } from '../core/structuralInterfaceVisualContext.js';
import { buildRoofPlanContext } from '../core/structuralIntentWorkspace.js';
import StructuralInterfaceLocationPreview from './StructuralInterfaceLocationPreview.jsx';

const EMPTY_INTENTS = Object.freeze([]);

function humanWall(row) {
  return row?.descriptor?.summary?.replace(/\s*·\s*ID\s+.+$/, '') || `Elemento ${String(row?.id ?? '')}`;
}

function fmt(value) {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedPair(left, right) {
  return [Math.min(left, right), Math.max(left, right)];
}

function sameRange(left, right, tolerance = 1e-6) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === 2 && right.length === 2
    && Math.abs(left[0] - right[0]) <= tolerance
    && Math.abs(left[1] - right[1]) <= tolerance;
}

function segmentLength3d(segment) {
  if (!segment?.start || !segment?.end) return null;
  return Math.hypot(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y,
    segment.end.z - segment.start.z
  );
}

function segmentBounds(segment) {
  if (!segment?.start || !segment?.end) return null;
  return {
    xMin: Math.min(segment.start.x, segment.end.x),
    xMax: Math.max(segment.start.x, segment.end.x),
    yMin: Math.min(segment.start.y, segment.end.y),
    yMax: Math.max(segment.start.y, segment.end.y)
  };
}

function sameId(left, right) {
  return `${typeof left}:${String(left)}` === `${typeof right}:${String(right)}`;
}

function interfaceLocationLabel(locator) {
  if (locator?.kind === 'face') return locator.side === 'positiveN' ? 'Cara +N' : 'Cara −N';
  if (locator?.kind === 'end') return locator.end === 'lowS' ? 'Extremo S mínimo' : 'Extremo S máximo';
  if (locator?.kind === 'region') return 'Región S/Z';
  if (locator?.kind === 'boundary') return 'Borde de cubierta';
  return 'Interfaz estructural';
}

function splitHumanWall(row) {
  const parts = humanWall(row).split(' · ');
  return {
    primary: parts.slice(0, 2).join(' · '),
    detail: parts.slice(2).join(' · ')
  };
}

function interfaceRangeLabel(intent, fallback) {
  const locator = intent?.locator;
  if (Array.isArray(locator?.sRange) && Array.isArray(locator?.zRange)) {
    return `S ${locator.sRange[0]}→${locator.sRange[1]} · Z ${locator.zRange[0]}→${locator.zRange[1]}`;
  }
  return fallback;
}

function defaultRegion(row, geometry) {
  const element = geometry.elements.find((item) => String(item.id) === String(row?.id));
  const frame = element ? wallFrame(element) : null;
  return frame ? { ownerId: row.id, s0: frame.s0, s1: frame.s1, z0: frame.z0, z1: frame.z1 } : null;
}

export default function StructuralInterfacesPanel({ workspace }) {
  const model = useModelStore((state) => state.model);
  const applyTransaction = useModelStore((state) => state.applyStructuralInterfaceTransaction);
  const removeInterface = useModelStore((state) => state.removeStructuralInterfaceIntent);
  const removeRelation = useModelStore((state) => state.removeStructuralRelationIntent);
  const openStructuralIntentLocator = useModelStore((state) => state.openStructuralIntentLocator);
  const fitStructuralIntentLocator = useModelStore((state) => state.fitStructuralIntentLocator);
  const geometry = workspace.geometry;
  const wallRows = useMemo(() => workspace.elementRows.filter((row) => row.type === 'wall' && row.visualState !== 'brokenReference'), [workspace]);
  const roofBoundaries = useMemo(() => geometry.roofGeometry.flatMap((roof) => {
    const planContext = buildRoofPlanContext(model, roof);
    const visualBoundaryById = new Map((planContext?.boundaries || []).map((boundary) => [boundary.boundaryId, boundary]));
    const roofDescriptor = planContext?.descriptor?.primary || 'Ejes nominales no resueltos';
    return canonicalizeRoofBoundaries(roof).map((boundary, index) => {
      const visualBoundary = visualBoundaryById.get(boundary.boundaryId);
      const boundaryLabel = visualBoundary?.label || `B${index + 1}`;
      return {
        roof,
        boundary,
        boundaryLabel,
        roofDescriptor,
        label: `Cubierta · ${roofDescriptor} · ${boundaryLabel}`
      };
    });
  }), [geometry, model]);
  const interfaceIntents = model.structuralIntent?.interfaceIntents ?? EMPTY_INTENTS;
  const relationIntents = model.structuralIntent?.relationIntents ?? EMPTY_INTENTS;
  const interfaceById = useMemo(() => new Map(interfaceIntents.map((item) => [item.interfaceId, item])), [interfaceIntents]);
  const [ownerKind, setOwnerKind] = useState('element');
  const [elementId, setElementId] = useState(wallRows[0]?.id ?? '');
  const [roofBoundaryKey, setRoofBoundaryKey] = useState(roofBoundaries[0] ? `${roofBoundaries[0].roof.id}|${roofBoundaries[0].boundary.boundaryId}` : '');
  const [roofS0, setRoofS0] = useState('');
  const [roofS1, setRoofS1] = useState('');
  const [locatorKind, setLocatorKind] = useState('face');
  const [faceSide, setFaceSide] = useState('positiveN');
  const [end, setEnd] = useState('lowS');
  const [s0, setS0] = useState('');
  const [s1, setS1] = useState('');
  const [z0, setZ0] = useState('');
  const [z1, setZ1] = useState('');
  const [notes, setNotes] = useState('');
  const [interfaceError, setInterfaceError] = useState(null);

  const [selectedPorts, setSelectedPorts] = useState({});
  const [actionFamily, setActionFamily] = useState('gravity');
  const [structuralFunction, setStructuralFunction] = useState('support');
  const [regions, setRegions] = useState([]);
  const [relationNotes, setRelationNotes] = useState('');
  const [relationError, setRelationError] = useState(null);

  const selectedRoofBoundary = useMemo(() => roofBoundaries.find(
    (item) => `${item.roof.id}|${item.boundary.boundaryId}` === roofBoundaryKey
  ) || null, [roofBoundaries, roofBoundaryKey]);
  const selectedRoofBoundaryRange = useMemo(
    () => roofBoundaryLongitudinalRange(selectedRoofBoundary?.boundary),
    [selectedRoofBoundary]
  );
  const selectedWallRow = useMemo(() => wallRows.find((row) => String(row.id) === String(elementId)) || null, [elementId, wallRows]);
  const selectedWall = useMemo(() => geometry.elements.find((item) => String(item.id) === String(elementId)) || null, [elementId, geometry]);
  const selectedVisualTarget = useMemo(() => [...workspace.visualPresentation.targets, ...workspace.visualPresentation.orphans].find((item) => String(item.id) === String(elementId)) || null, [elementId, workspace.visualPresentation]);

  const visualTargetForElement = (id) => [...workspace.visualPresentation.targets, ...workspace.visualPresentation.orphans]
    .find((item) => sameId(item.id, id)) || null;

  const persistedInterfacePresentation = (intent) => {
    const desc = describeInterfaceIntent(geometry, intent);
    const state = evaluateInterfaceFreshness(geometry, intent);
    const owner = intent?.ownerRef;
    if (owner?.kind === 'element') {
      const row = wallRows.find((item) => sameId(item.id, owner.id));
      const wall = geometry.elements.find((item) => sameId(item.id, owner.id));
      const visualTarget = visualTargetForElement(owner.id);
      const host = row ? splitHumanWall(row) : { primary: `Elemento ${String(owner.id)}`, detail: '' };
      const locator = intent.locator || {};
      const context = wall ? buildStructuralInterfaceWallContext({
        wall,
        visualTarget,
        locatorKind: locator.kind,
        faceSide: locator.side,
        end: locator.end,
        sRange: locator.sRange,
        zRange: locator.zRange
      }) : null;
      return {
        title: `${interfaceLocationLabel(locator)} · ${host.primary}`,
        detail: host.detail,
        range: interfaceRangeLabel(intent, desc.subtitle),
        state,
        locatorPreview: context?.locatorPreview || null,
        activeId: owner.id
      };
    }
    if (owner?.kind === 'roofBoundary') {
      const roof = geometry.roofGeometry.find((item) => sameId(item.id, owner.roofGeometryId));
      const planContext = roof ? buildRoofPlanContext(model, roof) : null;
      const boundary = planContext?.boundaries.find((item) => item.boundaryId === owner.boundaryId) || null;
      const segment = boundary ? roofBoundarySegmentForLocator(boundary, intent.locator) : null;
      const roofTarget = planContext?.visualPreview?.selected?.[0];
      const locatorBounds = segmentBounds(segment);
      const locatorPreview = roofTarget && segment && locatorBounds ? {
        canUse: true,
        kind: 'proposal-relation',
        selected: [{ ...roofTarget, targetType: 'interface', mark: boundary.label || 'B' }],
        context: [],
        activeId: owner.roofGeometryId,
        boundary: segment,
        overlapSegments: [segment],
        targetBounds: locatorBounds,
        visibleBounds: locatorBounds
      } : null;
      const declaredRange = Array.isArray(intent.locator?.sRange) ? intent.locator.sRange : null;
      const interactionLength = segmentLength3d(segment);
      return {
        title: `${interfaceLocationLabel(intent.locator)} · Cubierta · ${planContext?.descriptor?.primary || 'Ejes nominales no resueltos'}${boundary?.label ? ` · ${boundary.label}` : ''}`,
        detail: boundary
          ? declaredRange
            ? `${boundary.label} · borde físico ${fmt(boundary.length3d)} mm`
            : `${boundary.label} · ${fmt(boundary.length3d)} mm`
          : '',
        range: boundary
          ? declaredRange && interactionLength !== null
            ? `Interacción S ${declaredRange[0]}→${declaredRange[1]} · ${fmt(interactionLength)} mm`
            : 'Borde canónico vigente'
          : 'Borde canónico no resoluble',
        state,
        locatorPreview,
        activeId: owner.roofGeometryId
      };
    }
    return { title: desc.title, detail: '', range: desc.subtitle, state, locatorPreview: null, activeId: null };
  };

  const locatePersistedInterface = (intent, presentation) => {
    if (presentation.state.state !== 'fresh' || !presentation.locatorPreview?.canUse) return;
    const sourceFocusId = `structural-interface-card-locate-${intent.interfaceId}`;
    openStructuralIntentLocator({
      preview: presentation.locatorPreview,
      activeId: presentation.activeId,
      sourceFocusId
    });
    requestAnimationFrame(() => fitStructuralIntentLocator());
  };

  useEffect(() => {
    if (ownerKind !== 'element') return;
    const row = wallRows.find((item) => String(item.id) === String(elementId));
    const region = defaultRegion(row, geometry);
    if (!region) return;
    setS0(String(region.s0)); setS1(String(region.s1)); setZ0(String(region.z0)); setZ1(String(region.z1));
  }, [elementId, geometry, ownerKind, wallRows]);

  useEffect(() => {
    if (ownerKind !== 'roofBoundary') return;
    if (!selectedRoofBoundaryRange) {
      setRoofS0('');
      setRoofS1('');
      return;
    }
    setRoofS0(String(selectedRoofBoundaryRange[0]));
    setRoofS1(String(selectedRoofBoundaryRange[1]));
  }, [ownerKind, roofBoundaryKey, selectedRoofBoundaryRange]);

  useEffect(() => {
    if (!wallRows.some((row) => String(row.id) === String(elementId)) && wallRows[0]) setElementId(wallRows[0].id);
  }, [elementId, wallRows]);

  const interfaceLocationContext = useMemo(() => buildStructuralInterfaceWallContext({
    wall: selectedWall,
    visualTarget: selectedVisualTarget,
    locatorKind,
    faceSide,
    end,
    sRange: [number(s0), number(s1)],
    zRange: [number(z0), number(z1)]
  }), [selectedWall, selectedVisualTarget, locatorKind, faceSide, end, s0, s1, z0, z1]);

  const locateInterfaceLocation = () => {
    if (!interfaceLocationContext?.locatorPreview?.canUse) return;
    openStructuralIntentLocator({
      preview: interfaceLocationContext.locatorPreview,
      activeId: selectedWallRow?.id ?? elementId,
      sourceFocusId: 'structural-interface-location-locate-button'
    });
    requestAnimationFrame(() => fitStructuralIntentLocator());
  };

  const addInterface = () => {
    try {
      let ownerRef;
      let locator;
      if (ownerKind === 'roofBoundary') {
        const entry = roofBoundaries.find((item) => `${item.roof.id}|${item.boundary.boundaryId}` === roofBoundaryKey);
        if (!entry) throw new Error('Seleccione un borde de cubierta resoluble.');
        const fullRange = roofBoundaryLongitudinalRange(entry.boundary);
        const first = number(roofS0);
        const second = number(roofS1);
        if (!fullRange || first === null || second === null) throw new Error('El rango S del borde debe ser numérico y resoluble.');
        const interactionRange = normalizedPair(first, second);
        ownerRef = { kind: 'roofBoundary', roofGeometryId: entry.roof.id, boundaryId: entry.boundary.boundaryId };
        locator = sameRange(interactionRange, fullRange)
          ? { kind: 'boundary' }
          : { kind: 'boundary', sRange: interactionRange };
      } else {
        const row = wallRows.find((item) => String(item.id) === String(elementId));
        if (!row) throw new Error('Seleccione un muro resoluble.');
        ownerRef = { kind: 'element', id: row.id };
        const range = { sRange: [number(s0), number(s1)], zRange: [number(z0), number(z1)] };
        if (range.sRange.some((item) => item === null) || range.zRange.some((item) => item === null)) throw new Error('Los rangos S/Z deben ser numéricos.');
        locator = locatorKind === 'face'
          ? { kind: 'face', side: faceSide, ...range }
          : locatorKind === 'end'
            ? { kind: 'end', end, ...range }
            : { kind: 'region', ...range };
      }
      applyTransaction({ interfaces: [{ ownerRef, locator, notes: notes.trim() || null }] });
      setNotes(''); setInterfaceError(null);
    } catch (error) {
      setInterfaceError(error);
    }
  };

  const addRegion = () => {
    const row = wallRows[0];
    const region = defaultRegion(row, geometry);
    if (region) setRegions((current) => [...current, region]);
  };

  const createRelation = () => {
    try {
      const ports = Object.entries(selectedPorts)
        .filter(([, role]) => role === 'receives' || role === 'delivers')
        .map(([interfaceRef, interactionRole]) => ({ interfaceRef, interactionRole }));
      const carrierRegions = regions.map((region) => ({
        ownerRef: { kind: 'element', id: region.ownerId },
        sRange: [number(region.s0), number(region.s1)],
        zRange: [number(region.z0), number(region.z1)]
      }));
      applyTransaction({ relations: [{ ports, actionFamily, structuralFunction, carrierRegions, notes: relationNotes.trim() || null }] });
      setSelectedPorts({}); setRelationNotes(''); setRegions([]); setRelationError(null);
    } catch (error) {
      setRelationError(error);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#deded8] bg-white p-4">
        <h3 className="font-semibold">Capa de interfaces estructurales</h3>
        <p className="mt-1 text-sm text-[#66665f]">La interfaz declara <strong>dónde</strong> ocurre una interacción. El rol, la familia de acción y la función pertenecen a la relación y se declaran por separado.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-[#deded8] bg-white p-4">
          <h4 className="font-semibold">Nueva interfaz</h4>
          <label className="mt-3 block text-sm"><span className="font-medium">Referente geométrico</span>
            <select className="mt-1 w-full rounded border px-2 py-1.5" value={ownerKind} onChange={(event) => setOwnerKind(event.target.value)}>
              <option value="element">Muro / elemento</option><option value="roofBoundary">Borde de cubierta</option>
            </select>
          </label>
          {ownerKind === 'element' ? <>
            <label className="mt-3 block text-sm"><span className="font-medium">Host</span>
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={elementId} onChange={(event) => setElementId(event.target.value)}>
                {wallRows.map((row) => <option key={row.idToken} value={row.id}>{humanWall(row)}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm"><span className="font-medium">Ubicación</span>
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={locatorKind} onChange={(event) => setLocatorKind(event.target.value)}>
                <option value="face">Cara</option><option value="end">Extremo</option><option value="region">Región S/Z</option>
              </select>
            </label>
            {locatorKind === 'face' && <div className="mt-3"><label htmlFor="structural-interface-face-side" className="block text-sm font-medium">Cara canónica</label><select id="structural-interface-face-side" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={faceSide} onChange={(event) => setFaceSide(event.target.value)}><option value="positiveN">Cara +N</option><option value="negativeN">Cara −N</option></select><StructuralConceptHint scope="interfaceLocation" value={faceSide === 'positiveN' ? 'facePositiveN' : 'faceNegativeN'} compact /></div>}
            {locatorKind === 'end' && <div className="mt-3"><label htmlFor="structural-interface-end" className="block text-sm font-medium">Extremo canónico</label><select id="structural-interface-end" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={end} onChange={(event) => setEnd(event.target.value)}><option value="lowS">S mínimo</option><option value="highS">S máximo</option></select><StructuralConceptHint scope="interfaceLocation" value={end === 'lowS' ? 'endLowS' : 'endHighS'} compact /></div>}
            <StructuralInterfaceLocationPreview context={interfaceLocationContext} locatorKind={locatorKind} faceSide={faceSide} end={end} onLocate={locateInterfaceLocation} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><label>S0<input className="mt-1 w-full rounded border px-2 py-1" value={s0} onChange={(e) => setS0(e.target.value)} /></label><label>S1<input className="mt-1 w-full rounded border px-2 py-1" value={s1} onChange={(e) => setS1(e.target.value)} /></label><label>Z0<input className="mt-1 w-full rounded border px-2 py-1" value={z0} onChange={(e) => setZ0(e.target.value)} /></label><label>Z1<input className="mt-1 w-full rounded border px-2 py-1" value={z1} onChange={(e) => setZ1(e.target.value)} /></label></div>
          </> : <div className="mt-3">
            <label htmlFor="structural-interface-roof-boundary" className="block text-sm font-medium">Borde canónico</label>
            <select id="structural-interface-roof-boundary" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={roofBoundaryKey} onChange={(event) => setRoofBoundaryKey(event.target.value)}>{roofBoundaries.map((item) => <option key={`${item.roof.id}|${item.boundary.boundaryId}`} value={`${item.roof.id}|${item.boundary.boundaryId}`}>{item.label} · {fmt(item.boundary.length3d)} mm</option>)}</select>
            {selectedRoofBoundary && <div aria-label="Contexto del borde canónico seleccionado" className="mt-2 rounded border border-[#deded8] bg-[#fafaf7] p-2 text-xs"><div className="font-medium text-[#2f5d50]">{selectedRoofBoundary.label}</div><div className="mt-0.5 text-[#66665f]">Borde físico · {fmt(selectedRoofBoundary.boundary.length3d)} mm{selectedRoofBoundaryRange ? ` · S ${selectedRoofBoundaryRange[0]}→${selectedRoofBoundaryRange[1]}` : ''}</div><details className="mt-1"><summary>Referencia técnica</summary><code className="break-all">roof:{String(selectedRoofBoundary.roof.id)}:edge:{selectedRoofBoundary.boundary.boundaryId}</code></details></div>}
            <fieldset aria-label="Rango de interacción del borde" className="mt-2 rounded border border-[#deded8] p-2">
              <legend className="px-1 text-xs font-medium">Rango de interacción</legend>
              <div className="grid grid-cols-2 gap-2 text-sm"><label>S0<input aria-label="S0 de borde" className="mt-1 w-full rounded border px-2 py-1" value={roofS0} onChange={(event) => setRoofS0(event.target.value)} /></label><label>S1<input aria-label="S1 de borde" className="mt-1 w-full rounded border px-2 py-1" value={roofS1} onChange={(event) => setRoofS1(event.target.value)} /></label></div>
              {(() => {
                const first = number(roofS0);
                const second = number(roofS1);
                const range = first === null || second === null ? null : normalizedPair(first, second);
                const segment = range && selectedRoofBoundary ? roofBoundarySegmentForLocator(selectedRoofBoundary.boundary, { kind: 'boundary', sRange: range }) : null;
                const length = segmentLength3d(segment);
                return range && length !== null ? <div className="mt-1 text-xs text-[#66665f]">Interacción · S {range[0]}→{range[1]} · {fmt(length)} mm</div> : null;
              })()}
            </fieldset>
          </div>}
          <label className="mt-3 block text-sm"><span className="font-medium">Nota</span><input className="mt-1 w-full rounded border px-2 py-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          {interfaceError && <div role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{interfaceError.message} <code>{interfaceError.code}</code></div>}
          <button type="button" className="mt-3 rounded bg-[#2f5d50] px-3 py-2 text-sm font-medium text-white" onClick={addInterface}>Agregar interfaz</button>
        </section>

        <section className="rounded-lg border border-[#deded8] bg-white p-4">
          <h4 className="font-semibold">Interfaces vigentes</h4>
          <div className="mt-3 space-y-2">{interfaceIntents.length === 0 && <p className="text-sm text-[#66665f]">No hay interfaces. La migración legacy no inventa ninguna.</p>}{interfaceIntents.map((intent) => { const presentation = persistedInterfacePresentation(intent); const canLocate = presentation.state.state === 'fresh' && presentation.locatorPreview?.canUse; return <article key={intent.interfaceId} className="rounded border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{presentation.title}</div>{presentation.detail && <div className="mt-0.5 text-xs text-[#66665f]">{presentation.detail}</div>}<div className="mt-0.5 text-xs text-[#66665f]">{presentation.range} · {presentation.state.state}</div>{intent.notes && <div className="mt-1 text-xs text-[#4b5563]">{intent.notes}</div>}</div><button id={`structural-interface-card-locate-${intent.interfaceId}`} type="button" aria-label={`Localizar interfaz ${presentation.title}`} className="shrink-0 rounded border border-[#2f5d50] px-2 py-1 text-xs text-[#23483e] disabled:cursor-not-allowed disabled:opacity-50" disabled={!canLocate} onClick={() => locatePersistedInterface(intent, presentation)}>Localizar interfaz</button></div><details className="mt-2 text-xs"><summary>Referencia técnica</summary><code className="break-all">{intent.interfaceId}</code></details><button type="button" className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => removeInterface(intent.interfaceId)}>Eliminar interfaz</button></article>; })}</div>
        </section>
      </div>

      <section className="rounded-lg border border-[#deded8] bg-white p-4">
        <h4 className="font-semibold">Nueva relación</h4>
        <div className="mt-3 grid gap-3 lg:grid-cols-2"><div><div className="text-sm font-medium">Puertos</div><div className="mt-2 max-h-64 space-y-2 overflow-auto">{interfaceIntents.map((intent) => { const presentation = persistedInterfacePresentation(intent); return <label key={intent.interfaceId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded border p-2 text-sm"><span>{presentation.title}<span className="block text-xs text-[#66665f]">{presentation.detail ? `${presentation.detail} · ` : ''}{presentation.range}</span></span><select className="rounded border px-1 py-1 text-xs" value={selectedPorts[intent.interfaceId] || ''} onChange={(e) => setSelectedPorts((current) => ({ ...current, [intent.interfaceId]: e.target.value }))}><option value="">No participa</option><option value="receives">Recibe</option><option value="delivers">Entrega</option></select></label>; })}</div></div><div><div><label htmlFor="structural-relation-action-family" className="block text-sm font-medium">Familia de acción</label><select id="structural-relation-action-family" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={actionFamily} onChange={(e) => setActionFamily(e.target.value)}>{structuralConceptOptions('actionFamily').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><StructuralConceptHint scope="actionFamily" value={actionFamily} compact /></div><div className="mt-3"><label htmlFor="structural-relation-function" className="block text-sm font-medium">Función</label><select id="structural-relation-function" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={structuralFunction} onChange={(e) => setStructuralFunction(e.target.value)}>{structuralConceptOptions('relationFunction').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><StructuralConceptHint scope="relationFunction" value={structuralFunction} compact /></div></div></div>
        <div className="mt-4"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">Regiones estructurales embebidas</div><div className="text-xs text-[#66665f]">Opcionales. Úselas sólo cuando la transferencia necesita una banda S/Z explícita.</div></div><button type="button" className="rounded border px-2 py-1 text-xs" onClick={addRegion}>+ Región</button></div>{regions.map((region, index) => <div key={index} className="mt-2 grid gap-2 rounded border p-2 text-xs md:grid-cols-6"><select className="rounded border px-1" value={region.ownerId} onChange={(e) => { const row = wallRows.find((item) => String(item.id) === e.target.value); const next = defaultRegion(row, geometry); setRegions((current) => current.map((item, i) => i === index ? next : item)); }}>{wallRows.map((row) => <option key={row.idToken} value={row.id}>{humanWall(row)}</option>)}</select>{['s0','s1','z0','z1'].map((key) => <input key={key} aria-label={key.toUpperCase()} className="rounded border px-1" value={region[key]} onChange={(e) => setRegions((current) => current.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))} />)}<button type="button" className="rounded border border-red-300 px-1 text-red-700" onClick={() => setRegions((current) => current.filter((_, i) => i !== index))}>Quitar</button></div>)}</div>
        <label className="mt-3 block text-sm"><span className="font-medium">Nota</span><input className="mt-1 w-full rounded border px-2 py-1.5" value={relationNotes} onChange={(e) => setRelationNotes(e.target.value)} /></label>{relationError && <div role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{relationError.message} <code>{relationError.code}</code></div>}<button type="button" className="mt-3 rounded bg-[#6c5ce7] px-3 py-2 text-sm font-medium text-white" onClick={createRelation}>Crear relación</button>
      </section>

      <section className="rounded-lg border border-[#deded8] bg-white p-4"><h4 className="font-semibold">Relaciones vigentes</h4><div className="mt-3 space-y-2">{relationIntents.length === 0 && <p className="text-sm text-[#66665f]">No hay relaciones declaradas.</p>}{relationIntents.map((relation) => { const state = evaluateRelationFreshness(geometry, relation, interfaceIntents); return <article key={relation.relationId} className="rounded border p-3 text-sm"><div className="font-medium">{relation.structuralFunction} · {relation.actionFamily}</div><div className="mt-1 text-xs text-[#66665f]">{relation.ports.map((port) => `${port.interactionRole === 'receives' ? 'Recibe' : 'Entrega'}: ${persistedInterfacePresentation(interfaceById.get(port.interfaceRef)).title}`).join(' · ')}</div><div className="mt-1 text-xs">Estado: {state.state} · regiones: {relation.carrierRegions.length}</div><details className="mt-2 text-xs"><summary>Referencia técnica</summary><code className="break-all">{relation.relationId}</code></details><button type="button" className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => removeRelation(relation.relationId)}>Eliminar relación</button></article>; })}</div></section>
    </div>
  );
}
