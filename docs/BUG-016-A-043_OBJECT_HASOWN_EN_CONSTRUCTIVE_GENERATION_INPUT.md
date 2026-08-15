# BUG-016-A-043 — Object.hasOwn incompatible en constructiveGenerationInput

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

El gate integral posterior a B3-CLOSE ejecutó:

`npm run validate`

y falló durante `npm test`.

Resultado Node:

- tests: `1212`;
- pass: `1211`;
- fail: `1`.

La única prueba fallida fue:

`SPEC-004-D1: producción no depende de Object.hasOwn ausente en el WebView`

La prueba esperaba cero archivos productivos dependientes de
`Object.hasOwn`, pero detectó:

`src/core/constructiveGenerationInput.js`

El fallo exacto fue un `AssertionError` en:

`tests/webviewCompatibility.test.mjs`

con:

`actual = ['src/core/constructiveGenerationInput.js']`

y:

`expected = []`.

## Impacto

La implementación B3.1 viola una restricción transversal ya vigente del
runtime objetivo: el JavaScript productivo debe ejecutarse en el WebView
compatible con macOS 11 y no puede depender de built-ins ausentes como
`Object.hasOwn`.

Mientras esta regresión exista:

- `npm run validate` no puede quedar verde;
- SPEC-016-A no puede avanzar a auditoría final de cierre;
- BUG-016-A-040 permanece abierto;
- no se crea `sessions/close-SPEC-016-A.md`.

## Alcance

El hallazgo observado está acotado inicialmente a:

`src/core/constructiveGenerationInput.js`

No existe evidencia en este fallo de defecto en:

- D-068;
- B3-CLOSE documental;
- receipts;
- freshness;
- coverage;
- store;
- UI;
- geometría agnóstica;
- `structuralIntent`;
- requirements.

## Regla de correctiva

No modificar ni debilitar
`tests/webviewCompatibility.test.mjs`.

La correctiva deberá:

1. localizar la dependencia exacta de `Object.hasOwn`;
2. identificar el patrón/helper compatible ya establecido en el proyecto;
3. reemplazar únicamente la dependencia incompatible;
4. preservar exactamente la semántica de comprobación de propiedad propia;
5. no ampliar autoridad ni alterar contratos B2/B3;
6. demostrar la correctiva primero con el gate focal y luego con
   `npm run validate`.

## Criterio de cierre

Cerrar únicamente cuando:

- `src/core/constructiveGenerationInput.js` ya no dependa de
  `Object.hasOwn`;
- la semántica de propiedad propia permanezca intacta;
- `tests/webviewCompatibility.test.mjs` pase sin modificaciones destinadas
  a exceptuar B3;
- los tests B3 afectados permanezcan verdes;
- `npm run validate` completo termine con exit code `0`;
- `git diff --check` y governance permanezcan verdes.

## Cierre verificado

La correctiva quedó verificada integralmente el 14-ago-2026.

Se reemplazó la única dependencia productiva incompatible de
`Object.hasOwn` en:

`src/core/constructiveGenerationInput.js`

por el helper canónico ya gobernado:

`src/core/hasOwn.js`

La semántica permanece siendo comprobación de propiedad propia y no se
modificó el test transversal para exceptuar SPEC-016-A.

### Evidencia de identidad

- SHA-256 final de `constructiveGenerationInput.js`:
  `dd1b9abfeb446a6a3b8f6ac0463f3b1e309927c17d8f564ccce2b7a99ae15424`;
- SHA-256 de `webviewCompatibility.test.mjs`, preservado:
  `9ca0d83c832feec80ab78d34539a15e27309f972ef53fd05697334adaa61cca4`;
- archivos productivos bajo `src` con `Object.hasOwn`: `0`.

### Gates de cierre

El `npm run validate` integral posterior a las correctivas terminó con
exit code `0`.

Dentro de esa ejecución:

- Node: `1212/1212 PASS`;
- componentes: `61/61 PASS`;
- Rust: `9/9 PASS`;
- laboratorio: `35/35 PASS`;
- SPEC-004-D1 WebView compatibility: PASS;
- build: PASS;
- migration: PASS;
- artifacts: PASS;
- derived contract: PASS;
- Codex audit: PASS;
- governance: PASS.

Los chequeos posteriores confirmaron además:

- `Object.hasOwn` productivo: `0`;
- `npm run verify:migration`: PASS;
- `git diff --check`: PASS;
- `make governance`: PASS.

BUG-016-A-043 queda cerrado.
