# Cierre — SPEC-014-B / R3–R5

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-014-B` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No |

## Alcance ejecutado

Se implementaron exclusivamente R3–R5 sobre la salida pura R0–R2 de
`recognized-structural-topology-v1.0`. R3 reconoce cuatro estados de apilamiento y conserva
intervalos/métricas; R4 fija A=X/B=Y, clasifica encuentros con cobertura y bandas Z explícitas; R5
crea y unifica nodos por muro preservando roles, relaciones, vanos y cobertura vertical.

R6–R12, `structuralIntent`, modelo v3, UI, store, exportadores, soluciones constructivas y SPEC-08
permanecen fuera. Ningún rol MP1/MP2/MP3/tabique participa en el resultado. `eligibleForSpec08`
continúa en `false` y F-009 permanece abierto como P1.

## Cambios

- `recognizedStructuralTopology.js` agrega relaciones R3/R4 únicas y bidireccionales, warnings y
  findings bloqueantes, bandas verticales y nodos R5 ordenados con IDs estables.
- `spec14RecognitionR3R5.test.mjs` cubre los cuatro apilamientos, estados START/END/MID/OUTSIDE,
  cuatro coberturas Z, umbral estricto, unificación, fuentes, no inferencia y permutación.
- La regresión `casa-L` fija 45 muros, 43 vanos, 60 encuentros R4, 201 nodos R5, 26 findings y el
  hash canónico `ba783496503c0f9d1da5ebb0cf18a603169e239eba1b07306f02502630cb09e6`.
- `evidence/SPEC-014-B` contiene SVG/manifiesto reproducibles con 13 nodos del muro R-VIS-05,
  encuentros y una cobertura `PARTIAL_A_FULL_B`; se declara que no es un plano de ejecución.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Cuatro apilamientos, métricas, simetría y findings | PASS | Caso sintético R3 con EXACT/PARTIAL/OVERLAP/GAP y consultas desde ambos muros |
| 2. Límites parciales y rechazo sin solape S | PASS | `commonS=[400,1000]` en ambos muros; par disjunto produce R3=0 |
| 3. Esquina, ambas T, cruce, OUTSIDE y umbral Z | PASS | A=X/B=Y estable bajo permutación; OUTSIDE y `overlapZ=minimumOverlap` producen R4=0 |
| 4. Cuatro coberturas y bandas Z | PASS | FULL_BOTH sin warning; tres contactos parciales con bandas no nulas y tres warnings exactos |
| 5. MID–MID ambiguo y SPEC-08 bloqueada | PASS | Un finding blocking por cruce; `casa-L` conserva uno; `eligibleForSpec08=false` |
| 6. Eventos R5, unificación y orden | PASS | Extremos, vano, encuentro y apilamiento unificados a `[0,200,400,800,1000]`, conservando roles/IDs |
| 7. Relaciones y referencias resolubles | PASS | Simetría R2–R4; `nodeIds`, `relationIds`, `openingIds` y `wallIds` validados |
| 8. Determinismo y no mutación | PASS | Permutación real/sintética `deepEqual`, repetición, SHA-256 idéntico y fuente intacta |
| 9. Regresión y evidencia `casa-L` | PASS | 45/43; R3=0, R4=60, R5=201; SVG/manifiesto con muro `1784670218571` |
| 10. Fases y grafo puro | PASS | `[R0..R5]`, R6–R12 pendientes; grafo limitado a dos módulos agnósticos |
| 11. Reversión | PASS | Retirar la guarda Z hizo fallar 1/1 el umbral estricto; restauración verde |
| 12. Puertas y esfuerzo | PASS técnico / G0 pendiente | Gates técnicos verdes; `high` planificado/enviado/efectivo; launcher actual aún abierto |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas R0–R5 | PASS | 15/15; R3–R5 4/4 |
| `npm run validate` con Node 22.23.2 | PASS hasta `codex:audit` | 842 Node; 21 componentes; 9 Rust; 35 lab; 18 goldens; DXF 0/0; CCX 3/3; build OK |
| Cobertura oficial | PASS | core 93,10 %; store 95,48 % |
| `npm run build` | PASS | 290 módulos; warning inicial R-010 conocido de 767,05 kB |
| `npm run codex:audit` | BLOQUEADO | La ejecución `52e0dda5-608c-4471-b2d1-6c520be64e9b` espera retornar |
| `make governance` | BLOQUEADO | Misma ejecución pendiente y reintento previo recuperable sólo después de su cierre |
| `xmllint --noout` | PASS | SVG B bien formado |
| `git diff --check` | PASS | Sin errores de whitespace en rutas ya seguidas; formato oficial cubre 466 archivos al cierre |

El lanzador recibió `high`. Al retornar leerá este cierre, comparará `high == high == high`, anexará
`launch_completed` y permitirá que esta ejecución recupere el intento exacto fallido
`faac5e24-1492-4e58-a15f-fe8f2414a800`. No se adelanta ni simula ese evento desde la ejecución
hija.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Retirar temporalmente `overlapZ > minimumOverlap` de R4 | 1/1: el contacto en el umbral produjo una intersección indebida |
| Restaurar la guarda estricta y estable ante IEEE-754 | 0; caso focalizado verde |

## Desviaciones y deudas descubiertas

- El sandbox permite leer `.git` pero no crear la rama `spec/014-B-apilamientos-intersecciones-nodos`;
  el corte se preservó sobre la rama existente sin modificar refs ni descartar el árbol heredado.
- Quick Look y `sips` no materializaron un bitmap del SVG dentro del sandbox. XML, contenido,
  relaciones, bandas, nodos y hashes se validan automáticamente byte a byte.
- No se modificaron DXF ni INP; auditoría y smoke se ejecutaron sólo como regresión.
- `casa-L` no contiene pares R3; los cuatro estados quedan fijados por el fixture sintético. La
  ausencia real se registra como conteo cero, no se rellena con una inferencia.
- F-009 conserva severidad P1. R6–R12 y cualquier consumo constructivo requieren specs nuevas.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-054 ya vigente; no se duplicó la decisión
