# BUG-016-B-020 — Propagación D-076 reescribe estado histórico D-075 en sesión

## Estado

CERRADO — 17-ago-2026.

## Diagnóstico

Durante la propagación documental de D-076 a
`sessions/implementation-SPEC-016-B.md` se reemplazó dentro de la sección
histórica `B3.1b — Fase A aprobada y catálogo congelado` la condición vigente
bajo D-075:

`B3.2 permanece bloqueado hasta gates verdes y cierre humano de B3.1b.`

por texto que expresa el estado posterior introducido por D-076.

Aunque D-076 efectivamente cierra B3.1b y habilita B3.2 exclusivamente para
Fase A READ-ONLY, introducir ese estado dentro del registro histórico de D-075
reescribe retrospectivamente la secuencia de decisiones.

## Decisión

Conservar literalmente en la sección D-075 la condición que estaba vigente
cuando D-075 fue aprobada.

Registrar el cambio de estado producido por D-076 únicamente en autoridades
de estado actual y en un bloque cronológicamente posterior de cierre B3.1b.

## Alcance

- Restaurar en la sección histórica D-075 de
  `sessions/implementation-SPEC-016-B.md` la frase que declara B3.2 bloqueado
  hasta gates verdes y cierre humano de B3.1b.
- Mantener intacto el bloque posterior
  `### Cierre B3.1b — catálogo productivo real`.
- Mantener el estado actual B3.2 como Fase A READ-ONLY habilitada mediante
  D-076.

## Fuera de alcance

- Cambiar D-075 o D-076.
- Reabrir B3.1b.
- Autorizar implementación B3.2.
- Modificar producto, tests, SPEC, STATUS o TRACEABILITY.
- Hacer `git add`, commit o push.

## Criterios de aceptación

1. La sección D-075 conserva que B3.2 permanecía bloqueado bajo esa decisión.
2. El bloque posterior D-076 conserva que B3.1b fue aprobado y cerrado.
3. El estado actual sigue declarando B3.2 habilitado exclusivamente para
   Fase A READ-ONLY y su implementación no autorizada.
4. La secuencia documental D-075 → D-076 queda cronológica y no reescribe
   historia.
5. `git diff --check`, `npm run format:check` y `make governance` pasan.

## Evidencia

- Diff focal de `sessions/implementation-SPEC-016-B.md`.
- Gates documentales post-correctiva.

## Cierre verificado

CERRADO — 17-ago-2026.

La correctiva restaura en la sección histórica gobernada por D-075 que B3.2
permanecía bloqueado hasta gates verdes y cierre humano de B3.1b, y conserva
en el bloque cronológicamente posterior D-076 el cierre de B3.1b y la
habilitación exclusiva de B3.2 para Fase A READ-ONLY.

Evidencia post-correctiva:

- `git diff --check`: PASS;
- `npm run format:check`: PASS, 781 archivos de texto;
- `make governance`: PASS, 22 archivos requeridos, 56 requisitos y
  76 decisiones.

La correctiva no autoriza implementación B3.2, B4, B5, SPEC-016-C ni ninguna
operación Git de escritura.
