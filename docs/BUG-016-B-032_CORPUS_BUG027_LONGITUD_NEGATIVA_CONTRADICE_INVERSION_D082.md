# BUG-016-B-032 — Corpus BUG-027: “longitud negativa” contradice inversión autorizada por D-082

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Durante la verificación final del corpus de BUG-016-B-027 se detectó una
contradicción interna entre dos requisitos del mismo documento.

El corpus mínimo exige simultáneamente:

3. inversión incidental de `start/end` produce el mismo `Oi`;
8. longitud longitudinal cero o negativa falla cerrado.

D-082 congela explícitamente que la inversión incidental de `start/end` es
válida y que:

- `sMin = min(sStart,sEnd)`;
- `sMax = max(sStart,sEnd)`.

Por tanto un delta longitudinal firmado negativo causado únicamente por
`start > end` no representa longitud geométrica negativa: representa el orden
incidental inverso que D-082 exige canonicalizar.

La implementación vigente respeta D-082:

- longitud cero falla cerrado porque ambos extremos coinciden
  longitudinalmente;
- extremos invertidos con separación positiva producen el mismo `Oi`.

Introducir un test donde `start > end` deba fallar para satisfacer literalmente
“longitud negativa” contradiría D-082 y el caso 3 del propio BUG-027.

## Alcance

La contradicción es documental y afecta exclusivamente al criterio de evidencia
de BUG-016-B-027.

No existe evidencia de contradicción en D-082, en la SPEC ni en la
implementación B3.2.

Este BUG no autoriza modificar:

- D-082;
- el contrato geométrico de `opening.void`;
- `metalconConstructiveGeometry.js`;
- productor/auditor agnóstico;
- runtime/generatedArtifacts;
- B3.3 de implementación;
- B3.5 técnica;
- B4, B5 o SPEC-016-C;
- Git.

## Resolución propuesta

Mantener D-082 sin cambios.

Interpretar “longitud longitudinal estrictamente positiva” como extensión
geométrica canónica:

`length = sMax - sMin`

Por tanto:

- `length === 0` falla cerrado;
- `length > 0` es válida respecto de longitud;
- el signo de `sEnd - sStart` sólo expresa orden incidental y no elegibilidad.

En BUG-016-B-027 el punto 8 debería quedar expresado como:

“longitud longitudinal geométrica cero falla cerrado; la inversión incidental
de extremos no constituye longitud negativa y produce el mismo `Oi`”.

## Evidencia adicional pendiente de BUG-027

Además de resolver esta contradicción documental, el corpus ejecutable debe
incorporar de forma explícita al menos:

- coordenada no finita de `opening.void`;
- `height < 0`;
- `thickness < 0`.

Estos casos no contradicen D-082 y deben fallar cerrado.

## Criterio de cierre

Este BUG puede cerrarse sólo después de:

1. revisión humana explícita de la interpretación propuesta;
2. decisión de gobernanza que confirme o rechace la resolución;
3. alineación documental de BUG-027;
4. verificación de que no se alteró D-082 para acomodar tests.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la resolución y quedó registrada mediante D-086.

Se mantiene D-082 sin cambios:

- `sMin = min(sStart,sEnd)`;
- `sMax = max(sStart,sEnd)`;
- `length = sMax - sMin`;
- `length === 0` falla cerrado;
- `length > 0` satisface la precondición longitudinal;
- un valor firmado `sEnd - sStart < 0` representa únicamente inversión
  incidental de extremos y no una longitud geométrica negativa.

BUG-016-B-027 fue alineado documentalmente para eliminar la expresión ambigua
sin modificar la SPEC, la implementación ni los tests existentes.

La evidencia adicional de BUG-027 para coordenadas no finitas y dimensiones
negativas continúa pendiente y se resolverá bajo el propio BUG-027.
