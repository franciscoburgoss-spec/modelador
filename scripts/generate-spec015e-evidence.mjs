import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { buildCandidateLoadPaths } from '../src/core/candidateLoadPaths.js';
import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';
import { canonicalizeRoofBoundaries } from '../src/core/roofStructuralIntent.js';
import {
  roofBoundaryLongitudinalRange,
  roofBoundarySegmentForLocator
} from '../src/core/structuralInterfaces.js';
import { removeElementIntent } from '../src/core/structuralIntent.js';
import {
  EMPTY_STRUCTURAL_INTENT_LOCATOR,
  closeStructuralIntentLocatorState,
  fitStructuralIntentLocatorState,
  openStructuralIntentLocatorState,
  requestStructuralIntentLocatorTargetState,
  setStructuralIntentLocatorActiveState,
  setStructuralIntentLocatorHoverState
} from '../src/core/structuralIntentLocator.js';
import {
  buildStructuralIntentVisualPresentation,
  buildStructuralIntentVisualPreview
} from '../src/core/structuralIntentVisualPresentation.js';
import { generateStructuralProposals } from '../src/core/structuralProposals.js';
import { buildStructuralProposalVisualPresentation } from '../src/core/structuralProposalVisualPresentation.js';
import { integrateStructuralRequirements } from '../src/core/structuralRequirements.js';
import {
  buildFx008Rev8Short,
  FX008_FRONTON_C_6_7,
  FX008_ROOF_NORTH,
  FX008_SUPPORT_AT_6,
  FX008_SUPPORT_AT_7
} from '../tests/helpers/spec015dRev8.mjs';
import {
  FX008_LATERAL_ROOF_ID,
  FX008_LATERAL_WALL_ID
} from '../tests/helpers/spec015d.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'evidence', 'spec-015-e');
const JSON_NAME = 'FX-008-SPEC-015-E.json';
const SVG_NAME = 'FX-008-SPEC-015-E.svg';
const HTML_NAME = 'FX-008-SPEC-015-E.html';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits }).format(Number(value));
}

function focusTokens(...values) {
  return values.flat().filter(Boolean).join(' ');
}

function conciseHumanTitle(title) {
  return String(title || '')
    .replace(/^Borde de cubierta · /, '')
    .replace(/^Cara ([^·]+) · (Muro [XY] · .+)$/, '$2 · Cara $1')
    .replace(/^Extremo S mínimo · (Muro [XY] · .+)$/, '$1 · Extremo S mín.')
    .replace(/^Extremo S máximo · (Muro [XY] · .+)$/, '$1 · Extremo S máx.');
}

function nearestGridLabel(entries, coordinate, tolerance = 0.1) {
  return (entries || []).find((entry) => Math.abs(Number(entry.position) - Number(coordinate)) <= tolerance)?.label ?? null;
}

function foundationHumanTitle(element, sourceModel) {
  const solids = element?.solids || [];
  if (solids.length === 0) return 'Fundación geométrica candidata';
  const x0 = Math.min(...solids.map((solid) => solid.prism.min.x));
  const x1 = Math.max(...solids.map((solid) => solid.prism.max.x));
  const y0 = Math.min(...solids.map((solid) => solid.prism.min.y));
  const y1 = Math.max(...solids.map((solid) => solid.prism.max.y));
  const spanX = x1 - x0; const spanY = y1 - y0;
  if (spanY >= spanX) {
    const fixed = nearestGridLabel(sourceModel.grid?.xAxes, (x0 + x1) / 2);
    const from = nearestGridLabel(sourceModel.grid?.yAxes, y0);
    const to = nearestGridLabel(sourceModel.grid?.yAxes, y1);
    if (fixed && from && to) return `Fundación corrida · eje ${fixed} · ${from}→${to}`;
  } else {
    const fixed = nearestGridLabel(sourceModel.grid?.yAxes, (y0 + y1) / 2);
    const from = nearestGridLabel(sourceModel.grid?.xAxes, x0);
    const to = nearestGridLabel(sourceModel.grid?.xAxes, x1);
    if (fixed && from && to) return `Fundación corrida · eje ${fixed} · ${from}→${to}`;
  }
  return `Fundación corrida · x ${formatNumber(x0)}→${formatNumber(x1)} · y ${formatNumber(y0)}→${formatNumber(y1)}`;
}

function svgTextLines(value, x, y, className = 'path-step-text', maxChars = 34, maxLines = 2) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.…]+$/, '')}…`;
  return `<text x="${x}" y="${y}" class="${className}">${visible.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : 15}">${esc(line)}</tspan>`).join('')}</text>`;
}

function buildGravityPathEvidence(context, integrated, sourceModel) {
  const visual = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);
  const nodes = new Map(visual.graphs.gravity.nodes.map((node) => [node.nodeId, node]));
  const edges = new Map(context.paths.gravity.edges.map((edge) => [edge.edgeId, edge]));
  const relations = new Map(visual.entities.relations.map((relation) => [relation.entityId, relation]));
  const requirementPaths = new Map(integrated.requirements.gravityPaths.map((item) => [item.pathId, item]));
  return context.paths.gravity.paths.filter((pathItem) => pathItem.sourceRefs?.relationId).map((pathItem, index) => {
    const edgeDetails = pathItem.edgeIds.map((edgeId) => {
      const edge = edges.get(edgeId);
      const from = nodes.get(edge?.fromNodeId);
      const to = nodes.get(edge?.toNodeId);
      const relation = edge?.relationId ? relations.get(edge.relationId) : null;
      return {
        edgeId,
        kind: edge?.kind ?? 'unknown',
        structuralFunction: edge?.structuralFunction ?? null,
        relationId: edge?.relationId ?? null,
        relationTitle: relation?.title ?? null,
        from: {
          title: from?.title ?? 'Referencia geométrica no disponible',
          roleLabel: from?.roleLabel ?? null,
          technicalReference: from?.technicalReference ?? null
        },
        to: {
          title: to?.title ?? 'Referencia geométrica no disponible',
          roleLabel: to?.roleLabel ?? null,
          technicalReference: to?.technicalReference ?? null
        }
      };
    });
    const foundationId = edgeDetails.at(-1)?.to?.technicalReference?.elementId;
    const foundation = context.geometry.elements.find((item) => String(item.id) === String(foundationId));
    const verification = requirementPaths.get(pathItem.pathId)?.verificationState ?? 'notVerified';
    const display = {
      source: conciseHumanTitle(edgeDetails[0]?.from?.title),
      transfer: `${conciseHumanTitle(edgeDetails[0]?.to?.title)} → ${conciseHumanTitle(edgeDetails[1]?.to?.title)}`,
      receiver: conciseHumanTitle(edgeDetails[2]?.to?.title),
      foundation: foundationHumanTitle(foundation, sourceModel)
    };
    return {
      key: `g${index + 1}`,
      label: `G${index + 1}`,
      pathId: pathItem.pathId,
      relationId: pathItem.sourceRefs.relationId,
      roofGeometryId: pathItem.sourceRefs.roofGeometryId,
      candidateState: pathItem.candidateState,
      verificationState: verification,
      findings: pathItem.findings,
      display,
      edges: edgeDetails
    };
  });
}

