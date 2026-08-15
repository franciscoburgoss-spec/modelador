# BUG-016-A-026 — Probe FX-008 leyó roof intents no materializados

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

El probe de auditoría imprimió:

`fx.model.structuralIntent.roofIntents`

desde `buildFx008Rev8Short()`.

Ese helper conserva la intención de cubierta REV8 utilizada para generar derivados en
`fx.roofStructuralIntent`; la colección inspeccionada dentro de `model.structuralIntent` permanece
vacía en ese punto del fixture.

El resultado `roofIntents: []` del probe no demuestra ausencia de intención de cubierta.

## Impacto

La lectura puede inducir a una conclusión falsa sobre la autoridad direccional de FX-008.

No existe falla de producto.

## Correctiva

Repetir el probe mostrando separadamente:

- `fx.model.structuralIntent.diaphragmIntents`;
- `fx.model.structuralIntent.roofIntents`;
- `fx.roofStructuralIntent`.

## Resguardos

- no cambiar el helper REV8;
- no copiar `roofStructuralIntent` al modelo para hacer pasar la auditoría;
- no alterar B1/B2/B3.1/B3.2/B3.3;
- no realizar Git write.

## Criterio de cierre

El probe corregido debe demostrar explícitamente dónde reside cada snapshot y evitar interpretar
la colección vacía equivocada como ausencia de la intención usada por la evidencia.

## Evidencia de cierre

El probe se repitió separando explícitamente:

- `fx.model.structuralIntent.diaphragmIntents`;
- `fx.model.structuralIntent.roofIntents`;
- `fx.roofStructuralIntent`.

Resultado FX-008 REV8:

- `model.structuralIntent.diaphragmIntents = []`;
- `model.structuralIntent.roofIntents = []`;
- `fx.roofStructuralIntent` contiene dos snapshots utilizados por la evidencia;
- ambos usan `loadDistribution=oneWay`;
- ambos declaran `primaryResistanceDirection={x:0,y:1}`;
- uno usa `diaphragmBehavior=candidate`;
- el otro usa `diaphragmBehavior=intended`.

Queda demostrado que el resultado vacío del probe original correspondía a una colección distinta
de la utilizada por el helper para construir los derivados.

No se modificó el helper ni se copió artificialmente la intención dentro del modelo.
