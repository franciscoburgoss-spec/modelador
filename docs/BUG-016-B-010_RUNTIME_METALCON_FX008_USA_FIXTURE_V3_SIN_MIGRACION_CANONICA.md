# BUG-016-B-010 — Runtime Metalcon usa FX-008 v3 sin migración canónica a v4

## Estado

CERRADO — 15-ago-2026.

## Contexto

Durante SPEC-016-B B2.3b se agregó el gate dinámico D-070 sobre FX-008.

El gate exige mantener el contrato congelado `modelVersion: 4`.

## Evidencia

El focal B2.3 produjo:

    tests 4
    pass 3
    fail 1

y B2.3b abortó antes de mutar legacy:

    AssertionError
    3 !== 4

La inspección confirmó que `buildFx008Rev8Short()` entrega
deliberadamente un fixture histórico `modelVersion: 3`.

El propio repositorio lo verifica en
`tests/constructiveSolutionScenarios.test.mjs`.

## Diagnóstico confirmado

`buildFxModel()` en el test de runtime Metalcon clona `fx.model`
y agrega `roofIntents`, pero no aplica la migración v3→v4.

Por ello B2.3a y B2.3b estaban ejecutando el caso FX-008 sobre v3.

`src/core/modelSchema.js` ya expone la transición canónica:

    migrateV3ToV4(model)

que:

- acepta v3 o v4;
- clona el modelo;
- cambia `modelVersion` a 4;
- crea `constructiveSolutions` vacío;
- falla cerrado ante colisión previa de `constructiveSolutions`.

Existe además evidencia previa de que conserva profundamente los
campos legacy de FX-008 sin reinterpretarlos.

## Causa

Defecto del helper de integración introducido en B2.3:
se utilizó directamente el fixture histórico v3 en vez de llevarlo
a la versión persistente vigente mediante la migración canónica.

No existe evidencia de una filtración D-070 en este punto.

## Corrección permitida

La corrección debe limitarse al test B2.3:

1. importar `migrateV3ToV4` desde `src/core/modelSchema.js`;
2. hacer que `buildFxModel()` retorne FX-008 migrado canónicamente a v4;
3. conservar intacto `buildFx008Rev8Short()`;
4. no asignar `modelVersion = 4` manualmente;
5. no eliminar ni transformar datos Metalcon legacy;
6. no modificar código productivo;
7. volver a ejecutar B2.3b antes de concluir sobre D-070.

## Criterio de cierre

- FX-008 usado por B2.3 queda en `modelVersion: 4` mediante migración canónica;
- B2.3a conserva sus resultados;
- B2.3b alcanza realmente las mutaciones D-070;
- focal B2.3 queda verde o revela un defecto D-070 distinto;
- no se modifica producto ni el fixture histórico.

## Cierre verificado

La corrección quedó limitada al helper de integración de:

    tests/constructiveSpec016BMetalconRuntime.test.mjs

`buildFxModel()` usa ahora la migración canónica existente:

    migrateV3ToV4(model)

No se asignó `modelVersion` manualmente y se conservaron intactos:

- `src/core/modelSchema.js`;
- `tests/helpers/spec015dRev8.mjs`;
- el fixture histórico FX-008 v3;
- los datos Metalcon legacy.

Evidencia ejecutada:

- focal B2.3: 4/4 PASS;
- regresión B1 + B2.1 + B2.2 + B2.3: 26/26 PASS;
- `git diff --check`: PASS;
- FX-008 usado por B2.3: `modelVersion: 4`;
- inversión dinámica D-070: PASS;
- `modelSchema.js` y `spec015dRev8.mjs`: sin modificaciones.

La inversión D-070 comprobó que mutar datos legacy reales de FX-008
no altera el `adapterInput`, su hash, la geometría efectiva ni la
solución efímera Metalcon pre-B3.
