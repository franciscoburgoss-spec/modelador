# Cierre — SPEC-003 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-verification-harness.md`, corte A — Fixtures |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8 |

## Alcance ejecutado

Se incorporaron FX-003 y FX-004 como autoridades independientes, un manifiesto ejecutable para
todos los fixtures JSON y pruebas de checksum, esquema, invariantes, referencias, independencia y
roundtrip. No se modificaron exportadores, DXF, INP, Python, CalculiX, componentes ni umbrales.

## Cambios

- FX-003 modela una vivienda de 8.000 × 6.000 mm con seis muros X/Y, tres puertas, tres ventanas,
  dos tipos de muro y perfiles serie 60/90.
- FX-004 modela una cubierta moderna de 6.000 × 3.200 mm con `modelVersion: 2`, biblioteca propia,
  dos tipos 60/90 y un `roofPlane` resoluble.
- FX-004 deriva un sistema, seis posiciones de cercha y dos ledgers de 5.940 mm; el JSON no
  persiste `supportLedgers`.
- `fixtures.manifest.json` registra los ocho JSON actuales con SHA-256, versión fuente,
  migraciones, propósito, requisitos, cobertura e invariantes.
- La prueba descubre ambos directorios de fixtures: agregar un JSON sin manifiesto también falla.
- Se verifican referencias de tipos/perfiles y que FX-003/FX-004 no persisten derivados de muro
  sin marcar.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Independencia | PASS | hashes de `elements` y biblioteca distintos entre FX-001/003/004 |
| 2. FX-003 | PASS | 6 muros X/Y; 3 puertas; 3 ventanas; perfiles 60/90; bounds 0,0→8000,6000 |
| 3. FX-004 | PASS | v2; 4 muros; perfiles 60/90; 1 faldón; 1 sistema resuelto |
| 4. Manifiesto/esquema | PASS | 8/8 checksums e invariantes; todos pasan `prepareModelImport` |
| 4. Roundtrip | PASS | `roofPlanes` deepEqual y 2 ledgers derivados deepEqual antes/después |
| Derivados | PASS | FX-004 no guarda ledgers; FX-003/004 no guardan framing/OSB sin marcar |
| Pureza | PASS | importar cada fixture no modifica el objeto fuente |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 30 decisiones |
| `node --test tests/fixtureManifest.test.mjs` | PASS | 3/3 |
| `npm test` con Node 22 | PASS | 704/704 |
| `npm run validate` con Node 22 | PASS | 704/704; laboratorio 35/35; core 93,13 %; store 72,76 %; build OK |
| `npm run verify:migration` | PASS | 187 archivos: 140 idénticos, 47 cambios registrados; 2 fixtures de migración |
| `npm run verify:artifacts` | PASS | 323 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | 701,70 kB raw / 217,88 kB gzip |
| Auditoría DXF | No aplica | el corte no genera ni modifica DXF |
| Smoke CalculiX | No aplica | el corte no genera ni modifica INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| `derived.ledgerCount` de FX-004 alterado temporalmente de 2 a 3 | 1/3; detecta `2 !== 3` |

## Desviaciones y deudas descubiertas

- Al expandir `model-v1-dual-roof`, la ausencia de canaleta entra a `resolveRoofPlane.fail` antes
  de inicializar `runAxis`/`perpCanal` y lanza `ReferenceError`. Se registró como R-017; corregirlo
  requiere otro corte y no era necesario para validar el esquema/migración de ese fixture.
- FX-003/FX-004 son sintéticos y no afirman representar una solución estructural aprobada; fijan
  diversidad y reproducibilidad del arnés.
- `goldenOutputs` queda vacío hasta SPEC-003-B.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `harness/README.md`
- [x] `harness/FIXTURES.md`
