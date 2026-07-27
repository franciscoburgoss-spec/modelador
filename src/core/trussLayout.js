// core/trussLayout.js
// Cercha de un agua (monopitch) Metalcon + sistema de techumbre entre dos frontones.
//
// Geometría de UNA cercha, en coordenadas LOCALES: x = 0 en la cara interior del muro/frontón
// BAJO (extremo de la canaleta), x = span en la cara interior del frontón ALTO; y = 0 en la cota
// de apoyo (nivel superior del muro de apoyo). Todo en mm.
//
// El plano de techo es y = heelHeight + (slopePercent/100) * x. Con rebaje de canaleta
// (gutterNotchWidth > 0), el tramo [0..notchW] de la cuerda superior se reemplaza por una cuerda
// horizontal en y = heelHeight (donde se aloja la canaleta oculta, típico mediterráneo con
// tapacán) + un montante de cierre en x = notchW — el vano libre para la canaleta es el espacio
// entre esa horizontal y el plano del techo.
//
// El sistema (computeRoofSystemLayout) genera las posiciones de todas las cerchas entre dos
// muros de apoyo PARALELOS (frontones bajo/alto): luz = distancia entre caras interiores,
// cerchas repartidas uniformemente @trussSpacing a lo largo del solapamiento de ambos muros.
import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { findRoofObstructions, applyObstructionsToRun } from './roofObstructions.js';

const EPS = 0.5;

/** Reparto uniforme: n intervalos = ceil(len/spacing) (spacing es un MÁXIMO, como en obra),
 * posiciones equiespaciadas incluyendo ambos extremos. */
function uniformPositions(from, to, spacing) {
  const len = to - from;
  if (!(len > EPS) || !(spacing > EPS)) return [from, to];
  const n = Math.max(1, Math.ceil(len / spacing - 1e-9));
  const step = len / n;
  const out = [];
  for (let i = 0; i <= n; i++) out.push(from + i * step);
  return out;
}

/**
 * Geometría 2D de una cercha de un agua.
 * @param config { span, slopePercent, heelHeight, gutterNotchWidth,
 *                 postSpacing, diagonalPattern: 'W'|'none',
 *                 profiles: {topChord, bottomChord, post, diagonal, gutterChord?},
 *                 purlinProfile, purlinSpacing }
 * @returns { resolved, span, heightLow, heightHigh, members: [{role,x1,y1,x2,y2,profile}],
 *            purlins: [{x,y,s}], warnings }
 */
export function computeMonoTrussGeometry(config = {}) {
  const warnings = [];
  const span = Number(config.span) || 0;
  const slope = Number(config.slopePercent) || 0;
  const heel = Math.max(0, Number(config.heelHeight) || 0);
  const notchW = Math.max(0, Number(config.gutterNotchWidth) || 0);
  const postSpacing = Number(config.postSpacing) || 600;
  const diagonalPattern = config.diagonalPattern || 'W';
  const profiles = config.profiles || {};

  if (!(span > EPS)) return { resolved: false, span, members: [], purlins: [], warnings: ['luz de cercha inválida (span ≤ 0)'] };
  if (!(slope > 0)) return { resolved: false, span, members: [], purlins: [], warnings: ['pendiente debe ser mayor que 0%'] };
  if (notchW >= span) return { resolved: false, span, members: [], purlins: [], warnings: ['el rebaje de canaleta no puede ser ≥ la luz'] };

  const yTop = (x) => heel + (slope / 100) * x;
  const xs = notchW; // donde arranca (y remata) la cuerda superior inclinada
  const heightLow = yTop(0);
  const heightHigh = yTop(span);
  const members = [];
  const push = (role, x1, y1, x2, y2) =>
    members.push({ role, x1, y1, x2, y2, profile: profiles[role] || null });

  // cuerdas
  push('bottomChord', 0, 0, span, 0);
  push('topChord', xs, yTop(xs), span, yTop(span));

  // extremo bajo — dos configuraciones:
  // · SIN rebaje: montante de talón en x=0 (si hay talón).
  // · CON rebaje (canaleta): vano RECTANGULAR [0..notchW] × [0..yTop(notchW)] completamente
  //   LIBRE con fondo en la cuerda inferior — la cuerda superior remata justo en el borde del
  //   rebaje (x=notchW) y un montante vertical cierra ahí; ninguna pieza invade el espacio
  //   que ocupará la canaleta.
  if (notchW > EPS) {
    push('post', notchW, 0, notchW, yTop(notchW)); // cierre vertical del rebaje
  } else if (heel > EPS) {
    push('post', 0, 0, 0, heel);
  }
  // extremo alto: montante de borde completo
  push('post', span, 0, span, yTop(span));

  // montantes internos: reparto uniforme entre xs y span (los extremos ya existen)
  const postXs = uniformPositions(xs, span, postSpacing);
  for (const x of postXs) {
    if (x - xs < EPS || span - x < EPS) continue; // extremos ya dibujados
    push('post', x, 0, x, yTop(x));
  }

  // diagonales patrón W: entre montantes consecutivos, alternando base→cabeza / cabeza→base.
  // Cerca del apoyo la diagonal trabaja mejor subiendo hacia el interior (comprimida corta).
  if (diagonalPattern === 'W') {
    for (let i = 0; i < postXs.length - 1; i++) {
      const xa = postXs[i], xb = postXs[i + 1];
      if (i % 2 === 0) push('diagonal', xa, 0, xb, yTop(xb));
      else push('diagonal', xa, yTop(xa), xb, 0);
    }
  }

  // costaneras: puntos sobre la cuerda superior, spacing medido en distancia INCLINADA (como se
  // instalan en obra), primera y última en los extremos de la cuerda, reparto uniforme.
  const purlins = [];
  const purlinSpacing = Number(config.purlinSpacing) || 0;
  if (purlinSpacing > EPS) {
    const cos = 1 / Math.sqrt(1 + (slope / 100) ** 2); // proyección horizontal por mm inclinado
    const inclLen = (span - xs) / cos;
    for (const s of uniformPositions(0, inclLen, purlinSpacing)) {
      const x = xs + s * cos;
      purlins.push({ x, y: yTop(x), s, profile: config.purlinProfile || null });
    }
  }

  return {
    resolved: true, span, heightLow, heightHigh, members, purlins, warnings,
    // rectángulo del vano de canaleta (si hay rebaje) — fondo sobre la cuerda inferior
    gutterNotch: notchW > EPS ? { width: notchW, height: yTop(notchW) } : null
  };
}

/**
 * Pendiente derivada: la pendiente (%) tal que el punto más alto de la cercha (cuerda superior
 * en x=span, + costanera si aplica) quede exactamente en `crownElev - crownClearance`.
 * Mismo punto que valida `computeRoofSystemLayout` (heightViolation): heightHigh = heelHeight +
 * (slopePercent/100)*span, y topmost = supportElev + heightHigh + purlinHeight.
 * @param {{span:number, heelHeight?:number, supportElev:number, crownElev:number,
 *          crownClearance?:number, purlinHeight?:number}} params
 * @returns {{slopePercent:number, valid:boolean, warnings:string[]}}
 */
