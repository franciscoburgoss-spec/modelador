// core/exportFramingDxf.js
// Exporta la elevación de tabiquería (montantes, dintel/antepecho, soleras) a DXF — una
// pieza por muro con despiece de metalcon generado (wall.studs), dibujada en un plano propio
// de coordenadas LOCALES: X = offset a lo largo del muro (mm), Y = elevación (mm). No usa las
// coordenadas de mundo (planta) del muro — es un plano de fabricación, no de emplazamiento.
import { resolveWallGeometry, isWallXRun } from './elementGeometry.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { findProjectMetalconProfile } from './exportCalculix.js';
import { getWallDisplayName } from './naming.js';
import { LEVEL_TYPES } from './levelTypes.js';
import { assignOsbPieceCodes } from './osbModulation.js';
import { guardExport } from './exportPolicy.js';
import { getRoofSystems } from './roofPlaneOutputs.js';
import { studFlangeSpan } from './trussLayout.js';

export const GAP_BETWEEN_WALLS = 1500; // mm, separación horizontal entre la elevación de un muro y el siguiente
export const LABEL_OFFSET_Y = 300;     // mm, alto del texto de etiqueta de muro sobre su elevación
export const AXIS_MARGIN = 500;        // mm, cuánto sobresale la línea de eje por sobre la elevación
export const H_COTA_Y = -950;          // mm, altura de la línea de cota horizontal (bajo la elevación)
export const BUBBLE_Y = -1500;         // mm, centro de la burbuja de eje (bajo la cota horizontal)
export const BUBBLE_R = 250;           // mm, radio de la burbuja de eje
export const V_COTA_X = -350;          // mm, separación de la cota vertical a la izquierda del muro
export const NIVEL_LABEL_MARGIN = 200; // mm, separación del texto de nivel Z a la derecha del muro
export const LEVEL_SYMBOL_W = 160;   // mm, ancho de la base del símbolo de nivel (triángulo)
export const LEVEL_SYMBOL_H = 140;   // mm, alto del símbolo de nivel
export const LEVEL_SYMBOL_GAP = 100; // mm, separación entre línea/símbolo/sigla/label
const TEXT_CHAR_WIDTH_FACTOR = 0.65; // ancho aproximado de un carácter, como fracción de la altura de texto

// --- jerarquía de tamaños de texto ---------------------------------------------------------
// Valores en mm de ESPACIO MODELO. Los viewports de lámina (exportSheetsDxf.js) muestran esto a
// escala 1:25, así que al imprimir quedan en mm de papel = valor/25 — entre 5 y 10mm siempre,
// para que sean legibles pero no estorben el dibujo:
//   TITLE 225/25=9mm · SUBTITLE 175/25=7mm · TEXT 150/25=6mm · COTA 125/25=5mm (el piso permitido)
export const TEXT_HEIGHT_TITLE = 225;    // etiqueta de muro, encabezados
export const TEXT_HEIGHT_SUBTITLE = 175; // burbuja de eje, etiqueta de nivel
export const TEXT_HEIGHT_TEXT = 150;     // tags de pieza, relleno agrupado
export const TEXT_HEIGHT_COTA = 125;     // números de cota (el texto más denso/repetido)

export function estimateTextWidth(str, height) {
  return sanitizeDxfText(str).length * height * TEXT_CHAR_WIDTH_FACTOR;
}
export const TICK_HALF = 100;          // mm, media longitud de las marcas de cota

// --- bbox real de entidades (Sesión 16, bug 2) -------------------------------------------------
// Reemplaza las fórmulas de extent escritas a mano: recorre las entidades YA generadas (mismas
// que se dibujan) y une sus cajas — así el extent nunca puede quedar más chico que lo dibujado.
// Cada entidad es un string con pares código/valor DXF (line/text/circle/rectPolyline/
// closedPolyline de este módulo); se parsea genéricamente por tipo de registro.
const EXTENT_PADDING = 100; // mm, margen pequeño para que nada quede pegado al borde del viewport

function parseDxfRecords(entityStr) {
  const tokens = entityStr.split('\n');
  const records = [];
  let cur = null;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const code = tokens[i], value = tokens[i + 1];
    if (code === '0') { cur = { type: value, f: {} }; records.push(cur); continue; }
    if (cur) cur.f[code] = value;
  }
  return records;
}

/** Bbox de UNA entidad (string DXF ya construido con line/text/circle/rectPolyline/
 * closedPolyline). Los textos se estiman con estimateTextWidth y su altura real (rotación 0/90,
 * los únicos ángulos usados hoy en estos exportadores). */
function entityBBox(entityStr) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  const add = (x, y) => { if (x < xMin) xMin = x; if (x > xMax) xMax = x; if (y < yMin) yMin = y; if (y > yMax) yMax = y; };
  for (const { type, f } of parseDxfRecords(entityStr)) {
    if (type === 'TEXT') {
      const x = parseFloat(f['10']), y = parseFloat(f['20']), h = parseFloat(f['40']) || 0;
      const rot = ((parseFloat(f['50']) || 0) % 180 + 180) % 180;
      const w = estimateTextWidth(f['1'] ?? '', h);
      if (rot < 45 || rot > 135) { add(x, y); add(x + w, y + h); } else { add(x, y); add(x + h, y + w); }
      continue;
    }
    for (const code of ['10', '11', '12', '13']) {
      const yCode = String(Number(code) + 10);
      if (f[code] !== undefined && f[yCode] !== undefined) add(parseFloat(f[code]), parseFloat(f[yCode]));
    }
  }
  return { xMin, xMax, yMin, yMax };
}

// Códigos DXF de coordenada X / Y en las entidades que genera este módulo (LINE 10/11, TEXT 10,
// CIRCLE 10, SOLID 10..13, VERTEX 10). Se usan para trasladar entidades YA generadas sin tener
// que parametrizar cada función de dibujo con un desplazamiento vertical.
const X_CODES = new Set(['10', '11', '12', '13']);
const Y_CODES = new Set(['20', '21', '22', '23']);

/** Traslada un conjunto de entidades DXF ya construidas. Necesario para las elevaciones por eje
 * (sesión 18): cada muro se dibuja en su plano local con base z=0, y luego se sube a su cota real
 * dentro del eje. Solo mueve puntos — nunca rota ni escala, así que textos y alturas quedan
 * intactos. */
