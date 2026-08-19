# BUG-016-B-026 — Dominio B3.2 más estricto que geometría agnóstica auditada

## Estado

CERRADO — 19-ago-2026.

Resolución semántica aprobada por revisión humana el 18-ago-2026.

## Hallazgo

Durante la Fase A READ-ONLY de SPEC-016-B B3.2 se confirmó que el dominio
geométrico aceptable/auditable por `agnostic-geometry-v1.0` es más amplio que
el subdominio de hosts WALL materializables congelado por D-078.

El productor agnóstico usa `EPSILON = 1e-7` y `wallRun()` admite una componente
transversal positiva de hasta ese valor. `orderedWallPoints()` conserva las
coordenadas originales.

El auditor agnóstico reconstruye esas coordenadas sin forzar igualdad exacta y
usa por defecto:

`DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM = 0.001`

con equivalencia numérica cuando:

`deviationMm <= toleranceMm + roundingAllowance`.

En cambio D-078 exige igualdad exacta sobre `effectiveGeometry`, antes del
redondeo:

- X: `start.y === end.y`, `start.z === end.z`, `start.x !== end.x`;
- Y: `start.x === end.x`, `start.z === end.z`, `start.y !== end.y`.

B3.2 prohíbe averaging, snapping, proyección, eje dominante y reutilización de
tolerancias de SPEC-014.

## Resolución aprobada

Se mantiene D-078 sin cambios.

`agnostic-geometry-v1.0` auditado continúa siendo autoridad física, pero la
auditoría upstream no implica materializabilidad por todos los adaptadores.

SPEC-016-B B3.2 consume deliberadamente un subdominio geométrico más estricto.
Si materializar un host exige proyección, averaging, snapping o
reinterpretación, B3.2 falla cerrado.

Por tanto:

`hosts materializables por B3.2 ⊂ geometrías WALL válidas/auditables upstream`

Esta inclusión estricta no invalida upstream ni autoriza a B3.2 a reparar la
geometría.

## Consecuencias contractuales

- no modificar productor ni auditor agnóstico;
- no relajar D-078;
- no usar tolerancias B3.4 para convertir desigualdad en igualdad;
- no importar tolerancias o semántica de SPEC-014;
- no consumir Metalcon legacy como input, fallback o autoridad;
- el rechazo B3.2 debe ser explícito, determinista y trazable.

## Corpus mínimo requerido

La evidencia posterior debe distinguir:

1. host X exactamente ortogonal/nivelado: válido;
2. host Y exactamente ortogonal/nivelado: válido;
3. inversión de extremos: mismo frame;
4. desviación transversal `0 < d <= 1e-7`: upstream puede aceptarla y B3.2
   debe fallar cerrado;
5. desviación transversal `d > 1e-7`: productor upstream falla;
6. diagonal: B3.2 falla cerrado;
7. casi nivelado: B3.2 falla cerrado;
8. longitud plana cero: B3.2 falla cerrado;
9. coordenada no finita: B3.2 falla cerrado;
10. tolerancias B3.4 no cambian la elegibilidad.

## Alcance

Esta correctiva pertenece exclusivamente a SPEC-016-B, implementation subcut
B3.2 y secciones técnicas B3.2/B3.3/B3.4.

No autoriza implementación B3.2 de producto, B3.5, B4, B5, SPEC-016-C, DXF,
Metalcon legacy ni Git write.

## Criterio de cierre

BUG-016-B-026 permanece abierto hasta contar con:

1. decisión de gobernanza que materialice esta resolución;
2. contrato B3.2 consistente;
3. corpus verificable de frontera upstream/B3.2;
4. evidencia posterior de implementación fail-closed;
5. gates autorizados en verde.

## Cierre verificado

CERRADO — 19-ago-2026.

La resolución semántica aprobada mediante D-081 quedó materializada y verificada
sin modificar el productor ni el auditor de `agnostic-geometry-v1.0` y sin
relajar D-078.

Evidencia de cierre:

- `agnostic-geometry-v1.0` continúa siendo la autoridad física upstream;
- B3.2 consume deliberadamente un subdominio geométrico más estricto;
- una desviación transversal exactamente igual a `1e-7` es aceptada por
  `projectAgnosticGeometry()` y se conserva en el WALL publicado;
- ese mismo WALL publicado es rechazado por
  `buildMetalconWallFrameB32()` mediante
  `INVALID_METALCON_B32_HOST_FRAME`;
- una desviación transversal `1e-6`, mayor que `1e-7`, falla upstream con
  `INVALID_DIMENSION`;
- B3.2 no proyecta, promedia, ajusta, hace snapping ni selecciona un eje
  dominante para volver elegible una geometría;
- las tolerancias B3.4 y SPEC-014 no amplían la elegibilidad del host;
- el corpus focal conserva además los casos exactos X/Y, inversión de extremos,
  casi ortogonal, casi nivelado, diagonal, longitud cero y coordenada no finita;
- gate focal B3.2 posterior a completar la frontera:
  `51/51 PASS`, `0 fail`.

Por tanto queda verificada ejecutablemente la relación:

`hosts materializables por B3.2 ⊂ geometrías WALL válidas/auditables upstream`

El cierre no modifica D-078 ni D-081 y no amplía el alcance de B3.2.
B3.3 de implementación, B3.5 técnica, runtime/generatedArtifacts, B4, B5,
SPEC-016-C, DXF, Metalcon legacy y Git write permanecen fuera de alcance.
