# MEJ-015-D-020 — Procedencia del vocabulario

## Estado

Implementado en REV8.

## Capas de autoridad

1. La SPEC define la semántica contractual del Modelador.
2. `structuralConceptGlossary.js` es el catálogo ejecutable de etiquetas/ayuda.
3. La UI consume el catálogo; no redefine significados.
4. Tokens heredados se mantienen por compatibilidad cuando ya forman parte del contrato.

Los nuevos términos `receives/delivers`, `facePositiveN/faceNegativeN`, `endLowS/endHighS` y `structuralRegion` son abstracciones del Modelador aprobadas en REV8. No se atribuyen falsamente a una norma externa.
