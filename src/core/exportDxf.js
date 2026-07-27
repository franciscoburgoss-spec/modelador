// core/exportDxf.js
import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry, isWallXRun } from './elementGeometry.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { computeDimensionChain, resolveDimensionAnchor } from './dimensions.js';
import { makePlanToPaper } from './dxfPlanTransform.js';

function line(layer, x1, y1, x2, y2) {
  return [
    '0', 'LINE',
    '8', layer,
    '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0',
    '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0'
  ].join('\n');
}

function text(layer, x, y, height, rotation, str) {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', x.toFixed(2), '20', y.toFixed(2), '30', '0',
    '40', height.toFixed(2),
    '50', rotation.toFixed(1),
    '1', str
  ].join('\n');
}

function closedPolyline(layer, points) {
  const lines = ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1'];
  for (const [x, y] of points) {
    lines.push('0', 'VERTEX', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0');
  }
  lines.push('0', 'SEQEND');
  return lines.join('\n');
}

function wallRectangle(wall, grid, paramsMap, elementsById) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  if (!geo) return null;
  const isXRun = isWallXRun(wall);
  const half = geo.thickness / 2;
  if (isXRun) {
    const y0 = geo.p1.y;
    const x1 = Math.min(geo.p1.x, geo.p2.x), x2 = Math.max(geo.p1.x, geo.p2.x);
    return [[x1, y0 - half], [x2, y0 - half], [x2, y0 + half], [x1, y0 + half]];
  }
  const x0 = geo.p1.x;
  const y1 = Math.min(geo.p1.y, geo.p2.y), y2 = Math.max(geo.p1.y, geo.p2.y);
  return [[x0 - half, y1], [x0 + half, y1], [x0 + half, y2], [x0 - half, y2]];
}

function columnRectangle(column, grid, paramsMap, elementsById) {
  const geo = resolveColumnGeometry(column, grid, paramsMap, elementsById);
  if (!geo) return null;
  const { center, w, h } = geo;
  return [
    [center.x - w / 2, center.y - h / 2], [center.x + w / 2, center.y - h / 2],
    [center.x + w / 2, center.y + h / 2], [center.x - w / 2, center.y + h / 2]
  ];
}

// ★ Cotas vivas (ítem 6): solo se exportan las de planta (view:'plan') — el archivo DXF hoy
// es una única planta (no hay corte de elevación en este exportador). Cada tramo de la
// cadena se emite como una entidad DIMENSION real, con su bloque asociado (*D{n}) que
// contiene la geometría visible (línea de cota + marcas + texto) — mismo criterio visual
// que render/dimensions.js: sin líneas de extensión hacia geometría externa, solo la línea
// de cota entre los puntos resueltos, con marcas perpendiculares y el valor en mm.
const DIM_TICK_HALF = 150; // mm, media longitud de la marca perpendicular

