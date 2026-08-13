# SPEC-016-A — Arquitectura de soluciones constructivas y escenarios

**Estado:** abierta · B1/B1.1 aprobados y cerrados · B2 aprobado y cerrado por revisión humana tras B2-CLOSE · B3 no autorizada

## Diagnóstico

SPEC-015-E cerró la frontera anterior con autoridades separadas:

```text
geometría agnóstica
→ topología R0–R5
→ structuralIntent v1.1
→ interfaceIntents/relationIntents
→ proposals/reviews
→ candidateLoadPaths
→ R6–R12
→ structural-requirements-v1.0
```

La geometría es la autoridad física; `structuralIntent` y sus declaraciones locales son la
autoridad humana persistente; propuestas, reviews y caminos candidatos no son autoridad; R6–R12 y
los requisitos son derivados recalculables, no persistentes y `notVerified`.

El modelo nativo vigente es v3. La solución Metalcon legacy permanece integrada mediante
`wallTypes`, `wallTypeId`, perfiles, studs, OSB, modulación y defaults. Esos campos no son intención
ni requisitos y no pueden gobernar la nueva arquitectura. SPEC-016-A necesita múltiples escenarios
aislados que consuman una proyección efectiva de los requisitos sin reescribir ninguna autoridad.

El borrador histórico mezclaba lifecycle, coverage, freshness, ejecución y verificación; persistía
el output generado; entregaba autoridades completas al adaptador; invalidaba con hashes globales y
no contrataba assignments ni elegibilidad local. La Fase A reemplaza esas premisas.

## Decisión

Introducir `modelVersion: 4` y una raíz persistente de escenarios:

```json
{
  "constructiveSolutions": {
    "schema": "constructive-solution-scenarios-v1.0",
    "nextScenarioOrdinal": 1,
    "scenarios": []
  }
}
```

La migración v3→v4 será explícita, pura, determinista, idempotente y sin pérdida. Realiza
exactamente dos cambios de contrato:

1. actualiza `modelVersion` de `3` a `4`;
2. añade la raíz inicial `constructiveSolutions`.

Ningún otro campo del modelo se modifica, reinterpreta ni elimina, incluidos `wallTypes`,
`wallTypeId`, perfiles, studs, OSB, modulación, defaults y cualquier otro campo legacy. No se
aceptan escenarios como campo opcional no validado de un modelo v3.

La autoridad de un escenario se limita a su identidad, metadata, lifecycle, selección de
adaptador/biblioteca, configuración, scope y assignments. No decide geometría, intención,
topología, requisitos ni verificación resistente. Un sistema constructivo nunca reescribe esas
autoridades.

El flujo obligatorio es:

```text
autoridades upstream
        ↓
scenario engine
        ↓
scope eligibility
        ↓
effective input projection
        ↓
constructive adapter
        ↓
constructive-solution-v1.0 derivada y no persistente
```

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: introduce modelVersion 4, migración persistente, aislamiento histórico, fingerprints e
  invalidación por scope y una frontera nueva entre autoridades estructurales y adaptadores.

## Autoridades y prohibiciones

SPEC-016-A conserva como invariantes:

- geometría agnóstica = autoridad física;
- `structuralIntent` v1.1 = autoridad humana persistente;
- `interfaceIntents`/`relationIntents` = declaraciones locales persistentes;
- proposals/reviews = derivados no autoritativos;
- candidate load paths = evidencia candidata no verificada;
- R6–R12 = derivados;
- `structural-requirements-v1.0` = requisitos derivados, recalculables y no persistentes;
- `candidate != verified` y `resolved != verified`;
- relaciones stale/broken no reciben fallback geométrico silencioso;
- SPEC-016 consume requisitos y no los reemplaza.

El scenario engine puede leer las autoridades para construir una proyección allowlist. El adaptador
no recibe geometría completa, requisitos completos, intención, topología completa, store ni UI y no
puede navegar fuera del paquete efectivo.

## Contrato persistente del escenario

```json
{
  "schema": "constructive-solution-scenario-v1.0",
  "scenarioId": "scenario:000001",
  "nextAssignmentOrdinal": 1,
  "metadata": {
    "name": "Escenario A",
    "description": ""
  },
  "lifecycle": "active",
  "adapterRef": {
    "adapterId": "neutral-contract-adapter",
    "adapterVersion": "1.0.0"
  },
  "libraryRef": {
    "libraryId": "neutral-contract-library",
    "libraryVersion": "1.0.0",
    "sha256": "..."
  },
  "configuration": {
    "schema": "neutral-contract-configuration-v1.0"
  },
  "scope": {
    "mode": "requirements",
    "requirementIds": ["sr-requirement:sha256:..."]
  },
  "assignments": [],
  "lastGeneration": null
}
```

Sólo persisten identidad y metadata, `lifecycle`, `adapterRef`, `libraryRef`, configuración, scope,
assignments y el receipt de la última generación. No persisten `generatedSolution`, elements,
connections, materials, requirement resolutions, unresolved requirements, findings, métricas
completas ni output constructivo materializado.

