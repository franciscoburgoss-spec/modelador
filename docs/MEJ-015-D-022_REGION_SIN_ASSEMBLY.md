# MEJ-015-D-022 — Región estructural sin structuralAssembly

## Estado

Implementado en REV8.

`structuralRegion` se representa sólo como `{ownerRef,sRange,zRange}` dentro de `carrierRegions` de una relación. No existe colección raíz ni geometría nueva.

`structuralAssembly` se descarta en este corte porque el caso C/6→11A puede representarse con una relación `loadTransfer` y dos regiones sobre hosts existentes. Introducir assembly ahora duplicaría autoridad sin necesidad demostrada.
