// lab/roofPlane/core/trussChain.js
// ★ B4.2 — Cadena global de posiciones de cerchas de un faldón.
//
// Problema que resuelve: hoy cada tramo reparte sus cerchas con uniformPositions() sobre SU
// propio rango. En una L eso da vanos de 1083, 799, 1154… porque cada tramo se modula a su largo.
// En obra la modulación es una sola cadena sobre TODA la corrida del faldón, independiente de
// dónde cambie la luz. El muro del quiebre deja de ser un borde y pasa a ser apoyo intermedio:
// la cadena pasa por encima sin partirse, y donde la cercha larga apoya en el muro, su cuerda
// superior se atornilla continua sobre él (sin voladizo, sin regla del plomo).
//
// Decisiones confirmadas con Fran:
//   - Paso fijo (default 1200mm) desde un ORIGEN persistido: 'start' (default) o 'end'. El origen
//     decide en qué extremo queda el vano de remate; la cadena en sí no cambia.
//   - El origen es la CARA INTERIOR del frontón, no su eje (evita la primera cercha embebida — el
//     bug de la sesión 25). Si el extremo es alero libre, es el borde del rango sin más.
//   - Vano de remate corto: si el último vano < shortSpanThreshold (mm), se ELIMINA la penúltima
//     cercha y el remanente se reparte en los últimos vanos, tomando el MÍNIMO número de vanos que
//     deje a todos ≥ threshold. Nunca se excede `spacing` hacia arriba (eso sería estructural).
//   - Cercha que cae dentro del espesor de un muro intermedio: se desplaza a la cara más cercana
//     (corrimiento ≤ medio espesor) y se marca. No rompe la cadena de forma perceptible.
//
// La cercha de los DOS extremos (las caras de frontón) siempre se conserva: son el borde del agua.

const EPS = 0.5;

/**
 * Genera la cadena de posiciones (offsets sobre el eje de corrida) de un faldón.
 *
 * @param opts.from             cara interior del frontón inicial (mm) — origen si origin='start'
 * @param opts.to               cara interior del frontón final (mm) — origen si origin='end'
 * @param opts.spacing          paso entre cerchas (mm, default 1200)
 * @param opts.origin           'start' | 'end' (default 'start')
 * @param opts.shortSpanThreshold  vano mínimo constructible (mm, default 500)
 * @param opts.intermediateWalls   [{oMin, oMax, wallId}] muros que cruzan la corrida (para reubicar
 *                                  cerchas embebidas a su cara). Ordenar no es necesario.
 * @returns {{
 *   positions: Array<{offset, kind: 'full'|'shifted', shiftedFromWallId?}>,
 *   spans: number[],          // vanos consecutivos resultantes
 *   collapsedShort: boolean,  // true si se colapsó un remate corto
 *   warnings: string[]
 * }}
 */
