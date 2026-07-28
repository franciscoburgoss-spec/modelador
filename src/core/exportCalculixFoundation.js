// core/exportCalculixFoundation.js
// ★ Sesión 14 — Fundaciones C: export CalculiX (opción 1, "fundación como apoyo").
//
// Modelo: VIGA DE FUNDACIÓN SOBRE LECHO ELÁSTICO (Winkler), aislada del resto de la estructura.
//   - Cada cimiento corrido se discretiza en barras B31 a lo largo de su eje (nodos en extremos,
//     en las intersecciones con otras corridas y cada `nodeSpacing`).
//   - En CADA nodo cuelga un resorte vertical a tierra (SPRING1, gdl 3) con
//     k = módulo de balasto × área tributaria (ancho del cimiento × largo tributario).
//   - Cada zapata aislada es UN nodo con su propio resorte (k = balasto × largo X × largo Y).
//   - Carga: línea de peso que baja del muro (kgf/m, dato de entrada — el modelo no tiene
//     cargas) + peso propio del hormigón, ambas repartidas por área tributaria; puntual en poyos.
//
// Por qué así y no mallar el cimiento con sólidos (opción 2 del plan): con Winkler la presión de
// contacto sale directa (p = balasto × asentamiento) y el modelo corre en segundos en un i5/8GB.
//
// Simplificación explícita: la sección se toma como UN rectángulo equivalente
// (ancho del cimiento × altura total de capas). Sobreestima la rigidez cuando el sobrecimiento
// es más angosto; conservador para asentamientos diferenciales, no para el momento del cimiento.
//
// Unidades del .inp: mm, N, MPa. Entradas del usuario en unidades de obra (kgf/m, kgf/cm2,
// kgf/cm3) y se convierten aquí.

import { resolveFoundation } from './foundationGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { makeNodeRegistry, safeName, KGF_TO_N } from './calculixCommon.js';
import { parseCalculixDatDisplacements } from './calculixResults.js';
import { guardExport } from './exportPolicy.js';

export { parseCalculixDatDisplacements } from './calculixResults.js';

const KGF_M_TO_N_MM = KGF_TO_N / 1000;      // 1 kgf/m  = 9.80665 N / 1000 mm
export const KGF_CM3_TO_N_MM3 = KGF_TO_N / 1000; // 1 kgf/cm3 = 9.80665 N / 1000 mm3
export const KGF_CM2_TO_MPA = KGF_TO_N / 100;    // 1 kgf/cm2 = 9.80665 N / 100 mm2
const KGF_M3_TO_N_MM3 = KGF_TO_N / 1e9;

export const FOUNDATION_ANALYSIS_DEFAULTS = {
  nodeSpacing: 500,            // mm entre nodos de la viga de fundación
  lineLoadKgfM: 600,           // carga vertical de servicio que baja del muro, kgf/m
  padLoadKgf: 2000,            // carga vertical puntual sobre cada zapata aislada, kgf
  subgradeModulusKgfCm3: 5,    // balasto por defecto (si la sección de librería no lo define)
  sigmaAdmKgfCm2: 1.5,         // tensión admisible del suelo
  concreteDensityKgfM3: 2500,
  concreteE: 25000,            // MPa
  includeSelfWeight: true
};

/** σadm: parámetro de proyecto `sigmaAdm` (kgf/cm2) si existe; si no, el de las opciones. */
export function resolveSigmaAdm(model, options = {}) {
  const p = (model.projectParams || []).find((x) => x.name === 'sigmaAdm');
  const v = p != null ? Number(p.value) : NaN;
  return Number.isFinite(v) && v > 0 ? v : (options.sigmaAdmKgfCm2 ?? FOUNDATION_ANALYSIS_DEFAULTS.sigmaAdmKgfCm2);
}

/** Balasto (kgf/cm3) de la sección de librería del elemento; fallback al valor de opciones. */
function subgradeModulusOf(el, library, options) {
  const secs = library?.foundationSections || [];
  const sec = el.libraryId != null ? secs.find((s) => s.id === el.libraryId) : null;
  const v = sec != null ? Number(sec.subgradeModulus) : NaN;
  return Number.isFinite(v) && v > 0
    ? v
    : (options.subgradeModulusKgfCm3 ?? FOUNDATION_ANALYSIS_DEFAULTS.subgradeModulusKgfCm3);
}

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Parámetro t de la proyección de p sobre el segmento a→b, o null si no cae encima. */
function paramOnSegment(p, a, b, tol = 1) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < -1e-9 || t > 1 + 1e-9) return null;
  const proj = lerp(a, b, t);
  return Math.hypot(proj.x - p.x, proj.y - p.y) <= tol ? Math.min(1, Math.max(0, t)) : null;
}

