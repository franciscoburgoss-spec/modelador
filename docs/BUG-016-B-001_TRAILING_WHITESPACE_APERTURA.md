# BUG-016-B-001 — Trailing whitespace en cabecera de SPEC-016-B

## Estado

CERRADO — 15-ago-2026.

## Contexto

Durante la apertura documental autorizada de SPEC-016-B, git diff --check detectó
espacios finales en cuatro líneas de la cabecera de
specs/SPEC-016-B-adaptador-metalcon.md.

## Evidencia

git diff --check reportó trailing whitespace en las líneas 3, 4, 5 y 6.

## Diagnóstico

Los espacios finales fueron introducidos durante la materialización documental
de la apertura para producir saltos Markdown.

No tienen semántica contractual y contradicen el gate git diff --check.

## Corrección autorizada por alcance

Eliminar exclusivamente el whitespace final de esas cuatro líneas, sin modificar
texto, decisiones, contratos ni gobernanza.

## Gate de cierre

- git diff --check PASS;
- cabecera semánticamente idéntica;
- ningún archivo productivo modificado.

## Cierre verificado

La corrección eliminó exclusivamente el whitespace final de las líneas 3 a 6 de
SPEC-016-B.

Evidencia posterior:

- git diff --check: PASS;
- contenido semántico de la cabecera preservado;
- ningún archivo productivo ni test fue modificado por la corrección.
