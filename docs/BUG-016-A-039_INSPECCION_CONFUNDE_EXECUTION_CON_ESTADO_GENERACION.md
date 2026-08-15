# BUG-016-A-039 — Inspección confunde execution con existencia de generación

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

`constructiveScenarioInspection.js` deriva actualmente:

- `execution: notGenerated`
- `execution: generated`

según exista o no `lastGeneration`.

Sin embargo SPEC-016-A define las dimensiones ortogonales:

- `coverage`: `notGenerated`, `none`, `partial`, `complete`;
- `freshness`: `notGenerated`, `fresh`, `stale`, `unavailable`;
- `execution`: `idle`, `running`, `succeeded`, `failed`.

Por tanto `notGenerated/generated` no pertenecen al dominio contractual de `execution`.

## Impacto

La UI mezcla dos conceptos distintos:

1. existencia/estado de evidencia de generación;
2. estado efímero de ejecución de una operación.

Esto puede hacer que la presentación contradiga la tabla de estados ortogonales de SPEC-016-A.

## Resguardos

Hasta completar diagnóstico:

- no cambiar la SPEC para legitimar `execution: notGenerated|generated`;
- no mover `notGenerated` fuera de coverage/freshness;
- no adaptar tests para conservar la desviación;
- no introducir estado persistente de ejecución;
- no tocar pipeline, B1/B2/B3 ni autoridades SPEC-015.

## Relación con BUG-016-A-038

BUG-016-A-038 exige poder inspeccionar escenarios contextualmente inelegibles sin derribar la UI.

La corrección debe mantener separadas:

- elegibilidad B2;
- availability B3.1;
- coverage/freshness B3.3;
- execution efímera/UI.

## Criterio de cierre

La capa de inspección y la UI deben representar `execution` únicamente con valores contractuales
`idle|running|succeeded|failed`, sin usar esa dimensión como sustituto de coverage/freshness ni de
la existencia de un receipt.

## Cierre verificado

La desviación se corrigió conservando la ortogonalidad contractual entre
estado de ejecución y estado derivado de generación.

### Contrato de execution

La SPEC define:

- `execution = idle | running | succeeded | failed`;
- dimensión efímera/UI;
- independiente de receipt, coverage y freshness.

La inspección pura no representa una operación en curso. Por tanto:

- escenario sin receipt → `execution = idle`;
- escenario con receipt → `execution = idle`;
- receipt vigente no implica `execution = succeeded`;
- ausencia de receipt no implica `execution = notGenerated`.

`notGenerated` permanece exclusivamente en las dimensiones contractuales que
lo admiten:

- coverage;
- freshness.

### Generabilidad

La UI dejó de usar:

`execution === 'notGenerated'`

como condición para mostrar la acción de generación.

La acción explícita `Generar` queda habilitada cuando concurren:

- `lifecycle === active`;
- `eligibleForEffectiveProjection === true`;
- `availability === available`.

No se usa como gate:

- execution;
- coverage;
- freshness;
- existencia de receipt.

Esto permite:

- primera generación;
- regeneración fresh;
- regeneración stale;
- regeneración idéntica no-op según pipeline/store.

Y mantiene fail-closed:

- escenario archived;
- contexto B2 inelegible;
- adapter/library no disponibles.

### Evidencia

Gate de inspección pura:

- tests: 4;
- pass: 4;
- fail: 0.

Gate del workspace:

- tests: 7;
- pass: 7;
- fail: 0.

Total focal:

- tests: 11;
- pass: 11;
- fail: 0.

### Límites preservados

No se modificaron:

- B1;
- B2;
- B3.1;
- B3.2;
- B3.3;
- pipeline productivo;
- store;
- autoridades SPEC-015;
- geometría agnóstica;
- structuralIntent.

No se realizaron cambios Git.
