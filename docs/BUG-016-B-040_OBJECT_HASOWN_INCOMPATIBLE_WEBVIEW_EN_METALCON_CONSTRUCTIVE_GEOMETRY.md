# BUG-016-B-040 — Object.hasOwn incompatible con WebView en metalconConstructiveGeometry

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Durante el gate integral de cierre de Fase A READ-ONLY de SPEC-016-B B3.3,
`npm run validate` se detuvo en `npm test`.

Resultado Node:

- tests: 1313;
- pass: 1312;
- fail: 1.

El único fallo fue:

`SPEC-004-D1: producción no depende de Object.hasOwn ausente en el WebView`

El guard identificó como infractor productivo:

`src/core/metalconConstructiveGeometry.js`

## Clasificación

Defecto de compatibilidad productiva detectado por un gate transversal ya
existente.

No fue introducido por los cambios documentales de B3.3: la auditoría
inmediatamente anterior había verificado ausencia de cambios locales en
`src/` y `tests/`.

## Resguardo

No se modifica ni debilita:

- `tests/webviewCompatibility.test.mjs`;
- el gate SPEC-004-D1;
- ninguna validación;
- ninguna decisión contractual congelada.

Tampoco se corrige producción mientras B3.3 permanezca READ-ONLY sin una
autorización humana explícita para esta correctiva acotada.

## Investigación requerida

Antes de resolver:

1. confirmar la ocurrencia exacta de `Object.hasOwn`;
2. confirmar si la misma ocurrencia existe en `HEAD`;
3. verificar que no haya diff local productivo;
4. inspeccionar el contrato del test SPEC-004-D1;
5. determinar si la corrección puede ser una sustitución mecánica por el
   patrón compatible ya usado por el repositorio, sin cambio semántico.

## Criterio de cierre

El BUG sólo podrá cerrarse después de:

- autorización humana explícita de la correctiva;
- eliminación de la dependencia productiva prohibida;
- test focal SPEC-004-D1 verde;
- regresión SPEC-016-B pertinente verde;
- `npm run validate` integral verde;
- `git diff --check` limpio.

## Fuera de alcance

No autoriza:

- implementación de B3.3;
- cambios contractuales en B3.5;
- B3.6+;
- runtime/generatedArtifacts;
- B4, B5 o SPEC-016-C;
- modificar tests para obtener verde;
- Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La investigación confirmó que la única dependencia incompatible:

`Object.hasOwn(selection, 'elementId')`

existía ya en `HEAD` y no había sido introducida por la Fase A READ-ONLY de
B3.3.

La correctiva productiva excepcional fue autorizada explícitamente por revisión
humana y quedó limitada a:

- importar el helper canónico `hasOwn` desde `src/core/hasOwn.js`;
- sustituir la única llamada `Object.hasOwn(...)` por `hasOwn(...)`.

No se modificaron tests, gates, contratos geométricos ni decisiones
D-087...D-092.

Evidencia posterior a la correctiva:

- cero ocurrencias `Object.hasOwn` en
  `src/core/metalconConstructiveGeometry.js`;
- SPEC-004-D1 focal: 5/5 PASS;
- Node: 1313/1313 PASS;
- componentes: 61/61 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- cobertura oficial: PASS;
- goldens semánticos: 19 artefactos verificados;
- DXF audit: 0 errores, 0 reparaciones, 0 quality failures;
- CalculiX smoke: 3/3 jobs PASS;
- Vite build: PASS;
- migración: PASS;
- contrato de artifacts: PASS;
- contrato de derivados: PASS;
- auditoría Codex: PASS;
- governance: 22 archivos requeridos, 56 requisitos y 92 decisiones;
- `git diff --check`: PASS en la validación previa y sin cambio productivo
  adicional posterior.

BUG-016-B-040 queda cerrado como defecto preexistente de compatibilidad del
baseline revelado por el gate integral.

Este cierre no autoriza implementación B3.3, B3.6+, runtime/generatedArtifacts,
B4, B5, SPEC-016-C ni Git write.