export function computeSlopeFromClearance({
  span, heelHeight = 0, supportElev, crownElev, crownClearance = 200, purlinHeight = 0
} = {}) {
  if (!(span > EPS)) {
    return { slopePercent: 0, valid: false, warnings: ['luz de cercha inválida (span ≤ 0)'] };
  }
  if (supportElev == null || crownElev == null) {
    return { slopePercent: 0, valid: false, warnings: ['cota de apoyo o de coronación no resuelta'] };
  }
  const maxAllowed = crownElev - crownClearance;
  const availableRise = maxAllowed - supportElev - heelHeight - purlinHeight;
  const slopePercent = (availableRise / span) * 100;
  if (!(slopePercent > 0)) {
    return {
      slopePercent, valid: false,
      warnings: [`pendiente automática ${slopePercent.toFixed(1)}% ≤ 0 — talón/holgura/costanera ya ocupan toda la holgura disponible bajo la coronación`]
    };
  }
  return { slopePercent, valid: true, warnings: [] };
}

/**
 * Sistema de techumbre: cerchas de un agua entre dos frontones (muros de apoyo paralelos).
 * @returns { resolved, span, supportElevation, trussPositions: [{offset, world:{x,y}}],
 *            trussGeometry, runAxis, warnings }
 */
export function computeRoofSystemLayout(system, grid, paramsMap = {}, elementsById = {}, elements = [], library = null) {
  const warnings = [];
  const wallLow = elements.find(e => e.id === system.wallLowId);
  const wallHigh = elements.find(e => e.id === system.wallHighId);
  if (!wallLow || !wallHigh) return { resolved: false, warnings: ['seleccionar muro de apoyo bajo y alto'] };
  if (wallLow.id === wallHigh.id) return { resolved: false, warnings: ['los dos apoyos no pueden ser el mismo muro'] };

  const lowXRun = isWallXRun(wallLow), highXRun = isWallXRun(wallHigh);
  if (lowXRun !== highXRun) return { resolved: false, warnings: ['los muros de apoyo deben ser paralelos (misma dirección)'] };

  const geoLow = resolveWallGeometry(wallLow, grid, paramsMap, elementsById);
  const geoHigh = resolveWallGeometry(wallHigh, grid, paramsMap, elementsById);
  if (!geoLow || !geoHigh) return { resolved: false, warnings: ['geometría de muro de apoyo no resuelta'] };

  // posición perpendicular de cada muro (para xRun es su Y; ambos extremos coinciden en ella)
  const perp = (geo) => lowXRun ? geo.p1.y : geo.p1.x;
  const pLow = perp(geoLow), pHigh = perp(geoHigh);
  const centerDist = Math.abs(pHigh - pLow);
  const span = centerDist - geoLow.thickness / 2 - geoHigh.thickness / 2; // caras interiores
  if (!(span > EPS)) return { resolved: false, warnings: ['los muros de apoyo se superponen — luz entre caras interiores ≤ 0'] };

  // --- cota de apoyo: nivel de CIELO seleccionado + offset (default 100mm — encintado +
  // espacio de instalaciones entre el cielo falso y la cara inferior de la cuerda inferior).
  // La cercha queda ESCONDIDA dentro de los frontones, nunca apoyada sobre la coronación.
  // Fallback (sistemas guardados sin supportLevelId): nivel superior menor de los dos muros. ---
  const supportOffset = resolveValue(system.supportOffset ?? 100, paramsMap, elementsById);
  let supportElevation;
  if (system.supportLevelId != null && system.supportLevelId !== '') {
    const lvl = grid.zLevels.find(l => l.id === system.supportLevelId || l.id === Number(system.supportLevelId));
    if (!lvl) return { resolved: false, warnings: ['nivel de cielo de apoyo no encontrado'] };
    supportElevation = lvl.elevation + supportOffset;
  } else {
    const topElev = (w) => grid.zLevels.find(l => l.id === w.topZ)?.elevation;
    const eLow = topElev(wallLow), eHigh = topElev(wallHigh);
    if (eLow == null || eHigh == null) return { resolved: false, warnings: ['nivel superior de muro de apoyo no resuelto'] };
    supportElevation = Math.min(eLow, eHigh);
    warnings.push('sin nivel de cielo seleccionado — apoyo en el nivel superior del muro (seleccionar cielo + offset para esconder la cercha en el frontón)');
  }

  // rango de cerchas: solapamiento de ambos muros en su dirección de corrida
  const runRange = (geo) => {
    const a = lowXRun ? geo.p1.x : geo.p1.y;
    const b = lowXRun ? geo.p2.x : geo.p2.y;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const [lo1, hi1] = runRange(geoLow);
  const [lo2, hi2] = runRange(geoHigh);
  let from = Math.max(lo1, lo2), to = Math.min(hi1, hi2);
  if (!(to - from > EPS)) return { resolved: false, warnings: ['los muros de apoyo no se solapan a lo largo — no hay dónde colocar cerchas'] };
  const overlapRange = { from, to };

  // --- zona de techumbre (sesión 23): rango OPCIONAL sobre el eje de corrida que acota el tramo
  // cubierto por ESTE sistema, sin partir los muros de apoyo. Coordenada ABSOLUTA de mundo (la
  // misma que `from`/`to`), no offset relativo al muro: así dos zonas contiguas se definen con el
  // mismo número en el borde común y no dependen de en qué extremo arranque cada muro.
  // `null`/ausente = solape completo (comportamiento previo a la 23). ---
  if (system.runRange && (system.runRange.from != null || system.runRange.to != null)) {
    const rf = system.runRange.from == null ? from : resolveValue(system.runRange.from, paramsMap, elementsById);
    const rt = system.runRange.to == null ? to : resolveValue(system.runRange.to, paramsMap, elementsById);
    if (!Number.isFinite(rf) || !Number.isFinite(rt)) {
      return { resolved: false, warnings: ['la zona de techumbre tiene un límite no numérico'], overlapRange };
    }
    const zLo = Math.min(rf, rt), zHi = Math.max(rf, rt);
    const clampedFrom = Math.max(from, zLo), clampedTo = Math.min(to, zHi);
    if (!(clampedTo - clampedFrom > EPS)) {
      return {
        resolved: false, overlapRange,
        warnings: [`la zona de techumbre (${Math.round(zLo)}→${Math.round(zHi)}mm) no intersecta el solape de los muros de apoyo (${Math.round(from)}→${Math.round(to)}mm)`]
      };
    }
    if (zLo < from - EPS || zHi > to + EPS) {
      warnings.push(`la zona se recortó al solape de los muros de apoyo: ${Math.round(clampedFrom)}→${Math.round(clampedTo)}mm`);
    }
    from = clampedFrom;
    to = clampedTo;
  }

  const trussSpacing = resolveValue(system.trussSpacing ?? 1200, paramsMap, elementsById);
  const spanDir = Math.sign(pHigh - pLow) || 1; // sentido en que avanza el x local de la cercha (bajo→alto) sobre el eje perpendicular
  const innerLow = pLow + spanDir * geoLow.thickness / 2; // cara interior del muro bajo
  const innerHigh = pHigh - spanDir * geoHigh.thickness / 2; // cara interior del muro alto

  // --- interferencia con frontones (sesión 25) ------------------------------------------------
  // Antes las cerchas se repartían sobre [from,to] sin mirar ningún otro muro: si había un
  // frontón interior en un extremo, la primera/última cercha quedaba EMBEBIDA en él — invisible
  // en 3D pero contada en metrado, .inp y DXF. Ahora la corrida se recorta a la cara interior del
  // frontón y esa cercha se degrada a CUERDA SUPERIOR de borde (atornillada a la cara, tope de
  // costaneras, sin trabajo estructural de cercha). Ver core/roofObstructions.js.
  const { obstacles, crossing } = findRoofObstructions({
    walls: elements.filter(e => e.type === 'wall'),
    grid, paramsMap, elementsById,
    runAxis: lowXRun ? 'x' : 'y',
    bandFrom: innerLow, bandTo: innerHigh,
    supportElevation,
    excludeIds: [wallLow.id, wallHigh.id]
  });
  const adjusted = applyObstructionsToRun(from, to, obstacles);
  if (adjusted.collapsed) {
    return {
      resolved: false, overlapRange,
      warnings: [...warnings, `los frontones dejan la corrida sin largo útil entre ${Math.round(from)} y ${Math.round(to)}mm — revisar la zona o los muros que la cruzan`]
    };
  }
  if (adjusted.edgeLow) warnings.push(`la primera cercha interfería con el frontón ${adjusted.edgeLow.wallId}: se desplazó a su cara interior (${Math.round(adjusted.edgeLow.face)}mm) y queda como cuerda superior de borde`);
  if (adjusted.edgeHigh) warnings.push(`la última cercha interfería con el frontón ${adjusted.edgeHigh.wallId}: se desplazó a su cara interior (${Math.round(adjusted.edgeHigh.face)}mm) y queda como cuerda superior de borde`);
  for (const b of adjusted.blocking) warnings.push(`el frontón ${b.wallId} cruza la techumbre por el medio (${Math.round(b.oMin)}→${Math.round(b.oMax)}mm) — no se resuelve moviendo una cercha: partir la zona en dos`);
  for (const c of crossing) warnings.push(`el muro ${c.wallId} corre paralelo a las cerchas dentro de la techumbre — la cercha lo atraviesa a lo largo de su luz; declararlo como apoyo o revisar la zona`);
  from = adjusted.from;
  to = adjusted.to;

  const rawOffsets = uniformPositions(from, to, trussSpacing);
  const trussPositions = rawOffsets.map((offset, i) => {
    const isFirst = i === 0, isLast = i === rawOffsets.length - 1;
    const edge = (isFirst && adjusted.edgeLow) || (isLast && adjusted.edgeHigh) || null;
    return {
      offset,
      kind: edge ? 'edgeChord' : 'full',
      ...(edge ? { againstWallId: edge.wallId } : {}),
      world: lowXRun ? { x: offset, y: innerLow } : { x: innerLow, y: offset }
    };
  });

  // --- modo de apoyo + verificación de que el muro EXISTE en la cota de apoyo -----------------
  // 'coronacion': la cercha descansa sobre el muro (dentro de su rango vertical). Si la cota de
  // apoyo cae fuera del rango [base, coronación] del muro, la cercha queda apoyada en el aire.
  // 'lateral': solera/ledger atornillada a la CARA del frontón — se relaja el caso "bajo el
  // arranque" (el muro colineal inferior recibe la solera) y se registra el perfil para metrado.
  const supportMode = system.supportMode === 'lateral' ? 'lateral' : 'coronacion';
  const wallElevRange = (w) => {
    const b = grid.zLevels.find(l => l.id === w.bottomZ)?.elevation;
    const t = grid.zLevels.find(l => l.id === w.topZ)?.elevation;
    return (b == null || t == null) ? null : [Math.min(b, t), Math.max(b, t)];
  };
  let supportViolation = false;
  for (const [w, label] of [[wallLow, 'bajo'], [wallHigh, 'alto']]) {
    const range = wallElevRange(w);
    if (!range) {
      warnings.push(`no se pudo verificar el rango vertical del muro de apoyo ${label} (nivel base o superior no resuelto)`);
      continue;
    }
    const [zb, zt] = range;
    const cota = `cota de apoyo ${Math.round(supportElevation)}mm`;
    const rango = `muro ${zb}→${zt}mm`;
    if (supportElevation > zt + EPS) {
      supportViolation = true;
      warnings.push(`el muro de apoyo ${label} no llega a la cota de apoyo: ${cota} SOBRE su coronación (${rango}) — subir el muro o bajar el nivel de cielo/offset`);
    } else if (supportElevation < zb - EPS) {
      if (supportMode === 'lateral') {
        warnings.push(`apoyo lateral: el muro de apoyo ${label} arranca sobre la ${cota} (${rango}) — la solera se fija al muro colineal inferior; verificar que exista y llegue a esa cota`);
      } else {
        supportViolation = true;
        warnings.push(`el muro de apoyo ${label} no llega a la cota de apoyo: ${cota} BAJO su arranque (${rango}) — subir el nivel de cielo/offset, extender el muro hacia abajo o usar apoyo lateral`);
      }
    }
  }

  const heelHeight = resolveValue(system.heelHeight ?? 0, paramsMap, elementsById);
  const crownClearance = resolveValue(system.crownClearance ?? 200, paramsMap, elementsById);
  const purlinH = system.purlinProfile ? resolveTrussProfileDims(library, system.purlinProfile, 35).h : 0;
  const crownElev = grid.zLevels.find(l => l.id === wallHigh.topZ)?.elevation;

  // --- slopeMode 'auto': la pendiente se DERIVA de la holgura de coronación (en vez de venir
  // de system.slopePercent) — se resuelve ANTES de generar trussGeometry. En este modo la
  // violación de coronación es imposible por construcción (ver más abajo). ---
  const isAutoSlope = system.slopeMode === 'auto';
  let slopePercent;
  let autoSlopeWarnings = [];
  if (isAutoSlope) {
    if (crownElev == null) {
      autoSlopeWarnings = ['no se pudo calcular la pendiente automática: nivel superior del frontón alto no resuelto'];
      slopePercent = 0;
    } else {
      const auto = computeSlopeFromClearance({
        span, heelHeight, supportElev: supportElevation, crownElev, crownClearance, purlinHeight: purlinH
      });
      slopePercent = auto.slopePercent;
      autoSlopeWarnings = auto.warnings;
    }
  } else {
    slopePercent = resolveValue(system.slopePercent ?? 30, paramsMap, elementsById);
  }

  const trussGeometry = computeMonoTrussGeometry({
    span,
    slopePercent,
    heelHeight,
    gutterNotchWidth: resolveValue(system.gutterNotchWidth ?? 0, paramsMap, elementsById),
    postSpacing: resolveValue(system.postSpacing ?? 600, paramsMap, elementsById),
    diagonalPattern: system.diagonalPattern || 'W',
    profiles: system.profiles || {},
    purlinProfile: system.purlinProfile || null,
    purlinSpacing: resolveValue(system.purlinSpacing ?? 0, paramsMap, elementsById)
  });

  // --- restricción de diseño: el punto más alto de la cercha INCLUIDA la costanera debe
  // quedar `crownClearance` (default 200mm) bajo la cota de coronación del frontón alto
  // (nivel superior del muro alto). Es condición dura: heightViolation bloquea Generar.
  // En modo auto la pendiente se calculó justo para cumplir esto — no puede violarse salvo
  // que crownElev no se haya resuelto (caso ya cubierto arriba con su propio warning). ---
  let heightViolation = false;
  if (trussGeometry.resolved && !isAutoSlope) {
    if (crownElev != null) {
      const topmost = supportElevation + trussGeometry.heightHigh + purlinH;
      const maxAllowed = crownElev - crownClearance;
      if (topmost > maxAllowed + EPS) {
        heightViolation = true;
        warnings.push(`punto más alto de la cercha${purlinH ? ' + costanera' : ''} en cota ${Math.round(topmost)}mm supera el máximo permitido ${Math.round(maxAllowed)}mm (coronación ${Math.round(crownElev)} − ${Math.round(crownClearance)}mm) — reducir pendiente, talón o cota de apoyo`);
      }
    } else {
      warnings.push('no se pudo verificar la coronación del frontón alto (nivel superior no resuelto)');
    }
  }

  // Soleras de apoyo lateral: una pieza continua por muro, a la cota de apoyo, a lo largo del
  // rango de cerchas y sobre la cara interior del muro. Es lo que recibe la reacción de cada
  // cercha cuando no hay coronación bajo ella (metrado + .inp).
  //
  // ★ A-01 / s5-C — CONVENCIÓN VERTICAL: `topElevation` es la CARA SUPERIOR de la solera
  // (= supportElevation = cara inferior de la cuerda inferior, y_local = 0). La solera cuelga
  // hacia abajo hasta `baseElevation`, dentro de la holgura del cielo falso (supportOffset).
  // Antes esta ruta emitía sólo el alias `elevation` porque no resolvía el alto del perfil;
  // ahora emite el mismo shape completo que el faldón (roofPlaneAdapter) y el alias desaparece.
  const ledgerProfile = system.supportProfile || system.profiles?.bottomChord || null;
  // h real del perfil, o 0 si no resuelve en la librería: mismo criterio que roofPlane.js:257 —
  // no se inventa un fallback, la solera simplemente no tiene alto conocido.
  const ledgerEntry = ledgerProfile ? (library?.metalconProfiles || []).find(p => p.code === ledgerProfile) : null;
  const hLedger = ledgerEntry ? resolveTrussProfileDims(library, ledgerProfile).h : 0;
  // ★ s5 (auditoría) — sin alto resuelto la solera queda de espesor 0 y DESAPARECE del 3D y de los
  // dos DXF, en silencio. El faldón ya avisa (roofPlane.js, finding `supportLedger`); acá no había
  // nada. Se avisa antes de que el usuario descubra la pieza faltante en el plano.
  if (supportMode === 'lateral' && !ledgerEntry) {
    warnings.push(`solera de apoyo: perfil ${ledgerProfile || 'no definido'} no resoluble en la librería — no se dibuja ni en 3D ni en los planos (definir el perfil de solera del sistema)`);
  }
  const supportLedgers = supportMode !== 'lateral' ? [] : [
    { wallId: wallLow.id, side: 'low', perp: innerLow },
    { wallId: wallHigh.id, side: 'high', perp: pHigh - spanDir * geoHigh.thickness / 2 }
  ].map(({ wallId, side, perp }) => ({
    wallId, side,
    profile: ledgerProfile,
    topElevation: supportElevation,
    baseElevation: supportElevation - hLedger,
    length: to - from,
    runAxis: lowXRun ? 'x' : 'y',
    p1: lowXRun ? { x: from, y: perp } : { x: perp, y: from },
    p2: lowXRun ? { x: to, y: perp } : { x: perp, y: to }
  }));

  return {
    resolved: trussGeometry.resolved,
    span,
    supportElevation,
    supportMode,
    supportViolation,
    supportLedgers,
    runAxis: lowXRun ? 'x' : 'y',
    spanDir,
    overlapRange,                 // solape disponible de los dos muros (para la UI de zona)
    runRange: { from, to },       // tramo efectivamente cubierto = solape ∩ zona ∩ caras de frontón
    obstructions: {               // frontones detectados (sesión 25)
      edgeLow: adjusted.edgeLow, edgeHigh: adjusted.edgeHigh,
      blocking: adjusted.blocking, crossing
    },
    zoned: to - from < overlapRange.to - overlapRange.from - EPS,
    trussPositions,
    trussGeometry,
    slopePercent,
    heightViolation,
    warnings: [...warnings, ...autoSlopeWarnings, ...trussGeometry.warnings]
  };
}

// ---- geometría 2D de perfil real (contorno de barra, no solo línea de eje) -------------------
// Usado por render/trussLayout.js (canvas) y core/exportTrussDxf.js (DXF) para dibujar cada
// miembro con el espesor real de su perfil, en vez de una línea de eje. Puro — sin canvas/DXF.

/** Rango vertical real (cota absoluta) de un sistema de techumbre resuelto: desde el arranque de
 * la cercha (supportElevation + heightLow) hasta el punto más alto incluida la costanera
 * (supportElevation + heightHigh + purlinH) — mismo tope que valida heightViolation. Usado por
 * `isVisibleAtCurrentLevel`-style filters para el corte estricto en planta (sesión 21). */
export function roofSystemVerticalRange(system, library = null) {
  if (!system?.trussGeometry?.resolved) return null;
  const purlinH = system.purlinProfile ? resolveTrussProfileDims(library, system.purlinProfile, 35).h : 0;
  return {
    bottom: system.supportElevation + system.trussGeometry.heightLow,
    top: system.supportElevation + system.trussGeometry.heightHigh + purlinH
  };
}

/** {h,b} del perfil Metalcon por código, con fallback si no está en la librería del proyecto. */
export function resolveTrussProfileDims(library, code, fallbackH = 40, fallbackB = 40) {
  const p = (library?.metalconProfiles || []).find(pr => pr.code === code);
  return { h: p?.H ?? fallbackH, b: p?.B ?? fallbackB };
}

/**
 * 4 esquinas del rectángulo real de una barra [x1,y1]→[x2,y2] con espesor `thickness`,
 * desplazado perpendicular al eje de la barra según `mode`:
 * - 'plus'   → todo el espesor hacia el lado +normal, la cara EN la línea queda del lado −normal
 *              (cuerda inferior: la línea es la cara inferior/de apoyo, el perfil sube desde ahí).
 * - 'minus'  → todo el espesor hacia el lado −normal (cuerda superior: la línea es la cara
 *              superior/de costanera, el perfil baja desde ahí).
 * - 'center' → mitad a cada lado (entramado — sin cara de referencia particular; se superpone
 *              con las cuerdas en los nudos, igual que el montante de muro con la solera).
 * La normal es perpendicular a la barra, rotada 90° CCW: para toda barra que corre de menor a
 * mayor x (siempre el caso de cuerda superior/inferior en esta geometría), +normal apunta hacia
 * arriba — por eso 'plus' sirve para la cuerda inferior y 'minus' para la superior.
 */
export function memberRectCorners(x1, y1, x2, y2, thickness, mode = 'center') {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // normal unitaria, 90° CCW
  const offPlus = mode === 'plus' ? thickness : mode === 'center' ? thickness / 2 : 0;
  const offMinus = mode === 'minus' ? thickness : mode === 'center' ? thickness / 2 : 0;
  return [
    { x: x1 + nx * offPlus, y: y1 + ny * offPlus },
    { x: x2 + nx * offPlus, y: y2 + ny * offPlus },
    { x: x2 - nx * offMinus, y: y2 - ny * offMinus },
    { x: x1 - nx * offMinus, y: y1 - ny * offMinus }
  ];
}

/** Rectángulo de la costanera: pequeña marca apoyada en la cara superior de la cuerda superior
 * (el punto `purlin` ya está calculado exactamente sobre esa cara — ver computeMonoTrussGeometry),
 * orientada según la tangente de la cuerda en ese punto (paralela a la pendiente del techo),
 * extendida hacia arriba por el H real del perfil de costanera. */
export function purlinRectCorners(purlin, topChordTangent, thicknessH, halfLen = 30) {
  const [tx, ty] = topChordTangent;
  const x1 = purlin.x - tx * halfLen, y1 = purlin.y - ty * halfLen;
  const x2 = purlin.x + tx * halfLen, y2 = purlin.y + ty * halfLen;
  return memberRectCorners(x1, y1, x2, y2, thicknessH, 'plus');
}

/** Modo de offset por rol — única fuente de verdad para render y DXF (ver docstring de
 * memberRectCorners para el porqué de cada uno). */
export const CHORD_RECT_MODE = { topChord: 'minus', bottomChord: 'plus' };

/** Tolerancia (mm) para decidir si un offset "cae en" un extremo de muro o un borde de vano.
 * Es la misma que usaban los dos bloques duplicados que esta función reemplaza (R2 §1.2): no se
 * cambia, porque de ella depende que las 273 jambas no se muevan. No es una regla de dominio —
 * es tolerancia numérica (`00-reglas-de-dominio.md` §1). */
const FLANGE_EPS = 1;

const nearAnyOffset = (v, arr) => arr.some(a => Math.abs(a - v) < FLANGE_EPS);

/** Modo de fase de una pieza: dónde queda el material respecto de la línea del miembro.
 *   `'plus'`  → la línea es la cara MIN (el ala va hacia +)
 *   `'minus'` → la línea es la cara MAX (el ala va hacia −)
 *   `'center'`→ la línea es el eje
 *
 * `ctx` es OPCIONAL. Sin `ctx` el comportamiento es el histórico (cuerdas por rol, todo lo demás
 * eje), así que las llamadas de cercha (`build3d.js`, `exportTrussDxf.js`) siguen valiendo sin
 * tocarse. Con `ctx` resuelve además las piezas de muro, donde la fase **no es propiedad del rol
 * sino del rol en su posición** (D-034): el mismo `corner` necesita fase opuesta en `offset 0` y
 * en `offset = length`. Por eso no se crean roles nuevos — `role` es identificador (D-029).
 *
 * `ctx` = `{ offset, length, jambMins, jambMaxs }`.
 *
 * Precedencia: **extremo de muro gana sobre borde de vano** (D-019). No se dibuja acero donde no
 * hay muro ("no inventar geometría", `00-protocolo.md` §3). */
export function memberOffsetMode(role, ctx) {
  if (CHORD_RECT_MODE[role]) return CHORD_RECT_MODE[role];
  if (!ctx || ctx.offset == null) return 'center';
  const { offset, length = null, jambMins = [], jambMaxs = [] } = ctx;

  // 1. extremo de muro → a ras hacia ADENTRO
  if (Math.abs(offset) < FLANGE_EPS) return 'plus';
  if (length != null && Math.abs(offset - length) < FLANGE_EPS) return 'minus';

  // 2. borde de vano → a ras hacia AFUERA del vano
  if (nearAnyOffset(offset, jambMins)) return 'minus';
  if (nearAnyOffset(offset, jambMaxs)) return 'plus';

  // 3. montante de campo → eje
  return 'center';
}

/** Franja que ocupa el ala de una pieza de muro a lo largo del muro, en coordenadas LOCALES de
 * offset (mm desde el inicio del muro). Fuente única para los dos emisores de elevación
 * (`exportFramingDxf.js` y `render/wall.js`) — es D-009 aplicado a tabiquería.
 *
 * `flangeWidth` es el B real del perfil (38 mm en la serie 90). */
export function studFlangeSpan(stud, ctx, flangeWidth) {
  const offset = stud.offset;
  const mode = memberOffsetMode(stud.role, { ...ctx, offset });
  if (mode === 'plus') return { xMin: offset, xMax: offset + flangeWidth };
  if (mode === 'minus') return { xMin: offset - flangeWidth, xMax: offset };
  return { xMin: offset - flangeWidth / 2, xMax: offset + flangeWidth / 2 };
}

/** Bajo este largo neto (mm) una barra no se fabrica como pieza independiente — queda absorbida
 * dentro del espesor de las cuerdas (típico en montantes muy cerca del rebaje de canaleta, donde
 * la altura total de la cercha es menor que la suma de peraltes de C.S. + C.I.). */
export const MIN_FABRICABLE_LENGTH = 30;

function isFabricableMember(member, geometry, library) {
  if (member.role !== 'post' && member.role !== 'diagonal') return true;
  return computeTrussCutSpec(member, geometry, library).length > MIN_FABRICABLE_LENGTH;
}

/** Códigos de barra por rol — única fuente de verdad para dibujo (etiquetas) y tabla de
 * despiece (nunca pueden divergir porque ambos leen este Map). Correlativo izquierda→derecha
 * por `x1` (montantes) o por el mínimo de x1/x2 (diagonales); cuerdas son únicas. Barras con
 * largo neto ≤ MIN_FABRICABLE_LENGTH se OMITEN de la numeración (no se fabrican) y se reportan
 * en `warnings`. */
export function assignTrussPieceCodes(geometry, library) {
  const codes = new Map();
  const warnings = [];
  const members = geometry.members || [];
  for (const m of members) {
    if (m.role === 'bottomChord') codes.set(m, 'C.I.1');
    else if (m.role === 'topChord') codes.set(m, 'C.S.1');
  }
  const posts = members.filter(m => m.role === 'post').slice().sort((a, b) => a.x1 - b.x1);
  let n = 1;
  for (const m of posts) {
    if (!isFabricableMember(m, geometry, library)) {
      const { length } = computeTrussCutSpec(m, geometry, library);
      warnings.push(`Montante en x=${Math.round(m.x1)}mm omitido: largo neto ${Math.round(length)}mm ≤ ${MIN_FABRICABLE_LENGTH}mm mínimo fabricable (absorbido por peralte de cuerdas).`);
      continue;
    }
    codes.set(m, `M${n++}`);
  }
  const diagonals = members.filter(m => m.role === 'diagonal').slice()
    .sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2));
  n = 1;
  for (const m of diagonals) {
    if (!isFabricableMember(m, geometry, library)) {
      const { length } = computeTrussCutSpec(m, geometry, library);
      warnings.push(`Diagonal cerca de x=${Math.round(Math.min(m.x1, m.x2))}mm omitida: largo neto ${Math.round(length)}mm ≤ ${MIN_FABRICABLE_LENGTH}mm mínimo fabricable.`);
      continue;
    }
    codes.set(m, `D${n++}`);
  }
  return { codes, warnings };
}

