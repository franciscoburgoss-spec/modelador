// core/sheetTitleBlock.js
// ★ Sesión 22 — Rótulo profesional de la lámina: cajetín ISO 7200, tabla de revisiones, grilla de
// zonas de referencia (ISO 5457), marcas de plegado y escala gráfica por vista.
//
// Todas las funciones devuelven entidades "R12-simple" (line/text de exportFramingDxf.js), en mm
// de PAPEL — exportSheetsDxf.js las pasa por upgradeAll(..., isPaperSpace = true). No se usa SOLID
// a propósito: upgradeEntity sólo sabe promover LINE/TEXT/CIRCLE al formato AC1015.
import { line, text, estimateTextWidth, sanitizeDxfText } from './exportFramingDxf.js';

const L_FRAME = 'MARCO';
const L_TB = 'CAJETIN';
const L_TAG = 'ETIQUETAS';

/** Ajusta un texto a un ancho de celda: primero baja la altura hasta 65 %, y si aún no cabe lo
 * trunca con "..." — nunca deja que un mandante largo se salga del cajetín. */
export function fitText(str, height, maxWidth) {
  const clean = sanitizeDxfText(str ?? '');
  if (!clean) return { str: '', height };
  let h = height;
  while (h > height * 0.65 && estimateTextWidth(clean, h) > maxWidth) h -= height * 0.05;
  if (estimateTextWidth(clean, h) <= maxWidth) return { str: clean, height: h };
  const perChar = estimateTextWidth('M', h);
  const maxChars = Math.max(3, Math.floor(maxWidth / perChar) - 3);
  return { str: `${clean.slice(0, maxChars)}...`, height: h };
}

function cell(entities, box, x0, x1, y0, y1, label, value, valueHeight, k) {
  const pad = 2 * k;
  if (label) entities.push(text(L_TB, x0 + pad, y1 - 3.4 * k, 2.5 * k, label));
  const fitted = fitText(value || '-', valueHeight, (x1 - x0) - 2 * pad);
  entities.push(text(L_TB, x0 + pad, y0 + (label ? 2 * k : (y1 - y0 - fitted.height) / 2), fitted.height, fitted.str));
}

function singleLineCell(entities, x0, x1, y0, y1, str, k) {
  const pad = 2 * k;
  const fitted = fitText(str, 3 * k, (x1 - x0) - 2 * pad);
  entities.push(text(L_TB, x0 + pad, y0 + (y1 - y0 - fitted.height) / 2, fitted.height, fitted.str));
}

/** Cajetín ISO 7200, esquina inferior derecha del área útil. Bandas de abajo hacia arriba:
 * dibujó/revisó/aprobó · escala/fecha/revisión · N° proyecto/N° lámina/lámina n de m ·
 * título de lámina · ubicación · obra · mandante. */
