// lab/roofPlane/core/polygonClip.js
// ★ B4.5 — Polígono de faldón (contorno libre de N vértices, esquinas de eje).
//
// El faldón deja de inferir su extensión por colinealidad global (que tragaba fachadas) y pasa a
// declararse como un POLÍGONO cerrado. Fran dibuja las esquinas de eje; el solver resuelve la
// techumbre SOLO dentro de ese contorno. Esto resuelve la frontera ficticia de la L: la cadena de
// cerchas se genera una vez sobre el eje de corrida a paso constante, y para cada posición la LUZ
// sale de intersectar la línea de esa cercha (perpendicular a la canaleta) con el borde del
// polígono. El escalón del borde alto cambia la luz sin alterar el paso.
//
// Convención de ejes del faldón:
//   - runAxis: eje sobre el que se reparten las cerchas (paralelo a la canaleta).
//   - La canaleta es el/los lado(s) del polígono sobre la coordenada perpendicular MÍNIMA o MÁXIMA
//     (el lado bajo del agua). spanDir apunta de la canaleta hacia el apoyo alto.
//
// El polígono se da como lista de vértices {x, y} en orden (horario o antihorario, da igual).
// Puro; sin canvas ni store.

const EPS = 0.5;

/** Bounding box del polígono. */
export function polygonBounds(vertices) {
  const xs = vertices.map(v => v.x), ys = vertices.map(v => v.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Intervalos [lo,hi] donde una recta perpendicular al eje de corrida, en la posición `pos` del
 * eje de corrida, está DENTRO del polígono. Devuelve los cruces del rayo con los lados del
 * polígono, emparejados. En un polígono simple (sin auto-intersección) y una recta, los cruces
 * vienen en número par y definen los tramos interior/exterior alternados.
 *
 * @param vertices  polígono cerrado (no hace falta repetir el primer vértice al final)
 * @param runAxis   'x' | 'y' — la cercha corre PERPENDICULAR a este eje
 * @param pos       coordenada sobre runAxis donde está la cercha
 * @returns Array<[lo, hi]> intervalos de la coordenada perpendicular dentro del polígono
 */
export function spanIntervalsAt(vertices, runAxis, pos) {
  const perpAxis = runAxis === 'x' ? 'y' : 'x';
  const crossings = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i], b = vertices[(i + 1) % n];
    const a1 = a[runAxis], b1 = b[runAxis];   // coord sobre el eje de corrida
    const a2 = a[perpAxis], b2 = b[perpAxis];  // coord perpendicular
    // ¿el lado cruza la línea runAxis = pos? (medio-abierto para no contar vértices dos veces)
    const lo1 = Math.min(a1, b1), hi1 = Math.max(a1, b1);
    if (pos < lo1 - EPS || pos > hi1 + EPS) continue;
    if (Math.abs(b1 - a1) < EPS) {
      // lado paralelo al rayo (corre en perpAxis a runAxis=const): si coincide con pos, sus dos
      // extremos son bordes del interior — se tratan agregando ambos como cruce.
      if (Math.abs(a1 - pos) < EPS) { crossings.push(a2); crossings.push(b2); }
      continue;
    }
    const t = (pos - a1) / (b1 - a1);
    if (t < -EPS || t > 1 + EPS) continue;
    crossings.push(a2 + t * (b2 - a2));
  }
  crossings.sort((x, y) => x - y);
  // emparejar en intervalos [lo,hi]; deduplicar cruces casi iguales (vértices tocados por 2 lados)
  const uniq = [];
  for (const c of crossings) {
    if (!uniq.length || Math.abs(c - uniq[uniq.length - 1]) > EPS) uniq.push(c);
  }
  const intervals = [];
  for (let i = 0; i + 1 < uniq.length; i += 2) intervals.push([uniq[i], uniq[i + 1]]);
  return intervals;
}

/**
 * Recorta un intervalo [from,to] sobre el eje de corrida al rango donde el polígono existe.
 * Usado para acotar la corrida de la cadena a la extensión real del faldón sobre runAxis.
 */
export function runExtentOf(vertices, runAxis) {
  const b = polygonBounds(vertices);
  return runAxis === 'x' ? [b.minX, b.maxX] : [b.minY, b.maxY];
}

/**
 * Longitud de solape entre un muro (a coordenada perpendicular `perp`, extendido sobre el eje de
 * corrida en [runLo,runHi]) y el BORDE del polígono que corre a esa misma perpendicular. Valida
 * que un candidato a apoyo alto coincide con un lado real del contorno, no solo con su bounding
 * box: un muro de un faldón vecino que asome dentro del bbox pero cuyo borde no esté a esa perp
 * devuelve 0.
 */
export function edgeOverlapOnPerp(vertices, runAxis, perp, runLo, runHi, tol = 2) {
  const perpAxis = runAxis === 'x' ? 'y' : 'x';
  let overlap = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i], b = vertices[(i + 1) % n];
    if (Math.abs(a[perpAxis] - perp) > tol || Math.abs(b[perpAxis] - perp) > tol) continue;
    const lo = Math.min(a[runAxis], b[runAxis]), hi = Math.max(a[runAxis], b[runAxis]);
    const ov = Math.min(hi, runHi) - Math.max(lo, runLo);
    if (ov > 0) overlap += ov;
  }
  return overlap;
}

/**
 * ¿La posición `pos` sobre el eje de corrida está dentro del polígono (tiene al menos un intervalo
 * de luz)? Y si sí, ¿cuál es la luz total desde la canaleta hasta el borde alto ahí?
 *
 * @param vertices
 * @param runAxis
 * @param pos
 * @param canalPerp  coordenada perpendicular de la canaleta (lado bajo)
 * @param spanDir    +1 o -1: sentido de la canaleta hacia el alto
 * @returns { inside: boolean, span: number|null, highPerp: number|null }
 *          span = distancia de la canaleta al borde más lejano del polígono en esa posición.
 */
export function spanAt(vertices, runAxis, pos, canalPerp, spanDir) {
  const intervals = spanIntervalsAt(vertices, runAxis, pos);
  if (!intervals.length) return { inside: false, span: null, highPerp: null };
  // el borde alto es el extremo del polígono en el sentido spanDir desde la canaleta.
  // tomamos el punto más lejano de la canaleta entre todos los intervalos, en el sentido correcto.
  let highPerp = null;
  for (const [lo, hi] of intervals) {
    for (const edge of [lo, hi]) {
      const d = spanDir * (edge - canalPerp);
      if (d > EPS && (highPerp == null || spanDir * (edge - highPerp) > 0)) highPerp = edge;
    }
  }
  if (highPerp == null) return { inside: false, span: null, highPerp: null };
  return { inside: true, span: Math.abs(highPerp - canalPerp), highPerp };
}
