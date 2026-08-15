# BUG-016-A-015 — Línea en blanco adicional al EOF de BUG-016-A-014

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante el cierre documental de BUG-016-A-014, el control:

`git diff --no-index --check /dev/null docs/BUG-016-A-014_BLANK_LINE_EOF_BUG_013.md`

detectó:

`new blank line at EOF`

La anomalía se encuentra exclusivamente al final de:

`docs/BUG-016-A-014_BLANK_LINE_EOF_BUG_013.md`

## Causa diagnosticada

El comando utilizado para agregar la evidencia de cierre escribió:

`text.rstrip() + evidence + "\n"`

mientras el bloque `evidence` ya terminaba con un carácter newline.

La combinación produjo dos LF consecutivos al EOF.

La causa pertenece al procedimiento documental de cierre y no a SPEC-016-A B3.1.

## Impacto

El defecto es exclusivamente de formato documental.

No afecta:

- código productivo B3.1;
- corpus contractual B3.1;
- BUG-016-A-013;
- B1/B2;
- effectiveGenerationInputSha256;
- availability;
- autoridad;
- frontera B2/B3.

Antes de detectar esta anomalía se confirmó:

- BUG-016-A-014 declara `CERRADO — 13-ago-2026`;
- BUG-016-A-013 conserva SHA
  `407d28966eba6a1b60ca64f6e9391e4209a51658efe434fed5818970b2a058c0`;
- producto B3.1 conserva SHA
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus B3.1 conserva SHA
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`.

## Corrección requerida

Eliminar exclusivamente un LF final de
`docs/BUG-016-A-014_BLANK_LINE_EOF_BUG_013.md`,
dejando exactamente un único newline POSIX al EOF.

No modificar su contenido textual ni su estado de cierre.

La futura actualización de este BUG-016-A-015 debe escribirse con una construcción que
normalice explícitamente el EOF a un solo newline para no repetir el defecto.

## Criterio de cierre

BUG-016-A-015 puede cerrarse cuando:

- BUG-016-A-014 termina exactamente con un único newline POSIX;
- su contenido textual permanece intacto;
- `git diff --no-index --check` sobre BUG-016-A-014 pasa;
- BUG-016-A-013, producto y corpus B3.1 conservan sus SHA;
- el propio BUG-016-A-015 termina con un único newline POSIX;
- no se realiza staging, commit ni push.

B3.2 permanece sin iniciar.

## Evidencia de cierre

La causa diagnosticada fue confirmada: el cierre de BUG-016-A-014 había dejado dos
caracteres LF consecutivos al EOF.

La correctiva:

- eliminó exclusivamente un LF final de
  `docs/BUG-016-A-014_BLANK_LINE_EOF_BUG_013.md`;
- dejó exactamente un único newline POSIX al EOF;
- no modificó el contenido textual ni el estado `CERRADO — 13-ago-2026` de BUG-016-A-014.

SHA posterior de BUG-016-A-014:

`c1c1462acfefff2fd46747001a37311686e319d821acb37ae1a32ebbe3a8c521`

Se verificó además que permanecieron byte-identical:

- BUG-016-A-013:
  `407d28966eba6a1b60ca64f6e9391e4209a51658efe434fed5818970b2a058c0`;
- producto B3.1:
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus B3.1:
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`.

`git diff --no-index --check` debe quedar limpio para BUG-016-A-014 y
BUG-016-A-015.

El propio BUG-016-A-015 se escribe mediante normalización explícita:

`contenido.rstrip() + "\n"`

por lo que debe terminar con exactamente un único newline POSIX.

No se realizó staging, commit ni push.

B3.2 permanece sin iniciar.

BUG-016-A-015 queda cerrado.
