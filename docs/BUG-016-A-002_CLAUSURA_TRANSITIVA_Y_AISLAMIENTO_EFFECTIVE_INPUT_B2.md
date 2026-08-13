# BUG-016-A-002 — Clausura transitiva y aislamiento del effective input B2

## Estado

CERRADO — 12-ago-2026.

## Hallazgo

La primera implementación de SPEC-016-A B2 contiene dos defectos contractuales:

1. `buildConstructiveScopeClosure()` resuelve paths, supports y transfers mediante una sola pasada,
   por lo que una entidad alcanzada que aporte nuevas referencias no expande transitivamente la
   clausura hasta punto fijo;
2. `projectEffectiveConstructiveInput()` transporta el objeto completo `scopeEligibility`, incluida
   la evidencia de `excludedBlockingDecisions`, y contamina el paquete consumible con decisiones
   demostrablemente ajenas al scope efectivo.

## Impacto

Una clausura incompleta puede excluir incorrectamente del dominio efectivo un path, support,
transfer o `roofGeometryId` alcanzable y, por tanto, clasificar como ajeno un blocker que realmente
intersecta. Transportar blockers excluidos hace que un cambio upstream ajeno altere el effective
input y rompe la independencia requerida por el futuro contrato de freshness.

El defecto no modifica geometría, `structuralIntent`, interfaces, relaciones, candidate paths,
`structural-requirements-v1.0`, legacy Metalcon ni verificación estructural.

## Corrección requerida

- calcular una clausura pura, determinista, finita y canónica mediante iteración hasta punto fijo;
- propagar exclusivamente referencias explícitas entre requirements, regions, paths, supports y
  transfers, sin heurística geométrica ni inferencias ausentes;
- conservar blockers relevantes/excluidos en la salida diagnóstica de eligibility;
- eliminar blockers excluidos, directa e indirectamente, de
  `constructive-effective-input-v1.0`;
- demostrar que cambiar un blocker todavía excluido no altera el effective input;
- demostrar que el mismo blocker, al intersectar el cierre, bloquea la proyección.

## Frontera congelada

`constructive-effective-input-v1.0` es el output de B2. B2 termina antes del adapter y no introduce
`constructive-adapter-input-v1.0`, generación, hashes de generación, freshness, receipt, coverage,
UI, store ni historia.

## Fronteras

- no iniciar B3;
- no implementar adapter, adapter neutral, biblioteca productiva ni `constructive-solution-v1.0`;
- no implementar `effectiveGenerationInputSha256`, freshness, receipt o coverage;
- no modificar store, UI, undo/redo, SPEC-016-B/C ni legacy Metalcon;
- no relajar la autoridad global del scope `all`, el fail-closed, la validación contextual, la
  allowlist, `notVerified`, pureza o no mutación.

## Criterio de cierre

La clausura alcanza el punto fijo incluso con cadenas de más de dos saltos y ciclos; un roof
descubierto indirectamente vuelve relevante su blocker; blockers excluidos permanecen visibles en
diagnóstico pero no atraviesan el effective input; cambios ajenos conservan `deepEqual` el paquete
consumible; intersecciones bloquean la proyección; FX-008 y todos los gates B2.1 quedan verdes.

## Resolución

`buildConstructiveScopeClosure()` itera ahora hasta punto fijo sobre referencias explícitas de
requirements, regions, paths, supports y transfers. Las colecciones se deduplican, ordenan de forma
canónica y terminan incluso ante ciclos. La prueba adversaria alcanza un path y su
`roofGeometryId` sólo después de más de dos saltos; una blocking decision sobre ese roof queda
clasificada como relevante con prueba `typed-intersecting-reference-closure`.

`projectEffectiveConstructiveInput()` ya no transporta el objeto diagnóstico `scopeEligibility`.
El schema `constructive-effective-input-v1.0` conserva únicamente contexto de blocking decisions
relevantes dentro de `effectiveStructuralRequirements`; las decisiones excluidas no aparecen
directa ni indirectamente en el paquete consumible.

### Evidencia de cierre

- reversión previa: 29/36 PASS y 7 FAIL con la implementación B2 original;
- focal B2/B2.1: 36/36 PASS;
- regresión B1/B2/SPEC-015-E: 73/73 PASS;
- regresión ampliada con evidencia visual SPEC-015-E: 84/84 PASS;
- `npm test`: 1080/1080 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS, con warning heredado de `block v0.1.6`;
- lint y formato: PASS; formato verificó 678 archivos;
- goldens: 19/19 PASS, sin actualización;
- DXF: 14 archivos, 0 errores y 0 reparaciones;
- CalculiX: 3/3 PASS, con un warning reportado por el smoke existente;
- build: PASS, con warning heredado de chunks mayores a 600 kB;
- migración: 187 archivos, 129 idénticos al origen, 58 cambios registrados y 2 fixtures;
- artefactos: 765 archivos fuente/documentales inspeccionados, sin artefactos baseline;
- derivados: 14 exportadores y 14 mutadores válidos;
- auditoría Codex: 11 ejecuciones completas, 2 fallidas recuperadas y 0 no recuperadas;
- gobernanza: 22 archivos requeridos, 53 requisitos y 64 decisiones;
- `npm run validate`: PASS, exit code 0;
- `git diff --check`: PASS.

FX-008 conserva cinco blockers excluidos en la evaluación diagnóstica y cero blockers excluidos o
relevantes en el paquete efectivo lateral. Cambiar semánticamente un blocker todavía ajeno puede
cambiar el diagnóstico, pero conserva `deepEqual` el effective input; hacerlo intersectar vuelve
`eligible=false` y la proyección se rechaza.

BUG-016-A-002 queda cerrado dentro de B2.1. El cierre no autoriza B3 ni introduce adapter,
generación, `effectiveGenerationInputSha256`, freshness, receipt, coverage, UI o store.
