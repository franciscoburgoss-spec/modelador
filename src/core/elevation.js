// core/elevation.js
import { isElevationMode, parseElevationMode } from './viewMode.js';
import { resolveAxisRef } from './elementReferences.js';
import { isWallXRun, resolveColumnGeometry, resolveBeamGeometry } from './elementGeometry.js';
import { resolveValue } from './projectParams.js';

export function getElevationAxis(modeStr, grid) {
  const parsed = parseElevationMode(modeStr);
  if (!parsed) return null;
  const axes = parsed.axisType === 'x' ? grid.xAxes : grid.yAxes;
  return axes.find(a => a.id === parsed.axisId) || null;
}

/** Doble click en planta (sesión 21, parte B): elige el eje de corte que muestra el elemento
 * "a lo largo" (categoría 1, ver computeCategory) — no cualquier corte que lo cruce. Devuelve
 * `{ axisType, axisId }` listo para armar `elevation-${axisType}-${axisId}`, o null si el
 * elemento no está alineado con ningún eje de grilla real (tolerancia 1mm, igual que
 * axisFixedLabel en exportFramingDxf.js) — en ese caso no hay corte de elevación posible.
 * - Muro: el eje sobre el que corre (Y si el muro corre en X, X si corre en Y).
 * - Pilar / fundación aislada: el eje X de su ubicación (cualquiera de los dos ejes lo muestra
 *   igual — se elige X por convención).
 * - Viga / fundación corrida: su eje fijo (perpendicular a la dirección de corrida). */
export function resolveElevationAxisForElement(el, grid, elementsById = {}, paramsMap = {}) {
  if (el.type === 'wall') {
    const coords = resolveWallCoords(el, grid, elementsById, paramsMap);
    if (!coords) return null;
    const isXRun = isWallXRun(el);
    const axisType = isXRun ? 'y' : 'x';
    const fixedWorld = isXRun ? coords.yStart : coords.xStart;
    const axes = axisType === 'x' ? grid.xAxes : grid.yAxes;
    const axis = (axes || []).find(a => Math.abs(a.position - fixedWorld) < 1);
    return axis ? { axisType, axisId: axis.id } : null;
  }

  if (el.type === 'column' || (el.type === 'foundation' && el.foundationType === 'aislada')) {
    const x = resolveAxisRef(el.axisXId, 'x', grid, elementsById, paramsMap);
    if (x == null) return null;
    const axis = (grid.xAxes || []).find(a => Math.abs(a.position - x) < 1);
    return axis ? { axisType: 'x', axisId: axis.id } : null;
  }

  if (el.type === 'beam' || el.type === 'foundation') {
    const fixedAxisType = el.direction === 'x' ? 'y' : 'x';
    const coords = resolveBeamLikeCoords(el, grid, elementsById, paramsMap);
    if (!coords) return null;
    const axes = fixedAxisType === 'x' ? grid.xAxes : grid.yAxes;
    const axis = (axes || []).find(a => Math.abs(a.position - coords.fixed) < 1);
    return axis ? { axisType: fixedAxisType, axisId: axis.id } : null;
  }

  return null;
}

/** Resuelve los 4 campos de un muro (xStart/xEnd/yStart/yEnd) a coordenadas numéricas,
 *  soportando tanto IDs de eje como referencias a otro elemento (ver elementReferences.js). */
function resolveWallCoords(wall, grid, elementsById, paramsMap) {
  const xStart = resolveAxisRef(wall.xStart, 'x', grid, elementsById, paramsMap);
  const xEnd = resolveAxisRef(wall.xEnd, 'x', grid, elementsById, paramsMap);
  const yStart = resolveAxisRef(wall.yStart, 'y', grid, elementsById, paramsMap);
  const yEnd = resolveAxisRef(wall.yEnd, 'y', grid, elementsById, paramsMap);
  if (xStart == null || xEnd == null || yStart == null || yEnd == null) return null;
  return { xStart, xEnd, yStart, yEnd };
}

