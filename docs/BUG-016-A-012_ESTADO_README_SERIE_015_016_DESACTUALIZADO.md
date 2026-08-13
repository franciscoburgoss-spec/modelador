# BUG-016-A-012 — Estado del README de la serie 015/016 desactualizado

## Estado

CERRADO — 12-ago-2026.

## Hallazgo

La auditoría final READ-ONLY del candidato staged de SPEC-016-A detectó que
`specs/README-SERIE-015-016.md` conserva como estado vigente:

`SPEC-016-A abierta con Fase A aprobada y Fase B no autorizada`

Ese texto quedó obsoleto respecto de las autoridades documentales actuales.

El estado vigente confirmado es:

- SPEC-016-A continúa abierta;
- B1/B1.1 aprobados y cerrados;
- B2 aprobado y cerrado por revisión humana tras B2-CLOSE;
- B3 no autorizado;
- SPEC-016-B/C permanecen futuras.

## Autoridad vigente

D-067 cierra humanamente B2.

`governance/STATUS.md`,
`governance/DECISIONS.md`,
`governance/TRACEABILITY.md`,
`specs/SPEC-016-A-arquitectura-soluciones-constructivas.md` y
`sessions/implementation-SPEC-016-A.md`
son coherentes con ese cierre.

La frontera final de B2 continúa siendo:

`constructive-effective-input-v1.0`

B3 requiere autorización humana separada.

## Impacto

El defecto es exclusivamente documental.

No existe evidencia de:

- defecto productivo;
- cambio contractual;
- promoción de `notVerified`;
- implementación de adapter/generation;
- cruce de la frontera B2/B3.

## Corrección requerida

Actualizar únicamente el estado vigente del encabezado de
`specs/README-SERIE-015-016.md` para reflejar:

- B1/B1.1 cerrados;
- B2 cerrado;
- B3 no autorizado;
- SPEC-016-B/C futuras.

No modificar el propósito, planificación histórica ni decisiones de la serie.

## Criterio de cierre

El BUG puede cerrarse cuando:

- el README concuerda con D-067 y las restantes fuentes vigentes;
- B3 sigue explícitamente no autorizado;
- `git diff --check` pasa;
- `npm run format:check` pasa;
- `make governance` pasa;
- el candidato staged se vuelve a verificar y fingerprintar;
- no se realiza commit ni push antes de la aprobación final.

## Evidencia de cierre

La revisión posterior confirmó que la correctiva fue exclusivamente documental:

- el diff `index -> worktree` de `specs/README-SERIE-015-016.md` modificó sólo
  la declaración de estado vigente;
- B1/B1.1 figuran aprobados y cerrados;
- B2 figura aprobado y cerrado por revisión humana tras B2-CLOSE;
- B3 permanece no autorizado;
- SPEC-016-B/C permanecen futuras;
- `constructive-effective-input-v1.0` continúa siendo la frontera final de B2;
- `git diff --check`: PASS;
- `npm run format:check`: PASS, 689 archivos de texto;
- `make governance`: PASS, 22 archivos requeridos, 53 requisitos y 67 decisiones.

No se modificó código productivo, tests, contratos, autoridad ni la frontera B2/B3.

La autoridad de cierre de B2 continúa siendo D-067.

BUG-016-A-012 queda cerrado.