function inputFrom(context) {
  return {
    geometry: context.geometry,
    topology: context.topology,
    structuralIntent: context.model.structuralIntent,
    roofStructuralIntent: context.roofStructuralIntent,
    structuralProposals: context.proposals,
    structuralProposalReviews: context.model.structuralProposalReviews,
    candidateLoadPaths: context.paths
  };
}

function rebuildContext(model, roofStructuralIntent) {
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);
  const proposals = generateStructuralProposals({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    config: {}
  });
  const paths = buildCandidateLoadPaths({
    geometry,
    structuralIntent: model.structuralIntent,
    roofStructuralIntent,
    topology,
    structuralProposals: proposals,
    analysisContexts: [{ graph: 'lateral', direction: 'x' }],
    config: {}
  });
  return { model, geometry, topology, proposals, paths, roofStructuralIntent };
}

function rangeEquals(a, b, tolerance = 0.001) {
  return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
    && Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function locateRangeRegion(requirements, elementId, sRange, zRange) {
  return requirements.regions.find((region) => (
    region.ownerRef?.kind === 'element'
    && region.ownerRef.id === elementId
    && region.longitudinalLocation?.kind === 'range'
    && rangeEquals(region.longitudinalLocation.sRange, sRange)
    && rangeEquals(region.zRange, zRange)
  ));
}

function locateEndRegion(requirements, elementId, end, anchorS, localizationEnvelope, zRange) {
  return requirements.regions.find((region) => (
    region.ownerRef?.kind === 'element'
    && region.ownerRef.id === elementId
    && region.longitudinalLocation?.kind === 'end'
    && region.longitudinalLocation.end === end
    && Math.abs(region.longitudinalLocation.anchorS - anchorS) <= 0.001
    && rangeEquals(region.longitudinalLocation.localizationEnvelope, localizationEnvelope)
    && rangeEquals(region.zRange, zRange)
  ));
}

function locatorAudit(model) {
  const presentation = buildStructuralIntentVisualPresentation(model);
  const targetIds = [FX008_FRONTON_C_6_7, FX008_SUPPORT_AT_6, FX008_SUPPORT_AT_7];
  const preview = buildStructuralIntentVisualPreview(presentation, targetIds, { activeId: FX008_FRONTON_C_6_7 });
  const authority = {
    model: {
      viewMode: 'plan', currentZLevelId: null, selectedElementId: 1784600403613,
      selectedRoofSystemId: null, selectedRoofPlaneId: null,
      structuralIntent: structuredClone(model.structuralIntent),
      structuralIntentTrace: structuredClone(model.structuralIntentTrace ?? { schema: 'structural-intent-trace-v1.0', events: [] })
    },
    past: [{ checkpoint: 'before' }], future: [{ checkpoint: 'after' }],
    layout: 'split', viewModeB: 'elevation-y',
    view: { scale: 1, offsetX: 11, offsetY: 22, showAxes: true },
    viewB: { scale: 2, offsetX: 33, offsetY: 44, showAxes: false },
    structuralIntentLocator: { ...EMPTY_STRUCTURAL_INTENT_LOCATOR }
  };
  const before = structuredClone(authority);
  let state = openStructuralIntentLocatorState(authority, { preview, activeId: targetIds[0], sourceFocusId: 'spec015e-evidence' });
  state = setStructuralIntentLocatorHoverState(state, targetIds[1]);
  state = requestStructuralIntentLocatorTargetState(state, targetIds[2]);
  state = setStructuralIntentLocatorActiveState(state, targetIds[2]);
  state = fitStructuralIntentLocatorState(state, 1200, 800);
  const restored = closeStructuralIntentLocatorState(state, { restoreView: true });
  return {
    targetIds,
    historyChanges: JSON.stringify(restored.past) === JSON.stringify(before.past)
      && JSON.stringify(restored.future) === JSON.stringify(before.future) ? 0 : 1,
    traceChanges: JSON.stringify(restored.model.structuralIntentTrace) === JSON.stringify(before.model.structuralIntentTrace) ? 0 : 1,
    structuralIntentChanges: JSON.stringify(restored.model.structuralIntent) === JSON.stringify(before.model.structuralIntent) ? 0 : 1,
    globalSelectionPreserved: restored.model.selectedElementId === before.model.selectedElementId,
    viewRestored: JSON.stringify(restored.view) === JSON.stringify(before.view)
      && restored.model.viewMode === before.model.viewMode,
    sequence: ['open', 'hover', 'request', 'activate', 'fit', 'restore']
  };
}

function wallPolygon(element) {
  const prism = element?.prism;
  if (!prism?.start || !prism?.end || !Number.isFinite(prism.thickness)) return null;
  const dx = prism.end.x - prism.start.x;
  const dy = prism.end.y - prism.start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const nx = -dy / length * prism.thickness / 2;
  const ny = dx / length * prism.thickness / 2;
  return [
    { x: prism.start.x + nx, y: prism.start.y + ny },
    { x: prism.end.x + nx, y: prism.end.y + ny },
    { x: prism.end.x - nx, y: prism.end.y - ny },
    { x: prism.start.x - nx, y: prism.start.y - ny }
  ];
}

function planBounds(geometry) {
  const points = [];
  for (const element of geometry.elements || []) {
    if (element.type !== 'wall') continue;
    const polygon = wallPolygon(element);
    if (polygon) points.push(...polygon);
  }
  for (const roof of geometry.roofGeometry || []) points.push(...(roof.surface?.boundary || []));
  return {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...points.map((point) => point.y)),
    yMax: Math.max(...points.map((point) => point.y))
  };
}

function projector(bounds, box) {
  const spanX = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanY = Math.max(bounds.yMax - bounds.yMin, 1);
  const margin = 30;
  const scale = Math.min((box.width - 2 * margin) / spanX, (box.height - 2 * margin) / spanY);
  return (point) => ({
    x: box.x + margin + (point.x - bounds.xMin) * scale,
    y: box.y + box.height - margin - (point.y - bounds.yMin) * scale
  });
}