/** Resuelve fixed/start/end de una viga o fundación a coordenadas numéricas (mismo criterio). */
function resolveBeamLikeCoords(el, grid, elementsById, paramsMap) {
  const fixedAxis = el.direction === 'x' ? 'y' : 'x';
  const rangeAxis = el.direction === 'x' ? 'x' : 'y';
  const fixed = resolveAxisRef(el.fixedAxisId, fixedAxis, grid, elementsById, paramsMap);
  const start = resolveAxisRef(el.startAxisId, rangeAxis, grid, elementsById, paramsMap);
  const end = resolveAxisRef(el.endAxisId, rangeAxis, grid, elementsById, paramsMap);
  if (fixed == null || start == null || end == null) return null;
  return { fixed, start, end };
}

/** 1 = en el plano de corte (elevación real). 2/3/4 = cruza el plano (perpendicular, casos de borde). null = no aparece.
 *  Única fuente de verdad: antes había una función aparte (isElementInElevation) con su propia lógica de
 *  "aparece o no", separada de esta de categorías — para vigas/fundaciones esa lógica separada comparaba
 *  mal los ejes en un caso (Y vs X) y podía dejar vigas cruzando el corte sin mostrarse. Ahora ambas
 *  preguntas ("¿aparece?" y "¿con qué categoría?") se derivan de esta única función. */
function computeCategory(el, modeStr, grid, elementsById, paramsMap) {
  const parsed = parseElevationMode(modeStr);
  const axis = getElevationAxis(modeStr, grid);
  if (!parsed || !axis) return null;
  const pos = axis.position;

  if (el.type === 'column') {
    const x = resolveAxisRef(el.axisXId, 'x', grid, elementsById, paramsMap);
    const y = resolveAxisRef(el.axisYId, 'y', grid, elementsById, paramsMap);
    if (x == null || y == null) return null;
    const onCut = parsed.axisType === 'x' ? Math.abs(x - pos) < 0.001 : Math.abs(y - pos) < 0.001;
    return onCut ? 1 : null;
  }

  if (el.type === 'wall') {
    const coords = resolveWallCoords(el, grid, elementsById, paramsMap);
    if (!coords) return null;
    const isXRun = isWallXRun(el);

    if (parsed.axisType === 'x') {
      if (!isXRun) return Math.abs(coords.xStart - pos) < 0.001 ? 1 : null;
      const xMin = Math.min(coords.xStart, coords.xEnd);
      const xMax = Math.max(coords.xStart, coords.xEnd);
      if (xMin < pos - 0.001 && xMax > pos + 0.001) return 2;
      if (Math.abs(xMax - pos) < 0.001) return 3;
      if (Math.abs(xMin - pos) < 0.001) return 4;
      return null;
    }
    if (isXRun) return Math.abs(coords.yStart - pos) < 0.001 ? 1 : null;
    const yMin = Math.min(coords.yStart, coords.yEnd);
    const yMax = Math.max(coords.yStart, coords.yEnd);
    if (yMin < pos - 0.001 && yMax > pos + 0.001) return 2;
    if (Math.abs(yMax - pos) < 0.001) return 3;
    if (Math.abs(yMin - pos) < 0.001) return 4;
    return null;
  }

  if (el.type === 'foundation' && el.foundationType === 'aislada') {
    const x = resolveAxisRef(el.axisXId, 'x', grid, elementsById, paramsMap);
    const y = resolveAxisRef(el.axisYId, 'y', grid, elementsById, paramsMap);
    if (x == null || y == null) return null;
    const onCut = parsed.axisType === 'x' ? Math.abs(x - pos) < 0.001 : Math.abs(y - pos) < 0.001;
    return onCut ? 1 : null;
  }

  if (el.type === 'beam' || el.type === 'foundation') {
    const coords = resolveBeamLikeCoords(el, grid, elementsById, paramsMap);
    if (!coords) return null;

    if (parsed.axisType === 'x') {
      if (el.direction === 'y') return Math.abs(coords.fixed - pos) < 0.001 ? 1 : null;
      const xMin = Math.min(coords.start, coords.end);
      const xMax = Math.max(coords.start, coords.end);
      if (xMin < pos - 0.001 && xMax > pos + 0.001) return 2;
      if (Math.abs(xMax - pos) < 0.001) return 3;
      if (Math.abs(xMin - pos) < 0.001) return 4;
      return null;
    }
    if (el.direction === 'x') return Math.abs(coords.fixed - pos) < 0.001 ? 1 : null;
    const yMin = Math.min(coords.start, coords.end);
    const yMax = Math.max(coords.start, coords.end);
    if (yMin < pos - 0.001 && yMax > pos + 0.001) return 2;
    if (Math.abs(yMax - pos) < 0.001) return 3;
    if (Math.abs(yMin - pos) < 0.001) return 4;
    return null;
  }

  return null;
}

