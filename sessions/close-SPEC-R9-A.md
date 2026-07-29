# Cierre — SPEC-R9 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R9-A-dxf-preflight.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; Rust/Cargo 1.97.1; ezdxf 1.4.4; CalculiX 2.23 |

## Alcance ejecutado

Se creó el contrato geométrico y técnico común de las láminas DXF AC1015. El corte corrige cajas,
márgenes, extents, unidades, escala de línea y viewports, agrega un preflight bloqueante y extiende
la auditoría oficial a fundaciones, tabiquería, OSB y cerchas en A1/A3. También reporta colisiones,
pero no las redistribuye: esa composición visual pertenece a R9-B/R9-C.

## Cambios

- `dxfGeometry` calcula cajas conservadoras para `LINE`, `TEXT` rotado, `CIRCLE`, `SOLID` y
  polilíneas, convierte 3 mm de papel por la escala y reporta colisiones texto–texto y
  burbuja–burbuja.
- `dxfPreflight` rechaza escala/layout/extent inválidos, vistas que no caben y entidades fuera del
  viewport mediante `DxfPreflightError`; los adaptadores de descarga muestran el diagnóstico y no
  producen archivos parciales.
- Los cuatro exportadores derivan sus extents de las entidades efectivas con la misma escala usada
  por el empaquetado y vuelven a comprobarlas al construir cada viewport.
- La plantilla declara milímetros y variables de escala de línea, deriva `$EXTMIN/$EXTMAX`, promueve
  `SOLID` como `AcDbTrace`, bloquea viewports, marca `VIEWPORTS` como no imprimible y elimina el
  borde técnico duplicado.
- `audit:dxf` usa `ezdxf` para verificar clipping, overflow, bloqueo, cabecera, extents, capa y
  subclases en una matriz reproducible A1/A3 de las cuatro familias.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Cajas de círculo/texto/line/sólido/polilínea | PASS | `dxfGeometry.test.mjs` 3 pruebas enfocadas |
| Margen de 3 mm de papel | PASS | conversión 1:100 verificada en `dxfGeometry.test.mjs` |
| Escala, extent y capacidad inválidos bloquean | PASS | `exportSheetsDxf.test.mjs`: `INVALID_SCALE`, `INVALID_EXTENT`, `VIEW_TOO_LARGE` |
| Entidades contenidas en cada viewport | PASS | preflight `VIEWPORT_CLIPPING` + matriz oficial con clipping 0 |
| Unidades, escala de línea y extents reales | PASS | prueba de cabecera + `audit:dxf` sin mismatch ni extent insuficiente |
| Viewports bloqueados y capa no imprimible | PASS | prueba de contenido + 10 láminas con unlocked 0 |
| `SOLID` usa `AcDbTrace` | PASS | auditoría con marcadores de subclase vacíos 0 |
| Colisiones reportadas | PASS | prueba texto–texto/círculo–círculo + `quality.collisionCount` |
| Cuatro familias A1/A3 | PASS | 8 combinaciones, 10 láminas, clipping/overflow/unlocked/fallas 0, `ezdxf` 0/0 |
| Prueba de la prueba | PASS | las dos reversiones enfocadas fallaron |
| Puerta oficial | PASS | `make governance` y `npm run validate` con código 0 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 30 requisitos; 43 decisiones |
| `npm run validate` con Node 22 | PASS | 780 Node; 18 componentes; 9 Rust; 35 laboratorio; build OK |
| Pruebas focalizadas R9-A | PASS | 15/15 |
| Cobertura oficial core | PASS | 93,31 % de líneas |
| Cobertura oficial store | PASS | 96,97 % de líneas |
| `npm run audit:dxf` | PASS | 14 DXF; 10 láminas; 8 combinaciones A1/A3; fallas técnicas 0; `ezdxf` 0/0 |
| `npm run verify:goldens` | PASS | 18 artefactos semánticos |
| `npm run verify:migration` | PASS | 187 archivos: 130 idénticos, 57 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 481 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Smoke CalculiX | PASS | 3/3; 1.486 nodos; 8.649 valores finitos |
| Build de producción | PASS | chunk inicial 732,41 kB raw / 228,53 kB gzip |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Volver a tratar `CIRCLE` sólo como su centro | 1: la caja ya no incluye el radio |
| Volver a permitir una vista que no cabe sola | 1: falta la excepción `VIEW_TOO_LARGE` |

## Desviaciones y deudas descubiertas

- F-009 permanece P1: el corte evita pérdida y clipping, pero no resuelve colisiones ni la
  composición visual denunciada por el usuario. R9-B/R9-C deben cerrar esa brecha antes de afirmar
  que los planos están listos para ejecución.
- El analizador del corte reporta texto–texto y burbuja–burbuja; texto–geometría, prioridades,
  líderes y escalonamiento pertenecen al diseño de anotaciones de R9-B.
- El warning heredado del chunk de Vite sube de 728,17 a 732,41 kB y continúa gobernado por R-010.
- Rust conserva el warning conocido de compatibilidad futura de `block` 0.1.6 bajo D-040/R-009.
- El shell abre con Node 20; la puerta oficial requiere cargar Node 22 desde `.nvmrc`.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `governance/MIGRATION_MANIFEST.json`
