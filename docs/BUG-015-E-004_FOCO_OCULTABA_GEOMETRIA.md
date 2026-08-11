# BUG-015-E-004 — el foco visual ocultaba la geometría fuente

## Síntoma observado

El foco B3 usaba un trazo negro grueso sobre C/6, C/7 y el frontón. En elementos estrechos el resaltado reemplazaba visualmente la geometría que debía explicar.

## Regla corregida

B3.1 mantiene el trazo geométrico original y usa un halo por `drop-shadow` como realce. No aumenta el espesor estructural ni sustituye el contorno fuente.

## Invariante

Seleccionar un foco sólo modifica estilo de presentación. No muta geometría, intención, historia, trace ni selección global.
