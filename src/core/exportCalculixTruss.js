// core/exportCalculixTruss.js
// Export CalculiX del sistema de cerchas (model.roofSystems, ver core/trussLayout.js).
//
// Decisiones de modelación acordadas (sesión 04):
//  1. Vigas de 2 nodos con nudos rígidos en TODO (cuerdas, montantes, diagonales). Metalcon
//     atornillado no es rótula real, y una cercha con cuerda continua rotulada da mecanismo →
//     ccx no converge. Se usa `TYPE=U1` y no B31: ★ ccx 2.21 RECHAZA `SECTION=GENERAL` sobre
//     B31 ("can only be used for U1 elements"); U1 es su viga de 2 nodos que sí la acepta, y es
//     la única forma de usar A/Ix/Iy reales del catálogo en vez de un rectángulo inventado.
//  2. `*BEAM GENERAL SECTION` con A/Ix/Iy reales del catálogo Cintac. El eje local 1 se orienta
//     NORMAL al plano de la cercha; el alma del perfil C queda EN el plano. ★ Verificado con
//     voladizos de prueba en ccx: la flexión cuyo desplazamiento va en la dirección del eje
//     local n usa Inn. Como el desplazamiento en el plano de la cercha ocurre en la dirección
//     2 (perpendicular a la barra y al eje 1), va I22 = Ix (fuerte) e I11 = Iy (débil, fuera
//     del plano). El orden NO es (Ix, Iy) como en los montantes de muro, donde el eje 1 sí
//     coincide con la flexión fuerte.
//  3. Apoyos en la cuerda inferior: extremo bajo fijo, extremo alto deslizante en la dirección
//     de la luz (isostático). Además, modelo plano: se bloquean los GDL fuera del plano en
//     todos los nodos, que es lo que hace corrible una cercha plana en un solver 3D.
//  4. Cargas nodales `*CLOAD` en los nodos de costanera de la cuerda superior, por área
//     tributaria (separación entre cerchas x tributaria inclinada). Sin peso propio: el perfil
//     metalcon (~1 kg/m) ya está dentro de los 70/130 kgf/m2 de las plantillas Cintac.
//  5. Se exporta UNA cercha tipo (la central del sistema), en coordenadas mundo reales.
//
// Ojo: `computeMonoTrussGeometry` entrega cada cuerda como UNA sola barra de extremo a extremo.
// Exportarla así dejaría montantes y diagonales desconectados de las cuerdas (ccx: matriz
// singular). Por eso las cuerdas se SUBDIVIDEN en todos los puntos donde llega otro miembro o
// una costanera — ese es el trabajo real de este módulo.
import { makeNodeRegistry, cm2ToMm2, cm4ToMm4, safeName, KGF_TO_N } from './calculixCommon.js';
import { findMetalconProfile } from './metalconCatalog.js';
import { getRoofSystems } from './roofPlaneOutputs.js';

const TOL = 1.0; // mm — tolerancia para considerar un punto "sobre" la cuerda

const CHORD_ROLES = new Set(['topChord', 'bottomChord', 'gutterChord']);

const ROLE_ELSET = {
  topChord: 'CUERDA_SUP',
  bottomChord: 'CUERDA_INF',
  gutterChord: 'CUERDA_CANALETA',
  post: 'MONTANTES',
  diagonal: 'DIAGONALES'
};

/** Perfil metalcon por `code`: primero la librería del proyecto, luego el catálogo estático.
 * Las cerchas referencian perfiles por CODE (ver trussTemplates.js), no por id de librería
 * como los muros — de ahí que no sirva findProjectMetalconProfile. */
export function findTrussProfile(library, code) {
  if (!code) return null;
  const fromLib = (library?.metalconProfiles || []).find(p => p.code === code);
  return fromLib || findMetalconProfile(code) || null;
}

/** Cercha tipo = la central del sistema (la de mayor área tributaria representativa). */
export function typicalTrussIndex(positions) {
  return Math.floor(((positions?.length || 1) - 1) / 2);
}

/** Separación real entre cerchas, medida sobre las posiciones ya persistidas. */
export function trussSpacingFromPositions(positions, fallback = 1200) {
  if (!positions || positions.length < 2) return fallback;
  return Math.abs(positions[1].offset - positions[0].offset) || fallback;
}