`lifecycle` sólo admite `active|archived`. Un escenario archivado se inspecciona, pero debe
reactivarse para editarlo o generar. Renombrar, cambiar metadata no consumida, archivar o
desarchivar no altera freshness.

## IDs y allocators

Los IDs de escenario son secuenciales y namespaced:

```text
scenario:000001
scenario:000002
```

`nextScenarioOrdinal` es un entero seguro positivo persistente. Crear consume el ordinal vigente y
luego incrementa el contador. Eliminar no decrementa. Renombrar, configurar y cambiar assignments
no altera el ID. Undo/redo restaura escenario y contador en la misma transacción; una acción nueva
después de undo usa exactamente el estado restaurado y descarta la rama redo. No se usan
timestamps, `Date.now()`, random, UUID ni orden incidental.

Al validar v4, todos los IDs son únicos y `nextScenarioOrdinal` debe ser mayor que cualquier
ordinal persistente. Se permiten huecos por escenarios eliminados y nunca se normalizan. La
representación decimal canónica usa exactamente seis dígitos hasta el ordinal 999999 y, desde
1000000, todos los dígitos necesarios sin ceros adicionales a la izquierda. Por tanto,
`scenario:000001`, `scenario:999999` y `scenario:1000000` son válidos, mientras
`scenario:0000001` es un alias inválido. La misma regla gobierna cada ordinal de assignment.

Cada escenario aplica las mismas reglas a `nextAssignmentOrdinal` y a:

```text
scenario:000001/assignment:000001
```

Duplicar crea un scenarioId nuevo, exige nombre explícito, copia profundamente el contenido
semántico, reescribe assignmentIds en orden canónico desde 1, deja lifecycle `active`, limpia
`lastGeneration` y no comparte objetos mutables.

## Scope y elegibilidad local

El scope es explícito y canónico:

```json
{ "mode": "all" }
```

o:

```json
{
  "mode": "requirements",
  "requirementIds": ["sr-requirement:sha256:..."]
}
```

`all` no admite `requirementIds` y conserva sin reinterpretación la elegibilidad global de
SPEC-015-E. La validación persistente B1 de `requirements` exige IDs con formato contractual,
únicos y una lista no vacía. El orden de entrada es incidental y no constituye error de validación:
la canonicalización ordena `requirementIds` determinísticamente por ID, por lo que dos scopes que
sólo difieren en ese orden son semánticamente equivalentes y producen la misma representación
canónica. Su resolución contra requisitos vivos y el rechazo de un scope efectivo vacío pertenecen
a B2. Una lista vacía nunca significa implícitamente todo/nada.

El motor agrega un evaluador puro conceptual:

```text
evaluateConstructiveScopeEligibility(requirements, scope)
→ {
    eligible,
    effectiveRequirementIds,
    scopeClosure,
    relevantBlockingDecisions,
    excludedBlockingDecisions,
    reasonCodes
  }
```

El corte B2 implementa esta frontera como
`evaluateConstructiveScopeEligibility(structuralRequirements, scope)` y devuelve el schema
`constructive-scope-eligibility-v1.0`. El cierre puro
`buildConstructiveScopeClosure(structuralRequirements, requirementIds)` devuelve
`constructive-scope-closure-v1.0` con:

```text
requirementIds
regionIds / ownerRefs
sourceRefs
pathRefs / supportRefs / transferRefs
governingRefs {
  roofGeometryIds
  elementIds
  relationIds
  interfaceIds
  pathIds
}
traces[]
```

Cada `trace` conserva requirement, región/owner, sources y entidades alcanzadas. La evidencia de un
blocker conserva `blockingDecisionId`, `code`, `domain`, `blockerRefs`, `scopeRefs`, `intersection`,
`sourceRefs` y `proof`. Sólo `typed-disjoint-reference-closure` excluye localmente; intersección,
dominio desconocido o referencias insuficientes mantienen el blocker relevante.

La correctiva B2.1 calcula la clausura hasta punto fijo. Requirements y regiones seleccionadas
siembran regiones y referencias explícitas; cada iteración resuelve paths, supports y transfers
alcanzables y agrega exclusivamente sus referencias tipadas. El proceso termina únicamente cuando
ninguna colección crece. Los conjuntos finitos y deduplicados garantizan terminación incluso con
ciclos; la salida se canonicaliza después del cierre y no depende del orden de entrada. No recorre
geometría por proximidad ni inventa enlaces.

La correctiva B2.2 congela la conectividad mediante allowlist por entidad. La condición de
referencia pertenece al contrato del campo y nunca se infiere desde el contenido del valor. B2.4-C
corrige el drift de B2.2/B2.3: las refs connective-required cuyo dominio conoce el productor se
resuelven mediante el contexto tipado compañero, aunque el documento v1.0 no discrimine cada item:

