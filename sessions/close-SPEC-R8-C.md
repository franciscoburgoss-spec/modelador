# Cierre — SPEC-R8 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R8-report-markdown.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; ezdxf 1.4.4 |

## Alcance ejecutado

Se antepusieron los criterios R8-A aplicables por variante a `NOTAS GENERALES`, conservando las
notas efectivas existentes. Se probaron el peor caso A3, la integración del exportador y cuatro
DXF representativos. No se modificaron reglas, findings, geometría, metrado, nesting ni INP.

## Cambios

- `criteriaNotesForVariant` acepta sólo criterios `assigned-type`, filtra `sheetVariants` y emite
  ID, límite, rol y tipo; un criterio agregado exclusivamente por finding nunca llega al DXF.
- `legendEntities` antepone esos criterios al override del usuario o a los defaults vigentes. Sin
  criterios aplicables devuelve exactamente las mismas entidades que la llamada histórica.
- La columna de notas reduce de forma determinista sólo su texto de filas cuando necesita alojar
  todos los criterios; en A3 con MP1/MP2/MP3/tabique no emite `(...)`.
- `resolveSheetSetup` colecciona criterios una vez por exportación y los comparte con framing, OSB,
  cerchas y fundaciones. Ninguna regla vigente aplica a fundaciones.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Criterios por variante | PASS | matriz framing/OSB/truss/foundations en `r8SheetCriteria.test.mjs` |
| Sólo roles/tipos asignados | PASS | la entrada usa `collectApplicableCriteria(model, [])` |
| Findings fuera del plano | PASS | un criterio `source: finding` produce cero notas |
| ID, límite, rol y tipo | PASS | dos límites distintos de `muro.montante.paso` se conservan |
| Notas de usuario/defaults | PASS | ambas quedan después de los criterios |
| Baseline sin roles | PASS | entidades de leyenda `deepEqual` byte a byte |
| Peor caso A3 | PASS | cuatro roles; todos los IDs; cero `(...)` |
| Integración DXF | PASS | lámina real A3 contiene criterio antes del override |
| Auditoría DXF | PASS | cuatro variantes AC1015 con 0 errores / 0 reparaciones |
| INP | Fuera del corte | no se modifican generadores, emisores ni archivos INP |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 29 decisiones |
| `npm run validate` con Node 22 | PASS | 701/701; laboratorio 35/35; build OK |
| Pruebas focalizadas R8-C | PASS | 5/5 |
| Cobertura oficial core | PASS | 93,07 % de líneas |
| Cobertura oficial store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos: 140 idénticos, 47 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 317 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 701,70 kB raw / 217,88 kB gzip |
| `ezdxf doc.audit()` | PASS | 4 DXF A3 AC1015; 0 errores / 0 reparaciones cada uno |
| Smoke CalculiX | No aplica | el corte C no modifica INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Dejar de pasar los criterios coleccionados al generador de lámina | 1: integración criterio/notas en el DXF |

## Desviaciones y deudas descubiertas

- El shell conserva Node 20 por defecto; las puertas se ejecutan con Node 22.23.1 explícito bajo
  R-011.
- `ezdxf` se instaló en un entorno temporal y no agrega dependencias runtime. `SPEC-003` debe
  fijar el entorno reproducible para la auditoría global.
- R8 verifica las cuatro variantes representativas, pero no sustituye el arnés de todos los DXF
  exigido por `REQ-DXF-001`.
- La spec no cambia geometría, modelos persistidos ni archivos INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
