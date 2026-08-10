# MEJ-015-D-017 — Diccionario semántico completo

## Estado

Implementado en REV8.

## Decisión

`structuralConceptGlossary.js` conserva los conceptos REV7 y añade categorías explícitas para:

- ubicación canónica de interfaz (`facePositiveN`, `faceNegativeN`, `endLowS`, `endHighS`);
- rol de interacción (`receives`, `delivers`);
- familia de acción (`gravity`, `lateral`, `undetermined`);
- función de relación (`support`, `loadTransfer`, `collectorAction`, `diaphragmAction`, `stabilization`);
- `structuralRegion` embebida.

Cada entrada separa significado, declaración, efecto, no-significado y procedencia cuando corresponde. La UI consume el mismo catálogo.
