// core/roofPlaneValidation.js (B4.7.5)
// Findings del faldón integrados al reporte de coherencia — NO bloquea, solo reporta.
// Mismo shape que core/modelValidation.js y trussLayout.validateRoofSystems:
// {severity, category, message, roofPlaneIds} (roofPlaneIds en vez de elementIds/roofSystemIds,
// para que el modal navegue con selectRoofPlane).
import { resolveRoofPlane } from './roofPlane.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';

function planeFinding(severity, category, message, roofPlaneIds) {
  return { severity, category, message, roofPlaneIds };
}

/** Etiqueta legible del faldón: nombre si lo trae, si no su id. */
function planeLabel(plane) {
  return plane.name ? `faldón "${plane.name}"` : `faldón ${plane.id}`;
}

/**
 * Valida todos los faldones del modelo resolviéndolos y recolectando sus findings.
 * `resolveFn` inyectable para test; por defecto usa resolveRoofPlane real.
 * Nunca lanza: un faldón que revienta al resolver se reporta como error en vez de romper el reporte.
 */
export function validateRoofPlanes(model, resolveFn = resolveRoofPlane) {
  const results = [];
  const planes = model.roofPlanes || [];
  if (!planes.length) return results;

  const paramsMap = buildParamsMap(model.projectParams || []);
  const elementsById = buildElementsById(model.elements || []);
  const library = model.library || null;

  for (const plane of planes) {
    let resolved;
    try {
      resolved = resolveFn({ model, plane, paramsMap, elementsById, library });
    } catch (err) {
      // por qué: un findings mal formado no debe tumbar la verificación completa del modelo
      results.push(planeFinding('error', 'plane', `${planeLabel(plane)}: error al resolver — ${err.message}`, [plane.id]));
      continue;
    }
    for (const f of resolved?.findings || []) {
      results.push(planeFinding(
        f.severity,
        f.category,
        `${planeLabel(plane)}: ${f.message}`,
        [plane.id]
      ));
    }
  }
  return results;
}
