# BUG-016-A-007 — Contexto tipado sin sourceSchema

## Estado

CERRADO — 12-ago-2026. B2.4-E aprobado dentro del cierre humano B2-CLOSE; B2 aprobado y cerrado. B3 no autorizado.

## Defecto

`structural-reference-resolution-context-v1.0` declara actualmente:

- `schema`;
- `sourceRequirementsSha256`;
- `referenceBindings`;
- `targets`;
- `provenanceRelations`;
- `canonicalSha256`.

No declara explícitamente el schema del documento fuente que fingerprinta.

## Decisión humana

El contexto debe incluir exactamente:

```text
sourceSchema: "structural-requirements-v1.0"
```

Antes de resolver, B2 debe exigir:

```text
context.sourceSchema
=== structuralRequirements.schema
=== "structural-requirements-v1.0"
```

Si no se cumple, debe producir `SCOPE_REF_CONTEXT_MISMATCH` y fallar cerrado. No se crea un reason
code nuevo y no se versiona `structural-requirements-v1.0`.

## Gate BEFORE-FIX

Capturado antes de modificar código productivo con Node 22.23.2 / npm 10.9.9:

```bash
node --test --test-name-pattern='BUG-016-A-007 reversión H1' tests/structuralRequirements.test.mjs
```

Resultado: `0 PASS / 1 FAIL`, exit code 1. La assertion observó:

```text
actual   = undefined
expected = "structural-requirements-v1.0"
```

## Fix y evidencia AFTER

El productor incluye `sourceSchema: structuralRequirements.schema` antes de canonicalizar y
hashear. B2 exige simultáneamente el schema fuente v1.0 y su igualdad con el contexto. El shape
resultante contiene exactamente `schema`, `sourceSchema`, `sourceRequirementsSha256`,
`referenceBindings`, `targets`, `provenanceRelations` y `canonicalSha256`.

La regresión focal demuestra el valor efectivo `structural-requirements-v1.0`; variantes con el
campo ausente o incorrecto, incluso recanonicalizadas, producen `SCOPE_REF_CONTEXT_MISMATCH`,
scope indeterminado y `eligible=false`.
