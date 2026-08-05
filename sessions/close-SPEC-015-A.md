# Cierre — SPEC-015-A / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 05-ago-2026 |
| Commit base | `cb50771997a74e2c8b5aaf594db7de3c816322a1` + árbol de trabajo gobernado |
| Rama | `main` |
| Spec | `SPEC-015-A` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No; `xhigh` permaneció prohibido |

## Alcance ejecutado

Se implementó `structural-intent-v1.0` como autoridad persistente y exclusiva de las decisiones
estructurales humanas explícitas. El archivo nativo adopta `modelVersion: 3`; la migración
`v2→v3` añade intención vacía sin traducir roles Metalcon, tipos de muro, geometría ni derivados.

La intención permite declarar participación, funciones, interacción secundaria, notas, procedencia
y revisión para elementos existentes. Las mutaciones son puras, canónicas, atómicas y entran al
historial. Dividir un elemento retira la referencia original y conserva un finding revisable;
unir elementos con intención se bloquea; eliminar un elemento limpia intención y referencias
asociadas.

`structuralIntent` permanece fuera de `agnostic-geometry-v1.0`. No se implementaron UI,
propuestas automáticas, caminos de carga, intención detallada de techumbre, escenarios
constructivos ni reglas R6–R12 de SPEC-14.

## Cambios

- `src/core/structuralIntent.js` define contrato, validación, canonicalización, mutaciones y
  reconciliación de referencias.
- `modelSchema.js` incorpora la migración pura `2→3`, valida la nueva raíz y conserva la cadena
  secuencial `0→1→2→3`.
- `useModelStore.js` expone acciones explícitas con historial e integra división, unión y
  eliminación sin inferir intención.
- Los flujos nativos, autosave y roundtrip conservan `structuralIntent` de forma canónica.
- FX-008 registra el proyecto real completo en v3 con 45 muros, 43 vanos, 32 fundaciones y
  7 `roofPlanes`.
- El golden `json-fx008-agnostic-geometry` fija 81.875 bytes y SHA-256
  `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a`.
- D-055, R-028 y REQ-DOM-006 registran decisión, riesgo y trazabilidad.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Raíz v3 única y válida | PASS | Esquema y pruebas de migración validan `structuralIntent` con `structural-intent-v1.0` |
| 2. Migración v2→v3 conservadora | PASS | Cadena `0→1→2→3` pura, secuencial e idempotente; Metalcon, OSB y derivados permitidos preservados |
| 3. Cero inferencia constructiva | PASS | Modelos con `wallTypes` y roles migran con `elementIntents: []` |
| 4. CRUD determinista y atómico | PASS | Crear, actualizar, ordenar y eliminar intención no modifica geometría ni solución constructiva |
| 5. Corpus adversario | PASS | Referencias, duplicados, combinaciones y valores inválidos fallan antes de mutar |
| 6. Canonicalización | PASS | Permutar entradas equivalentes conserva serialización |
| 7. Persistencia nativa | PASS | Guardar y reabrir conserva intención y orden canónico |
| 8. Aislamiento agnóstico | PASS | Exportación antes/después idéntica byte a byte y con el mismo SHA-256 |
| 9. Proyecto real completo | PASS | FX-008 conserva exactamente 45/43/32/7 y sus coordenadas |
| 10. Independencia estática | PASS | El núcleo no importa tipos, roles, Metalcon, OSB ni modulación |
| 11. Prueba de reversión | PASS | Traducir `wallType.role` a intención hace fallar la suite |
| 12. Gates oficiales | PASS | Cobertura, build, validate, gobernanza, auditoría Codex y diff aprobados |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas | PASS | 22/22: contrato, store, integración, fixtures y goldens |
| `npm run validate` | PASS | 855 Node; 21 componentes; 9 Rust; 35 laboratorio |
| Cobertura oficial | PASS | Core 93,21 %; store 95,68 % (gates 90 % / 85 %) |
| `npm run verify:goldens` | PASS | 19 artefactos semánticos |
| `npm run audit:dxf` | PASS | 14 archivos; 0 errores; 0 reparaciones; 0 fallos de calidad |
| `npm run smoke:ccx` | PASS | CalculiX 2.23; 3/3 jobs; warning permitido conocido |
| `npm run build` | PASS | Vite 5.4.21; 291 módulos transformados |
| `npm run verify:migration` | PASS | 187 archivos: 130 idénticos y 57 cambios registrados; 2 fixtures de migración |
| `npm run verify:artifacts` | PASS | 560 archivos fuente/documentales sin artefactos |
| `npm run verify:derived` | PASS | 14 exportadores y 14 mutadores |
| `npm run codex:audit` | PASS | 11 ejecuciones completas; 2 fallos recuperados; 0 no recuperados |
| `make governance` | PASS | 22 archivos requeridos; 43 requisitos; 55 decisiones |
| `git diff --check` | PASS | Sin errores de whitespace |

## Prueba de la prueba

| Fix revertido o contaminación introducida | Pruebas que fallan |
|---|---:|
| Traducir automáticamente `wallType.role` a intención | Suite de reversión SPEC-015-A |
| Agregar una intención a FX-008 y permitir que alcance el exportador agnóstico | Comparación exacta de 81.875 bytes y SHA-256 |
| Restaurar separación de autoridades | 22/22 pruebas enfocadas y validación oficial completa |

## Desviaciones y deudas descubiertas

- Durante la validación se detectó que `tests/helpers/interruptedAtomicWrite.mjs` podía terminar
  antes de publicar por IPC el estado posterior a `fsync`. Se añadió `process.channel?.ref()`
  antes de `process.send()`. Es una corrección incidental de confiabilidad del arnés, limitada al
  helper de la prueba de SIGKILL; la prueba nativa y la suite completa quedaron verdes.
- Vite mantiene el warning conocido por el chunk inicial de 780,52 kB raw. Corresponde a R-010
  y no fue ampliado por el contrato de intención.
- Rust mantiene el aviso conocido de incompatibilidad futura de `block` 0.1.6. D-040 bloquea
  actualizar esta línea sin smoke real de macOS 11.
- F-009 permanece P1 y sigue bloqueando afirmar que los planos están listos para ejecución.
- SPEC-08 continúa deshabilitada; R6–R12 requieren cortes posteriores que consuman esta nueva
  autoridad de intención sin introducir soluciones constructivas.

## Documentos actualizados

- [x] `governance/DECISIONS.md`, D-055
- [x] `governance/RISKS.md`, R-028
- [x] `governance/TRACEABILITY.md`, REQ-DOM-006
- [x] `governance/STATUS.md`
- [x] `governance/MIGRATION_MANIFEST.json`
- [x] `harness/FIXTURES.md`
- [x] `harness/fixtures.manifest.json`, FX-008
- [x] `harness/goldens/json.golden.json`
- [x] `specs/SPEC-015-A-contrato-intencion-estructural-agnostica.md`
- [x] `sessions/close-SPEC-015-A.md`
