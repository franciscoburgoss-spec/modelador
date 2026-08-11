# SPEC-015-E — Integración R6–R12 y requisitos estructurales agnósticos

**Estado:** activa para Fase B · contrato congelado antes de implementación · 2026-08-10
**Baseline certificado:** `main@6d371bd` (`6d371bd5062de3f8a647bfce0631d722b63f8f26`)
**ZIP de entrada certificado:** `2bde041150cec4655619501057d164f5c1c147f2c3b6a49c04ec1f864fcd5614`
**Regla de corte:** la Fase B implementa únicamente R6–R12 y `structural-requirements-v1.0`; no abre adaptadores constructivos.

## Diagnóstico

SPEC-015-D REV8 cerró una arquitectura que el borrador del 04-ago-2026 no conocía: `structural-intent-v1.1` incorpora `interfaceIntents[]` y `relationIntents[]` persistentes, capaces de declarar una interacción localizada en cara, extremo, región o borde de cubierta y una relación fuente→destino con familia de acción y función estructural. Las propuestas y los caminos siguen siendo derivados, recalculables y no autoritativos.

Por ello R6–R12 no pueden “reconocer” nuevamente una decisión que ya existe ni convertir evidencia candidata en verificación. Deben terminar la topología geométrica, proyectar de forma trazable las declaraciones humanas sobre regiones exactas y producir un contrato de **requisitos**, no de miembros.

El caso FX-008 demuestra tres límites normativos:

1. un borde físico puede medir 10.400 mm y su interacción declarada sólo 1.700 mm;
2. cuatro caminos gravitacionales `completeCandidate` pueden existir sin que el proyecto esté verificado ni tenga toda la intención de techumbre resuelta;
3. `lateral=0` puede deberse a ausencia de declaración. Al declarar explícitamente un diafragma y un muro resistente reales aparece una ruta lateral incompleta con un gap de 571,429 mm que debe convertirse en requisito de transferencia, no en una solución inventada.

## Decisión

Completar R6–R12 como una transformación **pura, determinista, idempotente y no persistente** que consume las autoridades y evidencias vigentes:

```text
agnostic-geometry-v1.0                         [autoridad física]
recognized-structural-topology-v1.0 / R0–R5   [hecho derivado]
structural-intent-v1.1                         [autoridad humana persistente]
  ├─ elementIntents / roofIntents
  ├─ intersectionIntents / supportIntents
  ├─ diaphragmIntents / overrides
  └─ interfaceIntents / relationIntents REV8
structural-proposals-v1.0 + review log         [contexto derivado/no autoritativo]
candidate-load-paths-v1.0                      [evidencia derivada/no verificada]
```

y produce:

```text
recognized-structural-topology-v1.0 / R0–R12
structural-requirements-v1.0
```

La primera salida describe **qué existe, dónde y cómo se relaciona**. La segunda describe **qué funciones/transferencias/apoyos debe poder resolver cualquier adaptador constructivo**. Ninguna salida verifica capacidad.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: completa R6–R12 sobre contratos REV8, define dos salidas canónicas, stale/fingerprints, corpus adversario y evidencia real FX-008 sin incorporar una solución constructiva.

## Alcance

- Completar R6–R12 como transformación pura sobre geometría, topología R0–R5, intención v1.1, interfaces/relaciones REV8 y evidencia candidata.
- Emitir `recognized-structural-topology-v1.0` con R0–R12 y `structural-requirements-v1.0` como derivados canónicos, no persistentes y `notVerified`.
- Proyectar declaraciones locales sólo sobre sus regiones exactas, con precedencia explícita, stale/broken tipado y sin fallback geométrico silencioso.
- Conservar separados geometría, topología, intención, interfaz/relación, propuesta, camino candidato, requisito y solución constructiva.
- Auditar determinismo, idempotencia, fingerprints, elegibilidad y no mutación/no persistencia.
- Aplicar cada regla a FX-008 real y conservar como regresión los conteos, localizaciones parciales, cuatro caminos gravitacionales candidatos y el escenario lateral explícito descrito en esta spec.
- Cubrir corpus adversario y pruebas de reversión antes de integrar evidencia visual.

