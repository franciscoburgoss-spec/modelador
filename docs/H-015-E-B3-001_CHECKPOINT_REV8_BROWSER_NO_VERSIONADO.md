# H-015-E-B3-001 — checkpoint REV8 de navegador no versionado

**SPEC:** SPEC-015-E
**Corte:** B3 — evidencia real FX-008
**Estado:** registrado; no bloqueante para B3

## Hallazgo

El cierre visual de SPEC-015-D REV8 dejó documentado un checkpoint de navegador con:

```text
Propuestas        0
G↓ Caminos        4
Completos         4
L→ Caminos        0
Bloqueos          0
Estado verified   0
```

La propia evidencia de cierre declara que dicho estado se guardó mediante **Archivo → Guardar copia
en navegador** y que no quedó un archivo externo con SHA-256.

Al preparar B3 se comprobó que el fixture versionado puede reconstruir las declaraciones REV8, los
ocho `interfaceIntents`, las cinco `relationIntents`, los cuatro caminos gravitacionales ligados a
relaciones y el estado lateral sin declaración, pero no puede reconstruir literalmente el estado de
review que suprimía las propuestas del workspace final.

## Regla aplicada

B3 no inventa ni falsifica ese estado. La evidencia separa:

- `closureReference`: el conteo observado y documentado en el cierre REV8;
- `reproducibleCheckpoint`: sólo los hechos que sí pueden recalcularse desde autoridades y fixtures
  versionados.

Por tanto `Propuestas=0` no se presenta como resultado recalculado por B3.

## Impacto

No bloquea SPEC-015-E porque R6–R12 consumen intención explícita, interfaces/relaciones y caminos
candidatos como evidencia; el contador de propuestas pendientes del workspace no es autoridad ni
condición para convertir un requisito en `verified`.

Si una SPEC futura necesita reproducir exactamente ese estado de review, deberá versionar un fixture
nativo que incluya el log/estado correspondiente y su hash; no corresponde fabricarlo aquí.
