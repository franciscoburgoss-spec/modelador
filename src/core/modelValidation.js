// core/modelValidation.js
import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry, isWallXRun } from './elementGeometry.js';
import { getWallDisplayName } from './naming.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { resolveAxisRef, isElementRef, buildElementsById } from './elementReferences.js';
import { resolveFoundation, foundationVerticalRange } from './foundationGeometry.js';

function issue(severity, category, message, elementIds = []) {
  return { severity, category, message, elementIds };
}

function levelRange(el, grid, paramsMap, elementsById = {}) {
  if (el.type === 'wall' || el.type === 'column') {
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!bottom || !top) return null;
    return [Math.min(bottom.elevation, top.elevation), Math.max(bottom.elevation, top.elevation)];
  }
  if (el.type === 'beam') {
    const level = grid.zLevels.find(l => l.id === el.levelZ);
    if (!level) return null;
    const height = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : 500;
    return [level.elevation - height, level.elevation];
  }
  return null;
}

/** Rango vertical de una fundación bajo su nivel base. Si no tiene nivel base asignado, no se puede acotar. */
function foundationRange(el, grid, paramsMap, elementsById = {}) {
  if (el.levelZ == null) return null;
  const level = grid.zLevels.find(l => l.id === el.levelZ);
  if (!level) return null;
  const range = foundationVerticalRange(el, grid, paramsMap, elementsById);
  return range ? [range.bottom, range.top] : null;
}

function rangesOverlap(a, b) {
  return a[0] < b[1] - 0.001 && b[0] < a[1] - 0.001;
}

/** ¿El punto (px,py) cae sobre el segmento p1-p2 (con tolerancia)? Para conectividad. */
function pointOnSegment(px, py, x1, y1, x2, y2, tol) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return Math.hypot(px - x1, py - y1) < tol;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY) < tol;
}

/** ★ Un campo de eje puede ser un ID de eje O una referencia a otro elemento
 *  ({refElementId, edge}, ver core/elementReferences.js). resolveAxisRef entiende ambos casos
 *  y además detecta ciclos (A referencia a B que referencia a A) devolviendo null —
 *  por eso una sola llamada cubre "eje eliminado", "referencia a elemento eliminado" y "ciclo". */
function checkDanglingReferences(elements, grid, paramsMap, elementsById) {
  const results = [];
  const zIds = new Set(grid.zLevels.map(z => z.id));

  for (const el of elements) {
    const missing = [];
    if (el.type === 'wall') {
      if (resolveAxisRef(el.xStart, 'x', grid, elementsById, paramsMap) == null) missing.push('xStart');
      if (resolveAxisRef(el.xEnd, 'x', grid, elementsById, paramsMap) == null) missing.push('xEnd');
      if (resolveAxisRef(el.yStart, 'y', grid, elementsById, paramsMap) == null) missing.push('yStart');
      if (resolveAxisRef(el.yEnd, 'y', grid, elementsById, paramsMap) == null) missing.push('yEnd');
      if (!zIds.has(el.bottomZ)) missing.push('nivel inferior');
      if (!zIds.has(el.topZ)) missing.push('nivel superior');
    } else if (el.type === 'column') {
      if (resolveAxisRef(el.axisXId, 'x', grid, elementsById, paramsMap) == null) missing.push('eje X');
      if (resolveAxisRef(el.axisYId, 'y', grid, elementsById, paramsMap) == null) missing.push('eje Y');
      if (!zIds.has(el.bottomZ)) missing.push('nivel inferior');
      if (!zIds.has(el.topZ)) missing.push('nivel superior');
    } else if (el.type === 'foundation' && el.foundationType === 'aislada') {
      if (resolveAxisRef(el.axisXId, 'x', grid, elementsById, paramsMap) == null) missing.push('eje X');
      if (resolveAxisRef(el.axisYId, 'y', grid, elementsById, paramsMap) == null) missing.push('eje Y');
      if (el.levelZ != null && !zIds.has(el.levelZ)) missing.push('nivel base');
    } else if (el.type === 'beam' || el.type === 'foundation') {
      const fixedAxis = el.direction === 'x' ? 'y' : 'x';
      const rangeAxis = el.direction === 'x' ? 'x' : 'y';
      if (resolveAxisRef(el.fixedAxisId, fixedAxis, grid, elementsById, paramsMap) == null) missing.push('eje fijo');
      if (resolveAxisRef(el.startAxisId, rangeAxis, grid, elementsById, paramsMap) == null) missing.push('eje de inicio');
      if (resolveAxisRef(el.endAxisId, rangeAxis, grid, elementsById, paramsMap) == null) missing.push('eje de término');
      if (el.type === 'beam' && !zIds.has(el.levelZ)) missing.push('nivel Z');
      if (el.type === 'foundation' && el.levelZ != null && !zIds.has(el.levelZ)) missing.push('nivel base');
    }
    if (missing.length > 0) {
      results.push(issue('error', 'Referencia rota', `#${el.id} (${el.type}) quedó sin ${missing.join(', ')} — probablemente se eliminó un eje/elemento en uso, o hay un ciclo de referencias entre elementos.`, [el.id]));
    }
  }
  return results;
}

