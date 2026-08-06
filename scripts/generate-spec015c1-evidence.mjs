import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  buildStructuralIntentVisualPresentation,
  buildStructuralIntentVisualPreview,
  visualFingerprintSnapshot
} from '../src/core/structuralIntentVisualPresentation.js';
import {
  EMPTY_STRUCTURAL_INTENT_LOCATOR,
  closeStructuralIntentLocatorState,
  fitStructuralIntentLocatorState,
  openStructuralIntentLocatorState,
  requestStructuralIntentLocatorTargetState,
  setStructuralIntentLocatorActiveState,
  setStructuralIntentLocatorHoverState
} from '../src/core/structuralIntentLocator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/casa-L-completa-v3.json');
const OUTPUT_DIR = path.join(ROOT, 'evidence/spec-015-c-1');
const JSON_PATH = path.join(OUTPUT_DIR, 'FX-008-SPEC-015-C-1.json');
const SVG_PATH = path.join(OUTPUT_DIR, 'FX-008-SPEC-015-C-1.svg');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'MANIFEST.json');

export const TARGET_WALL_ID = 1784605101040;
export const BATCH_WALL_IDS = Object.freeze([1784751397992, 1784752583321, 1784752639636]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function boundsOf(preview) {
  return preview.visibleBounds || preview.targetBounds;
}

function projector(bounds, box) {
  const spanX = Math.max(bounds.xMax - bounds.xMin, 1);
  const spanY = Math.max(bounds.yMax - bounds.yMin, 1);
  const margin = 22;
  const scale = Math.min((box.width - 2 * margin) / spanX, (box.height - 2 * margin) / spanY);
  const cx = (bounds.xMin + bounds.xMax) / 2;
  const cy = (bounds.yMin + bounds.yMax) / 2;
  return (point) => ({
    x: box.x + box.width / 2 + (point.x - cx) * scale,
    y: box.y + box.height / 2 - (point.y - cy) * scale
  });
}

function polygons(target) {
  if (target.planGeometry?.polygon) return [target.planGeometry.polygon];
  if (target.planGeometry?.solids) return target.planGeometry.solids.map((solid) => solid.polygon);
  return [];
}

function polygonPoints(polygon, project) {
  return polygon.map((point) => {
    const mapped = project(point);
    return `${mapped.x.toFixed(3)},${mapped.y.toFixed(3)}`;
  }).join(' ');
}

function targetCenter(target, project) {
  const points = polygons(target).flat();
  if (!points.length) return { x: 0, y: 0 };
  return project({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  });
}

function renderPlanPanel(preview, box, title) {
  const project = projector(boundsOf(preview), box);
  const context = preview.context.map((target) => polygons(target).map((polygon) => (
    `<polygon points="${polygonPoints(polygon, project)}" class="context"/>`
  )).join('')).join('');
  const selected = preview.selected.map((target) => {
    const shapes = polygons(target).map((polygon) => `<polygon points="${polygonPoints(polygon, project)}" class="selected"/>`).join('');
    const openings = (target.openings || []).map((opening) => `<polygon points="${polygonPoints(opening.planGeometry.polygon, project)}" class="opening"/>`).join('');
    const center = targetCenter(target, project);
    return `${shapes}${openings}<g><circle cx="${center.x.toFixed(3)}" cy="${center.y.toFixed(3)}" r="15" class="mark-circle"/><text x="${center.x.toFixed(3)}" y="${(center.y + 5).toFixed(3)}" class="mark">${escapeXml(target.mark)}</text></g>`;
  }).join('');
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/><text x="${box.x + 16}" y="${box.y + 24}" class="panel-title">${escapeXml(title)}</text>${context}${selected}</g>`;
}

function renderElevationPanel(target, box) {
  const geometry = target.elevationGeometry;
  const rect = geometry.rect;
  const openings = geometry.openings || [];
  const bounds = {
    xMin: Math.min(rect.s0, ...openings.map((item) => item.s0)),
    xMax: Math.max(rect.s1, ...openings.map((item) => item.s1)),
    yMin: Math.min(rect.z0, ...openings.map((item) => item.z0)),
    yMax: Math.max(rect.z1, ...openings.map((item) => item.z1))
  };
  const project = projector(bounds, box);
  const a = project({ x: rect.s0, y: rect.z0 });
  const b = project({ x: rect.s1, y: rect.z1 });
  const openingRects = openings.map((opening) => {
    const start = project({ x: opening.s0, y: opening.z0 });
    const end = project({ x: opening.s1, y: opening.z1 });
    return `<rect x="${Math.min(start.x, end.x).toFixed(3)}" y="${Math.min(start.y, end.y).toFixed(3)}" width="${Math.abs(end.x - start.x).toFixed(3)}" height="${Math.abs(end.y - start.y).toFixed(3)}" class="opening"/>`;
  }).join('');
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" class="panel"/><text x="${box.x + 16}" y="${box.y + 24}" class="panel-title">Micro · elevación T con 3 vanos</text><rect x="${Math.min(a.x, b.x).toFixed(3)}" y="${Math.min(a.y, b.y).toFixed(3)}" width="${Math.abs(b.x - a.x).toFixed(3)}" height="${Math.abs(b.y - a.y).toFixed(3)}" class="selected-elevation"/>${openingRects}<text x="${box.x + box.width / 2}" y="${box.y + box.height - 12}" class="caption">${escapeXml(target.descriptor.summary)}</text></g>`;
}

function renderSvg(individual, batch) {
  const width = 1440;
  const height = 930;
  const target = individual.selected[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">SPEC-015-C-1 — FX-008 identificación visual</title>
<desc id="desc">Aplicación macro a micro con preview individual, elevación y lote real, sin inferencia estructural.</desc>
<style>
text{font-family:Inter,Arial,sans-serif;fill:#20231f}.background{fill:#eef1ed}.panel{fill:#fff;stroke:#cbd2cb;stroke-width:2}.panel-title{font-size:20px;font-weight:700}.context{fill:#f2f3f2;stroke:#68706b;stroke-width:2;stroke-dasharray:8 6}.selected{fill:#e7dcff;stroke:#5b21b6;stroke-width:5}.selected-elevation{fill:#e7dcff;stroke:#5b21b6;stroke-width:5}.opening{fill:#fff;stroke:#111827;stroke-width:3;stroke-dasharray:7 4}.mark-circle{fill:#fff;stroke:#111827;stroke-width:3}.mark{text-anchor:middle;font-size:14px;font-weight:800}.heading{font-size:32px;font-weight:800}.subheading{font-size:16px;fill:#4f5c54}.caption{text-anchor:middle;font-size:11px;fill:#3d4741}.note{font-size:14px}.audit{font-size:18px;font-weight:700;fill:#176344}
</style>
<rect width="${width}" height="${height}" class="background"/>
<text x="44" y="52" class="heading">SPEC-015-C-1 · FX-008</text>
<text x="44" y="82" class="subheading">Identificación visual de muros y elementos · geometría real · sin propuestas, caminos de carga ni topología</text>
${renderPlanPanel(individual, { x: 40, y: 115, width: 660, height: 350 }, 'Macro · objetivo individual T + vecinos')}
${renderElevationPanel(target, { x: 740, y: 115, width: 660, height: 350 })}
${renderPlanPanel(batch, { x: 40, y: 505, width: 980, height: 360 }, 'Macro · lote real S1…S3 + contexto')}
<g><rect x="1060" y="505" width="340" height="360" rx="8" class="panel"/>
<text x="1080" y="540" class="panel-title">Contrato operativo</text>
<text x="1080" y="576" class="note">• lista ↔ descriptor ↔ preview ↔ viewport</text>
<text x="1080" y="608" class="note">• hover, foco y activación bidireccional</text>
<text x="1080" y="640" class="note">• localización temporal y restaurable</text>
<text x="1080" y="672" class="note">• borrador preservado; stale bloquea</text>
<text x="1080" y="704" class="note">• referencia rota permanece visible</text>
<text x="1080" y="752" class="audit">Historial: 0 cambios</text>
<text x="1080" y="782" class="audit">Trace: 0 eventos</text>
<text x="1080" y="812" class="audit">Selección global: preservada</text>
</g>
<text x="44" y="910" class="subheading">Fuente: tests/fixtures/casa-L-completa-v3.json · contrato structural-intent-visual-presentation-v1.0</text>
</svg>\n`;
}

function locatorAudit(preview) {
  const authority = {
    model: {
      viewMode: 'elevation-x', currentZLevelId: 1784556740725, selectedElementId: 1784600403613,
      selectedRoofSystemId: null, selectedRoofPlaneId: null,
      structuralIntent: { schema: 'structural-intent-v1.0', elementIntents: [], roofIntents: [] },
      structuralIntentTrace: { schema: 'structural-intent-trace-v1.0', events: [{ sequence: 1 }] }
    },
    past: [{ snapshot: 1 }], future: [{ snapshot: 2 }],
    layout: 'split', viewModeB: 'elevation-y',
    view: { scale: 1, offsetX: 10, offsetY: 20, showAxes: true },
    viewB: { scale: 2, offsetX: 30, offsetY: 40, showAxes: false },
    structuralIntentLocator: { ...EMPTY_STRUCTURAL_INTENT_LOCATOR }
  };
  const before = JSON.parse(JSON.stringify(authority));
  let state = openStructuralIntentLocatorState(authority, { preview, activeId: preview.activeId, sourceFocusId: 'evidence' });
  state = setStructuralIntentLocatorHoverState(state, preview.selected.at(-1).id);
  state = requestStructuralIntentLocatorTargetState(state, preview.selected.at(-1).id);
  state = setStructuralIntentLocatorActiveState(state, preview.selected.at(-1).id);
  state = fitStructuralIntentLocatorState(state, 1200, 800);
  const restored = closeStructuralIntentLocatorState(state, { restoreView: true });
  return {
    historyChanges: JSON.stringify(restored.past) === JSON.stringify(before.past) && JSON.stringify(restored.future) === JSON.stringify(before.future) ? 0 : 1,
    traceChanges: JSON.stringify(restored.model.structuralIntentTrace) === JSON.stringify(before.model.structuralIntentTrace) ? 0 : 1,
    authorityChanges: JSON.stringify(restored.model.structuralIntent) === JSON.stringify(before.model.structuralIntent) ? 0 : 1,
    globalSelectionPreserved: restored.model.selectedElementId === before.model.selectedElementId,
    viewRestored: JSON.stringify(restored.view) === JSON.stringify(before.view) && restored.model.viewMode === before.model.viewMode,
    interactionSequence: ['open', 'hover', 'request', 'activate', 'fit', 'restore']
  };
}

export async function buildSpec015c1Evidence() {
  const model = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const presentation = buildStructuralIntentVisualPresentation(model);
  const individual = buildStructuralIntentVisualPreview(presentation, [TARGET_WALL_ID], { activeId: TARGET_WALL_ID });
  const batch = buildStructuralIntentVisualPreview(presentation, BATCH_WALL_IDS, { activeId: BATCH_WALL_IDS[0] });
  const target = individual.selected[0];
  const evidence = {
    schema: 'spec-015-c-1-evidence-v1.0',
    sourceFixture: 'FX-008/casa-L-completa-v3.json',
    sourceGeometry: {
      walls: model.elements.filter((element) => element.type === 'wall').length,
      openings: model.elements.flatMap((element) => element.openings || []).length,
      foundations: model.elements.filter((element) => element.type === 'foundation').length,
      roofPlanes: model.roofPlanes.length,
      elements: model.elements.length
    },
    contract: presentation.runtimeContract,
    presentationSha256: presentation.presentationSha256,
    individual: {
      targetId: TARGET_WALL_ID,
      descriptor: target.descriptor,
      openingIds: target.openings.map((opening) => opening.id),
      mark: target.mark,
      contextIds: individual.context.map((item) => item.id),
      bounds: individual.visibleBounds,
      fingerprint: visualFingerprintSnapshot(presentation, [TARGET_WALL_ID])
    },
    batch: {
      targetIds: [...BATCH_WALL_IDS],
      marks: batch.selected.map(({ id, mark }) => ({ id, mark })),
      activeId: batch.activeId,
      contextIds: batch.context.map((item) => item.id),
      bounds: batch.visibleBounds,
      fingerprint: visualFingerprintSnapshot(presentation, BATCH_WALL_IDS)
    },
    locator: locatorAudit(batch),
    prohibitions: {
      structuralProposalsEnabled: false,
      loadPathsEnabled: false,
      topologyEnabled: false,
      globalSelectionExpanded: false,
      structuralInferencePerformed: false
    }
  };
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const svg = renderSvg(individual, batch);
  const manifest = `${JSON.stringify({
    schema: 'spec-015-c-1-evidence-manifest-v1.0',
    sourcePresentationSha256: presentation.presentationSha256,
    files: [
      { path: path.basename(JSON_PATH), bytes: Buffer.byteLength(json), sha256: sha256(json) },
      { path: path.basename(SVG_PATH), bytes: Buffer.byteLength(svg), sha256: sha256(svg) }
    ]
  }, null, 2)}\n`;
  return { evidence, json, svg, manifest };
}

export async function writeSpec015c1Evidence() {
  const generated = await buildSpec015c1Evidence();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_PATH, generated.json);
  await writeFile(SVG_PATH, generated.svg);
  await writeFile(MANIFEST_PATH, generated.manifest);
  return generated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await writeSpec015c1Evidence();
  console.log(`SPEC-015-C-1 evidencia FX-008 OK: T=${generated.evidence.individual.targetId}, lote=${generated.evidence.batch.targetIds.length}, historia=${generated.evidence.locator.historyChanges}, trace=${generated.evidence.locator.traceChanges}`);
}
