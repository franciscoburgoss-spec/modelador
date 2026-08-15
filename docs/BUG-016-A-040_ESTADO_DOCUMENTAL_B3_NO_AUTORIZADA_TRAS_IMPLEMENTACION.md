# BUG-016-A-040 — Estado documental mantiene B3 no autorizada tras implementación

## Estado

CERRADO — 14-ago-2026.

## Hallazgo

La auditoría global posterior al cierre de BUG-016-A-020 detectó una
contradicción material entre el estado declarado por
`specs/SPEC-016-A-arquitectura-soluciones-constructivas.md` y el estado real
del worktree de SPEC-016-A.

La cabecera de la SPEC todavía declara:

`abierta · B1/B1.1 aprobados y cerrados · B2 aprobado y cerrado por revisión humana tras B2-CLOSE · B3 no autorizada`

y el documento conserva además afirmaciones equivalentes a:

- la aprobación de B2 no autoriza B3;
- adapter, generation, receipt, availability, freshness y coverage funcional
  pertenecen a B3 y continúan no autorizados.

Sin embargo, el worktree vigente contiene implementación y pruebas
productivas posteriores a B2, entre ellas:

- `src/core/constructiveGenerationInput.js`;
- `src/core/constructiveSolutionGeneration.js`;
- `src/core/constructiveGenerationReceipt.js`;
- `src/core/constructiveGenerationPipeline.js`;
- `src/core/constructiveNeutralRuntime.js`;
- `src/core/constructiveScenarioInspection.js`;
- integración store/UI de escenarios constructivos;
- suites específicas de B3 y de integración.

Asimismo, los BUG de la serie `BUG-016-A-013` a `BUG-016-A-039`
registrados durante estos cortes aparecen cerrados en la auditoría actual.

## Impacto

Mientras persista esta contradicción:

- la SPEC no representa el alcance realmente implementado;
- no puede determinarse documentalmente si B3 está abierto, cerrado o sólo
  parcialmente ejecutado;
- cualquier intento de cierre integral de SPEC-016-A quedaría apoyado en un
  estado documental falso;
- actualizar la cabecera sin auditar primero la evidencia B3 podría ocultar
  un subcorte pendiente.

## Diagnóstico

La discrepancia se detectó con una auditoría READ-ONLY sobre:

- baseline Git;
- SPEC-016-A vigente;
- estados de BUG-016-A-001…039;
- módulos productivos;
- tests de generación y UI;
- referencias textuales B1/B2/B3/B4.

No se modifica la SPEC como parte del registro de este BUG.

## Correctiva exigida

Antes de modificar el estado de SPEC-016-A se debe:

1. reconstruir READ-ONLY el mapa real de B3;
2. identificar sus subcortes implementados y sus gates/cierres;
3. verificar si existe evidencia formal de cierre B3;
4. identificar cualquier criterio de aceptación todavía no satisfecho;
5. sólo entonces actualizar de manera coherente el estado documental.

No se debe inferir `B3 cerrado` únicamente porque existan archivos
productivos o tests.

## Criterio de cierre

BUG-016-A-040 podrá cerrarse únicamente cuando:

- el estado documental de B3 coincida con la evidencia real;
- cualquier afirmación `B3 no autorizada` obsoleta haya sido corregida o
  contextualizada;
- no se oculte ningún subcorte B3 pendiente;
- la trazabilidad permita justificar si SPEC-016-A continúa abierta o puede
  avanzar a cierre integral;
- los cambios documentales correspondientes pasen sus gates declarados.

## Avance de correctiva — B3-CLOSE

El 14-ago-2026 se completó la reconstrucción READ-ONLY exigida por este BUG.

La auditoría confirmó que B3.1, B3.2 y B3.3 fueron implementados y
ejercitados, pero que la documentación vigente todavía terminaba en D-067,
que cerraba B2 y exigía una autorización humana separada para B3.

La revisión humana ratificó explícitamente `B3-CLOSE` el 14-ago-2026.

La regularización documental:

- conserva D-067 como hecho histórico;
- registra D-068 como ratificación posterior de B3;
- actualiza SPEC, STATUS, TRACEABILITY, README y sesión;
- mantiene SPEC-016-A abierta;
- no crea todavía `sessions/close-SPEC-016-A.md`;
- no autoriza SPEC-016-B/C;
- no modifica código productivo ni contratos B1/B2/B3.

BUG-016-A-040 permanece **ABIERTO** hasta que esta regularización pase los
gates documentales e integrales declarados y la auditoría confirme que no
queda una afirmación vigente contradictoria sobre el estado de B3.

## Cierre verificado

BUG-016-A-040 queda cerrado el 14-ago-2026.

La correctiva exigida fue completada sin reescribir la historia:

- D-067 conserva el hecho de que B2 cerró antes de autorizar B3;
- D-068 registra la ratificación posterior y cierre de B3;
- D-069 registra la autorización humana separada
  `SPEC-016-A-CLOSE`;
- B3.1, B3.2 y B3.3 quedaron identificados y auditados;
- la SPEC dejó de contener afirmaciones vigentes que declaren B3
  no autorizada;
- SPEC, STATUS, TRACEABILITY, README y sesiones representan el estado real;
- la auditoría C1–C20 no detectó subcortes B3 pendientes;
- el candidato de cierre pasó `npm run validate` integral con exit code 0;
- migration, artifacts, derived, Codex audit y governance pasaron;
- `git diff --check` pasó;
- SPEC-016-B/C permanecen fuera de alcance.

La corrección fue exclusivamente documental y de trazabilidad; no modifica
geometría, `structuralIntent`, requirements, adapter, generación, receipt,
store, UI ni tests.

Con esto se satisfacen todos los criterios de cierre declarados por este BUG.
