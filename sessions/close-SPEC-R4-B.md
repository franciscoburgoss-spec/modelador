# Cierre — SPEC-R4 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R4-finding-catalog.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el corte B: adopción del constructor canónico en `validateModel`,
`checkAnalysisReadiness`, `validateRoofSystems` y `validateRoofPlanes`, preservando la salida
observable de sus findings legacy. No se modificó React, la navegación ni la emisión de checks
geométricos.

## Cambios

- Los helpers privados de `modelValidation`, `trussLayout` y `roofPlaneValidation` delegan en
  `createFinding` sin cambiar sus firmas ni sus arrays de IDs.
- `analysisReadiness` incorpora el mismo helper y reemplaza sus diez literales de findings.
- Se capturaron antes de la adopción cuatro baselines representativos: eje duplicado, readiness de
  pilar, apoyo de techumbre inexistente y finding de faldón.
- La prueba de arquitectura exige que las cuatro fronteras importen y usen el constructor
  compartido; las pruebas `deepEqual` fijan severidad, categoría, mensaje e IDs legacy.
- El manifiesto registra los cuatro fuentes modificados bajo `SPEC-R4`, conservando intactos sus
  hashes de origen.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 7. Adopción en cuatro fronteras | PASS | `domainFindingAdoption.test.mjs`: cuatro imports y delegaciones verificadas |
| 7. Compatibilidad observable | PASS | cuatro resultados públicos `deepEqual` contra baselines previos |
| 10. Advertencias locales invariantes | PASS | `rg -o "warnings\\.push" src \| wc -l` permanece en 51 |
| 11. Prueba de la prueba del corte B | PASS | al retirar una adopción falla 1/2 pruebas R4-B |
| 12. Gobernanza, suite y build | PASS | gobernanza válida; 592/592; laboratorio 35/35; build Vite |

Los criterios 8–9 corresponden deliberadamente al corte C y permanecen abiertos.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 18 decisiones |
| Pruebas R4-B | PASS | 2/2 |
| Pruebas focalizadas de productores | PASS | 76/76 |
| `npm run validate` con Node 22 | PASS | 592/592; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,09 % de líneas |
| `npm run test:store-coverage` | PASS | 63,08 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 154 idénticos; 33 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 268 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| Build de producción | PASS | chunk inicial 638,80 kB raw / 197,50 kB gzip |
| Auditoría DXF | No aplica | el corte B no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte B no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Delegación de `modelValidation` reemplazada temporalmente por su literal legacy | 1/2; el contrato detecta la frontera no adoptada |

El baseline `deepEqual` siguió pasando durante la reversión, demostrando que la segunda prueba
controla la adopción real y no sólo la forma del resultado. Restaurada la delegación, 2/2 vuelven a
pasar.

## Desviaciones y deudas descubiertas

- La primera ejecución integral llegó a 592/592 y build OK, pero el gate de migración detectó los
  cuatro hashes heredados modificados. Se registraron bajo `SPEC-R4` y la puerta final quedó limpia.
- La limitación de `migration-manifest --record` con `SPEC-Rn` permanece bajo R-011; se amplió
  temporalmente su regex sólo para ejecutar el comando oficial y se restauró sin diff final.
- Al entrar el contrato en el grafo de producción, el chunk inicial sube 6,48 kB raw / 2,22 kB gzip
  respecto de R4-A; el warning existente continúa bajo R-010 / `SPEC-005`.
- `validate-governance` aún no recorre `specs/domain/`; la revisión manual exigida por R-011 se
  realizó antes de implementar.
- No hubo una decisión nueva.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
