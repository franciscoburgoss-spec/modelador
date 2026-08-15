# BUG-016-A-032 — SHA B2 incorrecto en handoff de nuevo chat

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante la verificación final de integridad de las autoridades congeladas de SPEC-016-A se comparó
el SHA declarado en el handoff para:

`src/core/structuralReferenceResolutionContext.js`

El handoff declara:

`1aeb8df01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`

La verificación READ-ONLY del repositorio produjo:

`1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`

## Diagnóstico confirmado

La comparación directa entre worktree y `HEAD` produjo exactamente el mismo SHA:

`1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`

Además:

- `git diff -- src/core/structuralReferenceResolutionContext.js` quedó vacío;
- `git status --short -- src/core/structuralReferenceResolutionContext.js` quedó vacío.

Por lo tanto, no existe modificación local del archivo B2. La divergencia corresponde al SHA
transcrito en el handoff y no a una alteración de la autoridad congelada del repositorio.

## Impacto

No corresponde modificar:

- `src/core/structuralReferenceResolutionContext.js`;
- sus tests;
- B1/B2/B3;
- SPEC-015-D/E;
- runtime neutral;
- `constructiveStructuralWorkspace`;
- store/UI.

BUG-016-A-022 no debe cerrarse hasta dejar saneada y evidenciada esta discrepancia documental.

## Resguardos

- no modificar producto para hacerlo coincidir con el SHA incorrecto;
- no modificar tests o fixtures;
- no realizar Git write;
- preservar como autoridad el contenido realmente versionado en `HEAD`;
- verificar, antes del cierre, que el SHA real también corresponde a `origin/main`.

## Criterio de cierre

Cerrar cuando una comprobación READ-ONLY demuestre que `HEAD`, `origin/main` y worktree contienen
exactamente el mismo archivo y SHA, y quede registrado que el valor del handoff era una
transcripción incorrecta.

## Evidencia de cierre

La comprobación READ-ONLY final produjo el mismo SHA-256 para las tres autoridades comparadas:

- worktree:
  `1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`;
- `HEAD`:
  `1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`;
- `origin/main`:
  `1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`.

Además:

- `HEAD`:
  `2a3235d6269059e74339c19c2cd4be947b2d6de9`;
- `origin/main`:
  `2a3235d6269059e74339c19c2cd4be947b2d6de9`;
- `git status --short -- src/core/structuralReferenceResolutionContext.js`
  quedó vacío.

Se confirma así que el SHA

`1aeb8df01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`

declarado en el handoff era una transcripción incorrecta y no evidencia de una modificación del
archivo B2.

No se modificó producto, tests, fixtures ni ninguna autoridad congelada.

BUG-016-A-032 se cierra como anomalía documental del handoff.
