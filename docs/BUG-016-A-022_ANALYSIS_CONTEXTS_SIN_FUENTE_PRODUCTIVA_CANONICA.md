# BUG-016-A-022 — analysisContexts sin fuente productiva canónica

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante la definición del ensamblador productivo para la integración store/UI de SPEC-016-A
se comprobó que `buildCandidateLoadPaths()` consume `analysisContexts` para el grafo lateral.

El experimento real FX-008 produjo resultados diferentes para:

- `[]`;
- lateral `x`;
- lateral `y`;
- lateral `x+y`.

Las diferencias afectan:

- candidate load paths;
- findings;
- cantidad e identidad de structural requirements;
- `structuralRequirements.canonicalSha256`;
- `sourceFingerprints.aggregateSha256`.

En particular, el contexto lateral `x` incorpora el requirement:

`sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331`

utilizado por la evidencia B3 de FX-008, mientras `[]` y `y` no lo incorporan.

## Impacto

La integración no puede escoger silenciosamente un `analysisContexts` por conveniencia de UI,
por compatibilidad con fixtures o por coincidencia con evidencia previa.

Hacerlo convertiría una selección no demostrada en fuente de requirements y freshness.

## Correctiva requerida

Antes de crear el ensamblador constructivo productivo debe determinarse la fuente contractual
de `analysisContexts`.

La solución debe:

- reutilizar la autoridad existente;
- ser determinista;
- no depender de la pestaña o dirección visible de una UI;
- no inventar `x`, `y` o ambas;
- mantener candidate paths como derivados no autoritativos;
- mantener B1/B2/B3.1/B3.2/B3.3 intactos.

## Criterio de cierre

Cerrar únicamente cuando exista una regla contractual reproducible que determine los contextos
laterales productivos desde autoridades persistentes o desde una entrada explícita cuyo carácter
esté definido por la SPEC, y dicha regla tenga cobertura de tests.

## Decisión congelada

La fuente productiva de `analysisContexts` para la composición constructiva de SPEC-016-A no será:

- la UI;
- la dirección actualmente visible;
- `primaryResistanceDirection`;
- `secondaryResistanceDirection`;
- `diaphragmIntents`;
- una inferencia geométrica;
- una nueva declaración persistente de intención.

Se adopta un dominio canónico exhaustivo de consulta soportado por SPEC-015-D:

```js
[
  { graph: 'lateral', direction: 'x' },
  { graph: 'lateral', direction: 'y' }
]
```

El orden canónico es X antes de Y.

Estos contextos representan exclusivamente direcciones de consulta.

No crean intención estructural, no declaran resistencia lateral y no agregan autoridad persistente.

La autoridad sobre:

- existencia de una fuente lateral;
- función estructural declarada;
- compatibilidad de receptores;
- existencia y estado de candidate load paths;
- clasificación de requisitos estructurales;

continúa perteneciendo a los contratos y autoridades de SPEC-015-D y SPEC-015-E.

En particular, el dominio X+Y no se deriva de:

- `primaryResistanceDirection`;
- `secondaryResistanceDirection`;
- `diaphragmBehavior`;
- `diaphragmIntents`;
- geometría;
- orientación de cubierta;
- selección visible en UI.

### Ubicación productiva

La política X+Y no se incorporará al default de:

`buildStructuralProposalWorkspace()`

Esa función permanece como frontera genérica de SPEC-015-D y conserva su capacidad de recibir
`analysisContexts` explícitos.

La política productiva se materializará en una capa superior pura de composición para SPEC-016-A:

`constructiveStructuralWorkspace`

Esta capa:

1. invocará `buildStructuralProposalWorkspace()` con el dominio canónico X+Y;
2. reutilizará la geometría agnóstica proyectada por ese workspace;
3. reutilizará su topología R0-R5;
4. reutilizará sus propuestas estructurales;
5. reutilizará sus candidate load paths;
6. invocará `buildStructuralRequirementsWithReferenceResolutionContext()`;
7. entregará structural requirements y reference resolution context sin redefinir SPEC-015-D/E.

