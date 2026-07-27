// core/projection.js
// Reemplaza worldToScreen + worldToScreenElev + projectHorizontalForElevation

/** Reduce coords 3D (x,y,z) a plano 2D (h,v) según el modo de vista.
 *  mode: 'plan' | { axis: 'x'|'y' }
 */
export function toPlane(x, y, z, mode) {
  if (mode === 'plan') return { h: x, v: y };
  const h = mode.axis === 'x' ? y : x;
  return { h, v: z };
}

/** Proyecta (h,v) a coordenadas de pantalla.
 *  flipY=true en elevación: v crece hacia arriba, canvas crece hacia abajo.
 */
export function toScreen(h, v, view, canvasHeight, flipY) {
  const sx = (h - view.offsetX) * view.scale;
  const sy = flipY
    ? canvasHeight - (v - view.offsetY) * view.scale
    : (v - view.offsetY) * view.scale;
  return { x: sx, y: sy };
}

/** Punto único de entrada: reemplaza worldToScreen y worldToScreenElev */
export function project(x, y, z, mode, view, canvasHeight) {
  const { h, v } = toPlane(x, y, z, mode);
  return toScreen(h, v, view, canvasHeight, mode !== 'plan');
}

/** Para datos que YA están en espacio de plano (h,v) -- p.ej. segmentos de elevación
 *  ya recortados -- sin pasar de nuevo por toPlane. */
export function projectPlane(h, v, mode, view, canvasHeight) {
  return toScreen(h, v, view, canvasHeight, mode !== 'plan');
}

/** Inversa de toScreen, para clicks (reemplaza screenToWorldElev; screenToWorld en planta ya es directo). */
export function screenToPlane(sx, sy, view, canvasHeight, flipY) {
  const h = view.offsetX + sx / view.scale;
  const v = flipY
    ? view.offsetY + (canvasHeight - sy) / view.scale
    : view.offsetY + sy / view.scale;
  return { h, v };
}

/** Convierte el string de modo actual ('plan' | 'elevation-x-3') al mode compacto {axis}. */
export function parseMode(modeStr, parseElevationMode) {
  if (modeStr === 'plan') return 'plan';
  const parsed = parseElevationMode(modeStr);
  return parsed ? { axis: parsed.axisType } : 'plan';
}