export function titleBlockEntities(layout, data) {
  const { titleBlock: tb, k } = layout;
  const e = [];
  const { x0, x1, y0, y1 } = tb;
  const w = x1 - x0;

  // bandas, de abajo hacia arriba (deben sumar TITLE_BLOCK_H de sheetFormats.js)
  const heights = [9, 9, 9, 16, 10, 14, 14].map(v => v * k);
  const yEdges = [y0];
  for (const h of heights) yEdges.push(yEdges[yEdges.length - 1] + h);

  // contorno + divisiones horizontales
  e.push(line(L_TB, x0, y0, x1, y0), line(L_TB, x0, y1, x1, y1));
  e.push(line(L_TB, x0, y0, x0, y1), line(L_TB, x1, y0, x1, y1));
  for (let i = 1; i < yEdges.length - 1; i++) e.push(line(L_TB, x0, yEdges[i], x1, yEdges[i]));

  // divisiones verticales de las tres bandas inferiores (70 / 125 de 180, escalado)
  const cx1 = x0 + w * (70 / 180);
  const cx2 = x0 + w * (125 / 180);
  for (const cx of [cx1, cx2]) e.push(line(L_TB, cx, y0, cx, yEdges[3]));

  // banda 0: dibujó / revisó / aprobó
  singleLineCell(e, x0, cx1, yEdges[0], yEdges[1], `DIBUJO: ${data.dibujo || '-'}`, k);
  singleLineCell(e, cx1, cx2, yEdges[0], yEdges[1], `REVISO: ${data.reviso || '-'}`, k);
  singleLineCell(e, cx2, x1, yEdges[0], yEdges[1], `APROBO: ${data.aprobo || '-'}`, k);

  // banda 1: escala / fecha / revisión vigente
  singleLineCell(e, x0, cx1, yEdges[1], yEdges[2], `ESCALA 1:${data.scale}`, k);
  singleLineCell(e, cx1, cx2, yEdges[1], yEdges[2], `FECHA: ${data.fecha}`, k);
  singleLineCell(e, cx2, x1, yEdges[1], yEdges[2], `REV. ${data.revision || '-'}`, k);

  // banda 2: N° proyecto / N° lámina / lámina n de m
  singleLineCell(e, x0, cx1, yEdges[2], yEdges[3], `PROYECTO N: ${data.proyectoNumero || '-'}`, k);
  singleLineCell(e, cx1, cx2, yEdges[2], yEdges[3], `LAMINA N: ${data.laminaNumero}`, k);
  singleLineCell(e, cx2, x1, yEdges[2], yEdges[3], `HOJA ${data.sheetIndex} DE ${data.totalSheets}`, k);

  // bandas 3–6: título de lámina, ubicación, obra, mandante
  cell(e, tb, x0, x1, yEdges[3], yEdges[4], 'TITULO DE LAMINA', data.titulo, 5 * k, k);
  cell(e, tb, x0, x1, yEdges[4], yEdges[5], 'UBICACION', data.ubicacion, 3.5 * k, k);
  cell(e, tb, x0, x1, yEdges[5], yEdges[6], 'OBRA', data.obra, 4.5 * k, k);
  cell(e, tb, x0, x1, yEdges[6], yEdges[7], 'MANDANTE', data.mandante, 4.5 * k, k);

  return e;
}

/** Tabla de revisiones, justo sobre el cajetín y del mismo ancho. Encabezado abajo y revisiones
 * hacia arriba (la más reciente, la más alta) — convención de plano de obra. */
export function revisionTableEntities(layout, revisions = []) {
  const { revisions: box, k } = layout;
  const e = [];
  const { x0, x1, y0, rowH } = box;
  const w = x1 - x0;
  const colX = [0, 15, 45, 145, 180].map(v => x0 + w * (v / 180)); // REV / FECHA / DESCRIPCION / AUTOR
  const rows = Math.max(2, revisions.length + 1);
  const yTop = y0 + rows * rowH;

  e.push(line(L_TB, x0, yTop, x1, yTop));
  e.push(line(L_TB, x0, y0, x0, yTop), line(L_TB, x1, y0, x1, yTop));
  for (let i = 1; i < rows; i++) e.push(line(L_TB, x0, y0 + i * rowH, x1, y0 + i * rowH));
  for (const cx of colX.slice(1, -1)) e.push(line(L_TB, cx, y0, cx, yTop));

  const put = (row, values) => {
    values.forEach((v, i) => {
      const fitted = fitText(v, 2.6 * k, (colX[i + 1] - colX[i]) - 3 * k);
      e.push(text(L_TB, colX[i] + 1.5 * k, y0 + row * rowH + rowH * 0.3, fitted.height, fitted.str));
    });
  };

  put(0, ['REV', 'FECHA', 'DESCRIPCION', 'AUTOR']);
  revisions.forEach((r, i) => put(i + 1, [r.rev || '-', r.fecha || '-', r.descripcion || '-', r.autor || '-']));
  return e;
}

/** Marco ISO 5457 + franja de zonas de referencia: números 1..n en los bordes horizontales y
 * letras A..N en los verticales, con divisiones de ~50 mm. */
