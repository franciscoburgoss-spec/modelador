# Cierre — SPEC-R7 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R7-checks.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente la capacidad admisible de corte MP1 por dirección, su contrato de
condiciones y la integración final en validación/presentación. No se modelaron evidencias nuevas,
demanda, anclajes ni el informe markdown de R8.

## Cambios

- `computeShearCapacityByDirection(model)` inspecciona el largo nominal y la dirección X/Y de cada
  muro MP1 sin regenerar ni mutar el modelo.
- Cada muro expone largo, estado, capacidad verificada o condicionada y catorce condiciones
  individualizadas: rol, geometría/altura, vanos, razón de aspecto, serie/espesor de montante y
  solera, paso, cobertura OSB y cuatro evidencias aún no modeladas.
- Las condiciones disponibles fallan de forma explícita ante geometría irresoluble, vano, razón
  de aspecto inválida, perfiles/paso incompatibles u OSB ausente, stale o sin cobertura vertical.
- Espesor/caras de OSB, tornillos y dobles terminales permanecen `unknown`. Por ello un muro que
  cumple lo verificable es `conditional`, calcula `417 × lengthM` sólo en
  `conditionalCapacityKgf` y mantiene `capacityKgf: null`.
- El clasificador conserva el estado `verified` para evidencia completa futura y lo prueba
  aisladamente; ningún dato actual se promueve a ese estado.
- Los totales X/Y separan capacidad verificada, condicionada y largo excluido. Un finding por cada
  dirección con muros MP1 muestra ambas cifras, conteos de cobertura, fuente y navegación tipada.
- `validateModel` agrega esos findings a la ruta existente consumida por `ValidationModal`.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Pureza y cobertura final | PASS | `deepEqual` del modelo; sólo MP1 entra a la matriz; roles ausentes/ajenos quedan en `coverage.skipped` |
| 10. Estados y totales X/Y | PASS | matriz X/Y con `verified`/`conditional`/`excluded`; capacidades separadas y clasificador unitario |
| 11. Condiciones §1.5.2.1 | PASS | casos sintéticos de geometría, vano, aspecto, series, espesores, paso y OSB ausente/stale/incompleto |
| 12. Presentación final | PASS | findings por dirección con ambas cifras, cobertura, fuente Cintac y navegación a muro; baseline R4 preservado |
| 13. Prueba de la prueba C | PASS | retirar el aporte de 417 kgf/m rompe 3/6 pruebas focalizadas |
| 14. Puertas oficiales | PASS | gobernanza y validación integral verdes |

Los criterios 1–5 y 9 quedaron cerrados en R7-A; 6–8 en R7-B. Este corte completa 10–14 y el
contrato de cobertura de 1, por lo que SPEC-R7 queda cerrada.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 28 decisiones |
| Pruebas focalizadas R7-C | PASS | 6/6 |
| Pruebas combinadas R7-A/B/C + wrapper | PASS | 32/32 |
| `npm run validate` con Node 22 | PASS | 684/684; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 93,10 % de líneas; `shearCapacity.js` 100 % |
| Cobertura oficial del store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 141 idénticos, 46 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 308 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 690,96 kB raw / 214,04 kB gzip |
| Auditoría DXF | No aplica | R7-C no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | R7-C no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Producto `417 × lengthM` reemplazado temporalmente por cero | 3/6: clasificación, totales X/Y y finding integrado |

El cálculo se restauró y las 6/6 pruebas focalizadas volvieron a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- La capacidad verificada queda en cero por diseño: el modelo no demuestra espesor/caras OSB,
  especificación de tornillos ni dobles terminales. El valor calculable se rotula condicionado y
  nunca se suma como verificado.
- Sólo las direcciones con al menos un MP1 emiten finding. Los totales X/Y siempre existen, pero
  omitir findings vacíos preserva `deepEqual` los productores legacy y evita ruido sin cobertura
  aplicable.
- La cobertura OSB exige cursos contiguos con placas, altura completa y derivados no stale; no
  infiere espesor, número de caras ni fijaciones desde la geometría.
- El chunk inicial aumenta 5,88 kB raw / 1,84 kB gzip respecto de R7-B; el warning existente
  continúa bajo R-010 / `SPEC-005`.
- R8 sigue sin spec y no se creó su informe markdown. No hubo decisiones nuevas ni cambios de
  formato persistido, DXF o INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
