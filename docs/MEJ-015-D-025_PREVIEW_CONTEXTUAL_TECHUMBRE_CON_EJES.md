# MEJ-015-D-025 — Preview contextual de techumbre con geometría y ejes reales

## Objetivo

Convertir la identificación visual de cubiertas en una referencia espacial verificable, sin exigir conocimiento de IDs internos.

## Contrato visual

1. El polígono del preview usa los mismos puntos X/Y de la geometría agnóstica de la cubierta.
2. La proyección conserva una única escala para X e Y; no deforma la forma del faldón.
3. Y crece hacia abajo, igual que la vista Planta del modelador.
4. Sólo se dibujan los ejes X/Y nominales que coinciden con vértices del faldón dentro de 0,1 mm.
5. B1…Bn mantienen exactamente la correspondencia con `boundaryId` canónico.
6. El descriptor humano aparece antes de la referencia técnica.
7. `Localizar cubierta` reutiliza el localizador transitorio existente y muestra la misma geometría sobre la planta del proyecto.

## Alcance

Mejora de presentación y navegación. No agrega semántica estructural, no modifica el schema y no crea decisiones automáticas.
