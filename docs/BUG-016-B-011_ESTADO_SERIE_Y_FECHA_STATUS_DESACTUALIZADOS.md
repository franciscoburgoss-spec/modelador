# BUG-016-B-011 — Estado de serie y fecha de STATUS desactualizados

## Estado

CERRADO — 16-ago-2026.

## Contexto

Durante la inspección READ-ONLY previa al cierre documental de
SPEC-016-B B2 se detectaron dos inconsistencias de gobernanza existentes.

## Evidencia

`specs/README-SERIE-015-016.md` declara:

    SPEC-016-B/C permanecen futuras y no autorizadas.

Sin embargo, la autoridad viva confirma que:

- SPEC-016-B fue abierta el 15-ago-2026;
- SPEC-016-B es la SPEC activa;
- B1 está cerrado;
- B2 está implementado técnicamente y pendiente de cierre documental;
- SPEC-016-C continúa bloqueada.

Además, `governance/STATUS.md` conserva:

    Última actualización: 14-ago-2026

aunque el mismo documento ya contiene el estado de apertura de SPEC-016-B
del 15-ago-2026.

## Diagnóstico

No existe una segunda autoridad de estado.

El README de la serie quedó desactualizado tras la apertura de SPEC-016-B
y la fecha declarada por STATUS no corresponde a su contenido vigente.

La implementación técnica de B2 no causa estas inconsistencias.

## Restricciones de corrección

- no cerrar SPEC-016-B;
- no abrir ni implementar B3 durante esta correctiva;
- no desbloquear SPEC-016-C;
- no modificar producto, tests, fixtures, store, UI ni schemas;
- no modificar Metalcon legacy;
- no alterar D-070;
- conservar `modelVersion: 4`;
- conservar `verificationState=notVerified`;
- actualizar sólo documentación y gobernanza coherente con el estado real.

## Criterio de cierre

- README reconoce SPEC-016-B abierta y activa;
- README mantiene SPEC-016-C bloqueada;
- STATUS declara una fecha de actualización coherente con su contenido;
- B1 permanece cerrado;
- B2 puede figurar cerrado sólo después de materializar su cierre documental;
- B3 queda como siguiente corte, sin implementación;
- SPEC-016-B permanece abierta;
- `git diff --check` PASS;
- `npm run format:check` PASS;
- `make governance` PASS.

## Correctiva materializada — 16-ago-2026

La autorización humana `SPEC-016-B / B2-CLOSE` permite corregir las superficies
documentales detectadas:

- README reconoce SPEC-016-B abierta y activa;
- B1 y B2 figuran cerrados;
- B3 figura como siguiente corte no iniciado y no autorizado;
- SPEC-016-C permanece bloqueada;
- STATUS declara fecha 16-ago-2026 y el mismo estado;
- TRACEABILITY refleja el cierre B2 sin promover B3/B4/B5;
- SPEC-016-B permanece abierta.

El BUG permanece ABIERTO hasta ejecutar y aprobar los gates documentales
post-cierre exigidos por su propio criterio de cierre.

## Cierre verificado — 16-ago-2026

Correctiva verificada después de `SPEC-016-B / B2-CLOSE`.

Evidencia final:

- README reconoce SPEC-016-B abierta y activa;
- B1 y B2 figuran cerrados;
- B3 figura como siguiente corte no iniciado y no autorizado;
- SPEC-016-C permanece bloqueada;
- `governance/STATUS.md` está actualizado al 16-ago-2026;
- `REQ-DOM-013` y `REQ-DOM-014` conservan su estado correcto dentro de una SPEC todavía abierta;
- `git diff --check` PASS;
- `npm run format:check` PASS sobre 768 archivos;
- `make governance` PASS con 22 archivos requeridos, 56 requisitos y 71 decisiones.

BUG-016-B-011 queda CERRADO.
