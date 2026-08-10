# BUG-015-D-004 — Una aceptación se materializaba como superada inmediatamente

## Registro

- Detectado: 06-ago-2026 al reproducir `aceptar → recalcular → materializar review`.
- Severidad: alta.
- Estado: corregido, pendiente de validación local autoritativa.

## Reproducción

1. Generar una propuesta vigente.
2. Prepararla y aceptarla con confirmación explícita.
3. Recalcular las propuestas usando el modelo resultante.
4. Consultar `materializeStructuralProposalReviews()`.

Resultado defectuoso:

```text
reviewState = superseded
```

Aunque el `proposalId` y `proposalFingerprint` permanecían iguales y la intención aplicada coincidía
exactamente con la decisión aceptada.

## Causa

La materialización exigía que `sourceAggregateSha256` fuera idéntico para todas las disposiciones.
Aceptar modifica `structuralIntent`, que forma parte de ese agregado; por tanto una aceptación
correcta invalidaba su propia fuente de manera inevitable.

## Regla corregida

- `rejected` y `deferred`: siguen exigiendo fingerprint de propuesta y fuente agregada exactos.
- `accepted` y `modifiedAndAccepted`: exigen fingerprint de propuesta exacto y que el fingerprint de
  la intención vigente del objetivo coincida con `appliedIntentFingerprint`.
- Una modificación posterior del objetivo vuelve el review `superseded`.
- Cambios de intención no relacionados no invalidan una aceptación todavía efectiva.

La corrección no convierte el review en autoridad estructural ni relaja stale durante la
confirmación.

## Evidencia de regresión

`tests/structuralProposalReviews.test.mjs` demuestra que:

1. una aceptación efectiva permanece `accepted` después de recalcular;
2. un cambio de intención no relacionado no invalida esa aceptación;
3. una modificación posterior de la intención del objetivo la convierte en `superseded`;
4. rechazo y pendiente conservan la comparación estricta contra la fuente agregada.

La suite enfocada disponible pasó 45/45 pruebas después de la corrección.