function checkZeroLength(elements, grid, paramsMap, elementsById) {
  const results = [];
  for (const el of elements) {
    if (el.type === 'wall') {
      const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
      if (geo && Math.abs(geo.p1.x - geo.p2.x) < 1 && Math.abs(geo.p1.y - geo.p2.y) < 1) {
        results.push(issue('error', 'Largo cero', `Muro ${getWallDisplayName(el, grid)} tiene largo cero (inicio y término coinciden).`, [el.id]));
      }
    } else if (el.type === 'beam' || el.type === 'foundation') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      if (geo && Math.abs(geo.p1.x - geo.p2.x) < 1 && Math.abs(geo.p1.y - geo.p2.y) < 1) {
        results.push(issue('error', 'Largo cero', `${el.type === 'beam' ? 'Viga' : 'Fundación'} #${el.id} tiene largo cero.`, [el.id]));
      }
    }
  }
  return results;
}

function checkOpeningsOutsideWall(elements, grid, paramsMap, elementsById) {
  const results = [];
  for (const wall of elements) {
    if (wall.type !== 'wall') continue;
    const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
    if (!geo) continue;
    const isXRun = isWallXRun(wall);
    const min = isXRun ? Math.min(geo.p1.x, geo.p2.x) : Math.min(geo.p1.y, geo.p2.y);
    const max = isXRun ? Math.max(geo.p1.x, geo.p2.x) : Math.max(geo.p1.y, geo.p2.y);
    for (const o of wall.openings || []) {
      const oWidth = resolveValue(o.width, paramsMap);
      if (!isFinite(oWidth)) continue; // se reporta aparte en checkSuspiciousDimensions como fórmula inválida
      const oMin = o.position - oWidth / 2;
      const oMax = o.position + oWidth / 2;
      if (oMin < min - 0.5 || oMax > max + 0.5) {
        results.push(issue('warning', 'Vano fuera de rango', `Vano #${o.id} en muro ${getWallDisplayName(wall, grid)} quedó parcial o totalmente fuera del muro (probablemente se movió un eje). Revísalo y reubícalo.`, [o.id, wall.id]));
      }
    }
  }
  return results;
}

