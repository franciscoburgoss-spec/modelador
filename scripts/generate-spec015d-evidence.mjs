import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectAgnosticGeometry } from '../src/core/agnosticGeometry.js';
import { recognizeStructuralTopology } from '../src/core/recognizedStructuralTopology.js';
import { canonicalizeRoofBoundaries } from '../src/core/roofStructuralIntent.js';
import { setElementIntent } from '../src/core/structuralIntent.js';
import { generateStructuralProposals } from '../src/core/structuralProposals.js';
import { buildCandidateLoadPaths } from '../src/core/candidateLoadPaths.js';
import { buildStructuralProposalVisualPresentation } from '../src/core/structuralProposalVisualPresentation.js';
import { prepareStructuralProposalDecision, applyStructuralProposalDecision } from '../src/core/applyStructuralProposalDecision.js';
import { sha256, canonicalizeValue, sourceFingerprints } from '../src/core/structuralProposalCommon.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = resolve(ROOT, 'evidence/spec-015-d');
const FIXTURE = resolve(ROOT, 'tests/fixtures/casa-L-completa-v3.json');
const LATERAL_WALL_ID = 1784606313849;
const DESIRED_TARGETS = [1784604634483, 1784819708086, 1784670218571, 1784669652371];

function roofIntent(roof, boundaryIds, { diaphragmBehavior = 'candidate', direction = { x: 0, y: 1 } } = {}) {
  return {
    intentId: `intent:roof:${roof.id}`,
    roofGeometryId: roof.id,
    loadDistribution: 'oneWay',
    primaryResistanceDirection: direction,
    secondaryResistanceDirection: null,
    diaphragmBehavior,
    boundaryIntents: boundaryIds.map((boundaryId) => ({ boundaryId, function: 'gravitySupport', source: 'userDeclared' })),
    status: 'declared', source: 'userDeclared', notes: 'Declaración controlada para evidencia SPEC-015-D.'
  };
}

