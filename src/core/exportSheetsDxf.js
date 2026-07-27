// core/exportSheetsDxf.js
// Genera láminas de tabiquería en DXF — una lámina = un archivo = un único espacio papel
// (regla del proyecto: nunca superponer láminas en el mismo espacio papel; si no caben todas
// las elevaciones, se crea una lámina nueva = un archivo nuevo). Cada archivo es autocontenido:
// espacio modelo con la geometría REAL (1:1, medible en QCAD) de los muros que le corresponden a
// esa lámina, y un espacio papel A1 horizontal con viewport(s) a escala 1:SCALE, cajetín, leyenda de
// símbolos y burbujas de eje.
//
// Estructura DXF: la plantilla (FIXED_PREFIX/FIXED_SUFFIX) es UN espacio papel activo — soportado
// desde DXF R12, la pieza más simple y robusta del formato (evita la complejidad frágil de
// múltiples layouts dentro de un mismo archivo). Se generó y VALIDÓ con ezdxf (0 errores de
// auditoría) antes de congelarla acá: HEADER mínimo + TABLES con nuestras capas/tipos de línea +
// BLOCKS (*Model_Space/*Paper_Space) + OBJECTS (diccionario ACAD_LAYOUT), verbatim. Las
// entidades (ENTITIES) se generan dinámicamente entre ambos bloques. Los handles dinámicos
// arrancan en 0x1000 — muy por sobre el máximo (0x330) usado en la plantilla fija, para no
// colisionar nunca.
import {
  line, text, circle, rectPolyline, wallFramingEntities, resolveWallLayout,
  estimateTextWidth, wallLevelsWithinRange, sanitizeDxfText, interveningAxes,
  resolveWallEntries, groupEntriesByAxis, axisGroupEntities,
  computeAxisGroupExtent, LAYERS, LABEL_OFFSET_Y, AXIS_MARGIN, H_COTA_Y,
  BUBBLE_Y, BUBBLE_R, V_COTA_X, NIVEL_LABEL_MARGIN, TICK_HALF,
  TEXT_HEIGHT_TITLE, TEXT_HEIGHT_SUBTITLE, TEXT_HEIGHT_TEXT, TEXT_HEIGHT_COTA
} from './exportFramingDxf.js';
import { buildPrefix, buildSuffix, SCALE } from './dxfTemplateAC1015.js';
import { sheetLayout, resolveFormat, DEFAULT_FORMAT } from './sheetFormats.js';
import {
  titleBlockEntities, revisionTableEntities, frameAndZonesEntities, foldMarksEntities,
  viewLabelEntities
} from './sheetTitleBlock.js';
import { legendEntities } from './sheetLegend.js';
import { normalizeProjectInfo } from './projectInfo.js';
import { getRoofSystems } from './roofPlaneOutputs.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { getWallDisplayName } from './naming.js';
import { wallOsbElevationEntities, computeOsbViewExtent } from './exportOsbDxf.js';
import { trussElevationEntities, computeTrussViewExtent } from './exportTrussDxf.js';
import { guardExport } from './exportPolicy.js';

// --- formato de lámina -------------------------------------------------------------------------
// ★ Sesión 22: la geometría del papel (marco, cajetín, leyenda, área de dibujo) ya no vive acá
// como constantes de A1: la calcula sheetFormats.js para el formato elegido (A0/A1/A2/A3) y este
// módulo sólo la consume. La escala de dibujo también es un parámetro (1:50 en A0/A1, 1:100 en A3).
const VIEWPORT_GAP = 12;              // mm × k en papel, separación entre viewports
const MODEL_GAP_BETWEEN_WALLS = 1200; // mm, separación en espacio modelo entre muros de una lámina

let handleCounter = 0x1000;
function nextHandle() { return (handleCounter++).toString(16).toUpperCase(); }

/** Empaqueta las vistas en láminas — cada viewport a ancho real proporcional 1:scale, en filas que
 * se ajustan al área de dibujo del formato ("shelf packing"); si una fila no cabe en lo que queda
 * de alto, se crea una lámina nueva. Bajo cada viewport se reserva `layout.viewLabelH` para el
 * rótulo de vista y la escala gráfica. */
