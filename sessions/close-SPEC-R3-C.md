# Cierre — SPEC-R3 / corte C

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R3-cadenetas.md`, corte C |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21; CalculiX 2.23 |

## Alcance ejecutado

Se cerró exclusivamente el corte C: exclusión explícita de `role:'nogging'` del modelo CalculiX y
default de kerf propio de 5 mm, independiente del gap entre placas OSB. El metrado permanece en el
corte D.

## Cambios

- El adaptador CalculiX filtra las cadenetas antes de crear nodos, elementos, soleras y secciones.
- `casa-L` regenerada conserva el baseline anterior a R3 de 1.529 nodos y 1.104 elementos, sin
  `NaN` ni `Infinity`.
- El modal de nesting inicializa el corte de sierra en 5 mm y ya no lee `model.osbDefaults.gap`.
- Dos pruebas automáticas fijan el baseline numérico y la independencia del kerf.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 6. Cadenetas fuera del `.inp` | PASS | `r3Cadenetas.test.mjs`: 1.529 nodos / 1.104 elementos antes y después de R3 |
| 9. Kerf desacoplado | PASS | estado inicial `useState(5)` y ausencia de lectura de `osbDefaults.gap` |
| 11. Prueba de la prueba | PASS | dos reversiones independientes; una falla esperada cada una |
| 12. Suite y build | PASS | 576/576, laboratorio 35/35 y build Vite |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 17 decisiones |
| `npm run validate` con Node 22 | PASS | 576/576; laboratorio 35/35; build OK |
| `npm run test:coverage` | PASS | core 91,10 %; store 63,08 % |
| `npm run verify:migration` | PASS | 187 archivos; 159 idénticos; 28 cambios registrados; 2 fixtures |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| `ccx -i wall_nogging` | PASS | guarda recorrida con cadeneta presente; 22 nodos, 13 elementos; job finished |
| `ccx -i foundation` + parser DAT | PASS | 20 desplazamientos; 3 filas; 0 nodos faltantes |
| Auditoría DXF | No aplica | el corte C no modifica emisores ni archivos DXF |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Filtro `role !== 'nogging'` en CalculiX | 1/1: sube de 1.529/1.104 a 1.536/1.597 |
| Default propio de kerf | 1/1: reaparece la lectura de `osbDefaults.gap` |

## Desviaciones y deudas descubiertas

- El smoke diagnóstico del INP global de `casa-L` llega a `job finished`, pero CalculiX reporta
  que los nombres `ELSET` con IDs persistidos largos se truncan a 20 caracteres y las secciones no
  encuentran sus conjuntos. Es anterior e independiente de las cadenetas; quedó registrado bajo
  R-007 y no amplió este corte.
- La ruta modificada sí tuvo smoke real sin errores con un muro de ID corto y una cadeneta presente.
  El parser real se verificó además con el modelo de fundaciones.
- La primera invocación de `validate` tomó Node 20 desde la shell y se detuvo al no reconocer las
  opciones de cobertura; la puerta completa se repitió y pasó con Node 22.23.1.
- El chunk inicial permanece en 631,30 kB raw; el warning existente continúa bajo R-010 /
  `SPEC-005`.
- La limitación de `migration-manifest --record` con `SPEC-Rn` permanece bajo R-011; se usó el
  mismo procedimiento reversible de los cortes A/B, sin cambio final al script.
- No hubo una decisión nueva. El criterio 7 de la spec permanece abierto para el corte D.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
