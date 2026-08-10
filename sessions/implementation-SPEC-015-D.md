# Sesión de implementación — SPEC-015-D

**Estado:** implementación completada; pendiente de validación local autoritativa y aprobación de
cierre.

## Objetivo

Implementar propuestas estructurales no autoritativas, grafos candidatos gravitacional/lateral,
revisión humana persistente y aceptación explícita separada, con evidencia real FX-008 y sin
incorporar soluciones constructivas.

## Esfuerzo

- planificado: `high`
- efectivo durante la sesión web: `high`
- escalamiento: no usado; `xhigh` prohibido

## Baseline

- rama declarada de entrada: `main`
- commit declarado: `0a2504cff9c4dcf272ef7a14b91be92e2082ae22`
- ZIP verificado por SHA-256 y manifiesto: `3c89d8da34068283ca5105145659491cfa71f80c373b079e1211aa3d39228959`
- Git prohibido durante implementación y validación previa a aprobación.

## Resultado implementado

1. Contratos puros `structural-proposals-v1.0` y `candidate-load-paths-v1.0`.
2. Grafos gravitacional y lateral con semánticas, IDs y rutas independientes.
3. Review log persistente append-only en el modelo v3.
4. Preparación, preview, confirmación y stale guard para decisión individual.
5. Lote homogéneo atómico con un history, un review event y un trace `batchSet`.
6. Workspace macro→micro, dirección lateral X/Y explícita y auditoría.
7. Descriptores humanos, previews y localización temporal; IDs sólo como referencia técnica.
8. Evidencia productiva FX-008 JSON/SVG/HTML y manifiesto.
9. Aplicador, patch y validador autocontenidos sin operaciones Git.

## Hallazgos registrados

- `BUG-015-D-001`: reproducción inicial de identificación por IDs.
- `BUG-015-D-002`: flujo de lote homogéneo ausente en la primera integración; corregido.
- `BUG-015-D-003`: gates heredados invocan Git internamente; mitigado en el validador.
- `BUG-015-D-004`: una aceptación se materializaba como superada por su propia mutación; corregido.

## Gates disponibles en el chat

- gobernanza, formato, independencia y evidencia: PASS;
- pruebas enfocadas puras/integración: 45/45 PASS;
- migración, derivados, goldens y Codex: PASS;
- laboratorio roofPlane: 35/35 PASS;
- parse sintáctico JSX: PASS.

## Límites del entorno

Dependencias JS completas y Cargo no están disponibles. Lint, componentes, cobertura, build,
Rust/Tauri, DXF y CalculiX quedan para el validador local. Los scripts DXF/CCX oficiales intentaron
Git una vez y abortaron por ausencia de `.git`; no modificaron ningún repositorio ni produjeron
artefactos. Ver `docs/BUG-015-D-003_GATES_CON_GIT_INDIRECTO.md`.

## Prohibiciones preservadas

- Los motores derivados no importan store, React ni mutadores.
- Ningún resultado candidato se denomina `verified`.
- Rechazar o diferir no modifica `structuralIntent`.
- Gravedad y lateral permanecen separados.
- El cielo falso y las soluciones constructivas no participan.
- No se crea cierre documental ni operación Git antes del PASS local y revisión del usuario.