## 1. Invariantes de autoridad

### E-AUTH-01 — Precedencia

La precedencia obligatoria es:

1. geometría agnóstica válida;
2. topología R0–R5 derivada de esa geometría;
3. intención explícita persistente v1.1;
4. interfaces/relaciones explícitas fresh y resolubles, como especialización local de la intención;
5. propuestas/reviews, sólo como contexto;
6. caminos candidatos, sólo como evidencia;
7. requisitos R6–R12 derivados.

Una fuente de menor rango nunca reescribe silenciosamente una de mayor rango.

### E-AUTH-02 — Declaración local no es función global

`relationIntents` e `interfaceIntents` pueden declarar `support`, `loadTransfer`, `collectorAction`, `diaphragmAction` o `stabilization` sobre una localización longitudinal exacta, que puede ser un rango o un extremo canónico. Esa declaración se proyecta como `declaredInteractions[]` de la región exacta. No se añade a `declaredFunctions[]` de todo el elemento salvo que exista un `elementIntent` que lo declare globalmente.

### E-AUTH-03 — Freshness

Una interfaz/relación `stale`, `broken` o geométricamente incompatible no puede alimentar un requisito. Se conserva la evidencia, se emite finding y se bloquea sólo el ámbito que dependa de ella. Está prohibido sustituirla silenciosamente por una coincidencia geométrica distinta.

### E-AUTH-04 — Candidate ≠ verified

`candidate`, `completeCandidate`, propuesta aceptable, contacto geométrico y continuidad a fundación no equivalen a `verified`. SPEC-015-E no posee un verificador resistente; por tanto toda salida usa `verificationState: "notVerified"`.

### E-AUTH-05 — No segunda autoridad persistente

R6–R12 y `structural-requirements-v1.0` son derivados recalculables. No se guardan silenciosamente dentro del proyecto nativo ni se agregan a `structuralIntent`. Una futura persistencia requiere una SPEC separada y explícita.

## 2. R6 — Contexto de eje, no clasificación

### E-R6-01 — Contexto opcional

R6 puede producir `axisContext` únicamente si existe una fuente de contexto explícita y versionada. Con el baseline actual, donde no existe un contrato persistente universal de roles de eje, el default es:

```text
undetermined
```

Valores permitidos:

```text
resistantContext
secondaryContext
mixedContext
undetermined
```

### E-R6-02 — Sin efecto normativo autónomo

Un `axisContext`:

- sirve para agrupación, navegación, explicación o propuestas;
- no cambia `declaredParticipation`;
- no crea `requiredStructuralEffect`;
- no convierte un muro en resistente;
- no sustituye `elementIntents`, `intersectionIntents` ni relaciones explícitas.

### E-R6-03 — Prioridad de intención

Si existe intención explícita de elemento/intersección que difiere del contexto, la intención explícita prevalece y el contexto queda registrado sólo como evidencia contextual.

## 3. R7 — Participación y funciones

Por elemento se produce una proyección no persistente:

```json
{
  "elementId": 1784606313849,
  "declaredParticipation": "resistant",
  "declaredFunctions": ["inPlaneLateralResistance"],
  "declaredInteractions": [],
  "candidateFunctions": [],
  "resolvedByScenarioFunctions": [],
  "verificationState": "notVerified",
  "sources": []
}
```

### E-R7-01 — Cuatro estados separados

Nunca se fusionan:

```text
declared
candidate
resolvedByScenario
verified
```

SPEC-015-E no crea escenarios ni verificación resistente; `resolvedByScenarioFunctions[]` permanece vacío/no evaluado y `verificationState` es `notVerified`.

### E-R7-02 — Elemento sin intención

Un elemento sin `elementIntent` conserva:

```text
declaredParticipation = undetermined
declaredFunctions = []
```

La existencia de fundación, eje, propuesta o camino no lo promueve.

### E-R7-03 — Intención parcial

