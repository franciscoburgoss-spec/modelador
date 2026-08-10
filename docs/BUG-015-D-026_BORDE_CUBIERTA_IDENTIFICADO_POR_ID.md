# BUG-015-D-026 — Borde de cubierta identificado por ID en Interfaces

## Estado

Corregido por la Correctiva 12 de SPEC-015-D REV8. Pendiente de validación focal en macOS y revisión visual real en localhost.

## Reproducción real

En `Estructura → Intención estructural → Interfaces`, al seleccionar `Referente geométrico = Borde de cubierta`, el selector `Borde canónico` presentaba opciones como:

`Cubierta 1785030887081 · B3 · 1.700 mm`

El mismo faldón ya se identifica en la pestaña Techumbre mediante el descriptor humano de ejes:

`Cubierta · Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C`

El ID técnico volvía a ser necesario para reconocer el borde, contrariando el criterio transversal adoptado en SPEC-015-C-1/SPEC-015-D para targets geométricos.

Además, una interfaz de borde ya persistida exponía el `boundaryId` canónico en la línea principal de la tarjeta, generando una cadena técnica larga y desplazamiento horizontal.

## Causa

`StructuralInterfacesPanel.jsx` construía `roofBoundaries` con una etiqueta local basada directamente en `roof.id`, en vez de reutilizar `buildRoofPlanContext`, que ya resuelve el descriptor humano por ejes reales. Para la tarjeta persistida se reutilizaba `describeInterfaceIntent(...).subtitle`, cuyo contrato de núcleo contiene el `boundaryId` técnico.

## Corrección

1. El selector `Borde canónico` reutiliza `buildRoofPlanContext(model, roof)` y presenta cada opción como:
   - `Cubierta · Ejes X: … · Ejes Y: … · Bn · largo mm`.
2. La referencia `roof:<id>:edge:<boundaryId>` queda disponible sólo en `Referencia técnica` del contexto de selección.
3. Las tarjetas y puertos de interfaces de cubierta mantienen el descriptor humano y relegan la referencia canónica al bloque técnico colapsable.
4. No se modifican `ownerRef`, `boundaryId`, `interfaceId`, fingerprints, schema, geometría agnóstica, relaciones ni caminos de carga.

## Regresión exigida

La prueba de componente debe verificar con FX-008 que B3 de la cubierta `1785030887081`:

- se presenta como `Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C · B3`;
- no usa `Cubierta 1785030887081` como identificación primaria;
- conserva el ID y `boundaryId` exclusivamente como referencia técnica;
- al persistirse sigue mostrando el descriptor humano y estado `fresh`.
