# BUG-015-D-014 — Interfaces declaradas se presentan como referencia rota

## Estado de reproducción

Reproducido durante SPEC-015-D REV8 antes de modificar el presentador visual.

## Contexto

`candidateLoadPaths` REV8 puede emitir nodos `declaredInterface` cuya referencia técnica es
`{ interfaceId }`. El presentador REV7 de propuestas sólo resuelve nodos con `roofGeometryId`,
`elementId` o `foundationId`.

## Reproducción FX-008

1. Declarar las dos interfaces de cara del frontón `1784819708086` en C/6→7.
2. Declarar relaciones `support · gravity` desde los dos bordes de cubierta.
3. Construir `candidateLoadPaths`.
4. Construir la presentación visual del workspace.

Resultado previo a la corrección: el nodo `declaredInterface` no se puede resolver como entidad y
se presenta mediante `brokenTarget(...)`, aunque la interfaz y su host existen y están `fresh`.

## Impacto

- viola MEJ-015-D-019 y el contrato de Localizar transversal;
- oculta cara/extremo/región detrás de una falsa referencia rota;
- impide `Ver relación` con origen/interfaz/destino;
- puede inducir al usuario a interpretar un problema de integridad inexistente.

## Regla de corrección

El presentador debe tener un índice explícito de `structuralInterface`, resolver su host mediante
geometría agnóstica, producir descriptor humano y preview específico de cara/extremo/región/borde.
Una relación debe poder visualizar simultáneamente sus interfaces y hosts. Una referencia realmente
rota debe continuar etiquetada como `Referencia rota`; se prohíbe nearest-match.

## No solución

No modificar IDs, geometría arquitectónica, selección persistida, history, trace o review sólo para
localizar. El highlight es efímero.
