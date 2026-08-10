# BUG-015-D-012 — Estado vacío sin diagnóstico accionable

## Reproducción real

En localhost, con `geometria-agnostica_base.json` y sin funciones resistentes declaradas en los bordes de techumbre, el workspace SPEC-015-D mostraba `0 propuestas` y el texto genérico `No hay propuestas compatibles con los bordes declarados`.

## Problema

El motor actuaba correctamente al no inventar apoyos, pero la UI no distinguía entre:

- ausencia de geometría de cubierta;
- ausencia de intención de techumbre;
- intención existente sin bordes resistentes;
- apoyos declarados sin receptores geométricos compatibles.

Esto impedía saber qué declaración faltaba para continuar.

## Corrección REV7

`buildStructuralProposalWorkspace()` publica `proposalReadiness`, derivado y no autoritativo, con estado, explicación y acción sugerida. La UI muestra el diagnóstico tanto en Resumen como en el estado vacío de Propuestas y puede abrir directamente `Intención estructural → Techumbre`.

No se infiere ninguna función resistente.
