# SPEC-GOV-D — Reintentos Codex auditables sin borrar historia

## Diagnóstico

El registro append-only conserva correctamente el intento fallido de `SPEC-006-D`
`805966c7-465f-4549-8195-6ed8ec784425` y su reintento posterior exitoso
`85ed2fcd-c5b8-4ce3-9c59-b6793ddfd03b`. Ambos comparten spec, archivo, esfuerzo y fingerprint
del prompt. Sin embargo, el auditor actual exige que cada ejecución histórica termine aprobada;
por ello un fallo ya recuperado vuelve G0 inválido para siempre y obliga a borrar evidencia para
recuperar el gate, contradiciendo D-045.

## Decisión

Mantener inmutables todos los eventos y distinguir entre ejecución fallida no recuperada y fallo
histórico recuperado. Un fallo completo sólo se considera recuperado si existe después de él una
ejecución completa y aprobada con el mismo `specId`, `specFile`, `promptSha256`, `promptLength`,
`plannedEffort` y `sentEffort`. La coincidencia se calcula desde eventos estructuralmente válidos;
un inicio pendiente, eventos duplicados, campos inválidos o una reejecución distinta nunca sirven
como recuperación.

La auditoría seguirá informando cuántas ejecuciones completas, fallidas recuperadas y fallidas no
recuperadas existen. El historial fallido continuará visible y consultable; el resultado global
sólo será válido cuando toda falla completa tenga una recuperación posterior exacta.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: cambio localizado en la semántica del auditor y sus pruebas, sin tocar aplicación ni
  contratos de dominio; `medium` cubre adecuadamente la decisión y la evidencia.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Borrar o editar el intento fallido | Destruye la evidencia append-only exigida por D-045 |
| Aceptar cualquier ejecución posterior de la misma spec | Un prompt o esfuerzo distinto no demuestra que se repitió la misma tarea |
| Añadir una lista manual de excepciones | Permite dispensas no demostradas y exige mantenimiento paralelo |
| Ignorar todos los exit codes fallidos | Oculta tareas que nunca fueron recuperadas |

## Alcance

- Separar validación estructural de eventos, evaluación de resultados y recuperación exacta.
- Definir una identidad de reintento con spec, archivo, fingerprint completo y esfuerzos.
- Aceptar exclusivamente recuperaciones posteriores completas y aprobadas.
- Mantener como error fallos no recuperados, pendientes, duplicados, orden inválido y discrepancias.
- Exponer en la salida de auditoría conteos de ejecuciones y recuperaciones sin alterar el JSONL.
- Cubrir el registro real y corpus sintético positivo/negativo.
- Actualizar gobernanza, riesgo, decisión, trazabilidad, estado y cierre.

## Fuera de alcance

- Editar, compactar o eliminar eventos de `governance/CODEX_EXECUTIONS.jsonl`.
- Reintentar automáticamente procesos Codex o cambiar el lanzador, CLI, modelo o esfuerzo.
- Implementar el visor comparativo o modificar React, Three.js, Tauri o dominio.
- Cambiar la auditoría geométrica de `SPEC-006-D`.
- Resolver F-009, DXF, INP o specs constructivas.
- Usar `high`, `xhigh` o `max`.

## Criterios de aceptación

1. Un fallo completo seguido por una ejecución aprobada con identidad exacta queda marcado como
   recuperado y no invalida el registro; ambos eventos permanecen byte a byte en el JSONL.
2. Un fallo sin recuperación sigue produciendo error y código de salida no cero.
3. Cambiar spec, archivo, hash, longitud, esfuerzo planificado o enviado impide la recuperación.
4. Una coincidencia anterior al fallo no lo recupera y sólo una ejecución posterior puede hacerlo.
5. Eventos pendientes, duplicados, fuera de orden o con schema/campos inválidos siguen fallando.
6. La auditoría informa totales de ejecuciones completas, recuperadas y no recuperadas de forma
   determinista, y el registro real vigente pasa sin edición de su historia.
7. Una prueba de reversión demuestra que retirar la búsqueda de recuperación vuelve a hacer fallar
   el caso real o sintético recuperado.
8. Pruebas enfocadas, `npm run codex:audit`, `make governance`, `npm run validate` y
   `git diff --check` pasan; el cierre confirma `medium` planificado, enviado y efectivo.

## Evidencia

- Pruebas Node del auditor con reintento exacto, variantes no equivalentes, orden y pendientes.
- Auditoría reproducible del registro real conservando los IDs fallido y exitoso de SPEC-006-D.
- Inspección de diff que demuestre que no se reescribieron líneas históricas del JSONL.
- Prueba de reversión de la recuperación exacta.
- `npm run codex:audit`, `make governance`, `npm run validate` y cierre
  `sessions/close-SPEC-GOV-D.md`.

## Corte sugerido

Detener cuando G0 vuelva a verde sin borrar el intento fallido. El visor comparativo se abrirá en
una spec y sesión posteriores.
