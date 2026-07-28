// core/exportFoundationsDxf.js
// ★ Sesión 13 — Lámina DXF A1 de fundaciones (mundo AC1015: reusa generateSheetDxf/
// packWallsIntoSheets de exportSheetsDxf.js con un entitiesBuilder propio; NO toca la plantilla
// FIXED_PREFIX/FIXED_SUFFIX ni el mundo R12).
//
// Tres tipos de "entry" (cada uno = un viewport a 1:SCALE):
//   plan     → planta de fundaciones (trazas con ancho real, ejes con globos, cotas entre ejes)
//   section  → corte tipo por cada TIPO de fundación usado (sobrecimiento + cimiento +
//              emplantillado, con cotas de ancho y de altura)
//   schedule → cuadro de fundaciones (tipo, clase, sección, dimensiones, cantidad, ml, m³)
//
// Toda la geometría y los volúmenes salen de `resolveFoundation()` (sesión 11) — acá NO se
// recalcula nada: solo se dibuja lo ya resuelto. Coordenadas en mm, textos solo ASCII (el helper
// `text()` pasa por sanitizeDxfText).

import {
  line, text, circle, closedPolyline, drawTable, estimateTextWidth,
  TEXT_HEIGHT_TITLE, TEXT_HEIGHT_SUBTITLE, TEXT_HEIGHT_TEXT, TEXT_HEIGHT_COTA,
  TICK_HALF, BUBBLE_R
} from './exportFramingDxf.js';
import { resolveFoundation } from './foundationGeometry.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { generateSheetDxf, packWallsIntoSheets, resolveSheetSetup } from './exportSheetsDxf.js';
import { guardExport } from './exportPolicy.js';

// --- constantes de dibujo (mm, espacio modelo) ------------------------------------------------
const AXIS_EXT = 900;        // cuánto sobresale la línea de eje del contorno de las fundaciones
const COTA_OFF = 1500;       // separación de la línea de cota al contorno
const BUBBLE_OFF = 2600;     // separación del centro del globo de eje al contorno
const TITLE_GAP = 700;       // separación del título sobre el dibujo
const HATCH_SPACING = 140;   // separación del achurado a 45%%D de las capas de hormigón
const SECTION_MARGIN = 900;  // margen lateral del corte tipo (cotas verticales + textos)
const MM_TO_M = 1e-3;
const MM3_TO_M3 = 1e-9;

const round1 = (v) => Math.round(v);
const fmtM = (v) => (v * MM_TO_M).toFixed(2);
const fmtM3 = (v) => (v * MM3_TO_M3).toFixed(2);

/** Nombre de la sección de librería, o "Personalizado" si no tiene o fue borrada. */
function sectionName(libraryId, library) {
  if (!libraryId) return 'Personalizado';
  const item = (library?.foundationSections || []).find((i) => i.id === libraryId);
  return item ? item.name : 'Personalizado';
}

/** Achurado a 45° de un rectángulo (líneas y = x + c recortadas al rectángulo). El DXF R12/R2000
 *  simple no lleva HATCH: se dibuja con líneas, igual que el achurado de elevación en pantalla. */
function hatchRect(layer, x0, y0, x1, y1, spacing = HATCH_SPACING) {
  const out = [];
  const cMax = y1 - x0;
  for (let c = Math.ceil((y0 - x1) / spacing) * spacing; c < cMax; c += spacing) {
    const xa = Math.max(x0, y0 - c);
    const xb = Math.min(x1, y1 - c);
    if (xb - xa < 1) continue;
    out.push(line(layer, xa, xa + c, xb, xb + c));
  }
  return out;
}

/** Cota encadenada horizontal: línea + marcas en cada quiebre + distancia entre quiebres. */
function horizontalCota(breaks, y) {
  if (breaks.length < 2) return [];
  const out = [line('COTAS', breaks[0], y, breaks[breaks.length - 1], y)];
  for (const b of breaks) out.push(line('COTAS', b, y - TICK_HALF, b, y + TICK_HALF));
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i], b = breaks[i + 1];
    if (b - a < 1) continue;
    out.push(text('COTAS', (a + b) / 2, y + TICK_HALF * 1.3, TEXT_HEIGHT_COTA, `${round1(b - a)}`));
  }
  return out;
}

