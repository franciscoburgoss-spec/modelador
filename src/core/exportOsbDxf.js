// core/exportOsbDxf.js
// Exporta la elevación de revestimiento OSB (wall.osbCourses — ver core/osbModulation.js) a un
// DXF INDEPENDIENTE del de tabiquería (exportFramingDxf.js) — no se dibuja sobre montantes/
// dintel/antepecho, sino sobre un contorno de referencia liviano (rectángulo del muro + rectángulo
// del vano, capa MURO-REF). Mismo sistema de coordenadas locales (X = offset a lo largo del muro,
// Y = elevación) y mismo patrón de "un muro al lado del otro" que exportFramingDxf.js.
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { getWallDisplayName } from './naming.js';
import { buildOsbPieceScheduleRows, hasNestingSource } from './osbModulation.js';
import {
  GAP_BETWEEN_WALLS, LABEL_OFFSET_Y, TEXT_HEIGHT_TITLE, TEXT_HEIGHT_COTA, BUBBLE_Y, BUBBLE_R,
  rectPolyline, text, tablesSection, drawTable,
  interveningAxes, axisEntities, levelEntities, osbEntities,
  resolveWallLayout, unionEntitiesExtent
} from './exportFramingDxf.js';
import { guardExport } from './exportPolicy.js';

const SCHEDULE_ROW_H = 170;
const SCHEDULE_COLUMNS = [
  { label: 'PZA', width: 260 },
  { label: 'CURSO', width: 260 },
  { label: 'ANCHO', width: 340 },
  { label: 'ALTO', width: 340 },
  { label: 'CORTE (VANO)', width: 1300 }
];
const SCHEDULE_TOP_MARGIN = 350; // mm, espacio entre la burbuja de eje y el borde superior de la tabla

/** Agrupa headers (dintel/antepecho ya guardados en wall.headers, uno por rol y por vano) en el
 * rectángulo [oMin,oMax]×[sillRel,topRel] de cada vano. Si el vano no tiene antepecho (llega hasta
 * el piso), sillRel queda en 0 — mismo criterio que computeStudLayout/osbModulation. */
function deriveVanoRects(headers) {
  const groups = new Map();
  for (const h of headers || []) {
    const key = `${Math.round(h.oMin)}|${Math.round(h.oMax)}`;
    if (!groups.has(key)) groups.set(key, { oMin: h.oMin, oMax: h.oMax, sillRel: 0, topRel: null });
    const g = groups.get(key);
    if (h.role === 'header') g.topRel = h.z;
    else if (h.role === 'sill') g.sillRel = h.z;
  }
  return [...groups.values()].filter(v => v.topRel != null);
}

/** Contorno liviano del muro (solo referencia, capa MURO-REF): rectángulo exterior del muro +
 * rectángulo de cada vano. Sin montantes/dintel/antepecho reales — eso ya está en el DXF de
 * tabiquería; acá solo se necesita saber dónde va cada placa y dónde están los vacíos. */
function wallOsbReferenceEntities(xOffset, length, wallHeight, headers) {
  const entities = [rectPolyline('MURO-REF', xOffset, 0, xOffset + length, wallHeight)];
  for (const v of deriveVanoRects(headers)) {
    entities.push(rectPolyline('MURO-REF', xOffset + v.oMin, v.sillRel, xOffset + v.oMax, v.topRel));
  }
  return entities;
}

/** Tabla de despiece (código/curso/ancho/alto/corte) de un muro, ubicada debajo de la burbuja de
 * eje. Devuelve `{entities, height}` — `height` sirve para calcular el extent (ver
 * computeOsbViewExtent) y para saber si hubo tabla en absoluto (rows vacío → sin tabla). */
