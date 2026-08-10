# MEJ-015-D-019 — Localizar transversal

## Estado

Implementado en REV8 para interfaces, regiones y relaciones; conserva los targets REV7 de elementos, cubiertas y propuestas.

## Contrato

La presentación REV8 genera previews efímeros para:

- cara: host completo + línea de la cara física canónica;
- extremo: host + sección transversal del extremo;
- región: host completo + rango S/Z como resaltado, sin sólido nuevo;
- relación: hosts participantes + interfaces + segmentos de evidencia.

El localizador sigue viviendo fuera de `model`, history, trace y review. Una referencia rota no usa nearest-match.
