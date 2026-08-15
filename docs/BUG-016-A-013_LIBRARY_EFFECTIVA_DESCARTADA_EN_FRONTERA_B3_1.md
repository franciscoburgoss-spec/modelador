# BUG-016-A-013 — Library efectiva descartada en frontera B3.1

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

Durante la revisión humana del gate técnico de SPEC-016-A B3.1, después de obtener
118/118 PASS y confirmar byte identity de las autoridades B1/B2, se detectó que
`buildConstructiveAdapterInput(...)` descarta el campo `library` ya proyectado por B2
en `constructive-effective-input-v1.0`.

B2 construye explícitamente una selección mínima y allowlist de biblioteca:

- `schema`;
- `libraryId`;
- `libraryVersion`;
- `sha256`;
- `componentTypes`, limitados a los `componentTypeId` seleccionados por los assignments.

La implementación B3.1 vigente proyecta `adapterRef`, `libraryRef`, scope, configuración,
assignments, geometría efectiva, requisitos efectivos y blocker context, pero omite
`effectiveInput.library`.

El corpus B3.1 también congeló incorrectamente esa omisión mediante una expectativa que
exige que `constructive-adapter-input-v1.0` no contenga `library`.

## Autoridad vigente

La frontera final cerrada de B2 continúa siendo:

`constructive-effective-input-v1.0`

La SPEC declara expresamente `library` dentro de ese paquete efectivo.

El contexto B2 `constructive-library-context-v1.0` no constituye una biblioteca neutral
productiva. Sin embargo, el campo `library` ya proyectado dentro del effective input sí
es una selección efectiva mínima y canónica derivada por B2 y no debe descartarse al
construir la frontera consumible del adapter.

D-063 continúa vigente:

- el adapter recibe sólo effective input mínimo;
- no recibe autoridades completas;
- `effectiveGenerationInputSha256`, incluido `scenarioId`, es la única autoridad de
  fresh/stale;
- subfingerprints y provenance son sólo explicativos.

## Naturaleza del defecto

El defecto pertenece exclusivamente al nuevo corte B3.1 todavía no cerrado.

No existe evidencia de defecto en B1 ni B2.

La regresión previa al hallazgo confirmó:

- B1/B2/B3.1: 118/118 PASS;
- SHA de código y tests B1/B2 idénticos al baseline autorizado;
- sólo los dos archivos nuevos B3.1 estaban presentes en el working tree.

El defecto consiste en perder información efectiva ya allowlisted por B2, obligando a un
corte posterior a reconstruirla desde assignments o consultar una fuente más amplia.

Ambas alternativas romperían la frontera de autoridad.

## Corrección requerida

1. Mantener B2 completamente intacto.
2. Corregir primero el corpus contractual B3.1 para exigir que
   `constructive-adapter-input-v1.0` conserve `effectiveInput.library`.
3. Verificar un BEFORE rojo contra la implementación actual.
4. Modificar únicamente B3.1 para copiar y canonicalizar esa selección efectiva.
5. Validar fail-closed que:
   - `library.libraryId/libraryVersion/sha256` coincidan exactamente con `libraryRef`;
   - `library.componentTypes` represente exactamente los `componentTypeId` requeridos
     por los assignments efectivos;
   - no crucen propiedades adicionales de la biblioteca B2.
6. Mantener separados:
   - selección efectiva `library` proveniente de B2;
   - biblioteca neutral productiva/runtime que B3.2 pueda proveer posteriormente.
7. No agregar `library` como una novena dimensión independiente del fingerprint.

## Contrato de fingerprint que no debe cambiar

`effectiveGenerationInputSha256` continúa calculándose exclusivamente sobre las
dimensiones ya congeladas:

- `scenarioId`;
- `effectiveGeometry`;
- `effectiveStructuralRequirements`;
- `relevantBlockingDecisionContext`;
- `scope`;
- `configuration`;
- `assignments`;
- adapter `id + version`;
- library `id + version + sha256`.

Los ocho subfingerprints del receipt permanecen sin cambios.

La selección `componentTypes` no crea una autoridad adicional: es una proyección
determinista de los assignments efectivos contra la biblioteca identificada exactamente
por `libraryRef`.

## Prohibiciones de la correctiva

No modificar:

- `constructive-effective-input-v1.0`;
- código o tests B1/B2;
- `structuralIntent`;
- topología completa;
- store o UI;
- Metalcon, perfiles, studs, OSB o materiales reales;
- reglas de availability ya aprobadas salvo lo necesario para validar coherencia de la
  entrada;
