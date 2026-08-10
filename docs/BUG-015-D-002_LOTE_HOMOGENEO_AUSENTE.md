# BUG-015-D-002 — Flujo de lote homogéneo ausente en la primera integración

## Registro

- Detectado durante la auditoría de implementación de Fase B, antes del empaquetado.
- Severidad: alta dentro del alcance de SPEC-015-D.
- Estado: corregido, pendiente de validación local autoritativa.

## Reproducción

1. Abrir `Estructura → Propuestas y caminos candidatos…`.
2. Revisar la lista de propuestas.
3. Intentar seleccionar dos propuestas equivalentes para aceptar, rechazar o diferir en una sola
   transacción.
4. La primera integración sólo exponía decisiones individuales.

## Incumplimiento

La sección 11 de SPEC-015-D exige que un lote homogéneo produzca:

- un paso de historial;
- un único evento del review log con N decisiones;
- un único trace `batchSet` si existen mutaciones efectivas;
- cero mutaciones parciales ante stale o incompatibilidad.

## Corrección aplicada

- Se añadió `applyStructuralProposalDecisionBatch()` con prevalidación completa y atómica.
- Sólo se acepta un lote con la misma disposición y, para aceptación, objetivos de elemento con el
  mismo patch de intención.
- La mutación usa `setElementIntentsBatch()` y el review log recibe un evento con N decisiones.
- El store envuelve el resultado completo en un solo `withHistory`.
- La UI incorpora selección múltiple explícita y acciones de lote homogéneo.
- Se añadieron pruebas puras, de store, componente, stale, reversión y determinismo.

## Límites

La aceptación masiva de cubiertas queda prohibida porque no existe un mutador canónico
`setRoofIntentsBatch`; rechazar o diferir puede revisar propuestas sin mutar intención. No se crea
un bucle que aplique mutadores individuales ni varios eventos de trace.
