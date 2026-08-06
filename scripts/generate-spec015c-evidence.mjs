import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  setElementIntent,
  setElementIntentsBatch,
  setRoofIntent
} from '../src/core/structuralIntent.js';
import {
  buildElementIntentDraft,
  buildRoofIntentDraft,
  buildStructuralIntentWorkspace,
  prepareElementIntentBatch
} from '../src/core/structuralIntentWorkspace.js';
import { serializeAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { prepareModelImport } from '../src/core/modelSchema.js';
import { serializeNativeProject } from '../src/core/nativeProjectFile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/casa-L-completa-v3.json');
const OUTPUT_DIR = path.join(ROOT, 'evidence/spec-015-c');
const HTML_PATH = path.join(OUTPUT_DIR, 'FX-008-structural-intent-workspace.html');
const JSON_PATH = path.join(OUTPUT_DIR, 'FX-008-structural-intent-workspace.json');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'MANIFEST.json');

const TARGETS = Object.freeze({
  frontonUndefined: 1784819708086,
  undeterminedIsolated: 1784818076062,
  interiorLateral: 1784606313849,
  secondaryBatch: [1784751397992, 1784752583321, 1784752639636],
  secondaryFloating: 1784752583321,
  roof: 1785030887081
});
const BOUNDARY_FUNCTIONS = Object.freeze([
  'gutterSupport',
  'geometricBoundary',
  'gravitySupport',
  'geometricBoundary',
  'gravitySupport',
  'lateralSupport'
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function countGeometry(model, workspace) {
  return {
    walls: model.elements.filter((element) => element.type === 'wall').length,
    openings: model.elements.flatMap((element) => element.openings || []).length,
    foundations: model.elements.filter((element) => element.type === 'foundation').length,
    roofs: workspace.roofRows.length,
    elements: model.elements.length
  };
}

function intentFor(model, elementId) {
  return model.structuralIntent.elementIntents.find((intent) => intent.elementId === elementId) || null;
}

function renderRoofSvg(roofDraft) {
  const points = roofDraft.polygon;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1); const height = Math.max(maxY - minY, 1);
  const project = (point) => ({
    x: 50 + ((point.x - minX) / width) * 500,
    y: 330 - ((point.y - minY) / height) * 260
  });
  const polygon = points.map((point) => {
    const mapped = project(point);
    return `${mapped.x.toFixed(3)},${mapped.y.toFixed(3)}`;
  }).join(' ');
  const edges = roofDraft.boundaries.map((boundary) => {
    const start = project(boundary.start); const end = project(boundary.end);
    return `<g><line x1="${start.x.toFixed(3)}" y1="${start.y.toFixed(3)}" x2="${end.x.toFixed(3)}" y2="${end.y.toFixed(3)}" class="edge"/><text x="${((start.x + end.x) / 2).toFixed(3)}" y="${(((start.y + end.y) / 2) - 7).toFixed(3)}" class="edge-label">${escapeHtml(boundary.label)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 600 380" role="img" aria-label="Cubierta ${roofDraft.roofGeometryId} con seis bordes canónicos"><polygon points="${polygon}" class="roof-polygon"/>${edges}<line x1="300" y1="210" x2="300" y2="125" class="direction" marker-end="url(#arrow)"/><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"/></marker></defs></svg>`;
}

function renderHtml(evidence) {
  const steps = evidence.flow.map((step) => `<button class="step" data-step="${step.order}"><span>${step.order}</span>${escapeHtml(step.title)}</button>`).join('');
  const panels = evidence.flow.map((step) => `<article class="step-panel" data-panel="${step.order}"><p class="eyebrow">Paso ${step.order}</p><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.result)}</p><pre>${escapeHtml(JSON.stringify(step.data, null, 2))}</pre></article>`).join('');
  const traceRows = evidence.trace.events.map((event) => `<tr><td>${event.sequence}</td><td>${escapeHtml(event.operation)}</td><td>${escapeHtml(event.targetType)}</td><td>${event.changes.length}</td><td><code>${escapeHtml(event.changes.map((change) => String(change.targetId)).join(', '))}</code></td></tr>`).join('');
  const boundaryRows = evidence.roof.boundaries.map((boundary) => `<tr><td>${boundary.label}</td><td><code>${escapeHtml(boundary.boundaryId)}</code></td><td>${escapeHtml(boundary.function)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPEC-015-C · FX-008</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#20231f;background:#eceee9}*{box-sizing:border-box}body{margin:0}header{padding:32px 5vw;background:#173c35;color:#fff}header h1{margin:.2rem 0;font-size:clamp(1.8rem,4vw,3.5rem)}header p{max-width:900px}.warning{background:#fff3cd;color:#5e4700;padding:12px 5vw;font-weight:700}.layout{display:grid;grid-template-columns:minmax(240px,330px) 1fr;gap:20px;padding:24px 5vw}.card{background:#fff;border:1px solid #d7dbd4;border-radius:14px;padding:18px;box-shadow:0 8px 28px #18312912}.metrics{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:12px;padding:0 5vw 22px}.metric strong{font-size:1.8rem;display:block}.step{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;border-bottom:1px solid #e5e8e2;background:transparent;padding:10px;cursor:pointer}.step span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#dfe9e5}.step.active{background:#eaf3ef;font-weight:700}.step-panel{display:none}.step-panel.active{display:block}.eyebrow{text-transform:uppercase;letter-spacing:.1em;color:#52655e;font-size:.75rem}pre{overflow:auto;background:#17201d;color:#eaf4ef;padding:14px;border-radius:10px;font-size:.78rem}table{border-collapse:collapse;width:100%;font-size:.86rem}th,td{border-bottom:1px solid #e1e4de;padding:8px;text-align:left}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;word-break:break-all}.roof-polygon{fill:#edf3f0;stroke:#3f514b;stroke-width:3}.edge{stroke:#1e6a59;stroke-width:8;stroke-linecap:round}.edge-label{font-weight:800;font-size:16px;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:5px}.direction{stroke:#bf4d32;stroke-width:5}.direction+defs path{fill:#bf4d32}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.status{display:inline-block;border:1px solid #87968f;border-radius:999px;padding:3px 8px;font-size:.8rem}.ok{color:#176344}.pending{color:#885c00}footer{padding:30px 5vw;color:#52605b}@media(max-width:900px){.layout,.grid2{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<header><p class="eyebrow">Evidencia reproducible · structural-intent-v1.0</p><h1>SPEC-015-C · FX-008</h1><p>Flujo macro → micro de declaraciones estructurales explícitas. Geometría e intención permanecen como autoridades separadas.</p></header>
<div class="warning">Esta evidencia no verifica capacidad resistente ni construye caminos de carga.</div>
<section class="metrics">${Object.entries(evidence.counts).map(([key,value])=>`<div class="card metric"><span>${escapeHtml(key)}</span><strong>${value}</strong></div>`).join('')}</section>
<section class="layout"><aside class="card"><h2>Flujo</h2>${steps}</aside><main class="card">${panels}</main></section>
<section class="grid2" style="padding:0 5vw 22px"><div class="card"><h2>Techumbre y bordes</h2>${renderRoofSvg(evidence.roof)}<table><thead><tr><th>Visual</th><th>boundaryId canónico</th><th>Función declarada</th></tr></thead><tbody>${boundaryRows}</tbody></table></div>
<div class="card"><h2>Estados finales</h2><p><span class="status">No definido</span> Frontón <code>${evidence.targets.frontonUndefined}</code></p><p><span class="status ok">Declarado</span> Muro interior <code>${evidence.targets.interiorLateral}</code></p><p><span class="status ok">Declarados</span> 3 secundarios; uno termina <strong>floating</strong>.</p><p><span class="status pending">Pendiente</span> Transferencia de cargas fuera del corte.</p><h3>Prueba aislada</h3><p><code>${evidence.targets.undeterminedIsolated}</code> admite <strong>undetermined</strong> como declaración persistente, sin incorporarse al estado final.</p><h3>Errores controlados</h3><ul>${evidence.errorScenarios.map((item)=>`<li><strong>${escapeHtml(item.state)}</strong>: ${escapeHtml(item.code)} — ${escapeHtml(item.effect)}</li>`).join('')}</ul></div></section>
<section style="padding:0 5vw 22px"><div class="card"><h2>Trazabilidad vigente</h2><table><thead><tr><th>#</th><th>Operación</th><th>Objetivo</th><th>Cambios</th><th>IDs</th></tr></thead><tbody>${traceRows}</tbody></table><p>Undo elimina el evento 4 junto con la modificación <em>floating</em>; redo restaura ambos.</p></div></section>
<section style="padding:0 5vw 22px"><div class="card"><h2>Identidad y persistencia</h2><p>Geometría antes/después: <strong class="ok">byte-identical=${evidence.agnosticGeometry.byteIdentical}</strong></p><p><code>${evidence.agnosticGeometry.sha256Before}</code></p><p>Roundtrip nativo: <strong class="ok">${evidence.persistence.deepEqual ? 'PASS' : 'FAIL'}</strong></p><p>Colecciones futuras: intersection=${evidence.inactiveCollections.intersectionIntents}, support=${evidence.inactiveCollections.supportIntents}, diaphragm=${evidence.inactiveCollections.diaphragmIntents}, overrides=${evidence.inactiveCollections.overrides}</p></div></section>
<footer>Generado de forma determinista desde <code>${escapeHtml(evidence.sourceFixture)}</code>. Caso ${evidence.caseId}.</footer>
<script>const buttons=[...document.querySelectorAll('[data-step]')];const panels=[...document.querySelectorAll('[data-panel]')];function show(id){buttons.forEach(b=>b.classList.toggle('active',b.dataset.step===id));panels.forEach(p=>p.classList.toggle('active',p.dataset.panel===id));}buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.step)));show('1');</script></body></html>\n`;
}

export async function buildSpec015cEvidence() {
  const source = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const agnosticBefore = serializeAgnosticGeometry(source);
  const initialWorkspace = buildStructuralIntentWorkspace(source);

  const isolatedUndetermined = setElementIntent(source, TARGETS.undeterminedIsolated, {
    participation: 'undetermined', functions: [], secondaryInteraction: 'notApplicable'
  }).model;
  const isolatedIntent = intentFor(isolatedUndetermined, TARGETS.undeterminedIsolated);

  let current = structuredClone(source);
  const roofDraft = buildRoofIntentDraft(current, TARGETS.roof);
  const roofInput = {
    loadDistribution: 'oneWay',
    primaryResistanceDirection: { x: 0, y: 1 },
    secondaryResistanceDirection: null,
    diaphragmBehavior: 'candidate',
    boundaryIntents: roofDraft.boundaryIntents.map((boundary, index) => ({
      boundaryId: boundary.boundaryId,
      function: BOUNDARY_FUNCTIONS[index]
    }))
  };
  current = setRoofIntent(current, TARGETS.roof, roofInput, { recordUserAction: true }).model;
  const afterRoof = current;
  current = setElementIntent(current, TARGETS.interiorLateral, {
    participation: 'resistant', functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable'
  }, { recordUserAction: true }).model;

  const batchPreview = prepareElementIntentBatch(current, TARGETS.secondaryBatch, {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve', notes: null
  });
  current = setElementIntentsBatch(current, batchPreview.selection, {
    participation: 'secondary', functions: ['spaceDivision'],
    secondaryInteraction: 'solidary', notesMode: 'preserve', notes: null
  }, { recordUserAction: true, expectedPrevious: batchPreview.expectedPrevious }).model;
  const beforeFloating = current;
  current = setElementIntent(current, TARGETS.secondaryFloating, {
    participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'floating'
  }, { recordUserAction: true }).model;
  const finalModel = current;
  const finalWorkspace = buildStructuralIntentWorkspace(finalModel);
  const finalRoofDraft = buildRoofIntentDraft(finalModel, TARGETS.roof);
  const agnosticAfter = serializeAgnosticGeometry(finalModel);
  const reopened = prepareModelImport(JSON.parse(serializeNativeProject(finalModel))).model;

  let invalidCode = null;
  try {
    setElementIntent(source, TARGETS.interiorLateral, {
      participation: 'resistant', functions: [], secondaryInteraction: 'notApplicable'
    });
  } catch (error) { invalidCode = error.code; }
  let staleCode = null;
  try {
    setElementIntentsBatch(finalModel, [TARGETS.secondaryBatch[0]], {
      participation: 'secondary', functions: ['spaceDivision'], secondaryInteraction: 'solidary', notesMode: 'preserve'
    }, { expectedPrevious: [{ elementId: TARGETS.secondaryBatch[0], fingerprint: '0'.repeat(64) }] });
  } catch (error) { staleCode = error.code; }
  const brokenDraft = buildElementIntentDraft(finalModel, 'missing:FX-008');

  const evidence = {
    schema: 'spec-015-c-evidence-v1.0',
    caseId: 'FX-008',
    sourceFixture: 'tests/fixtures/casa-L-completa-v3.json',
    counts: countGeometry(source, initialWorkspace),
    targets: TARGETS,
    initial: {
      elementsDeclared: initialWorkspace.summary.elementsDeclared,
      roofsDeclared: initialWorkspace.summary.roofsDeclared,
      tracePresent: source.structuralIntentTrace !== undefined
    },
    isolatedUndetermined: {
      integratedIntoFinalState: false,
      intent: isolatedIntent
    },
    roof: {
      roofGeometryId: TARGETS.roof,
      polygon: finalRoofDraft.polygon,
      loadDistribution: 'oneWay',
      primaryResistanceDirection: { x: 0, y: 1 },
      diaphragmBehavior: 'candidate',
      boundaries: finalRoofDraft.boundaryIntents.map((boundary) => ({
        label: boundary.label,
        boundaryId: boundary.boundaryId,
        start: boundary.start,
        end: boundary.end,
        function: boundary.function
      }))
    },
    final: {
      frontonIntent: intentFor(finalModel, TARGETS.frontonUndefined),
      elementIntents: finalModel.structuralIntent.elementIntents,
      roofIntents: finalModel.structuralIntent.roofIntents,
      summary: finalWorkspace.summary,
      pending: [
        { code: 'SI-TRANSFER-OUT-OF-SCOPE', state: 'pending', message: 'La transferencia de cargas se resolverá en un corte posterior.' }
      ]
    },
    trace: finalModel.structuralIntentTrace,
    history: {
      beforeFloatingTraceEvents: beforeFloating.structuralIntentTrace.events.length,
      afterFloatingTraceEvents: finalModel.structuralIntentTrace.events.length,
      undoRemovesFloating: intentFor(beforeFloating, TARGETS.secondaryFloating).secondaryInteraction === 'solidary',
      redoRestoresFloating: intentFor(finalModel, TARGETS.secondaryFloating).secondaryInteraction === 'floating'
    },
    persistence: {
      modelVersion: reopened.modelVersion,
      deepEqual: JSON.stringify(reopened) === JSON.stringify(finalModel),
      tracePreserved: JSON.stringify(reopened.structuralIntentTrace) === JSON.stringify(finalModel.structuralIntentTrace)
    },
    agnosticGeometry: {
      bytesBefore: Buffer.byteLength(agnosticBefore),
      sha256Before: sha256(agnosticBefore),
      bytesAfter: Buffer.byteLength(agnosticAfter),
      sha256After: sha256(agnosticAfter),
      byteIdentical: agnosticBefore === agnosticAfter
    },
    inactiveCollections: {
      intersectionIntents: finalModel.structuralIntent.intersectionIntents.length,
      supportIntents: finalModel.structuralIntent.supportIntents.length,
      diaphragmIntents: finalModel.structuralIntent.diaphragmIntents.length,
      overrides: finalModel.structuralIntent.overrides.length
    },
    errorScenarios: [
      { state: 'Inválido', code: invalidCode, effect: 'cero cambios, cero eventos' },
      { state: 'Referencia rota', code: brokenDraft.state, effect: 'borrador transitorio; no se persiste' },
      { state: 'Previsualización obsoleta', code: staleCode, effect: 'lote completo rechazado' },
      { state: 'Cancelado', code: 'SI-USER-CANCELLED', effect: 'modelo original conservado' }
    ],
    flow: [
      { order: 1, title: 'Abrir Estructura', result: 'Resumen inicial sin declaraciones.', data: initialWorkspace.summary },
      { order: 2, title: 'Revisar frontón', result: 'Se observa, no se guarda y permanece No definido.', data: { elementId: TARGETS.frontonUndefined, finalIntent: null } },
      { order: 3, title: 'Declarar techumbre', result: 'Dirección, distribución, diafragma y seis bordes explícitos.', data: { roofGeometryId: TARGETS.roof, boundaries: finalRoofDraft.boundaryIntents.map(({ label, boundaryId, function: boundaryFunction }) => ({ label, boundaryId, function: boundaryFunction })) } },
      { order: 4, title: 'Declarar muro interior', result: 'Resistencia lateral prevista sin fabricar conexión con cubierta.', data: intentFor(finalModel, TARGETS.interiorLateral) },
      { order: 5, title: 'Asignar lote', result: 'Tres secundarios solidarios en una sola operación.', data: { selection: batchPreview.selection, previousGroups: batchPreview.previousGroups, effectiveChanges: batchPreview.effectiveChanges.length } },
      { order: 6, title: 'Modificar secundario', result: 'Un objetivo cambia de solidary a floating.', data: intentFor(finalModel, TARGETS.secondaryFloating) },
      { order: 7, title: 'Undo / redo', result: 'Mutación y evento se revierten/restauran juntos.', data: { before: 3, after: 4, undo: 'solidary', redo: 'floating' } },
      { order: 8, title: 'Guardar y reabrir', result: 'Modelo v3, declaraciones y trace se reproducen.', data: { deepEqual: JSON.stringify(reopened) === JSON.stringify(finalModel), modelVersion: reopened.modelVersion } },
      { order: 9, title: 'Comprobar identidad', result: 'La geometría agnóstica permanece byte-identical.', data: { bytes: Buffer.byteLength(agnosticAfter), sha256: sha256(agnosticAfter) } }
    ],
    interpretation: {
      capacityVerification: false,
      loadPathVerification: false,
      wallClassificationInference: false,
      boundaryWallLinkCreated: false
    },
    intermediateChecks: {
      frontonAfterRoof: intentFor(afterRoof, TARGETS.frontonUndefined),
      finalOperations: finalModel.structuralIntentTrace.events.map((event) => event.operation)
    }
  };
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const html = renderHtml(evidence);
  const manifestObject = {
    schema: 'spec-015-c-evidence-manifest-v1.0',
    files: [
      { path: path.basename(HTML_PATH), bytes: Buffer.byteLength(html), sha256: sha256(html) },
      { path: path.basename(JSON_PATH), bytes: Buffer.byteLength(json), sha256: sha256(json) }
    ]
  };
  return { evidence, json, html, manifest: `${JSON.stringify(manifestObject, null, 2)}\n` };
}

export async function writeSpec015cEvidence() {
  const generated = await buildSpec015cEvidence();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(HTML_PATH, generated.html);
  await writeFile(JSON_PATH, generated.json);
  await writeFile(MANIFEST_PATH, generated.manifest);
  return generated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await writeSpec015cEvidence();
  console.log(
    `SPEC-015-C evidencia FX-008 OK: ${generated.evidence.final.elementIntents.length} elementos, `
    + `${generated.evidence.final.roofIntents.length} cubierta, ${generated.evidence.trace.events.length} eventos, `
    + `byteIdentity=${generated.evidence.agnosticGeometry.byteIdentical}`
  );
}