| Entidad | Campos reference-bearing | Campos que son sólo datos |
|---|---|---|
| requirement | `id`, `targetRegionRef`, `sourceRefs[]` mediante binding tipado de productor | `code`, `kind`, `graph`, `verificationState`, `evidence.gapMm` |
| region | `regionId`, `ownerRef`, `topologicalBoundaries[].nodeId`, `activeOpenings[]`, `requirementRefs[]`, `declaredInteractions[]`; `candidateEvidenceRefs[]` queda reservado y sólo es válido vacío | localización, rangos, `zBands`, funciones, `verificationState` |
| declaredInteraction | `relationId`, `interfaceId`, `sourceRefs[]` mediante binding tipado de productor | `interactionRole`, `actionFamily`, `structuralFunction` |
| path | `pathId`, `sourceRefs.proposalId`, `sourceRefs.relationId`, `sourceRefs.roofGeometryId`, `sourceRefs.targetElementId`, `sourceRefs.boundaryId` | `sourceRefs.direction`, estado candidato, confidence, edgeKinds, findings, verificationState |
| support/transfer | `id`, `fromRefs[]`, `toRefs[]`, `targetRegionRefs[]`, `sourceRefs[]` mediante provenance y binding tipados | graph, función, certainty, verificationState |
| evidence | ninguno en v1.0 | `gapMm`, `overlapRange` y texto descriptivo |
| provenance | ninguno | enum `declaredRelation|candidatePath` |
| supportEvidence | ninguno | clasificación `candidateSupportEvidence` |

Los IDs numéricos se conservan cuando el campo tipado los admite, como `ownerRef.id`,
`roofGeometryId` o `targetElementId`; ningún otro número adquiere conectividad por su valor.

Norma: la conectividad de `scopeClosure` se deriva exclusivamente de campos contractualmente
definidos como referencias. El contenido textual de un campo no reference-bearing nunca crea
conectividad, aunque coincida con la representación de un ID válido. No se permite decidir esta
condición mediante substring, prefijo, regex del contenido ni recorrido recursivo indiscriminado.

La correctiva B2.3 preserva además el dominio semántico de cada referencia. Una identidad conectiva
es siempre `domain + canonical value`; valores iguales en dominios distintos no conectan:

```text
elementId:7001 != roofGeometryId:7001
elementId:7001 != nodeId:7001
roofGeometryId:7001 != boundaryId:7001
```

`region.ownerRef.id(kind=element)` y `path.sourceRefs.targetElementId` normalizan ambos a
`elementId` y sí pueden conectar únicamente cuando esa ruta participa contractualmente en el
cierre. Una ruta tipada alternativa no sustituye una ref upstream exacta. String y número
conservan tipos distintos dentro del dominio. La coincidencia del valor nunca determina el dominio.

| Campo contractual | Dominio de conectividad |
|---|---|
| `requirement.id`, `region.requirementRefs[]` | `requirementId` |
| `requirement.targetRegionRef`, `support/transfer.targetRegionRefs[]`, `region.regionId` | `regionId` |
| `region.ownerRef.id(kind=element)`, `path.sourceRefs.targetElementId` | `elementId` |
| `region.ownerRef.roofGeometryId(kind=roofBoundary)`, `path.sourceRefs.roofGeometryId` | `roofGeometryId` |
| `region.ownerRef.boundaryId(kind=roofBoundary)`, `path.sourceRefs.boundaryId` | `boundaryId` |
| `region.topologicalBoundaries[].nodeId` | `topologyNodeId` |
| `fromRefs[]/toRefs[]` con `provenance=candidatePath` | `candidatePathNodeId` |
| `path.pathId` | `pathId` |
| candidate edge conocido por el productor | `candidatePathEdgeId` |
| `support.id` | `supportId` |
| `transfer.id` | `transferId` |
| `declaredInteraction.relationId`, `path.sourceRefs.relationId` | `relationId` |
| `declaredInteraction.interfaceId`, `fromRefs[]/toRefs[]` con `provenance=declaredRelation` | `interfaceId` |
| `path.sourceRefs.proposalId` | `proposalId` |
| `region.activeOpenings[]` | `openingId` |

La ausencia de discriminador por item en `structural-requirements-v1.0` no determina por sí misma
que una referencia carezca de conectividad. Cuando el productor upstream conoce su dominio,
SPEC-016-A debe resolverla mediante el contexto tipado de provenance correspondiente. Está
prohibido inferir el dominio desde prefijo, regex, forma textual, coincidencia de valor o ruta
alternativa no demostrada equivalente.

Una referencia necesaria cuya resolución tipada no pueda demostrarse de forma completa produce
scope indeterminado y fail-closed.

La existencia de una ruta tipada alternativa no autoriza a sustituir una ref upstream salvo
equivalencia contractual explícita y probada. Mismo output no implica equivalencia contractual.