Una función global declarada y una interacción local pueden coexistir. La interacción local se vincula a región/rango y nunca expande el dominio de la declaración global.

## 4. R8 — Apoyo vertical y precedencia explícita

### E-R8-01 — Handoff explícito primero

Cuando un `relationIntent` fresh declara `support` o `loadTransfer`, ese handoff se consume antes de buscar receptores geométricos alternativos.

Si el destino explícito no puede resolverse:

- no se cambia de receptor silenciosamente;
- se emite `SR-EXPLICIT-RELATION-UNRESOLVED`;
- el tramo queda `unresolved`.

### E-R8-02 — Continuidad geométrica después del receptor

Una vez alcanzado el receptor declarado, y sólo si no existe otra declaración contradictoria, puede aplicarse la jerarquía geométrica:

```text
muro inferior compatible
→ elemento de transferencia explícitamente declarado, si existe
→ fundación/base compatible
→ no resuelto
```

### E-R8-03 — Estatus de `supportedByFoundation`

El edge derivado `supportedByFoundation` se proyecta como:

```text
provenance = candidatePath
certainty = candidate
supportEvidence = candidateSupportEvidence
verificationState = notVerified
```

No crea `declaredParticipation=resistant` ni prueba anclaje/capacidad.

### E-R8-04 — Rangos

Todo support/transfer conserva los rangos S/Z de las interfaces y el intervalo común geométrico. Está prohibido expandir al host completo.

### E-R8-05 — Corte explicado

Toda ruta incompleta incluye `cutReason`, `sourceRefs` y evidencia dimensional suficiente para distinguir:

- falta de decisión humana;
- referencia inválida/stale;
- transferencia requerida por resolver;
- soporte geométrico no encontrado.

## 5. R9 — Techumbre y borde canónico

### E-R9-01 — Identidad física e interacción

Cada relación de `roofBoundary` conserva como campos distintos:

```json
{
  "physicalBoundary": {
    "boundaryId": "...",
    "physicalSRange": [12800, 23200]
  },
  "interactionLocator": {
    "sRange": [12800, 14500]
  }
}
```

### E-R9-02 — FX-008 B1 es golden contractual

Para la cubierta norte `1785161146258`:

```text
borde físico @ C:     S 12800→23200 = 10.400 mm
interacción declarada: S 12800→14500 = 1.700 mm
```

Ninguna fase R9–R12 puede convertir el segundo rango en el primero.

### E-R9-03 — Familia de acción explícita

La orientación `face ±N`, un borde o una coincidencia física no implican `gravity` ni `lateral`. La familia de acción procede de `relationIntent.actionFamily` o de una declaración roof/diaphragm compatible.

### E-R9-04 — Cobertura de intención de cubierta

Por cubierta se deriva uno de:

```text
notDeclared
partial
declaredStructural
declaredNonStructural
```

Una cubierta activa con `notDeclared` o `partial` puede producir `SR-ROOF-INTENT-INCOMPLETE` y una `blockingDecision`, aunque existan caminos candidatos completos. La ausencia de path no se usa para inferir `declaredNonStructural`.

## 6. R10 — Bordes topológicos y efectos requeridos

R10 separa el hecho de borde de la exigencia estructural.

### `topologicalBoundary`

Valores mínimos:

```text
wallStart
wallEnd
openingLeft
openingRight
perpendicularIntersection
crossing
stackBoundary
foundationBoundary
roofInteractionBoundary
auxiliary
```

### `requiredStructuralEffect`

Vocabulario agnóstico:

```text
supportRequired
loadTransferRequired
gravityResistanceRequired
inPlaneLateralResistanceRequired
collectorActionRequired
diaphragmActionRequired
stabilizationRequired
supportTransitionRequired
noStructuralEffect
unresolved
```

Quedan prohibidos `stud`, `king`, `jamb`, perfil, OSB, Metalcon o cualquier miembro/material.

### E-R10-01 — Trazabilidad

Cada efecto requerido cita una o más fuentes exactas: intención, interfaz/relación, topología, path/finding o decisión humana explícita.