export function packWallsIntoSheets(entries, opts = {}) {
  const layout = opts.layout || sheetLayout(DEFAULT_FORMAT);
  const scale = opts.scale || SCALE;
  const { draw, viewLabelH, k } = layout;
  const gap = VIEWPORT_GAP * k;

  const sheets = [];
  let sheet = [];
  let cursorX = draw.x0, cursorTop = draw.y1, rowHeight = 0;

  const startNewSheet = () => {
    if (sheet.length) sheets.push(sheet);
    sheet = [];
    cursorX = draw.x0; cursorTop = draw.y1; rowHeight = 0;
  };

  for (const entry of entries) {
    const { extent } = entry;
    const paperW = (extent.xMax - extent.xMin) / scale;
    const paperH = (extent.yMax - extent.yMin) / scale;
    const slotH = paperH + viewLabelH; // el rótulo de vista va debajo y no puede pisar la fila siguiente

    // si ni siquiera cabe solo en el ancho de la lámina, se deja pasar igual (ocupa toda la fila) —
    // mejor una lámina con un viewport que sobresale levemente que perder la vista silenciosamente.
    if (cursorX > draw.x0 && cursorX + paperW > draw.x1) {
      cursorTop -= (rowHeight + gap);
      cursorX = draw.x0;
      rowHeight = 0;
    }
    if (cursorTop - slotH < draw.y0) startNewSheet();

    const paperY = cursorTop - paperH;
    sheet.push({ ...entry, paperX: cursorX, paperY, paperW, paperH });
    cursorX += paperW + gap;
    rowHeight = Math.max(rowHeight, slotH);
  }
  if (sheet.length) sheets.push(sheet);
  return sheets;
}

const SHEET_TYPE_CODES = { framing: 'TAB', osb: 'OSB', truss: 'CER', foundations: 'FUN' };

export const resolveProjectInfo = normalizeProjectInfo;

function titleBlockData(info, { sheetIndex, totalSheets, scale, variant, titulo }) {
  const revisiones = info.revisiones || [];
  const last = revisiones[revisiones.length - 1];
  const code = SHEET_TYPE_CODES[variant] || 'GEN';
  return {
    mandante: info.mandante,
    obra: info.obra,
    ubicacion: info.ubicacion,
    titulo,
    proyectoNumero: info.proyectoNumero,
    laminaNumero: `${info.laminaPrefijo || 'E'}-${code}-${String(sheetIndex + 1).padStart(2, '0')}`,
    sheetIndex: sheetIndex + 1,
    totalSheets,
    scale,
    fecha: info.fecha || new Date().toLocaleDateString('es-CL'),
    revision: last?.rev || '',
    dibujo: info.dibujo,
    reviso: info.reviso,
    aprobo: info.aprobo
  };
}

/** Viewport "principal" (id=1) que exige el formato para un layout de espacio papel válido —
 * representa la vista propia de AutoCAD del layout completo, no es contenido nuestro. */
function mainViewportEntity(layout) {
  const { paperW: PAPER_W, paperH: PAPER_H } = layout;
  const cx = PAPER_W / 2, cy = PAPER_H / 2;
  return [
    '0', 'VIEWPORT', '5', nextHandle(), '330', '1B', '100', 'AcDbEntity',
    '67', '1', '8', 'VIEWPORTS', '100', 'AcDbViewport',
    '10', cx.toFixed(2), '20', cy.toFixed(2), '30', '0',
    '40', PAPER_W.toFixed(2), '41', PAPER_H.toFixed(2),
    '68', '1', '69', '1',
    '12', cx.toFixed(2), '22', cy.toFixed(2), '13', '0', '23', '0',
    '14', '10', '24', '10', '15', '10', '25', '10',
    '16', '0', '26', '0', '36', '1', '17', '0', '27', '0', '37', '0',
    '42', '50', '43', '0', '44', '0', '45', PAPER_H.toFixed(2), '50', '0', '51', '0',
    '72', '1000'
  ].join('\n');
}

