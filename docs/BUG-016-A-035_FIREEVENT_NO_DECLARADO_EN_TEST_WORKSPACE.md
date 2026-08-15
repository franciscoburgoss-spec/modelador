# BUG-016-A-035 — fireEvent no declarado en test de workspace constructivo

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Al preparar el RED de la acción `Generar` en
`tests/constructiveScenariosWorkspace.component.test.jsx` se incorporó `fireEvent`
al destructuring dinámico de `@testing-library/react`, pero no se declaró la variable
correspondiente en el ámbito superior del archivo.

El runner produjo en los cinco tests:

`ReferenceError: fireEvent is not defined`

durante el hook común, antes de alcanzar las aserciones de cada prueba.

## Causa

El archivo declaraba:

- `let cleanup;`
- `let render;`
- `let screen;`

pero faltaba:

- `let fireEvent;`

## Impacto

- los cinco tests quedaron bloqueados antes de evaluar producto;
- no existe evidencia de regresión en el workspace;
- todavía no se obtuvo el RED contractual de la acción `Generar`;
- no debe modificarse código productivo para resolver este BUG.

## Correctiva

Agregar exclusivamente:

`let fireEvent;`

junto a las demás referencias de Testing Library.

No modificar:

- `ConstructiveScenariosWorkspaceDialog.jsx`;
- store;
- pipeline;
- fixtures ni expectativas contractuales.

## Resultado esperado

Al repetir el test:

- los cuatro contratos previamente verdes deben volver a PASS;
- sólo el nuevo test de `Generar` debe fallar por ausencia del botón accesible
  `Generar FX-008 UI`.

Resultado contractual esperado:

`4 PASS / 1 FAIL`.

## Criterio de cierre

Cerrar cuando el mismo archivo alcance las aserciones y produzca exactamente
`4 PASS / 1 FAIL`, sin modificar código productivo.

## Cierre

CERRADO — 13-ago-2026.

La declaración faltante de `fireEvent` fue agregada exclusivamente al test.

Al repetir el gate:

- los cuatro contratos previos volvieron a PASS;
- el nuevo test alcanzó sus propias aserciones;
- no se modificó código productivo para esta correctiva.

La anomalía quedó aislada al arnés de prueba.
