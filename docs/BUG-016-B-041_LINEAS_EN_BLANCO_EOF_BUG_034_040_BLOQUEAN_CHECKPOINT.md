# BUG-016-B-041 — Líneas en blanco EOF en BUG-034…040 bloquean checkpoint

## Estado

ABIERTO — 19-ago-2026.

## Hallazgo

Durante el checkpoint posterior al cierre de la Fase A de SPEC-016-B B3.3,
`git diff --cached --check` detectó exactamente una línea en blanco adicional
al final de cada uno de estos documentos:

- BUG-016-B-034;
- BUG-016-B-035;
- BUG-016-B-036;
- BUG-016-B-037;
- BUG-016-B-038;
- BUG-016-B-039;
- BUG-016-B-040.

El gate detuvo correctamente la cadena antes de `git commit` y `git push`.

## Clasificación

Defecto documental mecánico de terminación EOF.

No modifica ni contradice:

- D-088…D-093;
- el contrato técnico B3.5;
- la implementación productiva;
- tests, validaciones o gates;
- el `ACTIVE-SCOPE` vigente.

## Correctiva autorizable

Normalizar exclusivamente los siete archivos afectados para que terminen en
exactamente un LF, sin alterar su contenido semántico.

## Criterio de cierre

- los siete archivos terminan en exactamente un LF;
- `git diff --cached --check` queda limpio;
- `npm run format:check` queda verde;
- governance permanece válido;
- ningún archivo productivo adicional cambia.

