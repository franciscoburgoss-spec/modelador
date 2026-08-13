# BUG-016-A-004 — Colisiones cross-domain en referencias de scopeClosure

## Estado

CERRADO — 12-ago-2026.

## Hallazgo

B2.2 limita la conectividad a campos reference-bearing, pero almacena todas las referencias en una
colección global indexada sólo por `idToken(value)`. Dos campos de dominios distintos pueden por
tanto conectar entidades cuando comparten el mismo valor. Por ejemplo, un `elementId=7001` puede
hacer alcanzable un path cuyo único valor coincidente sea `roofGeometryId=7001`.

La identidad contractual correcta es `domain + canonical value`, no sólo el valor.

## Contratos reales inspeccionados

| Campo contractual | Dominio normalizado | Observación |
|---|---|---|
| `requirement.id` / `region.requirementRefs[]` | `requirementId` | identidad derivada R10/R12 |
| `requirement.targetRegionRef` / `support.targetRegionRefs[]` / `transfer.targetRegionRefs[]` | `regionId` | región R11 exacta |
| `region.regionId` | `regionId` | identidad de región |
| `region.ownerRef.id`, cuando `kind=element` | `elementId` | string o número según autoridad geométrica |
| `region.ownerRef.roofGeometryId`, cuando `kind=roofBoundary` | `roofGeometryId` | identidad de cubierta |
| `region.ownerRef.boundaryId`, cuando `kind=roofBoundary` | `boundaryId` | borde físico de esa cubierta |
| `region.topologicalBoundaries[].nodeId` | `nodeId` | nodo R0–R5 |
| `region.activeOpenings[]` | `openingId` | vano geométrico |
| `declaredInteraction.relationId` | `relationId` | relación humana persistente |
| `declaredInteraction.interfaceId` | `interfaceId` | interfaz humana persistente |
| `path.pathId` | `pathId` | path candidato |
| `path.sourceRefs.proposalId` | `proposalId` | propuesta candidata |
| `path.sourceRefs.relationId` | `relationId` | relación declarada |
| `path.sourceRefs.roofGeometryId` | `roofGeometryId` | cubierta fuente |
| `path.sourceRefs.targetElementId` | `elementId` | elemento receptor |
| `path.sourceRefs.boundaryId` | `boundaryId` | borde físico |
| `support.id` | `supportId` | identidad R10/R12 |
| `transfer.id` | `transferId` | identidad R10/R12 |
| `fromRefs[]` / `toRefs[]`, con `provenance=declaredRelation` | `interfaceId` | endpoints de relación declarada |
| `fromRefs[]` / `toRefs[]`, con `provenance=candidatePath` | `nodeId` | endpoints del grafo candidato |

Los arrays `requirement.sourceRefs[]`, `declaredInteraction.sourceRefs[]`,
`candidateEvidenceRefs[]` y `support/transfer.sourceRefs[]` conservan provenance heterogénea sin un
discriminador por item. No se les asignará dominio por prefijo, regex o búsqueda en colecciones:
seguirán siendo evidencia auditable, pero no expandirán por sí solos la conectividad. `evidence`,
`provenance` y `supportEvidence` tampoco contienen referencias conectivas adicionales.

## Impacto

Una colisión cross-domain puede incorporar paths y roofs ajenos, alterar la clausura y producir un
blocker falso o contaminar el effective input. No se ha demostrado mutación de autoridades ni
promoción de `notVerified`, pero la separación semántica exigida por B2 queda incompleta.

## Corrección requerida

- representar internamente cada referencia como dominio explícito más valor original;
- comparar sólo referencias del mismo dominio y conservar diferente string/número mediante el
  token canónico del valor;
- mantener los extractores allowlist B2.2 y el punto fijo B2.1;
- no derivar dominios desde prefijos, contenido, regex, valores o coincidencias incidentales;
- conservar provenance polimórfica no tipada sin usarla para conectividad;
- demostrar mediante reversión que `elementId=7001` no conecta con `roofGeometryId=7001`, mientras
  `elementId=7001` sí conecta con `targetElementId=7001`.

