# BUG-016-B-002 — Encabezados obligatorios de gobernanza ausentes en SPEC-016-B

## Estado

CERRADO — 15-ago-2026.

## Evidencia

make governance falla con seis hallazgos:

- falta ## Diagnóstico;
- falta ## Decisión;
- falta ## Alcance;
- falta ## Fuera de alcance;
- falta ## Criterios de aceptación;
- falta ## Evidencia.

## Diagnóstico

La reformulación conserva el contenido contractual aprobado, pero varios encabezados
usan numeración o nombres alternativos que el validador de gobernanza no reconoce.

Es una incompatibilidad documental, no una decisión funcional.

## Corrección permitida

Agregar o normalizar exclusivamente los encabezados contractuales requeridos,
sin cambiar autoridades, alcance, cortes B1-B5 ni criterios aprobados.

## Gate de cierre

- make governance PASS;
- git diff --check PASS;
- contenido contractual preservado;
- cero cambios en src/ y tests/.

## Cierre verificado

La SPEC contiene exactamente una vez cada encabezado obligatorio de gobernanza.

Evidencia posterior:

- git diff --check: PASS;
- los seis encabezados obligatorios tienen conteo 1;
- make governance: PASS;
- 22 archivos requeridos, 56 requisitos y 70 decisiones;
- cero cambios en src/ y tests/.