/** Pendiente real (fracción rise/run) recuperada de la geometría ya resuelta — evita pasar de
 * nuevo la config: `heightHigh = heightLow + slopeFrac * span` (ver computeMonoTrussGeometry). */
function slopeFractionOf(geometry) {
  const { span, heightLow, heightHigh } = geometry;
  return span > EPS ? (heightHigh - heightLow) / span : 0;
}

/** Largo de corte real y ángulos de corte de UNA barra, descontando el peralte de las cuerdas
 * en los encuentros (decisión de sesión: NO se usa el eje-eje teórico). Cuerda superior con
 * corte A PLOMO (vertical) en ambos extremos — ver 05-cotas-dxf-cerchas.md. */
export function computeTrussCutSpec(member, geometry, library) {
  const { role, x1, y1, x2, y2 } = member;
  const chordBottom = (geometry.members || []).find(m => m.role === 'bottomChord');
  const chordTop = (geometry.members || []).find(m => m.role === 'topChord');
  const { h: hCi } = resolveTrussProfileDims(library, chordBottom?.profile, 90);
  const { h: hCs } = resolveTrussProfileDims(library, chordTop?.profile, 90);
  const slopeFrac = slopeFractionOf(geometry);
  const cosTheta = 1 / Math.sqrt(1 + slopeFrac * slopeFrac);
  const thetaDeg = Math.atan(slopeFrac) * 180 / Math.PI;
  const { heightLow, span } = geometry;
  const xs = chordTop ? chordTop.x1 : 0;
  const yTop = (x) => heightLow + slopeFrac * x;
  const caraCsY = (x) => yTop(x) - hCs / cosTheta;

  if (role === 'bottomChord') {
    return { length: span, angA: 90, angB: 90 };
  }
  if (role === 'topChord') {
    const length = (span - xs) / cosTheta;
    const cut = 90 - thetaDeg;
    return { length, angA: cut, angB: cut };
  }
  if (role === 'post') {
    // barra vertical en x1===x2; recortada entre la cara interior de ambas cuerdas.
    const x = x1;
    const length = caraCsY(x) - hCi;
    return { length, angA: 90, angB: 90 };
  }
  if (role === 'diagonal') {
    const dx = x2 - x1, dy = y2 - y1;
    // t1: cruce con cara interior de cuerda inferior (y = hCi)
    const t1 = dy !== 0 ? (hCi - y1) / dy : 0;
    // t2: cruce con cara interior de cuerda superior (recta y = yTop(x) - hCs/cosTheta)
    const denom = dy - slopeFrac * dx;
    const rhs = heightLow + slopeFrac * x1 - hCs / cosTheta - y1;
    const t2 = denom !== 0 ? rhs / denom : 0;
    const fullLen = Math.hypot(dx, dy) || 1;
    const length = Math.abs(t2 - t1) * fullLen;
    const alphaDeg = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const angA = alphaDeg; // extremo bajo — contra cuerda inferior
    const angB = Math.abs(alphaDeg - thetaDeg); // extremo alto — contra cuerda superior
    return { length, angA, angB };
  }
  return { length: Math.hypot(x2 - x1, y2 - y1), angA: 90, angB: 90 };
}

