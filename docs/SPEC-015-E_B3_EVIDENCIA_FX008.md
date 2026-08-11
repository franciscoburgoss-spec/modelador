# SPEC-015-E — B3 evidencia real FX-008

## Objetivo

Aplicar el núcleo R6–R12 de B2 al caso real FX-008 y producir evidencia auditable sin integrar UI
productiva, sin persistir derivados y sin seleccionar ninguna solución constructiva.

## Artefactos

`evidence/spec-015-e/` contiene:

- `FX-008-SPEC-015-E.json`: evidencia estructurada y hashes;
- `FX-008-SPEC-015-E.svg`: lámina de auditoría con planta real, B1, C/6, C/7 y gap lateral;
- `FX-008-SPEC-015-E.html`: revisión interactiva accesible por focos;
- `MANIFEST.json`: bytes y SHA-256 de los tres artefactos.

El generador autoritativo de esta evidencia es `scripts/generate-spec015e-evidence.mjs`.

## Invariantes reproducidas

- 45 muros / 43 vanos / 32 fundaciones / 7 cubiertas;
- 8 interfaces / 5 relaciones REV8;
- 4 caminos gravitacionales ligados a relaciones, todos `completeCandidate` y `notVerified`;
- checkpoint sin intención lateral: 0 caminos laterales y `lateralStatus=notDeclared`;
- B1 físico `S 12800→23200` = 10.400 mm;
- B1 interacción `S 12800→14500` = 1.700 mm;
- frontón `S 12800→14500 · Z 3250→4150`;
- C/6 `S 1949.45→2050.55 · Z 3250→4150`;
- C/7 `end=highS · anchorS=2000 · Z 3250→4150`; `S 1999.9→2000` se conserva sólo como `localizationEnvelope` de tolerancia;
- escenario lateral explícito: gap 571,429 mm y `SR-LOAD-TRANSFER-REQUIRED`;
- `supportedByFoundation` permanece `candidateSupportEvidence`;
- ninguna salida crea `verified`;
- el localizador de evidencia restaura vista/selección y no cambia historia, trace ni intención.

## Elegibilidad

La evidencia muestra el estado global real del contrato generado. La existencia de un requisito lateral
con origen/destino identificables no borra otros bloqueos del modelo. Si la cobertura de intención de
techumbre permanece incompleta, `eligibleForConstructiveSolutions` puede seguir en `false` y debe
explicarse mediante `blockingDecisions`/`reasonCodes`.

## Procedencia REV8

Ver `docs/H-015-E-B3-001_CHECKPOINT_REV8_BROWSER_NO_VERSIONADO.md`. El contador final
`Propuestas=0` se conserva como referencia documental del cierre, no como un valor que B3 pueda
recalcular desde un snapshot inexistente.

## Validación focal

```bash
node scripts/generate-spec015e-evidence.mjs
node --test tests/spec015eEvidence.test.mjs
```

La prueba de evidencia exige determinismo, coincidencia con el golden versionado, localizaciones parciales discriminadas (`range|end`),
no mutación del localizador y ausencia de solución constructiva.

## B3.1 — correctiva de revisión visual

La inspección humana de B3 registró `BUG-015-E-003` a `BUG-015-E-007`. B3.1 corrige únicamente la evidencia derivada:

- anotaciones en franja exterior con líderes, sin texto sobre la geometría;
- foco por halo sin reemplazar el trazo fuente;
- detalles C/6 y C/7 explícitamente `AMPLIADO · NO A ESCALA` con cotas exactas;
- descriptor humano primero y referencia técnica secundaria en lateral;
- G1–G4 inspeccionables individualmente con origen, transferencia local, receptor y fundación candidata.

El núcleo `src/core/structuralRequirements.js`, store, UI productiva, persistencia y soluciones constructivas permanecen fuera de esta correctiva.


## B3.2 — extremo C/7 y referencias estructurales

La revisión posterior a B3.1 registró `BUG-015-E-010` y `BUG-015-E-011`. B3.2 corrige el significado de C/7 sin modificar REV8:

- C/6 permanece `range S 1949.45→2050.55` (`L=101,1 mm`);
- C/7 pasa a `end=highS`, `anchorS=2000`;
- `localizationEnvelope=[1999.9,2000]` queda visible sólo como tolerancia de localización y nunca como `L=0,1 mm`;
- `supports[]` / `transfers[]` declarados referencian R11 mediante `targetRegionRefs[]`;
- el overlap de `candidatePath` permanece en `evidence.overlapRange` como evidencia candidata.

## B3.2.1 — legibilidad del detalle C/7

La revisión visual de B3.2 registró `BUG-015-E-012`: la semántica del extremo era correcta, pero las
líneas largas del inset C/7 excedían el ancho disponible del SVG.

La correctiva mantiene intactos `anchorS=2000` y `localizationEnvelope=[1999.9,2000]`, y divide la
lectura en líneas explícitas: extremo, localización, tolerancia + banda Z y advertencia
`La envolvente NO es longitud física`. La evidencia estructurada no cambia; sólo mejora la
composición visual auditable.