### E-R10-02 — Requirement ≠ blockingDecision

Un efecto constructivo que cualquier adaptador debe resolver **no bloquea elegibilidad por definición**. Bloquea sólo cuando no se sabe qué función, origen, destino o región debe resolverse.

Ejemplo FX-008 lateral: el gap vertical de `571.429 mm` con techo y muro destino conocidos produce `loadTransferRequired`; no prescribe el mecanismo.

## 7. R11 — Regiones estructurales agnósticas

### E-R11-01 — Identidad

Una región se identifica semánticamente por:

```text
ownerRef + longitudinalLocation + zRange + límites topológicos gobernantes
```

`longitudinalLocation` es discriminada:

```text
range → sRange
end   → end + anchorS
```

La `localizationEnvelope` de un extremo es evidencia geométrica de localización/tolerancia y **no forma parte de su longitud física ni de su identidad semántica**. No se identifica una región por orden de entrada ni contador.

### E-R11-02 — Contenido mínimo

Región longitudinal:

```json
{
  "regionId": "sr-region:sha256:...",
  "ownerRef": {"kind":"element","id":1784819708086},
  "longitudinalLocation": {
    "kind": "range",
    "sRange": [12800,14500]
  },
  "zRange": [3250,4150],
  "topologicalBoundaries": [],
  "activeOpenings": [],
  "zBands": [],
  "declaredFunctions": [],
  "declaredInteractions": [],
  "candidateEvidenceRefs": [],
  "requirementRefs": [],
  "verificationState": "notVerified"
}
```

Extremo canónico:

```json
{
  "regionId": "sr-region:sha256:...",
  "ownerRef": {"kind":"element","id":1784754251210},
  "longitudinalLocation": {
    "kind": "end",
    "end": "highS",
    "anchorS": 2000,
    "localizationEnvelope": [1999.9,2000]
  },
  "zRange": [3250,4150],
  "verificationState": "notVerified"
}
```

### E-R11-03 — No fusión por host

Dos regiones del mismo muro se mantienen separadas si difieren en localización longitudinal (`range` o `end`), banda Z, función, soporte, transferencia o fuente. Compartir `ownerRef` no autoriza fusión.

### E-R11-04 — Goldens FX-008

Deben existir regiones trazables para:

- B1 parcial: interacción `range S 12800→14500` dentro del borde físico `S 12800→23200`;
- frontón C/6→7: `range S 12800→14500`, `Z 3250→4150`;
- receptor C/6: `range S 1949.45→2050.55`, `Z 3250→4150`;
- receptor C/7: `end=highS`, `anchorS=2000`, `Z 3250→4150`, conservando `localizationEnvelope S 1999.9→2000` sólo como evidencia de localización/tolerancia.

En C/7 está prohibido publicar `0.1 mm` como longitud física del receptor. Esa magnitud pertenece exclusivamente a la envolvente de localización REV8.

### E-R11-05 — Vanos y bandas Z

Los `activeOpenings` y `zBands` provienen de R0–R5 y se mantienen para impedir que una función o requisito se propague a una banda físicamente ocupada/excluida. Para una región `end`, la `localizationEnvelope` puede usarse únicamente en operaciones geométricas que exigen intervalo positivo; el límite topológico se evalúa contra `anchorS`.

## 8. R12 — Auditoría y elegibilidad

### E-R12-01 — Invariantes

1. todas las referencias son resolubles o existe finding explícito;
2. gravedad y lateral siguen en grafos separados;
3. una propuesta `pending/rejected` nunca materializa declaración ni requisito aceptado;
4. `verified` es inválido sin un contrato futuro de verificador;
5. toda función declarada se vincula a al menos una región o genera `SR-DECLARED-FUNCTION-WITHOUT-REGION`;
6. toda ruta incompleta explica el corte;
7. toda relación de cubierta conserva `boundaryId` físico y locator de interacción;
8. apoyos candidatos respetan la jerarquía y no promueven participación;
9. toda fuente derivada usada tiene fingerprints compatibles;
10. output determinista, idempotente y sin mutar entradas;
11. ningún rol constructivo (`wallType.role`, MP1/MP2/MP3/tabique) participa en la clasificación;
12. ningún derivado R6–R12 se persiste silenciosamente en el proyecto nativo.