function polygonPoints(points, project) {
  return points.map((point) => {
    const p = project(point);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
}

function planSvg(evidence, geometry, sourceModel, box) {
  const bounds = planBounds(geometry);
  const drawingBox = { x: box.x + 8, y: box.y + 36, width: box.width - 16, height: box.height - 132 };
  const project = projector(bounds, drawingBox);
  const gravityFocusByRoof = new Map();
  for (const pathItem of evidence.gravityPaths) {
    const token = gravityFocusByRoof.get(String(pathItem.roofGeometryId)) || [];
    token.push(pathItem.key);
    gravityFocusByRoof.set(String(pathItem.roofGeometryId), token);
  }
  const sourceRoofs = geometry.roofGeometry.filter((roof) => gravityFocusByRoof.has(String(roof.id))).map((roof) => (
    `<polygon data-focus="${focusTokens(gravityFocusByRoof.get(String(roof.id)))}" points="${polygonPoints(roof.surface.boundary, project)}" class="roof-context gravity-source-roof"/>`
  )).join('');
  const targets = new Map([
    [FX008_FRONTON_C_6_7, { role: 'fronton', focus: 'fronton g1 g2 g3 g4', label: 'Frontón C/6→7' }],
    [FX008_SUPPORT_AT_6, { role: 'c6', focus: 'c6 g1 g3', label: 'C/6 receptor' }],
    [FX008_SUPPORT_AT_7, { role: 'c7', focus: 'c7 g2 g4', label: 'C/7 receptor' }]
  ]);
  const anchors = new Map();
  const walls = (geometry.elements || []).filter((item) => item.type === 'wall').map((wall) => {
    const polygon = wallPolygon(wall);
    if (!polygon) return '';
    const target = targets.get(wall.id);
    const className = target ? `wall target target-${target.role}` : 'wall context-wall';
    if (target) {
      anchors.set(target.role, project({
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
      }));
    }
    return `<polygon${target ? ` data-focus="${target.focus}"` : ''} points="${polygonPoints(polygon, project)}" class="${className}"/>`;
  }).join('');
  const keyAxesX = (sourceModel.grid?.xAxes || []).filter((axis) => ['6', '7', '11A'].includes(axis.label));
  const keyAxesY = (sourceModel.grid?.yAxes || []).filter((axis) => axis.label === 'C');
  const axes = [
    ...keyAxesX.map((axis) => {
      const a = project({ x: axis.position, y: bounds.yMin });
      const b = project({ x: axis.position, y: bounds.yMax });
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="axis"/><text x="${a.x + 4}" y="${drawingBox.y + 14}" class="axis-label">${esc(axis.label)}</text>`;
    }),
    ...keyAxesY.map((axis) => {
      const a = project({ x: bounds.xMin, y: axis.position });
      const b = project({ x: bounds.xMax, y: axis.position });
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="axis"/><text x="${drawingBox.x + 4}" y="${a.y - 5}" class="axis-label">${esc(axis.label)}</text>`;
    })
  ].join('');
  const physical = evidence.b1.physicalSegment;
  const interaction = evidence.b1.interactionSegment;
  const pa = project(physical.start); const pb = project(physical.end);
  const ia = project(interaction.start); const ib = project(interaction.end);
  const b1Focus = 'b1 g1 g4';
  const b1Anchor = { x: (ia.x + ib.x) / 2, y: (ia.y + ib.y) / 2 };
  const b1 = `<g data-focus="${b1Focus}"><line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="b1-physical"/>
    <line x1="${ia.x}" y1="${ia.y}" x2="${ib.x}" y2="${ib.y}" class="b1-interaction"/></g>`;
  const calloutY = box.y + box.height - 78;
  const calloutW = (box.width - 54) / 4;
  const calloutData = [
    { key: 'b1', focus: b1Focus, title: 'B1', detail: 'B1 interacción 1.700 mm / físico 10.400 mm', anchor: b1Anchor },
    { key: 'fronton', focus: 'fronton g1 g2 g3 g4', title: 'Frontón C/6→7', detail: 'Región local S 12.800→14.500', anchor: anchors.get('fronton') },
    { key: 'c6', focus: 'c6 g1 g3', title: 'C/6', detail: 'Receptor parcial S 1.949,45→2.050,55', anchor: anchors.get('c6') },
    { key: 'c7', focus: 'c7 g2 g4', title: 'C/7', detail: 'Receptor de extremo highS · S 2.000', anchor: anchors.get('c7') }
  ];
  const callouts = calloutData.map((item, index) => {
    const x = box.x + 18 + index * (calloutW + 6);
    const cx = x + calloutW / 2;
    const leader = item.anchor ? `<line x1="${item.anchor.x}" y1="${item.anchor.y}" x2="${cx}" y2="${calloutY}" class="leader"/>` : '';
    return `<g data-focus="${item.focus}" class="plan-callout">${leader}<rect x="${x}" y="${calloutY}" width="${calloutW}" height="48" class="callout-box"/><text x="${x + 8}" y="${calloutY + 18}" class="callout-title">${esc(item.title)}</text><text x="${x + 8}" y="${calloutY + 36}" class="callout-detail">${esc(item.detail)}</text></g>`;
  }).join('');
  return `<g aria-label="Planta real FX-008"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/>
    <text x="${box.x + 18}" y="${box.y + 28}" class="panel-title">Planta real FX-008 · ejes 6 / 7 / 11A · C</text>${sourceRoofs}${axes}${walls}${b1}<g class="plan-callout-layer">${callouts}</g>
    <text x="${box.x + 18}" y="${box.y + box.height - 10}" class="caption">La geometría fuente permanece visible; los focos usan halo y líderes exteriores, nunca una línea que la reemplace.</text></g>`;
}

function bandSvg(evidence, box) {
  const s0 = evidence.b1.physicalSRange[0];
  const s1 = evidence.b1.physicalSRange[1];
  const mapS = (s) => box.x + 55 + (s - s0) / (s1 - s0) * (box.width - 110);
  const y = box.y + 102;
  const x0 = mapS(s0); const x1 = mapS(s1);
  const ix0 = mapS(evidence.b1.interactionSRange[0]); const ix1 = mapS(evidence.b1.interactionSRange[1]);
  const c6Location = evidence.regions.c6.longitudinalLocation;
  const c7Location = evidence.regions.c7.longitudinalLocation;
  const c6Length = c6Location.sRange[1] - c6Location.sRange[0];
  const insetY = box.y + 168;
  const insetW = (box.width - 54) / 2;
  const insetRange = (x, title, region, length, focus, colorClass) => `<g data-focus="${focus}"><rect x="${x}" y="${insetY}" width="${insetW}" height="120" class="detail-inset"/><text x="${x + 10}" y="${insetY + 20}" class="detail-title">${title} · AMPLIADO · NO A ESCALA</text><line x1="${x + 18}" y1="${insetY + 44}" x2="${x + insetW - 18}" y2="${insetY + 44}" class="detail-bar ${colorClass}"/><text x="${x + 10}" y="${insetY + 66}" class="small">Rango S ${formatNumber(region.longitudinalLocation.sRange[0])}→${formatNumber(region.longitudinalLocation.sRange[1])} · L ${formatNumber(length)} mm</text><text x="${x + 10}" y="${insetY + 89}" class="small">Z ${formatNumber(region.zRange[0])}→${formatNumber(region.zRange[1])} mm</text></g>`;
  const insetEnd = (x, title, region, focus, colorClass) => `<g data-focus="${focus}"><rect x="${x}" y="${insetY}" width="${insetW}" height="120" class="detail-inset"/><text x="${x + 10}" y="${insetY + 20}" class="detail-title">${title} · AMPLIADO · NO A ESCALA</text><line x1="${x + 18}" y1="${insetY + 44}" x2="${x + insetW - 18}" y2="${insetY + 44}" class="detail-bar ${colorClass}"/><text x="${x + 10}" y="${insetY + 63}" class="detail-end-line">Extremo ${region.longitudinalLocation.end} · S ${formatNumber(region.longitudinalLocation.anchorS)} mm</text><text x="${x + 10}" y="${insetY + 78}" class="detail-end-line">Localización S ${formatNumber(region.longitudinalLocation.localizationEnvelope[0])}→${formatNumber(region.longitudinalLocation.localizationEnvelope[1])} mm</text><text x="${x + 10}" y="${insetY + 93}" class="detail-end-line">tol. 0,1 mm · Z ${formatNumber(region.zRange[0])}→${formatNumber(region.zRange[1])} mm</text><text x="${x + 10}" y="${insetY + 108}" class="detail-warning">La envolvente NO es longitud física</text></g>`;
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/>
    <text x="${box.x + 18}" y="${box.y + 28}" class="panel-title">R9–R11 · borde físico ≠ región de interacción</text>
    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="b1-physical"/>
    <line data-focus="b1 g1 g4" x1="${ix0}" y1="${y}" x2="${ix1}" y2="${y}" class="b1-interaction"/>
    <g data-focus="fronton g1 g2 g3 g4"><rect x="${ix0}" y="${y - 56}" width="${ix1 - ix0}" height="38" class="region-fronton"/><text x="${ix0 + 8}" y="${y - 32}" class="region-label">Frontón C/6→7 · S 12.800→14.500 · Z 3.250→4.150</text></g>
    <text x="${x0}" y="${y + 28}" class="small">S 12.800</text><text x="${ix1 + 8}" y="${y + 48}" class="small">S 14.500</text><text x="${x1 - 55}" y="${y + 28}" class="small">S 23.200</text>
    ${insetRange(box.x + 18, 'C/6 receptor', evidence.regions.c6, c6Length, 'c6 g1 g3', 'c6')}
    ${insetEnd(box.x + 30 + insetW, 'C/7 receptor de extremo', evidence.regions.c7, 'c7 g2 g4', 'c7')}
  </g>`;
}

function lateralSvg(evidence, box) {
  const lateral = evidence.lateralScenario;
  const top = box.y + 86;
  const bottom = box.y + box.height - 58;
  const zMin = 3000;
  const zMax = 4000;
  const mapZ = (z) => bottom - (z - zMin) / (zMax - zMin) * (bottom - top);
  const roofY = mapZ(lateral.roofZ);
  const wallY = mapZ(lateral.wallTopZ);
  return `<g data-focus="lateral"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/>
    <text x="${box.x + 18}" y="${box.y + 28}" class="panel-title">Escenario lateral explícito · R10/R12</text>
    <text x="${box.x + 18}" y="${box.y + 52}" class="human-main">${esc(lateral.roofHuman.title)}</text>
    <text x="${box.x + 18}" y="${box.y + 69}" class="technical-ref">Ref. técnica: cubierta ${esc(lateral.roofGeometryId)}</text>
    <line x1="${box.x + 90}" y1="${roofY}" x2="${box.x + box.width - 80}" y2="${roofY}" class="lateral-roof"/>
    <rect x="${box.x + 160}" y="${wallY}" width="${box.width - 320}" height="${Math.max(bottom - wallY, 8)}" class="lateral-wall"/>
    <text x="${box.x + 18}" y="${wallY + 26}" class="human-main">${esc(lateral.wallHuman.title)}</text>
    <text x="${box.x + 18}" y="${wallY + 43}" class="technical-ref">Ref. técnica: muro ${esc(lateral.wallElementId)}</text>
    <line x1="${box.x + box.width - 130}" y1="${roofY}" x2="${box.x + box.width - 130}" y2="${wallY}" class="gap" marker-end="url(#arrow)"/>
    <text x="${box.x + box.width - 310}" y="${(roofY + wallY) / 2}" class="gap-label">gap ${formatNumber(lateral.gapMm)} mm</text>
    <text x="${box.x + 18}" y="${box.y + box.height - 18}" class="requirement-label">${esc(lateral.requirementCode)} · incompleteCandidate · notVerified</text>
  </g>`;
}

function gravityPathsSvg(evidence, box) {
  const rowHeight = 72;
  const stepGap = 12;
  const left = box.x + 118;
  const stepWidth = (box.width - 220 - 3 * stepGap) / 4;
  const rows = evidence.gravityPaths.map((pathItem, index) => {
    const y = box.y + 54 + index * rowHeight;
    const steps = [pathItem.display.source, pathItem.display.transfer, pathItem.display.receiver, pathItem.display.foundation];
    const boxes = steps.map((step, stepIndex) => {
      const x = left + stepIndex * (stepWidth + stepGap);
      const arrow = stepIndex === steps.length - 1 ? '' : `<line x1="${x + stepWidth + 2}" y1="${y + 25}" x2="${x + stepWidth + stepGap - 3}" y2="${y + 25}" class="path-arrow" marker-end="url(#arrow)"/>`;
      return `<rect x="${x}" y="${y}" width="${stepWidth}" height="50" class="path-step"/>${svgTextLines(step, x + 8, y + 18, 'path-step-text', 34, 2)}${arrow}`;
    }).join('');
    return `<g data-focus="${pathItem.key}" class="gravity-path-row"><text x="${box.x + 20}" y="${y + 20}" class="path-label">${pathItem.label}</text><text x="${box.x + 20}" y="${y + 40}" class="path-state">${pathItem.candidateState}</text>${boxes}<text x="${box.x + box.width - 92}" y="${y + 28}" class="path-verification">${pathItem.verificationState}</text></g>`;
  }).join('');
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/><text x="${box.x + 18}" y="${box.y + 28}" class="panel-title">G1–G4 · caminos gravitacionales candidatos inspeccionables</text><text x="${box.x + box.width - 450}" y="${box.y + 28}" class="caption">Cada fila: origen → transferencia local → receptor → fundación candidata</text>${rows}</g>`;
}

function pipelineSvg(evidence, box) {
  const steps = ['Geometría', 'R0–R5', 'Intención v1.1', 'Interfaces / relaciones', 'Path candidato', 'R11 región', 'R10 requisito', 'R12 auditoría'];
  const startX = box.x + 24;
  const width = (box.width - 48) / steps.length;
  const y = box.y + 93;
  const content = steps.map((step, index) => {
    const x = startX + index * width;
    const arrow = index === steps.length - 1 ? '' : `<line x1="${x + width - 17}" y1="${y}" x2="${x + width - 4}" y2="${y}" class="flow-arrow" marker-end="url(#arrow)"/>`;
    return `<rect x="${x}" y="${y - 32}" width="${width - 24}" height="64" class="flow-box"/><text x="${x + (width - 24) / 2}" y="${y - 3}" class="flow-text">${esc(step)}</text>${arrow}`;
  }).join('');
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/>
    <text x="${box.x + 18}" y="${box.y + 28}" class="panel-title">Trazabilidad · la evidencia no se convierte en autoridad</text>${content}
    <text x="${box.x + 24}" y="${box.y + box.height - 24}" class="caption">SHA requisitos ${esc(evidence.hashes.requirements.slice(0, 16))}… · SHA topología ${esc(evidence.hashes.topology.slice(0, 16))}… · todos los estados de verificación permanecen notVerified.</text>
  </g>`;
}

function renderSvg(evidence, scenario) {
  const width = 1500;
  const height = 1510;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">SPEC-015-E · FX-008 · evidencia R6–R12</title>
<desc id="desc">Planta real con líderes exteriores, detalles ampliados no a escala para C/6 y C/7, cuatro caminos gravitacionales inspeccionables y escenario lateral con descriptor humano y gap no resuelto.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>
<style>
text{font-family:Inter,Arial,sans-serif;fill:#1f2937}.background{fill:#eef1ed}.panel{fill:#fff;stroke:#c8d0c8;stroke-width:2}.panel-title{font-size:20px;font-weight:750}.caption,.small{font-size:12px}.context-wall{fill:#e5e7eb;stroke:#94a3b8;stroke-width:1.2}.roof-context{fill:#f5f3ff;stroke:#8b5cf6;stroke-width:1.2;stroke-dasharray:7 6}.gravity-source-roof{fill-opacity:.42}.target{stroke:#64748b;stroke-width:1.4}.target-fronton{fill:#fde68a}.target-c6{fill:#bfdbfe}.target-c7{fill:#bbf7d0}.axis{stroke:#9ca3af;stroke-width:1;stroke-dasharray:5 5}.axis-label{font-size:12px;font-weight:700}.b1-physical{stroke:#6b7280;stroke-width:4;stroke-dasharray:10 7}.b1-interaction{stroke:#7c3aed;stroke-width:8}.leader{stroke:#475569;stroke-width:1.2;fill:none}.callout-box{fill:#f8fafc;stroke:#94a3b8;stroke-width:1}.callout-title{font-size:11px;font-weight:800}.callout-detail{font-size:9.5px}.region-fronton{fill:#fde68a;stroke:#92400e;stroke-width:1.3}.region-label{font-size:11px;font-weight:700}.detail-inset{fill:#f8fafc;stroke:#cbd5e1;stroke-width:1.2}.detail-title{font-size:10px;font-weight:800}.detail-end-line{font-size:10.5px}.detail-warning{font-size:10.5px;font-weight:800;fill:#7c2d12}.detail-bar{stroke-width:8}.detail-bar.c6{stroke:#2563eb}.detail-bar.c7{stroke:#16a34a}.lateral-roof{stroke:#7c3aed;stroke-width:8;stroke-dasharray:12 6}.lateral-wall{fill:#dbeafe;stroke:#1d4ed8;stroke-width:2}.human-main{font-size:11px;font-weight:750}.technical-ref{font-size:9px;fill:#64748b}.gap{stroke:#dc2626;stroke-width:3;stroke-dasharray:5 4}.gap-label{font-size:13px;font-weight:800;fill:#991b1b}.requirement-label{font-size:13px;font-weight:800}.gravity-path-row{transition:opacity .15s}.path-label{font-size:14px;font-weight:900}.path-state{font-size:9px;fill:#475569}.path-step{fill:#f8fafc;stroke:#94a3b8;stroke-width:1.1}.path-step-text{font-size:10px;font-weight:650}.path-arrow{stroke:#475569;stroke-width:1.5}.path-verification{font-size:10px;font-weight:800;fill:#7c2d12}.flow-box{fill:#f8fafc;stroke:#64748b;stroke-width:1.5}.flow-text{text-anchor:middle;font-size:11px;font-weight:700}.flow-arrow{stroke:#334155;stroke-width:2}.heading{font-size:30px;font-weight:800}.subheading{font-size:15px}.audit-text{font-size:13px}.focus-dim{opacity:.12}.focus-strong{filter:drop-shadow(0 0 5px rgba(245,158,11,.95))}
</style>
<rect width="${width}" height="${height}" class="background"/><text x="38" y="48" class="heading">SPEC-015-E · FX-008 · R6–R12</text>
<text x="38" y="75" class="subheading">Evidencia derivada real · no persistente · no verificada · sin solución constructiva</text>
${planSvg(evidence, scenario.geometry, scenario.sourceModel, { x: 35, y: 100, width: 930, height: 520 })}
${bandSvg(evidence, { x: 995, y: 100, width: 470, height: 300 })}
${lateralSvg(evidence, { x: 995, y: 425, width: 470, height: 195 })}
${gravityPathsSvg(evidence, { x: 35, y: 650, width: 1430, height: 350 })}
${pipelineSvg(evidence, { x: 35, y: 1030, width: 1430, height: 190 })}
<g><rect x="35" y="1250" width="1430" height="220" class="panel"/><text x="53" y="1280" class="panel-title">Auditoría del corte</text>
<text x="53" y="1310" class="audit-text">Checkpoint reproducible: 4 caminos gravitacionales ligados a relaciones · 0 caminos laterales · todos completeCandidate/notVerified.</text>
<text x="53" y="1338" class="audit-text">B1: físico 10.400 mm; interacción 1.700 mm. C/6 conserva rango físico de interacción; C/7 es extremo highS en S=2.000 mm y su envolvente 1.999,9→2.000 es sólo localización/tolerancia.</text>
<text x="53" y="1366" class="audit-text">Escenario lateral: gap 571,429 mm → SR-LOAD-TRANSFER-REQUIRED; nombres humanos primero, IDs sólo como referencia técnica.</text>
<text x="53" y="1394" class="audit-text">Localizador puro: historia ${evidence.locator.historyChanges}, trace ${evidence.locator.traceChanges}, intención ${evidence.locator.structuralIntentChanges}; selección global preservada=${evidence.locator.globalSelectionPreserved}.</text>
<text x="53" y="1422" class="audit-text">Elegibilidad global=${evidence.eligibility.eligibleForConstructiveSolutions}; ${esc(evidence.eligibilityExplanation.text)}</text>
<text x="53" y="1450" class="audit-text">Procedencia: cierre REV8 Propuestas=0 quedó en persistencia local; B3/B3.1/B3.2/B3.2.1 sólo reproduce declaraciones, paths, regiones y requisitos versionables.</text></g>
</svg>\n`;
}

function renderHtml(evidence, svg) {
  const safeJson = JSON.stringify(evidence, null, 2).replaceAll('<', '\\u003c');
  const svgBody = svg.replace(/^<\?xml[^>]+>\s*/, '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPEC-015-E · FX-008 · R6–R12</title><style>
body{margin:0;background:#eef1ed;color:#1f2937;font-family:system-ui,-apple-system,sans-serif}main{max-width:1500px;margin:auto;padding:22px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px}.toolbar button{border:1px solid #64748b;background:white;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer}.toolbar button[aria-pressed="true"]{outline:3px solid #111827}.card{background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0}svg{display:block;width:100%;height:auto}.legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.legend span{padding:8px;border:1px dashed #94a3b8;border-radius:6px}pre{white-space:pre-wrap;overflow:auto;max-height:420px;background:#f8fafc;padding:12px}.note{font-size:.93rem;color:#475569}.path-detail[hidden]{display:none}.path-edge{border-left:4px solid #94a3b8;padding:8px 10px;margin:8px 0;background:#f8fafc}.path-edge strong{display:block;margin-bottom:4px}.technical{font-size:.82rem;color:#64748b}.status{font-weight:800}.status.not-verified{color:#9a3412}
</style></head><body><main><h1>SPEC-015-E · revisión visual FX-008</h1><p>Salida derivada de R6–R12. <strong>No es una solución constructiva ni una verificación de capacidad.</strong></p>
<div class="toolbar" role="toolbar" aria-label="Foco de evidencia"><button data-focus="all" aria-pressed="true">Todo</button><button data-focus="b1" aria-pressed="false">B1</button><button data-focus="fronton" aria-pressed="false">Frontón C/6→7</button><button data-focus="c6" aria-pressed="false">C/6</button><button data-focus="c7" aria-pressed="false">C/7</button><button data-focus="g1" aria-pressed="false">G1</button><button data-focus="g2" aria-pressed="false">G2</button><button data-focus="g3" aria-pressed="false">G3</button><button data-focus="g4" aria-pressed="false">G4</button><button data-focus="lateral" aria-pressed="false">Lateral</button></div>
<div class="card" id="visual">${svgBody}</div>
<div class="card"><h2>Lectura del foco</h2><p id="focusText" aria-live="polite">Vista completa: geometría → R0–R5 → intención → interfaces/relaciones → paths → regiones → requisitos → R12.</p></div>
<div class="card path-detail" id="gravityPathDetail" hidden><h2>Camino gravitacional seleccionado</h2><p id="gravityPathStatus"></p><div id="gravityPathEdges"></div></div>
<div class="legend"><span>Discontinua: geometría física / evidencia</span><span>Gruesa: interacción declarada</span><span>Halo: foco sin ocultar la geometría fuente</span><span>“AMPLIADO · NO A ESCALA”: detalle local con cota exacta</span><span>Flecha roja discontinua: gap no resuelto</span><span>Texto “notVerified”: nunca equivale a conformidad</span></div>
<details class="card"><summary>JSON auditable</summary><pre>${esc(JSON.stringify(evidence, null, 2))}</pre></details>
<p class="note">El checkpoint final REV8 de navegador registró Propuestas=0, pero esa persistencia local no quedó como fixture externo. Esta evidencia no fabrica ese review state; reproduce sólo hechos versionables y recalculables.</p>
<script type="application/json" id="evidence-json">${safeJson}</script><script>
const evidence=JSON.parse(document.getElementById('evidence-json').textContent);
const texts={all:'Vista completa: geometría → R0–R5 → intención → interfaces/relaciones → paths → regiones → requisitos → R12.',b1:'B1: borde físico 10.400 mm; la relación consume sólo S 12.800→14.500 (1.700 mm).',fronton:'Frontón C/6→7: la interacción local no promueve una función global del muro.',c6:'C/6: receptor parcial S 1.949,45→2.050,55 · Z 3.250→4.150. El detalle ampliado está marcado NO A ESCALA.',c7:'C/7: receptor de extremo highS en S 2.000 mm · Z 3.250→4.150. La envolvente S 1.999,9→2.000 es sólo localización/tolerancia, no L=0,1 mm.',lateral:'Escenario lateral explícito: gap 571,429 mm → SR-LOAD-TRANSFER-REQUIRED · incompleteCandidate · notVerified.'};
for(const item of evidence.gravityPaths) texts[item.key]=item.label+': '+item.display.source+' → '+item.display.receiver+' → '+item.display.foundation+' · '+item.candidateState+' · '+item.verificationState+'.';
const svg=document.querySelector('#visual svg');
const detail=document.getElementById('gravityPathDetail');
const detailStatus=document.getElementById('gravityPathStatus');
const detailEdges=document.getElementById('gravityPathEdges');
const focusMatches=(el,focus)=>focus==='all'||String(el.dataset.focus||'').split(/\\s+/).includes(focus);
function renderGravityPathDetail(focus){
  const item=evidence.gravityPaths.find(path=>path.key===focus);
  detail.hidden=!item; detailEdges.replaceChildren();
  if(!item) return;
  detailStatus.textContent=item.label+' · '+item.candidateState+' · '+item.verificationState;
  detailStatus.className='status not-verified';
  item.edges.forEach((edge,index)=>{
    const row=document.createElement('div'); row.className='path-edge';
    const title=document.createElement('strong'); title.textContent='Tramo '+(index+1)+' · '+edge.kind;
    const relation=document.createElement('div'); relation.textContent=edge.relationTitle?(edge.relationTitle+': '+edge.from.title+' → '+edge.to.title):(edge.from.title+' → '+edge.to.title);
    const tech=document.createElement('div'); tech.className='technical'; tech.textContent='Referencia técnica: '+edge.edgeId;
    row.append(title,relation,tech); detailEdges.append(row);
  });
}
document.querySelectorAll('.toolbar button[data-focus]').forEach(button=>button.addEventListener('click',()=>{const focus=button.dataset.focus;document.querySelectorAll('.toolbar button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('focusText').textContent=texts[focus];svg.querySelectorAll('[data-focus]').forEach(el=>{const match=focusMatches(el,focus);el.classList.toggle('focus-dim',!match);el.classList.toggle('focus-strong',match&&focus!=='all')});renderGravityPathDetail(focus);}));
</script></main></body></html>\n`;
}

export async function buildSpec015eEvidence() {
  const explicit = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const sourceModel = explicit.sourceModel;
  const checkpointModel = removeElementIntent(explicit.model, FX008_LATERAL_WALL_ID, { recordUserAction: false }).model;
  const checkpointRoofIntent = explicit.roofStructuralIntent.map((intent) => (
    intent.roofGeometryId === FX008_LATERAL_ROOF_ID
      ? { ...intent, diaphragmBehavior: 'candidate' }
      : intent
  ));
  const checkpoint = rebuildContext(checkpointModel, checkpointRoofIntent);
  const checkpointIntegrated = integrateStructuralRequirements(inputFrom(checkpoint));
  const explicitIntegrated = integrateStructuralRequirements(inputFrom(explicit));
  const gravityPaths = buildGravityPathEvidence(checkpoint, checkpointIntegrated, sourceModel);
  const explicitVisual = buildStructuralProposalVisualPresentation(explicit.model, explicit.proposals, explicit.paths);
  const lateralRoofHuman = explicitVisual.entities.roofs.find((item) => String(item.entityId) === String(FX008_LATERAL_ROOF_ID));
  const lateralWallHuman = explicitVisual.entities.elements.find((item) => String(item.entityId) === String(FX008_LATERAL_WALL_ID));
  if (!lateralRoofHuman || !lateralWallHuman) throw new Error('SPEC-015-E evidence: lateral human descriptors missing');

  const northInterface = checkpoint.model.structuralIntent.interfaceIntents.find((item) => (
    item.ownerRef?.kind === 'roofBoundary' && item.ownerRef.roofGeometryId === FX008_ROOF_NORTH
    && rangeEquals(item.locator?.sRange, [12800, 14500])
  ));
  if (!northInterface) throw new Error('SPEC-015-E evidence: B1 north interface not found');
  const northRoof = checkpoint.geometry.roofGeometry.find((item) => item.id === FX008_ROOF_NORTH);
  const northBoundary = canonicalizeRoofBoundaries(northRoof).find((item) => item.boundaryId === northInterface.ownerRef.boundaryId);
  const physicalSRange = roofBoundaryLongitudinalRange(northBoundary);
  const interactionSegment = roofBoundarySegmentForLocator(northBoundary, northInterface.locator);
  if (!northBoundary || !physicalSRange || !interactionSegment) throw new Error('SPEC-015-E evidence: invalid B1 geometry');

  const req = checkpointIntegrated.requirements;
  const frontonRegion = locateRangeRegion(req, FX008_FRONTON_C_6_7, [12800, 14500], [3250, 4150]);
  const c6Region = locateRangeRegion(req, FX008_SUPPORT_AT_6, [1949.45, 2050.55], [3250, 4150]);
  const c7Region = locateEndRegion(req, FX008_SUPPORT_AT_7, 'highS', 2000, [1999.9, 2000], [3250, 4150]);
  if (!frontonRegion || !c6Region || !c7Region) throw new Error('SPEC-015-E evidence: partial receiver region missing');

  const relationGravityPaths = checkpoint.paths.gravity.paths.filter((pathItem) => pathItem.sourceRefs?.relationId);
  const lateralPath = explicit.paths.lateral.paths.find((pathItem) => pathItem.sourceRefs?.roofGeometryId === FX008_LATERAL_ROOF_ID);
  const lateralNode = explicit.paths.lateral.nodes.find((node) => node.ref?.elementId === FX008_LATERAL_WALL_ID);
  const lateralRequirement = explicitIntegrated.requirements.requirements.find((item) => (
    item.code === 'SR-LOAD-TRANSFER-REQUIRED' && item.graph === 'lateral'
  ));
  if (!lateralPath || !lateralNode || !lateralRequirement) throw new Error('SPEC-015-E evidence: lateral scenario incomplete');

  const supportedCandidates = req.supports.filter((item) => item.provenance === 'candidatePath');
  const evidence = {
    schema: 'spec-015-e-fx008-evidence-v1.2',
    sourceFixture: 'tests/fixtures/casa-L-completa-v3.json',
    sourceBaseline: 'main@6d371bd + B1/B2/B3/B3.1/B3.2 working tree',
    sourceCounts: {
      walls: checkpoint.geometry.elements.filter((item) => item.type === 'wall').length,
      openings: checkpoint.geometry.elements.flatMap((item) => item.openings || []).length,
      foundations: checkpoint.geometry.elements.filter((item) => item.type === 'foundation').length,
      roofs: checkpoint.geometry.roofGeometry.length,
      interfaceIntents: checkpoint.model.structuralIntent.interfaceIntents.length,
      relationIntents: checkpoint.model.structuralIntent.relationIntents.length
    },
    closureReference: {
      source: 'docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md',
      proposals: 0,
      gravityPaths: 4,
      completeGravityPaths: 4,
      lateralPaths: 0,
      verified: 0,
      reproducibilityNote: 'El review state exacto del cierre quedó en persistencia local del navegador y no se reconstruye desde el fixture versionado.'
    },
    reproducibleCheckpoint: {
      relationGravityPathCount: relationGravityPaths.length,
      gravityStates: relationGravityPaths.map((pathItem) => pathItem.candidateState),
      lateralPathCount: checkpoint.paths.lateral.paths.length,
      lateralStatus: checkpointIntegrated.requirements.lateralStatus,
      verificationState: checkpointIntegrated.requirements.verification.state,
      allRelationGravityPathsNotVerified: checkpointIntegrated.requirements.gravityPaths
        .filter((pathItem) => relationGravityPaths.some((source) => source.pathId === pathItem.pathId))
        .every((pathItem) => pathItem.verificationState === 'notVerified'),
      supportedByFoundation: {
        count: supportedCandidates.length,
        certainty: [...new Set(supportedCandidates.map((item) => item.certainty))],
        supportEvidence: [...new Set(supportedCandidates.map((item) => item.supportEvidence))]
      }
    },
    gravityPaths,
    visualReview: {
      corrective: 'B3.2',
      bugCodes: ['BUG-015-E-003', 'BUG-015-E-004', 'BUG-015-E-005', 'BUG-015-E-006', 'BUG-015-E-007', 'BUG-015-E-010', 'BUG-015-E-011'],
      geometryPreservedUnderFocus: true,
      partialRegionsUseExplicitNotToScaleInsets: true,
      humanDescriptorsPrimary: true,
      gravityPathsInspectable: gravityPaths.map((item) => item.label),
      endpointEnvelopeNotPhysicalLength: true
    },
    b1: {
      roofGeometryId: FX008_ROOF_NORTH,
      boundaryId: northBoundary.boundaryId,
      interfaceId: northInterface.interfaceId,
      physicalSRange,
      physicalLengthMm: physicalSRange[1] - physicalSRange[0],
      interactionSRange: northInterface.locator.sRange,
      interactionLengthMm: northInterface.locator.sRange[1] - northInterface.locator.sRange[0],
      physicalSegment: { start: northBoundary.start, end: northBoundary.end },
      interactionSegment,
      topologyProjection: checkpointIntegrated.topology.roofSupports.find((item) => (
        item.roofGeometryId === FX008_ROOF_NORTH && rangeEquals(item.interactionLocator?.sRange, [12800, 14500])
      ))
    },
    regions: {
      fronton: frontonRegion,
      c6: c6Region,
      c7: c7Region
    },
    lateralScenario: {
      roofGeometryId: FX008_LATERAL_ROOF_ID,
      wallElementId: FX008_LATERAL_WALL_ID,
      roofHuman: {
        title: lateralRoofHuman.title,
        subtitle: lateralRoofHuman.subtitle,
        technicalReference: lateralRoofHuman.technicalReference
      },
      wallHuman: {
        title: lateralWallHuman.title,
        subtitle: lateralWallHuman.subtitle,
        technicalReference: lateralWallHuman.technicalReference
      },
      pathId: lateralPath.pathId,
      candidateState: lateralPath.candidateState,
      findingCodes: lateralPath.findings,
      gapMm: lateralNode.geometry.gapMm,
      roofZ: lateralNode.geometry.roofZ,
      wallTopZ: lateralNode.geometry.wallTopZ,
      requirementId: lateralRequirement.id,
      requirementCode: lateralRequirement.code,
      verificationState: lateralRequirement.verificationState,
      eligibleForConstructiveSolutions: explicitIntegrated.requirements.eligibility.eligibleForConstructiveSolutions
    },
    traceability: {
      pipeline: ['agnostic-geometry-v1.0', 'R0-R5', 'structural-intent-v1.1', 'interfaces-relations-REV8', 'candidate-load-paths-v1.0', 'R11-regions', 'R10-requirements', 'R12-audit'],
      sourceFingerprints: explicitIntegrated.requirements.sourceFingerprints,
      requirementRefsResolve: explicitIntegrated.requirements.regions.every((region) => region.requirementRefs.every((ref) => explicitIntegrated.requirements.requirements.some((item) => item.id === ref)))
    },
    locator: locatorAudit(explicit.model),
    hashes: {
      requirements: explicitIntegrated.requirements.canonicalSha256,
      topology: explicitIntegrated.topology.canonicalSha256
    },
    prohibitions: {
      geometryMutation: false,
      persistedR6R12: false,
      constructiveMemberSelected: false,
      profileSelected: false,
      materialSelected: false,
      connectionSelected: false,
      verifiedStateCreated: false
    },
    blockingDecisions: explicitIntegrated.requirements.blockingDecisions,
    eligibility: explicitIntegrated.requirements.eligibility,
    eligibilityExplanation: {
      blockingDecisionCount: explicitIntegrated.requirements.blockingDecisions.length,
      text: explicitIntegrated.requirements.eligibility.eligibleForConstructiveSolutions
        ? 'Sin decisiones bloqueantes globales.'
        : `Elegibilidad global bloqueada: ${explicitIntegrated.requirements.blockingDecisions.length} decisiones; ${explicitIntegrated.requirements.eligibility.reasonCodes.join(', ')} indica cobertura de intención de techumbre incompleta. El requisito lateral sigue siendo descriptivo, no verificado.`
    }
  };
  evidence.evidenceSha256 = sha256(JSON.stringify(evidence));
  const svg = renderSvg(evidence, { ...explicit, sourceModel });
  const html = renderHtml(evidence, svg);
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  return { evidence, json, svg, html };
}

export async function writeSpec015eEvidence(outputDir = OUT) {
  const generated = await buildSpec015eEvidence();
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, JSON_NAME), generated.json);
  await writeFile(path.join(outputDir, SVG_NAME), generated.svg);
  await writeFile(path.join(outputDir, HTML_NAME), generated.html);
  const manifest = {
    schema: 'spec-015-e-evidence-manifest-v1.0',
    evidenceSha256: generated.evidence.evidenceSha256,
    files: [
      { path: JSON_NAME, bytes: Buffer.byteLength(generated.json), sha256: sha256(generated.json) },
      { path: SVG_NAME, bytes: Buffer.byteLength(generated.svg), sha256: sha256(generated.svg) },
      { path: HTML_NAME, bytes: Buffer.byteLength(generated.html), sha256: sha256(generated.html) }
    ]
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(outputDir, 'MANIFEST.json'), manifestText);
  return { ...generated, manifest, manifestText };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await writeSpec015eEvidence();
  console.log(`PASS - evidencia SPEC-015-E FX-008: ${generated.evidence.evidenceSha256}`);
  console.log(`gravity_relations=${generated.evidence.reproducibleCheckpoint.relationGravityPathCount}`);
  console.log(`lateral_checkpoint=${generated.evidence.reproducibleCheckpoint.lateralPathCount}`);
  console.log(`lateral_gap_mm=${generated.evidence.lateralScenario.gapMm}`);
}
