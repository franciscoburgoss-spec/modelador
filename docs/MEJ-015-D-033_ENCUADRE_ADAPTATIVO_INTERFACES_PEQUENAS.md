# MEJ-015-D-033 — Encuadre adaptativo para interfaces pequeñas

## Estado

**Pendiente no bloqueante.** Registrada durante la validación visual final de SPEC-015-D REV8 el
10-ago-2026. No forma parte del cierre funcional de REV8.

## Observación real

Al localizar la interfaz `Cara −N · Muro Y · B→I @ 6` con `S 1949.45→2050.55`, el subtramo de
aproximadamente 101,10 mm queda correctamente dibujado y la Correctiva 18 desplaza la etiqueta
fuera de la evidencia. Sin embargo, `Encuadrar` conserva un contexto de planta amplio respecto del
tamaño del objetivo, por lo que el usuario todavía debe acercarse manualmente para inspeccionarlo
con comodidad.

## Mejora propuesta

Cuando `visibleBounds` sea muy pequeño respecto del viewport/modelo, aplicar un encuadre adaptativo
con un margen mínimo expresado en pantalla y un límite razonable de zoom, manteniendo el objetivo
centrado y legible.

## Invariantes

La mejora futura no debe:

- modificar `sRange`, `zRange`, `faceSegment` ni geometría del host;
- mutar selección global, intención, review, trace o historial;
- cambiar `candidateLoadPaths` ni la semántica estructural;
- convertir una interfaz en acción, apoyo, capacidad o dirección resistente;
- introducir una dependencia de solución constructiva.

## Criterio de aceptación futuro

Una interfaz del orden de 100 mm debe ocupar una fracción útil del viewport inmediatamente después
de `Encuadrar`, manteniendo visible su contexto local y su llamada exterior sin recortar la evidencia.