### E-R12-02 — Estado lateral

Por contexto/dirección se expone uno de:

```text
notDeclared
notApplicable
candidate
incompleteCandidate
completeCandidate
blockedCandidate
```

`0 paths` nunca se traduce automáticamente a `notApplicable`.

### E-R12-03 — Blocking decisions

`blockingDecisions[]` contiene sólo incertidumbres que un adaptador no puede resolver sin inventar intención o autoridad, por ejemplo:

- interfaz/relación requerida `stale/broken`;
- destino/función estructural ambiguos;
- cruce estructural relevante sin intención;
- función declarada sin región;
- intención de cubierta activa ausente/parcial;
- evidencia derivada stale cuando es necesaria para justificar el requisito;
- referencia fuente inválida.

No se agrega una blocking decision sólo porque el adaptador deba diseñar una transferencia, apoyo o resistencia.

### E-R12-04 — Elegibilidad

```text
eligibleForConstructiveSolutions =
  no errores de autoridad/topología
  AND blockingDecisions.length == 0
```

Significa únicamente: **un adaptador constructivo puede intentar satisfacer el contrato**.

No significa:

- capacidad suficiente;
- conformidad normativa;
- estabilidad;
- conexión/anclaje verificados;
- deformaciones verificadas;
- diseño aprobado.

## 9. Contrato exacto propuesto — `recognized-structural-topology-v1.0` R0–R12

Se mantiene el schema name v1.0 porque R6–R12 ya estaban reservadas por el contrato, pero la implementación debe congelar una forma exacta y probar compatibilidad. Forma raíz propuesta:

```json
{
  "schema": "recognized-structural-topology-v1.0",
  "sourceSchema": "agnostic-geometry-v1.0",
  "specVersion": "SPEC-14-v0.3+SPEC-015-E",
  "config": {},
  "phasesExecuted": ["R0","R1","R2","R3","R4","R5","R6","R7","R8","R9","R10","R11","R12"],
  "phasesPending": [],
  "axes": [],
  "levels": [],
  "walls": [],
  "openings": [],
  "foundations": [],
  "roofSupports": [],
  "verticalSupports": [],
  "relations": [],
  "nodes": [],
  "segments": [],
  "findings": [],
  "eligibleForSpec08": false,
  "canonicalSha256": "..."
}
```

`eligibleForSpec08` queda sólo por compatibilidad legacy y **no es autoridad** para la nueva frontera. La elegibilidad genérica vive exclusivamente en `structural-requirements-v1.0`.

R6/R7 pueden enriquecer `walls[]` con un objeto `structuralContext`, pero dicho objeto debe conservar `sourceRefs` y nunca confundirse con hecho geométrico.

## 10. Contrato exacto propuesto — `structural-requirements-v1.0`

```json
{
  "schema": "structural-requirements-v1.0",
  "specVersion": "SPEC-015-E-v1.0",
  "sourceFingerprints": {
    "geometrySha256": "...",
    "topologyR0R5Sha256": "...",
    "structuralIntentSha256": "...",
    "elementIntentsSha256": "...",
    "roofIntentsSha256": "...",
    "intersectionIntentsSha256": "...",
    "supportIntentsSha256": "...",
    "interfaceIntentsSha256": "...",
    "relationIntentsSha256": "...",
    "diaphragmIntentsSha256": "...",
    "overridesSha256": "...",
    "proposalSetSha256": "...",
    "proposalReviewLogSha256": "...",
    "candidateLoadPathsSha256": "...",
    "aggregateSha256": "..."
  },
  "elements": [],
  "regions": [],
  "supports": [],
  "transfers": [],
  "requirements": [],
  "gravityPaths": [],
  "lateralPaths": [],
  "roofIntentCoverage": [],
  "findings": [],
  "blockingDecisions": [],
  "eligibility": {
    "eligibleForConstructiveSolutions": false,
    "reasonCodes": []
  },
  "verification": {
    "state": "notVerified",
    "verifierRef": null
  },
  "canonicalSha256": "..."
}
```