/**
 * Arma el modelo de fundación (nodos, barras, resortes, cargas, apoyos) sin escribir texto.
 * Separado de la generación del .inp para poder testearlo y para alimentar el post-proceso.
 */
export function collectFoundationSupportModel(model, options = {}) {
  const opt = { ...FOUNDATION_ANALYSIS_DEFAULTS, ...options };
  const { grid, elements, library } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const reg = makeNodeRegistry();
  const warnings = [];

  const resolved = [];
  for (const el of elements) {
    if (el.type !== 'foundation') continue;
    const f = resolveFoundation(el, grid, paramsMap, elementsById);
    if (!f) { warnings.push(`fundación ${el.id}: geometría no resuelta (ejes/nivel faltantes) — omitida`); continue; }
    resolved.push({ el, f });
  }

  const corridas = resolved.filter((r) => r.f.kind === 'corrida');
  const aisladas = resolved.filter((r) => r.f.kind === 'aislada');

  /** nodeId -> { kArea (N/mm), area (mm2), load (N), dirs:Set<'x'|'y'>, isPad } */
  const nodeInfo = new Map();
  const infoOf = (id) => {
    if (!nodeInfo.has(id)) nodeInfo.set(id, { kArea: 0, area: 0, load: 0, dirs: new Set(), isPad: false });
    return nodeInfo.get(id);
  };

  const runs = [];
  for (const { el, f } of corridas) {
    const height = f.layers.reduce((a, l) => a + l.height, 0);
    const width = f.width;
    if (!(width > 0) || !(height > 0) || !(f.length > 0)) {
      warnings.push(`fundación ${el.id}: sección o largo nulo — omitida`);
      continue;
    }
    const sectionArea = f.layers.reduce((a, l) => a + l.width * l.height, 0); // real, para peso propio
    const ks = subgradeModulusOf(el, library, opt) * KGF_CM3_TO_N_MM3;
    const z = (f.topElevation + f.sealElevation) / 2;

    // Puntos de quiebre: extremos propios + extremos de OTRAS corridas que caen sobre este eje
    // (así los nodos coinciden y el registro los deduplica → la grilla queda conectada).
    const ts = new Set([0, 1]);
    for (const other of corridas) {
      if (other.el === el) continue;
      for (const p of [other.f.p1, other.f.p2]) {
        const t = paramOnSegment(p, f.p1, f.p2);
        if (t != null) ts.add(t);
      }
    }
    const breaks = [...ts].sort((a, b) => a - b);

    const params = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      const t0 = breaks[i], t1 = breaks[i + 1];
      const segLen = (t1 - t0) * f.length;
      if (segLen < 1) continue; // quiebres coincidentes
      const n = Math.max(1, Math.ceil(segLen / opt.nodeSpacing));
      for (let k = 0; k < n; k++) params.push(t0 + ((t1 - t0) * k) / n);
    }
    params.push(1);

    const dir = Math.abs(f.p2.y - f.p1.y) < 1e-6 ? 'x' : (Math.abs(f.p2.x - f.p1.x) < 1e-6 ? 'y' : 'd');
    const nodeIds = params.map((t) => {
      const p = lerp(f.p1, f.p2, t);
      return reg.getNode(p.x, p.y, z);
    });

    const lineLoad = opt.lineLoadKgfM * KGF_M_TO_N_MM
      + (opt.includeSelfWeight ? sectionArea * opt.concreteDensityKgfM3 * KGF_M3_TO_N_MM3 : 0);

    const els = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const segLen = (params[i + 1] - params[i]) * f.length;
      els.push({ n1: nodeIds[i], n2: nodeIds[i + 1], length: segLen });
      // área y carga tributaria: media barra a cada nodo
      for (const id of [nodeIds[i], nodeIds[i + 1]]) {
        const info = infoOf(id);
        const trib = segLen / 2;
        info.area += width * trib;
        info.kArea += ks * width * trib;
        info.load += lineLoad * trib;
        info.dirs.add(dir);
      }
    }

    runs.push({
      elementId: el.id, elsetName: `FUND_${safeName(el.id)}`, dir, width, height,
      length: f.length, nodeIds, els, ks, lineLoad
    });
  }

  const pads = [];
  for (const { el, f } of aisladas) {
    const area = f.lengthX * f.lengthY;
    if (!(area > 0)) { warnings.push(`zapata ${el.id}: planta nula — omitida`); continue; }
    const ks = subgradeModulusOf(el, library, opt) * KGF_CM3_TO_N_MM3;
    const z = (f.topElevation + f.sealElevation) / 2;
    const nodeId = reg.getNode(f.center.x, f.center.y, z);
    const info = infoOf(nodeId);
    const merged = info.dirs.size > 0; // el nodo ya existe en una corrida
    if (merged) warnings.push(`zapata ${el.id}: comparte nodo con un cimiento corrido — se suman rigidez y carga en ese nodo`);
    else info.isPad = true;
    const selfW = opt.includeSelfWeight ? f.layers.reduce((a, l) => a + l.volume, 0) * opt.concreteDensityKgfM3 * KGF_M3_TO_N_MM3 : 0;
    info.area += area;
    info.kArea += ks * area;
    info.load += opt.padLoadKgf * KGF_TO_N + selfW;
    pads.push({ elementId: el.id, nodeId, area, lengthX: f.lengthX, lengthY: f.lengthY, ks, merged });
  }

  // Resortes agrupados por rigidez (CalculiX define un solo valor por ELSET de *SPRING).
  const springGroups = [];
  const byK = new Map();
  for (const [id, info] of nodeInfo) {
    if (!(info.kArea > 0)) continue;
    const key = info.kArea.toFixed(3);
    if (!byK.has(key)) {
      const g = { elsetName: `RES_${byK.size + 1}`, k: Number(key), nodeIds: [] };
      byK.set(key, g);
      springGroups.push(g);
    }
    byK.get(key).nodeIds.push(id);
  }
  for (const g of springGroups) g.nodeIds.sort((a, b) => a - b);

  // Apoyos: el lecho elástico solo aporta rigidez vertical → se bloquea todo lo demás.
  // Giro torsional (eje de la barra) bloqueado solo donde no hay otra corrida transversal que
  // lo tome como flexión; en las esquinas/T queda libre para no rigidizar el encuentro.
  const boundaries = [];
  for (const [id, info] of nodeInfo) {
    const dofs = [1, 2, 6];
    if (info.isPad) dofs.push(4, 5);
    else {
      if (!info.dirs.has('y')) dofs.push(4); // corre solo en X → gdl 4 es torsión
      if (!info.dirs.has('x')) dofs.push(5);
    }
    boundaries.push({ node: id, dofs: dofs.sort((a, b) => a - b) });
  }
  boundaries.sort((a, b) => a.node - b.node);

  const cloads = [...nodeInfo.entries()]
    .filter(([, i]) => i.load > 0)
    .map(([id, i]) => ({ node: id, dof: 3, value: -i.load }))
    .sort((a, b) => a.node - b.node);

  const totalLoadN = cloads.reduce((a, c) => a + Math.abs(c.value), 0);
  const totalAreaMm2 = [...nodeInfo.values()].reduce((a, i) => a + i.area, 0);

  return {
    nodes: reg.list, runs, pads, springGroups, boundaries, cloads, warnings,
    nodeInfo,
    meta: {
      sigmaAdmKgfCm2: resolveSigmaAdm(model, opt),
      totalLoadN, totalAreaMm2,
      meanPressureKgfCm2: totalAreaMm2 > 0 ? (totalLoadN / totalAreaMm2) / KGF_CM2_TO_MPA : 0,
      options: opt
    }
  };
}

