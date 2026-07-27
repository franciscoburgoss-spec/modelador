// render/roofZonePreview.js
// Mini-planta esquemática de UN sistema de techumbre (sesión 23): eje horizontal = eje de corrida
// de los muros de apoyo, eje vertical = dirección de la luz. Muestra el solape disponible de los
// dos muros, la zona efectivamente cubierta y las cerchas dentro de ella.
//
// No es una vista a escala del modelo: es un esquema normalizado al ancho del canvas para que
// Fran vea de un golpe si la zona quedó donde quería. La planta real la dibuja Canvas.jsx con
// computeRoofPlanSegments.

const COLORS = {
  overlap: '#c9c9c4',   // solape disponible (fuera de la zona)
  zone: '#dce7f2',      // relleno de la zona cubierta
  wall: '#2b4a6f',      // muros de apoyo
  truss: '#60a5fa',     // cerchas
  text: '#5a5a55',
  muted: '#8a8a85'
};

/**
 * @param ctx CanvasRenderingContext2D ya escalado (transform aplicado por el llamador)
 * @param layout resultado de computeRoofSystemLayout
 * @param width, height dimensiones CSS del canvas
 */
export function drawRoofZonePreview(ctx, layout, width, height, padding = 26) {
  ctx.clearRect(0, 0, width, height);

  const overlap = layout?.overlapRange;
  if (!overlap || !(overlap.to - overlap.from > 0)) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px sans-serif';
    ctx.fillText(layout?.warnings?.[0] || 'Sin solape de muros de apoyo.', padding, height / 2);
    return;
  }

  const zone = layout.runRange ?? overlap;
  const span = layout.span > 0 ? layout.span : 1;
  const oLen = overlap.to - overlap.from;

  // escala horizontal: todo el solape entra en el ancho útil. La vertical es independiente (el
  // esquema no conserva proporción: con luces de 4m y corridas de 12m no se vería nada).
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const toX = (u) => padding + ((u - overlap.from) / oLen) * usableW;
  const yLow = padding + usableH;          // muro bajo (canaleta) abajo
  const yHigh = padding;                   // muro alto arriba

  // banda del solape completo
  ctx.fillStyle = COLORS.overlap;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(toX(overlap.from), yHigh, usableW, usableH);
  ctx.globalAlpha = 1;

  // zona cubierta
  const zx1 = toX(zone.from), zx2 = toX(zone.to);
  ctx.fillStyle = COLORS.zone;
  ctx.fillRect(zx1, yHigh, Math.max(zx2 - zx1, 1), usableH);
  ctx.strokeStyle = COLORS.truss;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(zx1, yHigh, Math.max(zx2 - zx1, 1), usableH);
  ctx.setLineDash([]);

  // cerchas dentro de la zona
  ctx.strokeStyle = COLORS.truss;
  ctx.lineWidth = 1;
  for (const p of layout.trussPositions || []) {
    const x = toX(p.offset);
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();
  }

  // muros de apoyo: líneas gruesas en todo el solape (existen más allá de la zona)
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 3;
  for (const y of [yLow, yHigh]) {
    ctx.beginPath();
    ctx.moveTo(toX(overlap.from), y);
    ctx.lineTo(toX(overlap.to), y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  // rótulos
  ctx.fillStyle = COLORS.text;
  ctx.font = '10px sans-serif';
  ctx.fillText('frontón alto', padding, yHigh - 8);
  ctx.fillText('frontón bajo (canaleta)', padding, yLow + 14);

  const axis = layout.runAxis === 'x' ? 'X' : 'Y';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`${axis}=${Math.round(overlap.from)}`, padding - 2, height - 4);
  const endLabel = `${axis}=${Math.round(overlap.to)}`;
  ctx.fillText(endLabel, width - padding - ctx.measureText(endLabel).width, height - 4);

  // cota de la zona, centrada sobre ella
  const zoneLabel = `zona ${Math.round(zone.from)}→${Math.round(zone.to)}mm · luz ${(span / 1000).toFixed(2)}m`;
  ctx.fillStyle = COLORS.text;
  const cx = Math.min(Math.max((zx1 + zx2) / 2 - ctx.measureText(zoneLabel).width / 2, 2), width - ctx.measureText(zoneLabel).width - 2);
  ctx.fillText(zoneLabel, cx, yHigh + usableH / 2 + 3);
}
