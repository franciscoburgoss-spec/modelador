# BUG-016-B-028 — Invariantes kind/height/thickness del host B3.2 no congeladas

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Durante la implementación autorizada de SPEC-016-B B3.2 se detectó que
D-078 congela exactamente la elegibilidad geométrica de las coordenadas
`host.prism.start/end`, pero el contrato no define todavía las precondiciones
de:

- `host.prism.kind`;
- `host.prism.height`;
- `host.prism.thickness`.

B3.3 necesita construir:

`M = [0,L] × [z0,z1]`

y D-082 exige además:

`opening.void.thickness === host.prism.thickness`.

Por tanto, implementar B3.2 exige decidir explícitamente si kind, height y
thickness inválidos hacen fallar cerrado al host o si pertenecen a otro
dominio. Esa decisión no puede inferirse silenciosamente desde código,
productor agnóstico ni auditor.

## Riesgo

Sin contrato explícito podrían ocurrir implementaciones divergentes para:

- `prism.kind` distinto de `oriented-prism`;
- `height` no finito;
- `height <= 0`;
- `thickness` no finito;
- `thickness <= 0`.

También quedaría indefinida la construcción de `z1` y la comparación exacta
de espesor exigida por D-082.

## Alcance

La deuda pertenece exclusivamente a SPEC-016-B implementation subcut B3.2,
secciones técnicas B3.2/B3.3/B3.4.

No habilita B3.3 de implementación, B3.5 técnica, B4, B5, SPEC-016-C ni Git.

## Criterio de cierre

BUG-016-B-028 permanece abierto hasta contar con:

1. resolución humana explícita;
2. decisión de gobernanza;
3. contrato B3.2/B3.3 consistente;
4. corpus adversario;
5. evidencia de implementación fail-closed;
6. gates autorizados en verde.

## Cierre verificado

CERRADO — 19-ago-2026.

La resolución humana quedó congelada mediante D-084 y materializada en el
contrato e implementación B3.2.

Precondiciones verificadas del host WALL:

- `host.type === 'wall'`;
- `host.prism.kind === 'oriented-prism'`;
- `host.prism.height` finito y estrictamente mayor que cero;
- `host.prism.thickness` finito y estrictamente mayor que cero;
- las coordenadas `start/end` continúan gobernadas por D-078;
- después de canonicalizar únicamente la inversión incidental:
  `z0 = canonicalStart.z`,
  `z1 = z0 + host.prism.height`
  y `L` se deriva de la diferencia longitudinal exacta;
- todo incumplimiento falla cerrado antes de construir `M`, validar openings
  o producir geometría derivada;
- ninguna tolerancia B3.4 repara `kind`, `height` o `thickness`.

El corpus adversario ejecutable cubre:

- `prism.kind` inválido;
- `height` no finito;
- `height === 0`;
- `height < 0`;
- `thickness` no finito;
- `thickness === 0`;
- `thickness < 0`;
- target seleccionado no-WALL.

La implementación responde fail-closed mediante
`INVALID_METALCON_B32_HOST`,
`INVALID_METALCON_B32_HOST_PRISM` o los errores geométricos correspondientes,
sin modificar ni reinterpretar la autoridad upstream.

Gate focal B3.2 vigente después de completar el corpus:

`54/54 PASS`, `0 fail`.

El cierre no modifica D-078, D-084 ni otras decisiones vigentes y no amplía
el alcance de B3.2. B3.3 de implementación, B3.5 técnica,
runtime/generatedArtifacts, B4, B5, SPEC-016-C y Git write permanecen fuera
de alcance.