export function translateEntities(entities, dx = 0, dy = 0) {
  if (!dx && !dy) return entities;
  return entities.map((entityStr) => {
    const tokens = entityStr.split('\n');
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const code = tokens[i];
      if (X_CODES.has(code)) tokens[i + 1] = (parseFloat(tokens[i + 1]) + dx).toFixed(2);
      else if (Y_CODES.has(code)) tokens[i + 1] = (parseFloat(tokens[i + 1]) + dy).toFixed(2);
    }
    return tokens.join('\n');
  });
}

/** Bbox de un conjunto de entidades (une todas las cajas), con padding — es el extent real de lo
 * que efectivamente se dibuja. Vacío → extent nulo en torno al origen. */
export function unionEntitiesExtent(entities, padding = EXTENT_PADDING) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const e of entities) {
    const b = entityBBox(e);
    if (b.xMin < xMin) xMin = b.xMin;
    if (b.xMax > xMax) xMax = b.xMax;
    if (b.yMin < yMin) yMin = b.yMin;
    if (b.yMax > yMax) yMax = b.yMax;
  }
  if (!Number.isFinite(xMin)) return { xMin: -padding, xMax: padding, yMin: -padding, yMax: padding };
  return { xMin: xMin - padding, xMax: xMax + padding, yMin: yMin - padding, yMax: yMax + padding };
}

// --- estándar de capas: color ACI (AutoCAD Color Index) + tipo de línea + espesor -------------
// 1=rojo 2=amarillo 3=verde 4=cian 5=azul 6=magenta 7=blanco/negro (según fondo)
// lineweight en centésimas de mm (código DXF 370: 13=0.13 18=0.18 35=0.35 50=0.50), jerarquía
// visual: COTAS/ETIQUETAS (más fino) < EJES/NIVELES (referencia) < MONTANTES/SOLERAS/SOLERAS-APOYO
// (estructura) < DINTELES/ANTEPECHOS (piezas de carga sobre vano, más gruesas).
export const LAYERS = {
  EJES:       { color: 1, ltype: 'CENTER', lineweight: 18 },
  NIVELES:    { color: 2, ltype: 'DASHED', lineweight: 18 },
  MONTANTES:  { color: 7, ltype: 'CONTINUOUS', lineweight: 35 },
  SOLERAS:    { color: 5, ltype: 'CONTINUOUS', lineweight: 35 },
  // solera de apoyo de techumbre (ver exportTrussDxf.js). Capa propia y NO `SOLERAS`: es pieza de
  // techumbre, el revisor tiene que poder apagarla sin apagar la tabiquería. Mismo peso porque
  // es estructura, no referencia.
  'SOLERAS-APOYO': { color: 5, ltype: 'CONTINUOUS', lineweight: 35 },
  DINTELES:   { color: 6, ltype: 'CONTINUOUS', lineweight: 50 },
  ANTEPECHOS: { color: 4, ltype: 'CONTINUOUS', lineweight: 50 },
  COTAS:      { color: 3, ltype: 'CONTINUOUS', lineweight: 13 },
  ETIQUETAS:  { color: 7, ltype: 'CONTINUOUS', lineweight: 13 },
  OSB:        { color: 8, ltype: 'DASHED', lineweight: 18 }, // capa de referencia (revestimiento), no estructural
  'MURO-REF': { color: 9, ltype: 'DASHED', lineweight: 13 }, // contorno de muro + vano, referencia liviana (ver exportOsbDxf.js)
  'CERCHA-CUERDAS':   { color: 5, ltype: 'CONTINUOUS', lineweight: 50 }, // cuerdas sup/inf + rebaje canaleta (ver exportTrussDxf.js)
  'CERCHA-ENTRAMADO': { color: 7, ltype: 'CONTINUOUS', lineweight: 25 }, // montantes + diagonales
  COSTANERAS: { color: 2, ltype: 'CONTINUOUS', lineweight: 18 }  // sección de costanera OMA sobre la cuerda superior
};

// --- patrones de línea ISO (guión e eje/centro) --------------------------------------------
// Los patrones ISO (ISO02W100 "guión", ISO04W100 "eje/centro" de acadiso.lin) están definidos en
// mm de PAPEL, pensados para un plot 1:1. Acá el espacio modelo es geometría real (1:1) que se ve
// a través de un viewport a escala 1:`scale` — para que el patrón se vea del tamaño ISO correcto
// en el papel final, se agranda por ese mismo factor en el modelo (en vez de usar $LTSCALE, cuyo
// efecto en viewports depende de cómo cada lector interprete $PSLTSCALE — más fràgil en un DXF
// escrito a mano). Ver ISO_LTYPE_SCALE en exportSheetsDxf.js (debe coincidir con la escala real
// de la lámina para que el patrón se vea del tamaño correcto en el papel).
export function isoDashedPattern(scale) {
  const dash = 12 * scale, gap = 3 * scale;
  return { segments: [dash, -gap], total: dash + gap };
}
export function isoCenterPattern(scale) {
  const dash = 24 * scale, gap = 3 * scale, dot = 0;
  return { segments: [dash, -gap, dot, -gap], total: dash + gap + dot + gap };
}

// abreviaturas de rol para las etiquetas de pieza (fabricación) — el relleno regular ('stud')
// se agrupa aparte (ver groupedFillLabel), no usa esta tabla.
export const ROLE_TAG = {
  edge: 'E', corner: 'T', backup: 'R',
  king: 'K', jack: 'J', cripple: 'C', crippleTop: 'CS',
  header: 'D', sill: 'A'   // ★ R1 — dintel / alfeizar (viven en headers, no en studs)
};