/** Un viewport de contenido: ve, a 1:SCALE, el rectángulo [extent] de un muro en espacio modelo
 * (desplazado por modelXOffset), ubicado en (paperX,paperY,paperW,paperH) del papel. */
function contentViewportEntity(id, paperX, paperY, paperW, paperH, viewCenterX, viewCenterY, viewHeight) {
  const cx = paperX + paperW / 2, cy = paperY + paperH / 2;
  return [
    '0', 'VIEWPORT', '5', nextHandle(), '330', '1B', '100', 'AcDbEntity',
    '67', '1', '8', 'VIEWPORTS', '100', 'AcDbViewport',
    '10', cx.toFixed(3), '20', cy.toFixed(3), '30', '0',
    '40', paperW.toFixed(3), '41', paperH.toFixed(3),
    '68', '1', '69', String(id),
    '12', viewCenterX.toFixed(3), '22', viewCenterY.toFixed(3), '13', '0', '23', '0',
    '14', '10', '24', '10', '15', '10', '25', '10',
    '16', '0', '26', '0', '36', '1', '17', '0', '27', '0', '37', '0',
    '42', '50', '43', '0', '44', '0', '45', viewHeight.toFixed(3), '50', '0', '51', '0',
    '72', '1000'
  ].join('\n');
}

/** Borde del viewport dibujado en el propio papel (además del "clip" del VIEWPORT) para que se
 * vea claramente el recuadro incluso si el visor no resalta los bordes de viewport por defecto. */
function viewportBorder(paperX, paperY, paperW, paperH) {
  return rectPolyline('VIEWPORTS', paperX, paperY, paperX + paperW, paperY + paperH);
}

// --- "upgrade" de entidades: nuestros helpers (line/text/circle/rectPolyline) generan texto
// estilo R12 simple (sin handle/owner/subclass); el espacio papel de este archivo necesita esos
// tres datos en cada entidad. rectPolyline se descompone en 4 LINE (mismo resultado visual: un
// contorno cerrado) para no tener que lidiar con el formato de VERTEX/SEQEND en R2000. --------
const SUBCLASS_BY_TYPE = { LINE: 'AcDbLine', TEXT: 'AcDbText', CIRCLE: 'AcDbCircle' };

function polylineToLineStrings(entityText) {
  const parts = entityText.split('\n');
  const layer = parts[3];
  const verts = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'VERTEX') {
      const x = parseFloat(parts[i + 4]);
      const y = parseFloat(parts[i + 6]);
      verts.push([x, y]);
    }
  }
  const out = [];
  for (let k = 0; k < verts.length; k++) {
    const [x1, y1] = verts[k];
    const [x2, y2] = verts[(k + 1) % verts.length];
    out.push(line(layer, x1, y1, x2, y2));
  }
  return out;
}

function upgradeEntity(entityText, ownerHandle, isPaperSpace = false) {
  const parts = entityText.split('\n');
  const type = parts[1];
  const layerName = parts[3];
  const rest = parts.slice(4);
  const paperFlag = isPaperSpace ? ['67', '1'] : [];
  return [
    '0', type, '5', nextHandle(), '330', ownerHandle, '100', 'AcDbEntity',
    ...paperFlag,
    '8', layerName, '100', SUBCLASS_BY_TYPE[type],
    ...rest
  ].join('\n');
}

/** Convierte cualquier lista de entidades "R12-simple" (line/text/circle/rectPolyline) en
 * entidades válidas para este archivo (con handle/owner/subclass), con `ownerHandle` = handle
 * del BLOCK_RECORD dueño (17=*Model_Space, 1B=*Paper_Space). `isPaperSpace` debe ir en `true`
 * para TODO lo que sea papel (cajetín, leyenda, marco, bordes de viewport) — sin el group code 67
 * el lector interpreta la entidad como espacio modelo sin importar el owner, y el formato de la
 * lámina termina apareciendo mezclado con la geometría real en vez de en el papel. */
