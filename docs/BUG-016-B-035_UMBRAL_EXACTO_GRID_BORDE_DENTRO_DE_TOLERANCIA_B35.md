# BUG-016-B-035 — Umbral exacto grid/borde para “dentro de tolerancia” B3.5

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

SPEC-016-B B3.4 establece:

`MATERIALIZATION_TOL_LINEAR_MM = 0.1`

y declara que cuando una posición derivada de grid cae “dentro de tolerancia”
de un borde geométrico, prevalece el borde geométrico y se unifican roles.

El contrato no define todavía el operador exacto del límite:

- distancia `< 0.1 mm`; o
- distancia `<= 0.1 mm`.

Ambas interpretaciones producen resultados distintos exactamente a 0.1 mm.

## Alcance

Exclusivamente implementation subcut B3.3, Fase A READ-ONLY, sección técnica
B3.5 Retícula maestra vertical.

No modifica geometría upstream ni B3.2.

## Resolución propuesta

Congelar explícitamente:

`abs(sGrid - sEdge) <= MATERIALIZATION_TOL_LINEAR_MM`

Cuando se cumple, prevalece `sEdge`, se conserva la geometría autoritativa del
opening y se unifican roles. No se mueve el opening ni se crea una tercera
posición.

Cuando la distancia es estrictamente mayor que la tolerancia, ambas posiciones
permanecen distintas.

## Corpus mínimo requerido

- diferencia 0;
- diferencia 0.0999 mm;
- diferencia 0.1 mm;
- diferencia 0.1001 mm;
- simetría a izquierda/derecha del borde;
- invariancia ante inversión incidental del host.

## Fuera de alcance

B3.6+, familia horizontal, panelCoverage, runtime/generatedArtifacts, B4, B5,
SPEC-016-C y Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la resolución y D-088 congeló:

`abs(sGrid - sEdge) <= MATERIALIZATION_TOL_LINEAR_MM`

como condición inclusiva de canonicalización de una posición constructiva
derivada respecto de un borde geométrico autoritativo.

Por tanto:

- diferencia `0` → prevalece `sEdge`;
- diferencia `0.0999 mm` → prevalece `sEdge`;
- diferencia `0.1 mm` → prevalece `sEdge`;
- diferencia `0.1001 mm` → ambas posiciones permanecen distintas;
- la comparación ocurre antes del redondeo;
- el opening nunca se mueve, promedia ni corrige;
- la regla no convierte geometría inválida en válida;
- D-087 y el scope B3.3 READ-ONLY permanecen intactos;
- implementación B3.3 continúa no autorizada.

El corpus adversario exigido deberá cubrir ambos lados del umbral, el límite
exacto, simetría respecto del borde e inversión incidental del host antes de
autorizar implementación.