/** Filas [código, perfil, largo, ángA, ángB, cant] para la tabla de despiece de UNA cercha tipo.
 * Orden: C.I.1, C.S.1, M1..Mn, D1..Dn, y fila CST al final si hay costaneras (cant = n
 * costaneras, largo = separación entre cerchas). `cant` de barras propias de la cercha es
 * siempre 1 — es el despiece de la cercha tipo, no de todo el sistema. */
export function buildTrussPieceScheduleRows(geometry, library, trussSpacing) {
  const { codes, warnings } = assignTrussPieceCodes(geometry, library);
  const order = { 'C.I.1': 0, 'C.S.1': 1 };
  const members = (geometry.members || []).filter(m => codes.has(m)).sort((a, b) => {
    const ca = codes.get(a), cb = codes.get(b);
    const oa = order[ca] ?? (ca[0] === 'M' ? 2 : 3);
    const ob = order[cb] ?? (cb[0] === 'M' ? 2 : 3);
    if (oa !== ob) return oa - ob;
    return a.x1 - b.x1;
  });
  const rows = members.map(m => {
    const { length, angA, angB } = computeTrussCutSpec(m, geometry, library);
    return [
      codes.get(m), m.profile || '-', String(Math.round(length)),
      `${angA.toFixed(1)}%%D`, `${angB.toFixed(1)}%%D`, '1'
    ];
  });
  if (geometry.purlins?.length) {
    const purlinProfile = geometry.purlins[0]?.profile || '-';
    rows.push(['CST', purlinProfile, String(Math.round(Number(trussSpacing) || 0)), '-', '-', String(geometry.purlins.length)]);
  }
  if (warnings.length && typeof console !== 'undefined') warnings.forEach(w => console.warn('[trussSchedule]', w));
  return rows;
}

