# BUG-016-A-038 — Inspección de escenario contextualmente inelegible derriba workspace

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

Durante el flujo UI de creación explícita se creó correctamente un escenario neutral con:

- metadata válida;
- `scope: { "mode": "all" }`;
- sin assignments;
- `lastGeneration: null`.

La creación entra al store y provoca el re-render esperado del workspace.

En ese re-render, `inspectConstructiveScenario()` llama a
`projectEffectiveConstructiveInput(...)`.

B2 rechaza la proyección con:

`CONSTRUCTIVE_CONTEXT_NOT_ELIGIBLE`

y el error atraviesa React, derribando el diálogo completo.

## Evidencia

El component test conserva cinco contratos previos en PASS y falla únicamente en el nuevo flujo
de creación cuando el escenario recién creado intenta ser inspeccionado.

El error nace en:

`projectEffectiveConstructiveInput(...)`

y llega a:

`ConstructiveScenariosWorkspaceDialog`

a través de:

`inspectConstructiveScenario(...)`.

## Interpretación preliminar

La persistencia B1 del escenario es válida.

La inelegibilidad contextual pertenece al estado derivado B2 y debe permanecer fail-closed, pero
no implica que un escenario persistido deje de ser inspeccionable.

La SPEC exige que la UI muestre elegibilidad separadamente; por tanto, la frontera de inspección
no debe convertir automáticamente una inelegibilidad contextual en una excepción fatal de UI.

## Resguardos

Hasta completar diagnóstico:

- no cambiar el test para ocultar la excepción;
- no convertir `scope: all` en otro scope;
- no introducir fallback geométrico;
- no hacer elegible artificialmente el escenario;
- no tocar autoridades SPEC-015;
- no generar B3.2;
- no modificar store ni UI antes de fijar la semántica correcta.

## Relación con BUG-016-A-037

BUG-016-A-037 permanece abierto porque el gate de creación UI todavía no alcanza `6/6 PASS`.

## Criterio de cierre

El workspace debe poder representar un escenario B1 válido pero contextualmente inelegible sin
proyectar una entrada efectiva inválida, sin fallback y sin lanzar una excepción fatal.

La UI deberá mostrar explícitamente su elegibilidad/diagnóstico contractual y conservar las demás
dimensiones sin equiparar inelegibilidad con verificación ni disponibilidad de adapter/library.

## Cierre verificado

La corrección se implementó en dos fronteras separadas.

### Frontera pura de inspección

`inspectConstructiveScenario()` evalúa primero B2 mediante
`evaluateConstructiveScenarioContext(...)`.

Cuando un escenario sin receipt no es elegible para proyección efectiva:

- no llama `projectEffectiveConstructiveInput(...)`;
- no construye `adapterInput`;
- no evalúa availability B3.1;
- no deriva estado B3.3;
- conserva el escenario sin mutaciones;
- devuelve `eligibility.eligibleForEffectiveProjection = false`;
- conserva los `reasonCodes` B2;
- usa `availability = null`;
- mantiene `coverage = notGenerated`;
- mantiene `freshness = notGenerated`;
- no inventa fingerprint efectivo.

El caso real FX-008 con `scope: all` quedó demostrado como inelegible por:

`BLOCKING_DECISION_RELEVANT`

sin ausencia de requirements ni indisponibilidad de adapter/library.

Gate focal:

- tests: 4;
- pass: 4;
- fail: 0.

### Representación UI

El workspace muestra explícitamente:

- `eligibleForEffectiveProjection: false`;
- `BLOCKING_DECISION_RELEVANT`;
- `Availability no evaluada`.

No presenta esa condición como `unavailable` y no confunde inelegibilidad con
verification.

Gate del workspace:

- tests: 7;
- pass: 7;
- fail: 0.

### Límites preservados

No se modificaron:

- store;
- pipeline;
- B1;
- B3.1;
- B3.2;
- B3.3;
- autoridades SPEC-015.

La desviación independiente de la dimensión `execution` permanece registrada
como BUG-016-A-039 y no forma parte de este cierre.

No se realizaron cambios Git.
