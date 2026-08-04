# Cierre — SPEC-GOV-A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | commit que contiene este cierre; worktree basado en `a08d7b418504` |
| Spec | `SPEC-GOV-A-reasoning-effort-policy.md` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Vite 5.4.21; ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No |

## Alcance ejecutado

Se creó la autoridad de esfuerzo de razonamiento, su matriz inicial y el enforcement G0 que compara
la spec activa con el estado de la sesión. El corte actualiza instrucciones, protocolo, plantillas,
decisión, riesgo y trazabilidad. No crea perfiles, wrappers, lanzadores ni automaciones.

## Cambios

- `governance/REASONING_EFFORT.md` define `low`, `medium` y `high`, reserva `xhigh` para una nueva
  ejecución excepcional aprobada y prohíbe `max`.
- La spec activa declara esfuerzo planificado; `STATUS.md` declara por separado el efectivo y las
  plantillas conservan ambos valores en el cierre.
- `validateReasoningEffortGovernance` rechaza declaraciones ausentes, esfuerzos iniciales fuera del
  conjunto ordinario, escalamiento inválido, ambigüedad de spec y discrepancias plan/ejecución.
- `AGENTS.md`, `PROTOCOL.md` y G0 obligan a detener y relanzar antes de trabajar cuando no coinciden.
- D-044, R-019 y REQ-GOV-002 dejan la decisión y su evidencia auditables.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Autoridad única con niveles, matriz y escalamiento | PASS | `governance/REASONING_EFFORT.md` |
| Ninguna tarea comienza en `xhigh`; `high` es techo ordinario | PASS | política, D-044 y caso enfocado de nivel excepcional |
| Instrucciones detienen una apertura con discrepancia | PASS | `AGENTS.md` y `governance/PROTOCOL.md` |
| Spec y cierre registran los esfuerzos | PASS | `templates/SPEC.md` y `templates/SESSION_CLOSE.md` |
| G0 rechaza ausencia, nivel inválido y discrepancia | PASS | `reasoningEffortGovernance.test.mjs`, 5/5 |
| Decisión, riesgo y requisito registrados | PASS | D-044, R-019 y REQ-GOV-002 |
| Baseline global previo identificado | PASS | F-010 y 42 errores reproducibles sólo en SPEC-08 a SPEC-13 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Prueba enfocada con Node 22 | PASS | 5/5 |
| `git diff --check` | PASS | sin errores |
| `npm run validate` con Node 22 | EXPECTED FAIL en G0 | todos los gates técnicos verdes; 42 errores documentales de F-010 al final |
| Suite Node | PASS | 785/785 |
| Componentes / Rust / laboratorio | PASS | 18/18; 9/9; 35/35 |
| Cobertura core / store | PASS | 93,31 % / 96,97 % |
| Goldens / DXF / CalculiX | PASS | 18; 14 DXF con `ezdxf` 0/0; 3/3 jobs y 8.649 valores finitos |
| Build de producción | PASS | chunk inicial gobernado de 732,41 kB |
| `make governance` | EXPECTED FAIL | exactamente 42 secciones ausentes en SPEC-08 a SPEC-13; sin error de SPEC-GOV-A |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Retirar la comparación entre esfuerzo efectivo y planificado | 1/5: `G0 rechaza esfuerzo efectivo distinto del planificado` |

La comparación se restauró y la prueba enfocada volvió a 5/5.

## Desviaciones y deudas descubiertas

- F-010 permanece P1: las nuevas SPEC-08 a SPEC-13 carecen de seis secciones contractuales y
  `Spec-14.md` no cumple el patrón por capitalización. La normalización es el primer trabajo de
  contenido después del bootstrap del lanzador.
- El shell inicial usó Node 20.20.2 y no reconoció los flags de cobertura; la puerta oficial se
  repitió completa con Node 22.23.2 fijado por `.nvmrc`.
- Rust conserva el warning conocido de compatibilidad futura de `block` 0.1.6 bajo D-040/R-009.
- El lanzador y el registro consolidado solicitado se ejecutarán como `SPEC-GOV-B` en `medium`,
  fuera de este corte.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
