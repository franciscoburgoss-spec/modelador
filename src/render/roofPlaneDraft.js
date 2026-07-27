// render/roofPlaneDraft.js
// ★ B4.7.4a — Dibuja el polígono del faldón mientras se traza (esquinas de eje) y una vez cerrado.
// Puro: recibe el draft del store (vertices world {x,y}), el cursor world actual (banda elástica) y
// la vista de planta. Solo aplica en modo planta (el faldón se dibuja sobre la grilla X/Y).

import { projectPlane } from '../core/projection.js';

const ACCENT = '#c2410c';      // naranja techumbre (coherente con la paleta de cerchas)
const VERTEX_R = 4;
const CLOSE_SNAP_R = 10;       // radio en px para "cerrar clicando el primer vértice"

/**
 * @param ctx        contexto 2D
 * @param draft      { active, closed, vertices:[{x,y}] } del store
 * @param cursorWorld {x,y} world del cursor snapeado (o null) — banda elástica al último vértice
 * @param view, canvasH  vista de planta
 */
export function drawRoofPlaneDraft(ctx, draft, cursorWorld, view, canvasH) {
  if (!draft || (!draft.active && !draft.closed)) return;
  const verts = draft.vertices || [];
  if (!verts.length) return;

  const pts = verts.map(v => projectPlane(v.x, v.y, 'plan', view, canvasH));

  ctx.save();

  // aristas ya trazadas
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (draft.closed) ctx.closePath();
  ctx.stroke();

  // relleno tenue del contorno cerrado (feedback de "agua" definida)
  if (draft.closed && pts.length >= 3) {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // banda elástica: último vértice → cursor (solo mientras se dibuja)
  if (draft.active && cursorWorld && pts.length) {
    const c = projectPlane(cursorWorld.x, cursorWorld.y, 'plan', view, canvasH);
    const last = pts[pts.length - 1];
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // resalte del primer vértice cuando el cursor está cerca (indica que se puede cerrar)
    if (pts.length >= 3 && Math.hypot(c.x - pts[0].x, c.y - pts[0].y) <= CLOSE_SNAP_R) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, CLOSE_SNAP_R, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // vértices
  ctx.fillStyle = '#fff';
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, VERTEX_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * ★ B4.7.4c — Contorno PERMANENTE de los faldones ya persistidos (model.roofPlanes) en planta.
 * El polígono (esquinas de eje) se dibuja tenue; el seleccionado va resaltado. Las cerchas del
 * faldón las sigue dibujando drawRoofSystemsPlan (geometría derivada) — acá solo el contorno.
 * Puro: recibe la lista de faldones y la vista de planta.
 */
export function drawRoofPlanesPlan(ctx, planes, view, canvasH, selectedId = null) {
  if (!planes?.length) return;
  ctx.save();
  for (const plane of planes) {
    const verts = plane.polygon || [];
    if (verts.length < 3) continue;
    const pts = verts.map(v => projectPlane(v.x, v.y, 'plan', view, canvasH));
    const selected = selectedId != null && plane.id === selectedId;

    ctx.strokeStyle = selected ? '#e11d48' : ACCENT;
    ctx.lineWidth = selected ? 2.2 : 1.2;
    ctx.setLineDash(selected ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = selected ? 0.12 : 0.05;
    ctx.fillStyle = selected ? '#e11d48' : ACCENT;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** ¿El punto de pantalla `screen` cae sobre el primer vértice del draft? (para cerrar clicando). */
export function isNearFirstVertex(draft, screenPt, view, canvasH) {
  const verts = draft?.vertices || [];
  if (verts.length < 3) return false;
  const p0 = projectPlane(verts[0].x, verts[0].y, 'plan', view, canvasH);
  return Math.hypot(screenPt.x - p0.x, screenPt.y - p0.y) <= CLOSE_SNAP_R;
}
