# MEJ-015-D-023 — candidateLoadPaths consume relaciones explícitas

## Estado

Implementado en REV8 para gravedad.

Una relación explícita, `fresh` y compatible tiene precedencia sobre el fallback geométrico del mismo borde. `support` se recorre `delivers→receives`; `loadTransfer` y `collectorAction` se recorren `receives→delivers`.

Reglas de seguridad:

- stale/broken bloquea la rama y no cae silenciosamente a geometría;
- un extremo que entrega no se convierte en apoyo por coincidencia geométrica;
- branching conserva ramas independientes;
- ciclos se bloquean;
- los paths siguen siendo `candidate`, nunca verificación resistente.
