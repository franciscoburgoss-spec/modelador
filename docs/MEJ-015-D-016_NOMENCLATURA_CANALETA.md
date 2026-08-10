# MEJ-015-D-016 — Nomenclatura no ambigua para gutterSupport

## Problema

El rótulo `Apoyo de canal` podía leerse como apoyo gravitacional global de la cubierta.

## Corrección REV7

El valor canónico persistido permanece exactamente `gutterSupport`, pero su rótulo humano pasa a:

`Soporte local de canaleta`

La ayuda contextual aclara expresamente que:

- conserva una función local asociada a la canaleta;
- no declara apoyo gravitacional de la cubierta;
- no convierte al elemento vecino en receptor resistente;
- no inicia propuestas resistentes en SPEC-015-D.

No hay migración ni cambio de esquema persistente.
