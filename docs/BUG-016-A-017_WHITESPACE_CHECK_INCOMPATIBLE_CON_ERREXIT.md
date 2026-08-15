# BUG-016-A-017 — Verificación whitespace incompatible con errexit

## Estado

CERRADO — 13-ago-2026.

## Defecto

El bloque de auditoría posterior a BUG-016-A-016 ejecutó:

`git diff --no-index --check /dev/null <archivo>`

mientras la shell conservaba `set -e` de una ejecución anterior.

`git diff --no-index` puede devolver código 1 por existir diferencias normales entre `/dev/null`
y el archivo inspeccionado. Bajo `errexit`, la shell termina antes de capturar dicho código y no
alcanza las verificaciones posteriores ni `git status`.

El síntoma observado fue:

`===== WHITESPACE =====`
seguido inmediatamente de:
`Saving session...`
`[Process completed]`

## Impacto

No afecta al producto ni a los tests.

La ejecución alcanzó previamente:

- focal B3.2: 19/19 PASS;
- producto B3.2 SHA `683a9eee993939f721f232e695fdaba64978ba14f173e5485d4742b587bc73f9`;
- corpus B3.2 SHA `e04be8314e0fe78dc85cc680360afb0ffe34b14fbef3064d7e9f800d4a1e6569`;
- producto y corpus B3.1 byte-identical;
- auditoría estática sin imports prohibidos.

## Corrección requerida

Las comprobaciones `git diff --no-index --check` deben ejecutarse con `errexit` temporalmente
desactivado, capturar explícitamente su código y distinguir:

- código 0 o 1 sin salida de `--check`: comprobación aceptable;
- salida de `--check` o código mayor que 1: fallo real.

La configuración previa de `errexit` debe restaurarse después.

## Resguardos

La correctiva no modifica producto, tests, B3.1, B3.2, SPEC ni gobernanza.

No se realiza staging, commit ni push.

## Evidencia de cierre

La comprobación se repitió con `errexit` temporalmente desactivado y captura explícita de los
códigos de `git diff --no-index --check`.

Resultado:

- producto B3.2: reporte `--check` vacío;
- corpus B3.2: reporte `--check` vacío;
- la comprobación concluyó con `PASS - whitespace B3.2 limpio sin depender de errexit`;
- no se modificó producto ni corpus para obtener el PASS;
- no se realizó staging, commit ni push.

El defecto pertenecía exclusivamente al bloque de auditoría y queda cerrado.
