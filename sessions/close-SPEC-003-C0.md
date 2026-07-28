# Cierre — SPEC-003 / corte C0

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-003-C0-fx004-mechanical-properties.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; CalculiX 2.23 |

## Alcance ejecutado

Se resolvió la precondición mecánica de FX-004 antes del arnés de tres jobs. La biblioteca
persistida continúa siendo la autoridad: se completaron área e inercias de los tres perfiles que
forman miembros de la cercha y no se modificó el exportador ni su precedencia.

## Cambios

- `90CA085`, `40CA085` y `60CA085` persisten `areaCm2`, `ixCm4` e `iyCm4` idénticas al catálogo.
- Una prueba compara los nueve valores con `METALCON_PROFILES` y exige finitud/positividad.
- El checksum de FX-004 se actualizó explícitamente a
  `17bd0f727dfa7b8b904a196537caf9e9b70cb5ac002f50145dfb518d937e76ed`.
- Los goldens JSON/INP se regeneraron con `update:goldens`; la cercha pasó de 16 a cero tokens no
  finitos.
- D-031 prohíbe completar silenciosamente una entrada persistida desde el catálogo al exportar.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Propiedades canónicas finitas | PASS | `fixtureManifest.test.mjs`: tres perfiles × tres propiedades iguales al catálogo |
| 2. Checksum explícito | PASS | manifiesto recalcula `17bd0f…e76ed` y los ocho fixtures importan |
| 3. INP sin no finitos | PASS | `artifactGoldens.test.mjs`; `inp-truss.nonFiniteTokens = 0`; 18 goldens |
| 4. Smoke CalculiX real | PASS | CCX 2.23: `Job finished`; FRD con 13 nodos, 78 desplazamientos finitos, máximo 0,590202 mm |
| 5. Reversión crítica | PASS | retirar `90CA085.areaCm2` falla con `undefined !== 1.57` |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 31 decisiones |
| `node --test tests/fixtureManifest.test.mjs tests/artifactGoldens.test.mjs` | PASS | 8/8 |
| `npm run verify:goldens` | PASS | 18 artefactos |
| `/usr/local/bin/ccx cerchas` | PASS | `Job finished`; INP `7251c4…25e08`; FRD `8079ea…99204` |
| inspección finita temporal del bloque `DISP` | PASS | 13 nodos; 78 valores; máximo absoluto 0,590202 mm |
| `npm run validate` con Node 22 | PASS | 709/709; laboratorio 35/35; core 93,45 %; store 72,76 %; build OK |
| `npm run verify:migration` | PASS | 187 archivos: 140 idénticos, 47 cambios registrados; 2 fixtures de migración |
| `npm run verify:artifacts` | PASS | 339 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | 701,70 kB raw / 217,88 kB gzip |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Retirar temporalmente `areaCm2` de `90CA085` en FX-004 | 1/1: contrato C0 detecta `undefined !== 1.57` |

## Desviaciones y deudas descubiertas

- El `.dat` de la cercha queda vacío porque el INP solicita resultados en FRD; el bloque `DISP`
  sí contiene los 13 nodos y resultados finitos. El parser común de C debe leer el archivo
  esperado por cada variante, no exigir `.dat` indiscriminadamente.
- El defecto conocido de nombres `ELSET` largos del INP global permanece dentro de
  `SPEC-003-C`; no se tocó en este corte.
- No se modificaron DXF, Tauri, componentes ni umbrales.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `harness/FIXTURES.md`