/** Cota encadenada vertical (texto rotado 90°). */
function verticalCota(breaks, x) {
  if (breaks.length < 2) return [];
  const out = [line('COTAS', x, breaks[0], x, breaks[breaks.length - 1])];
  for (const b of breaks) out.push(line('COTAS', x - TICK_HALF, b, x + TICK_HALF, b));
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i], b = breaks[i + 1];
    if (b - a < 1) continue;
    out.push(text('COTAS', x - TICK_HALF * 1.6, (a + b) / 2, TEXT_HEIGHT_COTA, `${round1(b - a)}`, 90));
  }
  return out;
}

// --- tipificación (tags C1/C2… y Z1/Z2…) ------------------------------------------------------

/** Firma de tipificación: dos fundaciones con la misma clase, misma sección de librería y mismas
 *  dimensiones comparten tag, corte tipo y fila del cuadro. */
function typeSignature(el, f, library) {
  const ci = f.layers.find((l) => l.name === 'cimiento');
  const sc = f.layers.find((l) => l.name === 'sobrecimiento');
  const za = f.layers.find((l) => l.name === 'zapata');
  const emp = f.emplantillado ? `E${round1(f.emplantillado.thickness)}+${round1(f.emplantillado.overhang)}` : 'E-';
  if (f.kind === 'aislada') {
    return `Z|${sectionName(el.libraryId, library)}|${round1(za ? za.width : 0)}x${round1(f.lengthY)}x${round1(za ? za.height : 0)}|${emp}`;
  }
  return [
    'C', sectionName(el.libraryId, library),
    ci ? `${round1(ci.width)}x${round1(ci.height)}` : '-',
    sc ? `${sectionName(sc.libraryId, library)}:${round1(sc.width)}x${round1(sc.height)}` : '-',
    emp
  ].join('|');
}

/** Dimensiones legibles para el cuadro. */
function typeDimensions(f) {
  const ci = f.layers.find((l) => l.name === 'cimiento');
  const sc = f.layers.find((l) => l.name === 'sobrecimiento');
  const za = f.layers.find((l) => l.name === 'zapata');
  if (f.kind === 'aislada') {
    return `${round1(za ? za.width : 0)}x${round1(f.lengthY)}x${round1(za ? za.height : 0)}`;
  }
  const parts = [];
  if (ci) parts.push(`CIM ${round1(ci.width)}x${round1(ci.height)}`);
  if (sc) parts.push(`SC ${round1(sc.width)}x${round1(sc.height)}`);
  return parts.join(' / ') || '-';
}

/**
 * Resuelve las fundaciones del modelo y las agrupa en tipos.
 * @returns {{items: Array<{el,f,tag}>, types: Array<{tag,kind,sample,count,totalLength,volume,section}>}}
 */
export function resolveFoundationTypes(model) {
  const { grid, elements, library = {} } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);

  const items = [];
  const byKey = new Map();
  let nCorridas = 0, nAisladas = 0;

  for (const el of elements) {
    if (el.type !== 'foundation') continue;
    const f = resolveFoundation(el, grid, paramsMap, elementsById);
    if (!f || !f.layers.length) continue;

    const key = typeSignature(el, f, library);
    let group = byKey.get(key);
    if (!group) {
      const tag = f.kind === 'aislada' ? `Z${++nAisladas}` : `C${++nCorridas}`;
      group = {
        tag, kind: f.kind, sample: { el, f }, count: 0, totalLength: 0, volume: 0,
        section: sectionName(el.libraryId, library), dimensions: typeDimensions(f)
      };
      byKey.set(key, group);
    }
    group.count += 1;
    group.totalLength += f.kind === 'corrida' ? f.length : 0;
    group.volume += f.layers.reduce((a, l) => a + l.volume, 0) + (f.emplantillado ? f.emplantillado.volume : 0);
    items.push({ el, f, tag: group.tag });
  }

  return { items, types: [...byKey.values()] };
}

