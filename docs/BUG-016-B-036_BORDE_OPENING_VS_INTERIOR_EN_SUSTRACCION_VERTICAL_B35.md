# BUG-016-B-036 — Borde de opening vs interior en sustracción vertical B3.5

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

SPEC-016-B B3.5 declara simultáneamente que:

- los bordes efectivos de openings forman parte de las posiciones candidatas;
- en cada posición se sustraen los intervalos Z interiores a los voids;
- el mismo algoritmo debe permitir producir `jamb`.

El contrato no explicita si una posición longitudinal exactamente igual a
`sMin` o `sMax` del opening se considera interior del void para efectos de la
sustracción.

Si se tratara como interior, la propia posición de jamba perdería el tramo
vertical contenido en el rango Z del vano.

## Alcance

Exclusivamente implementation subcut B3.3, Fase A READ-ONLY, sección técnica
B3.5 Retícula maestra vertical.

## Resolución propuesta

Distinguir frontera e interior longitudinal de forma exacta:

- `s === sMin` o `s === sMax` es borde del opening y no interior longitudinal;
- sólo `sMin < s < sMax` está longitudinalmente dentro del void;
- por tanto, en un borde exacto no se sustrae el intervalo Z del opening por
  causa de ese mismo void;
- la posición puede producir una pieza vertical continua con rol `jamb`,
  combinable posteriormente con otros roles según el subcorte que gobierne
  deduplicación;
- no se desplaza ni ensancha el opening.

## Corpus mínimo requerido

- candidato exactamente en `sMin`;
- candidato exactamente en `sMax`;
- candidato estrictamente interior;
- candidato inmediatamente exterior;
- opening tocando `s=0`;
- opening tocando `s=L`.

## Fuera de alcance

La deduplicación/roles de B3.6 técnica, familia horizontal,
runtime/generatedArtifacts, B4, B5, SPEC-016-C y Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la resolución y D-089 congeló que, después de aplicar
D-088 a posiciones de grid derivadas:

- sólo `sMin < s < sMax` está longitudinalmente dentro del opening;
- `s === sMin` y `s === sMax` son fronteras exactas;
- únicamente una posición interior sustrae `[zMin,zMax]`;
- una posición de borde no pierde el tramo vertical del opening y puede
  materializar una pieza continua de jamba;
- un opening que toca `s=0` o `s=L` mantiene la misma semántica de frontera;
- `Oi` no se mueve, expande, contrae ni redefine;
- deduplicación y unión de roles permanecen fuera de B3.3 y corresponden a
  B3.6 técnica;
- implementación B3.3 continúa no autorizada.

El corpus adversario deberá cubrir `sMin`, `sMax`, interior estricto, exterior
inmediato y openings que tocan ambos extremos del host antes de autorizar
implementación.
