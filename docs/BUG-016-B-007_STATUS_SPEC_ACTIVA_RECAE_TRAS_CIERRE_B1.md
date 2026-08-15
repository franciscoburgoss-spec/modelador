# BUG-016-B-007 — STATUS vuelve a contradecir la SPEC activa durante cierre B1

## Estado

CERRADO — 15-ago-2026.

## Evidencia

Durante la inspección READ-ONLY previa al cierre documental de SPEC-016-B B1,
governance/STATUS.md declara simultáneamente:

- en la tabla superior: Spec activa = Ninguna;
- en la tabla superior: Esfuerzo activo = Ninguno;
- en la sección "SPEC activa": SPEC-016-B;
- SPEC-016-B fue abierta el 15-ago-2026 y permanece abierta;
- el corte B1 todavía figura como pendiente aunque ya fue implementado y
  validado mediante npm run validate.

La inconsistencia reproduce la clase de problema que había sido cerrada por
BUG-016-B-003.

## Diagnóstico

No existe una segunda autoridad de estado.

SPEC-016-B permanece activa y abierta.
Su esfuerzo planificado es high.
B1 terminó su implementación y validación técnica.
B2 es el siguiente corte pendiente.

El resumen superior de STATUS quedó desactualizado respecto de la sección
autoritativa inferior y del estado real de implementación.

## Restricciones de corrección

- no cerrar SPEC-016-B;
- no abrir ni implementar B2;
- no desbloquear SPEC-016-C;
- no cambiar modelVersion 4;
- no modificar src/, tests/, fixtures, store, UI ni legacy Metalcon;
- no alterar D-070;
- conservar verificationState=notVerified;
- actualizar únicamente documentación y gobernanza coherente con la evidencia.

## Gate de cierre

- STATUS no contiene contradicción sobre SPEC activa;
- B1 figura implementado y validado;
- B2 figura pendiente;
- SPEC-016-B permanece abierta;
- SPEC-016-C permanece bloqueada;
- git diff --check PASS;
- format:check PASS;
- make governance PASS.

## Diagnóstico confirmado

La inspección posterior confirma que la contradicción continúa localizada en
governance/STATUS.md:

- la tabla superior declara Spec activa = Ninguna;
- la tabla superior declara Esfuerzo activo = Ninguno;
- la sección inferior declara SPEC-016-B activa;
- la sección inferior todavía presenta B1 como próximo corte.

La SPEC y la sesión de implementación ya reflejan correctamente que B1 fue
implementado y validado y que B2 es el siguiente corte pendiente.

TRACEABILITY todavía conserva REQ-DOM-013 en curso con evidencia B1 genérica.
Debe actualizarse la evidencia de B1 sin promover el requisito completo a
Verificado, porque la biblioteca Metalcon productiva y su hash real pertenecen
a B2.

El primer intento de parche documental se detuvo antes de modificar estos
bloques porque esperaba una representación Markdown distinta de la existente.
Ese fallo de parcheo no constituye un nuevo defecto contractual.

## Cierre verificado

La recurrencia documental quedó corregida:

- STATUS declara `SPEC-016-B` como SPEC activa;
- esfuerzo activo declara `high` planificado / `high` efectivo, sin escalamiento;
- SPEC-016-B permanece abierta;
- B1 figura implementado y validado;
- B2 figura como siguiente corte pendiente;
- SPEC-016-C permanece bloqueada;
- suite oficial B1 y cobertura vigentes quedan reflejadas en STATUS;
- TRACEABILITY registra evidencia B1 sin promover prematuramente
  REQ-DOM-013, REQ-DOM-014 ni REQ-UX-006 a Verificado;
- BUG-016-B-008 corrigió el contrato G0 descubierto durante este cierre;
- `git diff --check`: PASS;
- `npm run format:check`: PASS;
- `make governance`: PASS — 22 archivos requeridos, 56 requisitos y 70 decisiones.

No se modificó producto, tests, fixtures, store, UI, modelVersion 4 ni Metalcon
legacy.
