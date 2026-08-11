# BUG-015-E-010 — `end` materializado como longitud física

## Reproducción

En FX-008, el receptor C/7 está declarado en REV8 como `locator.kind=end`, `end=highS`, con `sRange=[1999.9,2000]` y `zRange=[3250,4150]`. La banda longitudinal de 0,1 mm es la envolvente de localización/tolerancia del extremo.

B2 proyectaba toda interfaz de elemento copiando `locator.sRange` a R11. Como consecuencia, C/7 aparecía como una región física de `L=0,1 mm`.

## Causa

R11 no discriminaba entre una región longitudinal (`range`) y un extremo canónico (`end`). La función `interfaceRegion()` descartaba `locator.kind` y `locator.end`.

## Corrección

R11 usa `longitudinalLocation.kind = range|end`. Un extremo conserva `end`, `anchorS` y `localizationEnvelope`; la envolvente puede participar sólo en operaciones geométricas de tolerancia y nunca se publica como longitud física.

REV8, la geometría agnóstica, las interfaces persistentes y los candidate paths no se modifican.