function checkOverlappingWalls(elements, grid, paramsMap, elementsById) {
  const results = [];
  const walls = elements.filter(el => el.type === 'wall');
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const geoA = resolveWallGeometry(a, grid, paramsMap, elementsById);
    const rangeA = levelRange(a, grid, paramsMap, elementsById);
    if (!geoA || !rangeA) continue;
    const aIsX = isWallXRun(a);

    for (let j = i + 1; j < walls.length; j++) {
      const b = walls[j];
      const bIsX = isWallXRun(b);
      if (aIsX !== bIsX) continue;
      const geoB = resolveWallGeometry(b, grid, paramsMap, elementsById);
      const rangeB = levelRange(b, grid, paramsMap, elementsById);
      if (!geoB || !rangeB) continue;

      const fixedA = aIsX ? geoA.p1.y : geoA.p1.x;
      const fixedB = bIsX ? geoB.p1.y : geoB.p1.x;
      if (Math.abs(fixedA - fixedB) > 1) continue;

      const [aMin, aMax] = aIsX ? [Math.min(geoA.p1.x, geoA.p2.x), Math.max(geoA.p1.x, geoA.p2.x)] : [Math.min(geoA.p1.y, geoA.p2.y), Math.max(geoA.p1.y, geoA.p2.y)];
      const [bMin, bMax] = bIsX ? [Math.min(geoB.p1.x, geoB.p2.x), Math.max(geoB.p1.x, geoB.p2.x)] : [Math.min(geoB.p1.y, geoB.p2.y), Math.max(geoB.p1.y, geoB.p2.y)];

      if (rangesOverlap([aMin, aMax], [bMin, bMax]) && rangesOverlap(rangeA, rangeB)) {
        results.push(issue('warning', 'Muros traslapados', `Muros ${getWallDisplayName(a, grid)} y ${getWallDisplayName(b, grid)} están en la misma línea, se traslapan en planta y comparten nivel.`, [a.id, b.id]));
      }
    }
  }
  return results;
}

function checkOverlappingColumns(elements, grid, paramsMap, elementsById) {
  const results = [];
  const columns = elements.filter(el => el.type === 'column');
  for (let i = 0; i < columns.length; i++) {
    const a = columns[i];
    const geoA = resolveColumnGeometry(a, grid, paramsMap, elementsById);
    const rangeA = levelRange(a, grid, paramsMap, elementsById);
    if (!geoA || !rangeA) continue;
    for (let j = i + 1; j < columns.length; j++) {
      const b = columns[j];
      const geoB = resolveColumnGeometry(b, grid, paramsMap, elementsById);
      const rangeB = levelRange(b, grid, paramsMap, elementsById);
      if (!geoB || !rangeB) continue;
      const dx = Math.abs(geoA.center.x - geoB.center.x);
      const dy = Math.abs(geoA.center.y - geoB.center.y);
      if (dx < 1 && dy < 1 && rangesOverlap(rangeA, rangeB)) {
        results.push(issue('warning', 'Pilares traslapados', `Pilares #${a.id} y #${b.id} están en la misma intersección de ejes y comparten nivel.`, [a.id, b.id]));
      }
    }
  }
  return results;
}

/** Fundaciones creadas antes de existir "Nivel base" — sin esto no se filtran por nivel en planta. */
function checkFoundationsWithoutLevel(elements) {
  const results = [];
  for (const el of elements) {
    if (el.type === 'foundation' && el.levelZ == null) {
      results.push(issue('warning', 'Sin nivel base', `Fundación #${el.id} no tiene "Nivel base" asignado — se seguirá mostrando en todos los niveles hasta que la edites.`, [el.id]));
    }
  }
  return results;
}

