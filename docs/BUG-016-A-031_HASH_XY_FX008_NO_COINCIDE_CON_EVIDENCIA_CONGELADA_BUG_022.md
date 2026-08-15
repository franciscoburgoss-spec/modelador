# BUG-016-A-031 — Hash X+Y FX-008 no coincide con evidencia congelada de BUG-022

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Después de materializar `constructiveStructuralWorkspace` y ejecutar el GREEN focal de
BUG-016-A-022, dos de tres pruebas pasaron:

- composición determinista y aislamiento de `analysisContexts`;
- independencia de store/UI/Metalcon/OSB.

Falló únicamente la prueba real FX-008 al comparar:

`proposalWorkspace.candidateLoadPaths.canonicalSha256`

Valor actual:

`414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b`

Valor diagnóstico congelado en BUG-016-A-022:

`1cfd2c92fb3c7d33cb731a8ea166125d312acd4d3d367109b1ec72fb56317f97`

El fallo ocurrió antes de evaluar los hashes posteriores de structural requirements.

## Impacto

No existe todavía evidencia suficiente para clasificar el problema como defecto del assembler,
del fixture o de la evidencia diagnóstica previa.

No debe actualizarse el hash esperado ni modificarse producto hasta reconstruir ambas rutas con
la misma entrada efectiva.

## Diagnóstico requerido

Comparar, sobre exactamente el mismo modelo FX-008:

1. `buildStructuralProposalWorkspace(model, {analysisContexts: X+Y})`;
2. `buildConstructiveStructuralWorkspace(model)`;
3. X solamente;
4. Y solamente;
5. contexto producido previamente por el helper;
6. structural requirements derivados de la ruta directa y del assembler.

Debe verificarse además que SPEC-015-D/E no tenga cambios locales.

## Resguardos

- no modificar `constructiveStructuralWorkspace.js`;
- no modificar `constructiveStructuralWorkspace.test.mjs`;
- no cambiar hashes esperados;
- no modificar `structuralProposalWorkspace.js`;
- no modificar `candidateLoadPaths.js`;
- no modificar `structuralRequirements.js`;
- no modificar B1/B2/B3;
- no tocar store/UI;
- no realizar Git write.

## Criterio de cierre

Cerrar sólo cuando se determine reproduciblemente la causa de la divergencia y la correctiva,
si corresponde, preserve las autoridades y decisiones congeladas.

## Causa confirmada

La divergencia no proviene de `constructiveStructuralWorkspace`, de SPEC-015-D/E ni del fixture
FX-008 usado por la ruta productiva.

Gate A confirmó que no existen cambios locales en:

- `src/core/structuralProposalWorkspace.js`;
- `tests/structuralProposalWorkspace.test.mjs`;
- `src/core/candidateLoadPaths.js`;
- `src/core/structuralRequirements.js`.

Gate B reconstruyó sobre exactamente el mismo modelo FX-008:

1. la ruta directa
   `buildStructuralProposalWorkspace(model, { analysisContexts: X+Y })`
   seguida de
   `buildStructuralRequirementsWithReferenceResolutionContext(...)`;
2. la frontera
   `buildConstructiveStructuralWorkspace(model)`.

La comparación mediante `assert.deepEqual` e `isDeepStrictEqual` confirmó:

- `structuralRequirements`: equivalentes estructuralmente;
- `referenceResolutionContext`: equivalentes estructuralmente;
- SHA de structural requirements en ambas rutas:
  `fe7187463f09730dce031a275b970cf22aae5bc396b97937d27170ec162ad301`;
- SHA de candidate load paths en ambas rutas:
  `414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b`.

Por lo tanto, el valor previo

`1cfd2c92fb3c7d33cb731a8ea166125d312acd4d3d367109b1ec72fb56317f97`

era evidencia diagnóstica anterior incorrecta u obsoleta para la ruta X+Y actual y no una
autoridad que justificara modificar producto.

## Correctiva mínima aplicada

Sin modificar SPEC-015-D/E ni `constructiveStructuralWorkspace.js`:

- se corrigió en BUG-016-A-022 el SHA diagnóstico de `candidateLoadPaths` para X+Y;
- se corrigió únicamente el expected correspondiente en
  `tests/constructiveStructuralWorkspace.test.mjs`;
- se conserva en este BUG el hash anterior como evidencia histórica de la anomalía observada.

BUG-016-A-031 permanece abierto hasta ejecutar la regresión focal y las evidencias de cierre
exigidas.

## Evidencia de cierre

La correctiva mínima quedó validada sin modificar producto ni autoridades D/E.

Resultados:

- Gate A READ-ONLY:
  - diff local SPEC-015-D/E vacío;
- Gate B READ-ONLY:
  - `structuralRequirements` direct X+Y vs assembler: `deepEqual`;
  - `referenceResolutionContext` direct X+Y vs assembler: `deepEqual`;
  - requirements SHA en ambas rutas:
    `fe7187463f09730dce031a275b970cf22aae5bc396b97937d27170ec162ad301`;
  - candidate paths SHA en ambas rutas:
    `414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b`;
- regresión focal `constructiveStructuralWorkspace`: `3/3 PASS`;
- regresión SPEC-015-D/E: `17/17 PASS`;
- regresión runtime neutral: `8/8 PASS`;
- regresión B3.1/B3.2/B3.3: `60/60 PASS`.

La causa queda clasificada como evidencia diagnóstica anterior incorrecta u obsoleta para el SHA
X+Y de `candidateLoadPaths`. El valor histórico
`1cfd2c92fb3c7d33cb731a8ea166125d312acd4d3d367109b1ec72fb56317f97`
se conserva en este documento como registro de la anomalía que originó el BUG.

No fue necesario modificar:

- `src/core/constructiveStructuralWorkspace.js`;
- `src/core/structuralProposalWorkspace.js`;
- `src/core/candidateLoadPaths.js`;
- `src/core/structuralRequirements.js`;
- B1/B2/B3;
- runtime neutral;
- store/UI.

BUG-016-A-031 se cierra con causa reproducible, correctiva mínima y regresiones verdes.
