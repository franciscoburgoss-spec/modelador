# Cierre — SPEC-R6 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R6-wall-junctions.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente la autoridad geométrica de R6: frame local canónico, proyección de
offsets, topología global por nodos/bandas Z, vista completa por muro y prioridad de traslape L.
Metalcon, invalidación, batch, leyenda, metrado y envolvente OSB no adoptan aún el resultado;
corresponden a R6-B/C.

## Cambios

- `elementGeometry` normaliza el origen del muro al extremo de menor coordenada y declara dónde
  queda el inicio original. `wallOffsetToWorldPoint` proyecta desde ese frame y conserva offsets
  negativos o mayores al largo.
- `wallJunctions` resuelve todos los muros una vez, agrupa extremos con tolerancia explícita de
  5 mm, incorpora segmentos anfitriones y parte cada coordenada por cotas Z.
- Cada banda conserva participantes, offsets, posición `start|end|body`, eje y rayos; clasifica
  `L`, `T`, `straight`, `terminal`, `X` o `ambiguous`, y fusiona bandas adyacentes equivalentes.
- La salida, IDs de nodo y candidato primario son invariantes al orden de `model.elements`.
  Geometría no resoluble y tipos no adoptables quedan explícitos en `unresolved`, `issues` o
  `unsupported`.
- La prioridad L implementa largo descendente, `|dx|` descendente e ID estable ascendente,
  incluidos enteros-string. Estados `lap|butt` contradictorios entre bandas se consolidan como
  `ambiguous`.
- El fixture nuevo cubre una L con muro invertido y una T extremo-cuerpo. `casa-L` reproduce sin
  correcciones los 80 nodos/bandas medidos durante la preparación.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Frame único en ambos sentidos | PASS | X/Y forward/reverse; studs, headers, OSB y puntos mundo `deepEqual`; offsets extendidos |
| 2. Clasificación y bandas Z | PASS | L, T, recta, terminal, X, solape ambiguo, Z disjunto y parcial |
| 3. Orden, matches y offsets normalizados | PASS | permutación completa `deepEqual`; T sobre host dividido conserva ambos matches |
| 4. Prioridad L total | PASS | largo, `|dx|`, IDs numéricos/string/UUID y conflicto vertical explícito |
| 7. Diagnóstico topológico `casa-L` | PASS parcial de A | 23 L + 35 T + 18 straight + 4 terminal = 80; cero unresolved/ambiguous |
| 13. Prueba de la prueba A | PASS | revertir frame y clasificación L rompe una prueba focalizada por separado |
| 14. Puertas oficiales | PASS | gobernanza y validación integral verdes |

Los criterios 5–6 y la parte generativa de 7 corresponden a R6-B; 8–9 a R6-C; 10–12 se cierran
en B/C según el corte definido por la spec.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 23 decisiones |
| Pruebas focalizadas R6-A | PASS | 12/12 |
| `npm run validate` con Node 22 | PASS | 637/637; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 92,54 % de líneas; `wallJunctions.js` 97,21 % |
| Cobertura oficial del store | PASS | 67,82 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 145 idénticos; 42 cambios registrados; 2 fixtures baseline |
| `npm run verify:artifacts` | PASS | 290 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 656,38 kB raw / 202,92 kB gzip |
| Auditoría DXF | No aplica | R6-A no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | R6-A no modifica generadores, emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| `wallOffsetToWorldPoint` restaurado temporalmente al origen declarado | 1/1: muro invertido proyecta offset 1000 en x=3000 |
| Clasificación perpendicular L neutralizada temporalmente | 1/1: desaparece el nodo L esperado |

Ambos arreglos se restauraron y las 12 pruebas focalizadas volvieron a pasar antes de la
validación integral.

## Desviaciones y deudas descubiertas

- No hubo corrección del diagnóstico: `casa-L` confirma exactamente 23 L, 35 T, 18 rectas y
  cuatro terminales, sin muros no resolubles ni bandas ambiguas.
- La topología aún no es consumida por generadores. Los 88 `backup` legacy y la invalidación
  solamente local permanecen hasta R6-B; no se presentó este corte como corrección estructural.
- El fixture R6 es focalizado y no cierra R-006 / REQ-TST-001, que exige otra planta y perfiles
  distintos como fixture integral independiente.
- El registrador de migración sigue sin aceptar `SPEC-Rn`: se amplió sólo para registrar el hash
  post-migración de `elementGeometry.js` y se restauró sin diff final.
- No surgió una decisión nueva ni se modificaron DXF/INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