- definición de freshness;
- receipt;
- output constructivo;
- SPEC-016-B/C.

No persistir output ni convertir `library` en una nueva autoridad.

## Criterio de cierre

BUG-016-A-013 puede cerrarse cuando:

- el corpus corregido demuestra primero el defecto con un BEFORE rojo;
- B3.1 conserva exactamente la selección mínima `library` proyectada por B2;
- el adapter input sigue siendo puro, canónico e inmutable;
- el aggregate y sus ocho subfingerprints conservan el contrato vigente;
- availability sigue separada del fingerprint;
- B1/B2 permanecen byte-identical;
- regresión B1+B2+B3.1 queda verde;
- no se realiza staging, commit ni push;
- B3.1 vuelve a detenerse para revisión humana antes de B3.2.

## Evidencia de cierre

La correctiva se ejecutó mediante secuencia contractual BEFORE → correctiva → regresión.

### Reproducción BEFORE

Con el corpus corregido y el producto B3.1 todavía intacto:

- 21 tests ejecutados;
- 18 PASS;
- 3 FAIL;
- `result.library` era `undefined`;
- una `library` contradictoria respecto de `libraryRef` no era rechazada;
- `componentTypes` faltantes o adicionales no eran rechazados.

Los tres fallos correspondieron exactamente al defecto registrado.

### Correctiva

Se modificó exclusivamente `src/core/constructiveGenerationInput.js` para:

- conservar la selección efectiva `library` ya proyectada por B2;
- exigir su schema contractual;
- exigir coincidencia exacta de `libraryId`, `libraryVersion` y `sha256`
  respecto de `libraryRef`;
- exigir que `componentTypes` coincida exactamente con el conjunto de
  `componentTypeId` requerido por los assignments efectivos;
- conservar sólo la selección allowlist proveniente de B2.

No se modificó `constructive-effective-input-v1.0` ni código/tests B1/B2.

### Fingerprint

La revisión explícita confirmó que `library` no se agregó como una novena dimensión
independiente.

Los ocho subfingerprints continúan siendo:

- `effectiveGeometrySha256`;
- `effectiveStructuralRequirementsSha256`;
- `relevantBlockingDecisionContextSha256`;
- `scopeSha256`;
- `configurationSha256`;
- `assignmentsSha256`;
- `adapterFingerprint`;
- `libraryFingerprint`.

`generationFingerprintPayload(...)` continúa usando `libraryRef`, no el objeto `library`
como dimensión adicional.

`effectiveGenerationInputSha256` permanece como única autoridad futura de freshness.

### Verificación posterior

Focal B3.1 corregido:

- 21/21 PASS.

Regresión conjunta B1 + B2 + B3.1:

- 120/120 PASS;
- 0 FAIL.

Byte identity B1/B2 confirmada:

- `src/core/constructiveSolutionScenarios.js`
  `423b9c6a08e87c34945a29b5874460788d76c5474b8cc3a005c04fc0490ca473`;
- `src/core/constructiveScenarioContext.js`
  `c259256e0d3d71a619196b0c4ffd7f5f90e296e40f8f7cca5247fe04f48c436f`;
- `src/core/structuralReferenceResolutionContext.js`
  `1aeb8d0f01f237ce3f195f541ea04874bcd085dc3acc716a5dfa46631c0f2120`;
- `tests/constructiveSolutionScenarios.test.mjs`
  `9bba2303d7d709f5127e3dd492f7a28601b93d4613009836cb2e7a6359aca426`;
- `tests/constructiveScenarioContext.test.mjs`
  `89c297412846e9030673856e803492169ce006d3c8bd4ef876713e74d1d9b612`.

B3.1 corregido:

- producto:
  `8d59db1f81127d522b6c5f1aa049356885f58140316281f251acbc1dfb4024c9`;
- corpus:
  `e3fa8d5bfe2716f88e4d8ba97177aa34c98a82d684d9e0cdb048c1d90cf40611`.

La búsqueda de independencia no encontró imports de React, Three, store, components,
Metalcon, OSB ni `structuralIntent` en el módulo B3.1.

Los tres archivos nuevos pasaron control de whitespace mediante
`git diff --no-index --check`.

Git permaneció sin staging, commit ni push.

B3.2 no fue iniciado.

BUG-016-A-013 queda cerrado.