/** Traslape de vigas o fundaciones entre sí (misma línea, mismo nivel/rango). */
function checkOverlappingBeamLike(elements, grid, type, label, paramsMap, elementsById) {
  const results = [];
  const items = elements.filter(el => el.type === type);
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const geoA = resolveBeamGeometry(a, grid, paramsMap, elementsById);
    const rangeA = type === 'beam' ? levelRange(a, grid, paramsMap, elementsById) : foundationRange(a, grid, paramsMap, elementsById);
    if (!geoA || !rangeA) continue;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.direction !== b.direction) continue;
      const geoB = resolveBeamGeometry(b, grid, paramsMap, elementsById);
      const rangeB = type === 'beam' ? levelRange(b, grid, paramsMap, elementsById) : foundationRange(b, grid, paramsMap, elementsById);
      if (!geoB || !rangeB) continue;

      const fixedA = a.direction === 'x' ? geoA.p1.y : geoA.p1.x;
      const fixedB = b.direction === 'x' ? geoB.p1.y : geoB.p1.x;
      if (Math.abs(fixedA - fixedB) > 1) continue;

      const [aMin, aMax] = a.direction === 'x' ? [Math.min(geoA.p1.x, geoA.p2.x), Math.max(geoA.p1.x, geoA.p2.x)] : [Math.min(geoA.p1.y, geoA.p2.y), Math.max(geoA.p1.y, geoA.p2.y)];
      const [bMin, bMax] = b.direction === 'x' ? [Math.min(geoB.p1.x, geoB.p2.x), Math.max(geoB.p1.x, geoB.p2.x)] : [Math.min(geoB.p1.y, geoB.p2.y), Math.max(geoB.p1.y, geoB.p2.y)];

      if (rangesOverlap([aMin, aMax], [bMin, bMax]) && rangesOverlap(rangeA, rangeB)) {
        results.push(issue('warning', `${label} traslapadas`, `${label.slice(0, -1)}s #${a.id} y #${b.id} están en la misma línea, se traslapan y comparten nivel.`, [a.id, b.id]));
      }
    }
  }
  return results;
}

/** Dos ejes X (o dos Y) en la misma posición — probablemente un eje duplicado por error. */
function checkDuplicateAxisPositions(grid) {
  const results = [];
  for (const [axes, label] of [[grid.xAxes, 'X'], [grid.yAxes, 'Y']]) {
    for (let i = 0; i < axes.length; i++) {
      for (let j = i + 1; j < axes.length; j++) {
        if (Math.abs(axes[i].position - axes[j].position) < 1) {
          results.push(issue('warning', 'Ejes duplicados', `Ejes ${label} "${axes[i].label}" y "${axes[j].label}" están en la misma posición (${axes[i].position} mm) — revisa si uno sobra.`, []));
        }
      }
    }
  }
  return results;
}

/** Nivel inferior por arriba del superior — probablemente se invirtieron al crear el elemento. */
function checkInvertedLevels(elements, grid) {
  const results = [];
  for (const el of elements) {
    if (el.type !== 'wall' && el.type !== 'column') continue;
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!bottom || !top) continue;
    if (bottom.elevation > top.elevation + 0.001) {
      results.push(issue('warning', 'Niveles invertidos', `${el.type === 'wall' ? 'Muro' : 'Pilar'} #${el.id}: el nivel inferior (${bottom.label}, ${bottom.elevation}mm) está más arriba que el superior (${top.label}, ${top.elevation}mm). ¿Se seleccionaron al revés?`, [el.id]));
    }
  }
  return results;
}

/** Dimensiones fuera de rangos razonables — probable error de tipeo (ej. 14mm en vez de 140mm).
 *  Si el campo es una fórmula inválida (parámetro desconocido), se avisa aparte en vez de comparar NaN. */
