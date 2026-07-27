// lab/roofPlane/core/roofPlane.js
// ★ B4.4 — Faldón (roofPlane) como entidad persistida: ata B4.1 (línea de apoyo), B4.2 (cadena
// global) y B4.3 (costaneras) en un solo agua con PENDIENTE ÚNICA.
//
// Un faldón agrupa lo que en obra es una sola agua:
//   - UNA canaleta (línea de apoyo baja, resuelta como colineal a la cota de apoyo).
//   - UNA pendiente, derivada del MÍNIMO entre todos los tramos: la más restrictiva manda, así
//     ningún tramo se pasa de la coronación. Fran ajusta la holgura de coronación (crownClearance)
//     y con eso mueve la pendiente de TODA el agua — es su control principal.
//   - N tramos, uno por luz distinta (frontón alto a distinta distancia). Cada tramo es un
//     rectángulo con su propia luz; comparten pendiente, cota, perfiles, paso.
//   - UNA cadena de cerchas sobre toda la corrida (no por tramo) -> vanos regulares.
//   - Costaneras moduladas desde la canaleta, continuas a través de los quiebres.
//
// Modelo de datos del faldón persistido (roofPlane):
//   { id, canalWallId, supportLevelId, supportOffset, crownClearance, heelHeight,
//     gutterNotchWidth, trussSpacing, chainOrigin, shortSpanThreshold,
//     templateId (perfiles+costanera), purlinCommercialLength, purlinOverlap,
//     highWalls: [wallId...]  // muros de apoyo alto que definen los tramos }
//
// Este módulo NO persiste nada ni crea sistemas: resuelve el faldón a geometría y devuelve el
// plan. La UI decide crear/guardar. Puro y testeable contra el modelo real.

import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';
import { computeSlopeFromClearance, resolveTrussProfileDims } from './trussLayout.js';
import { resolveSupportLine, coverageAt } from './supportLine.js';
import { buildTrussChain } from './trussChain.js';
import { buildRoofPurlins } from './roofPurlins.js';
import { findRoofObstructions, applyObstructionsToRun } from './roofObstructions.js';
import { runExtentOf, polygonBounds, edgeOverlapOnPerp } from './polygonClip.js';
import { resolvePurlinParams } from './trussTemplates.js';

const EPS = 1;
const MIN_TRAMO = 200;

/** cos del ángulo de techo para una pendiente en % (proyección horizontal -> inclinada). */
function cosSlope(slopePercent) {
  return 1 / Math.sqrt(1 + (slopePercent / 100) ** 2);
}

/**
 * Resuelve un faldón completo a geometría.
 *
 * @param opts.model
 * @param opts.plane        el roofPlane persistido (ver cabecera)
 * @param opts.paramsMap
 * @param opts.elementsById
 * @param opts.library
 * @returns {{
 *   resolved, runAxis, perp, supportElevation, slopePercent,
 *   supportLine,              // salida de resolveSupportLine (canaleta)
 *   tramos: [{ wallHighId, runFrom, runTo, span, inclSpan, coveredLow, coveredHigh }],
 *   trussPositions,           // cadena global [{offset, kind}]
 *   purlins,                  // costaneras del faldón
 *   findings: [{severity, category, message}],
 *   warnings
 * }}
 */