`structural-requirements-v1.0` permanece intacto. El mismo flujo productor emite además
`structural-reference-resolution-context-v1.0`, derivado, puro, canónico, determinista, no
persistente y no autoritativo. El contexto conserva el fingerprint del requirements compañero,
bindings tipados por ocurrencia, origen contractual, legacy value, targets y relaciones mínimas de
provenance. Antes de resolver, B2 exige que su `sourceRequirementsSha256` coincida con el
fingerprint del documento recibido. Candidate edges conservan explícitamente
`candidatePathEdgeId -> candidateEdgeMemberOfPath -> pathId`; no se busca el path por owner,
`targetElementId`, roof ni coincidencia de strings.

La correctiva B2.4-E declara además `sourceSchema` en el contexto y exige, antes de resolver:

```text
context.sourceSchema
=== structuralRequirements.schema
=== "structural-requirements-v1.0"
```

La ausencia o contradicción produce `SCOPE_REF_CONTEXT_MISMATCH` y fail-closed. `sourceSchema`
participa en `canonicalSha256`; no cambia ni versiona el documento fuente.

Cada binding conserva la identidad materializada de su ocurrencia:

```text
binding.legacyValue === String(binding.to.value)
```

Una contradicción produce `SCOPE_REF_PROVENANCE_MISMATCH` y scope indeterminado. Un mismo valor
materializado puede existir válidamente en dominios distintos cuando proviene de ocurrencias
independientes, por ejemplo `"SAME" -> pathId:"SAME"` y
`"SAME" -> candidatePathEdgeId:"SAME"`; esa coexistencia no es `DOMAIN_AMBIGUOUS`.

Para múltiples requirements, la clausura agregada es exclusivamente la unión canónica de las
clausuras completas calculadas por requirement:

```text
C({R1, R2, ..., Rn}) = canonicalUnion(C(R1), C(R2), ..., C(Rn))
```

La precedencia del selector exacto se conserva dentro de cada clausura individual. Un selector
exacto de otro requirement no desactiva una ruta tipada independiente. La unión deduplica y ordena
canónicamente requirements, regiones, owners, source refs tipadas, paths, supports, transfers,
governing refs, traces y diagnostics; es determinable sólo si todas sus clausuras individuales lo
son. Los traces son las mismas clausuras individuales usadas por el agregado: ninguna ref válida
presente en ellos puede omitirse del aggregate ni reconstruirse con otra semántica. B2 queda aprobado y cerrado por revisión humana tras B2-CLOSE; esta aprobación no autoriza B3.

### Cierre humano B2

La auditoría consolidada B2-CLOSE verificó 28/28 propiedades obligatorias
como PASS, incluidos:

- autoridad y frontera `notVerified`;
- invariancia de `structural-requirements-v1.0`;
- contexto tipado compañero;
- separación de dominios;
- bindings por ocurrencia;
- edge→path exacto;
- fail-closed;
- `scope=all` y `scope=requirements`;
- clausura multi-requirement;
- unión canónica y coherencia aggregate↔traces;
- semántica de blockers;
- P1–P6 y T1–T13;
- `constructive-effective-input-v1.0` por allowlist;
- aislamiento de contexto y de cambios upstream fuera de scope;
- determinismo;
- FX-008 real;
- ausencia de contract drift, API drift y outputs B3.

La aclaración final FX-008 confirmó que
`sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331`
es `LOAD_TRANSFER_REQUIREMENT`, el requirement de transferencia que porta
contractualmente el path y candidate edge exactos.

`sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84`
es `LATERAL_RESISTANCE_REQUIREMENT`.

`scopeRequirements()` incluye ambos por defecto y `assignment()` referencia
por defecto `LOAD_TRANSFER_REQUIREMENT`. Por ello, la denominación de
`f6ee…7a84` como “requirement lateral gobernante” en el resumen B2-CLOSE
queda clasificada como un error de rotulación del informe, sin inconsistencia
funcional ni contractual.

El último output autorizado de B2 es
`constructive-effective-input-v1.0`.

Adapter, generation, receipt, availability, freshness, coverage funcional y
cualquier output constructivo posterior pertenecen a B3 o cortes posteriores
y continúan no autorizados.

El cierre trazable recorre como mínimo:

```text
requirementIds
→ requirements
→ targetRegionRefs
→ regiones/owners
→ sourceRefs/provenance
→ paths/supports/transfers alcanzables
→ blockingDecisions relacionadas
```

Un blocker intersectante bloquea. Sólo puede excluirse mediante una prueba positiva, tipada y
reproducible de no intersección entre sus referencias gobernantes y el cierre del scope en el mismo
dominio. Si el blocker, su dominio o las referencias necesarias no pueden resolverse con seguridad,
se considera relevante y bloquea. No se permiten descriptores humanos, proximidad geométrica ni
heurísticas.

Un sourceRef auxiliar no materializado no invalida una prueba completa en otro dominio tipado. En
FX-008, el path del requisito lateral resuelve inequívocamente su `roofGeometryId` y los cinco
blockers declaran otros roofs; si una decisión futura dependiera específicamente de un edge no
resoluble, el evaluador debe fallar cerrado.