function upgradeAll(rawEntities, ownerHandle, isPaperSpace = false) {
  const out = [];
  for (const raw of rawEntities) {
    const pieces = raw.startsWith('0\nPOLYLINE') ? polylineToLineStrings(raw) : [raw];
    for (const p of pieces) out.push(upgradeEntity(p, ownerHandle, isPaperSpace));
  }
  return out;
}

const MODEL_SPACE_OWNER = '17';
const PAPER_SPACE_OWNER = '1B';

/** Genera el contenido DXF completo (texto) de UNA lámina: espacio modelo con la geometría real
 * de sus vistas + espacio papel con viewports a 1:scale, marco ISO 5457, cajetín ISO 7200, tabla
 * de revisiones, leyenda/notas y rótulo con escala gráfica bajo cada vista. */
export function generateSheetDxf(sheetEntries, sheetIndex, totalSheets, grid, options = {}) {
  const {
    entitiesBuilder = (entry, cursorX) => wallFramingEntities(entry.wall, grid, entry.layout, entry.studProfile, entry.trackProfile, cursorX, entry.axesInfo),
    legendVariant = 'framing',
    title = 'MODELADOR ESTRUCTURAL',
    labelBuilder = (entry) => getWallDisplayName(entry.wall, grid),
    contentBuilder = null,
    projectInfo = null,
    format = DEFAULT_FORMAT
  } = options;
  const info = resolveProjectInfo(projectInfo);
  const layout = options.layout || sheetLayout(resolveFormat(format), info.revisiones.length);
  const scale = options.scale || layout.defaultScale;
  handleCounter = 0x1000; // handles nuevos por archivo — cada lámina es un archivo independiente

  // espacio modelo: geometría real de cada vista, desplazada para no superponerse entre sí
  let modelCursorX = 0;
  const modelSpaceRaw = [];
  const viewportEntities = [];
  const viewRows = [];
  const wallLabels = [];
  const viewLabelRaw = [];

  sheetEntries.forEach((entry, i) => {
    const { extent, paperX, paperY, paperW, paperH } = entry;
    modelSpaceRaw.push(...entitiesBuilder(entry, modelCursorX));
    const label = labelBuilder(entry);
    const viewTag = `D${i + 1}`;
    wallLabels.push(label);
    viewRows.push(`${viewTag} = ${label}`);

    const viewCenterX = modelCursorX + (extent.xMin + extent.xMax) / 2;
    const viewCenterY = (extent.yMin + extent.yMax) / 2;
    const viewHeight = extent.yMax - extent.yMin;
    viewportEntities.push(contentViewportEntity(entry.viewportId, paperX, paperY, paperW, paperH, viewCenterX, viewCenterY, viewHeight));
    for (const borderLine of polylineToLineStrings(viewportBorder(paperX, paperY, paperW, paperH))) {
      viewportEntities.push(upgradeEntity(borderLine, PAPER_SPACE_OWNER, true));
    }
    viewLabelRaw.push(...viewLabelEntities(viewTag, label, paperX, paperY, paperW, scale, layout.k));

    modelCursorX += (extent.xMax - extent.xMin) + MODEL_GAP_BETWEEN_WALLS;
  });

  const titulo = contentBuilder ? `${title} - ${contentBuilder(wallLabels)}` : title;
  const data = titleBlockData(info, { sheetIndex, totalSheets, scale, variant: legendVariant, titulo });

  const modelSpaceEntities = upgradeAll(modelSpaceRaw, MODEL_SPACE_OWNER);
  const paperSpaceRaw = [
    ...frameAndZonesEntities(layout),
    ...foldMarksEntities(layout),
    ...titleBlockEntities(layout, data),
    ...revisionTableEntities(layout, info.revisiones),
    ...legendEntities(layout, legendVariant, viewRows, info.notas?.[legendVariant]),
    ...viewLabelRaw
  ];
  const paperSpaceEntities = upgradeAll(paperSpaceRaw, PAPER_SPACE_OWNER, true);

  const entitiesSection = [
    '0', 'SECTION', '2', 'ENTITIES',
    ...modelSpaceEntities,
    mainViewportEntity(layout),
    ...viewportEntities,
    ...paperSpaceEntities,
    '0', 'ENDSEC'
  ].join('\n');

  return [buildPrefix(scale), entitiesSection, buildSuffix(layout.paperW, layout.paperH)].join('\n');
}