function checkSuspiciousDimensions(elements, paramsMap, elementsById = {}) {
  const results = [];
  for (const el of elements) {
    if (el.type === 'wall') {
      const thickness = resolveValue(el.thickness, paramsMap, elementsById);
      if (!isFinite(thickness)) results.push(issue('error', 'Fórmula inválida', `Muro #${el.id}: el espesor "${el.thickness}" referencia un parámetro inexistente o tiene una fórmula inválida.`, [el.id]));
      else if (thickness < 50 || thickness > 600) results.push(issue('warning', 'Dimensión inusual', `Muro #${el.id}: espesor ${thickness}mm está fuera del rango típico (50-600mm). Revisa si es un error de tipeo.`, [el.id]));
    }
    if (el.type === 'column') {
      const widthX = resolveValue(el.widthX, paramsMap, elementsById);
      const widthY = resolveValue(el.widthY, paramsMap, elementsById);
      if (!isFinite(widthX) || !isFinite(widthY)) results.push(issue('error', 'Fórmula inválida', `Pilar #${el.id}: alguna dimensión referencia un parámetro inexistente o tiene una fórmula inválida.`, [el.id]));
      else if (widthX < 100 || widthX > 2000 || widthY < 100 || widthY > 2000) results.push(issue('warning', 'Dimensión inusual', `Pilar #${el.id}: sección ${widthX}×${widthY}mm está fuera del rango típico (100-2000mm).`, [el.id]));
    }
    if (el.type === 'beam') {
      const width = resolveValue(el.width, paramsMap, elementsById);
      if (!isFinite(width)) results.push(issue('error', 'Fórmula inválida', `Viga #${el.id}: el ancho "${el.width}" referencia un parámetro inexistente o tiene una fórmula inválida.`, [el.id]));
      else if (width < 100 || width > 1000) results.push(issue('warning', 'Dimensión inusual', `Viga #${el.id}: ancho ${width}mm está fuera del rango típico (100-1000mm).`, [el.id]));
    }
    if (el.type === 'wall') {
      for (const o of el.openings || []) {
        const oWidth = resolveValue(o.width, paramsMap);
        const oHeight = resolveValue(o.height, paramsMap);
        const oSill = o.sillHeight != null ? resolveValue(o.sillHeight, paramsMap) : 0;
        if (!isFinite(oWidth)) results.push(issue('error', 'Fórmula inválida', `Vano #${o.id}: el ancho "${o.width}" referencia un parámetro inexistente o tiene una fórmula inválida.`, [o.id, el.id]));
        if (!isFinite(oHeight)) results.push(issue('error', 'Fórmula inválida', `Vano #${o.id}: el alto "${o.height}" referencia un parámetro inexistente o tiene una fórmula inválida.`, [o.id, el.id]));
        if (o.sillHeight != null && !isFinite(oSill)) results.push(issue('error', 'Fórmula inválida', `Vano #${o.id}: la altura de antepecho "${o.sillHeight}" referencia un parámetro inexistente o tiene una fórmula inválida.`, [o.id, el.id]));
      }
    }
  }
  return results;
}

/** Serializa un campo de eje (ID plano o referencia a elemento) a texto estable para usar en claves. */
function keyPart(raw) {
  return isElementRef(raw) ? `ref:${raw.refElementId}:${raw.edge}` : String(raw);
}

/** Elementos idénticos (mismo tipo, misma geometría, mismo nivel) — probable doble clic al crear. */
function checkExactDuplicates(elements) {
  const results = [];
  const seen = new Map();
  for (const el of elements) {
    let key;
    if (el.type === 'wall') key = `wall:${keyPart(el.xStart)}:${keyPart(el.xEnd)}:${keyPart(el.yStart)}:${keyPart(el.yEnd)}:${el.bottomZ}:${el.topZ}`;
    else if (el.type === 'column') key = `column:${keyPart(el.axisXId)}:${keyPart(el.axisYId)}:${el.bottomZ}:${el.topZ}`;
    else if (el.type === 'beam') key = `beam:${el.direction}:${keyPart(el.fixedAxisId)}:${keyPart(el.startAxisId)}:${keyPart(el.endAxisId)}:${el.levelZ}`;
    else if (el.type === 'foundation') key = `foundation:${el.direction}:${keyPart(el.fixedAxisId)}:${keyPart(el.startAxisId)}:${keyPart(el.endAxisId)}`;
    else continue;
    if (seen.has(key)) {
      results.push(issue('warning', 'Elemento duplicado', `#${el.id} parece ser un duplicado exacto de #${seen.get(key)} (mismo tipo, misma geometría, mismo nivel).`, [el.id, seen.get(key)]));
    } else {
      seen.set(key, el.id);
    }
  }
  return results;
}

