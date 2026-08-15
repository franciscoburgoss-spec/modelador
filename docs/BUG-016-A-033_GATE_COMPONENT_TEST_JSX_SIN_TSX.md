# BUG-016-A-033 — Gate de component test JSX ejecutado sin loader TSX

## Estado

CERRADO — 13-ago-2026.

## Evidencia de cierre

Se repitió el mismo component test mediante el runner oficial:

`node --import tsx --test tests/constructiveSolutionsMenu.component.test.jsx`

El proceso cargó correctamente JSX y alcanzó las aserciones React/Testing Library.

No se modificó código productivo para cerrar este BUG.

## Hallazgo

Durante el RED inicial de UI de SPEC-016-A se ejecutó:

`node --test tests/constructiveSolutionsMenu.component.test.jsx`

El proceso falló antes de cargar el test con:

`ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".jsx"`

Por tanto, el resultado no correspondía al RED contractual de la UI y no evaluó
`MenuBar`.

## Causa

El repositorio define explícitamente en `package.json`:

`"test:components": "node --import tsx --test tests/*.component.test.jsx"`

Los component tests `.jsx` requieren el loader `tsx`.

Se utilizó por error el runner reservado para los tests `.mjs`.

## Impacto

- no hubo modificación de código productivo;
- no hubo modificación del test para ocultar el fallo;
- no se evaluó todavía el contrato de `BUG-016-A-020`;
- el fallo no implica defecto de `MenuBar`, `App` ni del store.

## Correctiva

Repetir sin modificar el test:

`node --import tsx --test tests/constructiveSolutionsMenu.component.test.jsx`

## Resultado esperado

El RED contractual correcto debe ser:

- PASS: `Estructura` conserva sus herramientas y no contiene `Escenarios…`;
- FAIL: no existe todavía el menú raíz `Soluciones constructivas`.

## Criterio de cierre

Cerrar cuando:

1. el mismo archivo de test se ejecute mediante el runner oficial con `tsx`;
2. el proceso alcance realmente las aserciones del componente;
3. quede documentado el RED contractual obtenido;
4. ningún código productivo haya sido modificado para resolver este BUG de gate.
