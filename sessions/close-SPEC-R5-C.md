# Cierre — SPEC-R5 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R5-wall-types.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; ezdxf 1.4.4 |

## Alcance ejecutado

Se cerró exclusivamente la adopción de tipos/roles en consumidores de modulación, gap y DXF,
nesting y React. No se agregaron reglas geométricas R7, encuentros L/T R6, cambios de metrado ni
emisores INP.

## Cambios

- Modulación individual, batch y “Generar todos” consumen `resolveWallTypeConfig`; el tipo gana
  sobre overrides divergentes y el camino sin tipo conserva la precedencia legacy.
- Los patches de regeneración persisten perfiles, paso, placa y `osbGap` efectivos. Preview,
  DXF R12 y láminas AC1015 consumen el gap persistido por muro con fallback global legacy.
- El nesting propaga el rol a cada pieza y eliminó `allowRotation` del contrato observable:
  sólo `tabique` rota; MP1/MP2/MP3 y ausencia de rol permanecen conservadores.
- El modal común incorpora findings `wallRole` y `wallType`, conservando navegación mediante
  `wallIds`.
- React incorpora CRUD de tipos, asignación/quita al crear o editar muros, lectura visible de
  tipo/rol/configuración efectiva y controles de override deshabilitados en muros tipados.
- “Generar todos” se habilita cuando al menos un muro tiene configuración efectiva completa, no
  sólo cuando existe el default global histórico.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 8. Resolución efectiva común | PASS | fixture 90/60 genera perfiles, pasos y gaps distintos sin overrides |
| 9. `osbGap` y compatibilidad legacy | PASS | patches persistidos; preview/DXF por muro; R12 y AC1015 conservan bytes con gap equivalente |
| 10. Rotación por rol | PASS | sólo `tabique` rota; flag antiguo ignorado y ausente del resultado |
| 11. Coordinación UI | PASS | CRUD, asignación, tipo/rol efectivo, controles tipados bloqueados y flujo legacy explícito |
| 12. Prueba de la prueba C | PASS | neutralizar precedencia y rotación produce un fallo focalizado en cada contrato |
| 13. Puertas oficiales y DXF | PASS | validación integral verde; siete DXF auditados 0/0 |

Los criterios 1–5 quedaron cerrados en R5-A y los criterios 6–7 en R5-B. Con este corte, R5 queda
completa.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 20 decisiones |
| Pruebas focalizadas R5-C | PASS | 36/36 |
| `npm run validate` con Node 22 | PASS | 625/625; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 92,33 % de líneas |
| Cobertura oficial del store | PASS | 67,82 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 146 idénticos; 41 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 284 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 656,06 kB raw / 202,80 kB gzip |
| Advertencias locales | PASS | `warnings.push` permanece en 51 |
| `ezdxf doc.audit()` | PASS | 1 R12 + 6 AC1015; 0 errores / 0 reparaciones cada uno |
| Smoke CalculiX | No aplica | R5-C no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Precedencia exclusiva del tipo neutralizada temporalmente | 1/1 |
| Rotación derivada del rol neutralizada temporalmente | 1/1 |

Ambos arreglos se restauraron y sus 28 pruebas focalizadas volvieron a pasar antes de la
validación integral.

## Desviaciones y deudas descubiertas

- No apareció una decisión nueva. R5 queda cerrada y la siguiente unidad es la preparación de R6.
- La eliminación de perfiles referenciados por `wallTypes` sigue registrada en `STATUS.md` y
  R-005; no se amplió R5-C hacia mutadores de biblioteca.
- El manifiesto registra doce archivos existentes bajo `SPEC-R5`, preservando hashes de origen.
  La limitación de `--record` con `SPEC-Rn` permanece bajo R-011; su regex se amplió
  temporalmente y se restauró sin diff final.
- Los siete DXF auditados se generaron en `/tmp` y no se incorporaron como artefactos.
- El chunk inicial aumenta 9,68 kB raw / 2,68 kB gzip respecto de R5-B; el warning existente
  continúa bajo R-010 / `SPEC-005`.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