/** Resuelve formato + escala + layout una sola vez por exportación: el empaquetado y el dibujo
 * de la lámina TIENEN que compartirlos o los viewports quedan fuera del área de dibujo. */
export function resolveSheetSetup(model, opts = {}) {
  const info = resolveProjectInfo(model.projectInfo);
  const format = resolveFormat(opts.format || info.formato || DEFAULT_FORMAT);
  const layout = sheetLayout(format, info.revisiones.length);
  const scale = opts.scale || info.escala || layout.defaultScale;
  return { info, format, layout, scale };
}

/** Arma la lista final de láminas (nombre de archivo + contenido) para un tipo de export. */
function buildSheets(model, entries, { filePrefix, variant, options, setup }) {
  const { layout, scale, info } = setup;
  const sheets = packWallsIntoSheets(entries, { layout, scale });
  const totalSheets = sheets.length;
  return sheets.map((sheetEntries, sheetIndex) => {
    sheetEntries.forEach((e, i) => { e.viewportId = i + 2; }); // id=1 es el viewport principal
    return {
      filename: `${filePrefix}_${layout.key}_lamina${sheetIndex + 1}.dxf`,
      content: generateSheetDxf(sheetEntries, sheetIndex, totalSheets, model.grid, {
        ...options, legendVariant: variant, projectInfo: info, layout, scale, format: layout.key
      })
    };
  });
}

/** Resuelve un entry por EJE (no por muro): todos los muros que corren sobre el mismo eje van a
 * una sola elevación, con su extent de dibujo real (ver exportFramingDxf.js, sesión 18). */
function resolveEntriesForSheets(model) {
  const groups = groupEntriesByAxis(resolveWallEntries(model), model.grid);
  return groups.map(group => ({ group, extent: computeAxisGroupExtent(group, model.grid) }));
}

/** Genera todas las láminas necesarias — un archivo DXF por lámina, nunca dos láminas en el
 * mismo espacio papel. Devuelve `[]` si ningún muro tiene despiece de metalcon generado. */
export function generateFramingSheets(model, opts = {}) {
  const entries = resolveEntriesForSheets(model);
  if (!entries.length) return [];
  const setup = resolveSheetSetup(model, opts);
  return buildSheets(model, entries, {
    filePrefix: 'tabiqueria', variant: 'framing', setup,
    options: {
      entitiesBuilder: (entry, cursorX) => axisGroupEntities(entry.group, model.grid, cursorX),
      labelBuilder: (entry) => entry.group.axisLabel,
      title: 'TABIQUERIA - ELEVACIONES POR EJE',
      contentBuilder: (labels) => (labels.length <= 8 ? `EJES ${labels.join(', ')}` : `${labels.length} EJES`)
    }
  });
}

export function downloadFramingSheets(model, opts = {}) {
  const policy = guardExport(model, 'dxf-framing-sheets');
  if (!policy.allowed) return false;
  const sheets = generateFramingSheets(model, opts);
  if (!sheets.length) {
    alert('No hay muros con despiece de metalcon generado (Modulación de metalcon → Generar despiece).');
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
    }, i * 400); // pequeño delay entre descargas para que el navegador no las bloquee
  });
  return true;
}

/** Resuelve entries para las láminas de revestimiento OSB — mismo empaquetado (packWallsIntoSheets)
 * y misma plantilla de lámina que la tabiquería, pero solo para muros con wall.osbCourses
 * generado, sin studProfile/trackProfile (no aplica: la elevación OSB dibuja el contorno de
 * referencia del muro, no montantes reales — ver core/exportOsbDxf.js). */
