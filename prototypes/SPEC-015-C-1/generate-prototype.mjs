import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectAgnosticGeometry } from '../../src/core/agnosticGeometry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const fixturePath = resolve(ROOT, 'tests/fixtures/casa-L-completa-v3.json');
const model = JSON.parse(await readFile(fixturePath, 'utf8'));
const geometry = projectAgnosticGeometry(model);

const TARGET_ID = 1784605101040;
const BATCH_IDS = [1784751397992, 1784752583321, 1784752639636];
const TOL = 0.1;

function token(value) { return `${typeof value}:${String(value)}`; }
function byId(left, right) { return token(left.id).localeCompare(token(right.id)); }
function axisMap(items, positionKey) {
  return items.map((item) => ({ id: item.id, label: item.label ?? String(item.id), position: item[positionKey] ?? item.position }));
}
const axes = {
  x: axisMap(model.grid.xAxes, 'position'),
  y: axisMap(model.grid.yAxes, 'position'),
  z: model.grid.zLevels.map((item) => ({ id: item.id, label: item.label ?? String(item.id), elevation: item.elevation }))
};

function exactAxisLabel(axis, coordinate) {
  const match = axes[axis].find((item) => Math.abs(item.position - coordinate) <= TOL);
  return match ? match.label : null;
}
function exactLevelLabel(z) {
  const match = axes.z.find((item) => Math.abs(item.elevation - z) <= TOL);
  return match ? match.label : null;
}
function mm(value, digits = 0) {
  return Number(value).toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function prismBounds(prism) {
  if (prism.kind === 'axis-aligned-prism') {
    return { x0: prism.min.x, x1: prism.max.x, y0: prism.min.y, y1: prism.max.y, z0: prism.min.z, z1: prism.max.z };
  }
  const half = Number(prism.thickness ?? prism.width ?? 0) / 2;
  const z0 = prism.start.z;
  const z1 = z0 + prism.height;
  return {
    x0: Math.min(prism.start.x, prism.end.x) - half,
    x1: Math.max(prism.start.x, prism.end.x) + half,
    y0: Math.min(prism.start.y, prism.end.y) - half,
    y1: Math.max(prism.start.y, prism.end.y) + half,
    z0, z1
  };
}
function elementBounds(element) {
  if (element.type === 'foundation') {
    const bounds = element.solids.map((solid) => prismBounds(solid.prism));
    return unionBounds(bounds);
  }
  return prismBounds(element.prism);
}
function unionBounds(bounds) {
  return {
    x0: Math.min(...bounds.map((b) => b.x0)), x1: Math.max(...bounds.map((b) => b.x1)),
    y0: Math.min(...bounds.map((b) => b.y0)), y1: Math.max(...bounds.map((b) => b.y1)),
    z0: Math.min(...bounds.map((b) => b.z0)), z1: Math.max(...bounds.map((b) => b.z1))
  };
}
function boundsDistance(a, b) {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
  return Math.hypot(dx, dy);
}
function zTouches(a, b) {
  return Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) >= -TOL;
}
function contextualNeighbors(ids, limit = 24) {
  const selected = geometry.elements.filter((element) => ids.includes(element.id));
  const selectedBounds = unionBounds(selected.map(elementBounds));
  const span = Math.max(selectedBounds.x1 - selectedBounds.x0, selectedBounds.y1 - selectedBounds.y0);
  const contextDistance = Math.max(1200, 0.15 * span);
  return geometry.elements
    .filter((element) => element.type === 'wall' && !ids.includes(element.id))
    .map((element) => ({ element, distance: boundsDistance(selectedBounds, elementBounds(element)) }))
    .filter(({ element, distance }) => distance <= contextDistance && zTouches(selectedBounds, elementBounds(element)))
    .sort((a, b) => a.distance - b.distance || byId(a.element, b.element))
    .slice(0, limit)
    .map(({ element, distance }) => ({ id: element.id, distance: Number(distance.toFixed(3)) }));
}
function descriptor(element) {
  if (element.type === 'wall') {
    const p = element.prism;
    const runAxis = Math.abs(p.end.x - p.start.x) >= Math.abs(p.end.y - p.start.y) ? 'x' : 'y';
    const fixedAxis = runAxis === 'x' ? 'y' : 'x';
    const s0 = Math.min(p.start[runAxis], p.end[runAxis]);
    const s1 = Math.max(p.start[runAxis], p.end[runAxis]);
    const fixed = p.start[fixedAxis];
    const startLabel = exactAxisLabel(runAxis, s0);
    const endLabel = exactAxisLabel(runAxis, s1);
    const fixedLabel = exactAxisLabel(fixedAxis, fixed);
    const z0 = p.start.z;
    const z1 = z0 + p.height;
    const level0 = exactLevelLabel(z0);
    const level1 = exactLevelLabel(z1);
    const orientation = runAxis.toUpperCase();
    const axisText = `${startLabel ?? `${orientation}=${mm(s0)}`}→${endLabel ?? `${orientation}=${mm(s1)}`} @ ${fixedLabel ?? `${fixedAxis.toUpperCase()}=${mm(fixed)}`}`;
    const levelText = `${level0 ?? `z=${mm(z0)}`}→${level1 ?? `z=${mm(z1)}`}`;
    return {
      id: element.id,
      type: 'wall',
      typeLabel: 'Muro',
      runAxis,
      orientation,
      axisText,
      levelText,
      summary: `Muro ${orientation} · ${axisText} · ${levelText}`,
      coordinates: `${orientation} · ${fixedAxis}=${mm(fixed)} · ${runAxis}=${mm(s0)}→${mm(s1)} · z=${mm(z0)}→${mm(z1)}`,
      dimensions: `L ${mm(s1 - s0)} mm · e ${mm(p.thickness, 1)} mm · h ${mm(p.height)} mm`,
      openings: element.openings.length,
      openingLabel: `${element.openings.length} vano${element.openings.length === 1 ? '' : 's'}`
    };
  }
  if (element.type === 'foundation') {
    const b = elementBounds(element);
    return {
      id: element.id,
      type: 'foundation',
      typeLabel: 'Fundación',
      summary: `Fundación ${element.kind ?? ''}`.trim(),
      coordinates: `x=${mm(b.x0)}→${mm(b.x1)} · y=${mm(b.y0)}→${mm(b.y1)} · z=${mm(b.z0)}→${mm(b.z1)}`,
      dimensions: `${element.solids.length} sólidos`, openings: 0, openingLabel: 'Sin vanos'
    };
  }
  const b = elementBounds(element);
  return {
    id: element.id, type: element.type, typeLabel: element.type,
    summary: `${element.type} ${element.id}`,
    coordinates: `x=${mm(b.x0)}→${mm(b.x1)} · y=${mm(b.y0)}→${mm(b.y1)} · z=${mm(b.z0)}→${mm(b.z1)}`,
    dimensions: '', openings: 0, openingLabel: 'Sin vanos'
  };
}