/** Datos puros (sin canvas) de las líneas de referencia de cerchas en planta, en espacio de
 * plano (h=x, v=y).
 *
 * ★ B4.7.8-s2 — opera sobre un ARRAY de sistemas, no sobre el modelo. La fuente (legacy vs
 * faldones expandidos) la decide `core/roofSegments.js`; aquí no se puede importar
 * roofPlaneOutputs porque roofPlaneAdapter ya importa este módulo (ciclo). */
export function roofPlanSegmentsOf(systems = []) {
  const segments = [];
  for (const system of systems) {
    if (!system.trussGeometry?.resolved || !system.trussPositions?.length) continue;
    const spanDir = system.spanDir ?? 1;
    for (const tp of system.trussPositions) {
      const perp0 = system.runAxis === 'x' ? tp.world.y : tp.world.x;
      const perp1 = perp0 + spanDir * system.span;
      const a = system.runAxis === 'x' ? { x: tp.world.x, y: perp0 } : { x: perp0, y: tp.world.y };
      const b = system.runAxis === 'x' ? { x: tp.world.x, y: perp1 } : { x: perp1, y: tp.world.y };
      // systemId permite a core/hitTest.js resolver qué SISTEMA se clickeó (las cerchas son
      // derivadas: la unidad seleccionable es el sistema completo). snapEngine lo ignora.
      // `kind` deja que el render distinga la cuerda de borde (línea contra la cara del frontón)
      // de una cercha real, sin recalcular nada. hitTest y snapEngine lo ignoran.
      segments.push({ h1: a.x, v1: a.y, h2: b.x, v2: b.y, systemId: system.id, kind: tp.kind || 'full' });
    }
  }
  return segments;
}

