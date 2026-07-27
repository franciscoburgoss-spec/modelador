// render/elevationGrid.js
import { projectPlane } from '../core/projection.js';
import { parseElevationMode } from '../core/viewMode.js';
import { getElevationAxis } from '../core/elevation.js';

export const ELEVATION_CATEGORY_COLORS = {
  1: { fill: '#475569', stroke: '#1e2937', label: 'En el plano' },
  2: { fill: '#9333ea', stroke: '#581c87', label: 'Cruza el plano' },
  3: { fill: '#0891b2', stroke: '#155e75', label: 'Termina en el plano' },
  4: { fill: '#dc2626', stroke: '#991b1b', label: 'Empieza en el plano' }
};

function getBounds(grid, mode) {
  const perpendicularAxes = mode.axis === 'x' ? grid.yAxes : grid.xAxes;
  const hPositions = perpendicularAxes.map(a => a.position);
  const minH = hPositions.length ? Math.min(...hPositions) - 1500 : -1000;
  const maxH = hPositions.length ? Math.max(...hPositions) + 1500 : 1000;

  const elevations = grid.zLevels.map(l => l.elevation);
  const minV = elevations.length ? Math.min(...elevations) - 500 : -500;
  const maxV = elevations.length ? Math.max(...elevations) + 1500 : 3000;

  return { minH, maxH, minV, maxV, perpendicularAxes };
}

export function drawElevationGrid(ctx, model, modeStr, view, canvasW, canvasH, showCategoryLegend = true) {
  const parsed = parseElevationMode(modeStr);
  const axis = getElevationAxis(modeStr, model.grid);
  if (!parsed || !axis) return;
  const mode = { axis: parsed.axisType };

  const { minH, maxH, minV, maxV, perpendicularAxes } = getBounds(model.grid, mode);

  // Ejes perpendiculares (dashed verticales)
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  perpendicularAxes.forEach(pa => {
    const p1 = projectPlane(pa.position, minV, mode, view, canvasH);
    const p2 = projectPlane(pa.position, maxV, mode, view, canvasH);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  // Niveles Z (dashed horizontales)
  model.grid.zLevels.forEach(level => {
    const p1 = projectPlane(minH, level.elevation, mode, view, canvasH);
    const p2 = projectPlane(maxH, level.elevation, mode, view, canvasH);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Etiquetas de ejes perpendiculares en la base
  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  perpendicularAxes.forEach(pa => {
    const pBase = projectPlane(pa.position, minV, mode, view, canvasH);
    ctx.fillText(pa.label, pBase.x, Math.min(canvasH - 8, pBase.y + 20));
  });

  // Resalta el nivel Z actual
  const current = model.grid.zLevels.find(l => l.id === model.currentZLevelId);
  if (current) {
    const p1 = projectPlane(minH, current.elevation, mode, view, canvasH);
    const p2 = projectPlane(maxH, current.elevation, mode, view, canvasH);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Encabezado
  const perpendicularLabel = parsed.axisType === 'x' ? 'Y' : 'X';
  const axesText = perpendicularAxes.map(a => a.label).join(', ') || '—';
  ctx.fillStyle = '#4c1d95';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const headerParts = [`Elevación eje ${axis.label}`, `Ejes ${perpendicularLabel}: ${axesText}`];
  if (current) headerParts.push(`Nivel: ${current.label} (${current.elevation} mm)`);
  ctx.fillText(headerParts.join(' · '), 14, 14);

  // Leyenda de colores por categoría (se apaga cuando se muestran montantes, para no saturar)
  if (showCategoryLegend) {
    let legendY = 38;
    ctx.font = '12px system-ui';
    ctx.textBaseline = 'top';
    Object.values(ELEVATION_CATEGORY_COLORS).forEach(item => {
      ctx.fillStyle = item.fill;
      ctx.fillRect(14, legendY, 14, 14);
      ctx.strokeStyle = '#1e2937';
      ctx.lineWidth = 1;
      ctx.strokeRect(14, legendY, 14, 14);
      ctx.fillStyle = '#334155';
      ctx.fillText(item.label, 34, legendY + 1);
      legendY += 20;
    });
  }
}
