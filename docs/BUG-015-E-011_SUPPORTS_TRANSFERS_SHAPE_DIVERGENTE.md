# BUG-015-E-011 — shape de `supports[]` / `transfers[]` divergente

## Reproducción

El contrato B1 ordenaba `supports/transfers` mediante campos singulares `fromRegionRef` / `toRef`, mientras la implementación B2 producía `fromRefs[]`, `toRefs[]` y `ranges[]`.

REV8 admite relaciones n-arias: una transferencia puede tener múltiples puertos `receives` y `delivers`. Por ello el shape singular no representa el contrato real.

## Corrección

Antes del cierre de SPEC-015-E v1.0 se congela la forma plural `fromRefs[]` / `toRefs[]`. Las relaciones declaradas referencian R11 mediante `targetRegionRefs[]` resolubles y dejan de republicar `ranges[]`.

Los supports procedentes de `candidatePath` conservan `evidence.overlapRange` únicamente como evidencia candidata, con `targetRegionRefs: []`, `certainty=candidate` y `verificationState=notVerified`.

Los IDs y la deduplicación permanecen deterministas: relación declarada por `relationId`; evidencia candidata por `graph + edgeId`.
