// render/grid.js
import { project } from '../core/projection.js';

const BUBBLE_MARGIN = 26; // separa la burbuja del borde real del canvas para que no se vea recortada
const BUBBLE_RADIUS = 11;

function drawMainAxisLine(ctx, p1, p2, label, canvasW, canvasH, isVerticalLine) {
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([7, 4, 2, 4]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Las burbujas se dibujan con margen respecto al borde, nunca exactamente en 0/ancho/alto.
  const bubblePoints = isVerticalLine
    ? [{ x: p1.x, y: BUBBLE_MARGIN }, { x: p1.x, y: canvasH - BUBBLE_MARGIN }]
    : [{ x: BUBBLE_MARGIN, y: p1.y }, { x: canvasW - BUBBLE_MARGIN, y: p1.y }];

  for (const p of bubblePoints) {
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.arc(p.x, p.y, BUBBLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y);
  }
}

function drawAuxAxisLine(ctx, p1, p2) {
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawGrid(ctx, model, mode, view, canvasW, canvasH) {
  if (mode !== 'plan') return; // en elevación se dibuja con drawElevationGrid (otro módulo)
  if (!view.showAxes) return;

  for (const axis of model.grid.xAxes) {
    const p1 = project(axis.position, -1e6, 0, mode, view, canvasH);
    const top = { x: p1.x, y: 0 };
    const bottom = { x: p1.x, y: canvasH };
    if (axis.type === 'aux') drawAuxAxisLine(ctx, top, bottom);
    else drawMainAxisLine(ctx, top, bottom, axis.label, canvasW, canvasH, true);
  }

  for (const axis of model.grid.yAxes) {
    const p1 = project(-1e6, axis.position, 0, mode, view, canvasH);
    const left = { x: 0, y: p1.y };
    const right = { x: canvasW, y: p1.y };
    if (axis.type === 'aux') drawAuxAxisLine(ctx, left, right);
    else drawMainAxisLine(ctx, left, right, axis.label, canvasW, canvasH, false);
  }
}