// DXF (R12/ASCII) no garantiza un charset consistente entre lectores CAD para acentos y
// símbolos como "→" — en algunos visores se pierden o se ven como "?". Se sanean a ASCII plano.
// Símbolos tipográficos frecuentes en las etiquetas del modelo que NO son ASCII y por tanto
// caían al fallback "?" en los DXF reales. Se traducen a su equivalente ASCII o al código de
// control de DXF (%%D grado, %%P mas/menos, %%C diámetro), que los lectores CAD renderizan como
// el símbolo real.
export const DXF_TRANSLITERATION = {
  '—': '-', '–': '-', '→': '-',
  '·': '.', '•': '.',
  '×': 'x',
  '≥': '>=', '≤': '<=',
  '°': '%%D', '±': '%%P', 'Ø': '%%C', 'ø': '%%C',
  '«': '"', '»': '"', '“': '"', '”': '"',
  '‘': "'", '’': "'",
  '…': '...'
};

const TRANSLITERATION_RE = new RegExp(`[${Object.keys(DXF_TRANSLITERATION).join('')}]`, 'g');

export function sanitizeDxfText(str) {
  return String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, (m) => (m === 'ñ' ? 'n' : 'N'))
    .replace(TRANSLITERATION_RE, (m) => DXF_TRANSLITERATION[m])
    .replace(/[^\x20-\x7E]/g, '?');
}

export function line(layer, x1, y1, x2, y2) {
  return [
    '0', 'LINE', '8', layer,
    '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0',
    '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0'
  ].join('\n');
}

export function text(layer, x, y, height, str, rotation = 0) {
  return [
    '0', 'TEXT', '8', layer,
    '10', x.toFixed(2), '20', y.toFixed(2), '30', '0',
    '40', height.toFixed(2),
    '50', rotation.toFixed(1),
    '1', sanitizeDxfText(str)
  ].join('\n');
}

export function circle(layer, x, y, r) {
  return ['0', 'CIRCLE', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0', '40', r.toFixed(2)].join('\n');
}

/** Triángulo RELLENO (entidad SOLID, soportada desde R12) — usado para el símbolo de nivel.
 * El 4to punto repite el 3ro: un SOLID de 3 vértices únicos se rellena como triángulo. */
export function solidTriangle(layer, [x1, y1], [x2, y2], [x3, y3]) {
  return [
    '0', 'SOLID', '8', layer,
    '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0',
    '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0',
    '12', x3.toFixed(2), '22', y3.toFixed(2), '32', '0',
    '13', x3.toFixed(2), '23', y3.toFixed(2), '33', '0'
  ].join('\n');
}

export function rectPolyline(layer, xMin, yMin, xMax, yMax) {
  const lines = ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1'];
  for (const [x, y] of [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]]) {
    lines.push('0', 'VERTEX', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0');
  }
  lines.push('0', 'SEQEND');
  return lines.join('\n');
}

/** Polilínea cerrada de puntos arbitrarios (no necesariamente axis-aligned) — para el contorno
 * real de una barra de cercha (rectángulo rotado según el ángulo del miembro, ver
 * core/trussLayout.js:memberRectCorners). */
export function closedPolyline(layer, points) {
  const lines = ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1'];
  for (const { x, y } of points) {
    lines.push('0', 'VERTEX', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0');
  }
  lines.push('0', 'SEQEND');
  return lines.join('\n');
}

/** Tabla LTYPE + LAYER — se construye una sola vez por archivo (no por muro). `scale` es la
 * escala de plano equivalente usada para dimensionar los patrones de línea ISO (ver
 * isoDashedPattern/isoCenterPattern) — 50 por defecto, igual que la lámina A1 (exportSheetsDxf.js
 * SCALE), para que ejes/niveles se vean consistentes entre "todas las elevaciones" y las láminas. */
export function tablesSection(scale = 50) {
  const dashedP = isoDashedPattern(scale);
  const centerP = isoCenterPattern(scale);
  const ltypes = [
    ['0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0'],
    ['0', 'LTYPE', '2', 'DASHED', '70', '0', '3', 'ISO dash', '72', '65', '73', String(dashedP.segments.length), '40', dashedP.total.toFixed(1),
      ...dashedP.segments.flatMap(v => ['49', v.toFixed(1), '74', '0'])],
    ['0', 'LTYPE', '2', 'CENTER', '70', '0', '3', 'ISO long-dash dot', '72', '65', '73', String(centerP.segments.length), '40', centerP.total.toFixed(1),
      ...centerP.segments.flatMap(v => ['49', v.toFixed(1), '74', '0'])]
  ];
  // NOTA: sin group 370 (LWEIGHT) a propósito — este archivo es R12 puro, sin HEADER/BLOCKS/OBJECTS
  // (ver generateFramingDxf). Declarar AC1015 + LWEIGHT ahí rompía la apertura en QCAD Pro (un
  // AC1015 real necesita esas secciones; el R12 "pelado" no soporta el group 370 en LAYER). La
  // jerarquía de espesores de línea vive solo en las láminas (exportSheetsDxf.js), que sí son un
  // archivo AC1015 completo y validado con ezdxf.
  const layerEntries = Object.entries(LAYERS).map(([name, def]) =>
    ['0', 'LAYER', '2', name, '70', '0', '62', String(def.color), '6', def.ltype]
  );

  return [
    '0', 'TABLE', '2', 'LTYPE', '70', String(ltypes.length),
    ...ltypes.flat(),
    '0', 'ENDTAB',
    '0', 'TABLE', '2', 'LAYER', '70', String(layerEntries.length),
    ...layerEntries.flat(),
    '0', 'ENDTAB'
  ].join('\n');
}

/** Quita duplicados/casi-duplicados (tolerancia 1mm) y ordena ascendente. */
export function uniqueSorted(values, tolerance = 1) {
  const sorted = [...values].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (!out.length || v - out[out.length - 1] > tolerance) out.push(v);
  }
  return out;
}

function horizontalCota(xOffset, breaks, y) {
  const entities = [];
  entities.push(line('COTAS', xOffset + breaks[0], y, xOffset + breaks[breaks.length - 1], y));
  for (const b of breaks) entities.push(line('COTAS', xOffset + b, y - TICK_HALF, xOffset + b, y + TICK_HALF));
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i], b = breaks[i + 1];
    if (b - a < 1) continue;
    entities.push(text('COTAS', xOffset + (a + b) / 2, y + TICK_HALF * 1.3, TEXT_HEIGHT_COTA, `${Math.round(b - a)}`));
  }
  return entities;
}

