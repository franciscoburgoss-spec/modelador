// core/calculixCommon.js
// Helpers compartidos por los exportadores CalculiX (modelo general y cerchas). Viven aparte
// para que exportCalculix.js pueda importar exportCalculixTruss.js sin ciclo de imports.

/** Registro de nodos con deduplicación por mm redondeado — nudos compartidos reusan id. */
export function makeNodeRegistry() {
  const keyToId = new Map();
  const list = [];
  let nextId = 1;
  function getNode(x, y, z) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (keyToId.has(key)) return keyToId.get(key);
    const id = nextId++;
    keyToId.set(key, id);
    list.push({ id, x, y, z });
    return id;
  }
  return { getNode, list };
}

/** cm^4 -> mm^4, cm^2 -> mm^2 (tal cual vienen del catálogo Cintac). */
export const cm4ToMm4 = (v) => v * 10000;
export const cm2ToMm2 = (v) => v * 100;

/** Sufijo de ELSET/MATERIAL seguro (CalculiX no acepta espacios ni caracteres raros). */
export function safeName(str) {
  return String(str).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** kgf -> N (unidades del .inp: mm, N, MPa). */
export const KGF_TO_N = 9.80665;
