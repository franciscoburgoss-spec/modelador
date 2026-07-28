// core/roofPlaneValidation.js (B4.7.5)
// Findings del faldón integrados al reporte de coherencia — NO bloquea, solo reporta.
// Mismo shape que core/modelValidation.js y trussLayout.validateRoofSystems:
// {severity, category, message, roofPlaneIds} (roofPlaneIds en vez de elementIds/roofSystemIds,
// para que el modal navegue con selectRoofPlane).
import { resolveRoofPlane } from './roofPlane.js';
import { buildParamsMap } from './projectParams.js';
import { buildElementsById } from './elementReferences.js';
import { createFinding } from './domainFindings.js';

function planeFinding(input, plane) {
  return createFinding({
    ...input,
    message: `${planeLabel(plane)}: ${input.message}`,
    roofPlaneIds: [plane.id]
  });
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
      results.push(planeFinding({
        severity: 'error',
        category: 'plane',
        message: `error al resolver — ${err.message}`
      }, plane));
      continue;
    }
    for (const f of resolved?.findings || []) {
      results.push(planeFinding(f, plane));
    }
  }
  return results;
}