function verticalCota(xOffset, breaks) {
  const entities = [];
  const x = xOffset + V_COTA_X;
  entities.push(line('COTAS', x, breaks[0], x, breaks[breaks.length - 1]));
  for (const b of breaks) entities.push(line('COTAS', x - TICK_HALF, b, x + TICK_HALF, b));
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i], b = breaks[i + 1];
    if (b - a < 1) continue;
    entities.push(text('COTAS', x - TICK_HALF * 1.6, (a + b) / 2, TEXT_HEIGHT_COTA, `${Math.round(b - a)}`, 90));
  }
  return entities;
}

/** Ejes de grilla (en la dirección del muro) que intervienen en su tramo, con burbuja
 * (círculo + nombre) en el extremo inferior — bajo la cota horizontal. */
export function interveningAxes(grid, isXRun, worldMin, worldMax) {
  const axes = isXRun ? grid.xAxes : grid.yAxes;
  return axes
    .filter(a => a.position >= worldMin - 1 && a.position <= worldMax + 1)
    .map(a => ({ offset: a.position - worldMin, label: a.label }))
    .sort((a, b) => a.offset - b.offset);
}

export function axisEntities(xOffset, wallHeight, axesInfo, bubbleY = BUBBLE_Y) {
  const entities = [];
  for (const a of axesInfo) {
    const x = xOffset + a.offset;
    entities.push(line('EJES', x, wallHeight + AXIS_MARGIN, x, bubbleY + BUBBLE_R));
    entities.push(circle('ETIQUETAS', x, bubbleY, BUBBLE_R));
    entities.push(text('ETIQUETAS', x - BUBBLE_R * 0.55, bubbleY - 90, TEXT_HEIGHT_SUBTITLE, a.label));
  }
  return entities;
}

/** Niveles del proyecto que caen dentro del rango de altura de un muro (con 1mm de tolerancia). */
export function wallLevelsWithinRange(grid, wallBottomElevation, wallHeight) {
  const wallTopElevation = wallBottomElevation + wallHeight;
  return grid.zLevels.filter(l => l.elevation >= wallBottomElevation - 1 && l.elevation <= wallTopElevation + 1);
}

/** La sigla solo aporta si difiere del label del nivel (evita "NTN NTN" en datums cuyo label ya
 * es la sigla). Compartido por dibujo y bounding box para que coincidan. */
function levelSiglaVisible(def, lvl) {
  if (!def) return false;
  return String(def.sigla).trim().toUpperCase() !== String(lvl.label ?? '').trim().toUpperCase();
}

/** Ancho extra (mm) que ocupa el símbolo+sigla de un nivel con `levelType` antes de su label —
 * compartido entre levelEntities (dibujo) y computeWallViewExtent (bounding box), para que
 * ambos coincidan siempre y no se superponga con la siguiente elevación. */
function levelSymbolExtraWidth(lvl) {
  const def = lvl.levelType ? LEVEL_TYPES[lvl.levelType] : null;
  if (!def) return 0;
  const siglaW = levelSiglaVisible(def, lvl)
    ? estimateTextWidth(def.sigla, TEXT_HEIGHT_SUBTITLE) + LEVEL_SYMBOL_GAP
    : 0;
  return LEVEL_SYMBOL_W + LEVEL_SYMBOL_GAP + siglaW;
}

/** Niveles Z del proyecto que caen dentro del rango de altura del muro (incluye el propio
 * nivel inferior/superior) — línea horizontal punteada + etiqueta con el nombre del nivel. Si el
 * nivel tiene `levelType` (cielo/frontón general/alto — ver core/levelTypes.js), además dibuja el
 * símbolo estándar (triángulo relleno) + su sigla (CG/CA/FG/FA) antes del nombre completo. */
export function levelEntities(xOffset, length, wallHeight, wallBottomElevation, grid) {
  const entities = [];
  for (const lvl of wallLevelsWithinRange(grid, wallBottomElevation, wallHeight)) {
    const y = lvl.elevation - wallBottomElevation;
    entities.push(line('NIVELES', xOffset, y, xOffset + length, y));

    let labelX = xOffset + length + NIVEL_LABEL_MARGIN;
    const def = lvl.levelType ? LEVEL_TYPES[lvl.levelType] : null;
    if (def) {
      const cx = labelX + LEVEL_SYMBOL_W / 2;
      entities.push(solidTriangle('ETIQUETAS',
        [cx, y],
        [cx - LEVEL_SYMBOL_W / 2, y + LEVEL_SYMBOL_H],
        [cx + LEVEL_SYMBOL_W / 2, y + LEVEL_SYMBOL_H]
      ));
      labelX += LEVEL_SYMBOL_W + LEVEL_SYMBOL_GAP;
      if (levelSiglaVisible(def, lvl)) {
        entities.push(text('ETIQUETAS', labelX, y - 90, TEXT_HEIGHT_SUBTITLE, def.sigla));
        labelX += estimateTextWidth(def.sigla, TEXT_HEIGHT_SUBTITLE) + LEVEL_SYMBOL_GAP;
      }
    }
    entities.push(text('ETIQUETAS', labelX, y - 90, TEXT_HEIGHT_SUBTITLE, lvl.label));
  }
  return entities;
}

/** Texto de una pieza especial (todo menos 'stud' de relleno regular, que se agrupa aparte).
 * `headers` (dintel/antepecho) es una colección aparte de `studs` — ver diagnóstico R1 §1.2 —
 * por eso se rotula con la misma geometría vertical que usa el dibujo (`trackHeight`), no con
 * `zMin/zMax` de un stud. `nogging` (cadeneta) queda fuera: todavía no es pieza de tabiquería (R3). */
function pieceLabelEntities(xOffset, studs, headers = [], trackHeight = 0) {
  const entities = [];
  for (const s of studs) {
    const tag = ROLE_TAG[s.role];
    if (!tag) continue; // 'stud' de relleno regular: ver groupedFillLabel
    const midZ = (s.zMin + s.zMax) / 2;
    entities.push(text('ETIQUETAS', xOffset + s.offset + 60, midZ - 90, TEXT_HEIGHT_TEXT, tag));
  }
  for (const h of headers) {
    const tag = ROLE_TAG[h.role];
    if (!tag) continue;
    const isSill = h.role === 'sill';
    const yMin = isSill ? h.z - trackHeight : h.z;
    const yMax = isSill ? h.z : h.z + trackHeight;
    const midX = xOffset + (h.oMin + h.oMax) / 2;
    const midZ = (yMin + yMax) / 2;
    entities.push(text('ETIQUETAS', midX - 60, midZ - 90, TEXT_HEIGHT_TEXT, tag));
  }
  return entities;
}

