# BUG-016-B-037 — “Segmento positivo” vs MATERIALIZATION_MIN_SEGMENT_MM en B3.5

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

SPEC-016-B B3.4 congela:

`MATERIALIZATION_MIN_SEGMENT_MM = 0.1`

pero B3.5 declara únicamente que los “segmentos positivos” resultantes de
sustraer los intervalos Z interiores a los voids producen miembros verticales.

No se define todavía si un segmento con longitud:

`0 < length < 0.1 mm`

debe materializarse, descartarse o provocar fallo cerrado.

La diferencia es contractual y afecta determinismo en casos degenerados cerca
de bordes de openings.

## Alcance

Exclusivamente implementation subcut B3.3, Fase A READ-ONLY, sección técnica
B3.5 Retícula maestra vertical.

## Resolución propuesta

Usar `MATERIALIZATION_MIN_SEGMENT_MM` como umbral mínimo de materialización
derivada, sin modificar geometría autoritativa:

- `length <= 0` no produce segmento;
- `0 < length < MATERIALIZATION_MIN_SEGMENT_MM` no produce miembro;
- `length >= MATERIALIZATION_MIN_SEGMENT_MM` produce miembro;
- la comparación ocurre antes del redondeo canónico;
- omitir un microsegmento derivado no desplaza ni corrige ningún opening.

La decisión deberá indicar expresamente si `length === 0.1 mm` se incluye.

## Corpus mínimo requerido

- longitud 0;
- longitud positiva mínima representable del fixture;
- 0.0999 mm;
- 0.1 mm;
- 0.1001 mm;
- comparación antes de redondear.

## Fuera de alcance

B3.6+, familia horizontal, panelCoverage, runtime/generatedArtifacts, B4, B5,
SPEC-016-C y Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó corregir la propuesta inicial y D-090 congeló:

`length > MATERIALIZATION_MIN_SEGMENT_MM`

como condición estricta de materialización de un segmento vertical derivado.

Con `MATERIALIZATION_MIN_SEGMENT_MM = 0.1 mm`:

- `length = 0` → no se materializa;
- `length = 0.0999 mm` → no se materializa;
- `length = 0.1 mm` → no se materializa;
- `length = 0.1001 mm` → puede materializarse.

La comparación ocurre antes del redondeo canónico.

La omisión de un microsegmento no:

- mueve ni corrige openings;
- modifica geometría autoritativa;
- fusiona segmentos separados;
- afirma capacidad resistente;
- altera D-087, D-088 o D-089.

La implementación B3.3 continúa no autorizada.

El corpus adversario deberá cubrir ambos lados del umbral y el límite exacto
antes de autorizar implementación.