/** Mitad del ancho/espesor real del elemento, para derivar la tolerancia de encuentro geométricamente. */
function getElementHalfWidth(el, paramsMap, elementsById = {}) {
  if (el.type === 'wall') return (resolveValue(el.thickness, paramsMap, elementsById) || 200) / 2;
  if (el.type === 'column') return Math.max(resolveValue(el.widthX, paramsMap, elementsById) || 300, resolveValue(el.widthY, paramsMap, elementsById) || 300) / 2;
  if (el.type === 'beam') return (resolveValue(el.width, paramsMap, elementsById) || 300) / 2;
  if (el.type === 'foundation') return (resolveValue(el.cimiento?.width ?? el.sobrecimiento?.width, paramsMap, elementsById) || 300) / 2;
  return 75;
}

/** Conectividad: pilares sin apoyo en su base, sin nada en su tope, o vigas con un extremo al aire.
 *  Crítico para CalculiX — un nodo sin conexión real deja la matriz de rigidez singular.
 *  La tolerancia de encuentro no es fija: se deriva del ancho real de cada par de elementos
 *  (mitad de uno + mitad del otro), más un margen extra que el usuario puede ajustar para
 *  casos de diseño intencional (ménsulas, desfases) que la geometría no puede adivinar. */
function checkConnectivity(elements, grid, extraMargin, paramsMap, elementsById) {
  const results = [];

  function isSupportedAt(x, y, elevation, excludeId, ownHalfWidth) {
    for (const el of elements) {
      if (el.id === excludeId) continue;
      const tol = ownHalfWidth + getElementHalfWidth(el, paramsMap, elementsById) + extraMargin;
      if (el.type === 'wall') {
        const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
        const top = grid.zLevels.find(l => l.id === el.topZ);
        if (!bottom || !top) continue;
        if (elevation < Math.min(bottom.elevation, top.elevation) - 1 || elevation > Math.max(bottom.elevation, top.elevation) + 1) continue;
        const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
        if (geo && pointOnSegment(x, y, geo.p1.x, geo.p1.y, geo.p2.x, geo.p2.y, tol)) return true;
      } else if (el.type === 'column') {
        const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
        const top = grid.zLevels.find(l => l.id === el.topZ);
        if (!bottom || !top) continue;
        const matchesLevel = Math.abs(bottom.elevation - elevation) < 1 || Math.abs(top.elevation - elevation) < 1;
        if (!matchesLevel) continue;
        const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
        if (geo && Math.hypot(geo.center.x - x, geo.center.y - y) < tol) return true;
      } else if (el.type === 'beam') {
        const level = grid.zLevels.find(l => l.id === el.levelZ);
        if (!level || Math.abs(level.elevation - elevation) > 1) continue;
        const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
        if (geo && pointOnSegment(x, y, geo.p1.x, geo.p1.y, geo.p2.x, geo.p2.y, tol)) return true;
      } else if (el.type === 'foundation') {
        const level = grid.zLevels.find(l => l.id === el.levelZ);
        const topElevation = level ? level.elevation : 0; // sin nivel base asignado: fallback a z=0
        if (Math.abs(topElevation - elevation) > 1) continue;
        const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
        if (geo && pointOnSegment(x, y, geo.p1.x, geo.p1.y, geo.p2.x, geo.p2.y, tol)) return true;
      }
    }
    return false;
  }

  for (const el of elements) {
    if (el.type === 'column') {
      const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
      const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
      const top = grid.zLevels.find(l => l.id === el.topZ);
      if (!geo || !bottom || !top) continue;
      const ownHalfWidth = getElementHalfWidth(el, paramsMap, elementsById);
      if (!isSupportedAt(geo.center.x, geo.center.y, bottom.elevation, el.id, ownHalfWidth)) {
        results.push(issue('warning', 'Sin apoyo', `Pilar #${el.id}: no hay ningún muro, viga o fundación en su nivel inferior (${bottom.label}) — quedaría flotando en el análisis.`, [el.id]));
      }
      if (!isSupportedAt(geo.center.x, geo.center.y, top.elevation, el.id, ownHalfWidth)) {
        results.push(issue('warning', 'Sin conexión superior', `Pilar #${el.id}: no hay ninguna viga o muro en su nivel superior (${top.label}) — verifica si es intencional (ej. parapeto).`, [el.id]));
      }
    } else if (el.type === 'beam') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      const level = grid.zLevels.find(l => l.id === el.levelZ);
      if (!geo || !level) continue;
      const ownHalfWidth = getElementHalfWidth(el, paramsMap, elementsById);
      if (!isSupportedAt(geo.p1.x, geo.p1.y, level.elevation, el.id, ownHalfWidth)) {
        results.push(issue('warning', 'Extremo sin apoyo', `Viga #${el.id}: el extremo inicial no conecta con ningún pilar, muro u otra viga en su nivel.`, [el.id]));
      }
      if (!isSupportedAt(geo.p2.x, geo.p2.y, level.elevation, el.id, ownHalfWidth)) {
        results.push(issue('warning', 'Extremo sin apoyo', `Viga #${el.id}: el extremo final no conecta con ningún pilar, muro u otra viga en su nivel.`, [el.id]));
      }
    }
  }
  return results;
}

