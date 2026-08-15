# BUG-016-A-045 — README conserva línea residual pre-cierre

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

La auditoría READ-ONLY pre-commit detectó que
`specs/README-SERIE-015-016.md` conserva bajo la cabecera final la línea:

`2026-08-12. SPEC-016-B/C permanecen futuras.`

La línea pertenecía al estado documental anterior y quedó huérfana
después del cierre de SPEC-016-A.

## Evidencia BEFORE

SHA-256 del README:

`3f836a87be31ffbd0de093a377c03dfcd14fd74ebb8b078d308bc848fb11db29`

La línea residual aparece exactamente una vez.

## Impacto

El defecto es exclusivamente documental.

No modifica ni cuestiona:

- C1–C20;
- D-067, D-068 ni D-069;
- geometría agnóstica;
- `structuralIntent`;
- requirements;
- adapter, generación ni receipt;
- store, UI o tests.

SPEC-016-B/C continúan futuras y no autorizadas.

## Correctiva

Eliminar únicamente la línea residual exacta, sin reescribir la cabecera
vigente ni ninguna decisión contractual.

## Criterio de cierre

- línea residual ausente;
- cabecera final preservada;
- SPEC-016-B/C continúan futuras y no autorizadas;
- exactamente un newline final;
- `npm run format:check` PASS;
- `git diff --check` PASS;
- `make governance` PASS;
- cero cambios productivos o de tests por esta correctiva.

## Cierre verificado

BUG-016-A-045 queda cerrado el 14-ago-2026.

La correctiva eliminó exclusivamente la línea residual:

`2026-08-12. SPEC-016-B/C permanecen futuras.`

Evidencia AFTER:

- la cabecera final de la serie permanece intacta;
- SPEC-016-B/C siguen explícitamente futuras y no autorizadas;
- SHA-256 final del README:
  `52bdc999fb40df73615dc5e2ac64dfbdfa9a533a3a68a0461331973d90691ea1`;
- el fingerprint del diff de `src/tests` fue idéntico antes y después:
  `a89ef757ed4c236d245abde54842700456e960106272a3af51015ed4c4df2ca0`;
- `npm run format:check`: PASS;
- `git diff --check`: PASS;
- `make governance`: PASS.

La correctiva no modificó producto, tests, C1–C20, D-067, D-068,
D-069 ni ninguna autoridad estructural.
