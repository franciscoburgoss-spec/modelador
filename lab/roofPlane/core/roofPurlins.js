// lab/roofPlane/core/roofPurlins.js
// ★ B4.3 — Costaneras de un faldón.
//
// Problema que resuelve: hoy las costaneras se reparten con uniformPositions() DENTRO de cada
// cercha, así que el paso se acomoda a la luz de cada tramo. En una L eso da costaneras en
// posiciones distintas por brazo (200/649/1099 vs 200/766/1333/1899) que no coinciden en el
// quiebre -> corte y desfase. En obra la modulación es una sola, tomando la CANALETA como línea
// base y subiendo por el faldón a paso fijo, continua a través de los quiebres.
//
// Decisiones confirmadas con Fran:
//   - Referencia = canaleta (borde bajo del faldón). Las costaneras se numeran s = k·paso desde
//     ahí, medidas en distancia INCLINADA sobre el plano de techo (como se instalan).
//   - Una costanera es una LÍNEA continua paralela a la canaleta, a lo largo de toda la corrida
//     del faldón. Se recorta al contorno real del agua (en una L cada costanera cubre solo el
//     rango de corrida donde el faldón llega hasta esa distancia de la canaleta).
//   - Traslapo SOBRE cercha: al trocear por largo comercial, los cortes caen sobre una cercha y
//     se solapan `overlap` mm. Nunca un corte al aire entre cerchas.
//   - Perfil y paso vienen de la plantilla de cercha (librería) — sección única del proyecto.
//
// Este módulo trabaja en coordenadas de faldón: `run` = eje de corrida (donde se reparten las
// cerchas), `s` = distancia inclinada desde la canaleta (donde se reparten las costaneras). La
// conversión a mundo 3D es del consumidor (build3d), no de aquí.

const EPS = 0.5;

/** Reparto a paso fijo desde 0: 0, paso, 2·paso… hasta `maxS`, más el remate en maxS si sobra. */
function purlinStations(maxS, spacing, startOffset = 0) {
  if (!(maxS > EPS) || !(spacing > EPS)) return [];
  const out = [];
  let s = startOffset;
  while (s < maxS - EPS) { out.push(s); s += spacing; }
  out.push(maxS); // remate: costanera de cumbrera, siempre en el borde alto
  return out;
}

/**
 * Costaneras de un faldón, moduladas desde la canaleta.
 *
 * El faldón se describe por TRAMOS (uno por luz distinta): cada tramo aporta su rango de corrida
 * [runFrom,runTo] y su luz inclinada `inclSpan`. Las costaneras se generan al MÁXIMO inclSpan del
 * faldón (la cumbrera más lejana) y cada una se recorta a los tramos que llegan hasta esa `s`.
 *
 * @param opts.segments   [{runFrom, runTo, inclSpan}] tramos del faldón sobre el eje de corrida.
 *                        inclSpan = luz inclinada (mm) desde la canaleta hasta el frontón alto de
 *                        ese tramo. runFrom<runTo.
 * @param opts.spacing    paso entre costaneras sobre el plano inclinado (mm)
 * @param opts.startOffset  primera costanera a esta distancia de la canaleta (mm, default 200 —
 *                          el arranque típico sobre el rebaje de canaleta)
 * @param opts.commercialLength  largo comercial máximo de la costanera (mm, 0 = sin trocear)
 * @param opts.overlap    traslapo sobre cercha al empalmar (mm)
 * @param opts.trussOffsets  posiciones de cerchas (para que los empalmes caigan sobre una cercha)
 * @returns {{
 *   purlins: Array<{ s, pieces: Array<{runFrom, runTo, spliceAtTruss: boolean}> }>,
 *   warnings: string[]
 * }}
 */
export function buildRoofPurlins({
  segments = [], spacing, startOffset = 200, commercialLength = 0, overlap = 0, trussOffsets = []
} = {}) {
  const warnings = [];
  if (!segments.length) return { purlins: [], warnings: ['faldón sin tramos'] };
  if (!(spacing > EPS)) return { purlins: [], warnings: ['paso de costanera inválido'] };

  const maxIncl = Math.max(...segments.map(s => s.inclSpan));
  const runLo = Math.min(...segments.map(s => s.runFrom));
  const runHi = Math.max(...segments.map(s => s.runTo));

  const stations = purlinStations(maxIncl, spacing, startOffset);
  const purlins = [];

  for (const s of stations) {
    // rango de corrida donde esta costanera existe = unión de los tramos cuyo inclSpan ≥ s.
    // (un tramo de luz menor no llega hasta la cumbrera del tramo mayor: ahí no hay costanera.)
    const covered = mergeRuns(
      segments.filter(seg => seg.inclSpan >= s - EPS).map(seg => [seg.runFrom, seg.runTo])
    );
    for (const [rf, rt] of covered) {
      const pieces = splitIntoPieces(rf, rt, commercialLength, overlap, trussOffsets, warnings, s);
      purlins.push({ s, pieces });
    }
  }

  void runLo; void runHi;
  return { purlins, warnings };
}

/** Une intervalos [a,b] contiguos/solapados en una lista mínima de rangos. */
function mergeRuns(ranges) {
  if (!ranges.length) return [];
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
  const out = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1] + EPS) last[1] = Math.max(last[1], sorted[i][1]);
    else out.push(sorted[i].slice());
  }
  return out;
}

/** Trocea una costanera [rf,rt] en piezas de largo ≤ commercialLength, empalmando SOBRE la cercha
 * más cercana al corte teórico y solapando `overlap`. Si no hay cerchas o no se trocea, una pieza. */
function splitIntoPieces(rf, rt, commercialLength, overlap, trussOffsets, warnings, s) {
  const len = rt - rf;
  if (!(commercialLength > EPS) || len <= commercialLength + EPS) {
    return [{ runFrom: rf, runTo: rt, spliceAtTruss: false }];
  }
  const pieces = [];
  let start = rf;
  const trusses = trussOffsets.filter(o => o > rf + EPS && o < rt - EPS).sort((a, b) => a - b);
  while (rt - start > commercialLength + EPS) {
    const target = start + commercialLength - overlap; // dónde debería terminar la pieza útil
    // cercha más cercana al target para que el empalme caiga sobre ella
    const splice = nearest(trusses, target);
    if (splice == null) {
      warnings.push(`costanera s=${Math.round(s)}mm: sin cercha para empalmar cerca de ${Math.round(target)}mm — corte al aire`);
      pieces.push({ runFrom: start, runTo: rt, spliceAtTruss: false });
      return pieces;
    }
    pieces.push({ runFrom: start, runTo: splice + overlap, spliceAtTruss: true });
    start = splice; // la siguiente arranca en la misma cercha (traslapo)
  }
  pieces.push({ runFrom: start, runTo: rt, spliceAtTruss: false });
  return pieces;
}

function nearest(arr, target) {
  if (!arr.length) return null;
  return arr.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best));
}