Una blockingDecision demostrablemente ajena no contamina elegibilidad ni freshness. Una generación
sólo se invoca si el scope efectivo es no vacío y localmente elegible.

## Assignment v1.0

```json
{
  "schema": "constructive-solution-assignment-v1.0",
  "assignmentId": "scenario:000001/assignment:000001",
  "requirementRef": "sr-requirement:sha256:...",
  "targetRef": {
    "kind": "requirement",
    "ref": "sr-requirement:sha256:..."
  },
  "choiceRef": {
    "libraryId": "neutral-contract-library",
    "libraryVersion": "1.0.0",
    "componentTypeId": "abstract-load-transfer-response"
  },
  "parameters": {}
}
```

Reglas:

- `requirementRef` es obligatorio, tiene formato contractual y pertenece declarativamente al
  scope `requirements`; su resolución viva pertenece a B2;
- `targetRef.kind=requirement` exige `ref === requirementRef`;
- `targetRef.kind=region` exige un ID estructuralmente válido; su compatibilidad real con el
  requisito pertenece a B2;
- una región demostrablemente ajena al requisito será inválida en la validación contextual B2;
- `choiceRef.libraryId/libraryVersion` coincide con `libraryRef`; la existencia de
  `componentTypeId` en esa biblioteca se comprueba en B2;
- IDs son únicos dentro del escenario;
- parámetros siguen schema estricto, sin campos desconocidos y sólo con números finitos;
- orden incidental no cambia `assignmentsSha256`;
- un cambio semántico sí lo cambia;
- un no-op semántico no crea historia ni modifica fingerprints;
- un assignment stale/roto se informa y nunca se repara por heurística.

Una edición conserva el assignmentId; una creación consume el allocator. Se permiten assignments
semánticamente distintos sobre el mismo requirement, pero una duplicación semántica exacta es no-op.
Un documento persistido con dos assignments semánticamente idénticos e IDs distintos es inválido;
`assignmentId` se excluye de la comparación semántica.

### Frontera de validación B1/B2

La validación persistente B1 comprueba únicamente información demostrable desde el documento:

- schemas y formatos/namespaces canónicos de IDs;
- unicidad, allocators y pertenencia del assignment al escenario;
- formato contractual de `requirementRef` y pertenencia declarativa a un scope `requirements`;
- estructura de `targetRef`, incluida igualdad local cuando `kind=requirement`;
- coincidencia de `choiceRef.libraryId/libraryVersion` con `scenario.libraryRef`;
- forma JSON, números finitos, duplicaciones semánticas y canonicalización.

La validación semántica contextual implementada en B2 comprueba contra el contexto vivo que
`requirementRef` siga existiendo, que una región objetivo sea realmente compatible con el
requisito y que `componentTypeId` exista en la biblioteca exacta.
Una referencia que dejó de resolver no vuelve inabrible el proyecto ni se repara mediante
heurística: debe persistir para clasificarse después como `stale`, `broken` o `unavailable` según
el contrato correspondiente.

## Effective input v1.0

B2 se detiene antes del adapter. La API pura
`projectEffectiveConstructiveInput({ scenario, structuralRequirements, geometry, libraryContext })`
devuelve `constructive-effective-input-v1.0`, ya canónico y allowlist, pero todavía sin
`effectiveGenerationInputSha256`, generación, output ni receipt operativo. La validación previa
`evaluateConstructiveScenarioContext(...)` devuelve
`constructive-scenario-context-evaluation-v1.0` con diagnostics y reasonCodes estables:

```text
REQUIREMENT_NOT_FOUND
REQUIREMENT_OUTSIDE_SCOPE
TARGET_NOT_RESOLVED
TARGET_INCOMPATIBLE
LIBRARY_NOT_AVAILABLE
COMPONENT_TYPE_NOT_FOUND
BLOCKING_DECISION_RELEVANT
BLOCKING_DECISION_UNRESOLVED
EMPTY_EFFECTIVE_SCOPE
STRUCTURAL_REQUIREMENTS_INVALID
```

El contexto de biblioteca B2 es sólo una frontera contractual de test
`constructive-library-context-v1.0`; no constituye una biblioteca neutral productiva.

El scenario engine proyecta un paquete mínimo, canónico, auditable e inmutable:

```json
{
  "schema": "constructive-effective-input-v1.0",
  "scenarioId": "scenario:000001",
  "adapterRef": {},
  "libraryRef": {},
  "scope": {},
  "configuration": {},
  "assignments": [],
  "library": {},
  "effectiveGeometry": {
    "schema": "effective-constructive-geometry-v1.0",
    "units": {},
    "coordinates": {},
    "elements": [],
    "roofGeometry": []
  },
  "effectiveStructuralRequirements": {
    "schema": "effective-structural-requirements-v1.0",
    "sourceSchema": "structural-requirements-v1.0",
    "verification": { "state": "notVerified" },
    "requirements": [],
    "regions": [],
    "paths": [],
    "supports": [],
    "transfers": [],
    "relevantBlockingDecisionContext": [],
    "provenance": { "closure": {} }
  }
}
```