function osbScheduleTableEntities(xOffset, wall) {
  const rows = buildOsbPieceScheduleRows(wall.osbCourses);
  if (!rows.length) return { entities: [], height: 0 };
  // Con optimización de despuntes corrida (core/osbNesting.js) cada pieza sabe de qué placa madre
  // sale: se agrega la columna PLACA para que el instalador siga el plan de corte desde el plano.
  const columns = hasNestingSource(wall.osbCourses)
    ? [SCHEDULE_COLUMNS[0], { label: 'PLACA', width: 300 }, ...SCHEDULE_COLUMNS.slice(1)]
    : SCHEDULE_COLUMNS;
  const yTop = BUBBLE_Y - BUBBLE_R - SCHEDULE_TOP_MARGIN;
  const { entities, height } = drawTable('COTAS', 'OSB', xOffset, yTop, columns, rows, SCHEDULE_ROW_H, TEXT_HEIGHT_COTA);
  return { entities, height: (BUBBLE_Y - BUBBLE_R - yTop) + height }; // distancia total bajo la burbuja
}

/** Entidades DXF (sin envoltorio SECTION) para la elevación OSB de UN muro. */
export function wallOsbElevationEntities(wall, grid, layout, xOffset, axesInfo, gap = 5) {
  const { length, wallHeight, wallBottomElevation, headers } = layout;
  const entities = [];
  entities.push(...wallOsbReferenceEntities(xOffset, length, wallHeight, headers));
  entities.push(text('ETIQUETAS', xOffset, wallHeight + LABEL_OFFSET_Y, TEXT_HEIGHT_TITLE, getWallDisplayName(wall, grid)));
  entities.push(...axisEntities(xOffset, wallHeight, axesInfo));
  entities.push(...levelEntities(xOffset, length, wallHeight, wallBottomElevation, grid));
  entities.push(...osbEntities(xOffset, length, wallHeight, wall.osbCourses, gap, wall.studs));
  entities.push(...osbScheduleTableEntities(xOffset, wall).entities);
  return entities;
}

/** Igual que computeWallViewExtent pero para la elevación OSB: genera las mismas entidades
 * (referencia de muro + placas + tabla de despiece bajo la burbuja de eje) a xOffset=0 y une su
 * bbox real — así la tabla de despiece nunca queda cortada ni superpuesta con el muro siguiente. */
export function computeOsbViewExtent(wall, layout, grid, axesInfo, gap = 5) {
  const entities = wallOsbElevationEntities(wall, grid, layout, 0, axesInfo, gap);
  return unionEntitiesExtent(entities);
}

/** Genera el DXF (R12) con la elevación de revestimiento OSB de todos los muros del modelo que
 * tengan despiece de placas generado (wall.osbCourses) — ver Modulación de placas OSB. Devuelve
 * null si ningún muro califica. */
export function generateOsbFramingDxf(model) {
  const { grid, elements } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);

  const entities = [];
  let cursorX = 0;
  let count = 0;
  const gap = model.osbDefaults?.gap ?? 5;

  for (const wall of elements) {
    if (wall.type !== 'wall' || !wall.osbCourses?.length) continue;
    const layout = resolveWallLayout(wall, grid, paramsMap, elementsById);
    if (!layout) continue;

    const axesInfo = interveningAxes(grid, layout.isXRun, layout.worldMin, layout.worldMax);
    const extent = computeOsbViewExtent(wall, layout, grid, axesInfo, gap);

    const wallOrigin = cursorX - extent.xMin;
    entities.push(...wallOsbElevationEntities(wall, grid, layout, wallOrigin, axesInfo, gap));
    cursorX = wallOrigin + extent.xMax + GAP_BETWEEN_WALLS;
    count++;
  }

  if (count === 0) return null;

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

export function downloadOsbFramingDxf(model) {
  const policy = guardExport(model, 'dxf-osb');
  if (!policy.allowed) return false;
  const content = generateOsbFramingDxf(model);
  if (!content) {
    alert('No hay muros con modulación de placas OSB generada (Modulación de placas OSB → Generar).');
    return false;
  }
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'osb.dxf';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