/** Datos puros (sin canvas) de la geometría de cercha visible en ESTE corte de elevación, en
 * espacio de plano (h,v). Misma condición de "¿aparece?" que la función de dibujo: el eje de
 * corte debe coincidir con system.runAxis y su posición debe caer dentro del rango de cerchas.
 *
 * ★ B4.7.8-s2 — recibe sistemas + eje/posición ya resueltos (ver roofPlanSegmentsOf). */
export function roofElevationSegmentsOf(systems = [], axisType, pos) {
  if (pos == null) return [];

  const segments = [];
  for (const system of systems) {
    const geo = system.trussGeometry;
    if (!geo?.resolved || !system.trussPositions?.length) continue;
    if (axisType !== system.runAxis) continue;
    const offsets = system.trussPositions.map(p => p.offset);
    if (pos < Math.min(...offsets) - 0.5 || pos > Math.max(...offsets) + 0.5) continue;

    const spanDir = system.spanDir ?? 1;
    const perp0 = system.runAxis === 'x' ? system.trussPositions[0].world.y : system.trussPositions[0].world.x;
    const h = (xLocal) => perp0 + spanDir * xLocal;
    const v = (yLocal) => system.supportElevation + yLocal;

    // Si el corte pasa justo por una cuerda de borde (y no por una cercha completa), en ese plano
    // solo hay cuerda superior: dibujar la celosía ahí sería inventar material.
    const AT = 0.5;
    const onEdge = system.trussPositions.some(p => p.kind === 'edgeChord' && Math.abs(p.offset - pos) < AT);
    const onFull = system.trussPositions.some(p => p.kind !== 'edgeChord' && Math.abs(p.offset - pos) < AT);
    const members = onEdge && !onFull ? geo.members.filter(m => m.role === 'topChord') : geo.members;

    for (const m of members) segments.push({ h1: h(m.x1), v1: v(m.y1), h2: h(m.x2), v2: v(m.y2) });
    if (geo.gutterNotch && !(onEdge && !onFull)) {
      const { width: nw, height: nh } = geo.gutterNotch;
      segments.push(
        { h1: h(0), v1: v(0), h2: h(0), v2: v(nh) }, { h1: h(0), v1: v(nh), h2: h(nw), v2: v(nh) },
        { h1: h(nw), v1: v(nh), h2: h(nw), v2: v(0) }
      );
    }
    // las costaneras SÍ pasan por el plano de la cuerda de borde (llegan de tope a esa cara)
    for (const p of geo.purlins || []) segments.push({ h1: h(p.x), v1: v(p.y), h2: h(p.x), v2: v(p.y) }); // punto (extremo=extremo)
  }
  return segments;
}