const walls = geometry.elements.filter((element) => element.type === 'wall').sort(byId);
const foundations = geometry.elements.filter((element) => element.type === 'foundation').sort(byId);
const target = walls.find((element) => element.id === TARGET_ID);
const batch = BATCH_IDS.map((id) => walls.find((element) => element.id === id));
const individualNeighbors = contextualNeighbors([TARGET_ID]);
const batchNeighbors = contextualNeighbors(BATCH_IDS);
const authoritySnapshot = {
  schema: geometry.schema,
  geometry,
  structuralIntent: model.structuralIntent,
  structuralIntentTrace: model.structuralIntentTrace ?? null
};
const authoritySerialized = JSON.stringify(authoritySnapshot);
const authoritySha256 = createHash('sha256').update(authoritySerialized).digest('hex');
const zeroEffectEvents = [
  `navigation:individual`,
  `hover:${TARGET_ID}`,
  `activate-local:${TARGET_ID}`,
  `batch-toggle:${BATCH_IDS[0]}`,
  `zoom:in`,
  `zoom:out`,
  `locate-open:${TARGET_ID}`,
  `locate-fit`,
  `locate-close:restore`
];
const isolatedUiState = {
  panel: 'baseline', hoveredId: null, activeId: null, selectedIds: new Set(),
  zoom: 1, locatorOpen: false, historyEntries: 0, traceEntries: 0, authorityMutations: 0
};
const beforeAudit = {
  authoritySha256: createHash('sha256').update(JSON.stringify(authoritySnapshot)).digest('hex'),
  historyEntries: isolatedUiState.historyEntries,
  traceEntries: isolatedUiState.traceEntries,
  authorityMutations: isolatedUiState.authorityMutations
};
for (const event of zeroEffectEvents) {
  const [kind, value] = event.split(':');
  if (kind === 'navigation') isolatedUiState.panel = value;
  if (kind === 'hover') isolatedUiState.hoveredId = Number(value);
  if (kind === 'activate-local') isolatedUiState.activeId = Number(value);
  if (kind === 'batch-toggle') isolatedUiState.selectedIds.add(Number(value));
  if (kind === 'zoom') isolatedUiState.zoom *= value === 'in' ? 1.2 : 1 / 1.2;
  if (kind === 'locate-open') isolatedUiState.locatorOpen = true;
  if (kind === 'locate-close') isolatedUiState.locatorOpen = false;
}
const afterAudit = {
  authoritySha256: createHash('sha256').update(JSON.stringify(authoritySnapshot)).digest('hex'),
  historyEntries: isolatedUiState.historyEntries,
  traceEntries: isolatedUiState.traceEntries,
  authorityMutations: isolatedUiState.authorityMutations
};
const zeroEffectsAudit = {
  operations: zeroEffectEvents,
  before: beforeAudit,
  after: afterAudit,
  pass: JSON.stringify(beforeAudit) === JSON.stringify(afterAudit)
    && afterAudit.historyEntries === 0
    && afterAudit.traceEntries === 0
    && afterAudit.authorityMutations === 0,
  note: 'Las operaciones se ejecutaron sobre estado UI aislado; no invocaron mutadores de autoridad ni withHistory.'
};

