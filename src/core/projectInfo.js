// core/projectInfo.js
// ★ Sesión 22 — Datos de proyecto que alimentan el cajetín ISO 7200 de las láminas DXF.
// Vive en `model.projectInfo` (se persiste y se migra como el resto del modelo). Nada de esto se
// hardcodea en el exportador: lo que el usuario no llena sale como "-" en la lámina.
import { DEFAULT_FORMAT } from './sheetFormats.js';

export function createProjectInfo() {
  return {
    mandante: '',
    obra: '',
    ubicacion: '',
    proyectoNumero: '',
    laminaPrefijo: 'E',      // prefijo del N° de lámina: E-TAB-01, E-FUN-01...
    dibujo: '',
    reviso: '',
    aprobo: '',
    fecha: '',               // vacío = fecha de exportación
    revisiones: [],          // [{ rev, fecha, descripcion, autor }]
    notas: {},               // { framing|osb|truss|foundations: [string] } — reemplaza las notas default
    formato: DEFAULT_FORMAT, // formato por defecto al exportar láminas
    escala: null             // null = escala por defecto del formato (1:50 en A1, 1:100 en A3)
  };
}

/** Completa los campos que falten (modelos guardados antes de la sesión 22) sin pisar los que sí
 * están. No inventa datos: lo ausente queda vacío. */
export function normalizeProjectInfo(projectInfo) {
  const base = createProjectInfo();
  const merged = { ...base, ...(projectInfo || {}) };
  merged.revisiones = Array.isArray(merged.revisiones) ? merged.revisiones : [];
  merged.notas = merged.notas && typeof merged.notas === 'object' ? merged.notas : {};
  return merged;
}

/** Siguiente letra de revisión: A, B, C... (convención de plano de obra chilena). */
export function nextRevisionLetter(revisiones = []) {
  const letters = revisiones.map(r => String(r.rev || '').trim().toUpperCase()).filter(r => /^[A-Z]$/.test(r));
  if (!letters.length) return 'A';
  const max = letters.reduce((a, b) => (a > b ? a : b));
  return max === 'Z' ? 'Z' : String.fromCharCode(max.charCodeAt(0) + 1);
}
