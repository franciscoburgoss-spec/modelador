// core/exportTrussDxf.js
// Exporta la elevación de la CERCHA TIPO de cada sistema de techumbre (model.roofSystems —
// ver core/trussLayout.js) a DXF R12, mismo patrón que exportOsbDxf.js: coordenadas locales
// (X = luz desde el extremo bajo/canaleta, Y = altura sobre la cota de apoyo), un sistema al
// lado del otro. Cada elevación incluye: barras por rol (capas CERCHA-CUERDAS/CERCHA-ENTRAMADO),
// costaneras como círculo de referencia sobre la cuerda superior, cotas de luz y alturas,
// etiqueta con perfiles por rol y nota de cantidades (n cerchas @ spacing).
import {
  GAP_BETWEEN_WALLS, LABEL_OFFSET_Y, H_COTA_Y, TICK_HALF, BUBBLE_Y, BUBBLE_R,
  TEXT_HEIGHT_TITLE, TEXT_HEIGHT_TEXT, TEXT_HEIGHT_COTA,
  line, text, closedPolyline, rectPolyline, tablesSection, uniqueSorted, estimateTextWidth,
  axisEntities, levelEntities, drawTable, unionEntitiesExtent
} from './exportFramingDxf.js';
import {
  resolveTrussProfileDims, memberRectCorners, purlinRectCorners, memberOffsetMode,
  assignTrussPieceCodes, computeTrussCutSpec, buildTrussPieceScheduleRows
} from './trussLayout.js';
import { guardExport } from './exportPolicy.js';
import { getRoofSystems } from './roofPlaneOutputs.js';
import { countFullTrusses } from './roofObstructions.js';

const CHORD_ROLES = new Set(['topChord', 'bottomChord', 'gutterChord']);
const SCHEDULE_ROW_H = 170;
const SCHEDULE_TOP_MARGIN = 350; // mm, espacio entre la burbuja de eje y el borde superior de la tabla
const SCHEDULE_COLUMNS = [
  { label: 'COD', width: 500 },
  { label: 'PERFIL', width: 700 },
  { label: 'LARGO', width: 500 },
  { label: 'ANG.A', width: 450 },
  { label: 'ANG.B', width: 450 },
  { label: 'CANT', width: 400 }
];

/** Eje propio de un muro de apoyo (el eje sobre el que está trazado, no ejes intermedios que
 * cruce) — para runAxis 'x' el muro corre en X con Y fijo (yStart===yEnd), y viceversa. */
function wallOwnAxis(wall, grid, runAxis) {
  if (!wall) return null;
  return runAxis === 'x'
    ? grid.yAxes.find(a => a.id === wall.yStart)
    : grid.xAxes.find(a => a.id === wall.xStart);
}

function trussCotaEntities(xOffset, geometry) {
  const entities = [];
  const { span, heightLow, heightHigh } = geometry;

  // vano de canaleta: ancho + alto (el rectángulo MURO-REF ya se dibuja en trussElevationEntities)
  if (geometry.gutterNotch) {
    const { width: nw, height: nh } = geometry.gutterNotch;
    const wStr = String(Math.round(nw));
    entities.push(text('COTAS', xOffset + nw / 2 - estimateTextWidth(wStr, TEXT_HEIGHT_COTA) / 2, nh + 180, TEXT_HEIGHT_COTA, wStr));
    entities.push(text('COTAS', xOffset - 700, nh / 2, TEXT_HEIGHT_COTA, String(Math.round(nh)), 90));
    entities.push(line('COTAS', xOffset - 550, 0, xOffset - 550, nh));
  }

  // paso inclinado de costaneras: una cota tipo entre las dos primeras
  if (geometry.purlins?.length >= 2) {
    const [p0, p1] = geometry.purlins;
    const spacingIncl = Math.round(p1.s - p0.s);
    const midX = (p0.x + p1.x) / 2, midY = (p0.y + p1.y) / 2;
    const angleDeg = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
    entities.push(text('COSTANERAS', xOffset + midX, midY + 60, TEXT_HEIGHT_COTA, String(spacingIncl), angleDeg));
  }

  // cota horizontal: extremos + líneas de montante (mismo estilo tick que exportFramingDxf)
  const postXs = geometry.members.filter(m => m.role === 'post').map(m => m.x1);
  const hBreaks = uniqueSorted([0, ...postXs, span]);
  entities.push(line('COTAS', xOffset, H_COTA_Y, xOffset + span, H_COTA_Y));
  for (let i = 0; i < hBreaks.length; i++) {
    const x = xOffset + hBreaks[i];
    entities.push(line('COTAS', x - TICK_HALF, H_COTA_Y - TICK_HALF, x + TICK_HALF, H_COTA_Y + TICK_HALF));
    if (i > 0) {
      const seg = hBreaks[i] - hBreaks[i - 1];
      entities.push(text('COTAS', xOffset + (hBreaks[i] + hBreaks[i - 1]) / 2 - estimateTextWidth(String(Math.round(seg)), TEXT_HEIGHT_COTA) / 2, H_COTA_Y + 40, TEXT_HEIGHT_COTA, String(Math.round(seg))));
    }
  }

  // cotas verticales de altura en ambos extremos
  entities.push(text('COTAS', xOffset - 420, heightLow / 2, TEXT_HEIGHT_COTA, String(Math.round(heightLow)), 90));
  entities.push(line('COTAS', xOffset - 250, 0, xOffset - 250, heightLow));
  entities.push(text('COTAS', xOffset + span + 320, heightHigh / 2, TEXT_HEIGHT_COTA, String(Math.round(heightHigh)), 90));
  entities.push(line('COTAS', xOffset + span + 250, 0, xOffset + span + 250, heightHigh));

  return entities;
}

