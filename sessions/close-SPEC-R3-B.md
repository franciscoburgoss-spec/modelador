# Cierre — SPEC-R3 / corte B

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R3-cadenetas.md`, corte B |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; ezdxf 1.4.4 |

## Alcance ejecutado

Se cerró exclusivamente el corte B: representación de la cadeneta real en los emisores visuales,
capa `MONTANTES`, rótulo `CD`, leyenda A3 y nota de junta condicionada a la existencia de piezas.
La exclusión del INP, el kerf independiente y el metrado permanecen en los cortes C y D.

## Cambios

- El DXF de tabiquería dibuja cada `role:'nogging'` directamente con `oMin/oMax/zMin/zMax`, sin
  tratarlo como un montante vertical ni inventar una altura.
- `ROLE_TAG` incorpora `nogging: 'CD'`; el rótulo se ubica al centro de la pieza y no aparece en
  muros sin cadeneta.
- La simbología de framing incorpora `CD = Cadeneta` y conserva todas sus filas en formato A3.
- La elevación principal, el preview Metalcon y el preview OSB consumen la misma banda persistida.
- El plano OSB usa `wall.studs` como única fuente, dibuja la cadeneta en `MONTANTES` y sólo emite
  `CADENETA + HUINCHA` cuando existe al menos una pieza en esa junta.
- La tabla OSB deja de listar el subproducto heredado; el metrado real por pieza corresponde al
  corte D.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. `wall.osbNoggings` deja de ser fuente del dibujo | PASS | exportador y previews consumen `wall.studs` |
| 3. Banda centrada y B real | PASS | 493 piezas de `casa-L`; alto 38 mm; constante de 60 mm eliminada |
| 8. Rótulo y leyenda `CD` | PASS | 493 rótulos en R12; ausencia sin pieza; A3 sin truncado |
| 10. Auditoría DXF | PASS | 2 R12 + 12 AC1015 con 0 errores / 0 reparaciones |
| Consistencia de consumidores | PASS | DXF, elevación principal y ambos previews usan `zMin/zMax` |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 17 decisiones |
| `npm run validate` con Node 22 | PASS | 574/574; laboratorio 35/35; build OK |
| `npm run test:coverage` | PASS | core 91,06 %; store 63,08 % |
| `npm run verify:migration` | PASS | 187 archivos; 160 idénticos; 27 cambios registrados; 2 fixtures |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| `ezdxf doc.audit()` sobre `casa-L` regenerada | PASS | 14 DXF; 0 errores / 0 reparaciones cada uno |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Geometría especial de cadeneta en DXF | 1/1: desaparece la banda real |
| `ROLE_TAG.nogging = CD` | 1/1: el rótulo queda indefinido |
| Fuente real y nota condicional en plano OSB | 1/1: desaparecen banda y nota |
| Adaptación de la elevación principal | 1/1: no se dibuja la pieza horizontal |
| Adaptación del preview Metalcon | 1/1: se omite la banda |
| Adaptación del preview OSB | 1/1: se omite la banda |
| Fila `CD = Cadeneta` de la leyenda | 1/1: falta la traducción |
| Eliminación de la altura gráfica de 60 mm | 1/1: reaparece la constante prohibida |

## Desviaciones y deudas descubiertas

- No hubo cambio de diagnóstico ni decisión nueva. Los 14 DXF se generaron en un directorio
  temporal y no se incorporaron como artefactos al repositorio.
- El chunk inicial subió de 630,77 a 631,30 kB raw; el warning existente continúa bajo R-010 /
  `SPEC-005`.
- La limitación de `migration-manifest --record` con `SPEC-Rn` permanece registrada bajo R-011;
  se usó el mismo procedimiento reversible del corte A, sin cambio final al script.
- Los criterios 6, 7 y 9 de la spec permanecen abiertos para los cortes C y D.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