export function resolveRoofPlane({ model, plane, paramsMap = {}, elementsById = {}, library = null } = {}) {
  const warnings = [];
  const findings = [];
  const grid = model.grid;
  const walls = (model.elements || []).filter(e => e.type === 'wall');

  const canal = walls.find(w => w.id === plane.canalWallId);
  if (!canal) return fail('el muro de canaleta no existe');
  const canalGeo = resolveWallGeometry(canal, grid, paramsMap, elementsById);
  if (!canalGeo) return fail('geometría de la canaleta no resuelta');
  const runAxis = isWallXRun(canal) ? 'x' : 'y';
  const perpCanal = runAxis === 'x' ? canalGeo.p1.y : canalGeo.p1.x;

  // --- cota de apoyo (nivel de cielo + offset) ----------------------------------------------
  const lvl = grid.zLevels.find(l => l.id === plane.supportLevelId || l.id === Number(plane.supportLevelId));
  if (!lvl) return fail('nivel de cielo de apoyo no encontrado');
  const supportOffset = resolveValue(plane.supportOffset ?? 100, paramsMap, elementsById);
  const supportElevation = lvl.elevation + supportOffset;

  // --- B4.1: línea de apoyo baja (canaleta, fusionando colineales) ---------------------------
  const supportLine = resolveSupportLine({ model, seedWallId: canal.id, supportElevation, paramsMap, elementsById });
  for (const w of supportLine.warnings) findings.push({ severity: 'info', category: 'supportLine', message: `canaleta: ${w}` });
  if (!supportLine.resolved) return fail('la canaleta no tiene apoyo vivo a la cota');

  // corrida completa del faldón = extensión de la línea de apoyo baja
  let runFrom = supportLine.segments[0].from;
  let runTo = supportLine.segments[supportLine.segments.length - 1].to;

  // --- polígono: acota la corrida y detecta los apoyos altos dentro del contorno -------------
  // Con polígono, la corrida se limita a su extensión sobre el eje de corrida (adiós fachada
  // colineal), y los altos se detectan automáticamente: muros paralelos a la canaleta, vivos a la
  // cota, del lado alto, cuya huella cae dentro del polígono. Esto reemplaza plane.highWalls.
  let detectedHighWalls = plane.highWalls || [];
  if (plane.polygon && plane.polygon.length >= 3) {
    const [pFrom, pTo] = runExtentOf(plane.polygon, runAxis);
    runFrom = Math.max(runFrom, pFrom);
    runTo = Math.min(runTo, pTo);
    // lado alto del polígono: coordenada perpendicular más lejana de la canaleta
    const pb = polygonBounds(plane.polygon);
    const perpValsHigh = runAxis === 'x' ? [pb.minY, pb.maxY] : [pb.minX, pb.maxX];
    const highPerp = perpValsHigh.reduce((a, b) => (Math.abs(b - perpCanal) > Math.abs(a - perpCanal) ? b : a));
    const spanDir0 = Math.sign(highPerp - perpCanal) || 1;
    detectedHighWalls = detectHighWalls({
      walls, grid, paramsMap, elementsById, runAxis, canal, perpCanal, spanDir0,
      supportElevation, polygon: plane.polygon
    });
    if (!detectedHighWalls.length) {
      findings.push({ severity: 'error', category: 'highSupport', message: 'no se detectó ningún muro de apoyo alto dentro del polígono a la cota de apoyo' });
    }
  }


  // --- tramos: un rectángulo por muro de apoyo alto -----------------------------------------
  // Cada highWall define su rango de corrida (solape con la canaleta) y su luz (distancia entre
  // caras interiores). Los tramos NO se solapan: si dos altos compiten en un rango, gana el más
  // cercano (el primero que la cercha encuentra). Aquí asumimos que highWalls ya vienen definidos
  // por el usuario en orden; el barrido automático es del generador (planRoofPlane, más abajo).
  const tramos = [];
  const highLines = [];
  for (const hid of detectedHighWalls) {
    const line = resolveSupportLine({ model, seedWallId: hid, supportElevation, paramsMap, elementsById });
    if (!line.resolved) { findings.push({ severity: 'error', category: 'highSupport', message: `apoyo alto ${hid} sin cobertura a la cota ${Math.round(supportElevation)}mm` }); continue; }
    for (const w of line.warnings) findings.push({ severity: 'info', category: 'highSupport', message: `apoyo alto ${hid}: ${w}` });
    highLines.push({ wallId: hid, line });
  }
  if (!highLines.length) return fail('el faldón no tiene ningún apoyo alto resuelto');

  // luz y rango de cada tramo
  for (const { wallId, line } of highLines) {
    const perpHigh = line.perp;
    const centerDist = Math.abs(perpHigh - perpCanal);
    const span = centerDist - supportLine.thickness / 2 - line.thickness / 2; // caras interiores
    if (!(span > EPS)) { findings.push({ severity: 'error', category: 'span', message: `apoyo alto ${wallId}: luz ≤ 0 (se superpone con la canaleta)` }); continue; }
    // rango de corrida = solape de la canaleta con este apoyo alto, acotado al polígono
    const hFrom = line.segments[0].from, hTo = line.segments[line.segments.length - 1].to;
    let tFrom = Math.max(runFrom, hFrom), tTo = Math.min(runTo, hTo);
    if (plane.polygon && plane.polygon.length >= 3) {
      const [pFrom, pTo] = runExtentOf(plane.polygon, runAxis);
      tFrom = Math.max(tFrom, pFrom); tTo = Math.min(tTo, pTo);
    }
    if (!(tTo - tFrom > MIN_TRAMO)) continue;
    // highThickness: se guarda para derivar la CARA INTERIOR del apoyo alto (perpHighInner) una vez
    // conocido spanDirOut, igual que perpInner hace con la canaleta.
    tramos.push({ wallHighId: wallId, runFrom: tFrom, runTo: tTo, span, perpHigh, highThickness: line.thickness });
  }
  if (!tramos.length) return fail('ningún apoyo alto solapa la canaleta con largo útil');
  tramos.sort((a, b) => a.runFrom - b.runFrom);

  // --- pendiente única: mínima entre tramos (la más restrictiva) -----------------------------
  const heelHeight = resolveValue(plane.heelHeight ?? 0, paramsMap, elementsById);
  const crownClearance = resolveValue(plane.crownClearance ?? 200, paramsMap, elementsById);
  // ★ B4.7.2 — perfil+paso de costanera heredados de la plantilla del proyecto (library). El faldón
  // hereda; findings de migración si trae valores propios divergentes.
  const purlinParams = resolvePurlinParams({ plane, library });
  for (const f of purlinParams.findings) findings.push(f);
  const purlinH = purlinParams.profileH ?? 0; // altura del perfil de costanera (para holgura)
  let slopePercent = Infinity;
  let governing = null;
  for (const t of tramos) {
    const highWall = walls.find(w => w.id === t.wallHighId);
    const crownElev = grid.zLevels.find(l => l.id === highWall?.topZ)?.elevation;
    if (crownElev == null) { findings.push({ severity: 'error', category: 'crown', message: `apoyo alto ${t.wallHighId}: coronación no resuelta` }); continue; }
    const auto = computeSlopeFromClearance({
      span: t.span, heelHeight, supportElev: supportElevation, crownElev, crownClearance, purlinHeight: purlinH
    });
    t.autoSlope = auto.slopePercent;
    t.crownElev = crownElev;
    if (auto.valid && auto.slopePercent < slopePercent) { slopePercent = auto.slopePercent; governing = t; }
  }
  if (!Number.isFinite(slopePercent)) return fail('no se pudo derivar la pendiente del faldón (ninguna coronación válida)');
  warnings.push(`pendiente única ${slopePercent.toFixed(2)}% derivada del tramo de luz ${Math.round(governing.span)}mm (el más restrictivo)`);

  // inclSpan de cada tramo con la pendiente única
  const cos = cosSlope(slopePercent);
  for (const t of tramos) {
    t.inclSpan = t.span / cos;
    // holgura real bajo su coronación con la pendiente COMÚN (informativo: cuánto se esconde)
    const topmost = supportElevation + heelHeight + (slopePercent / 100) * t.span + purlinH;
    t.hiddenBy = t.crownElev - crownClearance - topmost; // ≥0 = ok, cuánto sobra
    // ★ pregunta 2: si un tramo queda SOBRE su coronación con la pendiente única, las coronaciones
    // son incompatibles. No se fuerza: se avisa para que Fran parta en dos faldones o ajuste apoyos.
    if (t.hiddenBy < -EPS) {
      findings.push({ severity: 'error', category: 'incompatibleSlope',
        message: `el tramo de luz ${Math.round(t.span)}mm se pasa ${Math.round(-t.hiddenBy)}mm sobre su coronación con la pendiente única ${slopePercent.toFixed(2)}% — coronaciones incompatibles: partir en dos faldones o ajustar apoyos` });
    }
  }

  // --- B4.2: cadena global de cerchas sobre toda la corrida ----------------------------------
  // frontones que cruzan la banda del faldón: los de los EXTREMOS recortan la corrida a su cara
  // interior (evita cercha embebida en el borde); los del MEDIO se pasan a la cadena para reubicar
  // la cercha a la cara (no parten el faldón — la cuerda superior apoya continua sobre el muro).
  const bandLo = perpCanal + Math.sign(governing.perpHigh - perpCanal) * supportLine.thickness / 2;
  const bandHi = governing.perpHigh;
  const { obstacles } = findRoofObstructions({
    walls, grid, paramsMap, elementsById, runAxis,
    bandFrom: bandLo, bandTo: bandHi, supportElevation,
    excludeIds: [canal.id, ...(plane.highWalls || [])]
  });
  const adj = applyObstructionsToRun(runFrom, runTo, obstacles);
  if (adj.edgeLow) { runFrom = adj.from; findings.push({ severity: 'info', category: 'edge', message: `frontón ${adj.edgeLow.wallId} cierra el extremo inicial — corrida recortada a su cara (${Math.round(adj.from)}mm)` }); }
  if (adj.edgeHigh) { runTo = adj.to; findings.push({ severity: 'info', category: 'edge', message: `frontón ${adj.edgeHigh.wallId} cierra el extremo final — corrida recortada a su cara (${Math.round(adj.to)}mm)` }); }
  // los frontones intermedios (blocking) se reubican en la cadena, no parten el faldón
  const midWalls = adj.blocking.map(o => ({ oMin: o.oMin, oMax: o.oMax, wallId: o.wallId }));
  const chain = buildTrussChain({
    from: runFrom, to: runTo,
    spacing: resolveValue(plane.trussSpacing ?? 1200, paramsMap, elementsById),
    origin: plane.chainOrigin || 'start',
    shortSpanThreshold: plane.shortSpanThreshold ?? 500,
    intermediateWalls: midWalls
  });
  for (const w of chain.warnings) findings.push({ severity: 'info', category: 'chain', message: w });

  // recortar los tramos a la corrida final (tras el ajuste por frontones extremos)
  for (const t of tramos) { t.runFrom = Math.max(t.runFrom, runFrom); t.runTo = Math.min(t.runTo, runTo); }

  // --- cobertura por cercha: cada cercha necesita apoyo bajo Y alto a la cota ----------------
  // el objetivo del .inp: ninguna cercha apoyada en el aire.
  for (const p of chain.positions) {
    if (!coverageAt(supportLine, p.offset)) {
      findings.push({ severity: 'error', category: 'noLowSupport', message: `cercha en ${Math.round(p.offset)}mm sin canaleta bajo ella (hueco en la línea de apoyo baja)` });
    }
    // ¿qué tramo la cubre arriba?
    const t = tramos.find(tr => p.offset >= tr.runFrom - EPS && p.offset <= tr.runTo + EPS);
    if (!t) {
      findings.push({ severity: 'error', category: 'noHighSupport', message: `cercha en ${Math.round(p.offset)}mm fuera de todo tramo con apoyo alto` });
    } else if (!coverageAt(highLines.find(h => h.wallId === t.wallHighId).line, p.offset)) {
      findings.push({ severity: 'error', category: 'noHighSupport', message: `cercha en ${Math.round(p.offset)}mm sin apoyo alto vivo (hueco a la cota ${Math.round(supportElevation)}mm)` });
    }
  }

  // --- B4.3: costaneras del faldón -----------------------------------------------------------
  const purlinsRes = buildRoofPurlins({
    segments: tramos.map(t => ({ runFrom: t.runFrom, runTo: t.runTo, inclSpan: t.inclSpan })),
    spacing: resolveValue(purlinParams.spacing ?? 600, paramsMap, elementsById),
    startOffset: resolveValue(plane.gutterNotchWidth ?? 200, paramsMap, elementsById),
    commercialLength: plane.purlinCommercialLength ?? 0,
    overlap: plane.purlinOverlap ?? 0,
    trussOffsets: chain.positions.map(p => p.offset)
  });
  for (const w of purlinsRes.warnings) findings.push({ severity: 'info', category: 'purlin', message: w });

  const spanDirOut = Math.sign(governing.perpHigh - perpCanal) || 1;
  // x_local = 0 de la cercha = CARA INTERIOR de la canaleta, no su eje. Sin esto la cercha se
  // dibuja/exporta medio espesor dentro del muro bajo y a medio espesor del muro alto.
  const perpInner = perpCanal + spanDirOut * supportLine.thickness / 2;

  // --- A-01: solera de apoyo lateral ---------------------------------------------------------
  // La solera va DEBAJO de la cuerda inferior, dentro de la holgura del cielo falso: ocupa
  // [supportElevation − hSolera, supportElevation]. De ahí la restricción hSolera ≤ supportOffset:
  // si el perfil es más alto que la holgura, la solera invade el cielo falso.
  const ledgerCode = plane.supportProfile || plane.profiles?.bottomChord || null;
  const ledgerEntry = ledgerCode ? (library?.metalconProfiles || []).find(p => p.code === ledgerCode) : null;
  let supportLedgerProfile = null;
  if (!ledgerEntry) {
    findings.push({ severity: 'info', category: 'supportLedger',
      message: `solera de apoyo: perfil ${ledgerCode || 'no definido'} no resoluble en la librería — no se puede verificar que quepa en la holgura de cielo (${Math.round(supportOffset)}mm)` });
  } else {
    const dims = resolveTrussProfileDims(library, ledgerCode);
    supportLedgerProfile = { code: ledgerCode, h: dims.h, b: dims.b };
    if (dims.h > supportOffset + EPS) {
      findings.push({ severity: 'error', category: 'supportLedger',
        message: `solera de apoyo ${ledgerCode}: alto ${Math.round(dims.h)}mm > holgura de cielo ${Math.round(supportOffset)}mm — la solera invade el cielo falso (subir supportOffset o usar un perfil más bajo)` });
    }
  }

  return {
    resolved: true, runAxis, perp: perpCanal, perpInner, supportElevation, slopePercent,
    spanDir: spanDirOut,
    supportOffset,
    supportLedgerProfile,           // {code,h,b} | null — alto de la solera para base/top del ledger
    supportLine,
    tramos: tramos.map(t => ({
      wallHighId: t.wallHighId, runFrom: t.runFrom, runTo: t.runTo,
      span: t.span, inclSpan: t.inclSpan, hiddenBy: t.hiddenBy, perpHigh: t.perpHigh,
      // cara interior del apoyo alto (mismo patrón que perpInner en la canaleta)
      perpHighInner: t.perpHigh - spanDirOut * t.highThickness / 2
    })),
    trussPositions: chain.positions,
    purlins: purlinsRes.purlins,
    findings, warnings
  };

  function fail(msg) {
    return { resolved: false, runAxis, perp: perpCanal, supportElevation: null, slopePercent: null,
      supportLine: null, tramos: [], trussPositions: [], purlins: [],
      findings: [...findings, { severity: 'error', category: 'plane', message: msg }], warnings };
  }
}