/** ★ Sesión 11 — cotas y capas de fundaciones:
 *  - el tope del sobrecimiento debería empatar con el NPT del nivel base (topOffset = 0);
 *  - una fundación corrida sin ninguna capa no representa hormigón alguno;
 *  - sello sobre el NPT = fundación al aire (profundidad nula o invertida). */
function checkFoundationLevels(elements, grid, paramsMap, elementsById) {
  const results = [];
  for (const el of elements) {
    if (el.type !== 'foundation') continue;

    if (el.foundationType !== 'aislada' && !el.cimiento && !el.sobrecimiento) {
      results.push(issue('error', 'Fundaciones', `Fundación #${el.id} no tiene ni cimiento ni sobrecimiento definidos.`, [el.id]));
      continue;
    }

    const f = resolveFoundation(el, grid, paramsMap, elementsById);
    if (!f) continue;

    const offset = f.topElevation - f.npt;
    if (el.sobrecimiento && Math.abs(offset) > 0.001) {
      results.push(issue('warning', 'Fundaciones',
        `Fundación #${el.id}: el tope del sobrecimiento (${f.topElevation.toFixed(0)} mm) no empata con el NPT del nivel base (${f.npt.toFixed(0)} mm).`, [el.id]));
    }
    if (f.sealElevation >= f.topElevation - 0.001) {
      results.push(issue('error', 'Fundaciones', `Fundación #${el.id}: el sello queda a la misma cota o sobre el tope (altura nula).`, [el.id]));
    }
  }
  return results;
}

/** Corre todas las verificaciones y devuelve la lista de hallazgos.
 *  extraMargin (mm): se suma a la tolerancia de conectividad derivada de anchos reales, para
 *  cubrir casos de diseño intencional (ménsulas, desfases) que la geometría no puede adivinar. */
export function validateModel(model, extraMargin = 0) {
  const { elements, grid } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  return [
    ...checkDanglingReferences(elements, grid, paramsMap, elementsById),
    ...checkZeroLength(elements, grid, paramsMap, elementsById),
    ...checkOpeningsOutsideWall(elements, grid, paramsMap, elementsById),
    ...checkOverlappingWalls(elements, grid, paramsMap, elementsById),
    ...checkOverlappingColumns(elements, grid, paramsMap, elementsById),
    ...checkOverlappingBeamLike(elements, grid, 'beam', 'Vigas', paramsMap, elementsById),
    ...checkOverlappingBeamLike(elements, grid, 'foundation', 'Fundaciones', paramsMap, elementsById),
    ...checkFoundationsWithoutLevel(elements),
    ...checkFoundationLevels(elements, grid, paramsMap, elementsById),
    ...checkDuplicateAxisPositions(grid),
    ...checkInvertedLevels(elements, grid),
    ...checkSuspiciousDimensions(elements, paramsMap, elementsById),
    ...checkExactDuplicates(elements),
    ...checkConnectivity(elements, grid, extraMargin, paramsMap, elementsById)
  ];
}
