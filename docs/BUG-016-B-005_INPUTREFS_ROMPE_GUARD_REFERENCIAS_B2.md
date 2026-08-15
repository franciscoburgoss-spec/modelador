# BUG-016-B-005 — inputRefs B1 rompe guard de referencias contractuales B2

## Estado

CERRADO — 15-ago-2026.

## Evidencia

El gate ampliado de SPEC-016-B B1 ejecuta:

node --test tests/constructive*.test.mjs

Resultado:

- 192 tests;
- 191 PASS;
- 1 FAIL.

Falla exclusivamente:

BUG-016-A-003 B2.2:
el motor no decide referencias por forma textual ni recorrido indiscriminado.

La aserción obtiene true cuando esperaba false.

## Diagnóstico preliminar

SPEC-016-B B1 añadió resolución explícita de configuration.inputRefs dentro de
la frontera de contexto constructivo.

Debe verificarse si esa implementación introdujo una forma de recorrido,
detección textual o patrón de código que viola el guard congelado por
BUG-016-A-003 B2.2.

La corrección debe mantener inputRefs explícitos y tipados sin reintroducir
descubrimiento genérico de referencias.

## Restricciones de corrección

- no modificar el test histórico para hacerlo pasar;
- no relajar el guard BUG-016-A-003;
- inputRefs sólo puede consumir campos contractuales explícitos;
- no inferir referencias por nombre, contenido o forma textual;
- no recorrer arbitrariamente configuration;
- conservar distinción string/number mediante idToken;
- refs inexistentes deben seguir fallando cerradamente;
- no modificar modelVersion, migraciones, store, UI ni Metalcon legacy.

## Gate de cierre

- test histórico BUG-016-A-003 B2.2: PASS;
- suite constructiva completa: 192/192 PASS o mayor;
- suite focal B1: 7/7 PASS;
- git diff --check PASS;
- no se modifica la decisión histórica protegida por el test.

## Diagnóstico confirmado

El fallo histórico corresponde exactamente al guard estático:

source.includes('Object.values(') debe ser false.

SPEC-016-B B1 introdujo Object.values únicamente dentro de finiteJsonValue(),
usado para validar que adapterPayload sea JSON finito.

No se utiliza ese recorrido para descubrir, clasificar, conectar ni inferir
referencias.

La resolución de configuration.inputRefs consume exclusivamente los campos
contractuales explícitos:

- inputRefs.elementIds;
- inputRefs.roofGeometryIds.

La identidad se conserva mediante idToken y no existe resolución por prefijo,
forma textual, startsWith, value.includes(':') ni colector genérico de refs.

La corrección elimina Object.values del módulo protegido sin cambiar la
semántica de validación JSON y sin modificar el test histórico.

## Cierre verificado

La correctiva elimina el uso de Object.values de
constructiveScenarioContext.js sin cambiar la semántica contractual de B1.

Evidencia:

- guard histórico BUG-016-A-003 B2.2: PASS;
- guard source prohibido: NINGUNO;
- suite focal SPEC-016-B B1: 7/7 PASS;
- suite constructiva completa: 192/192 PASS;
- git diff --check: PASS;
- configuration.inputRefs continúa consumiendo únicamente
  elementIds y roofGeometryIds explícitos;
- identidad string/number permanece tipada mediante idToken;
- no se modificó el test histórico ni su decisión.
