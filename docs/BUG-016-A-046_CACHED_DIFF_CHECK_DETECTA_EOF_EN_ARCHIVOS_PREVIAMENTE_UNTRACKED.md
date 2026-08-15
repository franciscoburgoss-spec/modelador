# BUG-016-A-046 — cached diff check detecta EOF en archivos previamente untracked

## Estado

CERRADO — 15-ago-2026.

## Hallazgo

La auditoría posterior al staging autorizado de SPEC-016-A ejecutó:

`git diff --cached --check`

El gate terminó con status `2` y detectó `new blank line at EOF` en ocho
documentos que antes del staging eran archivos untracked.

## Archivos afectados

- `docs/BUG-016-A-020_UI_CONSTRUCTIVA_PROPUESTA_DENTRO_DE_ESTRUCTURA.md`
- `docs/BUG-016-A-022_ANALYSIS_CONTEXTS_SIN_FUENTE_PRODUCTIVA_CANONICA.md`
- `docs/BUG-016-A-031_HASH_XY_FX008_NO_COINCIDE_CON_EVIDENCIA_CONGELADA_BUG_022.md`
- `docs/BUG-016-A-032_SHA_B2_INCORRECTO_EN_HANDOFF_NUEVO_CHAT.md`
- `docs/BUG-016-A-033_GATE_COMPONENT_TEST_JSX_SIN_TSX.md`
- `docs/BUG-016-A-037_ANCHOR_PATCH_UI_CREACION_NO_COINCIDE.md`
- `docs/BUG-016-A-038_INSPECCION_INELEGIBLE_DERRIBA_WORKSPACE.md`
- `docs/BUG-016-A-039_INSPECCION_CONFUNDE_EXECUTION_CON_ESTADO_GENERACION.md`

## Diagnóstico

El defecto no corresponde a producto ni a contratos de SPEC-016-A.

La causa es una brecha del gate pre-staging: `git diff --check` no examinó
estos documentos mientras eran untracked. Sólo después de incorporarlos al
index, `git diff --cached --check` pudo detectar el whitespace final.

El staging de los 66 archivos sí coincidió exactamente con el fingerprint
humano previamente autorizado:

`895271fc56b0799976cd7ed3fba3c9417f13d5426e6fd7b3166481e6ecb630d1`

La anomalía fue detectada antes de commit.

## Impacto

No altera:

- geometría agnóstica;
- `structuralIntent`;
- requirements;
- B1/B2/B3;
- adapter, generation o receipt;
- store, UI o tests;
- C1–C20;
- D-067, D-068 ni D-069.

Impide autorizar commit mientras el index no pase
`git diff --cached --check`.

## Correctiva requerida

1. retirar únicamente la línea en blanco sobrante al EOF de los ocho
   documentos afectados;
2. no modificar su contenido semántico;
3. reconciliar BUG-016-A a 46/46;
4. repetir los gates documentales;
5. construir y auditar un nuevo fingerprint del corte corregido;
6. solicitar una nueva autorización humana de staging para el corte
   revisado antes de actualizar el index.

## Criterios de cierre

- los ocho documentos terminan con exactamente un newline;
- ningún otro byte semántico cambia;
- `npm run format:check` PASS;
- `git diff --check` PASS sobre el worktree corregido;
- `make governance` PASS;
- BUG-016-A queda 46/46 cerrado;
- no cambia `src/` ni `tests/` por esta correctiva;
- no se ejecuta commit ni push durante la correctiva.

## Cierre verificado

BUG-016-A-046 queda cerrado el 15-ago-2026.

La correctiva normalizó exclusivamente el EOF de los ocho documentos
identificados por el primer `git diff --cached --check`.

Evidencia:

- los 8/8 archivos terminan con exactamente un newline;
- su contenido previo al EOF permanece idéntico al index original;
- `src/` y `tests/` no fueron modificados por esta correctiva;
- `npm run format:check`: PASS;
- `git diff --check` sobre el worktree: PASS;
- `make governance`: PASS;
- el index anterior permaneció deliberadamente intacto con 66 archivos;
- `git diff --cached --check` del index antiguo sigue reproduciendo el
  hallazgo y no se interpreta como gate final del corte corregido.

El defecto quedó detectado y corregido antes de commit. La autorización de
staging anterior no se reutiliza para actualizar silenciosamente el index.