export function buildTrussChain({
  from, to, spacing = 1200, origin = 'start', shortSpanThreshold = 500, intermediateWalls = []
} = {}) {
  const warnings = [];
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const total = hi - lo;
  if (!(total > EPS)) return { positions: [], spans: [], collapsedShort: false, warnings: ['corrida de faldón inválida (largo ≤ 0)'] };
  if (!(spacing > EPS)) return { positions: [], spans: [], collapsedShort: false, warnings: ['paso de cerchas inválido'] };

  // --- 1. cadena base a paso fijo desde el origen -------------------------------------------
  // Se cuenta desde el origen; el sobrante queda en el extremo opuesto. Trabajamos siempre en
  // coordenadas [lo..hi] crecientes y volteamos al final si el origen es 'end'.
  const fromEnd = origin === 'end';
  const n = Math.floor(total / spacing + 1e-9);      // vanos completos de paso `spacing`
  const remainder = total - n * spacing;             // sobrante (0..spacing)

  // offsets crecientes: origen en `lo`, cerchas cada `spacing`, y el borde final `hi` siempre.
  let offsets = [];
  for (let i = 0; i <= n; i++) offsets.push(lo + i * spacing);
  if (remainder > EPS) offsets.push(hi); // remate: el borde final, a `remainder` de la última

  // si el origen es el extremo final, la cadena se cuenta desde `hi` hacia `lo`: espejamos.
  if (fromEnd) offsets = offsets.map(o => lo + (hi - o)).sort((a, b) => a - b);

  // --- 2. colapso del vano de remate corto --------------------------------------------------
  let collapsedShort = false;
  const spansOf = (arr) => arr.slice(1).map((o, i) => o - arr[i]);
  {
    let spans = spansOf(offsets);
    const shortIdx = spans.findIndex(s => s < shortSpanThreshold - EPS);
    if (shortIdx !== -1 && offsets.length >= 3) {
      // el vano corto está entre offsets[shortIdx] y offsets[shortIdx+1]. Fusionamos ese vano con
      // el adyacente (el que NO toca un borde) eliminando la cercha interior compartida, y
      // repartimos el largo combinado en el mínimo nº de vanos ≥ threshold y ≤ spacing.
      const atStart = shortIdx === 0;
      const atEnd = shortIdx === spans.length - 1;
      // cercha a eliminar: la interior del par de vanos (nunca un borde).
      // en un remate al final, el vano corto es el último: fusionamos con el penúltimo eliminando
      // la penúltima cercha (offsets[shortIdx]).
      let a, b, killIdx;
      if (atEnd) { a = offsets[shortIdx - 1]; b = offsets[shortIdx + 1]; killIdx = shortIdx; }
      else if (atStart) { a = offsets[0]; b = offsets[2]; killIdx = 1; }
      else { a = offsets[shortIdx]; b = offsets[shortIdx + 2]; killIdx = shortIdx + 1; }
      const combined = b - a;
      const k = Math.max(2, Math.ceil(combined / spacing - 1e-9)); // nº de vanos ≥2 para repartir
      const step = combined / k;
      // reconstruir: quitar los interiores entre a y b, insertar k-1 cerchas equiespaciadas
      const before = offsets.filter(o => o < a - EPS);
      const after = offsets.filter(o => o > b + EPS);
      const mid = [a];
      for (let i = 1; i < k; i++) mid.push(a + i * step);
      mid.push(b);
      offsets = [...before, ...mid, ...after].sort((x, y) => x - y);
      // dedup por si `a`/`b` coinciden con before/after
      offsets = offsets.filter((o, i) => i === 0 || o - offsets[i - 1] > EPS);
      collapsedShort = true;
      void killIdx;
      warnings.push(`vano de remate ${Math.round(spans[shortIdx])}mm < ${shortSpanThreshold}mm — se eliminó una cercha y se repartió en ${k} vanos de ${Math.round(step)}mm`);
    }
  }

  // --- 3. reubicar cerchas embebidas en muros intermedios -----------------------------------
  const positions = offsets.map(offset => {
    const inWall = intermediateWalls.find(w => offset > w.oMin + EPS && offset < w.oMax - EPS);
    if (!inWall) return { offset, kind: 'full' };
    // mover a la cara más cercana
    const face = (offset - inWall.oMin) < (inWall.oMax - offset) ? inWall.oMin : inWall.oMax;
    return { offset: face, kind: 'shifted', shiftedFromWallId: inWall.wallId };
  });
  // tras mover, dos cerchas pueden coincidir en la misma cara: dedup conservando la 'full' si la hay
  const dedup = [];
  for (const p of positions.sort((a, b) => a.offset - b.offset)) {
    const last = dedup[dedup.length - 1];
    if (last && Math.abs(last.offset - p.offset) < EPS) {
      if (last.kind === 'shifted' && p.kind === 'full') dedup[dedup.length - 1] = p;
      continue;
    }
    dedup.push(p);
  }
  for (const p of dedup) {
    if (p.kind === 'shifted') warnings.push(`cercha reubicada a la cara del muro ${p.shiftedFromWallId} (offset ${Math.round(p.offset)}mm) para no quedar embebida`);
  }

  return { positions: dedup, spans: spansOf(dedup.map(p => p.offset)), collapsedShort, warnings };
}
