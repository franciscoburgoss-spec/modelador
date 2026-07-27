# Cierre — SPEC-R6 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R6-wall-junctions.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; ezdxf 1.4.4; CalculiX 2.23 |

## Alcance ejecutado

Se cerró exclusivamente el framing R6: adopción de la topología global en Metalcon individual,
batch y combinado; pilar conformado L/T sin `backup`; invalidación vecinal; bloqueo atómico;
leyenda, metrado, DXF de framing y smoke CalculiX. La envolvente/origen OSB permanece en R6-C.

## Cambios

- Cada operación analiza una topología común. Los extremos L/T conservan un `corner`; el host T
  reclasifica un montante de altura completa o agrega uno exacto sin duplicarlo.
- Una T dentro de vano, contra pieza incompatible o con geometría ambigua devuelve razón,
  `wallIds` y cero patches; la UI presenta el bloqueo y no hace commit parcial.
- El solver deja de emitir `backup` y ya no consume `backupOffset`. El rol legacy sigue visible,
  metrado y exportado hasta regenerar.
- Agregar, editar geometría/niveles/espesor/dirección, eliminar, dividir o unir un muro invalida
  framing+OSB de todos los muros mediante el registro central; las cerchas conservan sólo su
  alcance dependiente. Vanos, tipos y configuración siguen locales.
- La leyenda nombra `T = Pilar conformado esquina/T`, conserva `R` como legacy y agrega la costura
  N°10x3/4" @150 mm en toda la altura, zig-zag.
- `casa-L` rebasa 45 muros a 109 `corner`, cero `backup`, 439 cadenetas, 1.361 piezas y
  2.500,147 m. Las 26 T directas tienen apoyo anfitrión.
- `scripts/generate-r6b-evidence.mjs` reproduce el rebaseline, los seis DXF auditados y el INP de
  smoke con IDs cortos, sin incorporar outputs generados al repositorio.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 5. L/T sin `backup` | PASS | L simple con dos `corner`; T con llegada+host exactos; generación nueva cero `backup` |
| 6. Reclasificación, alta y bloqueo T | PASS | stud existente sin duplicar, apoyo ausente agregado, vano/jamba bloquean con ambos IDs |
| 7. Rebaseline `casa-L` | PASS | 26 T; 109 corner; 439 cadenetas/136,447 m; 1.361 piezas/2.500,147 m |
| 10. Invalidación topológica | PASS | add/update/delete/split/merge global en muros; vanos/config locales; cerchas dependientes |
| 11. Operación coordinada/atómica | PASS | topología compartida; ambigüedad produce cero patches en Metalcon y combinado |
| 12. Leyenda y compatibilidad legacy | PASS | pilar+costura visibles; fixture importado conserva `backup` en render/metrado/export |
| 13. Prueba de la prueba B | PASS | reintroducir `backup` y quitar alcance vecinal rompen una prueba focalizada cada uno |
| 14. Puertas, DXF y CCX | PASS | validación integral; 6 DXF 0/0; CalculiX `Job finished` |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 23 decisiones |
| Pruebas focalizadas R6-B | PASS | 13/13 |
| `npm run validate` con Node 22 | PASS | 651/651; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | sobre el umbral de 90 % |
| Cobertura oficial del store | PASS | 72,76 % de líneas |
| `npm run verify:migration` | PASS | hashes de origen preservados; cambios R6 registrados |
| `npm run verify:artifacts` | PASS | fuentes/documentos inspeccionados |
| `npm run verify:derived` | PASS | exportadores y mutadores registrados |
| Build de producción | PASS | chunk inicial 668,64 kB raw / 207,02 kB gzip |
| `ezdxf doc.audit()` | PASS | 1 R12 + 5 AC1015; 0 errores / 0 reparaciones cada uno |
| `ccx -i casa-l-r6b` | PASS | 45 muros; 1.362 nodos; 1.012 elementos; `Job finished` |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Reintroducción temporal de `backup` a 100 mm en ambos extremos L/T | 1/1: la L deja de producir cero `backup` |
| Eliminación temporal del alcance global de `wallTopology` | 1/1: agregar un muro deja vecinos falsamente vigentes |

Ambas reversiones se restauraron y las 13 pruebas focalizadas volvieron a pasar antes del cierre.

## Desviaciones y deudas descubiertas

- Los conflictos de prioridad `lap|butt` entre bandas de `casa-L` gobiernan la envolvente OSB de
  R6-C; no vuelven ambiguo el pilar framing, que usa el mismo `corner` en ambas bandas.
- El INP reproducible renombra sólo los IDs del fixture de smoke porque el emisor global aún usa
  IDs persistidos demasiado largos en nombres `ELSET`; R-007 permanece abierto antes de G5.
- La generación combinada recalcula OSB sobre los nuevos apoyos, pero este cierre no modifica su
  origen/envolvente ni audita sus DXF; corresponde a R6-C.
- El registrador de migración aún no acepta `SPEC-Rn`: se amplió sólo durante el registro de hashes
  y se restauró sin diff final.
- No hubo una decisión nueva. D-021 y D-022 ya fijaban la autoridad y el pilar conformado.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
