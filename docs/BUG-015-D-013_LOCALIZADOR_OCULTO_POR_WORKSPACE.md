# BUG-015-D-013 — Localizador oculto por el workspace

## Reproducción real

Al pulsar `Localizar` en Cubierta origen u Objetivo candidato, la vista en planta se encuadraba detrás del diálogo de Propuestas, pero el workspace seguía cubriendo el Canvas.

## Problema

La mutación efímera de viewport era correcta, pero la inspección visual era inutilizable. El comportamiento no seguía el patrón ya validado en SPEC-015-C-1.

## Corrección REV7

Mientras `structuralProposalLocator.active`:

- el workspace completo se desmonta visualmente y queda un panel compacto no modal;
- la planta permanece accesible para pan/zoom e inspección;
- `Encuadrar`, `Restaurar vista` y `Conservar vista` reutilizan el contrato efímero existente;
- Escape restaura la vista sin cerrar el workspace;
- al volver se restaura el foco cuando existe un origen identificable.

No se crea historial, review, trace ni selección global.