function roofFinding(severity, category, message, roofSystemIds = []) {
  return { severity, category, message, roofSystemIds };
}

/** Huella en planta {minH,maxH,minV,maxV} de UN sistema, a partir de sus segmentos ya
 * computados por computeRoofPlanSegments (no se inventa geometría nueva). */
function footprintFromSegments(segments) {
  const hs = segments.flatMap(s => [s.h1, s.h2]);
  const vs = segments.flatMap(s => [s.v1, s.v2]);
  return { minH: Math.min(...hs), maxH: Math.max(...hs), minV: Math.min(...vs), maxV: Math.max(...vs) };
}

function footprintsOverlap(a, b, tolerance) {
  const overlapH = Math.min(a.maxH, b.maxH) - Math.max(a.minH, b.minH);
  const overlapV = Math.min(a.maxV, b.maxV) - Math.max(a.minV, b.minV);
  return overlapH > tolerance && overlapV > tolerance;
}

/** Validación pura de un model.roofSystems[] completo — NO bloquea nada, solo reporte (mismo
 * shape que core/modelValidation.js: {severity, category, message}, aquí con `roofSystemIds`
 * en vez de `elementIds`). Reutiliza computeRoofPlanSegments/resolveWallGeometry existentes;
 * no inventa geometría nueva. */
