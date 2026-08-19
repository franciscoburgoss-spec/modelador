# BUG-016-B-034 — Mapa de subcortes SPEC desactualizado post D-087

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

Durante la Fase A READ-ONLY de SPEC-016-B B3.3 se detectó una contradicción
documental material dentro de la propia SPEC.

El mapa contractual vigente, `governance/STATUS.md` y D-087 establecen:

- B3.2 cerrado mediante `SPEC-016-B / B3.2-CLOSE`;
- B3.3 habilitado exclusivamente para Fase A READ-ONLY;
- alcance técnico activo B3.5 Retícula maestra vertical;
- implementación B3.3 no autorizada.

Sin embargo, la lista textual `Subcortes:` de
`specs/SPEC-016-B-adaptador-metalcon.md` todavía declara:

- `B3.2 — FASE A READ-ONLY habilitada mediante D-076; implementación no autorizada`;
- `B3.3 — familia vertical`.

La primera afirmación quedó obsoleta tras D-083 y D-087 y contradice el estado
vigente del mismo documento.

## Clasificación

Contradicción documental de gobernanza/contrato.

No es una falla de implementación y no reabre B3.2 técnicamente.

## Resolución propuesta

Mantener D-087 sin modificación y alinear exclusivamente la lista textual de
subcortes con el estado ya aprobado:

- B3.2 — CERRADO mediante D-087;
- B3.3 — Fase A READ-ONLY habilitada mediante D-087, alcance técnico B3.5;
  implementación no autorizada.

No cambiar numeración, responsabilidades ni alcance de subcortes posteriores.

## Fuera de alcance

Este BUG no decide todavía:

- semántica exacta de `dentro de tolerancia` entre grid y borde geométrico;
- tratamiento de una posición exactamente en `sMin/sMax` de un opening;
- relación entre `segmentos positivos` y
  `MATERIALIZATION_MIN_SEGMENT_MM`;
- B3.6 o secciones técnicas posteriores;
- runtime/generatedArtifacts;
- B4, B5 o SPEC-016-C.

## Criterios de cierre

1. revisión humana explícita de la resolución;
2. lista `Subcortes:` coherente con D-087;
3. mapa contractual, `ACTIVE-SCOPE` y D-087 permanecen sin alteración;
4. scope-lock y governance permanecen verdes;
5. `git diff --check` limpio.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana autorizó alinear exclusivamente la lista textual
`Subcortes:` de SPEC-016-B con el estado ya vigente de D-087.

Queda expresado explícitamente:

- B3.2 cerrado mediante D-087;
- B3.3 habilitado exclusivamente para Fase A READ-ONLY sobre la sección
  técnica B3.5 Retícula maestra vertical;
- implementación B3.3 no autorizada.

La correctiva no modifica D-087, el mapa contractual, `ACTIVE-SCOPE`,
`SCOPE-LOCK`, responsabilidades de subcortes posteriores ni ninguna
implementación.
