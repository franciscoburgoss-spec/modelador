# BUG-015-D-032 — Etiqueta del localizador oculta una interfaz de cara con `sRange` corto

**Spec:** SPEC-015-D REV8
**Fecha de registro:** 2026-08-10
**Estado inicial:** abierto; reproducido visualmente en localhost antes de modificar código

Estado final: **cerrado 10-ago-2026** tras validación focal, integral y visual real.
## Evidencia real

En FX-008 se declaró y persistió una interfaz receptora sobre el muro `Y · B→I @ 6`:

- host `1784753322528`;
- ubicación `Cara −N`;
- `sRange:[1949.45,2050.55]`;
- `zRange:[3250,4150]`;
- longitud longitudinal declarada: `101.10 mm`.

`Localizar interfaz` resuelve el host, la cara canónica y el encuentro C/6 correctos. Sin embargo,
al ampliar la vista, la caja de la marca `−N` se dibuja centrada sobre el polígono seleccionado y
oculta prácticamente toda la evidencia geométrica de una interfaz tan corta. El usuario no puede
comprobar visualmente que el resaltado corresponde sólo a `S 1949.45→2050.55`.

## Causa aislada

`src/components/Canvas.jsx`, en `drawStructuralIntentVisualTarget`, coloca toda marca en el centro
geométrico del polígono seleccionado. Para un `planGeometry.kind === 'interface-location'` de cara
con dimensiones proyectadas comparables o menores que la caja de texto, la marca y su fondo cubren
la selección que deben identificar.

La geometría de la interfaz ya es correcta; no corresponde modificar `sRange`, `zRange`,
`visibleBounds`, identidad de interfaz ni el grafo.

## Decisión

Cuando una marca de una **interfaz de cara** cubriría el polígono corto en pantalla:

1. conservar el polígono y el encuadre sin cambios;
2. desplazar la caja de la marca hacia el lado exterior de la cara;
3. unir polígono y etiqueta mediante un líder corto;
4. recalcular la posición en cada render, por lo que debe seguir funcionando al hacer zoom;
5. mantener el comportamiento centrado actual para objetivos no afectados y para interfaces cuya
   extensión visible es suficientemente grande.

El lado exterior se obtiene de la dirección entre el punto medio del `faceSegment` y el centro del
polígono de ubicación. No se infiere función estructural alguna a partir de esa dirección.

## Criterios de aceptación

- BUG-032-A. Una interfaz de cara corta cuyo rectángulo proyectado quedaría oculto por la etiqueta
  usa una llamada exterior y la caja no intersecta el polígono seleccionado.
- BUG-032-B. El líder comienza en el borde exterior del polígono y termina en el borde de la caja;
  no modifica la evidencia geométrica.
- BUG-032-C. Una interfaz suficientemente larga conserva la marca centrada histórica.
- BUG-032-D. Objetivos sin `interfaceLocation.kind === 'face'` conservan la presentación previa.
- BUG-032-E. `visibleBounds`, `targetBounds`, `sRange`, `zRange`, `interfaceId`, relaciones,
  `candidateLoadPaths`, schema, `modelVersion` y geometría agnóstica permanecen intactos.
- BUG-032-F. La regresión automatizada falla si se elimina el cálculo de llamada exterior.
- BUG-032-G. La validación final incluye inspección visual real en localhost sobre C/6 antes de
  crear la relación de apoyo.

## Exclusiones

- No cambia semántica de `Cara +N/−N`.
- No crea apoyos, cargas, acciones ni capacidad.
- No modifica SPEC-014, `candidateLoadPaths`, CalculiX, DXF ni la geometría agnóstica.
- No crea ni elimina interfaces/relaciones persistidas del navegador.
- No corrige deudas visuales ajenas al localizador de interfaz corta.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 18. La llamada `−N` quedó fuera de la interfaz corta C/6 mediante líder, permitiendo inspeccionar el subtramo sin alterar `visibleBounds` ni autoridad.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
