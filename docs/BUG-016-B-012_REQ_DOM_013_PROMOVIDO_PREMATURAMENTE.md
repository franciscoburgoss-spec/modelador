# BUG-016-B-012 — REQ-DOM-013 promovido prematuramente

## Estado

CERRADO — 16-ago-2026.

## Hallazgo

Durante la auditoría documental posterior a `SPEC-016-B / B2-CLOSE`,
`governance/TRACEABILITY.md` dejó `REQ-DOM-013` en estado `Verificado`.

La promoción es prematura.

B2 cierra el protocolo común y el dominio Metalcon previo a materialización,
pero SPEC-016-B permanece abierta y todavía tiene cortes pendientes:

- B3 — materialización;
- B4 — respuesta explícita a requirements;
- B5 — UI y evidencia.

Por tanto, REQ-DOM-013 debe permanecer `En curso`.

## Diagnóstico

La anomalía fue introducida exclusivamente por el parche documental de
`B2-CLOSE`.

No corresponde a un defecto de producto ni modifica la validez técnica de B2.

## Correctiva permitida

Exclusivamente:

- devolver `REQ-DOM-013` a estado `En curso`;
- conservar la evidencia B1+B2 ya obtenida;
- dejar explícito que B3/B4/B5 continúan pendientes.

## Prohibiciones

La correctiva NO puede:

- reabrir B2;
- cerrar SPEC-016-B;
- iniciar o autorizar B3;
- desbloquear SPEC-016-C;
- cambiar D-070 o D-071;
- modificar producto, tests, store, UI o schemas;
- ejecutar escritura Git.

## Criterio de cierre

- `REQ-DOM-013` queda `En curso`;
- B1+B2 permanecen documentados como cerrados;
- B3/B4/B5 permanecen pendientes;
- `git diff --check` PASS;
- `npm run format:check` PASS;
- `make governance` PASS.

## Cierre verificado — 16-ago-2026

La promoción prematura fue corregida sin alterar el cierre técnico de B2.

Evidencia final:

- `REQ-DOM-013` volvió a `En curso`;
- la evidencia B1+B2 permanece registrada;
- B3/B4/B5 permanecen pendientes;
- SPEC-016-B permanece abierta;
- SPEC-016-C permanece bloqueada;
- D-070 y D-071 permanecen intactas;
- `git diff --check` PASS;
- `npm run format:check` PASS sobre 768 archivos;
- `make governance` PASS con 22 archivos requeridos, 56 requisitos y 71 decisiones.

BUG-016-B-012 queda CERRADO.
