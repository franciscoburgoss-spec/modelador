# BUG-016-A-024 — Regex inválido en auditoría de hash del runtime neutral

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante la auditoría previa a definir la identidad SHA-256 de la biblioteca neutral productiva se
intentó buscar patrones existentes de canonicalización y fingerprint con una expresión regular
compuesta.

`rg` abortó con:

`regex parse error: unclosed group`

## Impacto

La consulta no alcanzó a demostrar qué helper productivo debe reutilizar el nuevo runtime neutral
para obtener un SHA-256 canónico.

No existe falla de producto y ningún archivo productivo fue modificado por el hallazgo.

## Correctiva

Repetir la auditoría mediante búsquedas literales independientes, evitando una expresión regular
compuesta innecesaria.

## Resguardos

- no modificar B1/B2/B3.1/B3.2/B3.3;
- no inventar otra función SHA-256;
- no fijar todavía el hash productivo de la biblioteca neutral;
- no realizar Git write.

## Criterio de cierre

Cerrar cuando la búsqueda corregida ejecute sin error y permita elegir explícitamente el helper
canónico existente que usará la identidad de la biblioteca neutral.

## Evidencia de cierre

La auditoría se repitió mediante búsquedas literales independientes, sin regex compuesto.

Se confirmó que `src/core/structuralProposalCommon.js` ya proporciona la frontera canónica
reutilizable para la identidad del runtime neutral:

- `canonicalizeValue(...)`;
- `canonicalJson(...)`;
- `fingerprint(...)`.

El probe construyó un manifiesto neutral mínimo compuesto únicamente por:

- schema de manifiesto;
- `neutral-contract-library`;
- versión `1.0.0`;
- `abstract-load-transfer-response`.

El SHA-256 se obtuvo mediante `fingerprint(canonicalizeValue(manifest))`, no mediante una constante
de fixture ni una implementación SHA paralela.

La definición todavía es diagnóstica: BUG-016-A-023 permanece abierto hasta materializar el runtime
productivo y cubrirlo con tests.

No se modificó producto.