La proyección contiene únicamente geometría, regiones, requisitos y contexto alcanzables desde el
scope. Conserva IDs/provenance, usa copias inmutables, schemas estrictos y orden canónico. Excluye
`structuralIntent` vivo, topología completa, requisitos completos, store, UI, wallTypes, perfiles,
studs, OSB y reglas Metalcon.

`evaluateConstructiveScopeEligibility(...)` conserva blockers relevantes y excluidos para
diagnóstico/auditoría. `constructive-effective-input-v1.0` no transporta el objeto completo de
eligibility ni `excludedBlockingDecisions`, directa o indirectamente. Sólo
`relevantBlockingDecisionContext` puede atravesar la frontera consumible. Por ello, modificar una
decisión todavía demostrablemente ajena no cambia el effective input; convertirla en intersectante
bloquea la proyección. Este schema es el output final de B2, no un
`constructive-adapter-input-v1.0`; B3 deberá construir la frontera exacta del adapter sin redefinir
silenciosamente B2.

## Output constructivo y significado de resolved

`constructive-solution-v1.0` es derivado y no persistente. Puede contener elements, connections,
materials abstractos, requirementResolutions, unresolvedRequirements, findings y metrics, siempre
con `canonicalSha256` calculado después de validar.

Cada requisito efectivo aparece exactamente una vez con:

```text
resolved | partiallyResolved | unresolved
```

Cada resolution referencia exactamente el requisito y registra assignments, adapter, library y
effective input que la originaron. `resolved` significa exclusivamente que el adaptador produjo una
respuesta contractual completa para ese requisito. No significa capacidad, rigidez, normativa,
cálculo aprobado ni verificación.

La separación normativa es:

```text
requirement
→ constructive resolution
→ verification futura separada
```

Toda salida de SPEC-016-A exige:

```text
verificationState = notVerified
```

El engine rechaza outputs `verified` o `verificationFailed`. El adaptador neutral no implementa un
verificador y no usa materiales, perfiles ni capacidades reales.

## Estados ortogonales

| Dimensión | Valores | Persistencia |
|---|---|---|
| lifecycle | `active`, `archived` | persistente |
| estado por requirement | `resolved`, `partiallyResolved`, `unresolved` | derivado del output |
| coverage | `notGenerated`, `none`, `partial`, `complete` | derivada |
| freshness | `notGenerated`, `fresh`, `stale`, `unavailable` | derivada |
| verification | `notVerified` | derivada y obligatoria |
| execution | `idle`, `running`, `succeeded`, `failed` | efímera/UI |

Coverage se calcula sobre los requirements efectivos:

- `notGenerated`: no existe generación para el estado efectivo actual;
- `none`: ninguno está resolved ni partiallyResolved;
- `partial`: al menos uno tiene respuesta, pero no todos están resolved;
- `complete`: todos están resolved.

`complete` tampoco significa verified. `coverageAtGeneration` es evidencia histórica del receipt,
no una autoridad nueva. La ausencia de output materializado tras reapertura no cambia coverage ni
freshness si el receipt corresponde al input efectivo actual.

## Provenance global y freshness efectiva

### Global provenance

El receipt conserva contexto explicativo del estado completo:

```text
geometrySha256
requirementsSha256
requirementsSourceAggregateSha256
structuralIntentSha256
topologyR0R5Sha256
```

Estos hashes no gobiernan fresh/stale.

### Fingerprint efectivo

`effectiveGenerationInputSha256` se calcula sobre los bytes canónicos realmente consumidos:

```text
scenarioId
effectiveGeometry
effectiveStructuralRequirements
relevantBlockingDecisionContext
scope
configuration
assignments
adapter id + version
library id + version + sha256
```

El payload se hashea sin incluir su propio hash y luego recibe el resultado. `scenarioId` participa:
el hash identifica la entrada de una generación dentro de un escenario concreto y gobierna
exclusivamente freshness. No es un fingerprint de equivalencia técnica. Dos escenarios técnicamente
idénticos pueden tener hashes distintos por su scenarioId. SPEC-016-A no introduce el fingerprint
técnico separado que podría requerir SPEC-016-C.

`effectiveGenerationInputSha256` es el único hash gobernante:

```text
sin receipt                                      → notGenerated
adapter o biblioteca exactos no disponibles      → unavailable
hash efectivo actual == hash del receipt          → fresh
hash efectivo actual != hash del receipt          → stale
```

Un cambio upstream fuera del paquete efectivo puede cambiar provenance global, pero no freshness.
Un cambio efectivo en scope, configuration, assignments, adapter/version, library hash/version o
upstream proyectado puede volver stale. Otro escenario nunca invalida éste.

### Receipt explicable

`lastGeneration` es evidencia histórica/reproducible, no output ni segunda autoridad:

