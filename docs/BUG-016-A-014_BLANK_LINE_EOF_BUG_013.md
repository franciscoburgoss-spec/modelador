# BUG-016-A-014 — Línea en blanco adicional al EOF de BUG-016-A-013

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante el cierre documental de BUG-016-A-013, después de completar satisfactoriamente
la correctiva productiva B3.1 y su regresión, el control:

`git diff --no-index --check /dev/null docs/BUG-016-A-013_LIBRARY_EFFECTIVA_DESCARTADA_EN_FRONTERA_B3_1.md`

detectó:

`new blank line at EOF`

La anomalía se encuentra exclusivamente al final de:

`docs/BUG-016-A-013_LIBRARY_EFFECTIVA_DESCARTADA_EN_FRONTERA_B3_1.md`

## Impacto

El defecto es exclusivamente de formato documental.

No afecta:

- código productivo B3.1;
- corpus contractual B3.1;
- B1/B2;
- `effectiveGenerationInputSha256`;
- availability;
- autoridad;
- frontera B2/B3;
- estado técnico de BUG-016-A-013.

Antes de detectar esta anomalía se verificó que:

- producto B3.1 conserva SHA
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus B3.1 conserva SHA
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`;
- BUG-016-A-013 ya declara estado `CERRADO`.

## Corrección requerida

Eliminar exclusivamente la línea en blanco adicional al EOF de
`docs/BUG-016-A-013_LIBRARY_EFFECTIVA_DESCARTADA_EN_FRONTERA_B3_1.md`.

Debe conservarse:

- todo su contenido textual;
- su estado `CERRADO — 13-ago-2026`;
- toda la evidencia de cierre;
- producto B3.1;
- corpus B3.1.

No modificar ningún otro archivo como parte de la correctiva.

## Criterio de cierre

BUG-016-A-014 puede cerrarse cuando:

- el único cambio en BUG-016-A-013 sea la eliminación de la línea en blanco adicional;
- `git diff --no-index --check` sobre BUG-016-A-013 pase;
- producto y corpus B3.1 conserven sus SHA;
- no se realice staging, commit ni push.

B3.2 permanece sin iniciar.

## Evidencia de cierre

La correctiva modificó exclusivamente el EOF de
`docs/BUG-016-A-013_LIBRARY_EFFECTIVA_DESCARTADA_EN_FRONTERA_B3_1.md`.

Antes:

- el archivo terminaba con dos caracteres LF consecutivos;
- `git diff --no-index --check` informaba `new blank line at EOF`.

Después:

- el archivo termina con un único newline POSIX;
- su contenido textual y estado `CERRADO — 13-ago-2026` permanecen intactos;
- `git diff --no-index --check` sobre BUG-016-A-013: PASS;
- `git diff --no-index --check` sobre BUG-016-A-014: PASS.

SHA posterior de BUG-016-A-013:

`407d28966eba6a1b60ca64f6e9391e4209a51658efe434fed5818970b2a058c0`

Producto y corpus B3.1 permanecieron byte-identical:

- producto:
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus:
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`.

No se realizó staging, commit ni push.

B3.2 permanece sin iniciar.

BUG-016-A-014 queda cerrado.
