# SPEC-GOV-C — Normalización gobernable de SPEC-08 a SPEC-14

## Diagnóstico

Los ocho documentos incorporados como SPEC-08, addendum de SPEC-08 y SPEC-09 a SPEC-14 contienen
reglas normativas sustantivas, pero no siguen el contrato documental del repositorio. Siete archivos
son reconocidos actualmente por G0 y producen 42 errores —seis secciones ausentes por archivo—;
`Spec-14.md` queda fuera del patrón por capitalización. Los nombres también mezclan espacios,
guiones bajos y convenciones distintas.

El contenido importado pertenece al usuario y no puede resumirse, reinterpretarse ni descartarse
durante esta normalización. Este corte sólo debe envolverlo con metadatos gobernables, adoptar
nombres canónicos y demostrar que el cuerpo normativo se conserva íntegro.

## Decisión

Normalizar los ocho documentos mediante una envolvente documental común que agregue diagnóstico,
decisión, alcance, exclusiones, criterios verificables, evidencia y declaración de esfuerzo. El
cuerpo importado se preservará literalmente bajo una sección identificable y su SHA-256 antes y
después deberá coincidir. Los archivos se renombrarán con prefijo `SPEC-` en mayúsculas y nombres
legibles con guiones, sin fusionar SPEC-08 con su addendum.

La normalización no activa ni implementa ninguna regla constructiva. Las contradicciones,
dependencias o decisiones técnicas descubiertas se registran para cortes posteriores; no se
resuelven alterando el texto importado.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: transformación documental determinista con preservación por hash y criterios ya decididos.

## Alcance

- Inventariar los ocho documentos y calcular el SHA-256 de cada cuerpo original.
- Adoptar nombres canónicos para SPEC-08, su addendum y SPEC-09 a SPEC-14.
- Agregar a cada archivo las secciones contractuales exigidas por G0 y su esfuerzo futuro inicial.
- Preservar byte a byte el cuerpo normativo importado dentro de cada documento normalizado.
- Incorporar los ocho documentos al validador mediante su convención de nombre.
- Resolver F-010 y actualizar estado, trazabilidad, riesgos o decisiones sólo cuando corresponda.
- Generar cierre reproducible desde `templates/SESSION_CLOSE.md`.

## Fuera de alcance

- Implementar SPEC-08 a SPEC-14 o modificar código de dominio, React, Tauri, DXF o INP.
- Conciliar contradicciones técnicas entre documentos o con el baseline actual.
- Diseñar todavía el contrato `agnostic-geometry-v1.0` ni el exportador geométrico.
- Fusionar, resumir, traducir o corregir silenciosamente el contenido normativo importado.
- Escalar a `high` o `xhigh`.

## Criterios de aceptación

1. Existen exactamente ocho documentos normalizados para SPEC-08 base, SPEC-08 addendum y
   SPEC-09 a SPEC-14, todos con nombres que comienzan por `SPEC-`.
2. Cada documento declara las seis secciones contractuales de G0 y una sección
   `## Ejecución Codex` con esfuerzo ordinario adecuado para su futura implementación.
3. El cuerpo normativo de cada archivo original se recupera byte a byte desde el documento
   normalizado y conserva el mismo SHA-256.
4. No se pierde ningún archivo, regla, tabla, bloque de código ni referencia del material importado.
5. `make governance` pasa sin F-010 y `Spec-14.md` deja de quedar fuera del inventario.
6. Una inspección reproducible demuestra que retirar una sección obligatoria de una copia
   normalizada hace fallar G0 y que restaurarla recupera el resultado esperado.
7. Las pruebas y gates documentales pertinentes pasan; no se ejecutan smokes DXF o CalculiX porque
   el corte no modifica esos artefactos ni sus generadores.
8. El cierre confirma `medium` planificado, enviado y efectivo, y la auditoría del lanzador aprueba
   la ejecución consolidada.

## Evidencia

- Inventario antes/después con correspondencia uno a uno y hashes SHA-256 del cuerpo normativo.
- Script o prueba reproducible que extrae el cuerpo preservado y compara sus bytes originales.
- `make governance`, pruebas enfocadas de gobernanza, `npm run codex:audit` y `git diff --check`.
- Prueba de reversión de una sección contractual obligatoria.
- Cierre `sessions/close-SPEC-GOV-C.md` y registro en `governance/CODEX_EXECUTIONS.jsonl`.

## Corte sugerido

Detener al quedar F-010 resuelto con los ocho cuerpos importados íntegros y gobernables. El siguiente
corte vuelve a la planificación funcional del exportador geométrico agnóstico y la separación de
sistemas constructivos.