function resolveOsbEntriesForSheets(model) {
  const { grid, elements } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const gap = model.osbDefaults?.gap ?? 5;

  const entries = [];
  for (const wall of elements) {
    if (wall.type !== 'wall' || !wall.osbCourses?.length) continue;
    const layout = resolveWallLayout(wall, grid, paramsMap, elementsById);
    if (!layout) continue;
    const axesInfo = interveningAxes(grid, layout.isXRun, layout.worldMin, layout.worldMax);
    const extent = computeOsbViewExtent(wall, layout, grid, axesInfo, gap);
    entries.push({ wall, layout, axesInfo, extent });
  }
  return entries;
}

/** Genera todas las láminas de revestimiento OSB — un archivo DXF por lámina, separado del de
 * tabiquería (mismo criterio que exportOsbDxf.js: elevación aparte, sin montantes/dintel/
 * antepecho reales). Devuelve `[]` si ningún muro tiene modulación de placas OSB generada. */
export function generateOsbFramingSheets(model, opts = {}) {
  const entries = resolveOsbEntriesForSheets(model);
  if (!entries.length) return [];
  const setup = resolveSheetSetup(model, opts);
  const gap = model.osbDefaults?.gap ?? 5;
  return buildSheets(model, entries, {
    filePrefix: 'osb', variant: 'osb', setup,
    options: {
      entitiesBuilder: (entry, cursorX) => wallOsbElevationEntities(entry.wall, model.grid, entry.layout, cursorX, entry.axesInfo, gap),
      title: 'REVESTIMIENTO OSB - MODULACION DE PLACAS',
      labelBuilder: (entry) => getWallDisplayName(entry.wall, model.grid)
    }
  });
}

export function downloadOsbFramingSheets(model, opts = {}) {
  const policy = guardExport(model, 'dxf-osb-sheets');
  if (!policy.allowed) return false;
  const sheets = generateOsbFramingSheets(model, opts);
  if (!sheets.length) {
    alert('No hay muros con modulación de placas OSB generada (Modulación de placas OSB → Generar).');
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
    }, i * 400);
  });
  return true;
}

/** Resuelve entries para las láminas de cerchas — mismo empaquetado (packWallsIntoSheets) y
 * misma plantilla de lámina, pero un entry por sistema de techumbre (no por muro): solo
 * sistemas con `trussGeometry.resolved` y al menos una cercha posicionada. `systemIndex` es el
 * índice dentro de esta lista filtrada — lo necesita `trussElevationEntities` para el título
 * "CERCHA TIPO - SISTEMA N". */
function resolveTrussEntriesForSheets(model) {
  const systems = getRoofSystems(model).filter((s) => s.trussGeometry?.resolved && s.trussPositions?.length);
  return systems.map((system, systemIndex) => ({
    system, systemIndex,
    extent: computeTrussViewExtent(system, systemIndex, model.library, model)
  }));
}

/** Genera todas las láminas de cerchas — un archivo DXF por lámina, separado de tabiquería/OSB.
 * Devuelve `[]` si ningún sistema de techumbre tiene geometría generada. */
export function generateTrussSheets(model, opts = {}) {
  const entries = resolveTrussEntriesForSheets(model);
  if (!entries.length) return [];
  const setup = resolveSheetSetup(model, opts);
  return buildSheets(model, entries, {
    filePrefix: 'cerchas', variant: 'truss', setup,
    options: {
      entitiesBuilder: (entry, cursorX) => trussElevationEntities(entry.system, cursorX, entry.systemIndex, model.library, model),
      title: 'TECHUMBRE - CERCHAS TIPO',
      labelBuilder: (entry) => `SISTEMA ${entry.systemIndex + 1}`
    }
  });
}

export function downloadTrussSheets(model, opts = {}) {
  const policy = guardExport(model, 'dxf-truss-sheets');
  if (!policy.allowed) return false;
  const sheets = generateTrussSheets(model, opts);
  if (!sheets.length) {
    alert('No hay sistemas de techumbre generados (Techumbre — cerchas de un agua → Generar).');
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
    }, i * 400);
  });
  return true;
}
