# BUG-015-E-007 — los cuatro caminos gravitacionales no eran inspeccionables uno por uno

## Síntoma observado

B3 auditaba correctamente cuatro caminos `completeCandidate/notVerified`, pero la interfaz visual no permitía recorrer G1–G4 y leer su secuencia origen → transferencia local → receptor → fundación candidata.

## Regla corregida

B3.1 incorpora un panel G1–G4 y botones de foco independientes. Cada camino conserva sus cuatro aristas reales, descriptores humanos de origen/receptores/fundación, `candidateState`, `verificationState` y referencias técnicas auditables.

## Invariante

La visualización no convierte un camino candidato en verificación. `supportedByFoundation` sigue siendo `candidateSupportEvidence` y cada camino permanece `notVerified`.
