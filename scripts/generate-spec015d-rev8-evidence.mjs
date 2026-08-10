import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFx008Rev8Continuous, buildFx008Rev8Short } from '../tests/helpers/spec015dRev8.mjs';
import { semanticId } from '../src/core/structuralProposalCommon.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'evidence', 'spec-015-d-rev8');

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function relationSummary(relation) {
  return {
    relationId: relation.relationId,
    actionFamily: relation.actionFamily,
    structuralFunction: relation.structuralFunction,
    ports: relation.ports,
    carrierRegions: relation.carrierRegions,
    notes: relation.notes
  };
}

function caseSummary(context, name) {
  const explicit = context.paths.gravity.paths.filter((item) => item.sourceRefs.relationId);
  return {
    name,
    structuralIntentSchema: context.model.structuralIntent.schema,
    modelVersion: context.model.modelVersion,
    interfaces: context.model.structuralIntent.interfaceIntents,
    relations: context.model.structuralIntent.relationIntents.map(relationSummary),
    gravityPaths: explicit.map((item) => ({
      pathId: item.pathId,
      candidateState: item.candidateState,
      findings: item.findings,
      edgeKinds: item.edgeIds.map((id) => context.paths.gravity.edges.find((edge) => edge.edgeId === id)?.kind)
    })),
    fronton: { id: 1784819708086, axis: 'C', from: '6', to: '7', sRange: [12800, 14500], zRange: [3250, 4150] },
    agnosticGeometrySchema: context.geometry.schema,
    structuralAssemblyPresent: JSON.stringify(context.model.structuralIntent).includes('structuralAssembly')
  };
}

function svgEvidence(shortCase, continuousCase) {
  const relationShort = shortCase.model.structuralIntent.relationIntents.find((item) => item.structuralFunction === 'loadTransfer');
  const relationContinuous = continuousCase.model.structuralIntent.relationIntents.find((item) => item.notes?.includes('continuo'));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="960" viewBox="0 0 1400 960">
<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs>
<rect width="1400" height="960" fill="#fff"/>
<text x="50" y="52" font-family="sans-serif" font-size="28" font-weight="700">SPEC-015-D REV8 · FX-008 · Interfaces estructurales</text>
<text x="50" y="82" font-family="sans-serif" font-size="16">Geometría agnóstica intacta · caso gobernante frontón C/6→7 · representación de auditoría, no plano de ejecución.</text>

<g transform="translate(50 125)">
  <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="700">1 · Macro → entidad</text>
  <rect x="0" y="25" width="610" height="250" rx="12" fill="#fafafa" stroke="#bbb"/>
  <line x1="80" y1="170" x2="540" y2="170" stroke="#bbb" stroke-width="10"/><text x="85" y="205" font-family="sans-serif" font-size="14">Eje C</text>
  <line x1="205" y1="70" x2="205" y2="235" stroke="#bbb" stroke-width="8"/><text x="190" y="55" font-family="sans-serif" font-size="14">6</text>
  <line x1="320" y1="70" x2="320" y2="235" stroke="#bbb" stroke-width="8"/><text x="305" y="55" font-family="sans-serif" font-size="14">7</text>
  <line x1="540" y1="70" x2="540" y2="235" stroke="#bbb" stroke-width="8"/><text x="518" y="55" font-family="sans-serif" font-size="14">11A</text>
  <line x1="205" y1="170" x2="320" y2="170" stroke="#235c83" stroke-width="18"/>
  <text x="215" y="155" font-family="sans-serif" font-size="14" font-weight="700">Frontón 1784819708086</text>
  <line x1="320" y1="170" x2="540" y2="170" stroke="#7395aa" stroke-width="18"/>
  <text x="365" y="155" font-family="sans-serif" font-size="14">Muro C/7→11A</text>
</g>

<g transform="translate(715 125)">
  <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="700">2 · Micro → caras + transferencia corta</text>
  <rect x="0" y="25" width="635" height="250" rx="12" fill="#fafafa" stroke="#bbb"/>
  <rect x="205" y="90" width="205" height="92" fill="#e8eef2" stroke="#235c83" stroke-width="3"/>
  <line x1="205" y1="88" x2="410" y2="88" stroke="#d15a3a" stroke-width="7"/><text x="420" y="92" font-family="sans-serif" font-size="14">face −N · recibe gravity</text>
  <line x1="205" y1="184" x2="410" y2="184" stroke="#3e8b5b" stroke-width="7"/><text x="420" y="188" font-family="sans-serif" font-size="14">face +N · recibe gravity</text>
  <line x1="300" y1="45" x2="300" y2="85" stroke="#333" stroke-width="2" marker-end="url(#arr)"/><text x="220" y="42" font-family="sans-serif" font-size="13">cubierta y&lt;C</text>
  <line x1="300" y1="230" x2="300" y2="188" stroke="#333" stroke-width="2" marker-end="url(#arr)"/><text x="220" y="247" font-family="sans-serif" font-size="13">cubierta y&gt;C</text>
  <line x1="205" y1="136" x2="125" y2="136" stroke="#333" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="410" y1="136" x2="490" y2="136" stroke="#333" stroke-width="2" marker-end="url(#arr)"/>
  <text x="52" y="130" font-family="sans-serif" font-size="13">endLowS · 6</text><text x="498" y="130" font-family="sans-serif" font-size="13">endHighS · 7</text>
  <text x="205" y="215" font-family="sans-serif" font-size="13">loadTransfer · gravity · región S 12.800→14.500 / Z 3.250→4.150</text>
</g>

<g transform="translate(50 455)">
  <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="700">3 · Alternativa continua C/6→11A</text>
  <rect x="0" y="25" width="1300" height="235" rx="12" fill="#fafafa" stroke="#bbb"/>
  <line x1="160" y1="135" x2="1120" y2="135" stroke="#235c83" stroke-width="24"/>
  <line x1="420" y1="80" x2="420" y2="190" stroke="#fff" stroke-width="4" stroke-dasharray="7 6"/>
  <text x="150" y="68" font-family="sans-serif" font-size="14">6 · S=12.800</text><text x="395" y="68" font-family="sans-serif" font-size="14">7 · S=14.500</text><text x="1080" y="68" font-family="sans-serif" font-size="14">11A · S=23.200</text>
  <text x="215" y="128" font-family="sans-serif" font-size="14" fill="#fff" font-weight="700">carrierRegion #1 · host frontón</text>
  <text x="620" y="128" font-family="sans-serif" font-size="14" fill="#fff" font-weight="700">carrierRegion #2 · host C/7→11A</text>
  <line x1="1120" y1="135" x2="1215" y2="135" stroke="#333" stroke-width="2" marker-end="url(#arr)"/><text x="1060" y="205" font-family="sans-serif" font-size="14">salida endHighS → apoyo 11A sólo si relación declarada</text>
  <text x="160" y="230" font-family="sans-serif" font-size="14">No split · no merge · no sólido nuevo · no structuralAssembly</text>
</g>

<g transform="translate(50 775)">
  <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="700">4 · Resultado de caminos candidatos</text>
  <text x="0" y="35" font-family="monospace" font-size="14">Corto: ${esc(shortCase.paths.gravity.paths.filter((p) => p.sourceRefs.relationId).map((p) => p.candidateState).join(', '))}</text>
  <text x="0" y="62" font-family="monospace" font-size="14">Continuo: ${esc(continuousCase.paths.gravity.paths.filter((p) => p.sourceRefs.relationId).map((p) => p.candidateState).join(', '))}</text>
  <text x="0" y="89" font-family="monospace" font-size="14">Relación corta: ${esc(relationShort?.relationId || '')}</text>
  <text x="0" y="116" font-family="monospace" font-size="14">Relación continua: ${esc(relationContinuous?.relationId || '')}</text>
</g>
</svg>`;
}

function htmlEvidence(data, svg) {
  const json = JSON.stringify(data, null, 2).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPEC-015-D REV8 · FX-008</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f3f3ef;color:#252521}main{max-width:1400px;margin:auto;padding:24px}.card{background:white;border:1px solid #ddd;border-radius:12px;padding:18px;margin:14px 0}.tabs button{margin-right:8px;padding:8px 12px}.case{display:none}.case.active{display:block}pre{white-space:pre-wrap;overflow:auto;background:#f7f7f3;padding:12px;border-radius:8px}svg{max-width:100%;height:auto}</style></head><body><main><h1>SPEC-015-D REV8 · evidencia FX-008</h1><p>Datos reales del fixture FX-008. Interfaces y relaciones son intención estructural agnóstica; no crean geometría ni verifican capacidad.</p><div class="card">${svg.replace(/^<\?xml[^>]+>\s*/, '')}</div><div class="tabs"><button data-case="short">Caso corto C/6→7</button><button data-case="continuous">Continuo C/6→11A</button></div><section id="short" class="case active card"><h2>Caso corto</h2><pre>${esc(JSON.stringify(data.short, null, 2))}</pre></section><section id="continuous" class="case card"><h2>Caso continuo</h2><pre>${esc(JSON.stringify(data.continuous, null, 2))}</pre></section><script>document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.case').forEach(x=>x.classList.remove('active'));document.getElementById(b.dataset.case).classList.add('active')})</script><script type="application/json" id="evidence-json">${json}</script></main></body></html>`;
}

