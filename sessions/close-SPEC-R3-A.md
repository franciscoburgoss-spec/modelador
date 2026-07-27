# Cierre — SPEC-R3 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R3-cadenetas.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el corte A: orden sin ciclo entre juntas OSB y modulación Metalcon,
cadenetas reales con `role:'nogging'` en `wall.studs`, despiece cara a cara mediante
`studFlangeSpan` y guarda D-021 para que esas piezas no alteren el despiece de placas. Dibujo,
leyenda, exclusión del INP, kerf independiente y metrado permanecen en los cortes B–D.

## Cambios

- `computeCourseBreaks` expone las juntas horizontales sin depender de montantes.
- La modulación Metalcon genera cada cadeneta entre caras de montantes consecutivos, conserva
  cortes por vano y usa el B real del perfil para su banda.
- El compositor resuelve altura, juntas y perfil antes de persistir framing; perfiles con ID
  textual se normalizan al identificador canónico.
- OSB ignora explícitamente `role:'nogging'` al calcular apoyos y limpia el derivado heredado
  `wall.osbNoggings`.
- Cambiar la altura de placa OSB invalida centralmente framing y placas, porque mueve las juntas.
- La previsualización Metalcon omite temporalmente estas piezas hasta que el corte B incorpore su
  representación real.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Pieza real en `wall.studs` | PASS corte A | 40 muros con `role:'nogging'`; `osbNoggings` queda vacío |
| 2. Despiece cara a cara | PASS | 67 corridas producen 493 piezas y 134.551 mm; ninguna solapa un montante |
| 4. Guarda D-021 | PASS | placas de `casa-L` y compositor `deepEqual` contra el baseline |
| 5. Cortes por vano | PASS | puerta sobre junta produce corridas izquierda/derecha sin cruzar el vacío |
| Invalidez derivada | PASS | cambiar `panelHeight` invalida framing y OSB |
| Compatibilidad de IDs | PASS | IDs de perfil textuales resuelven B real y se persisten canónicos |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 17 decisiones |
| `npm run validate` con Node 22 | PASS | 566/566; laboratorio 35/35; build OK |
| `npm run test:coverage` | PASS | core 90,76 %; store 63,08 % |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| `npm run verify:migration` | PASS | 187 archivos; 163 idénticos; 24 cambios registrados; 2 fixtures |
| DXF / CalculiX | No aplica | el corte A no modifica DXF ni INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Incorporación de cadenetas en `wall.studs` | 1/1: `casa-L` vuelve de 40 muros a 0 |
| Límites desde `studFlangeSpan` | 1/1: las piezas dejan de terminar cara a cara |
| Filtro D-021 en apoyos OSB | 1/1: cambia el despiece de placas |
| Exclusión de piezas que cruzan un vano | 1/1: aparece una pieza sobre el vacío |

## Desviaciones y deudas descubiertas

- La estimación de la spec (≈506 piezas / ≈136,87 m con B uniforme) se reemplaza por el resultado
  exacto de `studFlangeSpan`: 493 piezas / 134,551 m.
- Se detectaron 6 piezas menores a 30 mm. Su absorción o rechazo requiere una regla constructiva
  de R7; este corte conserva la geometría exacta y no inventa esa regla.
- El registrador de `MIGRATION_MANIFEST.json` valida correctamente el manifiesto resultante, pero
  su comando `--record` sólo admite `SPEC-NNN`. Se registró la limitación bajo R-011 para
  normalizarla antes del próximo cambio de reglas de dominio.
- Los criterios 3 y 6–10 de la spec permanecen abiertos para los cortes B–D.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
