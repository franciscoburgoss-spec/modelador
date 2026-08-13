# BUG-016-A-009 — Selector global de path subconecta scope multi-requirement

## Estado

CERRADO — 12-ago-2026. B2.4-E aprobado dentro del cierre humano B2-CLOSE; B2 aprobado y cerrado. B3 no autorizado.

## Defecto

La evidencia B2.4-D confirma:

```text
C(R1) = [P1]
C(R2) = [P2]
C(R1,R2) = [P1]
```

El trace individual de R2 dentro del caso conjunto sí contiene P2.

## Causa confirmada

`hasContractualPathSelector` pertenece al estado global de la closure. Un selector exacto de R1
lo convierte en `true`; `fallbackReached` de todos los paths depende de
`!state.hasContractualPathSelector`, eliminando la ruta tipada válida e independiente de R2.

## Decisión humana

La clausura agregada de múltiples requirements es la unión canónica de las clausuras completas
calculadas independientemente:

```text
C({R1, R2, ..., Rn})
= canonicalUnion(C(R1), C(R2), ..., C(Rn))
```

La clausura individual conserva la precedencia del selector exacto. No se convierte
`hasContractualPathSelector` simplemente en `false`, no se elimina esa precedencia y no se
reintroduce la sobreconexión P1/P2 dentro de un mismo requirement.

## Gate BEFORE-FIX

Capturado antes de modificar código productivo con Node 22.23.2 / npm 10.9.9:

```bash
node --test --test-name-pattern='BUG-016-A-009 reversión H3' tests/constructiveScenarioContext.test.mjs
```

Resultado: `0 PASS / 1 FAIL`, exit code 1. Las assertions previas demostraron
`C(R1)=["P1"]` y `C(R2)=["P2"]`; la assertion agregada observó:

```json
{"expected":["P1","P2"],"actual":["P1"],"scopeDeterminate":true,"resolutionDiagnostics":[]}
```

## Fix y evidencia AFTER

Para más de un requirement, B2 construye cada clausura individual mediante la semántica vigente y
une canónicamente todos sus componentes de alcance, governing refs, traces y diagnostics. El
resultado demuestra `C(R1)=[P1]`, `C(R2)=[P2]`, `C(R1,R2)=[P1,P2]` y deepEqual para la permutación
`C(R2,R1)`. `aggregate.pathRefs` y sus source refs tipadas coinciden con las uniones de los traces.
Un fail-closed individual vuelve indeterminado al agregado y conserva su diagnostic.
