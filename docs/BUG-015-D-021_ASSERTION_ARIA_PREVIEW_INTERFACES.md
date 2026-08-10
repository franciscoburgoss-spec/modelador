# BUG-015-D-021 — Aserción ARIA desalineada con el preview canónico de Interfaces

## Estado previo

La Correctiva 06 implementó correctamente el contexto gráfico de `+N/−N` y el DOM expone un `svg` accesible con el nombre:

`Vista en orientación de Planta del muro 6→7 @ C. Seleccionada cara +N. +N corresponde a +Y y −N a −Y.`

La prueba focalizada, sin embargo, buscaba un nombre accesible que comenzara literalmente por `Muro 6→7 @ C`. Testing Library mostró en el mismo fallo que el `role="img"` existía y que su nombre accesible contenía toda la semántica esperada.

## Causa

Desalineación de la expectativa del test con el contrato accesible realmente implementado. No es un defecto productivo de geometría, localización ni accesibilidad.

## Corrección

Se actualiza únicamente la expresión regular del test para exigir el prefijo real `Vista en orientación de Planta del muro ...` y conservar las comprobaciones de:

- host humano `6→7 @ C`;
- cara seleccionada `+N`;
- convención `+N = +Y` y `−N = −Y`;
- Localizar cara sin mutación de autoridad, historial, trace ni selección global.

## Fronteras

No cambia código productivo, schema, geometría, interfaces, relaciones, candidate load paths, store, historial, trace, review, Localizar ni gobernanza de cierre.