/** Un solo texto agrupado para todo el relleno regular ('stud'), en vez de repetirlo en
 * cada montante — evita saturar el plano cuando hay muchos a spacing constante. */
function groupedFillLabel(xOffset, length, wallHeight, studs, studSpacing) {
  const fillStuds = studs.filter(s => s.role === 'stud');
  if (!fillStuds.length) return [];
  const label = studSpacing ? `MONTANTE RELLENO @${Math.round(studSpacing)}mm (${fillStuds.length})` : `MONTANTE RELLENO (${fillStuds.length})`;
  return [text('ETIQUETAS', xOffset + length / 2, wallHeight + LABEL_OFFSET_Y + 250, TEXT_HEIGHT_TEXT, label)];
}

/** Modulación de placas OSB ya guardada (wall.osbCourses — ver core/osbModulation.js): junta
 * vertical de cada placa por curso (capa de referencia, no estructural — no repite lo que ya
 * dibujan montantes/soleras), junta horizontal entre cursos con nota de huincha (manual LP OSB:
 * la junta horizontal en muros >2440mm absorbe deformación/espesor de envigado), y un resumen. */
/** Tabla simple (líneas de grilla + texto por celda) — para tablas de despiece u otras listas
 * tabulares en DXF. `columns`: [{label, width}]; `rows`: string[][] (mismo largo que columns).
 * Crece hacia ABAJO desde (x, yTop): fila de encabezado primero, luego una fila por elemento de
 * `rows`. Retorna también `width`/`height` totales (para calcular extents). */
export function drawTable(lineLayer, textLayer, x, yTop, columns, rows, rowHeight = 160, textHeight = TEXT_HEIGHT_COTA) {
  const entities = [];
  const totalWidth = columns.reduce((a, c) => a + c.width, 0);
  const nRows = rows.length + 1; // + encabezado
  const yBottom = yTop - nRows * rowHeight;

  for (let i = 0; i <= nRows; i++) {
    const y = yTop - i * rowHeight;
    entities.push(line(lineLayer, x, y, x + totalWidth, y));
  }
  let cx = x;
  entities.push(line(lineLayer, cx, yTop, cx, yBottom));
  for (const col of columns) { cx += col.width; entities.push(line(lineLayer, cx, yTop, cx, yBottom)); }

  const padTop = (rowHeight - textHeight) / 2;
  cx = x;
  for (const col of columns) {
    entities.push(text(textLayer, cx + 30, yTop - rowHeight + padTop, textHeight, col.label));
    cx += col.width;
  }
  rows.forEach((row, r) => {
    const rowTop = yTop - (r + 1) * rowHeight;
    cx = x;
    row.forEach((val, c) => {
      entities.push(text(textLayer, cx + 30, rowTop - rowHeight + padTop, textHeight, String(val)));
      cx += columns[c].width;
    });
  });

  return { entities, width: totalWidth, height: nRows * rowHeight };
}

export function osbEntities(xOffset, length, wallHeight, osbCourses, gap = 5, osbNoggings = []) {
  if (!osbCourses?.length) return [];
  const entities = [];
  const halfGap = gap / 2;
  const codes = assignOsbPieceCodes(osbCourses);

  for (const course of osbCourses) {
    for (const p of course.panels) {
      // junta vertical interna — se omiten los bordes del muro (x=0 y x=length), ya cubiertos
      // por el montante de extremo/esquina. Si un cutout (vacío de vano recortado de la placa)
      // toca la junta, la línea se parte: solo se dibuja donde hay material. El gap real entre
      // placas (config.gap, default 3mm) se dibuja como dos líneas paralelas que delimitan el
      // canal de junta — antes solo era visual en el preview canvas, no aparecía en el DXF.
      if (p.start > 1) {
        const cuts = (p.cutouts || []).filter(ct => ct.start - 1 <= p.start && p.start <= ct.end + 1);
        let segs = [[course.zMin, course.zMax]];
        for (const ct of cuts) {
          segs = segs.flatMap(([lo, hi]) => {
            const out = [];
            if (ct.zMin - lo > 1) out.push([lo, Math.min(ct.zMin, hi)]);
            if (hi - ct.zMax > 1) out.push([Math.max(ct.zMax, lo), hi]);
            return out;
          });
        }
        for (const [lo, hi] of segs) {
          entities.push(line('OSB', xOffset + p.start - halfGap, lo, xOffset + p.start - halfGap, hi));
          entities.push(line('OSB', xOffset + p.start + halfGap, lo, xOffset + p.start + halfGap, hi));
        }
      }
      const midX = xOffset + (p.start + p.end) / 2;
      const midZ = (course.zMin + course.zMax) / 2;
      entities.push(text('OSB', midX - 70, midZ - 60, TEXT_HEIGHT_COTA, codes.get(p)));
    }
  }

  // junta horizontal entre cursos — se omiten los bordes del muro (zMin=0 / zMax=wallHeight),
  // ya cubiertos por la solera inferior/superior.
  for (let i = 0; i < osbCourses.length - 1; i++) {
    const z = osbCourses[i].zMax;
    entities.push(line('OSB', xOffset, z, xOffset + length, z));
    entities.push(text('OSB', xOffset + length + NIVEL_LABEL_MARGIN, z - 90, TEXT_HEIGHT_SUBTITLE,
      `CADENETA + HUINCHA (junta horizontal @z=${Math.round(z)})`));
  }

  // Cadeneta real: pieza horizontal bajo la junta, en los tramos donde hay material que fijar
  // (ver computeNoggings). Se dibuja como un rectángulo delgado para distinguirla de la junta.
  const NOGGING_H = 60; // mm, solo representación gráfica — el perfil real sale del catálogo
  for (const n of osbNoggings || []) {
    entities.push(rectPolyline('OSB', xOffset + n.oMin, n.z - NOGGING_H, xOffset + n.oMax, n.z));
  }

  const totalPanels = osbCourses.reduce((a, c) => a + c.panels.length, 0);
  const summary = osbCourses.length > 1
    ? `REVESTIMIENTO OSB — ${osbCourses.length} hiladas, ${totalPanels} placas, ${(osbNoggings || []).length} cadenetas`
    : `REVESTIMIENTO OSB — ${totalPanels} placas`;
  entities.push(text('OSB', xOffset, wallHeight + LABEL_OFFSET_Y + 500, TEXT_HEIGHT_TEXT, summary));

  return entities;
}

