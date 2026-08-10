# BUG-015-D-009 — Expectativas obsoletas en tests de componentes

## Estado

Corregido en REV4 durante la validación local completa de SPEC-015-D.

## Detección

El Mac del usuario superó la suite Node completa con 948/948 pruebas y luego `test:components` ejecutó 37 pruebas: 35 PASS y 2 FAIL, ambas en `tests/structuralProposalWorkspace.component.test.jsx`.

## Hallazgo 1 — rechazo y trace

El test de rechazo exigía un total absoluto de `1` evento en `structuralIntentTrace`. Eso contradice el contrato aprobado de SPEC-015-D: rechazar es una decisión de revisión humana que crea **1 paso de historial + 1 evento de review + 0 eventos nuevos de trace**, sin modificar `structuralIntent`.

La aplicación productiva se comportó correctamente. La prueba se cambia para capturar el número previo de eventos de trace y exigir que permanezca idéntico después del rechazo.

## Hallazgo 2 — campo opcional ambiguo

El test de retorno de foco usaba `getByPlaceholderText("Opcional")`. El diálogo contiene legítimamente dos controles opcionales: `Código/motivo` y `Nota`, por lo que Testing Library rechaza la consulta ambigua.

La prueba se cambia a una consulta accesible y semántica por rol y nombre: el textbox `Código/motivo`, que además es el campo que recibe foco inicial según el contrato de teclado.

## Corrección

Sólo se modifica el contrato de prueba y la trazabilidad documental. No cambia código productivo, store, motor de decisiones, review log, trace ni UI.

## Criterio de cierre

- rechazo: historial +1; review +1; intención sin cambios; trace sin cambios;
- diálogo: foco inicial en `Código/motivo`;
- Escape: restaura el foco al botón que originó la decisión;
- suite completa de componentes debe volver a ejecutarse en el Mac.
