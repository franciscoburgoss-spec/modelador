# Cierre — SPEC-R4 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R4-finding-catalog.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el corte A: catálogo puro e inmutable de tres reglas, resolución explícita
de límites y constructor canónico de findings. No se adoptó todavía el constructor en validadores,
no se modificó React y no se implementaron checks contra geometría real.

## Cambios

- `domainRules.js` publica exactamente `osb.tornillo.borde`, `osb.cadeneta.ala` y
  `muro.vano.holguraManilla`, con taxonomía, dependencias y metadata validadas.
- La fuente manual conserva `ed: "sin edición declarada"`; la regla de obra usa `fuente: null` y
  severidad máxima `info`.
- Los límites resuelven 10 mm al borde, 23/25 mm para gap efectivo 3/5 sin default oculto, y
  50–60 mm para holgura de manilla.
- `domainFindings.js` construye el shape canónico con IDs tipados, admite `null` explícito para
  datos no verificables y preserva exactamente el shape observable de un finding legacy.
- El contrato rechaza reglas inexistentes, escalamiento de severidad, booleanos, números no
  finitos, rangos ambiguos, unidades incompatibles e IDs mal formados.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Catálogo exacto y validación estructural | PASS | `domainRules.test.mjs`: IDs, taxonomías y dependencias inválidas son rechazadas |
| 2. Catálogo y metadata inmutables | PASS | pruebas de `Object.isFrozen` y mutaciones que lanzan |
| 3. Fuentes manual/obra | PASS | cinco campos exigidos; edición no inventada; obra sin cita y con `info` |
| 4. Límite de ala con gap efectivo | PASS | gap 3 → 23 mm; gap 5 → 25 mm; dato ausente/no numérico → `null` |
| 5. Holgura de manilla | PASS | rango 50–60 mm y `fuente: null` |
| 6. Finding canónico y entradas inválidas | PASS | medida/límite numéricos, `wallIds`, sin `ids`; corpus inválido rechazado |
| 10. Advertencias locales invariantes | PASS | `rg -o "warnings\\.push" src \| wc -l` permanece en 51 |
| 11. Prueba de la prueba del corte A | PASS | al anular el lookup del catálogo fallan 7/12 pruebas focalizadas |
| 12. Gobernanza, suite y build | PASS | gobernanza válida; 590/590; laboratorio 35/35; build Vite |

Los criterios 7–9 corresponden deliberadamente a los cortes B y C y permanecen abiertos.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 18 decisiones |
| Pruebas focalizadas R4-A | PASS | 12/12 |
| `npm run validate` con Node 22 | PASS | 590/590; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,08 % de líneas |
| Cobertura focalizada | PASS | `domainFindings.js` 98,35 %; `domainRules.js` 81,63 %; conjunto 88,01 % |
| `npm run test:store-coverage` | PASS | 63,08 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 158 idénticos; 29 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 266 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| Build de producción | PASS | chunk inicial 632,32 kB raw / 195,28 kB gzip |
| Auditoría DXF | No aplica | el corte A no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte A no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Lookup de reglas reemplazado temporalmente por `null` | 7/12; catálogo, límites y findings dejan de resolverse |

El lookup original se restauró y las 12/12 pruebas volvieron a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- Los módulos no tienen consumidores de producción hasta los cortes B/C, por diseño de la spec.
- La cobertura focalizada conjunta queda en 88,01 % por ramas defensivas del validador de metadata;
  el gate oficial de core permanece aprobado con 91,08 %.
- La limitación de `migration-manifest --record` con `SPEC-Rn` no se ejerció porque los cuatro
  archivos del corte son nuevos respecto del baseline; la deuda permanece bajo R-011.
- `validate-governance` aún no recorre `specs/domain/`; la revisión manual exigida por R-011 se
  realizó antes de implementar.
- El warning de tamaño del chunk inicial continúa bajo R-010 / `SPEC-005`.
- No hubo una decisión nueva; se aplicó D-018 para no inventar la edición de la fuente oficial.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