/** ★ B4.7.8-s5 (B) — La solera de apoyo vista DE CANTO en la elevación de tabiquería: corre a lo
 * largo de la cara interior del muro, así que en este plano (X = offset sobre el muro, Y =
 * elevación) es una banda horizontal `[baseElevation, topElevation]` entre los dos extremos del
 * tramo — no del muro: el `runRange` del sistema puede cubrir sólo un trozo o desbordarlo, y los
 * dos casos existen en `casa-L.json`. De ahí el clamp.
 *
 * Es REFERENCIA, no despiece: la pieza pertenece a la techumbre. No entra en `wall.studs`, ni en
 * las etiquetas de pieza, ni en la cota parcial encadenada del eje, y no se re-metra (ya está
 * contada en takeoff.js, grupo `roof`). */
function supportLedgerBandEntities(ledgers, layout, xOffset) {
  const entities = [];
  for (const led of ledgers || []) {
    if (!led?.p1 || !led?.p2) continue;
    const top = led.topElevation, base = led.baseElevation;
    if (top == null || base == null || !(top - base > 0)) continue;
    const along = (p) => (led.runAxis === 'x' ? p.x : p.y);
    const clamp = (v) => Math.min(Math.max(v - layout.worldMin, 0), layout.length);
    const a = clamp(along(led.p1)), b = clamp(along(led.p2));
    const xMin = Math.min(a, b), xMax = Math.max(a, b);
    if (!(xMax - xMin > 0)) continue;         // el tramo no toca este muro
    entities.push(rectPolyline('SOLERAS-APOYO',
      xOffset + xMin, base - layout.wallBottomElevation,
      xOffset + xMax, top - layout.wallBottomElevation));
  }
  return entities;
}

/** Entidades DXF (sin envoltorio SECTION) para la elevación de UN muro, desplazadas en X por
 * `xOffset` (para poder ubicar varios muros uno al lado del otro en el mismo archivo).
 *
 * `opts` existe para el modo "elevación por eje" (sesión 18): ahí el muro es un TRAMO dentro de
 * una elevación mayor, así que la decoración común (ejes, niveles, cotas) la dibuja el eje una
 * sola vez y el tramo solo aporta su despiece + su etiqueta secundaria. `yOffset` lo sube a su
 * cota real dentro del eje cuando los muros del eje arrancan en niveles distintos. */
export function wallFramingEntities(wall, grid, layout, studProfile, trackProfile, xOffset, axesInfo, opts = {}) {
  const {
    yOffset = 0, includeAxes = true, includeLevels = true, includeCotas = true,
    labelHeight = TEXT_HEIGHT_TITLE,
    ledgers = []   // ★ s5-B — soleras de apoyo de techumbre que corren sobre este muro (referencia)
  } = opts;
  const entities = [];
  const { studs, headers, length, wallHeight, wallBottomElevation } = layout;
  const studWidth = studProfile?.B ?? 90;
  const trackHeight = trackProfile?.H ?? 90;

  // Soleras (solera inferior/superior): el montante se INSERTA dentro del canal de la solera —
  // no van afuera de la altura de montantes, sino que comparten ese tramo. La solera inferior
  // arranca exacto en z=0 (donde también arranca el montante) y sube trackHeight; la superior
  // termina exacto en wallHeight (donde también termina el montante) y baja trackHeight.
  entities.push(rectPolyline('SOLERAS', xOffset, 0, xOffset + length, trackHeight));
  entities.push(rectPolyline('SOLERAS', xOffset, wallHeight - trackHeight, xOffset + length, wallHeight));

  // Fase de cada pieza (extremo de muro a ras hacia adentro · jamba a ras hacia afuera del vano ·
  // resto al eje): la resuelve `studFlangeSpan`, no este archivo. Antes vivía acá duplicada
  // literal con `render/wall.js` — dos fuentes de verdad para la misma cara (R2).
  const flangeCtx = {
    length,
    jambMins: (headers || []).map(h => h.oMin),
    jambMaxs: (headers || []).map(h => h.oMax)
  };

  for (const s of studs) {
    const { xMin, xMax } = studFlangeSpan(s, flangeCtx, studWidth);
    entities.push(rectPolyline('MONTANTES', xOffset + xMin, s.zMin, xOffset + xMax, s.zMax));
  }
  // Dintel: afuera del vano hacia ARRIBA (cara inferior en h.z). Antepecho: afuera hacia ABAJO
  // (cara superior en h.z). El vano queda con altura libre exacta = altura de la cota.
  for (const h of headers || []) {
    const isSill = h.role === 'sill';
    const layer = isSill ? 'ANTEPECHOS' : 'DINTELES';
    const yMin = isSill ? h.z - trackHeight : h.z;
    const yMax = isSill ? h.z : h.z + trackHeight;
    entities.push(rectPolyline(layer, xOffset + h.oMin, yMin, xOffset + h.oMax, yMax));
  }

  entities.push(...supportLedgerBandEntities(ledgers, layout, xOffset));

  entities.push(text('ETIQUETAS', xOffset, wallHeight + LABEL_OFFSET_Y, labelHeight, getWallDisplayName(wall, grid)));
  if (includeAxes) entities.push(...axisEntities(xOffset, wallHeight, axesInfo));
  if (includeLevels) entities.push(...levelEntities(xOffset, length, wallHeight, wallBottomElevation, grid));
  entities.push(...pieceLabelEntities(xOffset, studs, headers || [], trackHeight));
  entities.push(...groupedFillLabel(xOffset, length, wallHeight, studs, wall.studSpacing));

  if (includeCotas) {
    const kingOffsets = studs.filter(s => s.role === 'king').map(s => s.offset);
    const hBreaks = uniqueSorted([0, ...kingOffsets, length]);
    if (hBreaks.length > 1) entities.push(...horizontalCota(xOffset, hBreaks, H_COTA_Y));

    const vValues = (headers || []).map(h => h.z);
    const vBreaks = uniqueSorted([0, ...vValues, wallHeight]);
    if (vBreaks.length > 1) entities.push(...verticalCota(xOffset, vBreaks));
  }

  return translateEntities(entities, 0, yOffset);
}