## Norma contractual

Una referencia dentro de `scopeClosure` tiene identidad compuesta por su dominio contractual y su
valor canónico. Dos referencias con el mismo valor pero dominios diferentes no son equivalentes y
no crean conectividad entre sí. La coincidencia de strings o números nunca basta.

## Fronteras

- no alterar punto fijo, allowlist, fail-closed, canonicalización, pureza ni ciclos finitos;
- no introducir blockers excluidos en `constructive-effective-input-v1.0`;
- no cambiar `scope all`, `notVerified` ni FX-008;
- no implementar B3, adapter, biblioteca productiva, generation, hashes, freshness, receipt,
  coverage, UI, store, SPEC-016-B/C o Metalcon.

## Criterio de cierre

La conectividad usa exclusivamente identidades `domain + value`; el corpus adversario elimina
colisiones entre element/roof/node/boundary, conserva enlaces dentro del mismo dominio, punto fijo,
ciclos, permutación, effective input y FX-008, y todos los gates B2.3 quedan verdes.

## Cierre

La correctiva B2.3 reemplazó la colección conectiva global por referencias tipadas cuyo índice
canónico preserva `domain + value`, sin alterar la clausura a punto fijo ni la allowlist de campos
reference-bearing. Los arrays polimórficos sin discriminador continúan como provenance auditable y
no crean conectividad por prefijo, contenido o coincidencia incidental.

### Evidencia de reversión y correctiva

- antes del fix: focal B2 acumulativo `43/44 PASS`, `1 FAIL`; `elementId=7001` alcanzaba
  incorrectamente un path cuyo único valor coincidente era `roofGeometryId=7001`;
- después del fix: focal B2/B2.1/B2.2/B2.3 `54/54 PASS`;
- `elementId=7001` y `roofGeometryId=7001` no conectan;
- `elementId=7001` y `targetElementId=7001` sí conectan por compartir el dominio contractual;
- string y número se conservan como identidades distintas salvo definición contractual contraria;
- la cadena transitiva de más de tres saltos, los ciclos tipados y las permutaciones incidentales
  alcanzan el mismo punto fijo determinista.

### Evidencia real y fronteras

FX-008 conserva 45 muros, 43 vanos, 32 fundaciones, 7 cubiertas, 9 requirements y
`verification=notVerified`. El scope lateral alcanza únicamente
`roofGeometryIds=[1785158713616]`, excluye diagnósticamente los 5 blockers de cubiertas ajenas,
mantiene 0 blockers relevantes y produce un effective input sin blockers excluidos. La variante
intersectante bloquea y la variante irresoluble aplica fail-closed. Ningún ID FX-008 está
hardcodeado en el motor productivo.

### Gates observados

- regresión B1/B2/SPEC-015-E: `102/102 PASS`;
- suite Node: `1098/1098 PASS`;
- componentes: `49/49 PASS`;
- Rust: `9/9 PASS` y `tauri:check` PASS;
- laboratorio: `35/35 PASS`;
- cobertura: core `92.27 %` líneas y store `92.37 %` líneas;
- 19 goldens verificados sin actualización;
- DXF: 14 archivos, 0 errores y 0 reparaciones;
- CalculiX: `3/3 PASS`;
- build PASS;
- migración: 187 archivos y 2 fixtures;
- artefactos: 767 archivos inspeccionados;
- derivados: 14 exportadores y 14 mutadores;
- auditoría Codex PASS;
- gobernanza: 22 archivos, 53 requisitos y 64 decisiones;
- `npm run validate` y `git diff --check`: PASS.

BUG-016-A-004 queda cerrado. B2/B2.1/B2.2/B2.3 permanece pendiente de revisión humana y no
autoriza B3.