// --- vista 1: planta de fundaciones -----------------------------------------------------------

/** Contorno en planta de una corrida: rectángulo de ancho `width` centrado en el eje p1→p2. */
function runCorners(p1, p2, width) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * width / 2, ny = dx / len * width / 2;
  return [
    { x: p1.x + nx, y: p1.y + ny }, { x: p2.x + nx, y: p2.y + ny },
    { x: p2.x - nx, y: p2.y - ny }, { x: p1.x - nx, y: p1.y - ny }
  ];
}

/** Bounding box en planta de todas las fundaciones (contornos reales, no ejes). */
function planBounds(items) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  const add = (x, y) => {
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
  };
  for (const { f } of items) {
    if (f.kind === 'corrida') {
      for (const c of runCorners(f.p1, f.p2, Math.max(f.width, 1))) add(c.x, c.y);
    } else {
      add(f.center.x - f.lengthX / 2, f.center.y - f.lengthY / 2);
      add(f.center.x + f.lengthX / 2, f.center.y + f.lengthY / 2);
    }
  }
  if (!Number.isFinite(xMin)) return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  return { xMin, xMax, yMin, yMax };
}

/** Ejes de la grilla que caen dentro del rango de la planta (con 1mm de tolerancia). */
function axesWithin(axes, min, max) {
  return axes.filter((a) => a.position >= min - 1 && a.position <= max + 1)
    .sort((a, b) => a.position - b.position);
}

/** Entidades de la planta de fundaciones, con origen local en la esquina inferior izquierda del
 *  bounding box (desplazada `xOffset` en el espacio modelo de la lámina). */
function planEntities(entry, xOffset) {
  const { items, bounds, grid } = entry;
  const ox = xOffset - bounds.xMin;
  const flipY = (y) => bounds.yMax - y; // world Y crece hacia abajo (canvas); DXF crece hacia arriba
  const w = bounds.xMax - bounds.xMin, h = bounds.yMax - bounds.yMin;
  const entities = [];

  for (const { f, tag } of items) {
    if (f.kind === 'corrida') {
      const ci = f.layers.find((l) => l.name === 'cimiento');
      const sc = f.layers.find((l) => l.name === 'sobrecimiento');
      const base = ci || f.layers[0];
      const p1 = { x: f.p1.x + ox, y: flipY(f.p1.y) }, p2 = { x: f.p2.x + ox, y: flipY(f.p2.y) };
      entities.push(closedPolyline('MONTANTES', runCorners(p1, p2, base.width)));
      if (sc && sc.width > 0) {
        const c = runCorners(p1, p2, sc.width);
        entities.push(line('SOLERAS', c[0].x, c[0].y, c[1].x, c[1].y));
        entities.push(line('SOLERAS', c[2].x, c[2].y, c[3].x, c[3].y));
      }
      entities.push(text('ETIQUETAS', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + base.width / 2 + 120,
        TEXT_HEIGHT_TEXT, tag));
    } else {
      const cx = f.center.x + ox, cy = flipY(f.center.y);
      const x0 = cx - f.lengthX / 2, x1 = cx + f.lengthX / 2;
      const y0 = cy - f.lengthY / 2, y1 = cy + f.lengthY / 2;
      entities.push(closedPolyline('MONTANTES', [
        { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }
      ]));
      entities.push(line('MONTANTES', x0, y0, x1, y1));
      entities.push(line('MONTANTES', x0, y1, x1, y0));
      entities.push(text('ETIQUETAS', cx + f.lengthX / 2 + 120, cy, TEXT_HEIGHT_TEXT, tag));
    }
  }

  // ejes con globo + cota encadenada entre ejes (X abajo, Y a la izquierda)
  const xs = axesWithin(grid.xAxes, bounds.xMin, bounds.xMax);
  const ys = axesWithin(grid.yAxes, bounds.yMin, bounds.yMax);
  for (const a of xs) {
    const x = a.position + ox;
    entities.push(line('EJES', x, h + AXIS_EXT, x, -BUBBLE_OFF + BUBBLE_R));
    entities.push(circle('ETIQUETAS', x, -BUBBLE_OFF, BUBBLE_R));
    entities.push(text('ETIQUETAS', x - BUBBLE_R * 0.55, -BUBBLE_OFF - 90, TEXT_HEIGHT_SUBTITLE, a.label ?? ''));
  }
  for (const a of ys) {
    const y = flipY(a.position);
    entities.push(line('EJES', -BUBBLE_OFF + BUBBLE_R, y, w + AXIS_EXT, y));
    entities.push(circle('ETIQUETAS', -BUBBLE_OFF, y, BUBBLE_R));
    entities.push(text('ETIQUETAS', -BUBBLE_OFF - BUBBLE_R * 0.55, y - 90, TEXT_HEIGHT_SUBTITLE, a.label ?? ''));
  }
  entities.push(...horizontalCota(xs.map((a) => a.position + ox), -COTA_OFF));
  entities.push(...verticalCota(ys.map((a) => flipY(a.position)).reverse(), -COTA_OFF));

  entities.push(text('ETIQUETAS', 0, h + AXIS_EXT + TITLE_GAP, TEXT_HEIGHT_TITLE, 'PLANTA DE FUNDACIONES'));
  return entities;
}

