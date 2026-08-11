# BUG-015-E-002 — entrada huérfana duplicada en `specs/MANIFEST.json`

## Estado

Detectado durante la inspección B1 previa a código productivo; corregido antes de aceptar B2.

## Reproducción

El aplicador B1.1 actualizó la entrada nombrada de SPEC-015-E y dejó inmediatamente después un
segundo objeto con `bytes` y `sha256`, pero sin `name`. El JSON seguía siendo sintácticamente válido
y `make governance` pasó porque el validador no inspeccionaba `specs/MANIFEST.json`.

## Riesgo

El manifiesto deja de ser una correspondencia uno-a-uno auditable entre nombre, tamaño y hash. Un
consumidor que no filtre entradas huérfanas puede interpretar dos registros para la misma revisión.

## Corrección

Eliminar la entrada huérfana y ampliar G0 para exigir que cada entrada del manifiesto tenga `name`,
`bytes` y SHA-256 formalmente válidos, nombres únicos y una ruta de archivo existente. Los hashes históricos
de otras SPEC no se reinterpretan en este corte porque el manifiesto conserva valores de empaquetados previos.

## Prueba de reversión

Una copia del manifiesto con entrada sin `name`, nombre duplicado, SHA/tamaño formalmente inválido o archivo
inexistente debe hacer fallar `make governance`.
