# SPEC-006-B — Alineación consumible de `agnostic-geometry-v1.0`

## Diagnóstico

SPEC-006-A separó correctamente el JSON de intercambio del archivo nativo y eliminó Metalcon, OSB,
biblioteca, derivados y estado UI. Sin embargo, la inspección independiente posterior al cierre
detectó una incompatibilidad contractual: SPEC-14 §3.1 exige una raíz con `elements[]` y consume
`elements[type=wall]`, mientras el exportador cerrado entrega colecciones raíz separadas `walls`,
`columns`, `beams` y `foundations`. Su algoritmo de referencia usa además
`model.get("elements", [])`; por tanto, con la salida actual obtiene cero muros aunque la geometría
esté presente.

El cierre de SPEC-006-A es inmutable y su evidencia demuestra separación/allowlist, no
compatibilidad extremo a extremo con el consumidor. La corrección debe conservar la geometría
resuelta y agnóstica; no debe reintroducir el modelo interno paramétrico ni datos constructivos para
imitar el JSON legacy.

## Decisión

Corregir la misma versión aún no liberada `agnostic-geometry-v1.0` antes de que tenga consumidores
productivos. La raíz tendrá una colección única `elements[]`; cada muro, columna, viga y fundación
declarará un discriminante `type` junto con la geometría explícita ya resuelta. Las superficies de
cubierta se publicarán como `roofGeometry[]`, nombre agnóstico recomendado por SPEC-14 §22.4, sin
cerchas, perfiles, paso, modulación ni solución estructural.

No se duplicarán simultáneamente `elements` y las cuatro colecciones antiguas: dos autoridades para
la misma geometría permitirían divergencia. Un consumidor contractual puro, independiente del
store, validará la entrada mínima de SPEC-14 y demostrará que `elements.filter(type=wall)` recupera
todos los muros y vanos. La adaptación del algoritmo topológico detallado de SPEC-14 desde prismas
resueltos pertenece a su futura spec de implementación; este corte sólo vuelve correcta y
consumible su frontera declarada.

## Ejecución Codex

- Esfuerzo planificado: `medium`
- Escalamiento xhigh: `prohibido`
- Motivo: es una corrección localizada de forma de esquema y pruebas de consumidor sobre una
  proyección ya implementada; no requiere rediseñar geometría ni ejecutar reglas topológicas.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Mantener colecciones separadas y adaptar silenciosamente SPEC-14 | Contradice su entrada obligatoria y perpetúa un contrato publicado que ningún consumidor literal puede usar |
| Duplicar `elements` y `walls`/`columns`/`beams`/`foundations` | Crea dos autoridades que pueden divergir y debilita el determinismo auditable |
| Volver a exportar referencias, fórmulas o campos del modelo v2 | Acopla nuevamente consumidores al store y contradice la geometría volumétrica agnóstica solicitada |
| Subir a `high` o `xhigh` | El fallo está reproducido y la transformación es mecánica/local; no hay insuficiencia observable de `medium` |

## Alcance

- Sustituir las cuatro colecciones raíz por `elements[]` con discriminantes `wall`, `column`,
  `beam` y `foundation`.
- Renombrar `roofs` a `roofGeometry` conservando exactamente las superficies resueltas.
- Mantener unidades, coordenadas, grilla, IDs, prismas, vacíos, sólidos, determinismo, validación y
  rechazo atómico de SPEC-006-A.
- Añadir un consumidor/validador puro de la entrada mínima de SPEC-14 que no importe store, React
  ni Tauri.
- Probar `casa-L`, FX-003, FX-004, modelo vacío, permutaciones y corpus adversario bajo la forma
  corregida.
- Actualizar componente y pruebas contractuales sólo donde observen la forma JSON.
- Actualizar estado, trazabilidad, riesgo y decisión sólo si la corrección cambia una autoridad
  estable; cerrar mediante `templates/SESSION_CLOSE.md`.

## Fuera de alcance

- Implementar reconocimiento topológico, clasificación estructural o cualquier fase R0–R9 de
  SPEC-14.
- Agregar `structuralIntent`, roles, materiales, perfiles, miembros, cerchas, posiciones de cercha,
  soluciones Metalcon/madera/SIP/albañilería, DXF o INP.
- Cambiar el archivo nativo, importación legacy, recovery, autosave o `modelVersion` 2.
- Alterar coordenadas, resolver nueva geometría o corregir el solver `roofPlane` cubierto por R-017.
- Editar el cierre inmutable `sessions/close-SPEC-006-A.md`.
- Usar `high`, `xhigh` o `max` para este corte.

## Criterios de aceptación

1. La raíz canónica contiene `schema`, unidades, coordenadas, `grid`, `elements` y
   `roofGeometry`; no contiene `walls`, `columns`, `beams`, `foundations` ni `roofs`.
2. Cada entrada de `elements` tiene ID único, `type` permitido y geometría explícita finita; el
   orden canónico es estable por tipo e ID o por una regla documentada equivalente.
3. Un consumidor puro de la entrada obligatoria de SPEC-14 acepta la salida, encuentra 45 muros de
   `casa-L` mediante `elements[type=wall]` y conserva sus 43 vanos.
4. FX-003 conserva sus tipos geométricos presentes y FX-004 conserva `roofGeometry` sin datos de
   solución constructiva.
5. La ausencia recursiva de claves prohibidas y todas las garantías de error previo al DOM,
   determinismo, newline, MIME, nombre y revocación de SPEC-006-A siguen verdes.
6. La descarga del menú produce la forma corregida y el archivo nativo continúa conservando
   Metalcon/OSB y `modelVersion` 2.
7. Una prueba de reversión demuestra que restaurar colecciones raíz separadas hace fallar el
   consumidor contractual de SPEC-14 y que la restauración deja la suite verde.
8. `make governance`, pruebas enfocadas, cobertura, `npm run validate`, build y auditoría del
   lanzador pasan; el cierre confirma `medium` planificado, enviado y efectivo, sin escalamiento.

## Evidencia

- Pruebas de objeto raíz exacto y ausencia de autoridades duplicadas.
- Consumidor puro de contrato SPEC-14 con `casa-L` y modelo mínimo.
- Regresiones de fixtures, determinismo, corpus adversario, DOM, componente y archivo nativo.
- Prueba de la prueba retirando transitoriamente `elements[]`.
- `make governance`, `npm run validate`, `npm run codex:audit` y `git diff --check`.
- Cierre `sessions/close-SPEC-006-B.md` y eventos append-only en
  `governance/CODEX_EXECUTIONS.jsonl`.

## Corte sugerido

Detener cuando la frontera JSON sea literalmente consumible por la entrada mínima de SPEC-14, sin
implementar todavía su normalización topológica ni migrar el modelo interno.