```json
{
  "schema": "constructive-generation-receipt-v1.0",
  "effectiveGenerationInputSha256": "...",
  "outputCanonicalSha256": "...",
  "coverageAtGeneration": "partial",
  "resolvedCount": 1,
  "partiallyResolvedCount": 0,
  "unresolvedCount": 1,
  "effectiveFingerprints": {
    "effectiveGeometrySha256": "...",
    "effectiveStructuralRequirementsSha256": "...",
    "relevantBlockingDecisionContextSha256": "...",
    "scopeSha256": "...",
    "configurationSha256": "...",
    "assignmentsSha256": "...",
    "adapterFingerprint": "...",
    "libraryFingerprint": "..."
  },
  "globalProvenance": {
    "geometrySha256": "...",
    "requirementsSha256": "...",
    "requirementsSourceAggregateSha256": "...",
    "structuralIntentSha256": "...",
    "topologyR0R5Sha256": "..."
  }
}
```

Los subfingerprints sólo explican qué dimensión cambió y apoyan diagnóstico/UI. No gobiernan
freshness individualmente ni sustituyen el aggregate efectivo. Después de reapertura, el output no
está materializado; con adapter/library disponibles se recalcula el aggregate, se determina el
estado y una regeneración idéntica reconstruye el mismo output/hash. Si falta alguno, el estado es
`unavailable`, no `stale`.

## Determinismo y canonicalización

- escenarios por ordinal numérico de scenarioId;
- assignments por ordinal numérico de assignmentId;
- requirements y referencias por ID canónico;
- parámetros usan schemas estrictos y números finitos;
- timestamps y orden de inserción quedan fuera de IDs y hashes semánticos;
- regenerar la misma entrada produce los mismos bytes y hashes;
- una permutación incidental no cambia hashes;
- duplicar cambia scenarioId, assignmentIds y por ello el hash efectivo del nuevo escenario;
- outputCanonicalSha256 se calcula sin incluir su propio valor.

## Historial, aislamiento y reapertura

Crear, duplicar, renombrar, configurar, cambiar scope/assignments, archivar, desarchivar y eliminar
son transacciones únicas con undo/redo. Un no-op no crea historia. Undo/redo restaura exactamente
escenario y allocators. Eliminar un escenario no cambia autoridades ni otros escenarios.

Cerrar/reabrir persiste escenarios y receipts, no outputs. La reapertura valida v4 antes de hacer
commit al store. Un escenario no comparte objetos mutables con otro; ni el engine ni el adapter
mutan inputs.

## Caso real FX-008

La evidencia real conserva 45 muros, 43 vanos, 32 fundaciones, 7 cubiertas, 9 structural
requirements, 5 blocking decisions globales de cubiertas y verification `notVerified`.

El scope lateral común selecciona:

- `loadTransferRequired`, ID
  `sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331`,
  con gap real 571,429 mm;
- `inPlaneLateralResistanceRequired`, ID
  `sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84`.

Ambos alcanzan la región
`sr-region:sha256:60290050fa3ffe641a1ce4e716b6114ac9b28284240537dc0e360ee0eab85e3e`.
El path lateral referencia el roof `1785158713616`; los cinco blockers declaran
`1785161146258`, `1785161198226`, `1785161662029`, `1785161396221` y `1785161271814`. Sólo la
prueba tipada de disjunción autoriza el scope.

Escenario A:

```text
assignment neutral para loadTransferRequired
loadTransferRequired → resolved contractual
lateral resistance → unresolved
coverage → partial
verification → notVerified
```

Escenario B:

```text
sin assignment de transferencia
loadTransferRequired → unresolved
lateral resistance → unresolved
coverage → none
verification → notVerified
```

Ambos usan las mismas autoridades y scope inicial, pero IDs, outputs y hashes son independientes.
Modificar assignments o eliminar A no cambia B. Un cambio upstream efectivo compartido vuelve stale
ambos; un cambio ajeno al paquete efectivo no. Ninguna generación muta geometry,
structuralIntent ni structuralRequirements.

## UI mínima

Agregar `Soluciones constructivas > Escenarios…`, completamente separado de `Estructura`, con:

- lista y selección de escenarios;
- crear, duplicar, renombrar, archivar/desarchivar y eliminar;
- elegir adapter/library neutral, editar configuración, scope y assignments;
- ejecutar generación explícita;
- mostrar elegibilidad, lifecycle, coverage, freshness, verification, execution, findings y receipt;
- explicar cambios mediante subfingerprints efectivos;
- inspeccionar resultados derivados mientras están materializados.

No se diseña Metalcon real, comparación de soluciones ni verificación resistente.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Escenarios opcionales dentro de v3 | Eludiría migración y validación nativa |
| Persistir generatedSolution | Crea segunda autoridad constructiva y output stale silencioso |
| Usar hash global para freshness | Cambios ajenos al scope invalidarían falsamente |
| Entregar autoridades completas al adapter | Permite navegación/mutación fuera de la frontera |
| Inferir alcance de blockers geométricamente | Rompe trazabilidad y fail-closed |
| Equiparar resolved/complete con verified | Mezcla generación con verificación resistente |
| Reutilizar wallTypeId como intención/assignment | Mezcla Metalcon legacy con contrato agnóstico |
| IDs aleatorios o temporales | Rompen determinismo, reapertura e historia |
| Implementar equivalencia técnica de escenarios | Pertenece a SPEC-016-C y no gobierna freshness |

