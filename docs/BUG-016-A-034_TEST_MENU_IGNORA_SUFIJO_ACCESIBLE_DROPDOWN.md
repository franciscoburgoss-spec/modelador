# BUG-016-A-034 — Test de menú ignora sufijo accesible del Dropdown

## Estado

CERRADO — 13-ago-2026.

## Evidencia de cierre

Se corrigieron exclusivamente las consultas accesibles del test para respetar el
contrato existente de `Dropdown`:

- `Estructura` se consulta mediante `/^Estructura/`;
- `Soluciones constructivas` se consulta mediante `/^Soluciones constructivas/`.

Con el runner oficial se obtuvo el RED contractual esperado:

- PASS: `Estructura` conserva sus herramientas y no contiene `Escenarios…`;
- FAIL: el menú raíz `Soluciones constructivas` todavía no existe.

No se modificó `MenuBar.jsx` para cerrar este BUG.

## Hallazgo

Al repetir el RED de UI de SPEC-016-A con el runner JSX oficial, el test alcanzó
correctamente React/Testing Library, pero la primera aserción falló al buscar:

`button` con nombre exacto `Estructura`.

El DOM accesible real expone:

`Estructura ▾`

El mismo patrón aplica a todos los `Dropdown` raíz del `MenuBar`.

## Causa

El test nuevo asumió que el nombre accesible del botón raíz era exactamente igual al
texto de la etiqueta, ignorando el indicador visual `▾` que forma parte del contenido
accesible actual del componente `Dropdown`.

## Impacto

- no existe evidencia de defecto productivo en `Estructura`;
- `Estructura` sí está presente en el DOM;
- el test no alcanzó todavía las aserciones internas de ese menú;
- el segundo test tampoco distingue todavía entre el sufijo accesible y la ausencia real
  de `Soluciones constructivas`.

## Correctiva

Cambiar exclusivamente las consultas de los botones raíz del test:

- `name: 'Estructura'` → `name: /^Estructura/`
- `name: 'Soluciones constructivas'` → `name: /^Soluciones constructivas/`

No modificar `MenuBar.jsx`.

## Resultado esperado

Con el runner oficial y las consultas corregidas:

- PASS: `Estructura` conserva sus tres herramientas y no contiene `Escenarios…`;
- FAIL: no existe aún el menú raíz `Soluciones constructivas`.

Ese será el RED contractual válido de BUG-016-A-020.

## Criterio de cierre

Cerrar cuando el test corregido produzca exactamente el RED contractual esperado sin
modificación de código productivo.
