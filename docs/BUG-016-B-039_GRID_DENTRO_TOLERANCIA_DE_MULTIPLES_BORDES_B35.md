# BUG-016-B-039 — Grid dentro de tolerancia de múltiples bordes B3.5

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

D-088 congela para un par `sGrid` / `sEdge`:

`abs(sGrid - sEdge) <= MATERIALIZATION_TOL_LINEAR_MM`

y establece que prevalece el borde geométrico autoritativo.

El contrato no define qué ocurre cuando un mismo `sGrid` queda dentro de la
tolerancia de dos o más bordes geométricos autoritativos distintos.

Ese caso no puede resolverse:

- fusionando dos bordes geométricos distintos;
- promediándolos;
- moviendo un opening;
- eligiendo uno por orden incidental de entrada.

Dos bordes distintos deben conservar sus coordenadas autoritativas.

## Riesgo

Sin una regla explícita, implementaciones válidas podrían producir resultados
distintos dependiendo del orden de openings o del orden de evaluación de
bordes.

También debe definirse separadamente el eventual destino del carácter
derivado-de-grid de la posición, sin adelantar indebidamente la deduplicación
y unión final de roles gobernada por la sección técnica B3.6.

## Alcance

Exclusivamente SPEC-016-B B3.3, Fase A READ-ONLY, sección técnica B3.5 y la
frontera necesaria con B3.6 técnica.

No autoriza implementar B3.6.

## Resolución

PENDIENTE DE CONTRASTE CONTRACTUAL Y REVISIÓN HUMANA.

No se congela todavía criterio de:

- borde más cercano;
- empate equidistante;
- supresión de la posición independiente de grid;
- propagación de rol/provenance de grid.

## Corpus mínimo requerido

- un único borde dentro de tolerancia;
- dos bordes distintos dentro de tolerancia;
- bordes a distancias distintas;
- dos bordes equidistantes;
- bordes del mismo opening muy estrecho;
- bordes de openings distintos;
- permutación del orden de openings;
- ningún borde dentro de tolerancia.

## Fuera de alcance

Fusión o movimiento de geometría autoritativa, B3.6 productivo,
familia horizontal, panelCoverage, runtime/generatedArtifacts, B4, B5,
SPEC-016-C y Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la resolución y D-092 congeló el tratamiento de un
`sGrid` dentro de tolerancia de múltiples bordes autoritativos.

Sea:

`E = { sEdge | abs(sGrid - sEdge) <= MATERIALIZATION_TOL_LINEAR_MM }`.

Queda establecido que:

- si `E` es vacío, `sGrid` permanece como posición propia;
- si existe un único borde con distancia mínima, prevalece ese `sEdge`;
- si dos o más bordes distintos empatan exactamente en la distancia mínima,
  B3 falla cerrado;
- nunca se elige por orden incidental, ID, menor/mayor coordenada o cualquier
  prioridad inventada;
- nunca se promedian ni desplazan bordes geométricos;
- los demás bordes autoritativos permanecen como posiciones candidatas;
- la regla sólo canonicaliza el candidato derivado de grid;
- deduplicación y unión de roles/sourceRefs siguen perteneciendo a B3.6
  técnica;
- implementación B3.3 continúa no autorizada.

El corpus adversario deberá cubrir candidato sin bordes cercanos, un borde,
múltiples bordes con mínimo único, empate exacto, permutación de openings y
conservación de todos los bordes autoritativos antes de autorizar
implementación.
