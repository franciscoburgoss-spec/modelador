# BUG-016-A-018 — Receipt persistente sin coherencia operacional

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

La auditoría previa a B3.3 confirmó que el validador B1 de `lastGeneration` exige:

- shape exacto de `constructive-generation-receipt-v1.0`;
- SHA-256 válidos;
- `coverageAtGeneration` en `none|partial|complete`;
- conteos enteros no negativos;
- ocho `effectiveFingerprints`;
- cinco hashes de `globalProvenance`.

Sin embargo, B1 no comprueba la coherencia semántica entre `coverageAtGeneration` y:

- `resolvedCount`;
- `partiallyResolvedCount`;
- `unresolvedCount`.

Por ello un receipt estructuralmente válido podría declarar, por ejemplo:

`coverageAtGeneration = complete`

junto con:

`unresolvedCount = 1`.

## Impacto

B3.3 no puede reconstruir coverage/freshness confiablemente limitándose a aceptar cualquier receipt
que haya superado la validación estructural B1.

El receipt es evidencia histórica y no una segunda autoridad, pero su evidencia debe ser internamente
coherente antes de utilizarse para reconstrucción operacional.

## Decisión de correctiva

B1 permanece byte-identical.

B3.3 introducirá validación operacional fail-closed del receipt antes de:

- reconstruir coverage;
- reconstruir freshness;
- registrar un receipt nuevo como `lastGeneration`.

La validación operacional debe exigir como mínimo:

- `none`:
  `resolvedCount === 0` y `partiallyResolvedCount === 0`;
- `complete`:
  `partiallyResolvedCount === 0` y `unresolvedCount === 0` y `resolvedCount > 0`;
- `partial`:
  existe al menos una respuesta (`resolvedCount + partiallyResolvedCount > 0`) y no todos están
  `resolved`.

Además, para receipts recién construidos, la suma de los tres conteos debe coincidir exactamente con
el número de requirements efectivos de la generación.

## Resguardos

La correctiva no puede:

- modificar B1;
- modificar B2;
- modificar B3.1;
- modificar B3.2;
- convertir coverage en verificación;
- usar `globalProvenance` o subfingerprints como autoridad fresh/stale;
- persistir output materializado;
- introducir store o UI;
- introducir Metalcon, OSB, perfiles, capacidades, rigidez o normativa.

## Criterio de cierre

BUG-016-A-018 puede cerrarse cuando:

- existe corpus BEFORE que demuestra receipts operacionalmente incoherentes;
- B3.3 los rechaza fail-closed;
- receipts construidos desde outputs B3.2 siempre producen conteos y coverage coherentes;
- reapertura usa sólo receipts operacionalmente válidos;
- B1/B2/B3.1/B3.2 permanecen intactos;
- no hay staging, commit ni push.

## Evidencia de cierre

El BEFORE demostró que la validación estructural B1 aceptaba un receipt con:

- `coverageAtGeneration = complete`;
- `unresolvedCount = 1`.

B1 permaneció byte-identical.

B3.3 añadió validación operacional fail-closed y el corpus congelado comprobó:

- `complete` rechaza unresolved/partial;
- `none` rechaza cualquier respuesta;
- `partial` exige al menos una respuesta y rechaza semántica complete;
- un receipt correspondiente al input actual debe cubrir exactamente todos los requirements efectivos;
- receipts producidos desde B3.2 derivan sus conteos directamente de coverage;
- reapertura conserva sólo receipt y reconstruye estado sin output materializado.

Evidencia final:

- focal B3.3: 20/20 PASS;
- regresión B1+B2+B3.1+B3.2+B3.3: 159/159 PASS;
- FX-008 A: `partial`, conteos 1/0/1 y `fresh`;
- FX-008 B: `none`, conteos 0/0/2 y `fresh`;
- runtime ausente produce `unavailable` sin fabricar `stale`;
- aggregate distinto produce `stale` y coverage `notGenerated`;
- regeneración idéntica reproduce `outputCanonicalSha256`;
- B1/B2/B3.1/B3.2 permanecen byte-identical;
- no se persistió output constructivo;
- no se introdujeron store, UI, Metalcon u OSB.

BUG-016-A-018 queda cerrado.