/** Parámetro t (0..1) del punto (px,py) sobre el segmento, o null si no está sobre él. */
function paramOnSegment(px, py, x1, y1, x2, y2, tol = TOL) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return null;
  const t = ((px - x1) * dx + (py - y1) * dy) / len2;
  if (t < -tol / Math.sqrt(len2) || t > 1 + tol / Math.sqrt(len2)) return null;
  const cx = x1 + t * dx, cy = y1 + t * dy;
  if (Math.hypot(px - cx, py - cy) > tol) return null;
  return Math.min(1, Math.max(0, t));
}

/**
 * Subdivide una cuerda en todos los puntos de `candidates` que caen sobre ella.
 * @returns [{x1,y1,x2,y2}] — al menos un segmento (la cuerda entera si no hay cortes).
 */
export function subdivideChord(chord, candidates) {
  const dx = chord.x2 - chord.x1, dy = chord.y2 - chord.y1;
  const len = Math.hypot(dx, dy) || 1;
  // ★ Se conserva la coordenada ORIGINAL del punto de corte, no la reproyectada sobre la
  // cuerda: si difieren en décimas de mm, el registro de nodos (que redondea a mm) crearía dos
  // nodos distintos y el punto de carga quedaría huérfano → ccx: matriz singular.
  const cuts = [{ t: 0, x: chord.x1, y: chord.y1 }, { t: 1, x: chord.x2, y: chord.y2 }];
  for (const c of candidates) {
    const t = paramOnSegment(c.x, c.y, chord.x1, chord.y1, chord.x2, chord.y2);
    if (t != null) cuts.push({ t, x: c.x, y: c.y });
  }
  cuts.sort((a, b) => a.t - b.t);
  const uniq = [];
  for (const c of cuts) {
    if (!uniq.length || (c.t - uniq[uniq.length - 1].t) * len > TOL) uniq.push(c);
  }
  const last = uniq[uniq.length - 1];
  if (last.t < 1) uniq.push({ t: 1, x: chord.x2, y: chord.y2 });
  const out = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    out.push({ x1: uniq[i].x, y1: uniq[i].y, x2: uniq[i + 1].x, y2: uniq[i + 1].y });
  }
  return out;
}

/** Local (x a lo largo de la luz, y sobre la cota de apoyo) -> mundo del .inp {x, y, z=cota}.
 * Misma convención que build3d.js:trussLocalToThree, con z = elevación (no y). */
export function trussLocalToWorld(system, trussOffset, xLocal, yLocal) {
  const spanDir = system.spanDir ?? 1;
  const base = system.trussPositions[0];
  const perp0 = system.runAxis === 'x' ? base.world.y : base.world.x;
  const perp = perp0 + spanDir * xLocal;
  return {
    x: system.runAxis === 'x' ? trussOffset : perp,
    y: system.runAxis === 'x' ? perp : trussOffset,
    z: system.supportElevation + yLocal
  };
}

/** Tributaria de cada punto de una serie ordenada de abscisas (mitad a cada lado). */
function tributaryLengths(coords) {
  return coords.map((s, i) => {
    const prev = i > 0 ? (s - coords[i - 1]) / 2 : 0;
    const next = i < coords.length - 1 ? (coords[i + 1] - s) / 2 : 0;
    return prev + next;
  });
}

/**
 * Arma la cercha tipo de un sistema: nodos, elementos agrupados por rol/perfil, apoyos y
 * cargas nodales. No emite texto — eso lo hace generateCalculixTruss.
 * @returns { resolved, groups, boundary, cloads, warnings, meta }
 */
