# BUG-016-A-028 — Gate de integración runtime neutral lee campos B3.2 incorrectos

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

El probe de integración:

runtime neutral → B2 → B3.1 → B3.2

alcanzó correctamente la generación neutral y mostró:

- escenario A: `state=partial`, resolved=1, partiallyResolved=0, unresolved=1;
- escenario B: `state=none`, resolved=0, partiallyResolved=0, unresolved=2;
- availability `available` en ambos;
- `model.library` ignorado.

Sin embargo, el gate intentó validar:

`A.coverage.coverage`

cuando `deriveConstructiveCoverage()` devolvió el estado bajo:

`A.coverage.state`.

El probe también intentó proyectar:

- `solution.verification`;
- `requirementResolution.requirementRef`;

pero esos campos fueron `undefined` y por ello no aparecieron en el JSON serializado.

## Impacto

El gate terminó con:

`FAIL - cobertura A esperada partial, obtenida undefined`

aunque la propia salida había mostrado previamente:

`"state": "partial"`.

No existe evidencia de falla del producto.

El gate tampoco alcanzó a validar todavía la forma contractual exacta de verificación ni la identidad
de cada `requirementResolution`.

## Correctiva

Auditar las formas exactas congeladas de B3.2 directamente en:

- `src/core/constructiveSolutionGeneration.js`;
- `tests/constructiveSolutionGeneration.test.mjs`.

Después repetir el mismo probe usando exclusivamente los nombres contractuales reales.

## Resguardos

- no modificar B3.2;
- no modificar sus tests congelados;
- no modificar `constructiveNeutralRuntime.js`;
- no cambiar expectativas para hacer pasar el probe;
- no cerrar BUG-016-A-023 todavía;
- no tocar store/UI;
- no realizar Git write.

## Criterio de cierre

Cerrar cuando el gate corregido:

- use la forma contractual real de `deriveConstructiveCoverage`;
- use la forma contractual real de verification;
- use la identidad contractual real de `requirementResolutions`;
- confirme A=`partial`, B=`none`;
- confirme ambos `notVerified`;
- confirme availability=`available`;
- confirme `model.library` excluido;
- mantenga B3 byte-idéntico.

## Evidencia de cierre

La forma contractual de B3.2 se auditó directamente contra producto y tests congelados:

- coverage: `deriveConstructiveCoverage(solution).state`;
- verification: `solution.verificationState`;
- identidad de resolución: `requirementResolutions[].requirementId`.

El gate corregido runtime neutral → B2 → B3.1 → B3.2 obtuvo:

- escenario A: availability=`available`;
- escenario A: coverage=`partial`, conteos 1/0/1;
- escenario A: verificationState=`notVerified`;
- escenario B: availability=`available`;
- escenario B: coverage=`none`, conteos 0/0/2;
- escenario B: verificationState=`notVerified`;
- ambos outputs particionaron exactamente los dos requirements del scope;
- `model.library` quedó excluido;
- identidad neutral productiva:
  `404ca9e7ed30b522dfddb211b98099bb8a739119957071d1642f41f004d2fc2f`;
- B3.1/B3.2/B3.3 permanecieron byte-idénticos.

La falla original pertenecía únicamente al probe, que utilizó nombres de campos incorrectos.

No se modificó B3.
No se realizó Git write.
