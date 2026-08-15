# Cierre SPEC-016-A — Arquitectura de soluciones constructivas y escenarios

## Estado

CIERRE VERIFICADO — 14-ago-2026.

## Decisión humana

La revisión humana aprobó explícitamente:

`SPEC-016-A-CLOSE`

La autorización queda registrada en D-069.

El candidato de cierre fue validado integralmente y la transición documental final fue autorizada por D-069. SPEC-016-A queda cerrada con las autoridades y límites aquí registrados.

## Alcance cerrado

SPEC-016-A cubre:

- modelo nativo v4 y raíz `constructiveSolutions`;
- escenarios y assignments persistentes;
- IDs y allocators deterministas;
- scope `all` / `requirements`;
- elegibilidad local fail-closed;
- cierre tipado de blockers;
- effective input mínimo y canónico;
- adapter input neutral;
- `effectiveGenerationInputSha256`;
- subfingerprints explicativos;
- availability;
- generación neutral efímera;
- coverage;
- `verificationState=notVerified`;
- receipt persistente;
- freshness/reapertura;
- pipeline B2 → B3.1 → B3.2 → B3.3;
- store histórico, atómico y no-op aware;
- inspección derivada;
- UI de escenarios separada de `Estructura`.

## Autoridades preservadas

El cierre mantiene:

- geometría agnóstica como autoridad física;
- `structuralIntent` como autoridad humana persistente;
- requirements como derivados no autoritativos;
- propuestas y candidate paths como derivados no autoritativos;
- solución constructiva generada como derivado no persistente;
- sólo el receipt como evidencia persistente de generación.

No se equipara:

- candidate con verified;
- resolved con verified;
- complete con verified;
- fresh con verified;
- available con verified.

## Auditoría de criterios de aceptación

| Criterio | Resultado final |
|---|---|
| C1 | PASS |
| C2 | PASS |
| C3 | PASS |
| C4 | PASS |
| C5 | PASS |
| C6 | PASS |
| C7 | PASS |
| C8 | PASS |
| C9 | PASS |
| C10 | PASS |
| C11 | PASS |
| C12 | PASS |
| C13 | PASS |
| C14 | PASS |
| C15 | PASS |
| C16 | PASS |
| C17 | PASS |
| C18 | PASS |
| C19 | PASS |
| C20 | PASS |

Evidencia focal acumulada de la auditoría:

- C1–C6: 99/99 PASS;
- C7–C15: 70/70 PASS;
- C16–C17: 18/18 PASS;
- C18–C19: 142/142 PASS;
- C20 persistencia/store: 29/29 PASS;
- C20 componentes/UI: 14/14 PASS.

El último `npm run validate` integral previo a esta materialización terminó
con exit code 0.

## BUGs

Resultado final, incluida la auditoría READ-ONLY pre-commit posterior al cierre:

- BUG-016-A registrados: 46;
- cerrados: 46;
- abiertos: 0.

BUG-016-A-040 cerró la transición documental principal. La auditoría pre-commit detectó posteriormente BUG-016-A-045, exclusivamente documental, que fue registrado antes de corregirse y quedó cerrado sin modificar producto, tests ni C1–C20.

## Fuera de alcance

Este cierre no autoriza ni implementa:

- SPEC-016-B;
- SPEC-016-C;
- solución Metalcon real;
- comparación de soluciones;
- verificación resistente;
- generación constructiva DXF/INP;
- persistencia del output constructivo.

## Git

No se ejecuta `git add`, `git commit` ni `git push` como consecuencia de
esta autorización.

## Verificación final

Antes de materializar el estado cerrado se ejecutó el candidato
`SPEC-016-A-CLOSE` completo:

- `npm run validate`: PASS, exit code 0;
- Node: 1212/1212 PASS;
- componentes: 61/61 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- goldens: PASS;
- DXF audit: PASS;
- CalculiX: 3/3 PASS;
- build: PASS;
- migration: PASS;
- artifacts: PASS;
- derived contract: PASS;
- Codex audit: PASS;
- governance: PASS;
- `git diff --check`: PASS.

C1–C20 quedan PASS.

No hay SPEC activa después de este cierre. SPEC-016-B/C no quedan
autorizadas por inferencia.

No se ejecutó Git de escritura como parte del cierre.

## Auditoría pre-commit posterior al cierre

Después del cierre verificado y antes de staging, una auditoría READ-ONLY
detectó BUG-016-A-045: una línea residual de fecha anterior en
`specs/README-SERIE-015-016.md`.

El hallazgo fue registrado antes de corregirse.

La microcorrectiva:

- eliminó sólo la línea residual;
- preservó la cabecera final de la serie;
- mantuvo SPEC-016-B/C futuras y no autorizadas;
- no modificó `src/` ni `tests/`;
- conservó C1–C20;
- pasó `format:check`, `git diff --check` y governance.

Por ello, la serie final de incidencias de SPEC-016-A queda en 45/45
cerradas antes de staging.

## Auditoría post-staging — BUG-016-A-046

El primer staging autorizado materializó exactamente los 66 archivos
auditados y conservó el fingerprint aprobado:

`895271fc56b0799976cd7ed3fba3c9417f13d5426e6fd7b3166481e6ecb630d1`

La primera ejecución de `git diff --cached --check` reveló ocho documentos
previamente untracked con una línea en blanco adicional al EOF.

El hallazgo se registró como BUG-016-A-046 antes de corregirlo.

La correctiva se realizó exclusivamente en el worktree:

- 8/8 EOF normalizados a un único newline;
- ningún cambio semántico en esos documentos;
- cero cambios adicionales en `src/` o `tests/`;
- `format:check`, `git diff --check` y governance PASS.

El index de 66 archivos se mantuvo sin modificar para conservar la evidencia
del primer staging. Por lo tanto, dicho index no está autorizado para commit.

Tras esta correctiva, la serie BUG-016-A queda en 46/46 cerrados. Antes de
actualizar el index debe auditarse el nuevo corte y obtenerse una nueva
autorización humana explícita de staging.