export function collectTypicalTruss(system, library, reg, options = {}) {
  const warnings = [];
  const geo = system?.trussGeometry;
  if (!geo?.resolved || !system.trussPositions?.length) {
    return { resolved: false, warnings: ['sistema de techumbre sin geometría generada — genéralo en el modal de techumbre'] };
  }

  const positions = system.trussPositions;
  // Sesión 25: las posiciones `edgeChord` son la cuerda superior atornillada a la cara de un
  // frontón — una solución de apoyo para las costaneras, no una cercha biapoyada. No se analiza:
  // su carga la toma el frontón, no una celosía.
  const fullPositions = positions.filter(p => p.kind !== 'edgeChord');
  if (!fullPositions.length) {
    return { resolved: false, warnings: ['el sistema solo tiene cuerdas superiores de borde contra frontón — no hay cercha que analizar'] };
  }
  if (fullPositions.length < positions.length) {
    warnings.push(`${positions.length - fullPositions.length} cuerda(s) de borde contra frontón excluidas del análisis (no son cerchas)`);
  }
  const offset = fullPositions[typicalTrussIndex(fullPositions)].offset;
  const spacing = trussSpacingFromPositions(positions);
  const toWorld = (x, y) => trussLocalToWorld(system, offset, x, y);
  const nodeIds = new Set(); // nodos de ESTA cercha (para las CB de modelo plano)
  const node = (x, y) => {
    const w = toWorld(x, y);
    const id = reg.getNode(w.x, w.y, w.z);
    nodeIds.add(id);
    return id;
  };

  // --- puntos de corte de las cuerdas: extremos de todo miembro no-cuerda + costaneras ---
  const chords = geo.members.filter(m => CHORD_ROLES.has(m.role));
  const webs = geo.members.filter(m => !CHORD_ROLES.has(m.role));
  const candidates = [];
  for (const m of webs) { candidates.push({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }); }
  for (const p of (geo.purlins || [])) candidates.push({ x: p.x, y: p.y });
  for (const c of chords) { candidates.push({ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }); }

  // --- elementos por rol+perfil ---
  const byKey = new Map(); // `${role}|${profile}` -> { role, profileCode, profile, els }
  const addEl = (role, profileCode, n1, n2) => {
    const key = `${role}|${profileCode || ''}`;
    if (!byKey.has(key)) {
      const profile = findTrussProfile(library, profileCode);
      if (!profile) warnings.push(`perfil "${profileCode || '(sin asignar)'}" del rol ${role} no encontrado — se usa sección genérica 40x40`);
      byKey.set(key, { role, profileCode, profile, els: [] });
    }
    if (n1 !== n2) byKey.get(key).els.push({ n1, n2 });
  };

  for (const c of chords) {
    for (const seg of subdivideChord(c, candidates)) {
      addEl(c.role, c.profile, node(seg.x1, seg.y1), node(seg.x2, seg.y2));
    }
  }
  for (const m of webs) addEl(m.role, m.profile, node(m.x1, m.y1), node(m.x2, m.y2));

  // --- nombres de ELSET: base por rol, con sufijo de código solo si el rol tiene 2+ perfiles ---
  const roleCount = new Map();
  for (const g of byKey.values()) roleCount.set(g.role, (roleCount.get(g.role) || 0) + 1);
  const groups = [];
  for (const g of byKey.values()) {
    if (!g.els.length) continue;
    const base = ROLE_ELSET[g.role] || safeName(g.role);
    groups.push({ ...g, elsetName: roleCount.get(g.role) > 1 ? `${base}_${safeName(g.profileCode)}` : base });
  }

  // --- apoyos (decisión 3) sobre la cuerda inferior (y_local = 0) ---
  const bottom = chords.find(c => c.role === 'bottomChord');
  if (!bottom) return { resolved: false, warnings: ['la cercha no tiene cuerda inferior — no hay dónde apoyar'] };
  const xLow = Math.min(bottom.x1, bottom.x2);
  const xHigh = Math.max(bottom.x1, bottom.x2);
  const nLow = node(xLow, 0);
  const nHigh = node(xHigh, 0);

  // GDL: 1=X, 2=Y, 3=Z(vertical), 4/5/6 = giros. El plano de la cercha contiene la vertical y
  // la dirección de la luz; la normal al plano es el eje de corrida (runAxis).
  const spanIsY = system.runAxis === 'x';           // luz sobre Y cuando las cerchas corren en X
  const outOfPlaneDof = spanIsY ? 1 : 2;            // traslación normal al plano
  const inPlaneRotDof = spanIsY ? 4 : 5;            // giro cuyo eje es normal al plano (flexión útil)
  const outOfPlaneRots = [4, 5, 6].filter(d => d !== inPlaneRotDof);
  const spanDof = spanIsY ? 2 : 1;                  // traslación en la dirección de la luz

  const boundary = { outOfPlaneDof, outOfPlaneRots, spanDof, nLow, nHigh, nodeIds };

  // --- cargas (decisión 4): nodos de costanera sobre la cuerda superior ---
  const loadKgfM2 = Number(options.roofLoadKgfM2 ?? system.roofLoadKgfM2 ?? 70);
  const cloads = [];
  let loadPoints = (geo.purlins || []).map(p => ({ x: p.x, y: p.y, s: p.s }));
  if (!loadPoints.length) {
    // sin costaneras definidas: se reparte en los nudos de la cuerda superior
    const top = chords.find(c => c.role === 'topChord');
    if (top) {
      const pts = [];
      for (const c of candidates) {
        const t = paramOnSegment(c.x, c.y, top.x1, top.y1, top.x2, top.y2);
        if (t != null) pts.push({ x: top.x1 + t * (top.x2 - top.x1), y: top.y1 + t * (top.y2 - top.y1), s: t * Math.hypot(top.x2 - top.x1, top.y2 - top.y1) });
      }
      pts.sort((a, b) => a.s - b.s);
      loadPoints = pts.filter((p, i) => i === 0 || p.s - pts[i - 1].s > TOL);
      warnings.push('el sistema no tiene costaneras — la carga se reparte en los nudos de la cuerda superior');
    }
  }
  if (loadPoints.length) {
    const trib = tributaryLengths(loadPoints.map(p => p.s));
    loadPoints.forEach((p, i) => {
      const areaMm2 = trib[i] * spacing;             // tributaria inclinada x separación de cerchas
      const fN = loadKgfM2 * KGF_TO_N * areaMm2 / 1e6; // kgf/m2 -> N/mm2 -> N
      if (fN > 0) cloads.push({ node: node(p.x, p.y), dof: 3, value: -fN });
    });
  }

  return {
    resolved: true, groups, boundary, cloads, warnings, nodeIds,
    meta: { systemId: system.id, offset, spacing, span: geo.span, loadKgfM2, trussCount: fullPositions.length }
  };
}

