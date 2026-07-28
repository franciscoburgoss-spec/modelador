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

/** CalculiX conserva sólo 20 caracteres útiles en nombres de sets.
 * Los nombres que ya caben se preservan. Para los demás se conserva un prefijo legible y se
 * agrega un hash FNV-1a determinista del nombre completo, sin renumerar el ID que lo originó. */
export function compactCalculixName(name, maxLength = 20) {
  const safe = String(name)
    .replace(/[^A-Za-z0-9_]/g, '')
    .toUpperCase();
  if (!safe) throw new Error('El nombre CalculiX no puede quedar vacío.');
  if (!Number.isInteger(maxLength) || maxLength < 10) {
    throw new Error(`Largo máximo CalculiX inválido: ${maxLength}.`);
  }
  if (safe.length <= maxLength) return safe;

  let hash = 0x811c9dc5;
  for (let index = 0; index < safe.length; index++) {
    hash ^= safe.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const token = (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7);
  return `${safe.slice(0, maxLength - token.length - 1)}_${token}`;
}

/** Nombre de set por rol e ID persistido. Los IDs que caben permanecen completos. */
export function calculixIdSetName(rolePrefix, persistentId) {
  const prefix = safeName(rolePrefix);
  const id = safeName(persistentId);
  if (!prefix || !id) throw new Error('El rol y el ID del set CalculiX son obligatorios.');
  return compactCalculixName(`${prefix}_${id}`);
}

/**
 * Propiedades GENERAL de un rectángulo con ancho b sobre el eje local 2 y alto h sobre el local 1.
 * J usa la aproximación de Saint-Venant gobernada en D-033, siempre con major >= minor.
 */
export function rectangularGeneralProperties(width, height) {
  const b = Number(width);
  const h = Number(height);
  if (!(b > 0) || !(h > 0)) {
    throw new Error(`Rectángulo CalculiX inválido: ${width} x ${height}.`);
  }
  const major = Math.max(b, h);
  const minor = Math.min(b, h);
  const ratio = minor / major;
  return {
    area: b * h,
    i11: h * (b ** 3) / 12,
    i22: b * (h ** 3) / 12,
    torsion: major * (minor ** 3)
      * (1 / 3 - 0.21 * ratio * (1 - (ratio ** 4) / 12))
  };
}

/** kgf -> N (unidades del .inp: mm, N, MPa). */
export const KGF_TO_N = 9.80665;
