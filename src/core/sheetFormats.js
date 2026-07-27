// core/sheetFormats.js
// ★ Sesión 22 — Formatos de lámina (A0/A1/A2/A3) y geometría del layout de papel.
// Única fuente de verdad de "dónde va cada cosa en la hoja": marco ISO 5457 (20 mm de lomo a la
// izquierda, 10 mm en los otros tres bordes), franja de zonas de referencia, cajetín ISO 7200 en
// la esquina inferior derecha, tabla de revisiones sobre él, banda de leyenda/notas a su
// izquierda y el área de dibujo con lo que sobra.
//
// El factor `k` escala TODO el bloque de rótulo (ancho, alturas de banda y alturas de texto) de
// forma coherente: en A0/A1 el cajetín es el de 180 mm de ISO 7200; en A2/A3 la hoja no da para
// 180 mm sin comerse el dibujo, así que se reduce proporcionalmente en vez de recortar campos.

export const PAPER_FORMATS = {
  A0: { w: 1189, h: 841, k: 1,   defaultScale: 50 },
  A1: { w: 841,  h: 594, k: 1,   defaultScale: 50 },
  A2: { w: 594,  h: 420, k: 0.8, defaultScale: 75 },
  A3: { w: 420,  h: 297, k: 0.7, defaultScale: 100 }
};

export const FORMAT_KEYS = ['A0', 'A1', 'A2', 'A3'];
export const DEFAULT_FORMAT = 'A1';

const FRAME_MARGIN = 10;       // mm, borde superior/inferior/derecho (ISO 5457)
const FRAME_LEFT_MARGIN = 20;  // mm, lomo de archivado (izquierdo)
const TITLE_BLOCK_W = 180;     // mm × k, ancho normalizado del cajetín (ISO 7200)
const TITLE_BLOCK_H = 81;      // mm × k, suma de las bandas definidas en sheetTitleBlock.js
const REV_ROW_H = 6;           // mm × k, alto de fila de la tabla de revisiones
const REV_MIN_ROWS = 2;        // encabezado + al menos una revisión, aunque no haya ninguna
const ZONE_BAND = 5;           // mm × k, ancho de la franja de zonas de referencia
const GAP = 6;                 // mm × k, separación entre cajetín, leyenda y área de dibujo
export const VIEW_LABEL_H = 9; // mm × k, alto reservado bajo cada viewport (rótulo + escala gráfica)

export function resolveFormat(key) {
  return PAPER_FORMATS[key] ? key : DEFAULT_FORMAT;
}

/** Geometría completa de una lámina, en mm de papel con origen en la esquina inferior izquierda.
 * `revisionCount` sólo afecta la altura de la tabla de revisiones (y con ella el piso del área de
 * dibujo): el área de dibujo se calcula por sobre la tabla en TODO el ancho, no sólo sobre el
 * cajetín, para que ningún viewport pueda pisarla al empaquetar. */
export function sheetLayout(formatKey, revisionCount = 0) {
  const key = resolveFormat(formatKey);
  const f = PAPER_FORMATS[key];
  const k = f.k;
  const band = ZONE_BAND * k;
  const gap = GAP * k;

  const frame = {
    x0: FRAME_LEFT_MARGIN, y0: FRAME_MARGIN,
    x1: f.w - FRAME_MARGIN, y1: f.h - FRAME_MARGIN
  };
  const inner = {
    x0: frame.x0 + band, y0: frame.y0 + band,
    x1: frame.x1 - band, y1: frame.y1 - band
  };

  const tbW = TITLE_BLOCK_W * k;
  const tbH = TITLE_BLOCK_H * k;
  const titleBlock = { x0: inner.x1 - tbW, y0: inner.y0, x1: inner.x1, y1: inner.y0 + tbH };

  const revRows = Math.max(REV_MIN_ROWS, revisionCount + 1); // +1 = fila de encabezado
  const revH = revRows * REV_ROW_H * k;
  const revisions = { x0: titleBlock.x0, y0: titleBlock.y1, x1: titleBlock.x1, y1: titleBlock.y1 + revH, rowH: REV_ROW_H * k };

  // La leyenda ocupa el resto de la franja inferior, a la izquierda del cajetín.
  const legend = { x0: inner.x0, y0: inner.y0, x1: titleBlock.x0 - gap, y1: titleBlock.y1 };

  const draw = { x0: inner.x0, y0: revisions.y1 + gap, x1: inner.x1, y1: inner.y1 };

  return {
    key, paperW: f.w, paperH: f.h, k, band, gap,
    defaultScale: f.defaultScale,
    frame, inner, titleBlock, revisions, legend, draw,
    viewLabelH: VIEW_LABEL_H * k
  };
}