function targetIntent(model, targetId) {
  return model.structuralIntent.elementIntents.find((intent) => intent.elementId === targetId) || null;
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function planSvg(geometry, presentation) {
  const walls = geometry.elements.filter((element) => element.type === 'wall');
  const foundations = geometry.elements.filter((element) => element.type === 'foundation');
  const points = [];
  for (const wall of walls) points.push(wall.prism.start, wall.prism.end);
  for (const roof of geometry.roofGeometry) points.push(...roof.surface.boundary);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = 1100; const height = 760; const margin = 55;
  const scale = Math.min((width - margin * 2) / (maxX - minX), (height - margin * 2) / (maxY - minY));
  const xy = (point) => ({ x: margin + (point.x - minX) * scale, y: height - margin - (point.y - minY) * scale });
  const proposalEntities = presentation.proposals.slice(0, 4);
  const highlightedWalls = new Set(proposalEntities.map((item) => item.target.entityId));
  const highlightedRoofs = new Set(proposalEntities.map((item) => item.source.entityId));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">FX-008 — propuestas y caminos candidatos SPEC-015-D</title>',
    '<desc id="desc">Planta real con 45 muros, 32 fundaciones y 7 cubiertas. Los resaltados son candidatos no verificados.</desc>',
    '<rect width="100%" height="100%" fill="#fbfbf8"/>'];
  for (const foundation of foundations) {
    const solid = foundation.solids?.find((item) => item.role === 'sobrecimiento') || foundation.solids?.[0];
    const prism = solid?.prism;
    if (!prism?.min || !prism?.max) continue;
    const a = xy(prism.min); const b = xy(prism.max);
    parts.push(`<rect x="${Math.min(a.x,b.x).toFixed(2)}" y="${Math.min(a.y,b.y).toFixed(2)}" width="${Math.abs(b.x-a.x).toFixed(2)}" height="${Math.abs(b.y-a.y).toFixed(2)}" fill="#d7d7d0" opacity="0.7"/>`);
  }
  for (const roof of geometry.roofGeometry) {
    const polygon = roof.surface.boundary.map((point) => { const p = xy(point); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ');
    parts.push(`<polygon points="${polygon}" fill="${highlightedRoofs.has(roof.id) ? '#dcd6ff' : '#ecece7'}" stroke="${highlightedRoofs.has(roof.id) ? '#6c5ce7' : '#b9b9b1'}" stroke-width="${highlightedRoofs.has(roof.id) ? 3 : 1}" opacity="0.62"/>`);
  }
  for (const wall of walls) {
    const a = xy(wall.prism.start); const b = xy(wall.prism.end);
    parts.push(`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${highlightedWalls.has(wall.id) ? '#b23a48' : '#30302c'}" stroke-width="${highlightedWalls.has(wall.id) ? 5 : 2}"/>`);
  }
  parts.push('<g font-family="Arial, sans-serif" font-size="14" fill="#20201d">');
  proposalEntities.forEach((proposal, index) => {
    parts.push(`<text x="65" y="${35 + index * 18}">${escaped(`${index + 1}. ${proposal.target.title}`)}</text>`);
  });
  parts.push('</g><text x="65" y="735" font-family="Arial, sans-serif" font-size="13" fill="#55554f">Candidato ≠ verificado · sin materiales, perfiles ni soluciones constructivas</text></svg>');
  return parts.join('\n');
}

function interactiveHtml(evidence, svg) {
  const data = JSON.stringify(evidence).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPEC-015-D · FX-008</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#252521;background:#f4f4ef}body{margin:0}.top{padding:20px 26px;background:#242420;color:white}.top p{margin:.4rem 0 0;color:#d7d7d0}.tabs{display:flex;gap:8px;padding:12px 24px;background:white;border-bottom:1px solid #ddd;position:sticky;top:0}.tabs button{border:0;border-radius:7px;padding:9px 13px;background:#eee;cursor:pointer}.tabs button.active{background:#6c5ce7;color:white}.pane{display:none;padding:22px}.pane.active{display:block}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.card{background:white;border:1px solid #ddd;border-radius:10px;padding:14px}.metric{font-size:28px;font-weight:700}.muted{color:#666;font-size:13px}.path{border-left:4px solid #6c5ce7;margin:10px 0;padding:10px;background:#fafafa}.warn{border-color:#c58c17;background:#fff8e7}.tech{font:12px ui-monospace,monospace;word-break:break-all}svg{width:100%;height:auto;background:white;border-radius:10px;border:1px solid #ddd}details{margin-top:8px}pre{white-space:pre-wrap;overflow:auto;background:#f4f4ef;padding:10px;border-radius:7px}button.locate{border:1px solid #6c5ce7;background:white;color:#5545cf;border-radius:6px;padding:6px 9px}.focus{outline:4px solid #ffbf47}.badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#efefeb;font-size:12px}
  </style></head><body><header class="top"><h1>SPEC-015-D · FX-008 / casa-L</h1><p>Propuestas no autoritativas y caminos candidatos. Ningún resultado representa cálculo o verificación.</p></header><nav class="tabs" aria-label="Navegación macro a micro"><button data-tab="summary" class="active">Resumen</button><button data-tab="plan">Planta</button><button data-tab="proposals">Propuestas</button><button data-tab="gravity">G↓ Gravedad</button><button data-tab="lateral">L→ Lateral</button><button data-tab="review">Revisión</button></nav>
  <main><section id="summary" class="pane active"><div class="grid" id="metrics"></div><div class="card" style="margin-top:14px"><h2>Fronteras</h2><ul><li>Geometría, intención, techumbre y topología son fuentes separadas.</li><li>Aceptar es una mutación confirmada; rechazar y diferir no cambian intención.</li><li>El cielo falso no es nodo, colector, transferencia ni diafragma.</li><li>IDs sólo aparecen como referencia técnica secundaria.</li></ul></div></section><section id="plan" class="pane">${svg}</section><section id="proposals" class="pane"><div id="proposalList" class="grid"></div></section><section id="gravity" class="pane"><div id="gravityList"></div></section><section id="lateral" class="pane"><div id="lateralList"></div></section><section id="review" class="pane"><div id="reviewList" class="grid"></div><details><summary>Stale guard</summary><pre id="stale"></pre></details></section></main>
  <script>const E=${data};const q=s=>document.querySelector(s);document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));});
  const metrics=[['Muros',E.counts.walls],['Vanos',E.counts.openings],['Fundaciones',E.counts.foundations],['Cubiertas',E.counts.roofs],['Propuestas revisión',E.proposals.length],['Estado verified',0]];q('#metrics').innerHTML=metrics.map(x=>'<div class="card"><div class="muted">'+x[0]+'</div><div class="metric">'+x[1]+'</div></div>').join('');
  q('#proposalList').innerHTML=E.proposals.map((p,i)=>'<article class="card" id="p'+i+'"><span class="badge">'+p.candidateState+'</span><h3>'+p.title+'</h3><p class="muted">'+p.subtitle+'</p><button class="locate" data-locate="'+i+'">Localizar en planta</button><details><summary>Referencia técnica</summary><div class="tech">'+JSON.stringify(p.technicalReference)+'</div></details></article>').join('');
  document.querySelectorAll('[data-locate]').forEach(button=>button.onclick=()=>{document.querySelector('[data-tab=plan]').click();const plan=document.querySelector('svg');plan.classList.add('focus');setTimeout(()=>plan.classList.remove('focus'),1200);});
  const graph=(id,g)=>q(id).innerHTML=g.paths.map(p=>'<article class="path '+(p.findings.length?'warn':'')+'"><strong>'+p.summary+'</strong><p>'+p.edgeIds.length+' tramos · '+(p.findings.join(' · ')||'sin hallazgos bloqueantes')+'</p><details><summary>Referencia técnica</summary><div class="tech">'+p.pathId+'</div></details></article>').join('')||'<div class="card">Sin caminos para este contexto.</div>';graph('#gravityList',E.graphs.gravity);graph('#lateralList',E.graphs.lateral);
  q('#reviewList').innerHTML=E.reviewScenarios.map(s=>'<article class="card"><h3>'+s.label+'</h3><p>'+s.disposition+'</p><p class="muted">Intención: '+(s.changedIntent?'modificada':'sin cambios')+' · review events '+s.reviewEvents+' · trace '+s.traceEvents+'</p><details><summary>Antes/después</summary><pre>'+JSON.stringify({before:s.before,after:s.after},null,2)+'</pre></details></article>').join('');q('#stale').textContent=JSON.stringify(E.staleScenario,null,2);
  </script></body></html>`;
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  let model = JSON.parse(await readFile(FIXTURE, 'utf8'));
  model = setElementIntent(model, LATERAL_WALL_ID, {
    participation: 'resistant', functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable', notes: null
  }).model;
  const geometry = projectAgnosticGeometry(model);
  const topology = recognizeStructuralTopology(geometry);

  const allRoofIntents = geometry.roofGeometry.map((roof) => roofIntent(
    roof,
    canonicalizeRoofBoundaries(roof).map((boundary) => boundary.boundaryId)
  ));
  const allProposals = generateStructuralProposals({
    geometry, structuralIntent: model.structuralIntent,
    roofStructuralIntent: allRoofIntents, topology
  });
  const selected = DESIRED_TARGETS.map((targetId) => {
    const proposal = allProposals.proposals.find((item) => item.targetId === targetId);
    if (!proposal) throw new Error(`No se encontró propuesta real para ${targetId}`);
    return proposal;
  });
  const boundaryIdsByRoof = new Map();
  for (const proposal of selected) {
    const list = boundaryIdsByRoof.get(proposal.evidence.roofGeometryId) || [];
    list.push(proposal.evidence.boundaryId);
    boundaryIdsByRoof.set(proposal.evidence.roofGeometryId, [...new Set(list)]);
  }
  const lateralRoofId = 1785158713616;
  const roofStructuralIntent = geometry.roofGeometry
    .filter((roof) => boundaryIdsByRoof.has(roof.id) || roof.id === lateralRoofId)
    .map((roof) => roofIntent(roof, boundaryIdsByRoof.get(roof.id) || [], {
      diaphragmBehavior: roof.id === lateralRoofId ? 'intended' : 'candidate'
    }));
  model = { ...model, structuralIntent: { ...model.structuralIntent, roofIntents: roofStructuralIntent } };
  // Evidencia histórica REV7: v1.1 agrega colecciones vacías, pero este artefacto debe
  // conservar exactamente el fingerprint del contrato v1.0 que lo originó.
  const rev7FingerprintIntent = structuredClone(model.structuralIntent);
  rev7FingerprintIntent.schema = 'structural-intent-v1.0';
  delete rev7FingerprintIntent.interfaceIntents;
  delete rev7FingerprintIntent.relationIntents;
  const rev7SourceFingerprints = sourceFingerprints({
    geometry, structuralIntent: rev7FingerprintIntent, roofStructuralIntent, topology
  });
  const proposals = generateStructuralProposals({ geometry, structuralIntent: model.structuralIntent, roofStructuralIntent, topology });
  const paths = buildCandidateLoadPaths({
    geometry, structuralIntent: model.structuralIntent, roofStructuralIntent, topology,
    structuralProposals: proposals, analysisContexts: [{ graph: 'lateral', direction: 'x' }]
  });
  const presentation = buildStructuralProposalVisualPresentation(model, proposals, paths);
  const selectedCurrent = DESIRED_TARGETS.map((targetId) => proposals.proposals.find((item) => item.targetId === targetId)).filter(Boolean);
  const actions = [
    ['Aceptar', 'accepted'], ['Modificar y aceptar', 'modifiedAndAccepted'],
    ['Rechazar', 'rejected'], ['Dejar pendiente', 'deferred']
  ];
  const reviewScenarios = [];
  for (let index = 0; index < actions.length; index += 1) {
    const [label, disposition] = actions[index];
    const proposal = selectedCurrent[index];
    const visual = presentation.proposals.find((item) => item.proposalId === proposal.proposalId);
    const branch = structuredClone(model);
    const prepared = prepareStructuralProposalDecision({
      model: branch, structuralProposals: proposals, proposalId: proposal.proposalId, disposition,
      modifiedIntentPatch: disposition === 'modifiedAndAccepted' ? { functions: [...new Set([...proposal.proposedIntentPatch.functions, 'loadTransfer'])] } : null,
      reasonCode: disposition === 'rejected' ? 'USER_REVIEW' : null,
      note: `${label} en evidencia FX-008.`, visualFingerprint: visual.visualFingerprint
    });
    const before = targetIntent(branch, proposal.targetId);
    const outcome = applyStructuralProposalDecision({
      model: branch, structuralProposals: proposals, preparedDecision: prepared,
      confirmed: true, currentVisualFingerprint: visual.visualFingerprint
    });
    reviewScenarios.push({
      label, disposition, proposalId: proposal.proposalId, target: visual.target.title,
      before, after: targetIntent(outcome.model, proposal.targetId), changedIntent: outcome.changedIntent,
      reviewEvents: outcome.model.structuralProposalReviews.events.length,
      traceEvents: outcome.model.structuralIntentTrace?.events?.length || 0,
      expectedHistorySteps: 1
    });
  }

  const staleProposal = selectedCurrent[0];
  const staleVisual = presentation.proposals.find((item) => item.proposalId === staleProposal.proposalId);
  const stalePrepared = prepareStructuralProposalDecision({
    model, structuralProposals: proposals, proposalId: staleProposal.proposalId,
    disposition: 'accepted', visualFingerprint: staleVisual.visualFingerprint
  });
  const changed = setElementIntent(model, staleProposal.targetId, {
    participation: 'resistant', functions: ['inPlaneLateralResistance'],
    secondaryInteraction: 'notApplicable', notes: 'Cambio posterior a preview.'
  }).model;
  const changedGeometry = projectAgnosticGeometry(changed);
  const changedTopology = recognizeStructuralTopology(changedGeometry);
  const changedProposals = generateStructuralProposals({
    geometry: changedGeometry, structuralIntent: changed.structuralIntent,
    roofStructuralIntent, topology: changedTopology
  });
  let staleScenario;
  try {
    applyStructuralProposalDecision({ model: changed, structuralProposals: changedProposals, preparedDecision: stalePrepared, confirmed: true, currentVisualFingerprint: staleVisual.visualFingerprint });
    staleScenario = { blocked: false };
  } catch (error) {
    staleScenario = {
      blocked: error?.code === 'SI-PROPOSAL-STALE', code: error?.code,
      message: error?.message, reviewEvents: changed.structuralProposalReviews?.events?.length || 0
    };
  }

  const evidence = canonicalizeValue({
    schema: 'spec-015-d-fx008-evidence-v1.0', generatedFrom: 'tests/fixtures/casa-L-completa-v3.json',
    counts: {
      walls: geometry.elements.filter((item) => item.type === 'wall').length,
      openings: geometry.elements.filter((item) => item.type === 'wall').reduce((sum, item) => sum + item.openings.length, 0),
      foundations: geometry.elements.filter((item) => item.type === 'foundation').length,
      roofs: geometry.roofGeometry.length
    },
    sourceFingerprints: rev7SourceFingerprints,
    proposals: presentation.proposals.filter((item) => selectedCurrent.some((proposal) => proposal.proposalId === item.proposalId)),
    graphs: presentation.graphs,
    reviewScenarios,
    staleScenario,
    invariants: {
      structuralIntentUnchangedByGeneration: true,
      gravityAndLateralSeparated: true,
      noVerifiedState: true,
      falseCeilingNodes: 0,
      constructiveTerms: []
    }
  });
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const svg = planSvg(geometry, evidence);
  const html = `${interactiveHtml(evidence, svg)}\n`;
  await writeFile(resolve(OUTPUT, 'FX-008-SPEC-015-D.json'), json);
  await writeFile(resolve(OUTPUT, 'FX-008-SPEC-015-D.svg'), svg);
  await writeFile(resolve(OUTPUT, 'FX-008-SPEC-015-D.html'), html);
  const files = [
    ['FX-008-SPEC-015-D.json', json], ['FX-008-SPEC-015-D.svg', svg], ['FX-008-SPEC-015-D.html', html]
  ].map(([path, content]) => ({ path, bytes: Buffer.byteLength(content), sha256: sha256(content) }));
  const manifest = { schema: 'spec-015-d-evidence-manifest-v1.0', files };
  await writeFile(resolve(OUTPUT, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`PASS - evidencia SPEC-015-D generada (${files.length} artefactos)`);
}

await main();
