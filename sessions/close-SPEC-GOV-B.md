# Cierre — SPEC-GOV-B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | commit que contiene este cierre; worktree basado en `a08d7b418504` |
| Spec | `SPEC-GOV-B-safe-codex-launcher.md` |
| Toolchain | Node 22.23.2; npm 10.9.8; Codex CLI 0.145.0; Rust/Cargo 1.97.1 x86_64; Vite 5.4.21; ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se creó el lanzador oficial para specs activas, un dry-run sin efectos y un registro JSONL
append-only auditado por G0. El corte integra comandos npm/Make, pruebas y documentación. No
modifica ni normaliza SPEC-08 a SPEC-14 y conserva F-010 como baseline conocido.

## Cambios

- `scripts/lib/codex-spec-launcher.mjs` resuelve spec/esfuerzo/cierre, construye argumentos,
  sincroniza eventos y audita el consolidado.
- `scripts/codex-spec.mjs` ofrece lanzamiento, dry-run y auditoría; `package.json` los integra y la
  puerta única ejecuta la auditoría.
- La ejecución usa `spawn(command, args, { shell: false })`, raíz explícita y
  `model_reasoning_effort="<planificado>"`; no existe override de esfuerzo expuesto al usuario.
- El registro no contiene prompts: sólo SHA-256 y longitud. Un evento de inicio precede al proceso
  y el evento final compara planificado, enviado y confirmado en el cierre.
- G0 exige el registro y valida sus eventos; protocolo, README y desarrollo documentan el flujo.
- D-045, R-020 y REQ-GOV-003 registran decisión, riesgo y trazabilidad.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Spec activa única y esfuerzo ordinario | PASS | parser estricto y casos de ausencia/ambigüedad |
| Override exacto sin shell ni interpolación | PASS | test de argumentos adversarios; `shell: false` inspeccionado |
| Prompt ausente del registro | PASS | test de fingerprint y búsqueda negativa sobre JSONL temporal |
| Dry-run sin proceso ni registro | PASS | salida reproducible con `registryMutated: false`; registro siguió vacío |
| Inicio conservado ante fallo y comparación final | PASS | proceso inyectado exitoso/fallido y lectura de cierre |
| Auditoría rechaza incompletos, duplicados, orden y discrepancias | PASS | `codexSpecLauncher.test.mjs`, 8/8 |
| Comandos y documentación integrados | PASS | README, DEVELOPMENT, PROTOCOL, npm y Make |
| Pruebas de reversión críticas | PASS | retirar `shell: false` y comparación efectiva produjo 1 fallo enfocado cada vez |
| F-010 sin normalización | PASS | `make governance` conserva exactamente sus 42 errores; archivos SPEC-08 a SPEC-14 no editados |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas con Node 22 | PASS | 13/13: 8 del lanzador + 5 de GOV-A |
| `npm run codex:dry-run -- "…"` | PASS | esfuerzo medium, `shell: false`, prompt por hash, registro no mutado |
| `npm run codex:audit` | PASS | 0 ejecuciones completas; registro inicial válido y vacío |
| `git diff --check` | PASS | sin errores |
| `npm run validate` con Node 22 | EXPECTED FAIL en G0 | todos los gates técnicos verdes; exactamente 42 errores documentales de F-010 al final |
| Suite Node / componentes / Rust / laboratorio | PASS | 793/793; 18/18; 9/9; 35/35 |
| Cobertura core / store | PASS | 93,33 % / 96,97 % |
| Goldens / DXF / CalculiX | PASS | 18; 14 DXF con `ezdxf` 0/0; 3/3 jobs y 8.649 valores finitos |
| Build de producción | PASS | chunk inicial gobernado de 732,41 kB |
| `make governance` | EXPECTED FAIL | exactamente 42 secciones ausentes en SPEC-08 a SPEC-13; sin error de SPEC-GOV-B o del registro |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Cambiar `shell: false` por `shell: true` | 1/1: argumentos separados y shell desactivado |
| Retirar comparación cierre efectivo vs. enviado | 1/1: auditor rechaza discrepancia con el cierre |

Ambas defensas se restauraron y la prueba enfocada completa volvió a 13/13.

## Desviaciones y deudas descubiertas

- F-010 permanece P1 sin cambios: 42 errores contractuales en SPEC-08 a SPEC-13 y capitalización
  fuera de patrón en `Spec-14.md`. Será la primera ejecución real abierta con el nuevo lanzador.
- No se creó la rama `spec/SPEC-GOV-B-safe-codex-launcher` ni un commit: `.git` está montado con
  acceso de sólo lectura y el worktree ya contenía los cambios de GOV-A. No se alteró esa historia.
- Rust conserva el warning conocido de compatibilidad futura de `block` 0.1.6 bajo D-040/R-009.
- El registro contiene cero ejecuciones porque este corte es el bootstrap anterior al lanzador; no
  se fabricó retroactivamente una entrada para la sesión actual.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
