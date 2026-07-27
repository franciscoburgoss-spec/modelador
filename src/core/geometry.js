// core/geometry.js
// Reemplaza la lógica repetida dentro de isPointInWall / isPointInBeam / isPointInOpening

/** Distancia perpendicular y proyección de (px,py) sobre el segmento p1-p2. */
function segmentProjection(px, py, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;
  const vx = px - p1.x;
  const vy = py - p1.y;

  return {
    proj: vx * ux + vy * uy,
    dist: Math.abs(vx * (-uy) + vy * ux),
    len
  };
}

/** Test genérico: ¿el punto de pantalla cae dentro de un segmento grueso (muro/viga/vano)? */
export function pointNearSegment(px, py, p1, p2, halfThickness, margin = 8) {
  const r = segmentProjection(px, py, p1, p2);
  if (!r) return false;
  return r.proj >= -margin && r.proj <= r.len + margin && r.dist < halfThickness + margin;
}

/** Fracción [0..1] a lo largo del segmento donde proyecta el punto (para ubicar vanos). */
export function segmentFraction(px, py, p1, p2) {
  const r = segmentProjection(px, py, p1, p2);
  if (!r) return null;
  return r.proj / r.len;
}

/** Test genérico para elementos tipo rectángulo (pilares). */
export function pointInRect(px, py, cx, cy, w, h, margin = 8) {
  return px >= cx - w / 2 - margin && px <= cx + w / 2 + margin &&
         py >= cy - h / 2 - margin && py <= cy + h / 2 + margin;
}

/** ¿El punto (px,py) cae dentro del polígono `poly` ([{x,y}...])? Ray casting estándar.
 * Borde incluido como "dentro" no está garantizado — para clic usamos tolerancia por arista aparte. */
export function pointInPolygon(px, py, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Vector unitario y normal de un segmento (para dibujar el quad de muro/viga). */
export function segmentBasis(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const ux = dx / len, uy = dy / len;
  return { len, ux, uy, nx: -uy, ny: ux, isVertical: Math.abs(dx) < 0.001, isHorizontal: Math.abs(dy) < 0.001 };
}