function planExtent(entry) {
  const { bounds } = entry;
  const w = bounds.xMax - bounds.xMin, h = bounds.yMax - bounds.yMin;
  const back = BUBBLE_OFF + BUBBLE_R + 200;
  return {
    xMin: -back,
    xMax: Math.max(w + AXIS_EXT + 400, estimateTextWidth('PLANTA DE FUNDACIONES', TEXT_HEIGHT_TITLE)),
    yMin: -back,
    yMax: h + AXIS_EXT + TITLE_GAP + TEXT_HEIGHT_TITLE + 200
  };
}

// --- vista 2: cortes tipo ---------------------------------------------------------------------

/** Rectángulos del corte tipo (relativos al NPT: y=0 es el NPT del nivel base). */
function sectionRects(f) {
  const rects = f.layers.map((l) => ({
    name: l.name, label: l.label, width: l.width,
    yBottom: l.bottom - f.npt, yTop: l.top - f.npt
  }));
  if (f.emplantillado) {
    const base = f.layers.find((l) => l.name === 'cimiento') || f.layers[0];
    rects.push({
      name: 'emplantillado', label: 'Emplantillado',
      width: base.width + 2 * f.emplantillado.overhang,
      yBottom: f.emplantillado.bottom - f.npt, yTop: f.emplantillado.top - f.npt
    });
  }
  return rects;
}

function sectionGeom(type) {
  const { f } = type.sample;
  const rects = sectionRects(f);
  const halfMax = Math.max(...rects.map((r) => r.width / 2));
  const yBottom = Math.min(...rects.map((r) => r.yBottom));
  const yTop = Math.max(...rects.map((r) => r.yTop));
  return { f, rects, halfMax, yBottom, yTop };
}

