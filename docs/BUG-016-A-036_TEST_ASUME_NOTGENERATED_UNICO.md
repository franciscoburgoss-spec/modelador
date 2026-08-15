# BUG-016-A-036 — Test de Generar asume notGenerated único

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Tras corregir BUG-016-A-035, el component test volvió a ejecutar correctamente sus
cinco casos:

- los cuatro contratos previamente verdes quedaron PASS;
- el nuevo caso de `Generar` alcanzó sus aserciones.

Sin embargo, falló antes de consultar el botón `Generar FX-008 UI` porque utilizó:

`screen.getByText('notGenerated')`

Testing Library encontró correctamente tres ocurrencias.

## Causa

Antes de una primera generación, la inspección contractual deriva:

- `Execution = notGenerated`;
- `Coverage = notGenerated`;
- `Freshness = notGenerated`.

Por tanto, `notGenerated` no es ni debe ser un texto único en la interfaz.

## Impacto

- no existe evidencia de defecto productivo;
- la UI está representando correctamente las tres dimensiones separadas;
- todavía no se ha alcanzado el RED contractual por ausencia del botón `Generar`;
- no debe modificarse producto para resolver este BUG.

## Correctiva

Cambiar exclusivamente la precondición del test:

`screen.getByText('notGenerated')`

por una comprobación explícita de las tres ocurrencias:

`assert.equal(screen.getAllByText('notGenerated').length, 3)`

No modificar:

- `ConstructiveScenariosWorkspaceDialog.jsx`;
- `useModelStore.js`;
- pipeline;
- inspección pura;
- fixture constructivo.

## Resultado esperado

Al repetir el component test:

- 4 contratos existentes PASS;
- el único FAIL debe ser la ausencia del botón accesible
  `Generar FX-008 UI`.

Resultado esperado:

`4 PASS / 1 FAIL`.

## Criterio de cierre

Cerrar cuando el test alcance la consulta del botón `Generar FX-008 UI` y falle
únicamente porque ese control todavía no existe, sin modificar código productivo.

## Cierre

CERRADO — 13-ago-2026.

La precondición fue corregida para reconocer las tres dimensiones contractuales con
valor `notGenerated`:

- Execution;
- Coverage;
- Freshness.

El gate alcanzó finalmente el RED contractual esperado:

`4 PASS / 1 FAIL`

y el único fallo restante fue:

`Unable to find an accessible element with the role "button" and name "Generar FX-008 UI"`

No se modificó código productivo para esta correctiva.
