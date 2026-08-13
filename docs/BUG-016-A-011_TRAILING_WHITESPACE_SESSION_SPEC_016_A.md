# BUG-016-A-011 — Trailing whitespace en sesión SPEC-016-A previo a commit

## Estado

CERRADO — 12-ago-2026.

## Hallazgo

Después del staging explícito de los 38 archivos candidatos de SPEC-016-A B1/B2,
`git diff --cached --check` detectó:

`session/implementation-SPEC-016-A.md:592: trailing whitespace`

La ruta real es:

`sessions/implementation-SPEC-016-A.md`

La línea afectada contiene:

`SHA-256 del test antes de la excepción:`

## Impacto

El defecto es exclusivamente de formato documental.

No afecta:

- código productivo;
- contratos B1/B2;
- tests;
- autoridad;
- `notVerified`;
- frontera B2/B3.

Sí impide considerar limpio el diff staged candidato al commit.

## Corrección requerida

Eliminar exclusivamente el whitespace final de la línea afectada, sin modificar
su contenido textual ni ningún otro bloque histórico.

Después se debe:

- ejecutar `git diff --check`;
- ejecutar `npm run format:check`;
- ejecutar `make governance`;
- volver a stagear únicamente los archivos afectados;
- ejecutar `git diff --cached --check`;
- verificar nuevamente el conjunto staged antes del commit.

No se autoriza commit ni push por este BUG.

## Evidencia de cierre

La revisión posterior confirmó que la correctiva fue exclusivamente de whitespace:

- `sessions/implementation-SPEC-016-A.md:592` conserva el texto
  `SHA-256 del test antes de la excepción:`;
- se eliminó únicamente el whitespace final de esa línea;
- el diff `index -> worktree` de la sesión mostró sólo esa eliminación;
- `git diff --check`: PASS;
- `npm run format:check`: PASS, 688 archivos de texto;
- `make governance`: PASS, 22 archivos requeridos, 53 requisitos y 67 decisiones.

No se modificó código productivo, tests, contratos, autoridad ni la frontera B2/B3.

B2 permanece aprobado y cerrado.
B3 permanece no autorizado.

BUG-016-A-011 queda cerrado.