### Separación de responsabilidades

La composición queda conceptualmente separada así:

```text
structuralProposalWorkspace
  = mecanismo genérico existente de SPEC-015-D

constructiveStructuralWorkspace
  = política productiva de composición de SPEC-016-A
  = consulta lateral canónica X luego Y

structuralRequirements
  = contrato derivado de SPEC-015-E

constructiveNeutralRuntime
  = identidad productiva de adapter/library neutral

B2/B3
  = contratos constructivos ya congelados
```

### Evidencia diagnóstica FX-008

El experimento real X versus X+Y demostró que ampliar el dominio de consulta modifica evidencia
global derivada, como corresponde, pero no altera el paquete efectivo B3.1 del scope gobernante.

Para X+Y se observó:

- cantidad de structural requirements: `9`;
- cantidad de lateral paths: `1`;

- `structuralRequirements.canonicalSha256`:
  `fe7187463f09730dce031a275b970cf22aae5bc396b97937d27170ec162ad301`;

- `candidateLoadPaths.canonicalSha256`:
  `414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b`;

- `structuralRequirements.sourceFingerprints.aggregateSha256`:
  `7c356ee838f69841b67dee4da4541ff57b86f4982ff40b9102133dfae0c6292a`.

El experimento también comprobó que, para el scope constructivo gobernante:

- los requirement IDs efectivos X y X+Y son iguales;
- `effectiveStructuralRequirements` es igual;
- `relevantBlockingDecisionContext` es igual;
- `effectiveGenerationInputSha256` es igual;
- los ocho subfingerprints B3.1 son iguales.

Por lo tanto, la evidencia global adicional de Y no produce stale falso sobre un paquete efectivo que
no consume esa evidencia.

## Criterio de cierre actualizado

BUG-016-A-022 permanece ABIERTO.

Se cerrará únicamente cuando:

- exista `constructiveStructuralWorkspace` como frontera productiva pura;
- materialice X antes de Y de forma determinista;
- no derive X/Y desde intención de techumbre ni desde UI;
- reutilice `buildStructuralProposalWorkspace()`;
- reutilice `buildStructuralRequirementsWithReferenceResolutionContext()`;
- el caso real FX-008 reproduzca la evidencia X+Y congelada;
- exista cobertura permanente de tests;
- `structuralProposalWorkspace.js` permanezca sin redefinir;
- B1/B2/B3 permanezcan intactos.

## Evidencia de cierre

Se cumplen los criterios de cierre actualizados:

- existe `constructiveStructuralWorkspace` como frontera productiva pura;
- materializa el dominio canónico X luego Y de forma determinista;
- X/Y son dominio de consulta, no intención estructural;
- no se derivan desde techumbre, geometría ni UI;
- reutiliza `buildStructuralProposalWorkspace()`;
- reutiliza `buildStructuralRequirementsWithReferenceResolutionContext()`;
- FX-008 reproduce:
  - candidate paths SHA `414e4007f91bc13786425ce54ee43a3d2e1ab54bc8d1bd22b55e9392a4416b3b`;
  - requirements SHA `fe7187463f09730dce031a275b970cf22aae5bc396b97937d27170ec162ad301`;
  - source aggregate `7c356ee838f69841b67dee4da4541ff57b86f4982ff40b9102133dfae0c6292a`;
- Gate B confirmó con `assert.deepEqual` equivalencia entre ruta directa X+Y y assembler;
- regresión focal: `3/3 PASS`;
- SPEC-015-D/E: `17/17 PASS`;
- runtime neutral: `8/8 PASS`;
- B3.1/B3.2/B3.3: `60/60 PASS`;
- B1/B2/B3 permanecen intactos.

BUG-016-A-031 cerró el hash diagnóstico obsoleto.
BUG-016-A-032 confirmó que el SHA distinto del handoff era sólo una transcripción incorrecta.

BUG-016-A-022 se cierra sin modificar SPEC-015-D/E, B1/B2/B3, runtime neutral,
`constructiveStructuralWorkspace.js`, store ni UI.