/** Entidades DXF (sin envoltorio SECTION) para la elevación de la cercha tipo de UN sistema.
 * `model` se usa para resolver el eje propio de cada frontón de apoyo y los niveles del
 * proyecto que caen entre la cota de apoyo y la coronación — mismo tratamiento que ya tienen
 * las elevaciones de tabiquería/OSB, para que el plano de cerchas sea igual de inconfundible. */
/** ★ B4.7.8-s5 (A) — Secciones transversales de las dos soleras de apoyo, en las coordenadas
 * locales de la cercha (X = luz desde la cara interior de la canaleta, Y = altura sobre la cota
 * de apoyo). La solera corre según `runAxis`, o sea perpendicular al plano de esta elevación:
 * se ve cortada, como un rectángulo `B × h`.
 *
 * Las dos convenciones vigentes (A-01 y s4-B) fijan la posición sin ninguna cuenta nueva:
 *   `topElevation` = `supportElevation` = `y_local` 0, y la pieza cuelga hacia abajo → `[−h, 0]`.
 *   en planta arranca en la cara interior del muro hacia el recinto → `[0, B]` en el apoyo bajo
 *   y `[span − B, span]` en el alto (`x_local` 0 = `perpInner`).
 * Misma expresión que `build3d.buildSupportLedgerBoxes`: 2D y 3D quedan alineados por construcción.
 *
 * Si el perfil no resuelve en la librería no se dibuja nada y no se inventa un fallback — ya hay
 * un finding `supportLedger` de severidad `info` para ese caso (roofPlane.js, s3-A.4). */
function supportLedgerSectionEntities(system, xOffset, library) {
  const entities = [];
  const ledgers = system.supportLedgers || [];
  if (!ledgers.length) return entities;
  const span = system.trussGeometry?.span;
  if (!(span > 0)) return entities;

  const profiles = library?.metalconProfiles || [];
  for (const side of ['low', 'high']) {
    const led = ledgers.find(l => l.side === side);
    if (!led) continue;
    const entry = led.profile ? profiles.find(p => p.code === led.profile) : null;
    if (!entry) continue;                     // perfil no resoluble: no dibujar, sin fallback
    const { h, b } = resolveTrussProfileDims(library, led.profile);
    if (!(h > 0) || !(b > 0)) continue;
    const xMin = side === 'low' ? 0 : span - b;
    entities.push(rectPolyline('SOLERAS-APOYO', xOffset + xMin, -h, xOffset + xMin + b, 0));
    // A.3 — el código de perfil una sola vez, junto a la sección del apoyo bajo
    if (side === 'low') {
      // línea base exactamente en −h: la etiqueta cae en la banda vacía bajo la cuerda inferior
      // y NO baja el extent más allá de la propia solera (ver A.4).
      entities.push(text('ETIQUETAS', xOffset + b + 80, -h, TEXT_HEIGHT_COTA, `SOLERA ${led.profile}`));
    }
  }
  return entities;
}

