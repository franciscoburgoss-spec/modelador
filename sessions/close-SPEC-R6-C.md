# Cierre — SPEC-R6 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R6-wall-junctions.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; ezdxf 1.4.4 |

## Alcance ejecutado

Se cerró exclusivamente la envolvente OSB R6: insets firmados de media cara en L, traslado de
vanos/montantes/corredores al origen efectivo, coordinación individual/batch/combinada,
representación en preview, R12 y AC1015, rebaseline final de `casa-L` y soporte oficial de
identificadores `SPEC-Rn` en el registrador de migración. R7–R8 permanecen fuera de alcance.

## Cambios

- `resolveWallOsbEnvelope` deriva `osbStart`, `osbEnd` y `osbLength` desde la vista topológica:
  `lap` prolonga media cara del vecino y `butt` se retranquea media cara.
- El solver traslada internamente studs y vanos a `[0, osbLength]`; `MIN_EDGE_MARGIN`, footprints
  y corredores usan esa envolvente. Los offsets persistidos vuelven al frame nominal y pueden ser
  negativos o mayores que el largo estructural.
- T y encuentros no L conservan `deepEqual`; una prioridad L, espesor o envolvente irresoluble
  bloquea la operación con todos los `wallIds` y cero patches parciales.
- La UI individual y batch consume una topología común, muestra el rango efectivo y presenta
  bloqueos explícitos. “Generar todos” conserva la misma topología entre framing y OSB.
- Preview ajusta su viewport a la placa efectiva. R12 y AC1015 dibujan un contorno OSB propio,
  separado del contorno nominal `MURO-REF`, y sus extents incluyen prolongaciones/retranqueos.
- `casa-L` regenera 45 muros, 85 cursos y 408 piezas de placa. El nesting exige 284 placas de
  compra / 845,4112 m²; 16 muros se prolongan y 18 se retranquean, con extremos hasta
  −50,5/+50,6 mm. Framing permanece en 1.361 piezas / 2.500,147 m.
- `scripts/generate-r6c-evidence.mjs` reproduce el rebaseline y los ocho DXF sin incorporar
  outputs generados al repositorio.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 8. Insets L; T/no L nominales | PASS | L asimétrica y en ambos extremos; T `deepEqual`; vano y margen desde el borde efectivo |
| 9. Offsets extendidos sin cambiar estructura | PASS | preview, R12 y AC1015 representan 4.090 mm sobre muro nominal de 4.000; framing exacto preservado |
| 11. Topología única y atomicidad | PASS | OSB batch/combinado retornan cero patches ante `ambiguous-lap` o espesor irresoluble |
| 13. Prueba de la prueba C | PASS | neutralizar el origen efectivo cambia −40 a 0 y rompe la prueba L focalizada |
| 14. Puertas y DXF | PASS | validación integral; 1 R12 + 7 AC1015 auditados 0/0; smoke CCX ya cerrado en R6-B |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 23 decisiones |
| Pruebas focalizadas R6-C/batch | PASS | 18/18 |
| `npm run validate` con Node 22 | PASS | 657/657; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | sobre el umbral de 90 % |
| Cobertura oficial del store | PASS | sobre el piso oficial de 50 % |
| `npm run verify:migration` | PASS | 187 hashes; cambios R6 registrados con hashes de origen preservados |
| `npm run verify:artifacts` | PASS | fuentes/documentos inspeccionados |
| `npm run verify:derived` | PASS | exportadores y mutadores registrados |
| Build de producción | PASS | chunk inicial 671,56 kB raw / 208,04 kB gzip |
| `ezdxf doc.audit()` | PASS | 1 AC1009 + 7 AC1015; 0 errores / 0 reparaciones cada uno |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Neutralización temporal de `osbStart/osbEnd` al rango nominal `[0,length]` | 1/1: la L prolongada vuelve incorrectamente de −40 mm a 0 mm |

La reversión se restauró y la prueba focal volvió a pasar antes de la validación oficial.

## Desviaciones y deudas descubiertas

- La primera validación integral reveló que el contrato histórico de cadenetas comparaba contra
  un baseline OSB nominal. Se corrigió el arnés para comparar con/sin `nogging` bajo la misma
  topología; la regla D-021 sigue demostrada sin ocultar la nueva envolvente R6.
- El registrador de migración ya acepta `SPEC-NNN` y `SPEC-Rn`; aún no posee una prueba dedicada
  del CLI. La gobernanza todavía no descubre automáticamente specs bajo `specs/domain/`.
- No se modificó el emisor INP. El smoke CalculiX de R6-B sigue siendo la evidencia estructural:
  R6-C preserva exactamente piezas y metros de framing.
- No hubo una decisión nueva. D-023 ya fijaba los insets firmados de media cara.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
