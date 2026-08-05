import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  projectAgnosticRoofGeometry,
  serializeAgnosticGeometry
} from '../src/core/agnosticGeometry.js';
import {
  canonicalizeRoofBoundaries,
  setRoofIntent
} from '../src/core/structuralIntent.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/casa-L-completa-v3.json');
const OUTPUT_DIR = path.join(ROOT, 'evidence/spec-015-b');
const SVG_PATH = path.join(OUTPUT_DIR, 'FX-008-roof-intent.svg');
const JSON_PATH = path.join(OUTPUT_DIR, 'FX-008-roof-intent.json');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'MANIFEST.json');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmt(value) {
  return Number(value.toFixed(3));
}

function roofPath(roof, mapPoint) {
  const points = roof.surface.boundary.map(mapPoint);
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
}

function midpoint(edge, mapPoint) {
  return mapPoint({
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2
  });
}

function renderSvg(roofs, declarations) {
  const allPoints = roofs.flatMap((roof) => roof.surface.boundary);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const width = 1500;
  const height = 950;
  const margin = 80;
  const scale = Math.min(
    (width - margin * 2) / Math.max(1, maxX - minX),
    (height - margin * 2) / Math.max(1, maxY - minY)
  );
  const mapPoint = (point) => ({
    x: fmt(margin + (point.x - minX) * scale),
    y: fmt(height - margin - (point.y - minY) * scale)
  });
  const declarationById = new Map(declarations.map((item) => [item.roofGeometryId, item]));
  const roofMarkup = roofs.map((roof) => {
    const declaration = declarationById.get(roof.id);
    const edge = declaration?.boundary;
    const edgeStart = edge ? mapPoint(edge.start) : null;
    const edgeEnd = edge ? mapPoint(edge.end) : null;
    const center = roof.surface.boundary.reduce((sum, point) => ({
      x: sum.x + point.x / roof.surface.boundary.length,
      y: sum.y + point.y / roof.surface.boundary.length
    }), { x: 0, y: 0 });
    const label = mapPoint(center);
    const direction = declaration?.intent.primaryResistanceDirection;
    const arrowLength = 55;
    const arrow = direction
      ? `<line x1="${label.x}" y1="${label.y + 15}" x2="${fmt(label.x + direction.x * arrowLength)}" y2="${fmt(label.y - direction.y * arrowLength + 15)}" class="direction" marker-end="url(#arrow)"/>`
      : '';
    return [
      `<path d="${roofPath(roof, mapPoint)}" class="roof"/>`,
      edge ? `<line x1="${edgeStart.x}" y1="${edgeStart.y}" x2="${edgeEnd.x}" y2="${edgeEnd.y}" class="declared-edge"/>` : '',
      `<text x="${label.x}" y="${label.y}" class="roof-id" text-anchor="middle">${escapeXml(roof.id)}</text>`,
      declaration
        ? `<text x="${label.x}" y="${label.y + 32}" class="intent" text-anchor="middle">${escapeXml(declaration.intent.loadDistribution)} · ${escapeXml(declaration.boundaryIntent.function)}</text>`
        : '',
      declaration
        ? `<text x="${label.x}" y="${label.y + 50}" class="status" text-anchor="middle">diafragma: ${escapeXml(declaration.intent.diaphragmBehavior)} · ${escapeXml(declaration.intent.status)}</text>`
        : '',
      arrow
    ].join('\n');
  }).join('\n');

  const legend = declarations.map((item, index) => {
    const y = 720 + index * 42;
    const direction = item.intent.primaryResistanceDirection
      ? `(${item.intent.primaryResistanceDirection.x}, ${item.intent.primaryResistanceDirection.y})`
      : 'sin dirección global';
    return `<text x="90" y="${y}" class="legend">${escapeXml(item.roofGeometryId)} · borde ${escapeXml(item.boundary.boundaryId.slice(-12))} · ${escapeXml(direction)} · ${escapeXml(item.boundaryIntent.function)} · ${escapeXml(item.intent.diaphragmBehavior)}</text>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">SPEC-015-B — FX-008 intención de techumbre y bordes canónicos</title>
  <description id="description">Siete cubiertas reales. Cuatro muestran un borde declarado, dirección resistente cuando existe y estados explícitos sin clasificar muros.</description>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#1d4ed8"/></marker>
  </defs>
  <style>
    .roof { fill: #eff6ff; fill-opacity: .65; stroke: #334155; stroke-width: 2; }
    .declared-edge { stroke: #dc2626; stroke-width: 8; stroke-linecap: round; }
    .direction { stroke: #1d4ed8; stroke-width: 4; }
    .roof-id { font: 700 16px Arial, sans-serif; fill: #0f172a; paint-order: stroke; stroke: white; stroke-width: 4px; }
    .intent { font: 700 13px Arial, sans-serif; fill: #7f1d1d; paint-order: stroke; stroke: white; stroke-width: 3px; }
    .status { font: 12px Arial, sans-serif; fill: #334155; paint-order: stroke; stroke: white; stroke-width: 3px; }
    .heading { font: 700 24px Arial, sans-serif; fill: #0f172a; }
    .subheading { font: 14px Arial, sans-serif; fill: #334155; }
    .legend { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; fill: #0f172a; }
  </style>
  <rect width="1500" height="950" fill="white"/>
  <text x="70" y="42" class="heading">FX-008 · bordes canónicos e intención de techumbre</text>
  <text x="70" y="67" class="subheading">Rojo: borde declarado · Azul: dirección resistente global · Los muros sólo son contexto y no se clasifican.</text>
  ${roofMarkup}
  <rect x="70" y="684" width="1360" height="210" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
  ${legend}
</svg>
`;
}

export async function buildSpec015bEvidence() {
  const source = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const agnosticBefore = serializeAgnosticGeometry(source);
  const roofs = projectAgnosticRoofGeometry(source);
  const definitions = [
    {
      roofGeometryId: 1785030887081,
      loadDistribution: 'oneWay',
      primaryResistanceDirection: { x: 0, y: 1 },
      diaphragmBehavior: 'candidate',
      boundaryFunction: 'gravitySupport'
    },
    {
      roofGeometryId: 1785161146258,
      loadDistribution: 'oneWay',
      primaryResistanceDirection: { x: 1, y: 0 },
      diaphragmBehavior: 'notIntended',
      boundaryFunction: 'lateralSupport'
    },
    {
      roofGeometryId: 1785161396221,
      loadDistribution: 'local',
      primaryResistanceDirection: null,
      diaphragmBehavior: 'undetermined',
      boundaryFunction: 'geometricBoundary'
    },
    {
      roofGeometryId: 1785161662029,
      loadDistribution: 'undetermined',
      primaryResistanceDirection: null,
      diaphragmBehavior: 'undetermined',
      boundaryFunction: 'undetermined'
    }
  ];

  let declaredModel = source;
  const declarations = [];
  for (const definition of definitions) {
    const roof = roofs.find((item) => item.id === definition.roofGeometryId);
    const boundary = canonicalizeRoofBoundaries(roof)[0];
    declaredModel = setRoofIntent(declaredModel, definition.roofGeometryId, {
      loadDistribution: definition.loadDistribution,
      primaryResistanceDirection: definition.primaryResistanceDirection,
      diaphragmBehavior: definition.diaphragmBehavior,
      boundaryIntents: [{
        boundaryId: boundary.boundaryId,
        function: definition.boundaryFunction
      }]
    }).model;
    const intent = declaredModel.structuralIntent.roofIntents.find((item) => (
      item.roofGeometryId === definition.roofGeometryId
    ));
    declarations.push({
      roofGeometryId: definition.roofGeometryId,
      geometry: roof,
      boundary,
      boundaryIntent: intent.boundaryIntents[0],
      intent
    });
  }

  const agnosticAfter = serializeAgnosticGeometry(declaredModel);
  const evidence = {
    schema: 'spec-015-b-evidence-v1.0',
    caseId: 'FX-008',
    sourceFixture: 'tests/fixtures/casa-L-completa-v3.json',
    counts: {
      walls: source.elements.filter((element) => element.type === 'wall').length,
      openings: source.elements.flatMap((element) => element.openings || []).length,
      foundations: source.elements.filter((element) => element.type === 'foundation').length,
      roofs: roofs.length
    },
    agnosticGeometry: {
      bytesBefore: Buffer.byteLength(agnosticBefore),
      sha256Before: sha256(agnosticBefore),
      bytesAfter: Buffer.byteLength(agnosticAfter),
      sha256After: sha256(agnosticAfter),
      byteIdentical: agnosticAfter === agnosticBefore
    },
    declarations,
    interpretation: {
      wallClassification: 'not-performed',
      automaticSupportInference: false,
      omittedBoundaries: 'not-declared'
    }
  };
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const svg = renderSvg(roofs, declarations);
  const manifest = {
    schema: 'spec-015-b-evidence-manifest-v1.0',
    files: [
      { path: 'FX-008-roof-intent.json', bytes: Buffer.byteLength(json), sha256: sha256(json) },
      { path: 'FX-008-roof-intent.svg', bytes: Buffer.byteLength(svg), sha256: sha256(svg) }
    ]
  };
  return { evidence, json, svg, manifest: `${JSON.stringify(manifest, null, 2)}\n` };
}

export async function writeSpec015bEvidence() {
  const generated = await buildSpec015bEvidence();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_PATH, generated.json);
  await writeFile(SVG_PATH, generated.svg);
  await writeFile(MANIFEST_PATH, generated.manifest);
  return generated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await writeSpec015bEvidence();
  console.log(
    `SPEC-015-B evidencia FX-008 OK: ${generated.evidence.counts.roofs} cubiertas, `
    + `${generated.evidence.declarations.length} declaraciones, byteIdentity=${generated.evidence.agnosticGeometry.byteIdentical}`
  );
}
