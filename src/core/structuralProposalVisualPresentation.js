import { projectAgnosticGeometry } from './agnosticGeometry.js';
import { canonicalizeRoofBoundaries } from './roofStructuralIntent.js';
import {
  describeInterfaceIntent,
  evaluateInterfaceFreshness,
  evaluateRelationFreshness,
  relationEndpoints,
  roofBoundaryLongitudinalRange,
  roofBoundarySegmentForLocator,
  wallInterfaceNormal
} from './structuralInterfaces.js';
import { buildStructuralIntentVisualPresentation } from './structuralIntentVisualPresentation.js';
import {
  StructuralProposalError,
  canonicalizeValue,
  compareIds,
  compareText,
  fingerprint,
  idToken,
  semanticId,
  wallFrame
} from './structuralProposalCommon.js';

export const STRUCTURAL_PROPOSAL_VISUAL_SCHEMA =
  'structural-proposal-visual-presentation-v1.0';

function format(value) {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(value);
}

function nearestAxis(axes, coordinate, tolerance = 0.1) {
  const match = (axes || []).find((axis) => Math.abs(Number(axis.position) - coordinate) <= tolerance);
  return match?.label ?? format(coordinate);
}

function elementHumanTitle(target) {
  const descriptor = target?.descriptor;
  if (!descriptor) return 'Referencia geométrica no disponible';
  if (target.type === 'wall') {
    return `Muro ${descriptor.orientation} · ${descriptor.axis.nominal}`;
  }
  if (target.type === 'foundation') {
    return `Fundación ${descriptor.kind || 'geométrica'} · ${descriptor.coordinates}`;
  }
  const withoutId = String(descriptor.summary || descriptor.typeLabel || 'Elemento')
    .replace(/\s*·\s*ID\s+.+$/, '');
  return withoutId;
}

function elementSubtitle(target) {
  const descriptor = target?.descriptor;
  if (!descriptor) return 'Referencia rota';
  if (target.type === 'wall') {
    return `${descriptor.levels.nominal} · L ${format(descriptor.dimensions.length)} mm · ${descriptor.dimensions.openings} vano${descriptor.dimensions.openings === 1 ? '' : 's'}`;
  }
  return descriptor.levels?.nominal || descriptor.levels || descriptor.summary || 'Geometría disponible';
}

