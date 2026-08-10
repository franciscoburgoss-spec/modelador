# BUG-015-D-027 — Nodo de borde de cubierta expone ID canónico en G↓ Gravedad

## Estado
Correctiva preparada para SPEC-015-D REV8. Requiere validación focal, validación integral y revisión visual real antes del cierre.

## Reproducción real FX-008
Con la interfaz persistida del borde B3 de la cubierta sur (`roofGeometryId=1785030887081`) conectada mediante una relación explícita `support · gravity` a la cara −N del frontón C/6→7, abrir:

`Estructura → Propuestas y caminos de carga candidatos → G↓ Gravedad`.

El nodo se identifica humanamente por el título `Borde de cubierta · Faldón poligonal 2–7 entre A–C`, pero su subtítulo expone como contenido principal el identificador canónico completo `roof:...:edge:...`, aun cuando la misma tarjeta ya posee el bloque colapsable `Referencia técnica`.

## Defecto
La presentación vuelve a exigir conocimiento de un identificador interno para distinguir el borde y contradice el criterio ya validado en Techumbre e Interfaces: los targets geométricos deben identificarse primero mediante contexto humano; IDs y hashes son trazabilidad técnica secundaria.

## Causa
`structuralProposalVisualPresentation.interfaceTarget()` reutilizaba `describeInterfaceIntent().subtitle` para interfaces `roofBoundary`. El contrato de núcleo de `describeInterfaceIntent()` conserva deliberadamente `boundaryId` como referencia canónica, por lo que la capa de presentación filtraba ese valor al subtítulo del nodo.

## Corrección
La capa de presentación reconstruye el borde visual desde la geometría agnóstica, conserva la correspondencia canónica por `boundaryId` y obtiene su índice de recorrido `B1…Bn` sin modificar la identidad persistida. Para una interfaz de borde se presenta:

- título humano: `Borde de cubierta · <descriptor del faldón> · Bn`;
- subtítulo humano: `Bn · <longitud> mm · <vigente/obsoleta>`;
- `roofGeometryId`, `boundaryId`, `interfaceId` y hashes sólo dentro de `technicalReference` / `Referencia técnica`.

## Invariantes
La correctiva no modifica:

- `modelVersion` ni schema de intención;
- `interfaceId`, `boundaryId` ni fingerprints;
- `structuralInterfaces.js`;
- `candidateLoadPaths.js`;
- relaciones, roles, actionFamily, structuralFunction ni carrierRegions;
- geometría agnóstica;
- historial, review o trace;
- precedencia explícita sobre fallback geométrico.

## Regresión
El test focal usa el B3 real de la cubierta `1785030887081` y exige que el nodo gravitacional muestre `Faldón poligonal 2–7 entre A–C · B3` y `1.700 mm`, sin `roof:` ni el ID numérico en título/subtítulo, mientras la referencia técnica sigue conteniendo el `boundaryId` canónico.