/** Líneas de sección para un grupo (perfil real del catálogo o fallback 40x40 genérico). */
function sectionLines(g, matName, orientVec) {
  const lines = [];
  if (g.profile) {
    lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=GENERAL`);
    // A, I11(=Iy, fuera del plano), I12(=0, ejes principales), I22(=Ix, en el plano),
    // J (torsión, aprox. Ix+Iy para perfil de pared delgada abierta)
    lines.push(`${cm2ToMm2(g.profile.areaCm2).toFixed(2)}, ${cm4ToMm4(g.profile.iyCm4).toFixed(1)}, 0.0, ${cm4ToMm4(g.profile.ixCm4).toFixed(1)}, ${cm4ToMm4(g.profile.ixCm4 + g.profile.iyCm4).toFixed(1)}`);
    lines.push(`${orientVec.x.toFixed(3)}, ${orientVec.y.toFixed(3)}, ${orientVec.z.toFixed(3)}`);
  } else {
    // sin perfil resuelto: 40CA085 como sección de reemplazo (ya advertido en collectTypicalTruss)
    lines.push(`*BEAM SECTION, ELSET=${g.elsetName}, MATERIAL=${matName}, SECTION=GENERAL`);
    lines.push('107.00, 21200.0, 0.0, 31000.0, 52200.0');
    lines.push(`${orientVec.x.toFixed(3)}, ${orientVec.y.toFixed(3)}, ${orientVec.z.toFixed(3)}`);
  }
  return lines;
}

/**
 * .inp autocontenido y CORRIBLE de la cercha tipo de cada sistema de techumbre.
 * @param options { roofLoadKgfM2 } — carga de techumbre (PP+SC) en kgf/m2, default 70.
 */
export function generateCalculixTruss(model, options = {}) {
  const systems = getRoofSystems(model);
  const reg = makeNodeRegistry();
  const collected = [];
  const warnings = [];
  for (const system of systems) {
    const res = collectTypicalTruss(system, model.library, reg, options);
    warnings.push(...(res.warnings || []).map(w => `sistema ${system.id}: ${w}`));
    if (res.resolved) collected.push(res);
  }

  const lines = [];
  lines.push('** Cercha tipo Metalcon — generado por el modelador estructural.');
  lines.push('** Unidades: mm, N, MPa. Vigas U1 (2 nodos, nudos rigidos). Modelo PLANO resuelto en 3D.');
  lines.push('** Carga de techumbre nodal por area tributaria; NO incluye viento, sismo ni combinaciones.');
  lines.push('** Verificar secciones segun NCh y Manual de Diseno Metalcon — este .inp entrega solicitaciones, no verificacion.');
  for (const w of warnings) lines.push(`** ADVERTENCIA: ${w}`);

  // Apoyo lateral: la reaccion no baja por una coronacion sino por una solera fijada a la cara
  // del fronton. Queda registrada aca (fuera del plano de la cercha tipo) para el calculo de la
  // fijacion; no se modela como elemento en este .inp.
  for (const s of systems) {
    for (const led of s.supportLedgers || []) {
      lines.push(`** APOYO LATERAL sistema ${s.id} (${led.side}): solera ${led.profile || 'sin perfil'} @z=${Math.round(led.topElevation)}mm, largo ${Math.round(led.length)}mm sobre muro ${led.wallId}.`);
    }
  }

  if (!collected.length) {
    lines.push('** No hay sistemas de techumbre con geometria generada — nada que exportar.');
    return lines.join('\n');
  }

  lines.push('*NODE');
  for (const n of reg.list) lines.push(`${n.id}, ${n.x.toFixed(1)}, ${n.y.toFixed(1)}, ${n.z.toFixed(1)}`);

  // ★ U1 = viga de 2 nodos de CalculiX; se declara una vez antes de usarla (ver cabecera).
  lines.push('*USER ELEMENT, TYPE=U1, NODES=2, INTEGRATION POINTS=2, MAXDOF=6');

  let elId = 1;
  const allGroups = [];
  for (let i = 0; i < collected.length; i++) {
    const c = collected[i];
    const suffix = collected.length > 1 ? `_S${i + 1}` : '';
    for (const g of c.groups) {
      const elsetName = `${g.elsetName}${suffix}`;
      lines.push(`*ELEMENT, TYPE=U1, ELSET=${elsetName}`);
      for (const e of g.els) lines.push(`${elId++}, ${e.n1}, ${e.n2}`);
      allGroups.push({ ...g, elsetName, collected: c });
    }
  }

  lines.push('** Acero galvanizado Metalcon (E=200 GPa). Ajustar si la especificacion difiere.');
  lines.push('*MATERIAL, NAME=ACERO_GALVANIZADO');
  lines.push('*ELASTIC');
  lines.push('200000, 0.3');

  for (const g of allGroups) {
    // eje local 1 = normal al plano de la cercha -> I11 (=Ix, inercia fuerte) resiste la flexion
    // en el plano, con el alma del perfil C contenida en el plano de la cercha.
    const runAxis = systems.find(s => s.id === g.collected.meta.systemId)?.runAxis;
    const orientVec = runAxis === 'x' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    lines.push(...sectionLines(g, 'ACERO_GALVANIZADO', orientVec));
  }

  // --- condiciones de borde ---
  lines.push('** Modelo plano: se bloquea la traslacion y los giros fuera del plano en todos los nodos.');
  for (const c of collected) {
    const b = c.boundary;
    lines.push('*BOUNDARY');
    for (const id of [...b.nodeIds].sort((p, q) => p - q)) {
      lines.push(`${id}, ${b.outOfPlaneDof}, ${b.outOfPlaneDof}`);
      for (const d of b.outOfPlaneRots) lines.push(`${id}, ${d}, ${d}`);
    }
    lines.push('** Apoyos: extremo bajo fijo, extremo alto deslizante en la direccion de la luz.');
    lines.push('*BOUNDARY');
    lines.push(`${b.nLow}, ${b.spanDof}, ${b.spanDof}`);
    lines.push(`${b.nLow}, 3, 3`);
    lines.push(`${b.nHigh}, 3, 3`);
  }

  lines.push('*STEP');
  lines.push('*STATIC');
  const totalLoad = collected.reduce((a, c) => a + c.cloads.reduce((s, cl) => s + Math.abs(cl.value), 0), 0);
  lines.push(`** Carga total aplicada: ${totalLoad.toFixed(0)} N (${(totalLoad / KGF_TO_N).toFixed(0)} kgf)`);
  lines.push('*CLOAD');
  for (const c of collected) {
    for (const cl of c.cloads) lines.push(`${cl.node}, ${cl.dof}, ${cl.value.toFixed(2)}`);
  }
  lines.push('*NODE FILE');
  lines.push('U');
  lines.push('*EL FILE');
  lines.push('S, E');
  lines.push('*END STEP');

  return lines.join('\n');
}

export function downloadCalculixTruss(model, options = {}) {
  const content = generateCalculixTruss(model, options);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cercha.inp';
  a.click();
  URL.revokeObjectURL(url);
}
