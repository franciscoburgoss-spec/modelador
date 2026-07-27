# Cierre — SPEC-R4 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R4-finding-catalog.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el corte C: presentación de los tres niveles de severidad, datos de regla
y fuente, más navegación por los cuatro campos de IDs tipados. No se emitieron checks contra
geometría real, no se modificaron exportadores y no se migraron advertencias locales.

## Cambios

- `domainFindingPresentation.js` agrupa findings en orden `error` → `warning` → `info` sin
  descartar ninguno y rechaza severidades desconocidas.
- El view-model presenta regla, medida y límite; diferencia datos ausentes, no verificables y no
  resolubles.
- La fuente se resuelve desde el catálogo. Para `osb.cadeneta.ala` recorre `dependsOn` y muestra la
  publicación oficial de `osb.tornillo.borde`, sin copiar la cita al finding.
- La navegación pura prioriza `roofPlaneIds`, `roofSystemIds`, `wallIds` y `elementIds`; sin IDs
  devuelve `null`.
- `ValidationModal` coordina esas funciones, presenta los `info` de modelo y techumbre con estilo
  propio, conserva la señal “Crítico para CalculiX” y no muestra botones sin destino.
- `wallIds` usa `centerOnElement`, el mismo recorrido que `elementIds`, por lo que centra y
  selecciona el primer muro.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 8. Tres severidades visibles | PASS | agrupación pura conserva `error`, `warning` e `info`; modal consume las tres secciones |
| 8. Medida, límite y fuente | PASS | recorrido cadeneta: 22 mm, ≥23 mm y fuente oficial resuelta por dependencia |
| 9. Prioridad de navegación | PASS | cuatro destinos tipados en orden; `wallIds` centra como elemento |
| 9. Sin IDs no hay acción | PASS | resolver devuelve `null` y el modal no materializa botón |
| 10. Advertencias locales invariantes | PASS | `rg -o "warnings\\.push" src \| wc -l` permanece en 51 |
| 11. Prueba de la prueba del corte C | PASS | al omitir `info` falla 1/6 pruebas R4-C |
| 12. Gobernanza, suite y build | PASS | gobernanza válida; 598/598; laboratorio 35/35; build Vite |

Con este corte quedan satisfechos los doce criterios de aceptación de `SPEC-R4`.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 18 decisiones |
| Pruebas R4-C | PASS | 6/6 |
| Pruebas focalizadas R4 | PASS | 20/20 |
| `npm run validate` con Node 22 | PASS | 598/598; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,27 % de líneas |
| Cobertura de presentación | PASS | 97,89 % de líneas |
| `npm run test:store-coverage` | PASS | 63,08 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 153 idénticos; 34 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 271 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| Build de producción | PASS | chunk inicial 639,73 kB raw / 198,37 kB gzip |
| Auditoría DXF | No aplica | el corte C no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte C no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Grupo `info` omitido temporalmente de la presentación | 1/6; el baseline detecta el finding perdido |

Restaurado el grupo, las 6/6 pruebas R4-C vuelven a pasar antes de la validación integral.

## Desviaciones y deudas descubiertas

- El repositorio no incorpora un entorno DOM de pruebas. La evidencia UI usa funciones puras con
  cobertura 97,89 % y una inspección arquitectónica reproducible de que el modal las consume; no
  se agregó una dependencia fuera de la spec.
- El manifiesto registra `ValidationModal.jsx` bajo `SPEC-R4` conservando su hash de origen. La
  limitación de `--record` con `SPEC-Rn` permanece bajo R-011; su regex se amplió temporalmente y se
  restauró sin diff final.
- El chunk inicial aumenta 0,93 kB raw / 0,87 kB gzip respecto de R4-B; el warning existente
  continúa bajo R-010 / `SPEC-005`.
- `validate-governance` aún no recorre `specs/domain/`; la revisión manual exigida por R-011 se
  realizó antes de implementar.
- No hubo una decisión nueva. R4 queda cerrada; R5 requiere una spec gobernada antes de comenzar.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
