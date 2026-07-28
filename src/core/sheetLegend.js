// core/sheetLegend.js
// ★ Sesión 22 — Banda inferior izquierda de la lámina: simbología (por tipo), cuadro de vistas
// (D1, D2… que rotulan cada viewport) y notas generales. Antes vivía como `legendEntities` dentro
// de exportSheetsDxf.js con coordenadas absolutas de A1; acá se dibuja dentro del box que le pasa
// sheetFormats.js, así funciona igual en A0/A2/A3.
import { line, text, estimateTextWidth, sanitizeDxfText } from './exportFramingDxf.js';

const L_BOX = 'CAJETIN';
const L_TEXT = 'LEYENDA';

/** Filas de simbología por tipo de lámina: [capa o tag, descripción]. */
const SYMBOLS = {
  framing: [
    ['K', 'Jamba (king)'], ['J', 'Jamba bajo dintel (jack)'],
    ['C', 'Muchacho (bajo antepecho)'], ['CS', 'Puntal (sobre dintel)'],
    ['E', 'Cabezal (montante extremo)'], ['T', 'Pilar conformado esquina/T'], ['R', 'Montante respaldo (legacy)'],
    ['D', 'Dintel'], ['A', 'Alfeizar'], ['CD', 'Cadeneta'],
    ['SOLERAS-APOYO', 'Solera de apoyo de techumbre (referencia, se despieza en lamina de cerchas)'],
    ['EJES', 'Eje estructural (linea centro)'],
    ['NIVELES', 'Nivel Z de proyecto (linea segmentada)'],
    ['COTAS', 'Cota parcial (arriba) y cota entre ejes (abajo)']
  ],
  osb: [
    ['MURO-REF', 'Contorno de muro y vano (referencia, no estructural)'],
    ['OSB', 'Junta de placa / corte de vano (linea segmentada)'],
    ['EJES', 'Eje estructural (linea centro)'],
    ['NIVELES', 'Nivel Z de proyecto (linea segmentada)']
  ],
  truss: [
    ['CERCHA-CUERDAS', 'Cuerda superior/inferior de la cercha'],
    ['CERCHA-ENTRAMADO', 'Montante y diagonal de la cercha'],
    ['SOLERAS-APOYO', 'Solera de apoyo lateral (seccion), atornillada a la cara del fronton'],
    ['COSTANERAS', 'Costanera de techumbre'],
    ['MURO-REF', 'Vano de canaleta (rebaje en cuerda inferior)'],
    ['EJES', 'Eje estructural (linea centro)'],
    ['NIVELES', 'Nivel Z de proyecto (linea segmentada)']
  ],
  foundations: [
    ['MONTANTES', 'Contorno de hormigon (cimiento / sobrecimiento / zapata)'],
    ['SOLERAS', 'Ancho de sobrecimiento en planta / emplantillado en corte'],
    ['EJES', 'Eje estructural (linea centro)'],
    ['NIVELES', 'N.P.T. del nivel base y sello de fundacion'],
    ['C1, C2...', 'Tipo de cimiento corrido (ver corte tipo y cuadro)'],
    ['Z1, Z2...', 'Tipo de zapata aislada (ver corte tipo y cuadro)']
  ]
};

/** Notas generales por tipo. Son el default del proyecto; `projectInfo.notas[tipo]` reemplaza
 * sólo este bloque si el usuario define el suyo. Los criterios R8 siempre se anteponen. */
export const DEFAULT_NOTES = {
  framing: [
    'Cotas en milimetros. Niveles en metros respecto al N.P.T. = 0.00.',
    'Perfiles y espesores de acero segun cuadro de modulacion de cada elevacion.',
    'Separacion de montantes segun la modulacion indicada; no modificar en obra.',
    'Pilar conformado L/T: tornillos N°10x3/4" @150 mm en toda la altura, en zig-zag.',
    'Montantes de jamba (K) y bajo dintel (J) fijados a solera superior e inferior.',
    'Verificar en obra las medidas de vano contra la carpinteria antes de modular.'
  ],
  osb: [
    'Junta horizontal de placa siempre hacia arriba; hiladas completas desde abajo.',
    'Dilatacion de 5 mm entre placas en todo el perimetro.',
    'Cadeneta obligatoria en toda junta horizontal de placa.',
    'Fijaciones segun especificacion tecnica del proyecto.'
  ],
  truss: [
    'Geometria y separacion de cerchas segun lo indicado; no modificar sin visacion.',
    'Arriostramiento de montaje y costaneras segun planta de techumbre.',
    'Apoyo de cercha sobre muro segun detalle tipo.',
    'Verificar alineacion y aplomo antes de fijar costaneras.'
  ],
  foundations: [
    'Cotas en milimetros. Niveles en metros respecto al N.P.T. = 0.00.',
    'Hormigon, acero y recubrimientos segun especificaciones tecnicas del proyecto.',
    'Sello de fundacion sobre terreno natural firme; verificar capacidad en obra.',
    'No hormigonar sin verificacion previa de enfierradura y niveles.'
  ]
};

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function formatCriterionLimit(limit) {
  if (limit === null) return 'No resoluble con los datos actuales';
  const unit = limit.unit;
  if (Object.hasOwn(limit, 'equal')) {
    return `= ${formatNumber(limit.equal)} ${unit}`;
  }
  if (Object.hasOwn(limit, 'min') && Object.hasOwn(limit, 'max')) {
    return `${formatNumber(limit.min)}-${formatNumber(limit.max)} ${unit}`;
  }
  if (Object.hasOwn(limit, 'min')) {
    return `>= ${formatNumber(limit.min)} ${unit}`;
  }
  return `<= ${formatNumber(limit.max)} ${unit}`;
}

