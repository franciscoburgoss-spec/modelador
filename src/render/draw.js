// render/draw.js
import { segmentBasis } from '../core/geometry.js';

/** Dibuja un elemento tipo "línea gruesa" (viga). Reemplaza drawBeam + drawElevationBeam. */
export function drawSegmentElement(ctx, p1, p2, halfThickness, { fill, stroke, lineWidth }) {
  const basis = segmentBasis(p1, p2);
  if (!basis) return;
  const px = basis.nx * halfThickness;
  const py = basis.ny * halfThickness;

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(p1.x + px, p1.y + py);
  ctx.lineTo(p2.x + px, p2.y + py);
  ctx.lineTo(p2.x - px, p2.y - py);
  ctx.lineTo(p1.x - px, p1.y - py);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Dibuja un elemento tipo rectángulo centrado (pilar). Reemplaza drawColumn + drawElevationColumn. */
export function drawRectElement(ctx, center, w, h, { fill, stroke, lineWidth, diagonals = false, diagonalColor }) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.rect(center.x - w / 2, center.y - h / 2, w, h);
  ctx.fill();
  ctx.stroke();

  if (diagonals) {
    ctx.strokeStyle = diagonalColor || stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center.x - w / 2, center.y - h / 2);
    ctx.lineTo(center.x + w / 2, center.y + h / 2);
    ctx.moveTo(center.x + w / 2, center.y - h / 2);
    ctx.lineTo(center.x - w / 2, center.y + h / 2);
    ctx.stroke();
  }
}