/** ¿El elemento aparece en esta elevación? (en el plano del eje, o cruzándolo)
 *  elementsById/paramsMap (opcionales): necesarios para resolver campos de eje que sean
 *  referencias a otro elemento en vez de un ID de eje (ver core/elementReferences.js). */
export function isElementInElevation(el, modeStr, grid, elementsById = {}, paramsMap = {}) {
  return computeCategory(el, modeStr, grid, elementsById, paramsMap) != null;
}

/** 1 = en el plano de corte (elevación real). 2/3/4 = cruza el plano (perpendicular, distintos casos de borde). */
export function getElementElevationCategory(el, modeStr, grid, elementsById = {}, paramsMap = {}) {
  return computeCategory(el, modeStr, grid, elementsById, paramsMap);
}

/** Rectángulo de una columna en espacio de plano de elevación {hMin,hMax,vBottom,vTop}, en su
 *  cota Z real. h = coordenada del elemento sobre el eje visible del corte (y si el corte es 'x',
 *  x si es 'y'); ancho visible = la dimensión de sección perpendicular al plano de corte.
 *  Devuelve null si faltan niveles Z o geometría. */
export function getColumnElevationRect(el, grid, mode, paramsMap = {}, elementsById = {}) {
  const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
  if (!geo) return null;
  const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
  const top = grid.zLevels.find(l => l.id === el.topZ);
  if (!bottom || !top) return null;
  const hCenter = mode.axis === 'x' ? geo.center.y : geo.center.x;
  const hWidth = mode.axis === 'x' ? geo.h : geo.w; // geo.h=widthY, geo.w=widthX
  return {
    hMin: hCenter - hWidth / 2,
    hMax: hCenter + hWidth / 2,
    vBottom: Math.min(bottom.elevation, top.elevation),
    vTop: Math.max(bottom.elevation, top.elevation)
  };
}

/** Rectángulo de una viga en espacio de plano de elevación, en su cota Z real
 *  ([nivel, nivel+alto], misma convención que build3d). Con category===1 la viga está en el
 *  plano del corte → alzado completo (h abarca su largo). Con category 2/3/4 cruza el plano →
 *  sección (h = su posición fija, ancho = width). Devuelve null si falta nivel/geometría. */
export function getBeamElevationRect(el, grid, mode, category, paramsMap = {}, elementsById = {}) {
  const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
  if (!geo) return null;
  const level = grid.zLevels.find(l => l.id === el.levelZ);
  if (!level) return null;
  const height = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : 500;
  const vBottom = level.elevation, vTop = level.elevation + height;

  const h1 = mode.axis === 'x' ? geo.p1.y : geo.p1.x;
  const h2 = mode.axis === 'x' ? geo.p2.y : geo.p2.x;
  if (category === 1) {
    return { hMin: Math.min(h1, h2), hMax: Math.max(h1, h2), vBottom, vTop };
  }
  // Sección: la viga cruza el plano; su traza es un ancho centrado en la coordenada fija.
  const hCenter = h1; // en una viga axial la coord del eje visible es constante en el cruce
  const hw = geo.width / 2;
  return { hMin: hCenter - hw, hMax: hCenter + hw, vBottom, vTop };
}