/** Bounding box (coordenadas locales del muro) de TODO lo que se dibuja para una elevación —
 * montantes/soleras/dintel/antepecho, burbuja de eje, cotas, etiqueta de nivel, etiqueta de muro
 * y relleno agrupado — para saber exactamente cuánto espacio real ocupa (y no superponer la
 * siguiente elevación, ni al dibujar todas juntas en un archivo ni al armar un viewport a 1:25).
 * Se calcula generando las mismas entidades a xOffset=0 y uniendo su bbox real (+ padding). */
export function computeWallViewExtent(wall, layout, grid, studProfile, trackProfile, axesInfo) {
  const entities = wallFramingEntities(wall, grid, layout, studProfile, trackProfile, 0, axesInfo);
  return unionEntitiesExtent(entities);
}

/** Layout + geometría a partir de la geometría real del muro y su despiece YA GUARDADO
 * (wall.studs/wall.headers) — no recalcula la modulación, exporta exactamente lo que el
 * usuario generó y guardó en "Modulación de metalcon". */
export function resolveWallLayout(wall, grid, paramsMap, elementsById) {
  if (!wall.studs?.length) return null;
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return null;
  const isXRun = isWallXRun(wall);
  const worldMin = isXRun ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
  const worldMax = isXRun ? Math.max(geo.p1.x, geo.p2.x) : Math.max(geo.p1.y, geo.p2.y);
  const length = worldMax - worldMin;
  const bottomLevel = grid.zLevels.find(l => l.id === wall.bottomZ);
  const topLevel = grid.zLevels.find(l => l.id === wall.topZ);
  if (!bottomLevel || !topLevel) return null;
  const wallHeight = topLevel.elevation - bottomLevel.elevation;
  if (!(length > 0) || !(wallHeight > 0)) return null;
  // coordenada del eje sobre el que corre el muro (Y si corre en X, X si corre en Y) — es la
  // clave con la que se agrupan los muros en una sola elevación de eje (ver groupEntriesByAxis).
  const fixedWorld = isXRun ? geo.p1.y : geo.p1.x;
  return {
    studs: wall.studs, headers: wall.headers || [], length, wallHeight,
    isXRun, worldMin, worldMax, fixedWorld, wallBottomElevation: bottomLevel.elevation
  };
}

// --- elevaciones por eje (Sesión 18) ----------------------------------------------------------
// Una elevación = un EJE, no un muro. Todos los muros que corren sobre el mismo eje se dibujan en
// una sola vista, ubicados por COORDENADA DE MUNDO (con los huecos reales donde no hay muro), con
// una sola línea de niveles, una cota parcial encadenada y una cota entre ejes. Es el mismo
// criterio con el que la vista de elevación en pantalla arma su corte (core/elevation.js:
// category 1 = muro en el plano del eje), así que el DXF exporta lo que se ve.

export const AXIS_TITLE_OFFSET_Y = 900;         // mm, título "ELEVACION EJE X" sobre la elevación
export const H_COTA_AXES_Y = H_COTA_Y - 450;    // mm, segunda línea de cota: entre ejes
export const AXIS_BUBBLE_Y = H_COTA_AXES_Y - 550; // mm, burbuja bajo ambas cotas

/** Etiqueta del eje sobre el que corre el muro. Si no hay un eje de grilla en esa coordenada
 * (muro ubicado por referencia u offset), se rotula con la coordenada cruda para no perderlo. */
export function axisFixedLabel(grid, isXRun, fixedWorld) {
  const axes = (isXRun ? grid.yAxes : grid.xAxes) || [];
  const axis = axes.find(a => Math.abs(a.position - fixedWorld) < 1);
  return axis ? axis.label : `${isXRun ? 'Y' : 'X'}=${Math.round(fixedWorld)}`;
}

/** Agrupa entries de muro (`{wall, layout, studProfile, trackProfile, axesInfo}`) por
 * dirección + eje fijo. Devuelve un grupo por eje, con sus muros ordenados de menor a mayor
 * coordenada de mundo (mismo orden que la vista en pantalla). */
export function groupEntriesByAxis(entries, grid) {
  const byKey = new Map();
  for (const entry of entries) {
    const { isXRun, fixedWorld } = entry.layout;
    const key = `${isXRun ? 'x' : 'y'}@${Math.round(fixedWorld)}`;
    if (!byKey.has(key)) {
      byKey.set(key, { key, isXRun, fixedWorld, axisLabel: axisFixedLabel(grid, isXRun, fixedWorld), members: [] });
    }
    byKey.get(key).members.push(entry);
  }

  const groups = [...byKey.values()];
  for (const g of groups) {
    g.members.sort((a, b) => a.layout.worldMin - b.layout.worldMin);
    g.worldMin = Math.min(...g.members.map(m => m.layout.worldMin));
    g.worldMax = Math.max(...g.members.map(m => m.layout.worldMax));
    g.baseElevation = Math.min(...g.members.map(m => m.layout.wallBottomElevation));
    g.topElevation = Math.max(...g.members.map(m => m.layout.wallBottomElevation + m.layout.wallHeight));
    g.displayName = `ELEVACION EJE ${g.axisLabel}`;
  }
  // ejes horizontales (muros que corren en X) primero, y dentro de cada dirección de sur a norte
  groups.sort((a, b) => (a.isXRun === b.isXRun ? a.fixedWorld - b.fixedWorld : (a.isXRun ? -1 : 1)));
  return groups;
}

