# Cierre — SPEC-GOV-D / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-GOV-D` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se implementó exclusivamente la recuperación auditable de fallos Codex completos mediante una
aprobación posterior con identidad exacta. No se cambió la ruta de lanzamiento, el JSONL, React, Three.js,
Tauri, dominio, DXF ni INP. F-009 continúa abierto y no se implementó el visor comparativo.

## Cambios

- `analyzeAuditEvents` separa errores estructurales, evaluación de cierres y recuperación.
- La identidad fija spec, archivo, SHA-256 y longitud del prompt, esfuerzo planificado y enviado.
- Sólo una aprobación cuyo inicio está después del cierre fallido puede recuperarlo.
- La CLI informa ejecuciones completas, fallos recuperados y fallos no recuperados aun al fallar.
- El auditor real reconoce `805966c7-465f-4549-8195-6ed8ec784425` como recuperado por
  `85ed2fcd-c5b8-4ce3-9c59-b6793ddfd03b`.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Reintento posterior exacto recupera sin borrar historia | PASS | Par real y corpus sintético; prefijo histórico de 5.639 bytes conserva SHA-256 `df43dc11c05b59e375fd44ec93e94884ca27dd041aa60cdc5591f406c86dab05` |
| Fallo sin recuperación sigue bloqueando | PASS | Corpus sintético devuelve errores y 1 no recuperado |
| Los seis campos son obligatoriamente idénticos | PASS | Seis variantes negativas parametrizadas |
| Aprobación anterior no recupera | PASS | Caso de orden dedicado |
| Pendientes, duplicados, desorden y campos inválidos fallan | PASS | Corpus estructural negativo |
| Conteos deterministas y registro real | PASS | 6 completas, 1 recuperada, 0 no recuperadas; sólo la ejecución hija actual permanece pendiente hasta retornar |
| Reversión de la recuperación | PASS | Dos pruebas recuperadas fallan al retirar la búsqueda y vuelven a pasar al restaurarla |
| Puertas del repositorio | PASS al retorno | La puerta completa queda verde hasta `codex:audit`; el padre agrega el cierre actual después del retorno |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `node --test tests/codexSpecLauncher.test.mjs` | PASS | 13/13 |
| `npm test` | PASS | 821/821 Node; 19/19 componentes |
| `npm run codex:audit` | PASS al retorno | 7 completas, 1 recuperada, 0 no recuperadas después del cierre del padre |
| `make governance` | PASS al retorno | Dentro del hijo sólo espera su propio `launch_completed` |
| `npm run validate` | PASS al retorno | Todos los gates previos a la auditoría verdes; el cierre append-only final pertenece al padre |
| `git diff --check` | PASS | Sin errores de whitespace |

El registro es append-only. Durante esta ejecución hija, la auditoría rechaza correctamente el
`launch_started` actual sin pareja. Al retornar código 0, el lanzador lee este cierre, confirma
`medium == medium == medium` y anexa el `launch_completed`; no se simula ni escribe manualmente.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Búsqueda de aprobación posterior exacta reemplazada temporalmente por ausencia de recuperación | 2/2 casos recuperados (`sintético` y registro real) |

## Desviaciones y deudas descubiertas

- El shell no interactivo ofreció Node 20.20.2; la validación oficial se repitió cargando Node
  22.23.2 mediante NVM, sin cambiar archivos para ocultar la diferencia.
- No se abrió deuda nueva. F-009 permanece sin cambios y el visor comparativo requiere otra spec.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-051