### E-SCHEMA-01 — Fingerprints

Se elimina la ambigüedad de `elementIntentSha256` del motor actual. El requisito hashea tanto el root completo (`structuralIntentSha256`) como cada colección persistente de forma proyectada. Propuestas/reviews/paths también se hashean, pero se etiquetan como evidencia no autoritativa.

### E-SCHEMA-02 — Orden canónico

Orden mínimo:

- `elements`: `elementId`;
- `regions`: `ownerRef`, coordenada longitudinal (`sRange[0]` para `range`, `anchorS` para `end`), `longitudinalLocation.kind`, `zRange[0]`, `regionId`;
- `supports/transfers`: `graph`, `fromRefs[0]`, `toRefs[0]`, `id`;
- `requirements`: `graph`, `targetRegionRef`, `kind`, `id`;
- paths: `graph`, `pathId`;
- findings: `severity`, `code`, `findingId`;
- blocking decisions: `code`, `decisionId`.

Los objetos se serializan mediante claves canónicas; colecciones semánticamente equivalentes producen `deepEqual` y mismo SHA-256.

### E-SCHEMA-03 — Tolerancias

R6–R12 heredan del topology input, sin inventar otra geometría:

```text
linearTolerance = 0.1 mm
levelTolerance = 0.1 mm
angularToleranceDeg = 0.001°
minimumOverlap = 0.1 mm
minimumSupportOverlap = 38.0 mm
minimumSegmentLength = 0.1 mm
openingProximityReviewDistance = 150.0 mm
roundDecimals = 3
```

Una interfaz REV8 se valida además con su propio contrato de rango/freshness; no se redondea antes de comparar.

### E-SCHEMA-04 — IDs

IDs derivados usan SHA-256 de payload semántico canónico, nunca fecha, orden original, contador global ni aleatoriedad.

Ejemplos:

```text
sr-region:sha256:<hash(ownerRef,longitudinalLocationSemantic,zRange,boundaries)>
sr-support:sha256:<hash(relationId)>                    # relación declarada
sr-support:sha256:<hash(graph,edgeId)>                 # evidencia candidatePath
sr-transfer:sha256:<hash(relationId)>
sr-requirement:sha256:<hash(kind,graph,targetRegion,sourceRefs)>
sr-decision:sha256:<hash(code,scope,sourceRefs)>
```

Para `longitudinalLocation.kind=end`, `longitudinalLocationSemantic` contiene `kind + end + anchorS`; la `localizationEnvelope` queda fuera del ID porque representa tolerancia de localización, no extensión estructural.

Los registros `supports[]` / `transfers[]` congelan esta forma mínima común:

```json
{
  "id": "sr-support:sha256:...",
  "graph": "gravity",
  "structuralFunction": "support",
  "fromRefs": [],
  "toRefs": [],
  "targetRegionRefs": [],
  "provenance": "declaredRelation|candidatePath",
  "certainty": "declared|candidate",
  "verificationState": "notVerified",
  "sourceRefs": []
}
```

Una relación declarada usa `targetRegionRefs[]` resolubles a R11 y no republica `ranges[]`. Una evidencia `candidatePath` puede conservar `evidence.overlapRange` sólo como evidencia geométrica candidata, con `targetRegionRefs: []`; dicho overlap no se transforma en región declarada ni verificada.

## 11. Catálogo inicial de findings/requisitos

### Autoridad/decisión

```text
SR-INTENT-UNRESOLVED
SR-EXPLICIT-RELATION-UNRESOLVED
SR-INTERFACE-STALE
SR-RELATION-STALE
SR-ROOF-INTENT-INCOMPLETE
SR-USER-DECISION-PENDING
SR-SOURCE-FINGERPRINT-MISMATCH
```

