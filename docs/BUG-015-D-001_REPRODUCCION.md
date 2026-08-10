# BUG-015-D-001 — Identificación de grafos dependiente de IDs internos

## Estado

Registrado antes de implementar SPEC-015-D.

## Reproducción

El prototipo inicial de Fase A mostraba nodos laterales mediante `roofGeometryId` y `elementId` como
identificación principal. El usuario no puede reconocer de memoria esos IDs y el flujo contradice
la localización visual cerrada por SPEC-015-C-1.

## Resultado esperado

Toda lista, selector, grafo, tooltip y `aria-label` debe usar como rótulo principal un descriptor
geométrico humano, preview contextual y acción `Localizar`. El ID canónico se conserva sólo como
referencia técnica secundaria y para identidad de máquina.

## Regresión requerida

Una prueba debe fallar si aparece `Muro <id>` o `Cubierta <id>` como única identificación, y otra
debe demostrar que localizar no modifica selección global, historial, intención ni trace.
