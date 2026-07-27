# Cierre — SPEC-R3 / corte D

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R3-cadenetas.md`, corte D |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el corte D: metrado aditivo de las piezas persistidas en `wall.studs` y
`wall.headers`, agrupado por perfil y rol. No se modificaron la fila de muro por superficie,
geometría, exportadores, DXF ni INP.

## Cambios

- `computeTakeoff` agrega la categoría `Tabiquería` y consume el despiece persistido de cada muro.
- Los montantes usan su largo vertical; cadenetas, dinteles y antepechos usan el largo horizontal.
- El perfil de montante se aplica a `wall.studs` y el de solera a `wall.headers`.
- Una pieza importada con perfil, rol o largo no resoluble no se descarta: conserva su conteo bajo
  `Personalizado` y suma una advertencia; sólo un largo inválido queda fuera de `ml`.
- `casa-L` conserva `deepEqual` las 11 filas heredadas y agrega estas 11:

| Perfil y rol | Piezas | Largo (m) |
|---|---:|---:|
| `90CA085p — Montante respaldo` | 88 | 284,400 |
| `90CA085p — Montante esquina/T` | 88 | 284,400 |
| `90CA085p — Montante bajo antepecho` | 66 | 44,850 |
| `90CA085p — Montante sobre dintel` | 189 | 224,150 |
| `90CA085p — Montante extremo` | 2 | 6,200 |
| `90CA085p — Montante bajo dintel` | 86 | 210,700 |
| `90CA085p — Montante jamba` | 69 | 245,700 |
| `90CA085p — Cadeneta` | 493 | 134,551 |
| `90CA085p — Montante relleno` | 338 | 1.161,300 |
| `92C085 — Dintel` | 43 | 61,900 |
| `92C085 — Antepecho` | 11 | 20,900 |
| **Total** | **1.473** | **2.679,051** |

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 7. Metrado aditivo por perfil y rol | PASS | `r3Cadenetas.test.mjs`: 11 filas nuevas, 1.473 piezas y 2.679,051 m |
| 7. Filas heredadas invariantes | PASS | `deepEqual` de las 11 filas contra el mismo modelo sin despiece |
| Datos importados no se descartan | PASS | `takeoff.test.mjs`: 3/3 piezas contadas y 3 advertencias ante datos no resolubles |
| 11. Prueba de la prueba | PASS | al retirar el recorrido de muros fallan 2/2 pruebas enfocadas |
| 12. Suite y build | PASS | 578/578, laboratorio 35/35 y build Vite |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 17 decisiones |
| `npm run validate` con Node 22 | PASS | 578/578; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,17 % de líneas |
| `npm run test:store-coverage` | PASS | 63,08 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 158 idénticos; 29 cambios registrados; 2 fixtures |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| Auditoría DXF | No aplica | el corte D no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte D no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Recorrido aditivo de piezas de tabiquería en `computeTakeoff` | 2/2: desaparecen las filas y los datos importados |

## Desviaciones y deudas descubiertas

- El chunk inicial queda en 632,32 kB raw / 195,28 kB gzip; aumenta 1,02 kB raw respecto del corte
  C y el warning existente continúa bajo R-010 / `SPEC-005`.
- La limitación de `migration-manifest --record` con `SPEC-Rn` permanece bajo R-011; se usó el
  procedimiento reversible de los cortes anteriores, sin cambio final al script.
- Las 6 cadenetas menores a 30 mm siguen registradas para R7; el metrado las representa, pero este
  corte no inventa una regla constructiva para absorberlas.
- No hubo una decisión nueva. Con este corte quedan satisfechos los 12 criterios de R3.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
