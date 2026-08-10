# BUG-015-D-025 — Sentido visual de relación estructural invertido

## Estado

Corregido en Correctiva 11 de SPEC-015-D REV8. Pendiente de validación focal en macOS y validación visual real.

## Detección

Durante la validación visual real del caso FX-008 C/6→7, después de persistir una relación `loadTransfer · gravity` con:

- `receives`: Cara −N y Cara +N del frontón C/6→7;
- `delivers`: Extremo S mínimo (eje 6) y Extremo S máximo (eje 7);

el workspace **Propuestas y caminos de carga candidatos → Interfaces** mostraba el subtítulo en el sentido contrario:

`Extremos → Caras`.

La relación persistida y el motor de caminos candidatos conservaban la semántica correcta; el defecto estaba limitado a la presentación humana de la relación.

## Causa

`relationVisual()` en `src/core/structuralProposalVisualPresentation.js` construía siempre la flecha visible como `delivers → receives`. Ese sentido es correcto para relaciones de tipo `support`, pero no para `loadTransfer` ni `collectorAction`, que el motor consume como `receives → delivers`.

## Corrección

La presentación adopta la misma regla direccional que `candidateLoadPaths`:

- `loadTransfer` y `collectorAction`: `receives → delivers`;
- las demás funciones, incluido `support`: `delivers → receives`.

No se modifica el contrato persistente, IDs, fingerprints de interfaz, geometría, relaciones, candidate paths, historial, trace ni review.

## Regresión

Se agrega una prueba sobre FX-008 que verifica simultáneamente:

1. `loadTransfer` C/6→7 se presenta `Cara −N + Cara +N → Extremo 6 + Extremo 7`;
2. las dos relaciones `support` de cubierta conservan `Borde de cubierta → Cara del frontón`;
3. no se cambia la dirección ejecutable del motor, sólo su descriptor visual.
