# Matriz de trazabilidad

Estados: `Pendiente`, `En curso`, `Verificado`, `Aceptado`.

| Requisito | Descripción | Riesgo | Decisión | Spec | Evidencia prevista | Gate | Estado |
|---|---|---|---|---|---|---|---|
| REQ-ENV-001 | Build con Node 22 fijado y dependencias reproducibles | R-011 | D-003/D-004 | SPEC-000 | `docs/DEVELOPMENT.md` + clean install | G1 | Verificado |
| REQ-GOV-001 | Estado, decisiones, riesgos y specs validados | R-011 | D-015 | SPEC-000 | `make governance` + cierre SPEC-000 | G0 | Verificado |
| REQ-MIG-001 | Fuentes y fixtures se migran sin pérdida ni artefactos | R-014 | D-015 | SPEC-000 | `MIGRATION_MANIFEST.json` + comparación con origen | G1 | Verificado |
| REQ-TST-000 | Existe una puerta única de tests, cobertura, lint y build | R-011/R-015 | D-003/D-016 | SPEC-000 | `npm run validate` + cierre SPEC-000 | G1 | Verificado |
| REQ-SEC-001 | Ninguna fórmula puede ejecutar JavaScript | R-001 | D-005 | SPEC-001 | corpus adversario + 92 fórmulas de fixtures + reversión | G2 | Verificado |
| REQ-DATA-001 | Modelo inválido no modifica el estado activo | R-002 | D-006 | SPEC-001 | `{}`, JSON truncado y versión futura transaccionales | G2 | Verificado |
| REQ-DATA-002 | Modelos declaran versión y migran secuencialmente | R-002 | D-006 | SPEC-001 | fixtures v0/v1 + idempotencia | G2 | Verificado |
| REQ-DATA-003 | `roofSystems` heredados se preservan | R-002 | D-007 | SPEC-001 | roundtrip `casa-L` conserva 2 y precedencia visible | G2 | Verificado |
| REQ-DER-001 | Parámetros invalidan todos sus derivados | R-003 | D-008 | SPEC-002 | `DERIVED_STATE_MATRIX.md` + 45 muros | G3 | Verificado |
| REQ-DER-002 | Biblioteca y vanos invalidan derivados relacionados | R-003 | D-008 | SPEC-002 | `derivedStateContract.test.mjs` | G3 | Verificado |
| REQ-EXP-001 | Ningún INP se exporta con datos stale | R-003/R-007 | D-009 | SPEC-002 | `exportPolicy.test.mjs` + smoke CCX | G3 | Verificado |
| REQ-DOM-001 | Cadenetas son piezas reales y se metran | R-005 | legado D-020 | SPEC-R3 | cierres `SPEC-R3-A/B/C/D` + pruebas `r3Cadenetas*` y `takeoff.test.mjs` | G4 | Verificado |
| REQ-DOM-002 | R4–R8 completan catálogo, roles, encuentros y checks | R-005 | legado D-016–033 + gobernanza D-018–023 | SPEC-R4 + SPEC-R5 + SPEC-R6 + ROADMAP-R1-R8 | cierres `SPEC-R4-A/B/C`, `SPEC-R5-A/B/C`, `SPEC-R6-A` + cierres R6-B/C y R7–R8 | G4 | En curso |
| REQ-TST-001 | Existe fixture con planta y perfiles distintos | R-006 | — | SPEC-003 | fixture independiente auditado | G4 | Pendiente |
| REQ-TST-002 | Existe fixture guardado con `roofPlanes` | R-006 | — | SPEC-003 | roundtrip persistido | G4 | Pendiente |
| REQ-DXF-001 | Todo DXF generado tiene auditoría 0/0 | R-005 | — | SPEC-003 | reporte `ezdxf` | G4 | Pendiente |
| REQ-CCX-001 | INP de referencia ejecuta y converge en CCX | R-007 | D-011 | SPEC-003/004 | log y resultado parseado | G5 | Pendiente |
| REQ-FS-001 | Guardado es atómico y recuperable | R-004 | D-010 | SPEC-004 | kill test + comparación | G6 | Pendiente |
| REQ-FS-002 | Existen diez backups y autosave separado | R-004 | D-010 | SPEC-004 | rotación y recovery test | G6 | Pendiente |
| REQ-APP-001 | La app abre desde `/Applications` sin Terminal | R-008 | D-002/D-013 | SPEC-004 | smoke instalado | G6 | Pendiente |
| REQ-APP-002 | Runtime no realiza conexiones de red | R-008 | D-012 | SPEC-004 | capabilities/CSP + inspección | G6 | Pendiente |
| REQ-CCX-002 | CCX usa comando estrecho, timeout y cancelación | R-007/R-008 | D-011 | SPEC-004 | tests Rust + smoke | G5/G6 | Pendiente |
| REQ-UX-001 | Fallos críticos son visibles y accionables | R-012 | — | SPEC-005 | pruebas UI + smoke | G7 | Pendiente |
| REQ-PERF-001 | Se cumplen presupuestos en el Mac objetivo | R-010 | — | SPEC-005 | benchmark fechado | G7 | Pendiente |
| REQ-REL-001 | Release registra toolchain y commit | R-011 | — | SPEC-005 | manifest + tag | G8 | Pendiente |
| REQ-OPS-001 | Backup se restaura en una instalación limpia | R-004 | — | SPEC-005 | simulacro documentado | G8 | Pendiente |