/** .inp autocontenido y CORRIBLE de la fundación sobre lecho elástico. */
export function generateCalculixFoundation(model, options = {}) {
  const m = collectFoundationSupportModel(model, options);
  const opt = m.meta.options;
  const lines = [];

  lines.push('** Fundaciones sobre lecho elastico (Winkler) - modelador estructural, sesion 14.');
  lines.push('** Unidades: mm, N, MPa. Vigas B31 (seccion rectangular equivalente) + resortes SPRING1 verticales.');
  lines.push(`** Balasto por defecto: ${opt.subgradeModulusKgfCm3} kgf/cm3 | carga de muro: ${opt.lineLoadKgfM} kgf/m | poyos: ${opt.padLoadKgf} kgf.`);
  lines.push(`** Peso propio del hormigon ${opt.includeSelfWeight ? 'INCLUIDO' : 'NO incluido'} (${opt.concreteDensityKgfM3} kgf/m3).`);
  lines.push(`** Tension admisible del suelo: ${m.meta.sigmaAdmKgfCm2} kgf/cm2. Presion de contacto = balasto x asentamiento.`);
  lines.push('** NO incluye sismo, empujes ni combinaciones. Cargas de servicio verticales solamente.');
  for (const w of m.warnings) lines.push(`** ADVERTENCIA: ${sanitize(w)}`);

  if (!m.nodes.length) {
    lines.push('** No hay fundaciones resueltas - nada que exportar.');
    return lines.join('\n');
  }

  lines.push('*NODE');
  for (const n of m.nodes) lines.push(`${n.id}, ${n.x.toFixed(1)}, ${n.y.toFixed(1)}, ${n.z.toFixed(1)}`);

  let elId = 1;
  for (const r of m.runs) {
    lines.push(`*ELEMENT, TYPE=B31, ELSET=${r.elsetName}`);
    for (const e of r.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
  }
  for (const g of m.springGroups) {
    lines.push(`*ELEMENT, TYPE=SPRING1, ELSET=${g.elsetName}`);
    for (const id of g.nodeIds) lines.push(`${elId++}, ${id}`);
  }

  lines.push('*MATERIAL, NAME=HORMIGON');
  lines.push('*ELASTIC');
  lines.push(`${opt.concreteE}, 0.2`);
  for (const r of m.runs) {
    // RECT: primer valor = dimension en el eje local 1 (vertical, ver linea siguiente), segundo
    // valor = dimension en el eje local 2 (horizontal, transversal al cimiento).
    lines.push(`*BEAM SECTION, ELSET=${r.elsetName}, MATERIAL=HORMIGON, SECTION=RECT`);
    lines.push(`${r.height.toFixed(1)}, ${r.width.toFixed(1)}`);
    lines.push('0.0, 0.0, 1.0');
  }
  for (const g of m.springGroups) {
    lines.push(`*SPRING, ELSET=${g.elsetName}`);
    lines.push('3');
    lines.push(`${g.k.toFixed(4)}`);
  }

  lines.push('*NSET, NSET=NFUND');
  for (const n of m.nodes) lines.push(`${n.id},`);

  lines.push('** Solo se deja libre el descenso vertical (y los giros de flexion de cada tramo).');
  lines.push('*BOUNDARY');
  for (const b of m.boundaries) for (const d of b.dofs) lines.push(`${b.node}, ${d}, ${d}`);

  lines.push('*STEP');
  lines.push('*STATIC');
  lines.push(`** Carga total: ${m.meta.totalLoadN.toFixed(0)} N (${(m.meta.totalLoadN / KGF_TO_N).toFixed(0)} kgf) sobre ${(m.meta.totalAreaMm2 / 1e6).toFixed(2)} m2 de sello.`);
  lines.push(`** Presion media estimada: ${m.meta.meanPressureKgfCm2.toFixed(3)} kgf/cm2 vs admisible ${m.meta.sigmaAdmKgfCm2} kgf/cm2.`);
  lines.push('*CLOAD');
  for (const c of m.cloads) lines.push(`${c.node}, ${c.dof}, ${c.value.toFixed(2)}`);
  lines.push('*NODE PRINT, NSET=NFUND');
  lines.push('U');
  lines.push('*NODE FILE');
  lines.push('U');
  lines.push('*END STEP');

  // Los comentarios se emiten en ASCII puro (misma convencion que el resto de exportadores).
  return lines.map((l) => (l.startsWith('**') ? sanitize(l) : l)).join('\n');
}

const sanitize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

/**
 * Presión de contacto por tramo a partir de los asentamientos leídos del .dat.
 * p = balasto × asentamiento (equivale a fuerza del resorte / área tributaria).
 * @returns {{rows, sigmaAdmKgfCm2, missingNodes, maxRatio}}
 */
export function computeFoundationPressures(support, displacements, options = {}) {
  const sigmaAdm = options.sigmaAdmKgfCm2 ?? support.meta.sigmaAdmKgfCm2;
  const missingNodes = [];
  const rows = [];

  const pressureAt = (nodeId, ks) => {
    const d = displacements.get(nodeId);
    if (!d) { missingNodes.push(nodeId); return null; }
    const settle = -d.uz;                       // descenso positivo hacia abajo, mm
    const pMPa = ks * settle;                   // N/mm3 × mm = MPa
    return { settle, pKgfCm2: pMPa / KGF_CM2_TO_MPA };
  };

  const push = (kind, elementId, nodeIds, ks) => {
    const vals = nodeIds.map((id) => pressureAt(id, ks)).filter(Boolean);
    if (!vals.length) return;
    const pMax = Math.max(...vals.map((v) => v.pKgfCm2));
    const pMean = vals.reduce((a, v) => a + v.pKgfCm2, 0) / vals.length;
    const settleMax = Math.max(...vals.map((v) => v.settle));
    rows.push({
      kind, elementId, nodeCount: vals.length,
      pMaxKgfCm2: pMax, pMeanKgfCm2: pMean, settleMaxMm: settleMax,
      ratio: sigmaAdm > 0 ? pMax / sigmaAdm : Infinity,
      ok: pMax <= sigmaAdm
    });
  };

  for (const r of support.runs) push('corrida', r.elementId, r.nodeIds, r.ks);
  for (const p of support.pads) push('aislada', p.elementId, [p.nodeId], p.ks);

  return {
    rows, sigmaAdmKgfCm2: sigmaAdm, missingNodes,
    maxRatio: rows.length ? Math.max(...rows.map((r) => r.ratio)) : 0
  };
}

export function downloadCalculixFoundation(model, options = {}) {
  const policy = guardExport(model, 'calculix-foundation');
  if (!policy.allowed) return false;
  const content = generateCalculixFoundation(model, options);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fundaciones.inp';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
