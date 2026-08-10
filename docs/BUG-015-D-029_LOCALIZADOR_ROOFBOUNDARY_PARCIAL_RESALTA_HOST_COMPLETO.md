# BUG-015-D-029 — Localizador de `roofBoundary` parcial resalta el host completo

Fecha de registro: 2026-08-09
Estado inicial: abierto
Detectado durante: validación visual real en localhost posterior a Correctiva 14 / BUG-015-D-028.

Estado final: **cerrado 10-ago-2026** tras validación focal, integral y visual real.
## Reproducción gobernante

1. Mantener intacto el baseline de la primera techumbre.
2. En `Estructura → Intención estructural → Interfaces`, seleccionar la segunda cubierta `1785161146258`.
3. Seleccionar el borde canónico B1:
   - `boundaryId = roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c`
   - borde físico C/6→11A
   - longitud física 10.400 mm
   - rango físico S `[12800,23200]`.
4. Declarar sólo el subtramo S `[12800,14500]`, longitud 1.700 mm.
5. Persistir la interfaz y pulsar `Localizar interfaz` → `Encuadrar`.

## Resultado observado

La interfaz se persiste correctamente y el estado del localizador contiene:

- `boundary.start = {x:12800,y:2000,z:3650}`
- `boundary.end = {x:14500,y:2000,z:3650}`
- `visibleBounds = {xMin:12800,xMax:14500,yMin:2000,yMax:2000}`

Sin embargo, el canvas dibuja como objetivo seleccionado el polígono completo de la cubierta. Visualmente aparece resaltado el contorno del host completo, por lo que el usuario no puede distinguir que la interfaz localizada corresponde sólo al subtramo C/6→7.

## Diagnóstico

Correctiva 14 resolvió correctamente la semántica y el encuadre numérico del `sRange`. El defecto restante está en la capa de representación del canvas:

- `StructuralInterfacesPanel` entrega un preview especializado de tipo `proposal-relation` con `boundary` y `overlapSegments` limitados al subtramo.
- `fitStructuralIntentLocatorState()` consume correctamente `visibleBounds` parciales.
- `Canvas.jsx`, para `structuralIntentLocator`, ignora esa evidencia especializada y dibuja `preview.selected[]`, cuyo target de cubierta conserva el polígono completo del host.

Por tanto, el problema no es de persistencia, identidad ni bounds: es exclusivamente de **marcado visual del localizador**.

## Contrato de corrección

Para un `structuralIntentLocator.preview.kind === 'proposal-relation'` originado por una interfaz `roofBoundary`:

1. el canvas no debe dibujar el polígono completo de la cubierta como objetivo seleccionado;
2. debe dibujar sólo `preview.boundary` / `preview.overlapSegments` del subtramo declarado;
3. `Encuadrar` debe seguir usando `visibleBounds` parciales ya existentes;
4. la geometría normal del modelo puede permanecer visible como contexto, pero no marcada como objetivo de la interfaz;
5. no se debe cambiar `interfaceId`, `relationId`, schema, `modelVersion`, geometría agnóstica, `candidateLoadPaths` ni CalculiX;
6. `Localizar` continúa siendo temporal y no debe mutar intención, trace, review, selección ni historial.

## Compatibilidad

- Interfaces de borde completo sin `sRange` mantienen su comportamiento e identidad.
- Interfaces parciales conservan la semántica introducida por Correctiva 14.
- El cambio se restringe a la representación del localizador en `Canvas.jsx` y a pruebas de regresión.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 15. Localizador de B1 parcial validado visualmente después de `Encuadrar`: sólo el subtramo declarado queda como evidencia objetivo; la gobernanza asociada de Canvas quedó saneada por BUG-030.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
