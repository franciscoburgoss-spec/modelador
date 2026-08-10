# BUG-015-D-008 — Regresión obsoleta de menú heredada desde SPEC-015-C-1

## Detección

Durante la validación local completa de SPEC-015-D REV2 en macOS, `node --test` ejecutó 948 tests:
947 pasaron y uno falló en `tests/spec015c1Independence.test.mjs`.

La prueba heredada de SPEC-015-C-1 todavía exigía literalmente que los ítems
`Propuestas estructurales…` y `Caminos de carga…` permanecieran deshabilitados con el título
`Disponible en SPEC-015-D`.

## Causa

La aserción era correcta mientras SPEC-015-D no estaba implementada. Después de abrir e integrar
SPEC-015-D, `MenuBar.jsx` expone deliberadamente una única entrada habilitada:
`Propuestas y caminos candidatos…`, que abre `structuralProposals`.

La regresión antigua estaba comprobando una frontera temporal ya superada, no una invariante de
SPEC-015-C-1. Las invariantes reales de C-1 siguen siendo que presentador/localizador sean puros,
que el localizador intercepte antes de la selección global y que herramientas todavía futuras
permanezcan deshabilitadas.

## Corrección

Actualizar únicamente `tests/spec015c1Independence.test.mjs` para:

1. conservar las aserciones de pureza del presentador y localizador de C-1;
2. conservar la intercepción previa del localizador en `Canvas`;
3. exigir que `MenuBar` contenga la entrada habilitada
   `onOpenModal('structuralProposals')` con texto `Propuestas y caminos candidatos…`;
4. prohibir que reaparezca `Disponible en SPEC-015-D`;
5. mantener `Topología estructural…` deshabilitada para SPEC-015-E.

No se cambia `MenuBar.jsx` ni código productivo.

## Invariantes

- SPEC-015-C-1 conserva sus fronteras de localización y selección global.
- SPEC-015-D queda accesible únicamente mediante la UI implementada y revisada.
- La prueba no exige IDs internos como identificación visible.
- SPEC-015-E continúa fuera de alcance.
- No se ejecuta Git.

## Validación requerida

- `node --test tests/spec015c1Independence.test.mjs`;
- suite enfocada SPEC-015-D;
- `npm run lint`;
- suite Node completa;
- continuación del validador completo sólo con todos los tests verdes.
