# Cierre — SPEC-R5 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R5-wall-types.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente CRUD/asignación en el store, invalidación central de framing+OSB y
compatibilidad de `wallTypeId` al dividir/unir. No se adoptó la resolución efectiva en modulación,
gap/DXF, nesting ni React; esas fronteras permanecen en R5-C.

## Cambios

- El store expone `addWallType`, `updateWallType`, `removeWallType` y `assignWallType`; crear y
  editar validan la colección completa mediante el contrato puro de R5-A.
- Crear genera un ID estable; editar no permite cambiarlo. Errores de contrato son atómicos y no
  agregan historial.
- Crear, editar, eliminar y asignar son reversibles por undo/redo. Una asignación idéntica es un
  no-op explícito.
- Renombrar no invalida. Cambiar rol o defaults usa `wallTypeConfig` para marcar framing+OSB sólo
  en los muros usuarios; asignar/cambiar/quitar usa `wallTypeAssignment` sólo en el muro afectado.
- Invalidar conserva resultados y overrides, sólo marca stale; ninguna acción regenera.
- Eliminar un tipo usado devuelve `ok:false` con los `wallIds`; nunca desasigna ni deja
  referencias rotas en silencio.
- Dividir conserva `wallTypeId` en ambos tramos. Unir y listar candidatos exige igualdad exacta,
  considerando equivalentes referencia ausente y `null`.
- La matriz generada de derivados declara los dos nuevos dominios y vuelve a coincidir con el
  registro ejecutable.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 6. CRUD/asignación trazable | PASS | contratos de alta, edición, asignación, desasignación, undo y redo |
| 6. Invalidación selectiva | PASS | rol/defaults sólo afectan usuarios del tipo; asignación sólo al muro; rename no invalida |
| 6. Sin regeneración | PASS | studs/OSB y overrides se preservan, cambiando únicamente flags stale |
| 7. Eliminación segura | PASS | tipo usado bloqueado con `wallIds`; tipo libre se elimina con historial |
| 7. Split/merge compatible | PASS | split conserva tipo; merge/candidatos rechazan tipos distintos y aceptan igualdad/null |
| 12. Prueba de la prueba B | PASS | neutralizar detección de rol/defaults provoca 1 fallo de 5 en contratos del store |
| 13. Puertas oficiales | PASS | gobernanza, 616/616, laboratorio, cobertura y build aprobados |

Los criterios 1–5 quedaron cerrados en R5-A. Los criterios 8–11 corresponden a R5-C.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 20 decisiones |
| Pruebas focalizadas R5-B | PASS | 31/31 en store, derivados y split/merge |
| `npm run validate` con Node 22 | PASS | 616/616; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,43 % de líneas |
| Cobertura oficial del store | PASS | 67,82 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 151 idénticos; 36 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 280 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 646,38 kB raw / 200,12 kB gzip |
| Advertencias locales | PASS | `warnings.push` permanece en 51 |
| Auditoría DXF | No aplica | el corte B no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte B no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Detección de cambios de rol/defaults neutralizada temporalmente | 1/5 |

Restaurada la detección, las 31/31 pruebas focalizadas vuelven a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- `removeLibraryItem('metalconProfiles', id)` todavía puede eliminar un perfil referenciado por un
  `wallType`, dejando el modelo activo incompatible con el esquema v2. R5-B no amplía su alcance
  hacia mutadores de biblioteca; la deuda queda registrada en `STATUS.md` y R-005 antes de G4.
- El manifiesto registra cuatro archivos del baseline bajo `SPEC-R5` conservando sus hashes de
  origen. La limitación de `--record` con `SPEC-Rn` permanece bajo R-011; su regex se amplió
  temporalmente y se restauró sin diff final.
- El chunk inicial aumenta 2,84 kB raw / 0,73 kB gzip respecto de R5-A; el warning existente
  continúa bajo R-010 / `SPEC-005`.
- `validate-governance` aún no recorre `specs/domain/`; la revisión manual exigida por R-011 se
  realizó antes de implementar.
- No hubo una decisión nueva. El siguiente corte es R5-C.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DERIVED_STATE_MATRIX.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