const data = {
  prototype: 'SPEC-015-C-1-phase-a',
  sourceFixture: 'tests/fixtures/casa-L-completa-v3.json',
  geometrySha256: createHash('sha256').update(`${JSON.stringify(geometry, null, 2)}\n`).digest('hex'),
  authoritySha256,
  zeroEffectsAudit,
  counts: {
    elements: geometry.elements.length,
    walls: walls.length,
    openings: walls.flatMap((wall) => wall.openings).length,
    foundations: foundations.length,
    roofs: geometry.roofGeometry.length
  },
  axes,
  targetId: TARGET_ID,
  batchIds: BATCH_IDS,
  individualNeighbors,
  batchNeighbors,
  descriptors: Object.fromEntries(geometry.elements.map((element) => [String(element.id), descriptor(element)])),
  walls,
  foundations,
  target,
  batch,
  sourceContracts: {
    workspace: 'src/core/structuralIntentWorkspace.js',
    component: 'src/components/modals/StructuralIntentWorkspaceDialog.jsx',
    store: 'src/store/useModelStore.js',
    viewport: 'src/components/Canvas.jsx',
    viewer3d: 'src/components/Viewer3D.jsx'
  }
};

await writeFile(resolve(HERE, 'FX-008-SPEC-015-C-1-data.json'), `${JSON.stringify(data, null, 2)}\n`);

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPEC-015-C-1 · Fase A · FX-008</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d2421;background:#edf0eb;--green:#24584c;--green2:#dceae5;--ink:#1d2421;--muted:#66706b;--border:#cfd5cf;--paper:#fff;--amber:#8a5a00;--red:#9f2d20}*{box-sizing:border-box}body{margin:0}.hero{padding:28px clamp(18px,5vw,72px);background:#173d35;color:white}.hero h1{margin:.25rem 0;font-size:clamp(1.9rem,4vw,3.4rem)}.hero p{max-width:980px;margin:.35rem 0}.phase{display:inline-flex;gap:8px;align-items:center;border:1px solid #ffffff55;border-radius:999px;padding:4px 10px;font-size:.8rem}.warning{padding:10px clamp(18px,5vw,72px);background:#fff2cb;color:#5b4300;font-weight:700}.shell{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px;padding:20px clamp(14px,4vw,52px) 42px}.card{background:var(--paper);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 28px #18231d10}.side{padding:12px;height:max-content;position:sticky;top:12px}.navbtn{width:100%;display:flex;gap:10px;align-items:center;text-align:left;border:0;background:transparent;border-radius:10px;padding:10px;color:var(--ink);cursor:pointer}.navbtn:hover,.navbtn:focus-visible{background:#eef3ef;outline:2px solid transparent}.navbtn.active{background:var(--green2);font-weight:800}.navnum{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;border:1px solid #8da69d}.main{min-width:0}.panel{display:none}.panel.active{display:block}.pad{padding:18px}.metrics{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:10px}.metric{padding:14px}.metric strong{font-size:1.7rem;display:block}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid3{display:grid;grid-template-columns:1fr 1.1fr .9fr;gap:14px}.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.btn{border:1px solid #aeb7b1;background:white;border-radius:8px;padding:7px 10px;cursor:pointer;color:var(--ink)}.btn:hover,.btn:focus-visible{background:#edf4f1;outline:3px solid #78a99a55}.btn.primary{background:var(--green);color:white;border-color:var(--green)}.btn[disabled]{opacity:.45;cursor:not-allowed}.badge{display:inline-flex;align-items:center;gap:5px;border:1px solid #aeb7b1;border-radius:999px;padding:3px 8px;font-size:.78rem}.badge.ok{border-color:#5e9b82;color:#176347;background:#ecf7f1}.badge.warn{border-color:#d4ad55;color:#725000;background:#fff8df}.tablewrap{overflow:auto;max-height:420px;border:1px solid var(--border);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:.84rem}th,td{padding:8px;border-bottom:1px solid #e5e8e4;text-align:left}th{position:sticky;top:0;background:#f7f8f5;z-index:1}.rowbtn{border:0;background:transparent;text-align:left;width:100%;cursor:pointer;padding:0;color:inherit}.row-active{background:#e8f2ee}.row-selected td:first-child{box-shadow:inset 4px 0 0 var(--green)}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem}.preview{min-height:470px;display:flex;flex-direction:column;overflow:hidden}.previewhead{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:center}.svgwrap{position:relative;flex:1;min-height:370px;background:#fbfcfa}.svgwrap svg{width:100%;height:100%;min-height:370px;display:block}.wall{stroke:#aeb7b1;stroke-linecap:square;fill:none}.wall.context{stroke:#aeb7b1}.wall.target{stroke:#153f35;filter:url(#shadow)}.wall.batch{stroke:#24584c}.wall.hovered{stroke:#b46200;stroke-dasharray:12 7}.opening{stroke:#fff;stroke-linecap:butt}.opening-edge{stroke:#525f59}.marker{font-size:270px;font-weight:900;paint-order:stroke;stroke:#fff;stroke-width:70px;fill:#173d35}.axisline{stroke:#d6dbd6;stroke-width:18;stroke-dasharray:55 55}.axislabel{font-size:210px;fill:#6d7772}.target-hit{stroke:transparent;fill:none;cursor:pointer}.target-hit:focus{outline:none;stroke:#b46200;stroke-width:220}.descriptor{padding:14px}.descriptor h3{margin:.2rem 0}.muted{color:var(--muted)}.small{font-size:.82rem}.callout{border-left:4px solid var(--green);padding:10px 12px;background:#edf5f1}.callout.warn{border-color:#c98d18;background:#fff8e7}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:12px}.actual{border:2px solid #b8beb9}.proposed{border:2px solid #5b917f}.minirow{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;border-bottom:1px solid #e4e8e4;padding:8px}.mini-preview{height:94px;border:1px solid #d6dbd6;border-radius:8px;background:#fafbf9}.statebox{padding:12px}.auditlog{max-height:260px;overflow:auto;background:#17221e;color:#d9eee5;border-radius:10px;padding:12px;font:12px ui-monospace,monospace}.counter{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.counter div{padding:10px;border:1px solid var(--border);border-radius:9px}.counter strong{font-size:1.6rem;display:block}.locate-overlay{position:fixed;inset:0;z-index:50;background:#e7ebe7;display:none;grid-template-rows:auto 1fr}.locate-overlay.open{display:grid}.locatebar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 16px;background:#173d35;color:white}.locateview{position:relative;min-height:0}.locateview svg{width:100%;height:100%;display:block;background:#f8faf7}.toast{position:absolute;right:16px;bottom:16px;max-width:420px;background:white;border:1px solid var(--border);border-radius:12px;padding:12px;box-shadow:0 10px 30px #0002}.kbd{font:12px ui-monospace,monospace;border:1px solid #aeb7b1;border-bottom-width:2px;border-radius:5px;padding:1px 5px;background:#fff}.hidden{display:none!important}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1050px){.shell{grid-template-columns:1fr}.side{position:static}.grid3,.grid2,.comparison{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<header class="hero"><span class="phase">Fase A · prototipo aislado · FX-008 real</span><h1>SPEC-015-C-1 — Identificación visual</h1><p>Contrato macro → micro para reconocer muros y elementos antes de declarar intención. No activa propuestas, caminos de carga ni topología.</p></header>
<div class="warning">Este archivo es evidencia de diseño. No modifica el producto, el modelo, el historial ni structural-intent-trace-v1.0.</div>
<div class="shell">
<aside class="card side" aria-label="Recorrido de la Fase A">
<button class="navbtn active" data-panel="baseline"><span class="navnum">1</span>Base y BUG</button>
<button class="navbtn" data-panel="individual"><span class="navnum">2</span>Preview individual</button>
<button class="navbtn" data-panel="batch"><span class="navnum">3</span>Preview de lote</button>
<button class="navbtn" data-panel="locator"><span class="navnum">4</span>Localización temporal</button>
<button class="navbtn" data-panel="states"><span class="navnum">5</span>Borrador y stale</button>
<button class="navbtn" data-panel="audit"><span class="navnum">6</span>Auditoría cero efectos</button>
</aside>
<main class="main">
<section id="panel-baseline" class="panel active">
<div class="metrics">
${Object.entries(data.counts).map(([key,value])=>`<div class="card metric"><span class="muted">${key}</span><strong>${value}</strong></div>`).join('')}
</div>
<div class="card pad" style="margin-top:14px"><h2>Reproducción de BUG-015-C-001</h2><div class="comparison">
<div class="actual pad"><span class="badge warn">Estado vigente</span><h3>Fila sin identidad geométrica</h3><div class="minirow"><input type="checkbox" aria-label="Selección ilustrativa"><code>1784605101040</code><button class="btn">Editar</button></div><p class="small muted">La fila real sólo aporta selección, ID, tipo, estado y acción. El usuario debe memorizar IDs.</p></div>
<div class="proposed pad"><span class="badge ok">Contrato C-1</span><h3>Descriptor + mini preview + localizar</h3><div class="minirow"><span class="badge">Muro X</span><div><strong>7→11A @ C</strong><div class="small muted">NPT→FRONTON GENERAL · 8.700 mm · 3 vanos</div></div><button class="btn primary" data-jump="individual">Ver</button></div><p class="small muted">El ID se conserva, pero deja de ser el único medio de reconocimiento.</p></div>
</div><div class="callout warn" style="margin-top:14px"><strong>Diferencia contractual:</strong> Techumbre ya dispone de polígono y bordes B1…Bn; Muros y elementos no tiene una proyección equivalente.</div></div>
</section>
<section id="panel-individual" class="panel">
<div class="grid3">
<div class="card pad"><h2>Lista sincronizada</h2><p class="small muted">Foco, hover y activación mueven la identidad local. No escriben model.selectedElementId.</p><div id="individual-list" class="tablewrap"></div></div>
<div class="card preview"><div class="previewhead"><div><strong>Planta contextual</strong><div class="small muted">Vecinos visuales, no relaciones estructurales</div></div><div class="toolbar"><button class="btn" data-zoom="out" aria-label="Alejar preview">−</button><button class="btn" data-zoom="fit" aria-label="Ajustar preview">⌂</button><button class="btn" data-zoom="in" aria-label="Acercar preview">+</button></div></div><div id="individual-svg" class="svgwrap"></div></div>
<div class="card descriptor" id="individual-descriptor"></div>
</div>
<div class="grid2" style="margin-top:14px"><div class="card pad"><h2>Elevación del objetivo</h2><div id="elevation-svg" class="svgwrap"></div></div><div class="card pad"><h2>Reglas visibles</h2><ul><li>El objetivo usa doble señal: trazo + etiqueta T.</li><li>Los vanos se representan como vacíos con borde.</li><li>Los ejes nominales se muestran sólo con coincidencia exacta ±0,1 mm.</li><li>Siempre se conservan coordenadas numéricas como respaldo.</li></ul><button class="btn primary" id="locate-individual">Localizar en modelo</button></div></div>
</section>
<section id="panel-batch" class="panel">
<div class="grid2"><div class="card pad"><h2>Lote FX-008</h2><p class="small muted">La selección de lote y el objetivo activo son estados distintos.</p><div id="batch-list" class="tablewrap"></div><div class="toolbar" style="margin-top:12px"><button class="btn" id="batch-all">Seleccionar los 3</button><button class="btn" id="batch-clear">Limpiar</button><button class="btn primary" id="locate-batch">Localizar lote</button></div></div><div class="card preview"><div class="previewhead"><div><strong>Planta de lote</strong><div class="small muted">S1…Sn identifican cada integrante; no se fusionan.</div></div><span id="batch-count" class="badge"></span></div><div id="batch-svg" class="svgwrap"></div></div></div>
<div class="card pad" style="margin-top:14px"><h2>Resumen del lote</h2><div id="batch-summary"></div></div>
</section>
<section id="panel-locator" class="panel"><div class="card pad"><h2>Frontera con el viewport principal</h2><div class="grid2"><div><ol><li>Se toma snapshot de vista y selección global.</li><li>El diálogo se compacta, pero el borrador permanece montado.</li><li>Un overlay transitorio resalta IDs locales.</li><li>Pan, zoom, hover y cambio de objetivo local no usan withHistory.</li><li>Al volver se restaura la vista, salvo “Conservar vista”.</li></ol><button class="btn primary" id="open-locator-demo">Abrir demostración</button></div><div class="callout"><strong>Prohibición:</strong> el localizador no escribe <code>model.selectedElementId</code>, no abre PropertiesPanel y no amplía la selección global en silencio.</div></div></div></section>
<section id="panel-states" class="panel"><div class="grid2"><div class="card statebox"><span class="badge ok">Borrador limpio</span><h3>Geometría e intención vigentes</h3><p>Preview y Guardar están habilitados.</p></div><div class="card statebox"><span class="badge warn">Borrador sucio</span><h3>Localizar permitido; cambiar objetivo bloqueado</h3><p>Hover no reemplaza el objetivo. Activar otro ID exige guardar o descartar.</p></div><div class="card statebox"><span class="badge warn">Preview stale</span><h3>Fingerprint geométrico cambió</h3><p>Guardar, lote y localizar quedan bloqueados hasta recargar. Si la intención no cambió, se preservan los campos del borrador.</p></div><div class="card statebox"><span class="badge warn">Referencia rota</span><h3>El objetivo dejó de existir</h3><p>Se muestra el último descriptor conocido; no se sustituye por un elemento “parecido”.</p></div></div><div class="card pad" style="margin-top:14px"><h2>Accesibilidad y teclado</h2><p><span class="kbd">↑</span>/<span class="kbd">↓</span> recorre filas · <span class="kbd">Enter</span> activa · <span class="kbd">Espacio</span> alterna lote · <span class="kbd">L</span> localiza · <span class="kbd">+</span>/<span class="kbd">−</span> zoom · <span class="kbd">0</span> ajustar · <span class="kbd">Esc</span> vuelve/cancela. Las mismas acciones existen como botones.</p></div></section>
<section id="panel-audit" class="panel"><div class="card pad"><h2>Demostración de cero historial y cero trace</h2><p>La prueba automática ejecuta navegación, hover, activación local, selección de lote, zoom y entrada/salida de localización sobre el estado aislado.</p><div class="counter"><div><span>Historial</span><strong id="history-count">0</strong></div><div><span>Trace</span><strong id="trace-count">0</strong></div><div><span>Mutaciones autoridad</span><strong id="authority-count">0</strong></div></div><div class="toolbar" style="margin:12px 0"><button class="btn primary" id="run-audit">Ejecutar prueba automática</button><span id="audit-result" class="badge">Sin ejecutar</span></div><div id="audit-log" class="auditlog" aria-live="polite"></div><p class="small muted">SHA-256 de autoridad aislada: <code>${authoritySha256}</code></p></div></section>
</main></div>
<div id="locate-overlay" class="locate-overlay" role="dialog" aria-modal="true" aria-labelledby="locate-title"><div class="locatebar"><div><strong id="locate-title">Localización temporal</strong><span id="locate-target-label" class="small"></span></div><div class="toolbar"><button class="btn" id="locator-fit">Ajustar</button><button class="btn" id="locator-keep">Conservar vista y volver</button><button class="btn primary" id="locator-back">Restaurar vista y volver</button></div></div><div id="locator-svg" class="locateview"></div></div>
<script type="application/json" id="prototype-data">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>
<script>
const DATA=JSON.parse(document.getElementById('prototype-data').textContent);
const initialAuthority='${authoritySha256}';
const state={panel:'baseline',activeId:DATA.targetId,hoverId:null,batch:new Set(DATA.batchIds),zoom:1,locateIds:[],locateOpen:false,history:0,trace:0,authorityMutations:0,uiEvents:[]};
const D=id=>DATA.descriptors[String(id)];
function log(event){state.uiEvents.push(event); if(state.uiEvents.length>80)state.uiEvents.shift();}
function setPanel(name){state.panel=name;document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));log('navegación:'+name)}
document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.jump)));
function boundsFor(ids,neighborIds=[]){const all=[...ids,...neighborIds].map(id=>DATA.walls.find(w=>w.id===id)).filter(Boolean);const pts=all.flatMap(w=>[w.prism.start,w.prism.end]);let x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y));const span=Math.max(x1-x0,y1-y0,1000),m=Math.max(700,span*.08);return{x0:x0-m,x1:x1+m,y0:y0-m,y1:y1+m};}
function wallOpeningsSvg(w,sw){return (w.openings||[]).map(o=>{const p=o.void;return '<line class="opening" x1="'+p.start.x+'" y1="'+p.start.y+'" x2="'+p.end.x+'" y2="'+p.end.y+'" stroke-width="'+(sw*1.25)+'"/><line class="opening-edge" x1="'+p.start.x+'" y1="'+p.start.y+'" x2="'+p.end.x+'" y2="'+p.end.y+'" stroke-width="'+Math.max(12,sw*.14)+'" stroke-dasharray="35 25"/>';}).join('')}
function planSvg({ids,neighbors=[],all=false,labels='T'}){const targetSet=new Set(ids),neighborSet=new Set(neighbors);const visible=all?DATA.walls:DATA.walls.filter(w=>targetSet.has(w.id)||neighborSet.has(w.id));const b=all?boundsFor(DATA.walls.map(w=>w.id)):boundsFor(ids,neighbors);const width=b.x1-b.x0,height=b.y1-b.y0;const stroke=Math.max(55,Math.min(width,height)*.012);const grid=DATA.axes.x.filter(a=>a.position>=b.x0&&a.position<=b.x1).map(a=>'<line class="axisline" x1="'+a.position+'" y1="'+b.y0+'" x2="'+a.position+'" y2="'+b.y1+'"/><text class="axislabel" x="'+a.position+'" y="'+(b.y0+260)+'" text-anchor="middle">'+a.label+'</text>').join('')+DATA.axes.y.filter(a=>a.position>=b.y0&&a.position<=b.y1).map(a=>'<line class="axisline" x1="'+b.x0+'" y1="'+a.position+'" x2="'+b.x1+'" y2="'+a.position+'"/><text class="axislabel" x="'+(b.x0+240)+'" y="'+(a.position-60)+'">'+a.label+'</text>').join('');let body=visible.map(w=>{const selected=targetSet.has(w.id),hover=state.hoverId===w.id;const cls='wall '+(selected?(ids.length>1?'batch':'target'):'context')+(hover?' hovered':'');const sw=selected?stroke*1.9:stroke;const hit=Math.max(sw*2.2,260);return '<g data-wall="'+w.id+'"><line class="'+cls+'" x1="'+w.prism.start.x+'" y1="'+w.prism.start.y+'" x2="'+w.prism.end.x+'" y2="'+w.prism.end.y+'" stroke-width="'+sw+'"/>'+wallOpeningsSvg(w,sw)+(selected?'<text class="marker" x="'+((w.prism.start.x+w.prism.end.x)/2)+'" y="'+(((w.prism.start.y+w.prism.end.y)/2)-180)+'" text-anchor="middle">'+(ids.length>1?labels+(ids.indexOf(w.id)+1):labels)+'</text>':'')+'<line tabindex="0" role="button" aria-label="'+D(w.id).summary+'" class="target-hit" x1="'+w.prism.start.x+'" y1="'+w.prism.start.y+'" x2="'+w.prism.end.x+'" y2="'+w.prism.end.y+'" stroke-width="'+hit+'" data-hit="'+w.id+'"/></g>'}).join('');return '<svg viewBox="'+b.x0+' '+b.y0+' '+width+' '+height+'" preserveAspectRatio="xMidYMid meet" aria-label="Planta geométrica real FX-008"><defs><filter id="shadow"><feDropShadow dx="0" dy="0" stdDeviation="70" flood-color="#24584c" flood-opacity=".35"/></filter></defs><g transform="translate(0 '+(b.y0+b.y1)+') scale(1 -1)">'+grid+body+'</g></svg>'}
function wireSvg(root,mode){root.querySelectorAll('[data-hit]').forEach(hit=>{const id=Number(hit.dataset.hit);const enter=()=>{state.hoverId=id;log('hover:'+id);renderAll()};const leave=()=>{state.hoverId=null;renderAll()};hit.addEventListener('mouseenter',enter);hit.addEventListener('mouseleave',leave);hit.addEventListener('focus',enter);hit.addEventListener('blur',leave);hit.addEventListener('click',()=>activateFromPreview(id,mode));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activateFromPreview(id,mode)}})})}
function activateFromPreview(id,mode){if(mode==='batch'){if(state.batch.has(id))state.batch.delete(id);else if(DATA.batchIds.includes(id))state.batch.add(id);state.activeId=id;log('selección-preview:'+id)}else{state.activeId=id;log('activación-preview:'+id)}renderAll()}
function renderIndividual(){const rows=[DATA.targetId,...DATA.individualNeighbors.map(n=>n.id)];document.getElementById('individual-list').innerHTML='<table><thead><tr><th>Objetivo</th><th>Descriptor</th><th>Vanos</th></tr></thead><tbody>'+rows.map((id,i)=>'<tr class="'+(state.activeId===id?'row-active ':'')+(id===DATA.targetId?'row-selected':'')+'"><td>'+(id===DATA.targetId?'T':'Contexto')+'</td><td><button class="rowbtn" data-row="'+id+'"><strong>'+D(id).summary+'</strong><div><code>'+id+'</code></div></button></td><td>'+D(id).openings+'</td></tr>').join('')+'</tbody></table>';document.querySelectorAll('[data-row]').forEach(b=>b.addEventListener('click',()=>{state.activeId=Number(b.dataset.row);log('activación-lista:'+state.activeId);renderAll()}));const root=document.getElementById('individual-svg');root.innerHTML=planSvg({ids:[DATA.targetId],neighbors:DATA.individualNeighbors.map(n=>n.id)});wireSvg(root,'individual');const d=D(state.activeId);document.getElementById('individual-descriptor').innerHTML='<span class="badge '+(state.activeId===DATA.targetId?'ok':'')+'">'+(state.activeId===DATA.targetId?'Objetivo T':'Contexto cercano')+'</span><h3>'+d.summary+'</h3><p><code>'+d.id+'</code></p><p>'+d.coordinates+'</p><p>'+d.dimensions+'</p><p>'+d.openingLabel+'</p><div class="callout"><strong>Semántica:</strong> “cercano” describe encuadre visual, no contacto, apoyo, continuidad ni función estructural.</div>';renderElevation()}
function renderElevation(){const w=DATA.target,b={x0:0,x1:Math.hypot(w.prism.end.x-w.prism.start.x,w.prism.end.y-w.prism.start.y),y0:w.prism.start.z,y1:w.prism.start.z+w.prism.height};const m=500,W=b.x1+2*m,H=(b.y1-b.y0)+2*m;const startCoord=Math.min(w.prism.start.x,w.prism.end.x,w.prism.start.y,w.prism.end.y);const run=Math.abs(w.prism.end.x-w.prism.start.x)>=Math.abs(w.prism.end.y-w.prism.start.y)?'x':'y';const openings=w.openings.map(o=>{const p=o.void;const s0=Math.min(p.start[run],p.end[run])-startCoord;const s1=Math.max(p.start[run],p.end[run])-startCoord;return '<rect x="'+(m+s0)+'" y="'+(m+(p.start.z-b.y0))+'" width="'+(s1-s0)+'" height="'+p.height+'" fill="#fff" stroke="#9f2d20" stroke-width="35"/><text x="'+(m+(s0+s1)/2)+'" y="'+(m+(p.start.z-b.y0)+p.height/2)+'" text-anchor="middle" font-size="180">'+o.kind+'</text>'}).join('');document.getElementById('elevation-svg').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" aria-label="Elevación real del muro '+w.id+'"><g transform="translate(0 '+H+') scale(1 -1)"><rect x="'+m+'" y="'+m+'" width="'+b.x1+'" height="'+(b.y1-b.y0)+'" fill="#dceae5" stroke="#173d35" stroke-width="55"/>'+openings+'</g><text x="'+(W/2)+'" y="'+(H-80)+'" text-anchor="middle" font-size="190">'+D(w.id).axisText+' · '+D(w.id).levelText+'</text></svg>'}
function renderBatch(){const ids=[...state.batch];document.getElementById('batch-list').innerHTML='<table><thead><tr><th>Sel.</th><th>Elemento</th><th>Descriptor</th></tr></thead><tbody>'+DATA.batchIds.map((id,i)=>'<tr class="'+(state.activeId===id?'row-active ':'')+(state.batch.has(id)?'row-selected':'')+'"><td><input data-check="'+id+'" type="checkbox" '+(state.batch.has(id)?'checked':'')+' aria-label="Seleccionar '+id+'"></td><td>S'+(i+1)+'<br><code>'+id+'</code></td><td><button class="rowbtn" data-batch-row="'+id+'">'+D(id).summary+'<div class="small muted">'+D(id).dimensions+' · '+D(id).openingLabel+'</div></button></td></tr>').join('')+'</tbody></table>';document.querySelectorAll('[data-check]').forEach(c=>c.addEventListener('change',()=>{const id=Number(c.dataset.check);if(c.checked)state.batch.add(id);else state.batch.delete(id);log('selección-lote:'+id+':'+c.checked);renderAll()}));document.querySelectorAll('[data-batch-row]').forEach(b=>b.addEventListener('click',()=>{state.activeId=Number(b.dataset.batchRow);log('activo-lote:'+state.activeId);renderAll()}));const root=document.getElementById('batch-svg');root.innerHTML=planSvg({ids:ids.length?ids:DATA.batchIds,neighbors:DATA.batchNeighbors.map(n=>n.id),labels:'S'});wireSvg(root,'batch');document.getElementById('batch-count').textContent=state.batch.size+' seleccionados';document.getElementById('batch-summary').innerHTML='<table><thead><tr><th>Marca</th><th>ID</th><th>Ejes</th><th>Dimensiones</th><th>Vanos</th></tr></thead><tbody>'+DATA.batchIds.map((id,i)=>'<tr><td>S'+(i+1)+'</td><td><code>'+id+'</code></td><td>'+D(id).axisText+'</td><td>'+D(id).dimensions+'</td><td>'+D(id).openings+'</td></tr>').join('')+'</tbody></table>'}
function renderAll(){renderIndividual();renderBatch();document.getElementById('history-count').textContent=state.history;document.getElementById('trace-count').textContent=state.trace;document.getElementById('authority-count').textContent=state.authorityMutations}
document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.zoom;state.zoom=a==='in'?state.zoom*1.2:a==='out'?state.zoom/1.2:1;log('zoom:'+a);const svg=document.querySelector('#individual-svg svg');if(svg)svg.style.transform='scale('+state.zoom+')'}));
function openLocator(ids){state.locateIds=[...ids];state.locateOpen=true;document.getElementById('locate-overlay').classList.add('open');document.getElementById('locate-target-label').textContent=' · '+ids.map(id=>D(id).summary+' · ID '+id).join(' | ');const root=document.getElementById('locator-svg');root.innerHTML=planSvg({ids,all:true,labels:ids.length>1?'S':'T'});wireSvg(root,ids.length>1?'batch':'individual');log('localizar-abrir:'+ids.join(','));document.getElementById('locator-back').focus()}
function closeLocator(mode){state.locateOpen=false;document.getElementById('locate-overlay').classList.remove('open');log('localizar-cerrar:'+mode)}
document.getElementById('locate-individual').addEventListener('click',()=>openLocator([DATA.targetId]));document.getElementById('locate-batch').addEventListener('click',()=>openLocator([...state.batch]));document.getElementById('open-locator-demo').addEventListener('click',()=>openLocator([DATA.targetId]));document.getElementById('locator-back').addEventListener('click',()=>closeLocator('restaurar'));document.getElementById('locator-keep').addEventListener('click',()=>closeLocator('conservar'));document.getElementById('locator-fit').addEventListener('click',()=>{log('localizar-ajustar');document.querySelector('#locator-svg svg').style.transform='scale(1)'});document.addEventListener('keydown',e=>{if(state.locateOpen&&e.key==='Escape'){e.preventDefault();closeLocator('escape')}else if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){if(e.key.toLowerCase()==='l')openLocator(state.panel==='batch'?[...state.batch]:[DATA.targetId]);if(e.key==='0'){state.zoom=1;log('zoom:fit');renderAll()}}});document.getElementById('batch-all').addEventListener('click',()=>{state.batch=new Set(DATA.batchIds);log('lote:todos');renderAll()});document.getElementById('batch-clear').addEventListener('click',()=>{state.batch=new Set();log('lote:limpiar');renderAll()});
function runAudit(){state.uiEvents=[];const before={authority:initialAuthority,history:state.history,trace:state.trace,mutations:state.authorityMutations};['navegación:individual','hover:'+DATA.targetId,'activación-lista:'+DATA.targetId,'selección-lote:'+DATA.batchIds[0],'zoom:in','zoom:out','localizar-abrir:'+DATA.targetId,'localizar-ajustar','localizar-cerrar:restaurar'].forEach(log);const after={authority:initialAuthority,history:state.history,trace:state.trace,mutations:state.authorityMutations};const pass=JSON.stringify(before)===JSON.stringify(after)&&after.history===0&&after.trace===0&&after.mutations===0;document.getElementById('audit-result').textContent=pass?'PASS · autoridad intacta':'FAIL';document.getElementById('audit-result').className='badge '+(pass?'ok':'warn');document.getElementById('audit-log').textContent=state.uiEvents.map((e,i)=>String(i+1).padStart(2,'0')+'  '+e).join('\\n')+'\\n\\n'+JSON.stringify({before,after,pass},null,2)}
document.getElementById('run-audit').addEventListener('click',runAudit);renderAll();
</script>
</body></html>`;
await writeFile(resolve(HERE, 'FX-008-SPEC-015-C-1-prototipo.html'), html);
console.log(`PASS - prototipo SPEC-015-C-1 generado\nhtml=${resolve(HERE, 'FX-008-SPEC-015-C-1-prototipo.html')}\ndata=${resolve(HERE, 'FX-008-SPEC-015-C-1-data.json')}`);