function dimensionBlocksAndEntities(dimensions, grid, elementsById, paramsMap, planToPaper) {
  const blocks = [];
  const dimEntities = [];
  let n = 0;

  for (const dim of dimensions) {
    if (dim.view !== 'plan') continue; // elevación: fuera de alcance de este exportador
    const chain = computeDimensionChain(dim, grid, elementsById, paramsMap);
    if (!chain) continue;
    const horizontal = dim.orientation === 'x';
    const toWorld = (coord) => horizontal ? [coord, dim.linePos] : [dim.linePos, coord];
    const worldPoints = chain.points.map(p => p.coord == null ? null : planToPaper.point(toWorld(p.coord)));
    // Línea de extensión real (ver core/dimensions.js: resolveDimensionAnchor) — solo existe
    // cuando el punto referencia un elemento; un ID de eje de grilla no tiene anchor real.
    const anchorWorldPoints = chain.points.map((p) => {
      if (p.coord == null) return null;
      const anchor = resolveDimensionAnchor(p.raw, dim, grid, elementsById, paramsMap);
      if (anchor == null) return null;
      return planToPaper.point(horizontal ? [p.coord, anchor] : [anchor, p.coord]);
    });

    chain.segments.forEach((seg) => {
      const a = worldPoints[seg.fromIndex];
      const b = worldPoints[seg.toIndex];
      if (!a || !b || seg.distance == null) return; // tramo no resoluble: no se exporta (nada que dibujar)
      n++;
      const blockName = `*D${n}`;
      const [ax, ay] = a, [bx, by] = b;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const label = `${Math.round(seg.distance)}`;

      const geometry = [
        line('COTAS', ax, ay, bx, by),
        horizontal ? line('COTAS', ax, ay - DIM_TICK_HALF, ax, ay + DIM_TICK_HALF) : line('COTAS', ax - DIM_TICK_HALF, ay, ax + DIM_TICK_HALF, ay),
        horizontal ? line('COTAS', bx, by - DIM_TICK_HALF, bx, by + DIM_TICK_HALF) : line('COTAS', bx - DIM_TICK_HALF, by, bx + DIM_TICK_HALF, by),
        text('COTAS', mx, my + (horizontal ? DIM_TICK_HALF * 1.3 : 0), 250, horizontal ? 0 : 90, label),
        ...[anchorWorldPoints[seg.fromIndex], anchorWorldPoints[seg.toIndex]]
          .map((anchor, k) => anchor ? line('EXT_COTAS', anchor[0], anchor[1], (k === 0 ? a : b)[0], (k === 0 ? a : b)[1]) : null)
          .filter(Boolean)
      ].join('\n');

      blocks.push(['0', 'BLOCK', '8', 'COTAS', '2', blockName, '70', '1', '10', '0', '20', '0', '30', '0', '3', blockName, '1', '', geometry, '0', 'ENDBLK'].join('\n'));

      dimEntities.push([
        '0', 'DIMENSION',
        '8', 'COTAS',
        '2', blockName,
        '10', mx.toFixed(2), '20', my.toFixed(2), '30', '0',
        '11', mx.toFixed(2), '21', (my + (horizontal ? DIM_TICK_HALF * 1.3 : 0)).toFixed(2), '31', '0',
        '13', ax.toFixed(2), '23', ay.toFixed(2), '33', '0',
        '14', bx.toFixed(2), '24', by.toFixed(2), '34', '0',
        '70', '32',
        '1', label
      ].join('\n'));
    });
  }

  return { blocks, dimEntities };
}

/** Genera el contenido de un archivo DXF (R12) con la planta del modelo. */
export function generateDxf(model) {
  const { grid, elements } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const entities = [];

  // Ejes (líneas de referencia entre el rango de la grilla, con margen)
  const xs = grid.xAxes.map(a => a.position);
  const ys = grid.yAxes.map(a => a.position);
  const margin = 1500;
  const yMin = (ys.length ? Math.min(...ys) : 0) - margin;
  const yMax = (ys.length ? Math.max(...ys) : 1000) + margin;
  const xMin = (xs.length ? Math.min(...xs) : 0) - margin;
  const xMax = (xs.length ? Math.max(...xs) : 1000) + margin;

  const planToPaper = makePlanToPaper(yMin, yMax);
  const { flipY } = planToPaper;

  for (const axis of grid.xAxes) entities.push(line('EJES', axis.position, flipY(yMin), axis.position, flipY(yMax)));
  for (const axis of grid.yAxes) entities.push(line('EJES', xMin, flipY(axis.position), xMax, flipY(axis.position)));

  for (const el of elements) {
    if (el.type === 'wall') {
      const rect = wallRectangle(el, grid, paramsMap, elementsById);
      if (rect) entities.push(closedPolyline('MUROS', rect.map(planToPaper.point)));
    } else if (el.type === 'column') {
      const rect = columnRectangle(el, grid, paramsMap, elementsById);
      if (rect) entities.push(closedPolyline('PILARES', rect.map(planToPaper.point)));
    } else if (el.type === 'beam') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      if (geo) entities.push(line('VIGAS', geo.p1.x, flipY(geo.p1.y), geo.p2.x, flipY(geo.p2.y)));
    } else if (el.type === 'foundation') {
      const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
      if (geo) entities.push(line(el.foundationType === 'cimiento' ? 'CIMIENTOS' : 'SOBRECIMIENTOS', geo.p1.x, flipY(geo.p1.y), geo.p2.x, flipY(geo.p2.y)));
    }
  }

  const { blocks, dimEntities } = dimensionBlocksAndEntities(model.dimensions || [], grid, elementsById, paramsMap, planToPaper);
  entities.push(...dimEntities);

  return [
    '0', 'SECTION', '2', 'BLOCKS',
    ...blocks,
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF'
  ].join('\n');
}

export function downloadDxf(model) {
  const content = generateDxf(model);
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo.dxf';
  a.click();
  URL.revokeObjectURL(url);
}