/** Entidades DXF de la elevación completa de UN eje, desplazada en X por `xOffset`. */
export function axisGroupEntities(group, grid, xOffset = 0) {
  const width = group.worldMax - group.worldMin;
  const height = group.topElevation - group.baseElevation;
  const entities = [];

  // tramos: cada muro en su posición de mundo dentro del eje y a su cota real
  for (const m of group.members) {
    const dx = xOffset + (m.layout.worldMin - group.worldMin);
    const dy = m.layout.wallBottomElevation - group.baseElevation;
    entities.push(...wallFramingEntities(m.wall, grid, m.layout, m.studProfile, m.trackProfile, dx, m.axesInfo, {
      yOffset: dy, includeAxes: false, includeLevels: false, includeCotas: false,
      labelHeight: TEXT_HEIGHT_TEXT, // etiqueta secundaria: identifica la pieza del despiece
      ledgers: m.ledgers             // ★ s5-B — `opts` es exactamente el mecanismo para esto: sin tocar firmas
    }));
  }

  entities.push(text('ETIQUETAS', xOffset, height + AXIS_TITLE_OFFSET_Y, TEXT_HEIGHT_TITLE, group.displayName));

  // una sola línea de niveles a lo ancho de todo el eje
  entities.push(...levelEntities(xOffset, width, height, group.baseElevation, grid));

  // ejes que intervienen en el tramo completo (offsets relativos al inicio del eje)
  const axesInfo = interveningAxes(grid, group.isXRun, group.worldMin, group.worldMax);
  entities.push(...axisEntities(xOffset, height, axesInfo, AXIS_BUBBLE_Y));

  // cota parcial encadenada: bordes de cada muro + jambas de vano, continua a lo largo del eje
  const partialBreaks = [];
  for (const m of group.members) {
    const base = m.layout.worldMin - group.worldMin;
    partialBreaks.push(base, base + m.layout.length);
    for (const s of m.layout.studs) if (s.role === 'king') partialBreaks.push(base + s.offset);
  }
  const hBreaks = uniqueSorted([0, ...partialBreaks, width]);
  if (hBreaks.length > 1) entities.push(...horizontalCota(xOffset, hBreaks, H_COTA_Y));

  // cota entre ejes (segunda línea, bajo la parcial)
  const axisBreaks = uniqueSorted([0, ...axesInfo.map(a => a.offset), width]);
  if (axisBreaks.length > 1) entities.push(...horizontalCota(xOffset, axisBreaks, H_COTA_AXES_Y));

  // una sola cota vertical: arranques y coronaciones de los muros del eje, niveles del proyecto
  // y cotas de dintel/antepecho, todas referidas a la base común del eje.
  const vValues = [];
  for (const m of group.members) {
    const dy = m.layout.wallBottomElevation - group.baseElevation;
    vValues.push(dy, dy + m.layout.wallHeight);
    for (const h of m.layout.headers) vValues.push(dy + h.z);
  }
  for (const lvl of wallLevelsWithinRange(grid, group.baseElevation, height)) {
    vValues.push(lvl.elevation - group.baseElevation);
  }
  const vBreaks = uniqueSorted([0, ...vValues, height]);
  if (vBreaks.length > 1) entities.push(...verticalCota(xOffset, vBreaks));

  return entities;
}

/** Bbox real de la elevación de un eje — mismas entidades que se dibujan, a xOffset=0. */
export function computeAxisGroupExtent(group, grid) {
  return unionEntitiesExtent(axisGroupEntities(group, grid, 0));
}

/** Resuelve un entry por muro con despiece generado (layout + perfiles + extent propio). Es el
 * insumo de `groupEntriesByAxis`; el extent por muro solo se usa como respaldo/diagnóstico. */
export function resolveWallEntries(model) {
  const { grid, elements, library } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const metalconProfiles = library?.metalconProfiles || [];
  const roofSystems = getRoofSystems(model);

  const entries = [];
  for (const wall of elements) {
    if (wall.type !== 'wall') continue;
    const layout = resolveWallLayout(wall, grid, paramsMap, elementsById);
    if (!layout) continue;
    const studProfile = findProjectMetalconProfile(metalconProfiles, wall.framingStudProfileId);
    const trackProfile = findProjectMetalconProfile(metalconProfiles, wall.framingTrackProfileId);
    const axesInfo = interveningAxes(grid, layout.isXRun, layout.worldMin, layout.worldMax);
    // ★ s5-B — el extent NO recibe las soleras: la banda cae dentro de la altura del muro, así
    // que no lo agranda (verificado con test, no asumido).
    const extent = computeWallViewExtent(wall, layout, grid, studProfile, trackProfile, axesInfo);
    const ledgers = roofSystems.flatMap(s => (s.supportLedgers || []).filter(l => l.wallId === wall.id));
    entries.push({ wall, layout, studProfile, trackProfile, axesInfo, extent, ledgers });
  }
  return entries;
}

/** Grupos de elevación por eje del modelo completo, ya con su extent de dibujo. */
export function resolveAxisGroups(model) {
  const groups = groupEntriesByAxis(resolveWallEntries(model), model.grid);
  for (const g of groups) g.extent = computeAxisGroupExtent(g, model.grid);
  return groups;
}

/** Genera el DXF (R12) con la elevación de tabiquería de todos los muros del modelo que tengan
 * despiece de metalcon generado (wall.studs). Cada muro se dibuja en su propio plano local,
 * uno al lado del otro con separación GAP_BETWEEN_WALLS. Devuelve null si ningún muro califica. */
export function generateFramingDxf(model) {
  const groups = resolveAxisGroups(model);
  if (!groups.length) return null;

  const entities = [];
  let cursorX = 0;
  for (const group of groups) {
    // el origen local del eje se corre para que su extent.xMin quede exactamente en cursorX —
    // así el espacio entre elevaciones es siempre exacto, sin importar qué tan largos sean sus
    // textos (título, relleno agrupado, nivel, cotas), nunca se superponen.
    const originX = cursorX - group.extent.xMin;
    entities.push(...axisGroupEntities(group, model.grid, originX));
    cursorX = originX + group.extent.xMax + GAP_BETWEEN_WALLS;
  }

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

export function downloadFramingDxf(model) {
  const policy = guardExport(model, 'dxf-framing');
  if (!policy.allowed) return false;
  const content = generateFramingDxf(model);
  if (!content) {
    alert('No hay muros con despiece de metalcon generado (Modulación de metalcon → Generar despiece).');
    return false;
  }
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabiqueria.dxf';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
