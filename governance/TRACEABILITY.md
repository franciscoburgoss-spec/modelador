# Matriz de trazabilidad

Estados: `Pendiente`, `En curso`, `Verificado`, `Aceptado`.

| Requisito | Descripción | Riesgo | Decisión | Spec | Evidencia prevista | Gate | Estado |
|---|---|---|---|---|---|---|---|
| REQ-ENV-001 | Build con Node 22 fijado y dependencias reproducibles | R-011 | D-003/D-004 | SPEC-000 | `docs/DEVELOPMENT.md` + clean install | G1 | Verificado |
| REQ-GOV-001 | Estado, decisiones, riesgos y specs validados | R-011 | D-015 | SPEC-000 | `make governance` + cierre SPEC-000 | G0 | Verificado |
| REQ-MIG-001 | Fuentes y fixtures se migran sin pérdida ni artefactos | R-014 | D-015 | SPEC-000 | `MIGRATION_MANIFEST.json` + comparación con origen | G1 | Verificado |
| REQ-TST-000 | Existe una puerta única de tests, cobertura, lint, artefactos, solver y build | R-011/R-015 | D-003/D-016/D-036 | SPEC-000/003-E | `npm run validate` en `0f04c111e6ba`: 770 Node, 18 componentes, 9 Rust, 35 lab, 18 goldens, DXF 0/0, CCX 3/3 y build | G1/G4/G5 | Verificado |
| REQ-SEC-001 | Ninguna fórmula puede ejecutar JavaScript | R-001 | D-005 | SPEC-001 | corpus adversario + 92 fórmulas de fixtures + reversión | G2 | Verificado |
| REQ-DATA-001 | Modelo inválido no modifica el estado activo | R-002 | D-006 | SPEC-001 | `{}`, JSON truncado y versión futura transaccionales | G2 | Verificado |
| REQ-DATA-002 | Modelos declaran versión y migran secuencialmente | R-002 | D-006 | SPEC-001 | fixtures v0/v1 + idempotencia | G2 | Verificado |
| REQ-DATA-003 | `roofSystems` heredados se preservan | R-002 | D-007 | SPEC-001 | roundtrip `casa-L` conserva 2 y precedencia visible | G2 | Verificado |
| REQ-DER-001 | Parámetros invalidan todos sus derivados | R-003 | D-008 | SPEC-002 | `DERIVED_STATE_MATRIX.md` + 45 muros | G3 | Verificado |
| REQ-DER-002 | Biblioteca y vanos invalidan derivados relacionados | R-003 | D-008 | SPEC-002 | `derivedStateContract.test.mjs` | G3 | Verificado |
| REQ-EXP-001 | Ningún INP se exporta con datos stale | R-003/R-007 | D-009 | SPEC-002 | `exportPolicy.test.mjs` + smoke CCX | G3 | Verificado |
| REQ-DOM-001 | Cadenetas son piezas reales y se metran | R-005 | legado D-020 | SPEC-R3 | cierres `SPEC-R3-A/B/C/D` + pruebas `r3Cadenetas*` y `takeoff.test.mjs` | G4 | Verificado |
| REQ-DOM-002 | R4–R8 completan catálogo, roles, encuentros, checks e informe | R-005 | legado D-016–033 + gobernanza D-018–029/D-037 | SPEC-R4 + SPEC-R5 + SPEC-R6 + SPEC-R7 + SPEC-R8 | cierres `SPEC-R4-A/B/C`, `SPEC-R5-A/B/C/D`, `SPEC-R6-A/B/C`, `SPEC-R7-A/B/C`, `SPEC-R8-A/B/C`; pruebas R8 16/16; cuatro DXF A3 0/0 | G4 | Verificado |
| REQ-DOM-003 | Muros legacy sin rol se identifican y resuelven en lote sin inferencia ni mutación parcial | R-005/R-012 | D-019/D-037 | SPEC-R5-D | `projectElementInventory.test.mjs` 2/2; `wallTypeBatch.test.mjs` 2/2; `elementInventory.component.test.jsx` 4/4; `casa-L`: 45/45 visibles | G4 | Verificado |
| REQ-TST-001 | Existe fixture con planta y perfiles distintos | R-006 | D-030 | SPEC-003-A | `fixtures.manifest.json` + `fixtureManifest.test.mjs`: FX-003 independiente, X/Y, 3 puertas, 3 ventanas y perfiles 60/90 | G4 | Verificado |
| REQ-TST-002 | Existe fixture guardado con `roofPlanes` | R-006 | D-007/D-030 | SPEC-003-A | FX-004 v2: roundtrip preserva faldón y reproduce 1 sistema / 2 ledgers derivados | G4 | Verificado |
| REQ-TST-003 | Store y componentes críticos tienen contratos conductuales y gates 90/85 | R-012/R-015 | D-034/D-035 | SPEC-003-D | `storeContracts.test.mjs` 7/7; `criticalWorkflows.component.test.jsx` 4/4; core 93,55 %; store 97,85 %; cierre SPEC-003-D | G4 | Verificado |
| REQ-TST-004 | La puerta local es completa y Playwright actual registra el flujo crítico sobre el mismo commit | R-011/R-012 | D-014/D-030/D-036 | SPEC-003-E | `verificationPipeline.test.mjs` 2/2; [Actions 30403943338](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30403943338): SHA `f78c840`, 1/1 esperado en 2,4 s; reporte por SHA | G4/G5 | Verificado |
| REQ-DXF-001 | Todo DXF generado tiene auditoría 0/0 | R-005 | D-030/D-036 | SPEC-003-B/E | `artifactGoldens.test.mjs` + `artifacts/81c91ec364fc/audit-dxf.json`: 8 familias, 9 archivos, 0 errores / 0 reparaciones con ezdxf 1.4.4 | G4 | Verificado |
| REQ-DXF-002 | Toda lámina DXF preserva contenido, escala, unidades y encuadre antes de descargarse | R-018 | D-043 | SPEC-R9-A | cierre `SPEC-R9-A`; `audit:dxf`: 10 láminas A1/A3, 8 combinaciones familia/formato, clipping/overflow/unlocked/fallas técnicas 0 y `ezdxf` 0/0 | G4 | Verificado |
| REQ-CCX-001 | INP de referencia ejecuta y converge en CCX | R-007 | D-011/D-030/D-031/D-032/D-033/D-036 | SPEC-003-C0/C2/004 | `artifacts/81c91ec364fc/smoke-ccx.json`: CCX 2.23, 3/3 jobs, 1.486 nodos, 8.649 valores finitos; parser y warnings contractuales en tests C2 | G5 | Verificado |
| REQ-FS-001 | Guardado es atómico y recuperable | R-004 | D-010/D-038/D-039/D-040/D-041 | SPEC-004-A/B/C1/D | A: `SIGKILL` conserva SHA; B: apertura inválida no hace commit y save concurrente conserva dirty; C1 adopta el contrato en Rust; D prueba crash/cierre limpio y que recovery no modifica el original | G6 | Verificado |
| REQ-FS-002 | Existen diez backups y autosave separado | R-004 | D-010/D-038/D-041 | SPEC-004-A/D | rotación A conserva exactamente 10 backups reabribles; D guarda snapshot v2 atómico en `Recovery`, sólo ofrece el crash previo y preserva corrupción con error visible | G6 | Verificado |
| REQ-APP-001 | La app abre desde `/Applications` sin Terminal | R-008 | D-002/D-013 | SPEC-004 | smoke instalado | G6 | Pendiente |
| REQ-APP-002 | Runtime no realiza conexiones de red y renderiza en el WebView objetivo | R-008/R-009 | D-012/D-040/D-041/D-042 | SPEC-004-C/C1/D/D1 | Capability de nueve comandos, CSP local y ausencia de plugins shell/fs/HTTP/opener pasan inspección; `0f04c111e6ba` muestra menú, selector y lienzo por más de 30 s en macOS 11.7.11 x86_64 | G6 | Verificado |
| REQ-CCX-002 | CCX usa comando estrecho, timeout y cancelación | R-007/R-008 | D-011 | SPEC-004 | tests Rust + smoke | G5/G6 | Pendiente |
| REQ-UX-001 | Fallos críticos son visibles y accionables | R-012 | — | SPEC-005 | pruebas UI + smoke | G7 | Pendiente |
| REQ-PERF-001 | Se cumplen presupuestos en el Mac objetivo | R-010 | — | SPEC-005 | benchmark fechado | G7 | Pendiente |
| REQ-REL-001 | Release registra toolchain y commit | R-011 | — | SPEC-005 | manifest + tag | G8 | Pendiente |
| REQ-OPS-001 | Backup se restaura en una instalación limpia | R-004 | — | SPEC-005 | simulacro documentado | G8 | Pendiente |
