# BUG-016-A-037 — Anchor de parche UI de creación no coincide con fuente real

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

Al intentar implementar el formulario mínimo de creación de escenarios en
`ConstructiveScenariosWorkspaceDialog.jsx`, el script de parche abortó con:

`FAIL - inicio del componente no encontrado exactamente una vez.`

## Causa

El script asumió una representación textual exacta del inicio de:

`ConstructiveScenariosWorkspaceDialog`

que no coincide con el formato actualmente persistido en el archivo.

## Impacto

- no se escribió ningún cambio productivo;
- el workspace permanece en el estado GREEN anterior;
- el test contractual de creación continúa en:
  `5 PASS / 1 FAIL`;
- el único FAIL sigue siendo la ausencia del botón accesible
  `Nuevo escenario`.

## Resguardo

No adaptar el producto al anchor fallido.

Antes de corregir el parche se debe inspeccionar el texto real del componente y usar
anchors comprobados contra la fuente vigente.

No modificar:

- store;
- pipeline;
- B1/B2/B3;
- expectativas contractuales del test.

## Criterio de cierre

Cerrar cuando el formulario se implemente usando anchors obtenidos de la fuente real y
el component test alcance `6/6 PASS`, sin cambios ajenos al workspace.

## Cierre verificado

El formulario de creación fue aplicado posteriormente usando anchors obtenidos
de la fuente real de `ConstructiveScenariosWorkspaceDialog.jsx`.

El gate contractual del workspace alcanzó:

- tests: 6;
- pass: 6;
- fail: 0.

El flujo verificado demuestra:

- botón accesible `Nuevo escenario`;
- nombre y descripción editables;
- scope inicial sin selección implícita;
- `Crear escenario` deshabilitado hasta una elección válida;
- `scope: all` sólo se persiste tras elección humana explícita;
- una única mutación histórica de store;
- escenario creado sin assignments implícitos;
- `lastGeneration: null`;
- re-render del escenario creado sin caída del workspace.

La anomalía posterior de inspección contextual fue separada y registrada como
BUG-016-A-038, por lo que no forma parte del cierre de este BUG de patching.

No se realizaron cambios Git.
