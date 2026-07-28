# Cierre — SPEC-003 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-verification-harness.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; CalculiX 2.23 |

## Alcance ejecutado

Se midió el baseline de fixtures, esquema, cobertura, exportadores y herramientas externas. Se
reconcilió la spec heredada con el estado posterior a R8 y se dividió en cinco cortes cerrables.
No se modificaron código de producción, fixtures, exportadores, DXF ni INP.

## Cambios

- Se fijó FX-003 como vivienda independiente con planta, vanos y perfiles 60/90.
- Se fijó FX-004 como modelo moderno resoluble con `modelVersion: 2`, biblioteca propia,
  perfiles 60/90 y `roofPlanes`.
- Se aclaró que `supportLedgers` se deriva y se compara tras roundtrip; no se persiste como segunda
  fuente.
- Se definieron goldens semánticos JSON/CSV/DXF/INP y las ocho familias DXF de referencia.
- Se decidió auditar con una versión fijada de `ezdxf`, sin depender del Python global.
- Se decidió ejecutar las variantes INP global, cercha y fundación con IDs persistidos, sin el
  renombrado corto usado por el smoke R6-B.
- Se clasificaron los contratos de store necesarios para subir de 72,76 % a 85 %.
- Se separaron los cortes A fixtures, B artefactos/DXF, C solver, D store/componentes y
  E integración/E2E externo.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico de duplicación | PASS | `casa-L` y `modelo-26`: 49 elementos, hash `d33ce29e466b`, `elements` idénticos |
| Esquema actual | PASS | seis fixtures importados a v2 mediante `prepareModelImport` |
| Cubierta moderna actual | PASS diagnóstico | único caso persistido: v1, cero elementos y polígono vacío; insuficiente |
| Cobertura medida | PASS | core 93,04 %; store 72,76 %; líneas descubiertas clasificadas por acción |
| Herramientas externas | PASS diagnóstico | Python global sin `ezdxf`; CCX 2.23 disponible |
| Contrato de derivados | PASS | ledgers producidos por `roofPlaneAdapter`, no persistidos en `roofPlanes` |
| Conjunto de referencia | PASS | JSON/CSV; ocho familias DXF; tres variantes INP |
| Alcance y exclusiones | PASS | sin reglas nuevas, Tauri, persistencia nativa, packaging ni refactor general |
| Aceptación verificable | PASS | 15 criterios asignados explícitamente a cortes A–E |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 30 decisiones |
| Importación reproducible de fixtures | PASS | 6/6; migraciones v0/v1 y warnings esperados |
| `npm run test:coverage:store` con Node 22 | PASS | 701/701; 72,76 % líneas; 78,63 % branches; 66,16 % funcs |
| `npm run validate` con Node 22 | PASS | 701/701; laboratorio 35/35; core 93,04 %; store 72,76 %; build OK |
| `npm run verify:migration` | PASS | 187 archivos: 140 idénticos, 47 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 318 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | 701,70 kB raw / 217,88 kB gzip |
| Auditoría DXF | No aplica | preparación documental; `SPEC-003-B` exige 0/0 global |
| Smoke CalculiX | No aplica | preparación documental; `SPEC-003-C` ejecuta las tres variantes |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad fija el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- La medición heredada del store (54,75 %) estaba obsoleta; el baseline vigente es 72,76 %.
- El fixture v1 con `roofPlanes` sólo verifica migración y precedencia, no una cubierta resoluble.
- `supportLedgers` no debe guardarse junto a `roofPlanes`; la redacción anterior confundía
  persistencia de configuración con persistencia del derivado.
- La auditoría temporal `ezdxf` de R8-C no constituye un entorno reproducible.
- El smoke R6-B evitó nombres largos renumerando muros. La prueba definitiva debe usar IDs
  persistidos y cubrir las tres variantes INP.
- Rust/Cargo no están presentes en el PATH activo; no bloquean SPEC-003-A–E porque Tauri permanece
  fuera de alcance, pero siguen siendo requisito de fases posteriores.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `harness/README.md`
- [x] `harness/FIXTURES.md`
- [x] `specs/SPEC-003-verification-harness.md`
