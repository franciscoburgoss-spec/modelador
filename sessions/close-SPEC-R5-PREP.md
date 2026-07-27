# Cierre — SPEC-R5 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R5-wall-types.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se redactó y gobernó R5 antes de modificar código. La preparación midió el formato persistido,
defaults, overrides, migraciones, mutadores y consumidores afectados; fijó tres cortes cerrables.
No se implementó comportamiento.

## Cambios

- Se fijó `wallTypes` como colección superior y `wallTypeId` como única referencia desde el muro.
- Se declararon los cuatro roles sin escala ni herencia y `aplicaA` para las tres reglas existentes.
- Se especificó `modelVersion` 2 con migración conservadora, sin inferencia geométrica.
- Se separó la precedencia entre muro tipado (tipo manda) y muro sin tipo (compatibilidad legacy).
- Se cubrieron invalidación, split/merge, modulación, gap por muro, nesting y UI.
- La rotación queda permitida sólo para `tabique`; un caller ya no puede forzarla.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico medido | PASS | 45 muros sin rol/tipo y 45 con siete overrides en `casa-L`; esquema v1 inspeccionado |
| Decisión cerrada | PASS | shape, precedencia, migración, aplicación y rotación definidos |
| Alcance y exclusiones | PASS | R6/R7/R8, geometría, metrado e INP excluidos |
| Aceptación verificable | PASS | 13 criterios vinculados a pruebas, reversión y auditoría DXF |
| Cortes transaccionales | PASS | A contrato/migración; B store/invalidation; C consumidores/UI |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 20 decisiones |
| `npm run validate` con Node 22 | PASS | 598/598; laboratorio 35/35; build OK |
| `npm run verify:migration` | PASS | 187 archivos; 153 idénticos; 34 cambios registrados; 2 fixtures |
| Build de producción | PASS | chunk inicial 639,73 kB raw / 198,37 kB gzip |
| Auditoría DXF | No aplica | preparación documental; no se modificaron emisores ni DXF |
| Smoke CalculiX | No aplica | preparación documental; no se modificaron emisores ni INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad sólo emite el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- El roadmap no fijaba el shape persistido, el fallback legacy ni el mapa exacto de rotación. La
  spec los hace explícitos en D-019/D-020 sin inferir datos de los modelos existentes.
- `planWallMerge` toma hoy propiedades del tramo más largo; R5-B debe bloquear tipos distintos.
- El gap sigue siendo global para los emisores DXF; R5-C debe persistirlo por muro y auditar cada
  salida tocada.
- El fixture v1 específico de migración no sustituye el fixture integral independiente pendiente
  bajo R-006 / `SPEC-003`.
- `validate-governance` aún no recorre `specs/domain/`; la estructura se revisó manualmente.
- No hubo cambios de código, modelo, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
