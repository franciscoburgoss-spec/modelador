# Cierre — SPEC-015-C / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 06-ago-2026 |
| Commit base | `ef39f2be817128d3731f43b8c89b50a8f719a45d` |
| Rama | `main` |
| Spec | `SPEC-015-C` |
| Toolchain confirmado | Node 22 / npm 10; Rust/Cargo, Tauri, Python/ezdxf y CalculiX ejercitados por los gates locales; versiones exactas en `ENVIRONMENT.txt` y logs del validador |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No; `xhigh` permaneció prohibido |
| Logs autoritativos | `artifacts/validation-spec-015-c/20260806-084630` |

## Alcance ejecutado

Se implementó una interfaz separada para declarar y revisar intención estructural sin consumir ni
mostrar autoridad constructiva. El menú `Estructura` abre un workspace con Resumen, Muros y
elementos, Techumbre, Encuentros, Diafragmas, Pendientes y Trazabilidad. Las colecciones futuras
permanecen inactivas y no se fabrican formularios ni placeholders persistentes.

Las declaraciones unitarias y masivas validan antes de mutar, detectan no-op, usan selección local
y crean cero o un paso de historial. La asignación masiva exige previsualización, fingerprints,
confirmación explícita y rechazo atómico ante conflictos o preview obsoleto. Undo/redo revierte o
restaura la autoridad y el evento de trazabilidad en la misma instantánea.

`structuralIntentTrace-v1.0` es opcional, nace sólo con la primera acción efectiva del usuario y no
registra importación, migración, navegación, selección, borradores cancelados ni reconciliaciones
geométricas. Los fingerprints son SHA-256 de payloads canónicos y el modelo conserva
`modelVersion: 3`.

Techumbre consume exclusivamente `projectAgnosticGeometry(model).roofGeometry`, reconstruye el
recorrido visual B1…Bn y conserva `boundaryId` como identidad. Seleccionar o declarar un borde no
modifica muros ni infiere apoyos. Estados visibles: Declarado, No definido, Inválido y Referencia
rota.

No se implementaron propuestas, caminos de carga, verificación resistente, R6–R12, edición de
encuentros/diafragmas, Metalcon, OSB, perfiles, materiales, modulación, conexiones borde–muro,
F-009 ni R-017.

## Cambios principales

- `src/core/structuralIntent.js`: no-op, trazabilidad opcional, fingerprints y lotes atómicos.
- `src/core/structuralIntentWorkspace.js`: presentador puro, estados, recorridos y confirmaciones.
- `src/core/modelSchema.js` y persistencia nativa: validación/roundtrip v3 con trace opcional.
- `src/store/useModelStore.js`: acciones unitarias/masivas y una única entrada de historial.
- `src/components/MenuBar.jsx` y `src/App.jsx`: menú `Estructura` e integración del workspace.
- `src/components/modals/StructuralIntentWorkspaceModal.jsx`: navegación, formularios, lote,
  techumbre, pendientes, trazabilidad y accesibilidad.
- Pruebas, auditor de independencia y evidencia reproducible de FX-008.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Menú y workspace separados | PASS | Menú `Estructura`, modal dedicado y pruebas de integración |
| Declaración individual | PASS | Crear, modificar, eliminar, no-op y errores por campo |
| Lote atómico | PASS | Preview, confirmación, conflicto/stale, un historial y undo/redo completo |
| Techumbre canónica | PASS | 7 cubiertas FX-008, B1…Bn visuales y `boundaryId` autoritativo |
| Estados y referencia rota | PASS | Ausencia, declaración, inválido y borrador/reconciliación obsoleta |
| Trazabilidad | PASS | 4 eventos FX-008, SHA-256 determinista, importación/migración sin eventos |
| Persistencia v3 | PASS | Roundtrip conserva trace presente y mantiene ausente el campo opcional |
| Accesibilidad | PASS | Nombre accesible, Escape, foco inicial/restaurado, trap y teclado |
| Independencia constructiva | PASS | Auditor recursivo de 17 módulos y prueba de reversión |
| Byte identity agnóstica | PASS | 81.875 bytes y SHA-256 `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a` |
| Caso real FX-008 | PASS | 45 muros, 43 vanos, 32 fundaciones, 7 cubiertas, 4 elementos, 1 cubierta y 4 eventos |
| Gates oficiales | PASS | Validador único local 25/25 |

## Validación local autoritativa

| Gate | Resultado |
|---|---|
| preflight-git | PASS |
| preflight-node-npm | PASS |
| preflight-dependencias | PASS |
| governance | PASS |
| evidencia-spec015c-generar | PASS |
| format-check | PASS |
| format-rust | PASS |
| eslint | PASS |
| tests-spec015c | PASS |
| tests-node-y-componentes | PASS |
| tests-rust | PASS |
| tauri-check | PASS |
| laboratorio-techumbre | PASS |
| cobertura-core-store | PASS |
| goldens | PASS |
| auditoria-dxf | PASS |
| smoke-calculix | PASS |
| build-vite | PASS |
| manifiesto-migracion | PASS |
| inventario-artefactos | PASS |
| contrato-derivados | PASS |
| auditoria-codex | PASS |
| byte-identity-y-evidencia | PASS |
| independencia-constructiva | PASS |
| git-diff-check | PASS |

Resumen producido por el Mac:

```text
PASS - SPEC-015-C · 25/25 gates aprobados
Logs: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-c/20260806-084630
No se ejecutó git add, commit ni push.
```

## Prueba de la prueba

| Alteración | Pruebas que fallan |
|---|---:|
| Introducir una importación constructiva en el grafo del workspace | Auditor de independencia y reversión |
| Aplicar lote tras cambiar un fingerprint del preview | Pruebas stale; el modelo debe permanecer idéntico |
| Registrar navegación, importación o un no-op | Pruebas de trace y roundtrip |
| Cambiar `v` por `-v` como dirección distinta | Pruebas de canonicalización de techumbre |
| Permitir que intención alcance la geometría agnóstica | Byte identity y evidencia FX-008 |

## Desviaciones y deudas descubiertas

- La validación de preparación no pudo ejecutar dependencias externas, Rust/Tauri, DXF ni
  CalculiX; el validador local ejecutó y aprobó todos esos gates.
- `structuralIntentTrace` se mantuvo opcional para no materializar registros vacíos al importar o
  reabrir proyectos sin acciones efectivas.
- B1…Bn permanecen etiquetas del presentador; la autoridad persistente es `boundaryId`.
- F-009 permanece P1 y bloquea afirmar que los planos están listos para ejecución.
- SPEC-08 continúa deshabilitada hasta completar y auditar R6–R12.
- R-017 no bloqueó el corte y no fue intervenida.

## Documentos actualizados

- [x] `governance/DECISIONS.md`, D-057
- [x] `governance/RISKS.md`, R-030
- [x] `governance/TRACEABILITY.md`, REQ-DOM-008 y REQ-UX-002
- [x] `governance/STATUS.md`
- [x] `governance/MIGRATION_MANIFEST.json`
- [x] `specs/SPEC-015-C-interfaz-declaracion-y-decisiones-explicitas.md`
- [x] `sessions/close-SPEC-015-C.md`
- [x] `evidence/spec-015-c/*`
