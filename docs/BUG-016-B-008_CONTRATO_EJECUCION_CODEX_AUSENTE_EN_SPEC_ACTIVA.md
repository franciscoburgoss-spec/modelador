# BUG-016-B-008 — Contrato de ejecución Codex ausente al reconocer SPEC-016-B activa

## Estado

CERRADO — 15-ago-2026.

## Evidencia

Durante el gate documental de cierre de B1:

make governance

falla con cuatro hallazgos:

- SPEC-016-B-adaptador-metalcon.md: falta "## Ejecución Codex";
- esfuerzo planificado debe ser low, medium o high; nunca xhigh;
- escalamiento xhigh debe ser prohibido o condicionado;
- STATUS.md no declara esfuerzos planificado y efectivo entre backticks.

git diff --check permanece PASS.
format:check permanece PASS.

## Diagnóstico preliminar

BUG-016-B-007 corrigió STATUS para reconocer correctamente SPEC-016-B como
SPEC activa.

Al quedar activa, el validador G0 comenzó a exigir el contrato formal de
ejecución Codex que no estaba completo en la apertura documental.

Esto no demuestra una regresión productiva de B1. Es una inconsistencia de
gobernanza de la SPEC activa que debe corregirse conforme al formato
contractual existente en el repositorio.

## Restricciones

- no modificar src/, tests/, fixtures, store ni UI;
- no implementar B2;
- no cerrar SPEC-016-B;
- no desbloquear SPEC-016-C;
- no alterar D-070;
- no autorizar ni ejecutar Codex;
- no inventar el formato del contrato G0;
- copiar el patrón exigido por validate-governance.mjs y los precedentes
  vigentes del repositorio;
- esfuerzo B1/SPEC-016-B continúa siendo high salvo contradicción contractual
  explícita encontrada en la inspección;
- xhigh no puede quedar planificado silenciosamente.

## Gate de cierre

- contrato "## Ejecución Codex" válido;
- esfuerzo planificado reconocido por G0;
- esfuerzo efectivo reconocido por G0;
- política xhigh válida;
- BUG-016-B-007 continúa resuelto;
- git diff --check PASS;
- format:check PASS;
- make governance PASS.

## Diagnóstico confirmado

La inspección del contrato G0 y sus tests confirma la sintaxis obligatoria:

- la SPEC activa debe contener `## Ejecución Codex`;
- `Esfuerzo planificado` sólo admite `low`, `medium` o `high`;
- `xhigh` no puede planificarse y su escalamiento debe declararse como
  `prohibido` o `condicionado`;
- STATUS debe declarar en la fila `Esfuerzo activo` tanto el esfuerzo
  planificado como el efectivo;
- para SPEC-016-B ambos son `high` y no hubo escalamiento.

El precedente directo SPEC-016-A usa `high` y
`Escalamiento xhigh: prohibido`.

La sesión de implementación de SPEC-016-B ya declara correctamente
`Esfuerzo planificado: high` y no requiere modificación.

La corrección es exclusivamente documental y no autoriza ni ejecuta Codex.

## Cierre verificado

La corrección documental incorpora el contrato G0 exigido para la SPEC activa:

- SPEC-016-B contiene `## Ejecución Codex`;
- esfuerzo planificado: `high`;
- escalamiento xhigh: `prohibido`;
- STATUS declara `high` planificado / `high` efectivo, sin escalamiento;
- no se autorizó ni ejecutó Codex;
- `tests/reasoningEffortGovernance.test.mjs`: 5/5 PASS;
- `tests/codexSpecLauncher.test.mjs`: 13/13 PASS;
- `git diff --check`: PASS;
- `npm run format:check`: PASS;
- `make governance`: PASS — 22 archivos requeridos, 56 requisitos y 70 decisiones.

La correctiva es exclusivamente documental. No modifica producto, tests,
fixtures, store, UI, autoridades de dominio, D-070, modelVersion 4 ni el
alcance de B2.