### Región/función

```text
SR-DECLARED-FUNCTION-WITHOUT-REGION
SR-INTERACTION-WITHOUT-REGION
SR-PARTIAL-RANGE-EXPANDED
```

### Caminos/requisitos

```text
SR-GRAVITY-PATH-INCOMPLETE
SR-LATERAL-PATH-INCOMPLETE
SR-SUPPORT-REQUIRED
SR-LOAD-TRANSFER-REQUIRED
SR-DIAPHRAGM-ACTION-REQUIRED
SR-COLLECTOR-ACTION-REQUIRED
SR-STABILIZATION-REQUIRED
```

### Verificación

```text
SR-VERIFICATION-NOT-AVAILABLE
SR-VERIFIED-WITHOUT-VERIFIER
```

## 12. Caso real obligatorio — FX-008

La regresión de Fase B debe demostrar simultáneamente:

### Baseline REV8

```text
45 muros
43 vanos
32 fundaciones
7 cubiertas
8 interfaceIntents
5 relationIntents
0 propuestas en el checkpoint final
4 gravity paths completeCandidate
0 lateral paths en el checkpoint final
0 verified
```

### Rango B1

```text
roof 1785161146258 @ C
physical:    S 12800→23200  (10.400 mm)
interaction: S 12800→14500  (1.700 mm)
```

### Frontón/receptores

```text
frontón 1784819708086: S 12800→14500 · Z 3250→4150
C/6 1784753322528:      S 1949.45→2050.55 · Z 3250→4150
C/7 1784754251210:      end=highS · anchorS=2000 · Z 3250→4150 · localizationEnvelope 1999.9→2000
```

### Escenario lateral explícito de Fase A

Sólo mediante intención explícita:

```text
roof 1785158713616: diaphragmBehavior=intended
wall 1784606313849: resistant + inPlaneLateralResistance
```

Debe aparecer:

```text
1 lateral path = incompleteCandidate
gap = 571.429 mm
roofZ = 3821.429 mm
wallTopZ = 3250 mm
SR-LOAD-TRANSFER-REQUIRED
verificationState = notVerified
```

El requisito puede ser entregable a un adaptador porque el destino está definido; la elección del mecanismo constructivo queda fuera de SPEC-015-E.

## 13. Prototipo visual obligatorio de Fase B

La evidencia visual debe reutilizar el localizador sin mutar el modelo y permitir navegar:

```text
geometría
→ R0–R5
→ intención
→ interfaz/relación
→ path candidato
→ región R11
→ requisito R10/R12
→ sourceRefs/fingerprints
```

Debe incluir:

- planta real FX-008;
- selección de B1, frontón, C/6 y C/7;
- rangos físicos versus interacción;
- gravedad/lateral diferenciados por etiqueta/patrón además de color;
- `blockingDecisions` explicadas textualmente;
- estado de elegibilidad;
- caso lateral con gap 571,429 mm;
- señalización accesible no dependiente sólo del color.

## 14. Corpus adversario y pruebas de reversión para Fase B

### Entradas inválidas

1. interfaz requerida con owner inexistente;
2. relación con port roto;
3. fingerprint de host `stale`;
4. path con sourceFingerprints incompatibles;
5. región fuera del host;
6. rango parcial expandido silenciosamente;
7. `verified=true` sin verifier;
8. función global derivada sólo desde relación local;
9. propuesta `pending/rejected` convertida en declaración;
10. `lateral=0` convertido a `notApplicable` sin declaración;
11. IDs duplicados/no deterministas;
12. número no finito.

### Reversiones obligatorias

- reintroducir `wallType.role` / MP1–MP3 / `tabique` como autoridad debe hacer fallar la prueba;
- escribir R6–R12 dentro del proyecto nativo sin contrato explícito debe hacer fallar la prueba;
- eliminar la prioridad de relación explícita y volver a fallback geométrico silencioso debe fallar;
- expandir B1 parcial a 10.400 mm debe fallar;
- promover `completeCandidate` a `verified` debe fallar;
- tratar `supportedByFoundation` como resistencia declarada debe fallar.

