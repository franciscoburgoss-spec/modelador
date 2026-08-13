# BUG-016-A-003 — Heurística textual en scope closure B2

## Estado

CERRADO — 12-ago-2026.

## Hallazgo

La clausura a punto fijo incorporada por BUG-016-A-002 usa `collectReferenceStrings()` para tratar
como referencia cualquier string que contenga `:` y recorre objetos mediante `Object.values()`.
Esta heurística puede crear conectividad desde texto descriptivo, evidence o metadata que no son
campos reference-bearing del contrato `structural-requirements-v1.0`.

## Contrato real inspeccionado

La condición de referencia pertenece al schema y al campo, nunca al contenido del valor:

| Entidad | Campos reference-bearing | Datos que no crean conectividad |
|---|---|---|
| requirement | `id` como identidad; `targetRegionRef`; `sourceRefs[]` | `code`, `kind`, `graph`, `verificationState`; `evidence.gapMm` |
| region | `regionId` como identidad; `ownerRef.id`; `topologicalBoundaries[].nodeId`; `activeOpenings[]`; `candidateEvidenceRefs[]`; `requirementRefs[]`; `declaredInteractions[]` | localización, rangos, `zBands`, funciones y `verificationState` |
| declaredInteraction | `relationId`; `interfaceId`; `sourceRefs[]` | `interactionRole`, `actionFamily`, `structuralFunction` |
| path | `pathId` como identidad; `sourceRefs.proposalId`; `sourceRefs.relationId`; `sourceRefs.roofGeometryId`; `sourceRefs.targetElementId`; `sourceRefs.boundaryId` | `sourceRefs.direction`, `candidateState`, `confidence`, `edgeKinds`, `findings`, `verificationState` |
| support / transfer | `id` como identidad; `fromRefs[]`; `toRefs[]`; `targetRegionRefs[]`; `sourceRefs[]` | `graph`, `structuralFunction`, `certainty`, `verificationState` |
| evidence | ningún campo reference-bearing en v1.0 | `gapMm`, `overlapRange` |
| provenance | ninguno; es un enum de origen | `declaredRelation`, `candidatePath` |
| supportEvidence | ninguno; es una clasificación de evidencia candidata | `candidateSupportEvidence` |

Los IDs de owner/geometry permitidos por sus campos tipados pueden ser strings o números. Sólo se
registran cuando aparecen en esos campos reference-bearing; ningún número o string se convierte en
referencia por su forma.

## Impacto

Un texto no autoritativo que coincida con un path, support, transfer, relation o interface ID puede
expandir el cierre, incorporar geometría o contexto ajeno y alterar elegibilidad/effective input.
El defecto no ha mutado geometría, intención, topología, requisitos ni verificación, pero rompe la
frontera allowlist exigida por B2.

## Corrección requerida

- reemplazar la búsqueda recursiva heurística por extractores explícitos por entidad y contrato;
- conservar la clausura transitiva hasta punto fijo, ciclos finitos, pureza y canonicalización;
- soportar referencias string o numéricas sólo desde campos tipados;
- demostrar que texto/evidence descriptivo no expande el cierre aunque coincida byte a byte con un
  ID real;
- demostrar que los mismos valores sí conectan cuando ocupan campos reference-bearing;
- conservar FX-008, fail-closed y el aislamiento de blockers excluidos.

## Frontera normativa

La conectividad de `scopeClosure` se deriva exclusivamente de campos contractualmente definidos
como referencias. El contenido textual de un campo no reference-bearing nunca crea conectividad,
aunque coincida con la representación de un ID válido.

## Fronteras

- no cambiar la semántica de punto fijo de BUG-016-A-002;
- no cambiar `constructive-effective-input-v1.0`, scope `all`, allowlist o `notVerified`;
- no implementar adapter, generación, hashes, freshness, receipt, coverage, UI, store o historia;
- no iniciar B3 ni SPEC-016-B/C.

## Criterio de cierre

La clausura sólo crece desde campos reference-bearing allowlisted; el corpus adversario distingue
texto/datos de referencias reales, conserva cadenas de más de tres saltos y referencias numéricas,
y mantiene verdes FX-008, blockers intersectantes/irresolubles y todos los gates B2.2.

## Resolución

`src/core/constructiveScenarioContext.js` reemplaza `collectReferenceStrings()` y el recorrido
indiscriminado por extractores allowlist específicos para requirement, region,
declaredInteraction, path y support/transfer. La clausura transitiva a punto fijo de B2.1 se
conserva; sólo campos reference-bearing del contrato pueden incorporar IDs string o numéricos.

La prueba de reversión previa produjo `39/42 PASS` y tres fallos: texto de evidence alcanzaba un
path, cambiar texto descriptivo alteraba la clausura y el caso contractual no aislaba el path
esperado. Con la correctiva aplicada:

- focal B2/B2.1/B2.2: `43/43 PASS`;
- regresión B1/B2/SPEC-015-E: `91/91 PASS`;
- Node: `1087/1087 PASS`;
- componentes: `49/49 PASS`;
- Rust: `9/9 PASS`;
- lint: PASS;
- format: PASS sobre 679 archivos;
- goldens: 19 verificados, sin actualización;
- DXF: 14 archivos, 0 errores y 0 reparaciones;
- CalculiX: 3/3 PASS;
- build: PASS, con el warning heredado de chunks mayores a 600 kB;
- migración: 187 archivos, 129 idénticos, 58 cambios registrados y 2 fixtures;
- artefactos: 766 archivos inspeccionados;
- gobernanza: 22 archivos, 53 requisitos y 64 decisiones;
- `git diff --check`: PASS;
- `npm run validate`: PASS, exit code 0.

No se modificaron geometry, structuralIntent, interfaces, relations, candidate paths,
structural-requirements-v1.0 ni legacy Metalcon. No se implementaron adapter, generation, hashes,
freshness, receipt, coverage, UI, store, SPEC-016-B/C ni B3.

BUG-016-A-003 queda cerrado. B2/B2.1/B2.2 permanece pendiente de revisión humana y no autoriza B3.
