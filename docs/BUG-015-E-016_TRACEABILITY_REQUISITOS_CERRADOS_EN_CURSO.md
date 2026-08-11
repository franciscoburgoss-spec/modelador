# BUG-015-E-016 — Requisitos cerrados permanecen `En curso` en TRACEABILITY

## Estado

CERRADO — 11-ago-2026.

## Hallazgo

`REQ-DOM-006`, `REQ-DOM-007` y `REQ-DOM-010` permanecen `En curso` en
`governance/TRACEABILITY.md` pese al cierre y la evidencia aprobada de sus SPEC
correspondientes.

## Evidencia

- SPEC-015-A está cerrada en `sessions/close-SPEC-015-A.md`; sus doce criterios constan como
  PASS y la validación registra 22/22 pruebas enfocadas, `npm run validate`, gobernanza y gates
  restantes aprobados.
- SPEC-015-B está cerrada en `sessions/close-SPEC-015-B.md`; sus criterios constan como PASS y el
  validador local autoritativo registra 24/24 gates aprobados.
- SPEC-015-E está cerrada en `sessions/close-SPEC-015-E.md`; la validación integral registra
  1023/1023 pruebas Node, 49/49 de componentes, 9/9 Rust, 35/35 de laboratorio, 3/3 CalculiX y
  gobernanza PASS.

## Origen

Las tres filas fueron creadas con estado `En curso` y nunca transicionaron posteriormente:

- `REQ-DOM-006` fue incorporado por `6def1c1`;
- `REQ-DOM-007` fue incorporado por `ef39f2b`;
- `REQ-DOM-010` fue incorporado por `8164e66`.

## Impacto

La inconsistencia es exclusivamente documental y afecta la trazabilidad del estado de requisitos.
No afecta código, geometría, `structuralIntent`, interfaces, `candidateLoadPaths`, R6–R12 ni
resultados.

## Corrección requerida

Cambiar exclusivamente la celda de estado de las tres filas:

- `REQ-DOM-006`: `En curso` → `Verificado`;
- `REQ-DOM-007`: `En curso` → `Verificado`;
- `REQ-DOM-010`: `En curso` → `Verificado`.

## Aclaración semántica

`Verificado` en `TRACEABILITY.md` significa que el requisito contractual dispone de evidencia de
aceptación. No convierte estados estructurales `notVerified` en verificación estructural.

## Fronteras

La correctiva no puede alterar:

- otros requisitos de `governance/TRACEABILITY.md`;
- `governance/STATUS.md`, `governance/RISKS.md` ni `governance/DECISIONS.md`;
- ninguna SPEC ni cierre histórico;
- código, geometría, contratos, evidencia ni resultados.

H-GOV-POST015E-002 permanece fuera de alcance.

## Resolución

La corrección aplicada consistió únicamente en estas tres transiciones de estado en
`governance/TRACEABILITY.md`:

- `REQ-DOM-006`: `En curso` → `Verificado`;
- `REQ-DOM-007`: `En curso` → `Verificado`;
- `REQ-DOM-010`: `En curso` → `Verificado`.

No hubo cambios en código, geometría, resultados ni autoridad estructural. `Verificado` en
`TRACEABILITY.md` conserva exclusivamente su significado documental y no convierte estados
estructurales `notVerified` en verificación estructural.

## Criterio de cierre

Las celdas de estado de `REQ-DOM-006`, `REQ-DOM-007` y `REQ-DOM-010` quedan en `Verificado`, sin
ningún otro cambio semántico.
