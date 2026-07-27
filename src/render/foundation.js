// render/foundation.js
// ★ Sesión 11 — dibujo de fundaciones. Recibe coordenadas YA proyectadas a pantalla
// (mismo criterio que el resto de render/*: nada de resolver geometría acá).

import { drawSegmentElement } from './draw.js';

const COLORS = {
  cimiento: { fill: 'rgba(87,83,78,0.35)', stroke: '#57534e' },
  sobrecimiento: { fill: 'rgba(168,162,158,0.45)', stroke: '#78716c' },
  zapata: { fill: 'rgba(87,83,78,0.35)', stroke: '#57534e' },
  emplantillado: { fill: 'rgba(214,211,209,0.35)', stroke: '#a8a29e' },
  selected: { fill: '#facc15', stroke: '#1e40af' }
};

/** Fundación corrida en planta: línea segmentada (va enterrada, bajo el muro). */
export function drawFoundationRunPlan(ctx, p1, p2, halfWidthPx, { selected }) {
  const c = selected ? COLORS.selected : COLORS.cimiento;
  ctx.save();
  ctx.setLineDash(selected ? [] : [10, 6]);
  drawSegmentElement(ctx, p1, p2, halfWidthPx, {
    fill: selected ? c.fill : c.fill,
    stroke: c.stroke,
    lineWidth: selected ? 2.5 : 1.2
  });
  ctx.restore();
}

/** Zapata aislada en planta: rectángulo con diagonales (convención de fundación enterrada). */
export function drawFoundationPadPlan(ctx, center, wPx, hPx, { selected }) {
  const c = selected ? COLORS.selected : COLORS.zapata;
  const x1 = center.x - wPx / 2, y1 = center.y - hPx / 2;
  const x2 = center.x + wPx / 2, y2 = center.y + hPx / 2;
  ctx.save();
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = selected ? 2.5 : 1.2;
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  ctx.setLineDash(selected ? [] : [10, 6]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.moveTo(x1, y2); ctx.lineTo(x2, y1);
  ctx.stroke();
  ctx.restore();
}

/** Capa de fundación en elevación: relleno + achurado a 45° (hormigón bajo la línea de suelo). */
export function drawFoundationLayerElevation(ctx, layerName, x1, y1, x2, y2, { selected }) {
  const c = selected ? COLORS.selected : (COLORS[layerName] || COLORS.cimiento);
  const left = Math.min(x1, x2), right = Math.max(x1, x2);
  const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
  const w = right - left, h = bottom - top;
  if (w <= 0 || h <= 0) return;

  ctx.save();
  ctx.fillStyle = c.fill;
  ctx.fillRect(left, top, w, h);

  // Achurado simple: no depende del zoom en paso (se ve igual de denso a cualquier escala).
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();
  ctx.strokeStyle = c.stroke;
  ctx.globalAlpha = selected ? 0.5 : 0.35;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const step = 8;
  for (let d = -h; d < w; d += step) {
    ctx.moveTo(left + d, bottom);
    ctx.lineTo(left + d + h, top);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = selected ? 2.5 : 1.2;
  ctx.strokeRect(left, top, w, h);
  ctx.restore();
}
