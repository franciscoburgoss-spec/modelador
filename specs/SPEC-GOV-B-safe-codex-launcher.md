# SPEC-GOV-B — Lanzador seguro y registro consolidado de esfuerzo

## Diagnóstico

SPEC-GOV-A hizo obligatoria la igualdad entre esfuerzo planificado y efectivo, pero la apertura
todavía depende de que una persona copie manualmente el override correcto al CLI. No existe un
comando del proyecto que lea la spec activa, construya una invocación sin shell y deje evidencia
de qué valor fue enviado. El cierre registra planificado y efectivo, pero hoy tampoco existe una
vista consolidada que los compare con el lanzamiento que originó la ejecución.

El CLI local observado es `codex-cli 0.145.0`; `codex exec` acepta el override
`--config model_reasoning_effort=<TOML>`, el directorio mediante `--cd` y el prompt como argumento.
El baseline de apertura conserva F-010: `make governance` reproduce exactamente 42 secciones
ausentes en SPEC-08 a SPEC-13. `Spec-14.md` queda fuera del patrón por capitalización. Esta spec no
normaliza esos documentos.

## Decisión

Crear un lanzador Node propio del repositorio que:

1. resuelva la única spec activa desde `governance/STATUS.md` y su archivo inmutable;
2. acepte únicamente `low`, `medium` o `high` desde `## Ejecución Codex`;
3. invoque `codex exec` mediante `spawn` y un array de argumentos, con `shell: false`, directorio
   raíz explícito y el override TOML canónico del esfuerzo;
4. no acepte un esfuerzo alternativo por CLI ni evalúe, concatene o reinterprete el prompt;
5. ofrezca `--dry-run`, que valida y muestra una representación segura sin iniciar Codex ni
   escribir el registro;
6. agregue eventos JSONL antes y después del proceso a `governance/CODEX_EXECUTIONS.jsonl`, con ID,
   spec, archivo, esfuerzo planificado, valor enviado, versión del contrato, tiempo y resultado;
7. al terminar, lea el cierre canónico `sessions/close-<SPEC>.md`, compare sus esfuerzos
   planificado y efectivo y deje el resultado consolidado como evento final;
8. ofrezca una auditoría independiente que reconstruya cada ejecución y falle ante eventos
   incompletos, esfuerzos discrepantes, cierres ausentes o campos inválidos.

El registro no guarda el prompt: conserva sólo su SHA-256 y longitud. La escritura será append-only
y sincronizada a disco; el validador de gobernanza incluirá la auditoría del registro versionado.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: implementación acotada de tooling y pruebas sobre contratos ya decididos por GOV-A.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Script de shell con interpolación | Amplía la superficie de inyección y dificulta probar argumentos exactos |
| Confiar en el perfil personal | No viaja con el repositorio ni demuestra el valor enviado por ejecución |
| Registrar el prompt completo | Puede persistir datos sensibles sin aportar evidencia sobre el esfuerzo |
| Reescribir una fila JSON al cerrar | Pierde la propiedad append-only y deja peor evidencia ante crash |
| Normalizar SPEC-08 a SPEC-14 en este corte | F-010 es el siguiente corte explícito y no pertenece al bootstrap del lanzador |

## Alcance

- Parser estricto de spec activa, esfuerzo y cierre.
- Construcción segura y ejecución inyectable del comando `codex exec`.
- Modo `--dry-run` sin efectos persistentes.
- Registro JSONL append-only y auditoría consolidada.
- Pruebas de argumentos, rechazo, dry-run, auditoría y cierre discrepante.
- Integración en `package.json`, `Makefile`, G0 y documentación de desarrollo.
- Decisión, riesgo, trazabilidad, estado y cierre de SPEC-GOV-B.

## Fuera de alcance

- Crear perfiles personales, automaciones o tareas programadas.
- Cambiar modelo, autenticación, sandbox o política de aprobaciones de Codex.
- Registrar o exponer el contenido del prompt.
- Lanzar la ejecución real siguiente desde las pruebas.
- Corregir, renombrar o normalizar SPEC-08 a SPEC-14.
- Resolver F-009 o modificar DXF, INP, dominio, React o Tauri.

## Criterios de aceptación

1. El lanzador usa la única spec activa y rechaza ausencia, ambigüedad o esfuerzo no ordinario.
2. La invocación envía exactamente el esfuerzo planificado a `codex exec` con argumentos separados,
   `shell: false` y directorio del repositorio explícito.
3. Datos adversarios en prompt o rutas no producen interpretación por shell y el prompt no aparece
   en el registro.
4. `--dry-run` valida y muestra comando/metadata sin ejecutar proceso ni mutar el registro.
5. Cada ejecución real deja evento de inicio aun si el hijo falla y un evento final que compara
   planificado, enviado y confirmado por el cierre.
6. La auditoría consolidada falla ante falta de cierre, duplicados, orden inválido o discrepancias,
   y G0 la ejecuta sobre el registro del repositorio.
7. Comandos y documentación permiten lanzar, simular y auditar sin depender de configuración
   personal no versionada.
8. Pruebas enfocadas pasan y la reversión de la defensa `shell: false` o de la comparación del
   cierre hace fallar su prueba correspondiente.
9. F-010 conserva su baseline conocido: no se modifica ningún archivo SPEC-08 a SPEC-14 y la
   validación global sólo puede seguir fallando por esos 42 errores preexistentes.

## Evidencia

- Pruebas Node del contrato puro, proceso inyectado, dry-run y auditoría JSONL.
- Inspección reproducible del array de argumentos, `shell: false` y ausencia del prompt en eventos.
- `npm run codex:dry-run`, `npm run codex:audit` y prueba enfocada.
- `make governance` y `npm run validate`, comparados con el baseline F-010.
- Prueba de reversión de seguridad y de comparación planificado/enviado/confirmado.
- Cierre `sessions/close-SPEC-GOV-B.md` generado desde la plantilla.

## Corte sugerido

Detener cuando el lanzador, el registro y su auditoría estén integrados y documentados; la primera
ejecución gobernada posterior abrirá un corte nuevo para normalizar SPEC-08 a SPEC-14.