function sectionEntities(entry, xOffset) {
  const { type } = entry;
  const { f, rects, halfMax, yBottom, yTop } = sectionGeom(type);
  const cx = xOffset + halfMax + SECTION_MARGIN; // eje del corte
  const entities = [];

  for (const r of rects) {
    const x0 = cx - r.width / 2, x1 = cx + r.width / 2;
    const layer = r.name === 'emplantillado' ? 'SOLERAS' : 'MONTANTES';
    entities.push(closedPolyline(layer, [
      { x: x0, y: r.yBottom }, { x: x1, y: r.yBottom }, { x: x1, y: r.yTop }, { x: x0, y: r.yTop }
    ]));
    entities.push(...hatchRect('ETIQUETAS', x0, r.yBottom, x1, r.yTop,
      r.name === 'emplantillado' ? HATCH_SPACING * 2 : HATCH_SPACING));
  }

  // línea de terreno / NPT y sello
  entities.push(line('NIVELES', cx - halfMax - 600, 0, cx + halfMax + 600, 0));
  entities.push(text('NIVELES', cx + halfMax + 200, 120, TEXT_HEIGHT_COTA,
    `N.P.T. ${fmtM(f.npt)}`));
  entities.push(line('NIVELES', cx - halfMax - 400, yBottom, cx + halfMax + 400, yBottom));
  entities.push(text('NIVELES', cx + halfMax + 200, yBottom + 120, TEXT_HEIGHT_COTA,
    `SELLO ${fmtM(f.sealElevation)}`));

  // cotas: alturas encadenadas a la izquierda, anchos abajo (y ancho del sobrecimiento arriba)
  const yBreaks = [...new Set([yBottom, ...rects.map((r) => r.yBottom), ...rects.map((r) => r.yTop)])]
    .sort((a, b) => a - b);
  entities.push(...verticalCota(yBreaks, cx - halfMax - 500));

  const wide = rects.reduce((a, r) => (r.width > a.width ? r : a), rects[0]);
  entities.push(...horizontalCota([cx - wide.width / 2, cx + wide.width / 2], yBottom - 600));
  const sc = rects.find((r) => r.name === 'sobrecimiento');
  if (sc) entities.push(...horizontalCota([cx - sc.width / 2, cx + sc.width / 2], yTop + 400));

  const titleY = yTop + (sc ? 1100 : 700);
  entities.push(text('ETIQUETAS', xOffset, titleY + TEXT_HEIGHT_TITLE + 120, TEXT_HEIGHT_TITLE,
    `CORTE TIPO ${type.tag}`));
  entities.push(text('ETIQUETAS', xOffset, titleY, TEXT_HEIGHT_TEXT,
    `${type.kind === 'aislada' ? 'Zapata aislada' : 'Cimiento corrido'} - ${type.section} (${type.count} un.)`));
  entities.push(text('ETIQUETAS', xOffset, titleY - TEXT_HEIGHT_TEXT - 100, TEXT_HEIGHT_TEXT,
    `DIM. ${type.dimensions}`));
  return entities;
}

function sectionExtent(type) {
  const { rects, halfMax, yBottom, yTop } = sectionGeom(type);
  const width = 2 * halfMax + 2 * SECTION_MARGIN;
  const sc = rects.find((r) => r.name === 'sobrecimiento');
  const titleY = yTop + (sc ? 1100 : 700);
  const labelWidth = Math.max(
    estimateTextWidth(`CORTE TIPO ${type.tag}`, TEXT_HEIGHT_TITLE),
    estimateTextWidth(`Cimiento corrido - ${type.section} (${type.count} un.)`, TEXT_HEIGHT_TEXT),
    estimateTextWidth(`DIM. ${type.dimensions}`, TEXT_HEIGHT_TEXT)
  );
  return {
    xMin: 0,
    xMax: Math.max(width, labelWidth),
    yMin: yBottom - 900,
    yMax: titleY + TEXT_HEIGHT_TITLE + 400
  };
}

// --- vista 3: cuadro de fundaciones -----------------------------------------------------------

const SCHEDULE_COLUMNS = [
  { label: 'TIPO', width: 700 },
  { label: 'CLASE', width: 1900 },
  { label: 'SECCION', width: 2400 },
  { label: 'DIMENSIONES (mm)', width: 3400 },
  { label: 'CANT.', width: 800 },
  { label: 'LARGO (m)', width: 1300 },
  { label: 'HORMIGON (m3)', width: 1700 }
];
const SCHEDULE_ROW_H = 220;

function scheduleRows(types) {
  return types.map((t) => [
    t.tag,
    t.kind === 'aislada' ? 'Zapata aislada' : 'Cimiento corrido',
    t.section,
    t.dimensions,
    String(t.count),
    t.kind === 'aislada' ? '-' : fmtM(t.totalLength),
    fmtM3(t.volume)
  ]);
}

function scheduleTable(types, x, yTop) {
  return drawTable('COTAS', 'ETIQUETAS', x, yTop, SCHEDULE_COLUMNS, scheduleRows(types),
    SCHEDULE_ROW_H, TEXT_HEIGHT_COTA);
}