## 15. Plan de ejecución de Fase B

La implementación se divide en cortes atómicos y reversibles. No se mezcla el adaptador constructivo y cualquier necesidad de escalamiento exige detener el corte y abrir una decisión posterior.

## Fuera de alcance

- Metalcon, madera, SIP, albañilería u otro adaptador concreto;
- perfiles, materiales, OSB, montantes, jambas, cerchas, conectores o anclajes;
- capacidad, rigidez, resistencia, deformaciones o cumplimiento normativo;
- cálculo sísmico o gravitacional de solicitaciones;
- creación de escenarios de análisis;
- migración de `wallTypes`;
- DXF/INP constructivo;
- cambiar la geometría para “hacer calzar” un requisito;
- persistir R6–R12 como nueva autoridad editable.

## Criterios de aceptación

1. R0–R12 se ejecutan en orden sin alterar R0–R5 ni el JSON agnóstico.
2. Se consume `structural-intent-v1.1` real, incluyendo interfaces/relaciones REV8.
3. La precedencia explícita impide fallback geométrico silencioso en un handoff declarado.
4. Interacciones locales no se convierten en funciones globales del host.
5. B1 conserva 10.400 mm físicos y 1.700 mm de interacción en topology, region y requirement.
6. C/6 conserva su rango exacto y C/7 conserva su extremo canónico `highS @ S=2000`; `1999.9→2000` permanece sólo como envolvente de localización/tolerancia.
7. Los 4 caminos G siguen `completeCandidate`, pero `verificationState` permanece `notVerified`.
8. `supportedByFoundation` permanece `candidateSupportEvidence`.
9. `lateral=0` se clasifica según declaración, nunca por ausencia de paths solamente.
10. El escenario lateral explícito real produce gap 571,429 mm y `SR-LOAD-TRANSFER-REQUIRED` sin miembro constructivo.
11. Una transferencia requerida con origen/destino inequívocos puede seguir siendo elegible para adaptadores.
12. Una decisión humana/semántica pendiente sí bloquea elegibilidad.
13. La cobertura de intención de techumbre se audita independientemente de los paths G completos.
14. Toda función/interacción tiene región o finding explícito.
15. Propuestas pending/rejected no crean declaraciones/requisitos aceptados.
16. No existe `verified` sin verifier.
17. Permutaciones equivalentes producen `deepEqual` y el mismo `canonicalSha256`.
18. IDs derivados son semánticos/deterministas.
19. Corpus stale/broken/invalid produce errores/findings tipados sin mutación parcial.
20. Prueba de reversión con `wallType.role` falla como se espera.
21. Prueba de reversión de escritura silenciosa al proyecto nativo falla.
22. El roundtrip nativo no incorpora derivados R6–R12 no autorizados.
23. El grafo productivo de R6–R12 no importa store, React, Three.js, Metalcon, OSB, perfiles ni materiales.
24. FX-008 conserva 45/43/32/7 y la evidencia visual real.
25. `eligibleForConstructiveSolutions=true` nunca se presenta como conformidad o verificación.
26. Gates de Fase B: tests focales, corpus adversario, determinismo, reversión, cobertura, `make governance`, `npm run validate`, build, auditoría Codex y `git diff --check`.

## Evidencia

- tests R6–R12;
- tests exactos de ambos contratos;
- golden JSON FX-008 y HTML/SVG interactivo;
- manifiesto de conteos/hashes;
- pruebas de stale/broken y source fingerprints;
- pruebas de no mutación/no persistencia;
- pruebas de reversión;
- evidencia de independencia de soluciones constructivas;
- cierre `sessions/close-SPEC-015-E.md` sólo después de implementación validada y aprobación correspondiente.

## Corte sugerido

Detener cuando `structural-requirements-v1.0` sea un contrato agnóstico, determinista, trazable y consumible por adaptadores, con R0–R12 completos y evidencia real FX-008, **sin aplicar todavía ningún sistema constructivo**.