/** Detecta muros de apoyo alto dentro del polígono: paralelos a la canaleta, vivos a la cota, del
 * lado alto (sentido spanDir0 desde la canaleta), con su perpendicular dentro del contorno y su
 * huella solapando la extensión de corrida del polígono. Devuelve ids únicos. */
function detectHighWalls({ walls, grid, paramsMap, elementsById, runAxis, canal, perpCanal, spanDir0, supportElevation, polygon }) {
  const pb = polygonBounds(polygon);
  const [runLoP, runHiP] = runAxis === 'x' ? [pb.minX, pb.maxX] : [pb.minY, pb.maxY];
  const [perpLoP, perpHiP] = runAxis === 'x' ? [pb.minY, pb.maxY] : [pb.minX, pb.maxX];
  const ids = new Set();
  for (const w of walls) {
    if (w.id === canal.id) continue;
    if (isWallXRun(w) !== isWallXRun(canal)) continue; // debe ser paralelo a la canaleta
    const geo = resolveWallGeometry(w, grid, paramsMap, elementsById);
    if (!geo) continue;
    const perp = runAxis === 'x' ? geo.p1.y : geo.p1.x;
    // del lado alto y estrictamente más lejos que la canaleta
    if (spanDir0 * (perp - perpCanal) <= EPS) continue;
    // su perpendicular debe caer dentro del rango perpendicular del polígono (con tolerancia)
    if (perp < perpLoP - 2 || perp > perpHiP + 2) continue;
    // vivo a la cota
    const zb = grid.zLevels.find(l => l.id === w.bottomZ)?.elevation;
    const zt = grid.zLevels.find(l => l.id === w.topZ)?.elevation;
    if (zb == null || zt == null) continue;
    if (supportElevation < Math.min(zb, zt) - 1 || supportElevation > Math.max(zb, zt) + 1) continue;
    // su huella sobre el eje de corrida debe solapar la extensión del polígono
    const a = runAxis === 'x' ? geo.p1.x : geo.p1.y;
    const b = runAxis === 'x' ? geo.p2.x : geo.p2.y;
    const wLo = Math.min(a, b), wHi = Math.max(a, b);
    if (Math.min(wHi, runHiP) - Math.max(wLo, runLoP) <= MIN_TRAMO) continue;
    // ★ B4.6: además de caer en el bbox, el muro debe COINCIDIR con un borde real del polígono a
    // su perpendicular (un muro de un faldón vecino que asome dentro del bbox pero no forme parte
    // del contorno tiene solape 0 con el borde y se descarta).
    if (edgeOverlapOnPerp(polygon, runAxis, perp, wLo, wHi) <= MIN_TRAMO) continue;
    ids.add(w.id);
  }
  return [...ids];
}