export function trussElevationEntities(system, xOffset, index, library, model) {
  const geo = system.trussGeometry;
  const entities = [];

  entities.push(...supportLedgerSectionEntities(system, xOffset, library));

  for (const m of geo.members) {
    const layer = CHORD_ROLES.has(m.role) ? 'CERCHA-CUERDAS' : 'CERCHA-ENTRAMADO';
    const isChord = m.role === 'topChord' || m.role === 'bottomChord';
    const { h: profH } = resolveTrussProfileDims(library, m.profile, isChord ? 90 : 40);
    const corners = memberRectCorners(m.x1, m.y1, m.x2, m.y2, profH, memberOffsetMode(m.role))
      .map(c => ({ x: xOffset + c.x, y: c.y }));
    entities.push(closedPolyline(layer, corners));
  }
  // vano de canaleta: rectángulo punteado de referencia (fondo en la cuerda inferior)
  if (geo.gutterNotch) {
    const { width: nw, height: nh } = geo.gutterNotch;
    entities.push(line('MURO-REF', xOffset, 0, xOffset, nh));
    entities.push(line('MURO-REF', xOffset, nh, xOffset + nw, nh));
    entities.push(text('MURO-REF', xOffset + 30, nh + 60, TEXT_HEIGHT_COTA, 'VANO CANALETA'));
  }
  const topChordMember = geo.members.find(m => m.role === 'topChord');
  let tangent = [1, 0];
  if (topChordMember) {
    const dx = topChordMember.x2 - topChordMember.x1, dy = topChordMember.y2 - topChordMember.y1;
    const len = Math.hypot(dx, dy) || 1;
    tangent = [dx / len, dy / len];
    for (const p of geo.purlins || []) {
      const { h: profH, b: profB } = resolveTrussProfileDims(library, p.profile, 35, 40);
      const corners = purlinRectCorners(p, tangent, profH, profB / 2).map(c => ({ x: xOffset + c.x, y: c.y }));
      entities.push(closedPolyline('COSTANERAS', corners));
    }
    // desarrollo (largo de corte) + ángulo de pendiente de la cuerda superior
    const spec = computeTrussCutSpec(topChordMember, geo, library);
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const nx = -tangent[1], ny = tangent[0];
    const midX = (topChordMember.x1 + topChordMember.x2) / 2, midY = (topChordMember.y1 + topChordMember.y2) / 2;
    entities.push(text('COTAS', xOffset + midX + nx * 120, midY + ny * 120, TEXT_HEIGHT_COTA, String(Math.round(spec.length)), angleDeg));
    entities.push(text('COTAS', xOffset + topChordMember.x1 - 200, topChordMember.y1 + 60, TEXT_HEIGHT_COTA, `${Math.abs(angleDeg).toFixed(1)}%%D`));
  }

  // códigos de barra (dibujo) — misma fuente de verdad que la tabla de despiece, para que nunca
  // diverjan; montantes rotulados con su altura de corte junto al código.
  const { codes } = assignTrussPieceCodes(geo, library);
  for (const [m, code] of codes) {
    const midX = (m.x1 + m.x2) / 2, midY = (m.y1 + m.y2) / 2;
    const isPost = m.role === 'post';
    const angleDeg = isPost ? 90 : Math.atan2(m.y2 - m.y1, m.x2 - m.x1) * 180 / Math.PI;
    let label = code;
    if (isPost) {
      const { length } = computeTrussCutSpec(m, geo, library);
      label = `${code} ${Math.round(length)}`;
    }
    entities.push(text('ETIQUETAS', xOffset + midX + (isPost ? 40 : 0), midY, TEXT_HEIGHT_COTA, label, angleDeg));
  }

  const topOfContent = geo.heightHigh + LABEL_OFFSET_Y + 300;

  // ejes: el propio de cada frontón de apoyo (bajo en x=0, alto en x=span) — no ejes
  // intermedios (la cercha no cruza otros ejes, solo se apoya en estos dos).
  const wallLow = (model.elements || []).find(e => e.id === system.wallLowId);
  const wallHigh = (model.elements || []).find(e => e.id === system.wallHighId);
  const axisLow = wallOwnAxis(wallLow, model.grid, system.runAxis);
  const axisHigh = wallOwnAxis(wallHigh, model.grid, system.runAxis);
  const axesInfo = [];
  if (axisLow) axesInfo.push({ offset: 0, label: axisLow.label });
  if (axisHigh) axesInfo.push({ offset: geo.span, label: axisHigh.label });
  entities.push(...axisEntities(xOffset, topOfContent, axesInfo));

  // niveles: todos los del proyecto entre la cota de apoyo y la coronación del frontón alto (con
  // margen si no se pudo resolver la coronación) — misma línea+sigla que en tabiquería/OSB.
  const crownElev = model.grid.zLevels.find(l => l.id === wallHigh?.topZ)?.elevation;
  const rangeHeight = crownElev != null ? (crownElev - system.supportElevation) : (geo.heightHigh + 800);
  entities.push(...levelEntities(xOffset, geo.span, rangeHeight, system.supportElevation, model.grid));

  const title = `CERCHA TIPO - SISTEMA ${index + 1} (pend. ${system.slopePercent}%)`;
  entities.push(text('ETIQUETAS', xOffset, geo.heightHigh + LABEL_OFFSET_Y + 300, TEXT_HEIGHT_TITLE, title));

  const pf = system.profiles || {};
  // Sesión 25: las posiciones `edgeChord` no son cerchas (cuerda superior atornillada a la cara
  // del frontón). Se rotulan aparte para que el taller no fabrique celosías de más.
  const nFull = countFullTrusses(system);
  const nEdge = (system.trussPositions || []).length - nFull;
  const lines = [
    `C.S. ${pf.topChord || '-'} · C.I. ${pf.bottomChord || '-'} · M. ${pf.post || '-'} @${Math.round(system.postSpacing || 600)}mm · D. ${pf.diagonal || '-'}`,
    `${nFull} cerchas @${Math.round(system.trussSpacing || 1200)}mm máx.` +
      (nEdge > 0 ? ` · ${nEdge} cuerda(s) sup. de borde ${pf.topChord || '-'} atornillada(s) a la cara del frontón` : '') +
      (geo.purlins?.length ? ` · costanera ${system.purlinProfile || '-'} @${Math.round(system.purlinSpacing || 0)}mm inclinado (${geo.purlins.length}/agua)` : ' · sin costaneras') +
      (system.gutterNotchWidth > 0 ? ` · rebaje canaleta ${Math.round(system.gutterNotchWidth)}mm` : '')
  ];
  lines.forEach((str, i) => {
    entities.push(text('ETIQUETAS', xOffset, geo.heightHigh + LABEL_OFFSET_Y + 300 - (i + 1) * 220, TEXT_HEIGHT_TEXT, str));
  });

  entities.push(...trussCotaEntities(xOffset, geo));
  entities.push(...trussScheduleTableEntities(xOffset, system, library).entities);
  return entities;
}

