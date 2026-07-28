# Cierre — SPEC-003 / corte E

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `11962f3b114cd0a60262f0f21ae4a156a20855ed` |
| Spec | `specs/SPEC-003-verification-harness.md`, corte E |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; ezdxf 1.4.4; CalculiX 2.23; Playwright 1.62.0 externo |

## Alcance ejecutado

Se consolidaron en `npm run validate` todos los gates locales del arnés: formato, lint, suites
Node/componentes/laboratorio, cobertura, goldens, auditoría DXF, smoke CalculiX, build, integridad de
migración/artefactos/derivados y gobernanza. El E2E actual se ejecutó en GitHub Actions sobre el
mismo commit, sin introducir persistencia nativa, packaging ni release.

## Cambios

- `verificationPipeline.test.mjs` fija el contenido único de la puerta local y el contrato externo.
- Playwright 1.62.0 queda fijado exactamente; configuración y prueba cubren apertura, revisión,
  descarga de `revision-constructiva.md` y cierre del modal.
- Actions usa Node fijado, Chromium soportado, permisos de sólo lectura y publica JSON/HTML por SHA.
- El formateador incorpora YAML para que el workflow también pertenezca al gate local.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 13. Trazabilidad crítica apunta a prueba o reporte automático por commit | PASS | `TRACEABILITY.md`; `artifacts/11962f3b114c/audit-dxf.json`; `artifacts/11962f3b114c/smoke-ccx.json`; ejecución externa enlazada |
| 14. `npm run validate` ejecuta todos los gates locales sin GUI ni mutar autoridades | PASS | `verificationPipeline.test.mjs` 2/2 y `npm run validate` código 0 sobre `11962f3` |
| 15. Playwright actual registra resultado externo para el mismo producto final | PASS | [Actions 30377254715](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30377254715), SHA exacto, 1/1 esperado, 0 reintentos; artefacto `playwright-11962f3b114cd0a60262f0f21ae4a156a20855ed` |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos, 27 requisitos, 35 decisiones antes del cierre |
| `npm run validate` | PASS | 732/732 Node; 4/4 componentes; 35/35 lab; core 93,55 %; store 97,85 %; 18 goldens; DXF 8 familias/9 archivos 0/0; CCX 3/3, 1.486 nodos y 8.649 valores; build 703,69 kB |
| `npx playwright test --list` | PASS | 1 prueba descubierta sin instalar/abrir browser local |
| GitHub Actions `E2E externo` | PASS | run `30377254715`; job `90335985678`; Playwright 1/1 esperado en 850 ms |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| `validate` anterior, que omitía goldens/DXF/CCX | `verificationPipeline.test.mjs`: falta `npm run verify:goldens` |
| Ausencia del script/config/workflow E2E | `verificationPipeline.test.mjs`: falta `test:e2e` |

Ambos fallos se observaron antes de implementar el corte. El workflow exitoso demuestra además que
la prueba funcional no sólo es descubrible: abre el producto construido y valida la descarga.

## Desviaciones y deudas descubiertas

- Playwright no se ejecutó localmente, en cumplimiento de D-014; la evidencia proviene de Ubuntu
  soportado y corresponde al mismo SHA.
- R-011 permanece abierto sólo por el recorrido incompleto de `specs/domain/` en gobernanza.
- No se amplió el alcance a persistencia, Tauri, packaging ni bundling de CalculiX.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `governance/QUALITY_GATES.md`
- [x] `docs/DEVELOPMENT.md`
- [x] `harness/README.md`