function scheduleEntities(entry, xOffset) {
  const { types } = entry;
  const totalVolume = types.reduce((a, t) => a + t.volume, 0);
  const { entities, height } = scheduleTable(types, xOffset, 0);
  return [
    text('ETIQUETAS', xOffset, TEXT_HEIGHT_TITLE + 200, TEXT_HEIGHT_TITLE, 'CUADRO DE FUNDACIONES'),
    ...entities,
    text('ETIQUETAS', xOffset, -height - 300, TEXT_HEIGHT_TEXT,
      `TOTAL HORMIGON (incl. emplantillado): ${fmtM3(totalVolume)} m3`)
  ];
}

function scheduleExtent(types) {
  const { width, height } = scheduleTable(types, 0, 0);
  return {
    xMin: 0,
    xMax: Math.max(width, estimateTextWidth('CUADRO DE FUNDACIONES', TEXT_HEIGHT_TITLE)),
    yMin: -height - 300 - TEXT_HEIGHT_TEXT - 200,
    yMax: TEXT_HEIGHT_TITLE * 2 + 300
  };
}

// --- armado de láminas ------------------------------------------------------------------------

const ENTITY_BUILDERS = {
  plan: planEntities,
  section: sectionEntities,
  schedule: scheduleEntities
};

const LABEL_BUILDERS = {
  plan: () => 'PLANTA',
  section: (e) => `CORTE ${e.type.tag}`,
  schedule: () => 'CUADRO'
};

/** Entries (uno por viewport) de la lámina de fundaciones: planta + un corte por tipo + cuadro. */
export function resolveFoundationSheetEntries(model) {
  const { items, types } = resolveFoundationTypes(model);
  if (!items.length) return [];

  const bounds = planBounds(items);
  const plan = { kind: 'plan', items, bounds, grid: model.grid };
  plan.extent = planExtent(plan);

  return [
    plan,
    ...types.map((type) => ({ kind: 'section', type, extent: sectionExtent(type) })),
    { kind: 'schedule', types, extent: scheduleExtent(types) }
  ];
}

/** Genera las láminas A1 de fundaciones — un archivo DXF por lámina. `[]` si no hay fundaciones
 *  resolubles en el modelo. */
export function generateFoundationSheets(model, opts = {}) {
  const entries = resolveFoundationSheetEntries(model);
  if (!entries.length) return [];

  const {
    info,
    layout,
    scale,
    criteria
  } = resolveSheetSetup(model, opts);
  const sheets = packWallsIntoSheets(entries, { layout, scale });
  const totalSheets = sheets.length;
  const options = {
    entitiesBuilder: (entry, cursorX) => ENTITY_BUILDERS[entry.kind](entry, cursorX),
    legendVariant: 'foundations',
    title: 'FUNDACIONES - PLANTA Y CORTES TIPO',
    labelBuilder: (entry) => LABEL_BUILDERS[entry.kind](entry),
    projectInfo: info, criteria, layout, scale, format: layout.key
  };

  return sheets.map((sheetEntries, sheetIndex) => {
    sheetEntries.forEach((e, i) => { e.viewportId = i + 2; });
    return {
      filename: `fundaciones_${layout.key}_lamina${sheetIndex + 1}.dxf`,
      content: generateSheetDxf(sheetEntries, sheetIndex, totalSheets, model.grid, options)
    };
  });
}

export function downloadFoundationSheets(model, opts = {}) {
  const policy = guardExport(model, 'dxf-foundation');
  if (!policy.allowed) return false;
  const sheets = generateFoundationSheets(model, opts);
  if (!sheets.length) {
    alert('No hay fundaciones en el modelo (Agregar fundacion o Herramientas -> Generar fundaciones desde muros).');
    return false;
  }
  sheets.forEach((sheet, i) => {
    setTimeout(() => {
      const blob = new Blob([sheet.content], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sheet.filename;
      a.click();
      URL.revokeObjectURL(url);
    }, i * 400); // mismo delay entre descargas que las demás láminas (bloqueo del navegador)
  });
  return true;
}
