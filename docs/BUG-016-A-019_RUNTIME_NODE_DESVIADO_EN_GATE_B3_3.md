# BUG-016-A-019 — Runtime Node desviado en gate B3.3

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

El primer RED test-first de B3.3 produjo correctamente `ERR_MODULE_NOT_FOUND` porque
`src/core/constructiveGenerationReceipt.js` todavía no existe.

Sin embargo, la propia salida del proceso mostró:

`Node.js v20.20.2`

El proyecto fija Node 22 y las fases previas de SPEC-016-A se validaron bajo Node 22.23.2.

## Impacto

La ausencia del módulo quedó demostrada, pero esa ejecución no se considera evidencia oficial
del gate B3.3 porque utilizó un runtime distinto del contractual.

No se detectó una falla de producto.

## Correctiva

Restaurar Node 22 mediante el entorno del proyecto y repetir el mismo corpus B3.3 sin modificarlo.

## Resguardos

- no modificar el corpus B3.3;
- no crear todavía producto B3.3;
- no modificar B1/B2/B3.1/B3.2;
- no realizar Git write.

## Criterio de cierre

- Node major 22 confirmado;
- corpus B3.3 conserva SHA congelado;
- producto B3.3 sigue ausente;
- el RED vuelve a ser exclusivamente `ERR_MODULE_NOT_FOUND`;
- B3.1/B3.2 conservan sus SHA.

## Evidencia de cierre

El RED se repitió sin modificar el corpus bajo el runtime contractual:

- Node `22.23.2`;
- npm `10.9.9`;
- corpus B3.3 SHA
  `0491906babd12e669775b5a361ea0cdaf110311f2d9c27dd4b45a6aaed71f359`;
- producto B3.3 todavía ausente;
- fallo exclusivamente `ERR_MODULE_NOT_FOUND` para
  `src/core/constructiveGenerationReceipt.js`;
- B3.1 y B3.2 permanecieron byte-identical.

La desviación pertenecía exclusivamente al entorno de ejecución y queda cerrada.