/**
 * Convierte la colección R8 en notas compactas de una variante. Sólo entran criterios originados
 * por tipos asignados: los agregados exclusivamente por findings pertenecen al informe.
 */
export function criteriaNotesForVariant(criteria = [], variant = 'framing') {
  return criteria
    .filter((criterion) => (
      criterion.source === 'assigned-type'
      && criterion.sheetVariants.includes(variant)
    ))
    .map((criterion) => {
      const roleLabel = criterion.roles.length === 1 ? 'rol' : 'roles';
      const typeLabel = criterion.wallTypeIds.length === 1 ? 'tipo' : 'tipos';
      return `${criterion.ruleId}: ${formatCriterionLimit(criterion.limit)}; `
        + `${roleLabel} ${criterion.roles.join('/')}; `
        + `${typeLabel} ${criterion.wallTypeIds.join('/')}`;
    });
}

/** Parte `str` en líneas que no superen `maxWidth` a la altura `h` (quiebre por palabra). */
export function wrapText(str, h, maxWidth) {
  const words = sanitizeDxfText(str).split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimateTextWidth(candidate, h) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function column(entities, x, yTop, width, title, rows, k, maxRows, { fitAll = false } = {}) {
  const baseHeight = 2.6 * k;
  const baseStep = 4.2 * k;
  const availableHeight = maxRows * baseStep;
  let rowScale = 1;
  if (fitAll) {
    for (let percent = 100; percent >= 60; percent -= 5) {
      const candidateScale = percent / 100;
      const candidateHeight = baseHeight * candidateScale;
      const wrappedCount = rows.reduce(
        (count, row) => count + wrapText(row, candidateHeight, width).length,
        0
      );
      const capacity = Math.floor(availableHeight / (baseStep * candidateScale));
      rowScale = candidateScale;
      if (wrappedCount <= capacity) break;
    }
  }
  const h = baseHeight * rowScale;
  const step = baseStep * rowScale;
  const rowLimit = Math.floor(availableHeight / step);
  let y = yTop;
  entities.push(text(L_TEXT, x, y, 3.2 * k, title));
  y -= baseStep * 1.6;
  let used = 0;
  for (const row of rows) {
    if (used >= rowLimit) {
      entities.push(text(L_TEXT, x, y, h, '(...)'));
      break;
    }
    for (const wrapped of wrapText(row, h, width)) {
      if (used >= rowLimit) break;
      entities.push(text(L_TEXT, x, y, h, wrapped));
      y -= step;
      used++;
    }
  }
  return y;
}

/** Banda de leyenda completa: recuadro + simbología + cuadro de vistas + notas generales. */
export function legendEntities(
  layout,
  variant = 'framing',
  views = [],
  notesOverride = null,
  criteria = []
) {
  const box = layout.legend;
  const k = layout.k;
  const e = [];
  if (box.x1 - box.x0 < 40 * k) return e; // hoja demasiado angosta: sin leyenda, no cortada

  e.push(line(L_BOX, box.x0, box.y0, box.x1, box.y0), line(L_BOX, box.x0, box.y1, box.x1, box.y1));
  e.push(line(L_BOX, box.x0, box.y0, box.x0, box.y1), line(L_BOX, box.x1, box.y0, box.x1, box.y1));

  const pad = 3 * k;
  const yTop = box.y1 - 5 * k;
  const usableW = (box.x1 - box.x0) - 2 * pad;
  const maxRows = Math.floor(((box.y1 - box.y0) - 12 * k) / (4.2 * k));

  const colW = usableW / 3 - 4 * k;
  const symbolRows = (SYMBOLS[variant] || SYMBOLS.framing).map(([tag, desc]) => `${tag} = ${desc}`);
  const effectiveNotes = notesOverride?.length
    ? notesOverride
    : (DEFAULT_NOTES[variant] || DEFAULT_NOTES.framing);
  const criterionNotes = criteriaNotesForVariant(criteria, variant);
  const notes = [
    ...criterionNotes,
    ...effectiveNotes
  ]
    .map((n, i) => `${i + 1}. ${n}`);
  const viewRows = views.length ? views : ['(sin vistas)'];

  column(e, box.x0 + pad, yTop, colW, 'SIMBOLOGIA', symbolRows, k, maxRows);
  column(e, box.x0 + pad + usableW / 3, yTop, colW, 'CUADRO DE VISTAS', viewRows, k, maxRows);
  column(
    e,
    box.x0 + pad + (2 * usableW) / 3,
    yTop,
    colW,
    'NOTAS GENERALES',
    notes,
    k,
    maxRows,
    { fitAll: criterionNotes.length > 0 }
  );

  return e;
}
