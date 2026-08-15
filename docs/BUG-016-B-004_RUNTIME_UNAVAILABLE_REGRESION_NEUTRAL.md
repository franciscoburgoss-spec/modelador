# BUG-016-B-004 — Runtime unavailable neutral regresa a INVALID_RUNTIME en B1

## Estado

CERRADO — 15-ago-2026.

## Evidencia

El gate neutral smoke de SPEC-016-B B1 obtiene 11/12 PASS.

Falla exclusivamente:

SPEC-016-A pipeline: runtime unavailable falla cerrado antes de B3.2 y no persiste.

La prueba esperaba alcanzar el estado contractual de generación no disponible,
pero runConstructiveScenarioGeneration lanza antes:

ConstructiveGenerationPipelineError
code = INVALID_RUNTIME

mensaje:
La generación requiere un runtime constructivo explícito.

## Diagnóstico preliminar

B1 añadió capacidades ejecutables al protocolo de runtime.

El runtime neutral conserva cinco keys enumerables y las nuevas capacidades son
no enumerables para preservar la regresión exacta de SPEC-016-A.

Debe verificarse si la preparación del caso unavailable copia o reconstruye el
runtime de una forma que no conserva dichas propiedades no enumerables.

Si se confirma, requireRuntime está introduciendo una precondición observable
más fuerte que la existente y altera el orden fail-closed congelado por
SPEC-016-A.

## Restricciones de corrección

- no modificar el test para aceptar INVALID_RUNTIME;
- preservar exactamente las cinco keys enumerables del runtime neutral;
- preservar el resultado neutral v1;
- preservar GENERATION_UNAVAILABLE para el caso históricamente unavailable;
- no introducir branches por adapterId en el pipeline común;
- no modificar modelVersion, migraciones, store, UI ni Metalcon legacy.

## Gate de cierre

- test fallido vuelve a PASS sin modificar su decisión;
- suite focal B1 permanece 7/7 PASS;
- neutral smoke queda 12/12 PASS;
- git diff --check PASS;
- constructiveSolutionGeneration.js permanece byte-idéntico.

## Diagnóstico confirmado

La regresión queda localizada en el orden de validación del pipeline.

El test histórico construye unavailableRuntime mediante structuredClone(runtime)
y luego reemplaza availabilityContext por listas vacías.

Las capacidades B1 generateSolution y assertValidSolution son propiedades no
enumerables para preservar exactamente las cinco keys enumerables congeladas
por SPEC-016-A. structuredClone no conserva esas capacidades.

El requireRuntime introducido por B1 exige ambas funciones antes de evaluar
availability. Por eso el caso históricamente unavailable termina en
INVALID_RUNTIME antes de alcanzar GENERATION_UNAVAILABLE.

La corrección mínima consiste en mantener en la entrada del pipeline la
validación histórica de datos del runtime y exigir las capacidades ejecutables
sólo después de demostrar availability=available.

No se modifica el test ni se introduce dispatch por adapterId.

## Cierre verificado

La corrección preserva el orden fail-closed congelado por SPEC-016-A:

runtime de datos válido
→ availability
→ GENERATION_UNAVAILABLE si corresponde
→ capacidades ejecutables sólo para runtime available.

Evidencia posterior:

- test histórico runtime unavailable: PASS;
- suite focal SPEC-016-B B1: 7/7 PASS;
- neutral smoke SPEC-016-A: 12/12 PASS;
- git diff --check: PASS;
- constructiveSolutionGeneration.js conserva SHA-256
  683a9eee993939f721f232e695fdaba64978ba14f173e5485d4742b587bc73f9;
- no se modificó el test histórico para aceptar la regresión;
- no se introdujo dispatch por adapterId.