## Alcance

- modelo nativo v4 y migración v3→v4;
- schemas de raíz, escenario, assignment, receipt, adapter input y output;
- allocators deterministas e historia/undo/redo;
- CRUD y aislamiento de escenarios;
- scope tipado y evaluador local fail-closed;
- proyección efectiva allowlist;
- adapter y biblioteca neutrales de contrato;
- generation output derivado/no persistente;
- coverage/freshness/provenance y receipts explicables;
- canonicalización y hashes;
- UI mínima separada;
- persistencia/reapertura;
- evidencia real FX-008 con escenarios A/B;
- pruebas de reversión de fronteras de autoridad.

## Fuera de alcance

- migrar, borrar o reinterpretar Metalcon legacy;
- implementar perfiles, studs, OSB, modulación o materiales reales en el adapter neutral;
- SPEC-016-B y adaptación Metalcon;
- SPEC-016-C, comparación o fingerprint de equivalencia técnica;
- verificador resistente, capacidad, rigidez o cumplimiento normativo;
- persistir output constructivo;
- cambiar geometría, intención, topología, requirements o candidate paths;
- habilitar SPEC-08;
- DXF/INP constructivos de escenarios;
- expandir automáticamente assignments stale;
- abrir otra SPEC durante este corte.

## Criterios de aceptación

1. v3→v4 es pura, determinista, idempotente y conserva todo legacy sin pérdida.
2. v4 exige raíz `constructiveSolutions`, schemas y allocators coherentes.
3. IDs/allocators cumplen create/delete/duplicate y undo/redo sin reutilización incidental.
4. Assignment v1.0 valida requirement, target, library, parámetros, canonicalización y no-op.
5. `all` y `requirements` son inequívocos; scope vacío/roto se rechaza.
6. Un blocker sólo se excluye por cierre resoluble y prueba tipada de independencia; lo incierto
   bloquea.
7. El adapter recibe sólo el effective input canónico e inmutable.
8. El adapter neutral resuelve/no resuelve requirements con provenance y nunca importa Metalcon.
9. `resolved` y coverage `complete` no producen verificación; sólo se acepta `notVerified`.
10. Output, resolutions, findings y métricas completas no persisten; el receipt sí.
11. `effectiveGenerationInputSha256` es la única autoridad fresh/stale e incluye scenarioId.
12. Subfingerprints del receipt explican cambios sin gobernar freshness.
13. Cambios fuera del paquete efectivo y en otro escenario no invalidan; cambios efectivos sí.
14. Falta de adapter/library produce `unavailable`; falta de output materializado no produce stale.
15. Reapertura reconstruye estado desde escenario/receipt y regeneración idéntica reproduce output.
16. Toda mutación es histórica, atómica, aislada y no-op aware.
17. La UI queda separada de Estructura y muestra las cinco dimensiones sin mezclarlas.
18. FX-008 demuestra A=`partial`, B=`none`, ambos `notVerified`, blockers de cubierta excluidos sólo
    por prueba y cero mutación upstream.
19. La suite falla si se entrega intención viva, store/UI/Metalcon al adapter, si se mutan inputs,
    se permite verified, se usa hash global o se ignora un blocker indeterminado.
20. Pruebas focales, persistencia, store, componentes, `npm run validate`, `make governance`,
    `git diff --check` y cierre quedan verdes antes de cerrar.

## Evidencia

- tests de migración v3→v4, schema y roundtrip;
- tests de dominio, allocators, historial, reapertura y aislamiento;
- tests de assignments, scope eligibility y fail-closed;
- tests de proyección allowlist, pureza/no mutación y ausencia de imports prohibidos;
- tests de output/provenance, coverage, freshness, availability y hashes;
- tests de UI e independencia de `Estructura`;
- evidencia real determinista FX-008 A/B;
- reversión crítica: intención viva, store/UI/Metalcon, mutación, verified, hash global y blocker no
  demostrable deben hacer fallar la suite;
- cierre esperado `sessions/close-SPEC-016-A.md`.

## Gate de apertura documental

Esta apertura sólo congela el contrato aprobado, actualiza gobernanza, manifiesto y sesión. No
autoriza Fase B ni modificación de código productivo. Después de `make governance` y
`git diff --check`, el corte se detiene para revisión humana.

## Corte sugerido

Tras autorización explícita de Fase B: implementar primero modelo/migración y dominio puro; luego
scope/proyección/adapter neutral; después store/persistencia; UI al final. Detener con escenarios
aislados y evidence FX-008 validada, sin abrir SPEC-016-B ni SPEC-016-C.
