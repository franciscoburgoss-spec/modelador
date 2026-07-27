// render/osbModulation.js
// Dibujo de la elevación simplificada de un muro con su despiece de placas OSB.
// Mismo estilo/convención que render/metalconModulation.js — vista propia con fit al canvas.

const GAP_COLOR = '#ffffff'; // el gap entre placas se dibuja como corte blanco, no como línea
const PANEL_FILL = '#e9dcc3'; // tono madera/OSB
const PANEL_STROKE = '#8a6d3b';
const WARNING_STROKE = '#b5502a';
const NOGGING_FILL = '#6b7b8c'; // acero: la cadeneta es pieza de metalcon, no placa

export function drawOsbLayoutElevation(
  ctx,
  { courses, length, osbStart: suppliedStart, osbEnd: suppliedEnd, wallHeight, studs },
  width,
  height,
  config = {},
  padding = 28
) {
  ctx.clearRect(0, 0, width, height);
  if (!length || !wallHeight) {
    ctx.fillStyle = '#8a8a85';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sin geometría resuelta para este muro.', padding, height / 2);
    return;
  }

  const panels = (courses || []).flatMap((course) => course.panels || []);
  const panelStart = panels.length > 0
    ? Math.min(...panels.map((panel) => panel.start))
    : 0;
  const panelEnd = panels.length > 0
    ? Math.max(...panels.map((panel) => panel.end))
    : length;
  const osbStart = Number.isFinite(suppliedStart) ? suppliedStart : panelStart;
  const osbEnd = Number.isFinite(suppliedEnd) ? suppliedEnd : panelEnd;
  const drawingLength = osbEnd - osbStart;
  const gap = config.gap ?? 5; // mm, solo visual — no cambia la posición de la junta calculada
  const scale = Math.min(
    (width - padding * 2) / drawingLength,
    (height - padding * 2) / wallHeight
  );
  const originX = padding - osbStart * scale;
  const originY = height - padding;
  const toX = (o) => originX + o * scale;
  const toY = (z) => originY - z * scale;

  for (const course of courses || []) {
    for (const p of course.panels) {
      const start = p.start + gap / 2;
      const end = p.end - gap / 2;
      if (end <= start) continue; // placa más angosta que el gap — no debería pasar, pero no rompe el dibujo
      ctx.fillStyle = PANEL_FILL;
      ctx.strokeStyle = p.warning ? WARNING_STROKE : PANEL_STROKE;
      ctx.lineWidth = p.warning ? 2 : 1;
      ctx.fillRect(toX(start), toY(course.zMax), toX(end) - toX(start), toY(course.zMin) - toY(course.zMax));
      ctx.strokeRect(toX(start), toY(course.zMax), toX(end) - toX(start), toY(course.zMin) - toY(course.zMax));
      // recorte del vacío del vano (la placa cubre el vano y el hueco se corta de ella)
      for (const ct of p.cutouts || []) {
        ctx.fillStyle = GAP_COLOR;
        ctx.fillRect(toX(ct.start), toY(ct.zMax), toX(ct.end) - toX(ct.start), toY(ct.zMin) - toY(ct.zMax));
        ctx.strokeStyle = PANEL_STROKE;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(toX(ct.start), toY(ct.zMax), toX(ct.end) - toX(ct.start), toY(ct.zMin) - toY(ct.zMax));
      }
    }
  }

  // junta horizontal entre cursos (con huincha) — se marca aparte, sin gap, es un corte real
  ctx.strokeStyle = WARNING_STROKE;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < (courses || []).length - 1; i++) {
    const y = toY(courses[i].zMax);
    ctx.beginPath(); ctx.moveTo(toX(osbStart), y); ctx.lineTo(toX(osbEnd), y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Cadeneta real, centrada en la junta y con el B persistido por el solver Metalcon.
  ctx.fillStyle = NOGGING_FILL;
  for (const piece of (studs || []).filter((item) => item.role === 'nogging')) {
    ctx.fillRect(
      toX(piece.oMin),
      toY(piece.zMax),
      toX(piece.oMax) - toX(piece.oMin),
      toY(piece.zMin) - toY(piece.zMax)
    );
  }
}
