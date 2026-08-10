# BUG-015-D-022 — Aserción textual demasiado estricta en marco canónico de Interfaces

## Estado
Correctiva focal para SPEC-015-D REV8.

## Evidencia de reproducción
La Correctiva 06 publica correctamente en el contexto geométrico del host el texto visible:

`S canónico: crece de 6 hacia 7.`

La prueba focal, después de corregir el nombre ARIA en BUG-015-D-021, seguía exigiendo literalmente:

`/S canónico:crece de 6 hacia 7/`

La aserción omitía el espacio real entre `:` y `crece`, por lo que fallaba aunque el DOM productivo fuese correcto.

## Causa
Fragilidad exclusiva del test: la expresión regular codificaba una concatenación sin espacio distinta del `textContent` realmente publicado.

## Corrección
Cambiar sólo la expectativa a:

`/S canónico:\s*crece de 6 hacia 7/`

Así se conserva el contrato semántico —el texto debe declarar que S crece de 6 hacia 7— sin acoplar la prueba a un detalle de whitespace del render.

## Alcance
- No modifica componentes productivos.
- No modifica geometría, schema, interfaces, relaciones, paths, stale, historia, trace, review ni Localizar.
- No modifica gobernanza de cierre.
- La prueba sigue exigiendo el host C/6→7, la orientación +N/−N y la convención +N=+Y, −N=−Y.