export async function buildSpec015dRev8Evidence() {
  const shortCase = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const continuousCase = await buildFx008Rev8Continuous();
  const data = {
    schema: 'spec-015-d-rev8-interface-evidence-v1.0',
    caseId: 'FX-008',
    short: caseSummary(shortCase, 'fronton-C-6-7-short'),
    continuous: caseSummary(continuousCase, 'band-C-6-11A-continuous'),
    invariants: {
      modelVersion: 3,
      agnosticGeometrySchema: 'agnostic-geometry-v1.0',
      structuralIntentSchema: 'structural-intent-v1.1',
      structuralAssembly: 'not-used',
      geometryMutation: false
    }
  };
  data.evidenceSha256 = semanticId('evidence', data).split(':').at(-1);
  const svg = svgEvidence(shortCase, continuousCase);
  const html = htmlEvidence(data, svg);
  return { data, svg, html };
}

export async function writeSpec015dRev8Evidence(outputDir = OUT) {
  const built = await buildSpec015dRev8Evidence();
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'FX-008-SPEC-015-D-REV8.json'), `${JSON.stringify(built.data, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'FX-008-SPEC-015-D-REV8.svg'), built.svg);
  await writeFile(path.join(outputDir, 'FX-008-SPEC-015-D-REV8.html'), `${built.html}\n`);
  const manifest = {
    schema: 'spec-015-d-rev8-evidence-manifest-v1.0',
    evidenceSha256: built.data.evidenceSha256,
    files: ['FX-008-SPEC-015-D-REV8.json', 'FX-008-SPEC-015-D-REV8.svg', 'FX-008-SPEC-015-D-REV8.html']
  };
  await writeFile(path.join(outputDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { ...built, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await writeSpec015dRev8Evidence();
  console.log(`PASS - evidencia SPEC-015-D REV8: ${result.data.evidenceSha256}`);
}
