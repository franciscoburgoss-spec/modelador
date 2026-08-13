# BUG-016-A-008 — Binding legacy/typed target inconsistente

## Estado

CERRADO — 12-ago-2026. B2.4-E aprobado dentro del cierre humano B2-CLOSE; B2 aprobado y cerrado. B3 no autorizado.

## Defecto

La evidencia B2.4-D reproduce:

```text
requirements.sourceRefs = ["P1"]
legacyValue = "P1"
to = { domain: pathId, value: "P2" }
```

Con P2 existente y resoluble, el estado actual redirige silenciosamente P1 a P2 y obtiene
`pathRefs=["P2"]`, `scopeDeterminate=true`, `eligible=true` y cero diagnostics.

## Decisión humana

El contexto puede tipar una referencia legacy, pero no puede cambiar su identidad. Para toda
ocurrencia legacy materializada debe cumplirse:

```text
legacyValue === String(to.value)
```

Una contradicción produce `SCOPE_REF_PROVENANCE_MISMATCH`, scope indeterminado y
`eligible=false`. No se crea un reason code nuevo.

Esta regla conserva como válidos:

- ocurrencias distintas `legacyValue="SAME" -> pathId:"SAME"` y
  `legacyValue="SAME" -> candidatePathEdgeId:"SAME"`, sin ambigüedad sólo por compartir valor;
- `legacyValue="1784606313849" -> to.value=1784606313849`.

## Gate BEFORE-FIX

Capturado antes de modificar código productivo con Node 22.23.2 / npm 10.9.9:

```bash
node --test --test-name-pattern='BUG-016-A-008 reversión H2' tests/constructiveScenarioContext.test.mjs
```

Resultado: `0 PASS / 1 FAIL`, exit code 1. Evidencia exacta:

```json
{"pathRefs":["P2"],"scopeDeterminate":true,"resolutionDiagnostics":[],"eligible":true,"reasonCodes":[]}
```

## Fix y evidencia AFTER

Antes de aceptar el target de una ocurrencia, B2 exige literalmente
`binding.legacyValue === String(binding.to.value)`. La reproducción `P1 -> pathId:P2` queda con
`scopeDeterminate=false`, `eligible=false` y `SCOPE_REF_PROVENANCE_MISMATCH`. El caso numérico
`"1784606313849" -> 1784606313849` permanece válido.

### Resolución humana del STOP T13

El primer focal AFTER detectó que el fixture sintético histórico T13 violaba la misma regla:

```text
BEFORE inválido: SAME -> pathId:P1; SAME -> candidatePathEdgeId:E1
AFTER contractual: SAME -> pathId:SAME; SAME -> candidatePathEdgeId:SAME
```

El productor real no puede crear los aliases arbitrarios del BEFORE. La revisión humana autorizó
corregir exclusivamente esa materialización, incluido el path resoluble y la relación exacta
`candidatePathEdgeId:SAME -> candidateEdgeMemberOfPath -> pathId:SAME`. La propiedad T13 no cambió:
ambas identidades `domain + value` sobreviven sin `DOMAIN_AMBIGUOUS` ni
`PROVENANCE_MISMATCH`. La regla productiva no recibió excepciones ni heurísticas.