export function frameAndZonesEntities(layout) {
  const { frame, inner, k } = layout;
  const e = [];
  const rect = (l, b) => [
    line(l, b.x0, b.y0, b.x1, b.y0), line(l, b.x1, b.y0, b.x1, b.y1),
    line(l, b.x1, b.y1, b.x0, b.y1), line(l, b.x0, b.y1, b.x0, b.y0)
  ];
  e.push(...rect(L_FRAME, frame), ...rect(L_FRAME, inner));

  const cols = Math.max(4, Math.round((frame.x1 - frame.x0) / 50));
  const rows = Math.max(3, Math.round((frame.y1 - frame.y0) / 50));
  const colW = (frame.x1 - frame.x0) / cols;
  const rowH = (frame.y1 - frame.y0) / rows;
  const h = 3 * k;

  for (let i = 0; i < cols; i++) {
    const xa = frame.x0 + i * colW, xb = xa + colW;
    if (i > 0) {
      e.push(line(L_FRAME, xa, frame.y0, xa, inner.y0));
      e.push(line(L_FRAME, xa, inner.y1, xa, frame.y1));
    }
    const label = String(i + 1);
    const tx = (xa + xb) / 2 - estimateTextWidth(label, h) / 2;
    e.push(text(L_FRAME, tx, frame.y0 + (inner.y0 - frame.y0 - h) / 2, h, label));
    e.push(text(L_FRAME, tx, inner.y1 + (frame.y1 - inner.y1 - h) / 2, h, label));
  }
  for (let j = 0; j < rows; j++) {
    const ya = frame.y0 + j * rowH, yb = ya + rowH;
    if (j > 0) {
      e.push(line(L_FRAME, frame.x0, ya, inner.x0, ya));
      e.push(line(L_FRAME, inner.x1, ya, frame.x1, ya));
    }
    const label = String.fromCharCode(65 + j);
    const ty = (ya + yb) / 2 - h / 2;
    e.push(text(L_FRAME, frame.x0 + (inner.x0 - frame.x0 - estimateTextWidth(label, h)) / 2, ty, h, label));
    e.push(text(L_FRAME, inner.x1 + (frame.x1 - inner.x1 - estimateTextWidth(label, h)) / 2, ty, h, label));
  }
  return e;
}

/** Marcas de plegado a A4 (210 × 297): trazos cortos en el borde de la hoja. No aplican en A3
 * (se pliega por la mitad, sin marcas intermedias). */
export function foldMarksEntities(layout) {
  if (layout.key === 'A3') return [];
  const { paperW, paperH, frame } = layout;
  const e = [];
  const tick = 5;
  for (let x = paperW - 190; x > frame.x0; x -= 190) {
    e.push(line(L_FRAME, x, 0, x, tick));
    e.push(line(L_FRAME, x, paperH, x, paperH - tick));
  }
  for (let y = 297; y < paperH - 10; y += 297) {
    e.push(line(L_FRAME, 0, y, tick, y));
    e.push(line(L_FRAME, paperW, y, paperW - tick, y));
  }
  return e;
}

const NICE_LENGTHS_MM = [500, 1000, 2000, 5000, 10000, 20000, 50000];

/** Escala gráfica: elige la longitud real "redonda" cuya proyección en papel quede entre 20 y
 * 60 mm, y la dibuja dividida en 4 tramos con rótulo en los extremos. */
export function scaleBarEntities(x, y, scale, k) {
  const total = NICE_LENGTHS_MM.find(v => v / scale >= 20 && v / scale <= 60) ?? NICE_LENGTHS_MM[2];
  const barW = total / scale;
  const barH = 1.6 * k;
  const e = [];
  e.push(line(L_TB, x, y, x + barW, y), line(L_TB, x, y + barH, x + barW, y + barH));
  for (let i = 0; i <= 4; i++) {
    const px = x + (barW * i) / 4;
    e.push(line(L_TB, px, y, px, y + barH));
  }
  const h = 2.2 * k;
  e.push(text(L_TAG, x, y + barH + 0.6 * k, h, '0'));
  e.push(text(L_TAG, x + barW - estimateTextWidth(`${total / 1000}m`, h), y + barH + 0.6 * k, h, `${total / 1000}m`));
  return e;
}

/** Rótulo bajo un viewport: "D1 - <etiqueta>" + "ESC 1:N" + escala gráfica. La numeración Dn es
 * la que referencia el cuadro de vistas de la leyenda. */
export function viewLabelEntities(viewTag, label, paperX, paperY, paperW, scale, k) {
  const e = [];
  const h = 3.2 * k;
  const y = paperY - 5.5 * k;
  e.push(text(L_TAG, paperX, y, h, `${viewTag} - ${label}`));
  const escLabel = `ESC 1:${scale}`;
  const escH = 2.6 * k;
  const barX = paperX + Math.max(estimateTextWidth(`${viewTag} - ${label}`, h) + 6 * k, paperW * 0.55);
  e.push(text(L_TAG, barX, y, escH, escLabel));
  e.push(...scaleBarEntities(barX + estimateTextWidth(escLabel, escH) + 3 * k, y, scale, k));
  return e;
}
