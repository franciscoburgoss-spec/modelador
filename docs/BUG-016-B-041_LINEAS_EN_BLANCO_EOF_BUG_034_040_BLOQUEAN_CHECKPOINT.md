# BUG-016-B-041 — Líneas en blanco EOF en BUG-034…040 bloquean checkpoint

## Estado

CERRADO — 19-ago-2026.

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

## Cierre verificado

CERRADO — 19-ago-2026.

La correctiva de BUG-034…040 fue aplicada antes del checkpoint y dejó esos
siete documentos terminados en exactamente un LF.

Durante el cierre de BUG-041, el propio documento conservó una línea en blanco
adicional al EOF. Por ello `git diff --cached --check` falló y, debido al
encadenamiento con `&&`, no llegó a ejecutarse el bloque que cerraba
documentalmente este BUG.

Posteriormente se creó y publicó el checkpoint:

`51cf5d01331a620e75b8cd2e24d623c3f44944f1`

aunque el gate staged había informado todavía el defecto EOF de BUG-041.

Este cierre posterior:

- normaliza BUG-041 a exactamente un LF final;
- mantiene intactos BUG-034…040;
- no modifica D-088…D-093;
- no modifica el contrato técnico B3.5;
- no modifica tests, gates ni código productivo;
- no reescribe el commit ya publicado;
- restaura el checkpoint mediante un commit correctivo trazable posterior.

El incidente queda contenido en documentación y no amplía el scope vigente de
SPEC-016-B B3.3.