function roofPlaneData(roof) {
  const points = roof?.surface?.boundary || [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return {
    points,
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
    minZ: Math.min(...zs), maxZ: Math.max(...zs)
  };
}

function slopeDirection(data, grid) {
  const low = data.points.filter((point) => Math.abs(point.z - data.minZ) <= 0.1);
  const high = data.points.filter((point) => Math.abs(point.z - data.maxZ) <= 0.1);
  const center = (items) => ({
    x: items.reduce((sum, point) => sum + point.x, 0) / items.length,
    y: items.reduce((sum, point) => sum + point.y, 0) / items.length
  });
  const from = center(high); const to = center(low);
  const dx = Math.abs(to.x - from.x); const dy = Math.abs(to.y - from.y);
  if (dx >= dy) {
    return `${nearestAxis(grid.xAxes, from.x)}→${nearestAxis(grid.xAxes, to.x)}`;
  }
  return `${nearestAxis(grid.yAxes, from.y)}→${nearestAxis(grid.yAxes, to.y)}`;
}

function roofTarget(roof, grid) {
  const data = roofPlaneData(roof);
  const xRange = `${nearestAxis(grid.xAxes, data.minX)}–${nearestAxis(grid.xAxes, data.maxX)}`;
  const yRange = `${nearestAxis(grid.yAxes, data.minY)}–${nearestAxis(grid.yAxes, data.maxY)}`;
  const rectangular = data.points.length === 4;
  const title = `Faldón ${rectangular ? 'rectangular' : 'poligonal'} ${xRange} entre ${yRange}`;
  const subtitle = `Pendiente ${slopeDirection(data, grid)} · ${format(data.maxX - data.minX)} × ${format(data.maxY - data.minY)} mm`;
  const preview = {
    kind: 'roof-planar-polygon',
    polygon: data.points.map(({ x, y, z }) => ({ x, y, z })),
    bounds: data
  };
  return {
    entityType: 'roof',
    entityId: roof.id,
    title,
    subtitle,
    ariaLabel: `${title}. ${subtitle}. Referencia técnica ${String(roof.id)}.`,
    technicalReference: { roofGeometryId: roof.id },
    locate: { kind: 'roof', id: roof.id },
    preview,
    visualFingerprint: fingerprint({ title, subtitle, preview })
  };
}

function elementTarget(target) {
  const title = elementHumanTitle(target);
  const subtitle = elementSubtitle(target);
  return {
    entityType: target.type,
    entityId: target.id,
    title,
    subtitle,
    ariaLabel: `${title}. ${subtitle}. Referencia técnica ${String(target.id)}.`,
    technicalReference: { elementId: target.id },
    locate: { kind: 'element', id: target.id },
    preview: {
      planGeometry: target.planGeometry,
      elevationGeometry: target.elevationGeometry,
      openings: target.openings,
      bounds: target.bounds
    },
    visualFingerprint: target.geometryFingerprint,
    state: target.state
  };
}

function combinedBounds(...boundsList) {
  const bounds = boundsList.filter(Boolean);
  if (bounds.length === 0) return null;
  const xMin = Math.min(...bounds.map((item) => item.xMin ?? item.minX));
  const xMax = Math.max(...bounds.map((item) => item.xMax ?? item.maxX));
  const yMin = Math.min(...bounds.map((item) => item.yMin ?? item.minY));
  const yMax = Math.max(...bounds.map((item) => item.yMax ?? item.maxY));
  return [xMin, xMax, yMin, yMax].every(Number.isFinite)
    ? { xMin, xMax, yMin, yMax }
    : null;
}

function relationPreview(proposal, roof, target, roofGeometry) {
  const boundary = roofGeometry
    ? canonicalizeRoofBoundaries(roofGeometry).find((item) => item.boundaryId === proposal.evidence.boundaryId)
    : null;
  const matches = proposal.evidence.matches || [];
  const overlapSegments = boundary ? matches.map((match) => {
    const [start, end] = match.overlapRange || [];
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const axis = match.axis;
    const fixed = axis === 'x' ? boundary.start.y : boundary.start.x;
    return axis === 'x'
      ? { start: { x: start, y: fixed }, end: { x: end, y: fixed } }
      : { start: { x: fixed, y: start }, end: { x: fixed, y: end } };
  }).filter(Boolean) : [];
  const preview = {
    kind: 'proposal-relation',
    selected: [
      {
        id: `roof:${typeof roof.entityId}:${String(roof.entityId)}`,
        mark: 'ORIGEN',
        role: 'source',
        planGeometry: { polygon: roof.preview?.polygon || [] },
        openings: []
      },
      {
        id: `element:${typeof target.entityId}:${String(target.entityId)}`,
        mark: 'OBJETIVO',
        role: 'target',
        planGeometry: { polygon: target.preview?.planGeometry?.polygon || [] },
        openings: target.preview?.openings || []
      }
    ],
    boundary: boundary ? { start: boundary.start, end: boundary.end } : null,
    overlapSegments,
    bounds: combinedBounds(roof.preview?.bounds, target.preview?.bounds),
    locatorLabel: `${roof.title} ↔ ${target.title}`
  };
  return preview.bounds ? preview : null;
}


function interfaceLocationLabel(locator) {
  if (locator?.kind === 'face') return locator.side === 'positiveN' ? 'Cara +N' : 'Cara −N';
  if (locator?.kind === 'end') return locator.end === 'lowS' ? 'Extremo S mínimo' : 'Extremo S máximo';
  if (locator?.kind === 'region') return 'Región estructural';
  if (locator?.kind === 'boundary') return 'Borde de cubierta';
  return 'Interfaz estructural';
}

function ownerSelectedTarget(parent, role = 'interface') {
  if (!parent?.preview) return null;
  if (parent.entityType === 'roof') {
    return {
      id: `roof:${typeof parent.entityId}:${String(parent.entityId)}`,
      mark: 'HOST', role,
      planGeometry: { polygon: parent.preview.polygon || [] }, openings: []
    };
  }
  return {
    id: `element:${typeof parent.entityId}:${String(parent.entityId)}`,
    mark: 'HOST', role,
    planGeometry: { polygon: parent.preview.planGeometry?.polygon || [] },
    openings: parent.preview.openings || []
  };
}

function planPointKey(point) {
  return `${Number(point?.x).toFixed(3)},${Number(point?.y).toFixed(3)}`;
}

function roofEdgeKey(left, right) {
  return [planPointKey(left), planPointKey(right)].sort(compareText).join('|');
}

function visualRoofBoundary(roof, boundaryId) {
  if (!roof) return null;
  const boundary = canonicalizeRoofBoundaries(roof).find((item) => item.boundaryId === boundaryId) || null;
  if (!boundary) return null;
  const polygon = [...(roof.surface?.boundary || [])];
  if (polygon.length > 1 && planPointKey(polygon[0]) === planPointKey(polygon.at(-1))) polygon.pop();
  const targetKey = roofEdgeKey(boundary.start, boundary.end);
  const traversalIndex = polygon.findIndex((point, index) => (
    roofEdgeKey(point, polygon[(index + 1) % polygon.length]) === targetKey
  ));
  return {
    ...boundary,
    label: traversalIndex >= 0 ? `B${traversalIndex + 1}` : 'Borde canónico'
  };
}

function interfaceSegment(geometry, intent) {
  const owner = intent?.ownerRef;
  const locator = intent?.locator;
  if (owner?.kind === 'roofBoundary') {
    const roof = (geometry.roofGeometry || []).find((item) => idToken(item.id) === idToken(owner.roofGeometryId));
    const boundary = visualRoofBoundary(roof, owner.boundaryId);
    return boundary ? roofBoundarySegmentForLocator(boundary, locator) : null;
  }
  if (owner?.kind !== 'element') return null;
  const element = (geometry.elements || []).find((item) => idToken(item.id) === idToken(owner.id));
  const frame = element ? wallFrame(element) : null;
  if (!frame) return null;
  const thickness = Number(element.prism?.thickness) || 0;
  const normal = wallInterfaceNormal(frame);
  const point = (s, n = 0) => frame.axis === 'x'
    ? { x: s + normal.x * n, y: frame.fixed + normal.y * n, z: frame.z0 }
    : { x: frame.fixed + normal.x * n, y: s + normal.y * n, z: frame.z0 };
  if (locator.kind === 'face') {
    const sRange = locator.sRange || [frame.s0, frame.s1];
    const signed = (locator.side === 'positiveN' ? 1 : -1) * thickness / 2;
    return { start: point(sRange[0], signed), end: point(sRange[1], signed) };
  }
  if (locator.kind === 'end') {
    const s = locator.end === 'lowS' ? frame.s0 : frame.s1;
    return { start: point(s, -thickness / 2), end: point(s, thickness / 2) };
  }
  if (locator.kind === 'region') {
    const sRange = locator.sRange || [frame.s0, frame.s1];
    return { start: point(sRange[0], 0), end: point(sRange[1], 0) };
  }
  return null;
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

function finiteRange(range) {
  return Array.isArray(range)
    && range.length === 2
    && range.every((value) => Number.isFinite(Number(value)))
    ? range.map(Number)
    : null;
}

function elementInterfaceRangePresentation(intent, geometry) {
  const owner = intent?.ownerRef;
  if (owner?.kind !== 'element') return null;
  const element = (geometry.elements || []).find((item) => idToken(item.id) === idToken(owner.id));
  const frame = element ? wallFrame(element) : null;
  if (!frame) return null;
  const sRange = finiteRange(intent.locator?.sRange) || [frame.s0, frame.s1];
  const zRange = finiteRange(intent.locator?.zRange) || [frame.z0, frame.z1];
  return {
    sRange,
    zRange,
    label: `S ${sRange[0]}→${sRange[1]} · Z ${zRange[0]}→${zRange[1]}`,
    ariaLabel: `Rango S ${sRange[0]} a ${sRange[1]}. Rango Z ${zRange[0]} a ${zRange[1]}.`
  };
}

function interfaceTarget(intent, geometry, lookup) {
  const owner = intent.ownerRef || {};
  const parent = owner.kind === 'element'
    ? lookup.elements.get(idToken(owner.id))
    : lookup.roofs.get(idToken(owner.roofGeometryId));
  const description = describeInterfaceIntent(geometry, intent);
  const location = interfaceLocationLabel(intent.locator);
  const segment = interfaceSegment(geometry, intent);
  const elementRange = elementInterfaceRangePresentation(intent, geometry);
  const roof = owner.kind === 'roofBoundary' ? lookup.roofGeometry.get(idToken(owner.roofGeometryId)) : null;
  const roofBoundary = owner.kind === 'roofBoundary' ? visualRoofBoundary(roof, owner.boundaryId) : null;
  const freshness = evaluateInterfaceFreshness(geometry, intent);
  if (!parent) {
    return {
      entityType: 'interface', entityId: intent.interfaceId,
      title: 'Referencia rota', subtitle: `${location} · host no disponible`,
      ariaLabel: `Referencia rota de interfaz. ${location}. Referencia técnica ${intent.interfaceId}.`,
      technicalReference: { interfaceId: intent.interfaceId, ownerRef: intent.ownerRef, locator: intent.locator },
      locate: null, preview: null, state: 'brokenReference', visualFingerprint: fingerprint(intent)
    };
  }
  const selected = ownerSelectedTarget(parent);
  const preview = {
    kind: 'proposal-relation',
    selected: selected ? [selected] : [],
    boundary: segment,
    overlapSegments: segment ? [segment] : [],
    bounds: owner.kind === 'roofBoundary' && segment ? segmentBounds(segment) : parent.preview?.bounds,
    locatorLabel: `${location} · ${parent.title}`
  };
  const freshnessLabel = freshness.state === 'fresh' ? 'vigente' : freshness.state === 'stale' ? 'obsoleta' : 'referencia rota';
  const fullBoundaryRange = owner.kind === 'roofBoundary' && roofBoundary
    ? roofBoundaryLongitudinalRange(roofBoundary)
    : null;
  const declaredBoundaryRange = intent.locator?.kind === 'boundary' && Array.isArray(intent.locator.sRange)
    ? intent.locator.sRange
    : null;
  const partialBoundary = Boolean(
    declaredBoundaryRange
    && fullBoundaryRange
    && (Math.abs(declaredBoundaryRange[0] - fullBoundaryRange[0]) > 1e-6
      || Math.abs(declaredBoundaryRange[1] - fullBoundaryRange[1]) > 1e-6)
  );
  const interactionLength = segment
    ? Math.hypot(
      segment.end.x - segment.start.x,
      segment.end.y - segment.start.y,
      (segment.end.z ?? 0) - (segment.start.z ?? 0)
    )
    : null;
  const boundaryRangeLabel = partialBoundary
    ? `S ${declaredBoundaryRange[0]}→${declaredBoundaryRange[1]}`
    : null;
  const humanBoundaryLabel = owner.kind === 'roofBoundary' && roofBoundary
    ? partialBoundary && Number.isFinite(interactionLength)
      ? `${roofBoundary.label} · Interacción ${boundaryRangeLabel} · ${format(interactionLength)} mm · borde físico ${format(roofBoundary.length3d)} mm`
      : `${roofBoundary.label} · ${format(roofBoundary.length3d)} mm`
    : null;
  return {
    entityType: 'interface', entityId: intent.interfaceId,
    title: `${location} · ${parent.title}${humanBoundaryLabel ? ` · ${roofBoundary.label}${boundaryRangeLabel ? ` · ${boundaryRangeLabel}` : ''}` : ''}`,
    subtitle: `${humanBoundaryLabel || elementRange?.label || description.subtitle} · ${freshnessLabel}`,
    ariaLabel: `${location}. ${parent.ariaLabel}${boundaryRangeLabel ? ` Interacción ${boundaryRangeLabel}.` : ''}${elementRange ? ` ${elementRange.ariaLabel}` : ''} Estado ${freshness.state}.`,
    technicalReference: { interfaceId: intent.interfaceId, ownerRef: intent.ownerRef, locator: intent.locator },
    locate: { kind: 'structuralInterface', id: intent.interfaceId },
    preview,
    state: freshness.state,
    visualFingerprint: fingerprint({ intent, freshness: freshness.state, preview })
  };
}


function structuralRegionTarget(relation, region, index, geometry, lookup) {
  const owner = region.ownerRef || {};
  const parent = owner.kind === 'element' ? lookup.elements.get(idToken(owner.id)) : null;
  const element = owner.kind === 'element'
    ? (geometry.elements || []).find((item) => idToken(item.id) === idToken(owner.id))
    : null;
  const frame = element ? wallFrame(element) : null;
  if (!parent || !frame) {
    return {
      entityType: 'structuralRegion', entityId: semanticId('region', { relationId: relation.relationId, index, region }),
      title: 'Referencia rota', subtitle: 'Región estructural · host no disponible',
      ariaLabel: 'Referencia rota de región estructural.',
      technicalReference: { relationId: relation.relationId, regionIndex: index, region },
      locate: null, preview: null, state: 'brokenReference', visualFingerprint: fingerprint({ relationId: relation.relationId, region })
    };
  }
  const normal = wallInterfaceNormal(frame);
  const point = (s) => frame.axis === 'x'
    ? { x: s, y: frame.fixed, z: region.zRange?.[0] ?? frame.z0 }
    : { x: frame.fixed, y: s, z: region.zRange?.[0] ?? frame.z0 };
  const segment = { start: point(region.sRange[0]), end: point(region.sRange[1]) };
  const selected = ownerSelectedTarget(parent, 'structuralRegion');
  const entityId = semanticId('region', { relationId: relation.relationId, index, region });
  const preview = {
    kind: 'proposal-relation', selected: selected ? [selected] : [],
    boundary: segment, overlapSegments: [segment], bounds: parent.preview?.bounds,
    locatorLabel: `Región estructural · ${parent.title}`
  };
  return {
    entityType: 'structuralRegion', entityId,
    title: `Región estructural · ${parent.title}`,
    subtitle: `S ${format(region.sRange[0])}→${format(region.sRange[1])} · Z ${format(region.zRange[0])}→${format(region.zRange[1])}`,
    ariaLabel: `Región estructural embebida. ${parent.ariaLabel} Rango S ${region.sRange.join(' a ')}. Rango Z ${region.zRange.join(' a ')}.`,
    technicalReference: { relationId: relation.relationId, regionIndex: index, region },
    locate: { kind: 'structuralRegion', id: entityId }, preview, state: 'fresh',
    visualFingerprint: fingerprint({ relationId: relation.relationId, region, preview })
  };
}

function relationVisual(relation, geometry, lookup) {
  const endpoints = relationEndpoints(relation, [...lookup.interfaces.values()].map((item) => item.intent));
  const interfaceTargets = relation.ports.map((port) => lookup.interfaces.get(port.interfaceRef)).filter(Boolean);
  const selectedByOwner = new Map();
  for (const target of interfaceTargets) {
    const owner = target.intent?.ownerRef || {};
    const parent = owner.kind === 'element'
      ? lookup.elements.get(idToken(owner.id))
      : lookup.roofs.get(idToken(owner.roofGeometryId));
    if (!parent) continue;
    const key = owner.kind === 'element' ? `element:${idToken(owner.id)}` : `roof:${idToken(owner.roofGeometryId)}`;
    if (!selectedByOwner.has(key)) selectedByOwner.set(key, ownerSelectedTarget(parent, 'relation'));
  }
  const segments = interfaceTargets.flatMap((target) => target.preview?.overlapSegments || []);
  const bounds = combinedBounds(...interfaceTargets.map((target) => target.preview?.bounds));
  const familyLabel = relation.actionFamily === 'gravity' ? 'Gravitacional' : relation.actionFamily === 'lateral' ? 'Lateral' : 'Familia indeterminada';
  const functionLabels = {
    support: 'Apoyo / interacción', loadTransfer: 'Transferencia de acciones', collectorAction: 'Acción colectora',
    diaphragmAction: 'Acción de diafragma', stabilization: 'Estabilización'
  };
  const freshness = evaluateRelationFreshness(geometry, relation, [...lookup.interfaces.values()].map((item) => item.intent));
  // The visible arrow must follow the executable direction used by candidateLoadPaths:
  // loadTransfer/collectorAction receive into the host and deliver out of it; the remaining
  // relation functions keep the conventional delivers → receives direction.
  const flowsReceiveToDeliver = relation.structuralFunction === 'loadTransfer'
    || relation.structuralFunction === 'collectorAction';
  const sourceEndpoints = flowsReceiveToDeliver ? endpoints.receives : endpoints.delivers;
  const targetEndpoints = flowsReceiveToDeliver ? endpoints.delivers : endpoints.receives;
  const sourceNames = sourceEndpoints.map((item) => lookup.interfaces.get(item.interfaceRef)?.title || 'Referencia rota');
  const targetNames = targetEndpoints.map((item) => lookup.interfaces.get(item.interfaceRef)?.title || 'Referencia rota');
  const preview = bounds ? {
    kind: 'proposal-relation', selected: [...selectedByOwner.values()].filter(Boolean),
    boundary: segments[0] || null, overlapSegments: segments, bounds,
    locatorLabel: `${functionLabels[relation.structuralFunction] || relation.structuralFunction} · ${familyLabel}`
  } : null;
  return {
    entityType: 'relation', entityId: relation.relationId,
    title: `${functionLabels[relation.structuralFunction] || relation.structuralFunction} · ${familyLabel}`,
    subtitle: `${sourceNames.join(' + ')} → ${targetNames.join(' + ')} · ${freshness.state}`,
    ariaLabel: `Relación estructural ${functionLabels[relation.structuralFunction] || relation.structuralFunction}. Familia ${familyLabel}. Estado ${freshness.state}.`,
    technicalReference: { relationId: relation.relationId, actionFamily: relation.actionFamily, structuralFunction: relation.structuralFunction, ports: relation.ports, carrierRegions: relation.carrierRegions },
    locate: preview ? { kind: 'structuralRelation', id: relation.relationId } : null,
    preview, state: freshness.state, visualFingerprint: fingerprint({ relation, freshness: freshness.state, preview })
  };
}

function brokenTarget(kind, id) {
  const title = 'Referencia rota';
  const subtitle = `${kind === 'roof' ? 'Cubierta' : kind === 'interface' ? 'Interfaz' : 'Elemento'} no disponible en la geometría vigente`;
  return {
    entityType: kind,
    entityId: id,
    title,
    subtitle,
    ariaLabel: `${title}. ${subtitle}. Referencia técnica ${String(id)}.`,
    technicalReference: kind === 'roof' ? { roofGeometryId: id } : { elementId: id },
    locate: null,
    preview: null,
    state: 'brokenReference',
    visualFingerprint: fingerprint({ kind, id, state: 'brokenReference' })
  };
}

function nodeVisual(node, lookup) {
  const ref = node.ref || {};
  let entity = null;
  if (ref.interfaceId !== undefined) entity = lookup.interfaces.get(ref.interfaceId);
  else if (ref.roofGeometryId !== undefined) entity = lookup.roofs.get(idToken(ref.roofGeometryId));
  else if (ref.elementId !== undefined) entity = lookup.elements.get(idToken(ref.elementId));
  else if (ref.foundationId !== undefined) entity = lookup.elements.get(idToken(ref.foundationId));
  const roleLabels = {
    roofSource: 'Fuente gravitacional de cubierta',
    diaphragmSource: 'Fuente lateral de diafragma previsto',
    receiverWall: 'Receptor gravitacional candidato',
    immediateLowerWall: 'Muro inferior inmediato candidato',
    resistantWallDestination: 'Destino lateral previsto',
    declaredTransfer: 'Transferencia declarada',
    foundationBase: 'Base geométrica candidata',
    declaredInterface: 'Interfaz estructural declarada'
  };
  const roleLabel = roleLabels[node.role] || node.role;
  const target = entity || brokenTarget(
    ref.roofGeometryId !== undefined ? 'roof' : ref.interfaceId !== undefined ? 'interface' : 'element',
    ref.roofGeometryId ?? ref.elementId ?? ref.foundationId ?? ref.interfaceId ?? node.nodeId
  );
  return {
    nodeId: node.nodeId,
    graph: node.graph,
    role: node.role,
    roleLabel,
    title: target.title,
    subtitle: `${roleLabel} · ${target.subtitle}`,
    ariaLabel: `${roleLabel}. ${target.ariaLabel}`,
    entity: target,
    technicalReference: { nodeId: node.nodeId, ...target.technicalReference }
  };
}

function graphVisual(graph, lookup) {
  return {
    graphType: graph.graphType,
    nodes: graph.nodes.map((node) => nodeVisual(node, lookup)),
    edges: graph.edges.map((edge) => ({ ...edge })),
    paths: graph.paths.map((path) => ({
      ...path,
      summary: `${path.graph === 'gravity' ? 'G↓ gravedad' : 'L→ lateral'} · ${path.candidateState} · ${path.edgeIds.length} tramo${path.edgeIds.length === 1 ? '' : 's'}`,
      ariaLabel: `${path.graph === 'gravity' ? 'Camino gravitacional candidato' : 'Camino lateral candidato'}. Estado ${path.candidateState}. ${path.findings.length} hallazgo${path.findings.length === 1 ? '' : 's'}. Referencia técnica ${path.pathId}.`
    }))
  };
}

export function assertHumanReadableStructuralProposalPresentation(presentation) {
  const offenders = [];
  const inspect = (label, title, id) => {
    const trimmed = String(title || '').trim();
    if (!trimmed || trimmed === String(id) || /^(Muro|Cubierta|Faldón|Fundación)\s+\d+$/.test(trimmed)) {
      offenders.push({ label, title, id });
    }
  };
  for (const entity of [
    ...presentation.entities.elements,
    ...presentation.entities.roofs,
    ...(presentation.entities.interfaces || []),
    ...(presentation.entities.regions || []),
    ...(presentation.entities.relations || [])
  ]) {
    inspect(entity.entityType, entity.title, entity.entityId);
  }
  for (const graph of [presentation.graphs.gravity, presentation.graphs.lateral]) {
    for (const node of graph.nodes) inspect(`node:${node.role}`, node.title, node.nodeId);
  }
  if (offenders.length > 0) {
    throw new StructuralProposalError(
      'SI-PROPOSAL-VISUAL-ID-ONLY',
      'La presentación contiene entidades identificadas sólo por ID.',
      { offenders }
    );
  }
  return true;
}

export function buildStructuralProposalVisualPresentation(model, structuralProposals, candidateLoadPaths) {
  if (structuralProposals?.schema !== 'structural-proposals-v1.0') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'structuralProposals debe usar structural-proposals-v1.0.');
  }
  if (candidateLoadPaths?.schema !== 'candidate-load-paths-v1.0') {
    throw new StructuralProposalError('SI-PROPOSAL-INPUT-INVALID', 'candidateLoadPaths debe usar candidate-load-paths-v1.0.');
  }
  const elementPresentation = buildStructuralIntentVisualPresentation(model);
  const elementTargets = [...elementPresentation.targets, ...elementPresentation.orphans]
    .map(elementTarget)
    .sort((a, b) => compareIds(a.entityId, b.entityId));
  const geometry = projectAgnosticGeometry(model);
  const roofTargets = geometry.roofGeometry.map((roof) => roofTarget(roof, model.grid || {}))
    .sort((a, b) => compareIds(a.entityId, b.entityId));
  const lookup = {
    elements: new Map(elementTargets.map((target) => [idToken(target.entityId), target])),
    roofs: new Map(roofTargets.map((target) => [idToken(target.entityId), target])),
    roofGeometry: new Map(geometry.roofGeometry.map((roof) => [idToken(roof.id), roof])),
    interfaces: new Map()
  };
  const interfaceTargets = (model.structuralIntent?.interfaceIntents || []).map((intent) => {
    const target = interfaceTarget(intent, geometry, lookup);
    target.intent = intent;
    lookup.interfaces.set(intent.interfaceId, target);
    return target;
  }).sort((a, b) => compareText(a.entityId, b.entityId));
  const relationTargets = (model.structuralIntent?.relationIntents || [])
    .map((relation) => relationVisual(relation, geometry, lookup))
    .sort((a, b) => compareText(a.entityId, b.entityId));
  const regionTargets = (model.structuralIntent?.relationIntents || []).flatMap((relation) => (
    (relation.carrierRegions || []).map((region, index) => structuralRegionTarget(relation, region, index, geometry, lookup))
  )).sort((a, b) => compareText(a.entityId, b.entityId));
  const proposals = structuralProposals.proposals.map((proposal) => {
    const roof = lookup.roofs.get(idToken(proposal.evidence.roofGeometryId)) || brokenTarget('roof', proposal.evidence.roofGeometryId);
    const target = lookup.elements.get(idToken(proposal.targetId)) || brokenTarget('element', proposal.targetId);
    const relation = relationPreview(
      proposal,
      roof,
      target,
      lookup.roofGeometry.get(idToken(proposal.evidence.roofGeometryId)) || null
    );
    return {
      proposalId: proposal.proposalId,
      candidateState: proposal.candidateState,
      title: `${proposal.evidence.boundaryFunction === 'lateralSupport' ? 'Apoyo lateral candidato' : 'Apoyo gravitacional candidato'} · ${target.title}`,
      subtitle: `${roof.title} → ${target.subtitle}`,
      ariaLabel: `Propuesta ${proposal.candidateState}. ${roof.ariaLabel} Objetivo: ${target.ariaLabel}`,
      source: roof,
      target,
      relation,
      technicalReference: {
        proposalId: proposal.proposalId,
        boundaryId: proposal.evidence.boundaryId,
        targetId: proposal.targetId
      },
      visualFingerprint: fingerprint({ roof: roof.visualFingerprint, target: target.visualFingerprint })
    };
  }).sort((a, b) => compareText(a.proposalId, b.proposalId));
  const output = {
    schema: STRUCTURAL_PROPOSAL_VISUAL_SCHEMA,
    entities: { elements: elementTargets, roofs: roofTargets, interfaces: interfaceTargets, regions: regionTargets, relations: relationTargets },
    proposals,
    graphs: {
      gravity: graphVisual(candidateLoadPaths.gravity, lookup),
      lateral: graphVisual(candidateLoadPaths.lateral, lookup)
    }
  };
  output.presentationSha256 = semanticId('visual', output).split(':').at(-1);
  const canonical = canonicalizeValue(output);
  assertHumanReadableStructuralProposalPresentation(canonical);
  return canonical;
}
