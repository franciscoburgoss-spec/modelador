# BUG-016-B-006 — Runtime B1 usa Object.hasOwn incompatible con WebView objetivo

## Estado

CERRADO — 15-ago-2026.

## Evidencia

El gate oficial:

npm test

ejecuta la suite Node y obtiene:

- tests: 1219;
- PASS: 1218;
- FAIL: 1.

Falla exclusivamente:

SPEC-004-D1:
producción no depende de Object.hasOwn ausente en el WebView.

El guard identifica exactamente:

src/core/constructiveAdapterRuntime.js

como archivo productivo incompatible.

Debido al operador && de npm test, test:components todavía no se ejecuta.

## Diagnóstico preliminar

SPEC-016-B B1 introdujo constructiveAdapterRuntime.js.

Debe verificarse el uso exacto de Object.hasOwn y reemplazarlo por la
abstracción compatible ya establecida por SPEC-004-D1, sin modificar el test
histórico ni ampliar el alcance de B1.

## Restricciones de corrección

- no modificar ni relajar webviewCompatibility.test.mjs;
- no introducir polyfills globales;
- no depender de Object.hasOwn en código productivo;
- reutilizar el patrón de compatibilidad existente en el repositorio;
- no cambiar semántica del protocolo runtime;
- no modificar modelVersion, migraciones, store, UI ni Metalcon legacy.

## Gate de cierre

- test específico SPEC-004-D1: PASS;
- suite focal B1: 7/7 PASS;
- suite constructiva: 192/192 PASS o mayor;
- npm test completo: PASS, incluidos componentes;
- git diff --check: PASS.

## Diagnóstico confirmado

El guard SPEC-004-D1 localiza exactamente dos usos incompatibles:

- Object.hasOwn(runtime, 'generateSolution');
- Object.hasOwn(runtime, 'assertValidSolution').

Ambos pertenecen exclusivamente a la comprobación de colisión de capacidades
reservadas de constructiveAdapterRuntime.js.

El repositorio ya dispone del helper compatible y probado:

src/core/hasOwn.js

basado en Object.prototype.hasOwnProperty.call.

La corrección consiste únicamente en reutilizar ese helper. No cambia el
protocolo runtime, la enumerabilidad de las capacidades, el comportamiento de
colisión ni ninguna decisión de SPEC-016-B B1.

## Cierre verificado

La correctiva reemplaza exclusivamente Object.hasOwn por el helper hasOwn
compatible ya existente en src/core/hasOwn.js.

Evidencia posterior:

- Object.hasOwn en src/: NINGUNO;
- node --check constructiveAdapterRuntime.js: PASS;
- guard SPEC-004-D1 WebView: PASS;
- suite focal SPEC-016-B B1: 7/7 PASS;
- suite constructiva completa: 192/192 PASS;
- npm test Node: 1219/1219 PASS;
- npm run test:components: 61/61 PASS;
- npm test total: EXIT 0;
- git diff --check previo: PASS;
- no se modificó el test histórico;
- no cambió el protocolo runtime ni la enumerabilidad de sus capacidades.