export function validateRoofSystems(model, overlapTolerance = 50) {
  const findings = [];
  const systems = model.roofSystems || [];
  if (!systems.length) return findings;

  // ★ B4.7.8-s2b — desde B-04 la precedencia la tienen los faldones: con `roofPlanes` vivos,
  // `roofSystems` ya no alimenta a NADIE del pipeline. Seguir validando su geometría llenaba el
  // panel de findings sobre sistemas fantasma (solapes, apoyos inválidos) que ya no se exportan.
  // No se callan del todo: se reporta UNA vez que esos datos quedaron muertos en el JSON, porque
  // son basura que conviene borrar — silenciarlos los dejaría ahí para siempre.
  if (model.roofPlanes?.length) {
    const n = systems.length;
    findings.push(roofFinding(
      'info', 'legacyShadowed',
      `${n} sistema${n === 1 ? '' : 's'} de techumbre legacy ${n === 1 ? 'quedó' : 'quedaron'} en el modelo y ya no ${n === 1 ? 'lo usa' : 'los usa'} el pipeline (mandan los faldones) — conviene borrarlos`,
      [] // sin ids apuntables a propósito: seleccionar un sistema que ya no se dibuja deja el
         // panel de propiedades mostrando un fantasma.
    ));
    return findings;
  }

  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = buildElementsById(model.elements || []);

  // --- invalidSupport (sesión 15): el muro de apoyo ya no existe. Pasa al dividir o unir un
  // muro que era apoyo: los tramos resultantes llevan ids nuevos a propósito, para que el
  // sistema quede marcado y Fran lo reasigne en vez de reapuntarlo en silencio. ---
  const wallsById = new Map((model.elements || []).filter(e => e.type === 'wall').map(e => [e.id, e]));
  for (const sys of systems) {
    const missing = [];
    if (sys.wallLowId == null || !wallsById.has(sys.wallLowId)) missing.push('bajo');
    if (sys.wallHighId == null || !wallsById.has(sys.wallHighId)) missing.push('alto');
    if (missing.length) {
      findings.push(roofFinding(
        'error', 'invalidSupport',
        `sistema ${sys.id}: el muro de apoyo ${missing.join(' y ')} ya no existe (¿se dividió, unió o eliminó?) — reasignar el apoyo en Techumbre`,
        [sys.id]
      ));
    }
  }

  // --- overlap: huellas en planta de dos sistemas que se intersectan ---
  const segmentsBySystem = new Map();
  for (const s of roofPlanSegmentsOf(systems)) {
    if (!segmentsBySystem.has(s.systemId)) segmentsBySystem.set(s.systemId, []);
    segmentsBySystem.get(s.systemId).push(s);
  }
  const footprints = systems
    .filter(sys => segmentsBySystem.has(sys.id))
    .map(sys => ({ id: sys.id, box: footprintFromSegments(segmentsBySystem.get(sys.id)) }));

  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      if (footprintsOverlap(footprints[i].box, footprints[j].box, overlapTolerance)) {
        findings.push(roofFinding(
          'error', 'overlap',
          `los sistemas de techumbre ${footprints[i].id} y ${footprints[j].id} tienen huellas en planta superpuestas`,
          [footprints[i].id, footprints[j].id]
        ));
      }
    }
  }

  // --- orphanTruss: cercha (persistida) cuyo apoyo cae fuera del rango actual del muro ---
  for (const sys of systems) {
    if (!sys.trussPositions?.length) continue;
    const wallLow = (model.elements || []).find(e => e.id === sys.wallLowId);
    const wallHigh = (model.elements || []).find(e => e.id === sys.wallHighId);
    if (!wallLow || !wallHigh) continue;
    const geoLow = resolveWallGeometry(wallLow, model.grid, paramsMap, elementsById);
    const geoHigh = resolveWallGeometry(wallHigh, model.grid, paramsMap, elementsById);
    if (!geoLow || !geoHigh) continue;
    const xRun = sys.runAxis === 'x';
    const runRange = (geo) => {
      const a = xRun ? geo.p1.x : geo.p1.y;
      const b = xRun ? geo.p2.x : geo.p2.y;
      return [Math.min(a, b), Math.max(a, b)];
    };
    const [lo1, hi1] = runRange(geoLow);
    const [lo2, hi2] = runRange(geoHigh);
    const from = Math.max(lo1, lo2), to = Math.min(hi1, hi2);
    // zona persistida que ya no cabe en el solape actual (se movió o se acortó un muro de apoyo):
    // se reporta aparte de orphanTruss porque la corrección es distinta (ajustar la zona, no
    // regenerar sin más).
    if (sys.runRange && (sys.runRange.from != null || sys.runRange.to != null)) {
      const zLo = Math.min(sys.runRange.from ?? from, sys.runRange.to ?? to);
      const zHi = Math.max(sys.runRange.from ?? from, sys.runRange.to ?? to);
      if (!(Math.min(to, zHi) - Math.max(from, zLo) > EPS)) {
        findings.push(roofFinding(
          'error', 'zoneOutOfOverlap',
          `sistema ${sys.id}: la zona ${Math.round(zLo)}→${Math.round(zHi)}mm ya no intersecta el solape de sus muros de apoyo (${Math.round(from)}→${Math.round(to)}mm) — ajustar la zona`,
          [sys.id]
        ));
      } else if (zLo < from - EPS || zHi > to + EPS) {
        findings.push(roofFinding(
          'warning', 'zoneClamped',
          `sistema ${sys.id}: la zona ${Math.round(zLo)}→${Math.round(zHi)}mm excede el solape de sus muros (${Math.round(from)}→${Math.round(to)}mm) — se recorta al regenerar`,
          [sys.id]
        ));
      }
    }

    const orphanCount = sys.trussPositions.filter(p => p.offset < from - EPS || p.offset > to + EPS).length;
    if (orphanCount > 0) {
      findings.push(roofFinding(
        'warning', 'orphanTruss',
        `sistema ${sys.id}: ${orphanCount} cercha(s) fuera del solape actual de sus muros de apoyo — regenerar`,
        [sys.id]
      ));
    }
  }

  // --- supportOutOfWall: la cota de apoyo persistida cae fuera del rango vertical de un muro de
  // apoyo (el modelo cambió después de generar). En 'lateral' quedar BAJO el arranque es válido
  // (la solera baja al muro colineal inferior); quedar sobre la coronación nunca lo es. ---
  for (const sys of systems) {
    if (sys.supportElevation == null) continue;
    for (const [id, label] of [[sys.wallLowId, 'bajo'], [sys.wallHighId, 'alto']]) {
      const w = wallsById.get(id);
      if (!w) continue;
      const zb = model.grid.zLevels.find(l => l.id === w.bottomZ)?.elevation;
      const zt = model.grid.zLevels.find(l => l.id === w.topZ)?.elevation;
      if (zb == null || zt == null) continue;
      const [lo, hi] = [Math.min(zb, zt), Math.max(zb, zt)];
      const above = sys.supportElevation > hi + EPS;
      const below = sys.supportElevation < lo - EPS && sys.supportMode !== 'lateral';
      if (above || below) {
        findings.push(roofFinding(
          'error', 'supportOutOfWall',
          `sistema ${sys.id}: la cota de apoyo ${Math.round(sys.supportElevation)}mm queda ${above ? 'sobre la coronación' : 'bajo el arranque'} del muro de apoyo ${label} (${lo}→${hi}mm) — la cercha se apoya en el aire`,
          [sys.id]
        ));
      }
    }
  }

  // --- duplicateEdgeTruss (sesión 23): dos zonas sobre el MISMO par de muros que se tocan en el
  // borde común colocan una cercha en el mismo offset. En obra es una sola cercha (o dos
  // acopladas): se avisa para que Fran decida, no se corrige solo. ---
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const a = systems[i], b = systems[j];
      const samePair = a.wallLowId === b.wallLowId && a.wallHighId === b.wallHighId;
      if (!samePair || !a.trussPositions?.length || !b.trussPositions?.length) continue;
      const dup = a.trussPositions.filter(pa => b.trussPositions.some(pb => Math.abs(pa.offset - pb.offset) < EPS)).length;
      if (dup > 0) {
        findings.push(roofFinding(
          'warning', 'duplicateEdgeTruss',
          `sistemas ${a.id} y ${b.id}: ${dup} cercha(s) en la misma posición (zonas contiguas comparten el borde) — verificar si es una sola cercha`,
          [a.id, b.id]
        ));
      }
    }
  }

  // --- trussInsideWall (sesión 25): cercha persistida cuya posición cae dentro del espesor de un
  // frontón. Con el layout nuevo esto no debería ocurrir (la corrida se recorta a la cara), así
  // que si aparece es un sistema guardado ANTES de la 25 o un muro agregado después. ---
  for (const sys of systems) {
    if (!sys.trussPositions?.length || sys.supportElevation == null || !sys.runAxis) continue;
    const { obstacles } = findRoofObstructions({
      walls: (model.elements || []).filter(e => e.type === 'wall'),
      grid: model.grid, paramsMap, elementsById,
      runAxis: sys.runAxis,
      bandFrom: sys.trussPositions[0].world[sys.runAxis === 'x' ? 'y' : 'x'],
      bandTo: sys.trussPositions[0].world[sys.runAxis === 'x' ? 'y' : 'x'] + (sys.spanDir ?? 1) * (sys.span ?? 0),
      supportElevation: sys.supportElevation,
      excludeIds: [sys.wallLowId, sys.wallHighId]
    });
    if (!obstacles.length) continue;
    const buried = sys.trussPositions.filter(p =>
      p.kind !== 'edgeChord' && obstacles.some(ob => p.offset > ob.oMin + EPS && p.offset < ob.oMax - EPS)
    );
    if (buried.length) {
      findings.push(roofFinding(
        'error', 'trussInsideWall',
        `sistema ${sys.id}: ${buried.length} cercha(s) quedan embebidas en un frontón (offsets ${buried.map(p => Math.round(p.offset)).join(', ')}mm) — regenerar el sistema para que se desplacen a la cara`,
        [sys.id]
      ));
    }
  }

  // --- mismatchedEdge: sistemas adyacentes (comparten muro de apoyo) con talón o pendiente
  // distinta en el borde compartido — solo informativo, puede ser intencional ---
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const a = systems[i], b = systems[j];
      const sharedWallId = [a.wallLowId, a.wallHighId].find(id => id != null && (id === b.wallLowId || id === b.wallHighId));
      if (sharedWallId == null) continue;
      const heelA = a.heelHeight ?? 0, heelB = b.heelHeight ?? 0;
      const slopeA = a.slopePercent ?? 0, slopeB = b.slopePercent ?? 0;
      if (Math.abs(heelA - heelB) > EPS || Math.abs(slopeA - slopeB) > EPS) {
        findings.push(roofFinding(
          'warning', 'mismatchedEdge',
          `sistemas ${a.id} y ${b.id} comparten muro de apoyo con talón/pendiente distintos (¿intencional?)`,
          [a.id, b.id]
        ));
      }
    }
  }

  return findings;
}
