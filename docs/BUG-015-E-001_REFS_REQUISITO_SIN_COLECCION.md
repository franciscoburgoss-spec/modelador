# BUG-015-E-001 — `requirementRefs` sin colección resoluble

## Estado

Detectado antes de implementar B2; corregido dentro del contrato de SPEC-015-E antes de aceptar código productivo.

## Reproducción

La forma raíz congelada en B1 de `structural-requirements-v1.0` declaraba `regions[].requirementRefs[]`,
pero no incluía ninguna colección `requirements[]`. R10, además, define efectos tipados como
`supportRequired`, `loadTransferRequired`, `gravityResistanceRequired` y otros.

## Riesgo

Implementar literalmente el contrato B1 obligaría a dejar referencias colgantes o a sobrecargar
`supports[]`/`transfers[]` con efectos que no pertenecen a esas colecciones. Ambas alternativas
rompen trazabilidad y el criterio R12 de referencias resolubles.

## Corrección contractual

Agregar `requirements[]` a la raíz de `structural-requirements-v1.0` y a su orden canónico. Cada
`regions[].requirementRefs[]` debe resolver exactamente un `requirements[].id`. El cambio no añade
ninguna autoridad ni solución constructiva: sólo vuelve resoluble el contrato ya definido por R10/R11.

## Prueba de reversión

Una prueba focal debe fallar si se elimina `requirements[]` o si un `requirementRef` no resuelve.