/** Tabla de despiece de barras de la cercha tipo, bajo la burbuja de eje (mismo offset que
 * exportOsbDxf.js:osbScheduleTableEntities). Nota A PLOMO: la cuerda superior se corta vertical
 * (no perpendicular al eje) — ver 05-cotas-dxf-cerchas.md. */
function trussScheduleTableEntities(xOffset, system, library) {
  const geo = system.trussGeometry;
  const rows = buildTrussPieceScheduleRows(geo, library, system.trussSpacing);
  if (!rows.length) return { entities: [], height: 0 };
  const yTop = BUBBLE_Y - BUBBLE_R - SCHEDULE_TOP_MARGIN;
  const { entities, height } = drawTable('COTAS', 'ETIQUETAS', xOffset, yTop, SCHEDULE_COLUMNS, rows, SCHEDULE_ROW_H, TEXT_HEIGHT_COTA);
  entities.push(text('ETIQUETAS', xOffset, yTop - height - 200, TEXT_HEIGHT_COTA,
    `DESPIECE 1 CERCHA (x${countFullTrusses(system)} EN OBRA) · C.S. A PLOMO EN AMBOS EXTREMOS`));
  return { entities, height: (BUBBLE_Y - BUBBLE_R - yTop) + height + 350 };
}

/** Bounding box local de todo lo que dibuja una elevación de cercha (para no superponer sistemas).
 * Genera las mismas entidades a xOffset=0 y une su bbox real (+ padding) — igual criterio que
 * computeWallViewExtent/computeOsbViewExtent. */
export function computeTrussViewExtent(system, index, library, model, scale = 50) {
  const entities = trussElevationEntities(system, 0, index, library, model);
  return unionEntitiesExtent(entities, { scale });
}

/** Genera el DXF (R12) con la cercha tipo de todos los sistemas con geometría generada.
 * Devuelve null si no hay ninguno. */
export function generateTrussDxf(model) {
  const systems = getRoofSystems(model).filter(s => s.trussGeometry?.resolved && s.trussPositions?.length);
  if (!systems.length) return null;

  const entities = [];
  let cursorX = 0;
  systems.forEach((system, i) => {
    const extent = computeTrussViewExtent(system, i, model.library, model);
    const origin = cursorX - extent.xMin;
    entities.push(...trussElevationEntities(system, origin, i, model.library, model));
    cursorX = origin + extent.xMax + GAP_BETWEEN_WALLS;
  });

  return [
    '0', 'SECTION', '2', 'TABLES',
    tablesSection(),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF'
  ].join('\n');
}

export function downloadTrussDxf(model) {
  const policy = guardExport(model, 'dxf-truss');
  if (!policy.allowed) return false;
  const content = generateTrussDxf(model);
  if (!content) {
    alert('No hay sistemas de techumbre generados (Techumbre — cerchas de un agua → Generar).');
    return false;
  }
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cerchas.dxf';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
