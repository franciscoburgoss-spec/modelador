# Sesión de implementación — SPEC-016-A

**Estado:** abierta; B1/B1.1 aprobados y cerrados; B2 aprobado y cerrado por revisión humana tras B2-CLOSE.
B3 y cortes posteriores no autorizados.

## Objetivo

Introducir una capa persistente de escenarios constructivos aislados que consuma una proyección
efectiva de `structural-requirements-v1.0`, produzca soluciones derivadas no persistentes y conserve
intactas las autoridades de SPEC-015-E y todo el legacy Metalcon.

## Esfuerzo

- planificado: `high`
- efectivo al abrir la sesión: `high`
- escalamiento: no usado; `xhigh` prohibido

## Baseline de apertura

- rama: `main`
- commit corto: `6afcb46`
- commit completo: `6afcb46d127b9db6bc7387555ff2d43fd6e0b2f2`
- upstream: `origin/main`, sin divergencia al abrir
- working tree inicial: limpio
- toolchain gobernado disponible mediante `.nvmrc`: Node 22.23.2 / npm 10.9.9
- suite heredada oficial: SPEC-015-E focal 27/27; Node 1023/1023; componentes 49/49; Rust 9/9;
  lab 35/35; CalculiX 3/3
- `make governance` previo: PASS, 22 archivos requeridos / 50 requisitos / 61 decisiones
- ninguna operación Git de escritura ejecutada

## Salvedad operativa de apertura

`governance/PROTOCOL.md` contempla crear una rama `spec/...`, pero este gate prohíbe toda operación
Git de escritura. Por ello no se creó ni cambió ninguna rama: el corte documental permanece como
working tree de `main`, pendiente de la decisión y ejecución Git manual del usuario. Esta salvedad
no autoriza implementación ni reduce los gates posteriores.

La shell inicial exponía Node 20.20.2; no se usó para validar la apertura final. El gate documental
se ejecuta tras activar la versión fijada por `.nvmrc`: Node 22.23.2 / npm 10.9.9.

## Autoridades congeladas

1. `agnostic-geometry-v1.0`: autoridad física.
2. R0–R5: topología estructural derivada.
3. R6–R12: integración, clasificación y requisitos estructurales derivados.
4. `structural-requirements-v1.0`: contrato derivado resultante, no persistente y `notVerified`.
5. `structuralIntent` v1.1 e interfaces/relaciones: autoridad humana persistente.
6. proposals/reviews/candidateLoadPaths: evidencia no autoritativa.
7. escenarios: autoridad limitada a identidad, metadata, lifecycle, refs, configuration, scope y
   assignments; nunca autoridad de geometría, intención, topología, requisitos o verificación.

## Contrato aprobado de Fase A

- `modelVersion: 4` con migración v3→v4 pura, determinista, idempotente y sin pérdida legacy;
- IDs secuenciales y allocators persistentes restaurados con undo/redo;
- scope `all|requirements`, no vacío, cierre trazable y blocker indeterminado fail-closed;
- effective input mínimo construido por el scenario engine;
- adapter neutral sin acceso a autoridades completas, store, UI, Metalcon u OSB;
- assignments anclados a requirements y biblioteca exacta;
- output constructivo derivado/no persistente y receipt persistente;
- `resolved != verified`; sólo `verificationState=notVerified`;
- dimensiones separadas lifecycle/coverage/freshness/verification/execution;
- `effectiveGenerationInputSha256`, incluido scenarioId, como única autoridad fresh/stale;
- subfingerprints efectivos y provenance global sólo como evidencia diagnóstica;
- FX-008 real con escenarios A/B sobre scope lateral, gap 571,429 mm y blockers de cubierta
  excluidos únicamente por prueba tipada.

## Prohibiciones de la sesión

- no avanzar fuera del corte B1 autorizado ni iniciar B2 automáticamente;
- no abrir ni adelantar SPEC-016-B/C;
- no migrar, borrar o reinterpretar wallTypes, wallTypeId, perfiles, studs, OSB o modulación;
- no persistir generatedSolution ni derivados R6–R12;
- no entregar structuralIntent, topología completa, store o UI al adapter;
- no inferir independencia de blockers mediante geometría o texto;
- no convertir resolved/complete/candidate en verified;
- no usar hashes globales para freshness;
- no ejecutar Git de escritura, mutaciones npm ni npx.

## Gate documental de apertura

Este corte sólo reescribe y congela la SPEC, registra D-062/D-063/D-064, R-034/R-035/R-036,
REQ-DOM-011/012 y REQ-UX-005, actualiza STATUS/manifiesto y abre esta sesión. Debe pasar:

- `make governance` con Node 22.23.2;
- `git diff --check`;
- inspección de diff y status.

Después se detiene para revisión humana. Ningún gate verde autoriza Fase B automáticamente.

## Primer corte técnico futuro

Sólo tras autorización de Fase B: comenzar por schema/modelVersion 4, migración y dominio puro de
escenarios/assignments con pruebas de pérdida, determinismo, historia y reversión. UI, adapter y
evidencia FX-008 se integran en gates posteriores; SPEC-016-B/C permanecen fuera de alcance.

## Fase B — corte B1

Autorizado e implementado el 11-ago-2026 con el alcance exclusivo de:

- `modelVersion: 4` y migración directa v3→v4 que cambia únicamente la versión y añade la raíz
  inicial `constructiveSolutions`;
- schema, validación y canonicalización de la autoridad persistente de escenarios;
- dominio puro de escenarios y assignments con allocators secuenciales deterministas;
- crear, duplicar, renombrar, configurar, archivar/desarchivar y eliminar escenarios;
- crear, actualizar y eliminar assignments, con no-op semántico y sin reutilización de IDs;
- inicialización mínima de la raíz v4 en el store, sin acciones de escenarios ni integración de
  undo/redo.

Permanecen expresamente fuera de B1: eligibility, blockers, effective input, adapters, bibliotecas,
generación, freshness, UI, evidencia FX-008 de SPEC-016-A y toda implementación de SPEC-016-B/C.

### Evidencia B1

- Node 22.23.2 / npm 10.9.9;
- suite focal de dominio/migración: 17/17 PASS;
- cobertura focal de `constructiveSolutionScenarios.js`: 88,84 % líneas, 69,19 % ramas y 97,10 %
  funciones;
- regresión relacionada de schema, persistencia, store y goldens: 55/55 PASS;
- componentes: 49/49 PASS;
- lint: PASS;
- formato: PASS, 674 archivos;
- goldens semánticos: PASS, 19 artefactos;
- build: PASS, con el warning heredado de chunks mayores a 600 kB;
- gobernanza: PASS, 22 archivos requeridos, 53 requisitos y 64 decisiones.

La prueba de reversión de B1 demuestra que alterar un campo legacy durante la migración rompe la
comparación profunda de pérdida cero. El fixture real FX-008 REV8 conserva 45 muros, 43 vanos,
32 fundaciones, 7 cubiertas, `wallTypes`, `wallTypeId`, defaults Metalcon/OSB, intención v1.1,
interfaces, relaciones y el resto de campos persistentes.

### Límite de historia

B1 no añade acciones de escenarios al store. La integración futura de undo/redo requiere que cada
operación aplique, dentro de una única transacción histórica, la raíz `constructiveSolutions`
completa junto con sus allocators. Un resultado semánticamente idéntico debe omitir la transacción.
Este contrato se registra sin ampliar B1.

### Divergencia heredada detectada y no corregida

La regresión Node completa resulta 1039/1040: falla únicamente
`SPEC-015-C: evidencia FX-008 es reproducible, completa y byte-identical`. Su generador reabre el
documento mediante el importador nativo actual; al migrar ahora a v4 obtiene `modelVersion: 4` y la
comparación contra el estado histórico v3 deja de ser byte-identical, mientras la evidencia cerrada
almacenada conserva literalmente `modelVersion: 3` y `deepEqual: true`.

No se modificaron el generador, el test ni la evidencia histórica de SPEC-015-C porque B1 excluye
actualizar evidencia FX-008 y los cierres son inmutables. La suite relacionada con la nueva
persistencia v4 sí pasa. Este hallazgo requiere decisión humana antes de una correctiva separada; no
autoriza B2 ni altera la evidencia histórica por iniciativa propia.

## Correctiva B1.1 — BUG-016-A-001

La revisión humana de B1 detectó aliases de IDs, orden textual, migración directa no fail-closed,
duplicados semánticos persistibles y una frontera B1/B2 insuficientemente explícita. La correctiva
se registró antes del fix en
`docs/BUG-016-A-001_CONTRATOS_CANONICOS_Y_REGRESION_EVIDENCIA_B1.md`.

### Frontera de validación persistente

B1/B1.1 valida sólo lo demostrable desde el documento: schemas, IDs/namespaces canónicos,
allocators, pertenencia de assignments, formato y pertenencia declarativa de requirementRef,
estructura de targetRef, coincidencia local de library id/version, JSON finito, duplicados y
canonicalización.

B2 deberá resolver contra contexto vivo la existencia de requirements, compatibilidad real de
regiones, existencia de componentTypeId en la biblioteca exacta y demás referencias contextuales.
Una referencia que dejó de resolver permanece abrible y no se repara heurísticamente; después se
clasificará como stale/broken/unavailable según el contrato correspondiente.

### Evidencia histórica SPEC-015-C

El diagnóstico B1.1 confirmó que el generador construye directamente un `finalModel` v3 desde el
fixture y operaciones originales. La incompatibilidad aparece únicamente porque su roundtrip
invoca el serializador/importador nativo vivo, que ahora migra a v4. B1.1 fija dentro del generador
un roundtrip JSON histórico explícito que exige v3, sin migración inversa ni heurística. Los tres
artefactos cerrados y sus SHA deben permanecer byte a byte intactos; la prueba reproducible decide
si esta ruta es aceptable antes de cerrar el BUG.

### Resultado B1.1

La identidad decimal queda canónica, el orden se calcula por ordinal numérico, la migración directa
v3→v4 falla cerrada ante colisión o versión ajena y el validador rechaza duplicados semánticos
persistidos. La ruta histórica SPEC-015-C reproduce directamente su contrato v3 original y conservó
byte-identical el JSON, HTML y manifiesto cerrados, sin migración inversa ni actualización de
evidencia.

Evidencia final: focal B1/B1.1 32/32, Node 1044/1044, componentes 49/49, Rust 9/9, goldens 19/19,
DXF 14 archivos con 0 errores/0 reparaciones, CalculiX 3/3, build PASS, migración 187 archivos y 2
fixtures, gobernanza 22/53/64 y `npm run validate` PASS. El primer intento focal detectó que la
validación del candidato ocurría antes del no-op semántico; se corrigió el orden. El primer validate
detectó el hash no registrado de `src/store/useModelStore.js`; se registró como cambio SPEC-016 en
el manifiesto oficial y la repetición integral pasó.

BUG-016-A-001 queda cerrado. Este resultado no autoriza B2.

## Fase B — corte B2

B2 añade exclusivamente `src/core/constructiveScenarioContext.js`, un módulo puro entre escenarios
persistentes y el futuro adapter. No integra store, acciones, UI, biblioteca productiva, adapter,
generation, receipt operativo, hashes de generación ni freshness.

### APIs y schemas

- `buildConstructiveScopeClosure(structuralRequirements, requirementIds)` →
  `constructive-scope-closure-v1.0`;
- `evaluateConstructiveScopeEligibility(structuralRequirements, scope)` →
  `constructive-scope-eligibility-v1.0`;
- `evaluateConstructiveScenarioContext({ scenario, structuralRequirements, geometry,
  libraryContext })` → `constructive-scenario-context-evaluation-v1.0`;
- `projectEffectiveConstructiveInput(...)` → `constructive-effective-input-v1.0` con
  `effective-constructive-geometry-v1.0` y `effective-structural-requirements-v1.0`.

La clausura conserva requirements, regiones/owners, provenance, paths/supports/transfers y
referencias gobernantes tipadas. Los blockers sólo se excluyen con
`typed-disjoint-reference-closure`; intersección o dominio irresoluble bloquean. La proyección se
construye por allowlist y no entrega autoridades completas.

### Caso real FX-008

El test reproduce 45 muros, 43 vanos, 32 fundaciones, 7 cubiertas, 9 requirements, 5 blockers y
`notVerified`. Los requirements laterales `21de8089…a2331` y `f6ee85b8…7a84` alcanzan la región
`60290050…e3e`, el path lateral y el roof `1785158713616`. Los cinco blockers declaran roofs
distintos y se excluyen mediante disjunción tipada; una variante intersectante y otra con dominio
irresoluble bloquean fail-closed.

### Evidencia focal

- focal B2: 26/26 PASS;
- regresión relacionada B1/B2/SPEC-015-E: 63/63 PASS;
- regresión ampliada B1/B2/SPEC-015-E y evidencia visual: 74/74 PASS;
- inputs congelados y comparación profunda: sin mutación;
- campo upstream desconocido: no atraviesa la allowlist;
- store/UI/React/Three/Metalcon/OSB/adapters: sin imports productivos.

### Gates integrales B2

- Node 22.23.2 / npm 10.9.9;
- `npm test`: 1070/1070 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS, con warning heredado de incompatibilidad futura de `block v0.1.6`;
- lint y formato: PASS; formato verificó 677 archivos;
- goldens semánticos: 19/19 PASS, sin actualización;
- DXF: 14 archivos, 0 errores y 0 reparaciones;
- CalculiX: 3/3 PASS, con un warning reportado por el smoke existente;
- build: PASS, con warning heredado de chunks mayores a 600 kB;
- migración: 187 archivos, 129 idénticos al origen, 58 cambios registrados y 2 fixtures;
- artefactos: 764 archivos fuente/documentales inspeccionados, sin artefactos baseline;
- derivados: contrato válido para 14 exportadores y 14 mutadores;
- auditoría Codex: 11 ejecuciones completas, 2 fallidas recuperadas y 0 no recuperadas;
- gobernanza: 22 archivos requeridos, 53 requisitos y 64 decisiones;
- `npm run validate`: PASS, exit code 0;
- `git diff --check`: PASS.

B2 queda implementado y con gates completos, pendiente de revisión humana. No autoriza B3.

## Correctiva B2.1 — BUG-016-A-002

La revisión humana de B2 confirmó que la primera clausura realizaba una sola pasada y que
`projectEffectiveConstructiveInput()` transportaba `scopeEligibility` completo, incluidos blockers
demostrablemente excluidos. El defecto se registró antes del fix en
`docs/BUG-016-A-002_CLAUSURA_TRANSITIVA_Y_AISLAMIENTO_EFFECTIVE_INPUT_B2.md`.

La correctiva calcula un punto fijo finito sobre regions, source refs, paths, supports y transfers.
Cada entidad alcanzada aporta sólo referencias explícitas y puede habilitar la siguiente iteración;
sets deduplicados garantizan terminación con ciclos y la canonicalización mantiene determinismo.
Los traces se resuelven desde cada requirement para conservar provenance transitiva precisa.

La salida diagnóstica de eligibility mantiene blockers relevantes/excluidos. El paquete consumible
`constructive-effective-input-v1.0` elimina el objeto completo de eligibility y conserva sólo
`relevantBlockingDecisionContext` dentro de requirements efectivos. No se introdujo
`constructive-adapter-input-v1.0`, adapter, generación, hash, freshness, receipt, store ni UI.

### Evidencia previa de reversión

Antes del fix, el nuevo corpus produjo 29/36 PASS y 7 FAIL: clausuras de dos y más de tres saltos,
roof indirecto, ciclo, contaminación del paquete, deepEqual ante blocker ajeno y conteo FX-008.
Después de la corrección focal, los mismos 36/36 pasan. La regresión relacionada B1/B2/SPEC-015-E
produce 73/73 PASS y la ampliada con evidencia visual 84/84 PASS.

### Gates finales B2.1

- focal B2/B2.1: 36/36 PASS;
- regresión B1/B2/SPEC-015-E: 73/73 PASS;
- regresión ampliada con evidencia visual: 84/84 PASS;
- `npm test`: 1080/1080 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS, con warning heredado de `block v0.1.6`;
- lint, format, build y `git diff --check`: PASS;
- goldens: 19/19 PASS sin actualización;
- DXF: 14 archivos, 0 errores y 0 reparaciones;
- CalculiX: 3/3 PASS, con un warning heredado del smoke;
- migración: 187 archivos, 129 idénticos al origen, 58 cambios registrados y 2 fixtures;
- gobernanza: 22 archivos requeridos, 53 requisitos y 64 decisiones;
- `npm run validate`: PASS, exit code 0.

BUG-016-A-002 queda cerrado el 12-ago-2026. B2/B2.1 permanece pendiente de revisión humana y no
autoriza B3.

## Correctiva B2.2 — BUG-016-A-003

La revisión humana detectó que `collectReferenceStrings()` todavía infería conectividad desde
cualquier string con `:` y recorría objetos sin conocer el schema. El defecto se registró antes del
fix en `docs/BUG-016-A-003_HEURISTICA_TEXTUAL_EN_SCOPE_CLOSURE_B2.md`.

La correctiva reemplaza esa heurística por extractores allowlist de requirement, region,
declaredInteraction, path y support/transfer. `evidence.gapMm`, `evidence.overlapRange`, texto
descriptivo, `provenance` y `supportEvidence` no crean enlaces. Sólo campos tipados incorporan
referencias string o numéricas; el punto fijo, canonicalización, ciclos y fail-closed de B2.1 se
mantienen sin cambio.

### Reversión previa

El corpus nuevo produjo 39/42 PASS y 3 FAIL antes del fix: un path se alcanzaba desde texto de
`evidence`, cambiar texto descriptivo cambiaba el cierre y la referencia contractual no aislaba el
path esperado. Después del fix, el focal B2/B2.1/B2.2 produce 43/43 PASS y la regresión estructural
B1/B2/SPEC-015-E 91/91 PASS.

Los gates finales quedaron verdes: Node 1087/1087, componentes 49/49, Rust 9/9, lint, format sobre
679 archivos, 19 goldens sin actualización, DXF 14 con 0 errores/0 reparaciones, CalculiX 3/3,
build, migración 187/2, 766 artefactos inspeccionados, gobernanza 22/53/64, `git diff --check` y
`npm run validate` con exit code 0. BUG-016-A-003 queda cerrado el 12-ago-2026.

B2/B2.1/B2.2 permanece pendiente de revisión humana. No autoriza B3.

## Correctiva B2.3 — BUG-016-A-004

La revisión humana confirmó que B2.2 almacenaba referencias allowlisted en un `Map` global por
`idToken(value)` y perdía el dominio contractual. El BUG se registró antes del test y del fix en
`docs/BUG-016-A-004_COLISIONES_CROSS_DOMAIN_SCOPE_CLOSURE.md`.

La correctiva representa internamente cada referencia como `{ domain, value }`, indexada por
dominio más el token tipado del valor. Los extractores asignan dominios sólo desde el campo:
element, roof, boundary, node, region, requirement, path, support, transfer, relation, interface,
proposal u opening. `fromRefs/toRefs` se discriminan exclusivamente por `provenance` contractual;
arrays polimórficos sin discriminador conservan provenance pero no crean conectividad.

### Reversión previa

Antes del fix, el focal produjo 43/44 PASS y 1 FAIL: `region.ownerRef.id=7001` alcanzaba un path
ajeno cuyo único valor coincidente era `sourceRefs.roofGeometryId=7001`. Con la representación
tipada, ese caso no conecta, mientras `targetElementId=7001` sí conecta con `elementId=7001`.

El corpus acumulativo B2/B2.1/B2.2/B2.3 produce 54/54 PASS y la regresión estructural
B1/B2/SPEC-015-E 102/102 PASS. La suite Node produce 1098/1098 PASS; componentes 49/49; Rust 9/9;
laboratorio 35/35; cobertura core 92,27 % y store 92,37 %; 19 goldens se verifican sin
actualización; DXF audita 14 archivos con 0 errores/0 reparaciones; CalculiX 3/3; build, migración
187/2, artefactos 767, derivados, auditoría Codex, gobernanza 22/53/64, `git diff --check` y
`npm run validate` quedan verdes. BUG-016-A-004 queda cerrado el 12-ago-2026.

B2/B2.1/B2.2/B2.3 permanece pendiente de revisión humana. No autoriza B3.

## Correctiva B2.4-C — BUG-016-A-005

La decisión humana posterior al RESULTADO C autoriza exclusivamente resolver refs tipadas mediante
un contexto compañero producido en el mismo flujo de `structural-requirements-v1.0`, sin cambiar
ese documento ni iniciar B3. El defecto quedó registrado antes del fix en
`docs/BUG-016-A-005_RESOLUCION_TIPADA_SOURCE_REFS_B2.md`.

### Reversión previa

Con Node 22.23.2 / npm 10.9.9, el focal B2.3 más la regresión P1 produjo `54/55 PASS` y `1 FAIL`.
El cierre actual devolvió `[P1, P2]` para un requirement cuya única `sourceRef` contractual era P1;
P2 entró por compartir `targetElementId=7001`. Esta evidencia se capturó antes de modificar código
productivo.

### Implementación mecánica

`integrateStructuralRequirements()` comparte ahora su productor interno con
`buildStructuralRequirementsWithReferenceResolutionContext()`. La API pública
`buildStructuralRequirements()` continúa devolviendo exactamente el documento
`structural-requirements-v1.0`; el contexto compañero no se incrusta, persiste ni convierte en
autoridad.

El contexto `structural-reference-resolution-context-v1.0` conserva
`sourceRequirementsSha256`, bindings por ocurrencia con `from`, `origin`, `legacyValue`, `to` y
provenance, targets tipados, relaciones `candidateEdgeMemberOfPath` y `canonicalSha256`. B2
verifica primero el fingerprint, mantiene `domain + value` en la clausura, separa
`topologyNodeId/candidatePathNodeId` y `pathId/candidatePathEdgeId`, y falla cerrado mediante reason
codes diferenciados. El contexto completo no atraviesa el effective input.

### Evidencia final B2.4-C

- reversión contra B2.3: `54/55 PASS`, P1 produjo `[P1,P2]`;
- focal B2.4-C: `72/72 PASS`, incluidos P1–P6, T1–T13 y la variante explícita de provenance
  mismatch;
- focal requirements: `11/11 PASS`, incluida invariancia `deepEqual` y SHA v1.0;
- regresión B1/B2/SPEC-015-E usada en B2.3 y ampliada: `116/116 PASS`;
- FX-008 alcanza exactamente path `6baec8…5563f` y edge `93dd4a…1dac`, conserva
  `verification=notVerified` y no incorpora un segundo path por target compartido.

Los reason codes observados por regresión son `SCOPE_REF_DOMAIN_UNRESOLVED`,
`SCOPE_REF_DOMAIN_AMBIGUOUS`, `SCOPE_REF_TARGET_UNRESOLVED`, `SCOPE_REF_LINK_UNRESOLVED`,
`SCOPE_REF_PROVENANCE_MISMATCH`, `SCOPE_REF_RESERVED_UNSUPPORTED` y
`SCOPE_REF_CONTEXT_MISMATCH`. La colisión intencional de un mismo `legacyValue` entre dominios
distintos conserva ambos bindings sin producir ambigüedad.

### Gates finales B2.4-C

- `npm test`: Node 1118/1118 PASS y componentes 49/49 PASS;
- Rust 9/9 PASS y `tauri:check` PASS, con warning heredado de `block v0.1.6`;
- laboratorio 35/35 PASS; cobertura core 92,28 % líneas / 80,65 % ramas / 94,24 % funciones y
  store 92,37 % / 80,68 % / 93,33 %;
- formato sobre 682 archivos y lint: PASS;
- goldens semánticos: 19 verificados sin actualización;
- DXF: 14 archivos, 0 errores, 0 reparaciones y 0 fallas de calidad;
- CalculiX 2.23: 3/3 jobs, 1 warning reportado por el smoke existente;
- build Vite: PASS, con warning heredado de chunk mayor a 600 kB;
- migración: 187 archivos, 129 idénticos al origen, 58 cambios registrados y 2 fixtures;
- artefactos: 769 archivos fuente/documentales inspeccionados, sin artefactos baseline;
- derivados: 14 exportadores y 14 mutadores; auditoría Codex: 11 ejecuciones completas, 2
  fallidas recuperadas y 0 no recuperadas;
- gobernanza: 22 archivos requeridos, 53 requisitos y 65 decisiones;
- `git diff --check` y `npm run validate`: PASS, exit code 0.

BUG-016-A-005 queda cerrado técnicamente el 12-ago-2026 para revisión humana. Esto no aprueba B2,
no autoriza B3 y no inicia adapter, generation, receipt, freshness, coverage ni UI.

B2 permanece no aprobado y B3 no está autorizado.

## Correctiva B2.4-C.2 — BUG-016-A-006

La revisión humana detectó contract drift en la API pública histórica
`integrateStructuralRequirements() -> { topology, requirements }`: B2.4-C había añadido
`referenceResolutionContext`. La excepción B2.4-C.2 autoriza restaurar el shape y migrar
exclusivamente el plumbing accidental de los fixtures hacia la API compañera ya aprobada
`buildStructuralRequirementsWithReferenceResolutionContext()`.

El BUG se registró antes de modificar productivo en
`docs/BUG-016-A-006_CONTRACT_DRIFT_API_INTEGRATE_STRUCTURAL_REQUIREMENTS.md`.

### Reversión previa

Con Node 22.23.2 / npm 10.9.9, antes del fix productivo:

```bash
node --test tests/structuralRequirements.test.mjs
```

produjo `12` tests, `11 PASS`, `1 FAIL`, exit code `1`. La assertion exacta de keys esperaba
`['requirements', 'topology']` y observó
`['referenceResolutionContext', 'requirements', 'topology']`. El fallo fue `ERR_ASSERTION` en la
regresión BUG-016-A-006.

### Alcance ejecutado

Se restauró exclusivamente el contrato histórico de `integrateStructuralRequirements()` y se
mantuvo la API compañera tipada. El test B2.4-C de structural requirements y el plumbing global
del fixture de constructive scenario context pasaron a consumir explícitamente
`buildStructuralRequirementsWithReferenceResolutionContext()`.

El cambio productivo exacto fue:

```diff
 export function integrateStructuralRequirements(input) {
-  const { requirements, referenceResolutionContext } = buildStructuralRequirementsProduct(input);
+  const { requirements } = buildStructuralRequirementsProduct(input);
   const topology = completeStructuralTopologyR6R12(input, requirements);
-  return { topology, requirements, referenceResolutionContext };
+  return { topology, requirements };
 }
```

La inspección runtime AFTER-FIX produjo:

```text
integrated keys = ['requirements', 'topology']
integrated hasOwn referenceResolutionContext = false
companion keys = ['referenceResolutionContext', 'structuralRequirements']
requirements deepEqual = true
reference context schema = structural-reference-resolution-context-v1.0
verification = notVerified
```

El test protegido tenía SHA-256
`aedf0642dfb97779452dda59f52dc3863dc88e456c4c822364a699462762fb44` antes de editar y
`024c406f8026bd7963ef817d30fbd9304e5c9ca164fd2155eedbe8bc22940704` después. Su diff contiene
únicamente el reemplazo del import y del plumbing de `test.before`; no cambió ningún `test(...)`,
assert, expected, fixture semántico, helper, dato sintético, P1–P6, T1–T13 ni FX-008.

### Gates B2.4-C.2

Toolchain efectiva de los gates: Node `v22.23.2`, npm `10.9.9`; esfuerzo planificado `high` y
efectivo `high`, sin escalamiento.

| Gate | Resultado real |
|---|---|
| `node --test tests/structuralRequirements.test.mjs` | 12/12 PASS |
| `node --test tests/constructiveScenarioContext.test.mjs` | 72/72 PASS; P1–P6, T1–T13 y FX-008 PASS |
| suite combinada de 3 archivos | 105/105 PASS |
| `git diff --check` | PASS |
| `make governance` | 22 archivos requeridos, 53 requisitos, 65 decisiones |
| `npm test` | Node 1119/1119 y componentes 49/49 PASS |
| `npm run validate` | PASS, exit code 0 |

La validación integral incluyó: formato sobre 683 archivos; lint PASS; Rust 9/9; laboratorio
35/35; cobertura core 92,33 % líneas / 80,60 % ramas / 94,24 % funciones y store 92,37 % /
80,68 % / 93,33 %; 19 goldens verificados sin actualización; DXF 14 archivos, 0 errores, 0
reparaciones y 0 fallas de calidad; CalculiX 2.23 con 3/3 jobs; build Vite PASS; migración 187
archivos (129 idénticos, 58 cambios registrados y 2 fixtures); 770 artefactos inspeccionados;
contrato de derivados 14 exportadores/14 mutadores; auditoría Codex 11 ejecuciones completas, 2
fallidas recuperadas y 0 no recuperadas; gobernanza PASS. Persisten únicamente los warnings
heredados de `block v0.1.6`, el smoke CalculiX y el chunk Vite mayor a 600 kB.

Una repetición auxiliar de cobertura se lanzó inicialmente con el Node predeterminado de una shell
nueva y rechazó las opciones de cobertura; se repitió con `nvm use 22.23.2` y pasó. No produjo
mutación de dependencias ni integra los gates obligatorios, que se ejecutaron completos con la
toolchain requerida.

### Invariancia de cambios preexistentes fuera de allowlist

Los 29 archivos comparados conservaron exactamente sus hashes SHA-256 BEFORE/AFTER:

```text
8020246d5a8fd51e1355e9090ecd1acf86e64a9bef59e281f932f6772787f6b9  governance/DECISIONS.md
c7789d66b52124b4e11fdbf57b30b07027142242a22a644c07dc5e7cb31f5bad  governance/MIGRATION_MANIFEST.json
ec8c788941cf2a90a1c51cd4a55a60242eb481e058f4c50bba80989b7086b6da  governance/RISKS.md
4fef8dc0c8c0219fcd569351ce241ea5f5be69d2b793639eec766275a2204411  governance/STATUS.md
b064bd5d1e264f0a2472707c34a3dc1de41bc256ea254968b24c3c12f312eceb  governance/TRACEABILITY.md
43238b085eec5e9a5a0942ce70d7a5e4eca764c0c588e11238973a8b6cfb3994  harness/fixtures.manifest.json
5695f7e12aa088335ff1ff6910ae3d253893cf9b755087dba2d3d7e2c52e3591  harness/goldens/json.golden.json
cac3810b852e44e7bb8a09a4a7cf4475b43fedb43e026b1e54a62f88f264498a  scripts/generate-spec015c-evidence.mjs
a476afa6e7934575c393cbf5d3ab5374fdafde3dce20afce01b163512c2cc272  specs/MANIFEST.json
2139dc9646de5ca6bfb5affabff53ac1b95844243ae88030e4ed856946432d10  specs/README-SERIE-015-016.md
ff29a935d4257e6668687c0fbad5070225046cf8cdd5371eb46270e6be92b4f1  specs/SPEC-016-A-arquitectura-soluciones-constructivas.md
a3a8310659adfdb2c18670269ae2299d52cdb7e0a43d3e99634b8aa8d6cc28e8  src/core/modelSchema.js
91b72a0c612b854d40eca19dbf8e35a575600988af292ea4f47eb2a4cee032d3  src/store/useModelStore.js
5e6f09880721ac62eac7f7d77d64c82314c8592691d0509ea3c2ce9789f7fce4  tests/fixtureManifest.test.mjs
5ff4f8718148968cdbc02f313403f7c5e0db4ea7e02939963e8f51421ce47bb6  tests/modelSchema.test.mjs
6a19f66b6bc8b7f0fc4a8a2ab123b872df707d65a453bf1162908fb11f267785  tests/nativeProjectFile.test.mjs
3f990ed9e4e27ffd767bccd7e52b1d27724d6af0dedd25c146735b66094520dc  tests/nodeProjectFileSystem.test.mjs
d7a3e4c4a73aaa5c8f2cfb241fde31748214fcda8f09f2925e3874388559d800  tests/projectDocumentStore.test.mjs
ce4d8f68821e74b6c946a42f97b36809049d00e5fd81ef26858a25e6e76bde04  tests/roofStructuralIntentIntegration.test.mjs
f55a641355916945c32bdc3b839f72b70ba08c83fa4021a652390ccae0c84215  tests/structuralIntentIntegration.test.mjs
2001093ea7813c27d0d5f98fe21f7e6528e90d28f2a67c288e7afc0d691d94dd  docs/BUG-016-A-001_CONTRATOS_CANONICOS_Y_REGRESION_EVIDENCIA_B1.md
7e39372cf8fe16f311facf6894d5283b8b3abfeb15e2032526e0b1ce508fc0cb  docs/BUG-016-A-002_CLAUSURA_TRANSITIVA_Y_AISLAMIENTO_EFFECTIVE_INPUT_B2.md
e2d1d4a3030511f6492464ae7510d24871b72606b8b02c13de26871fc60f4824  docs/BUG-016-A-003_HEURISTICA_TEXTUAL_EN_SCOPE_CLOSURE_B2.md
bd19330ad7a7ceed5fdc72c673c437dd5f95f80a2ccb1a4a89e036c2d51fc46a  docs/BUG-016-A-004_COLISIONES_CROSS_DOMAIN_SCOPE_CLOSURE.md
44c79d5c60f5281ad9fff4ddf6bce7de344a2f2a3633a64cbea2fbfb829a6ed7  docs/BUG-016-A-005_RESOLUCION_TIPADA_SOURCE_REFS_B2.md
2733580f6fa5177cbfe3f499b01d503e17fcbea74eaf865531b1f3957357c0b6  src/core/constructiveScenarioContext.js
423b9c6a08e87c34945a29b5874460788d76c5474b8cc3a005c04fc0490ca473  src/core/constructiveSolutionScenarios.js
bf3455411ac3de9fef37eb717d14dd88dda4a3988ea1204a5c3b877a9d63d13b  src/core/structuralReferenceResolutionContext.js
9bba2303d7d709f5127e3dd492f7a28601b93d4613009836cb2e7a6359aca426  tests/constructiveSolutionScenarios.test.mjs
```

Archivos modificados por B2.4-C.2: `src/core/structuralRequirements.js`,
`tests/structuralRequirements.test.mjs`, `tests/constructiveScenarioContext.test.mjs`,
`docs/BUG-016-A-006_CONTRACT_DRIFT_API_INTEGRATE_STRUCTURAL_REQUIREMENTS.md` y esta sesión.

B2.4-C.2 queda completada para revisión humana. B2 no se aprueba automáticamente, B3 no se
inicia, no hubo Git write ni mutación npm.

## Correctiva B2.4-E — BUG-016-A-007/008/009

La decisión humana B2.4-E autoriza exclusivamente declarar `sourceSchema` en el contexto compañero,
impedir que un binding cambie la identidad legacy materializada y agregar múltiples requirements
como unión canónica de sus clausuras individuales. B2 continúa no aprobado y B3 no está autorizado.

Los tres BUG se registraron antes de modificar código productivo:

- `docs/BUG-016-A-007_CONTEXTO_SIN_SOURCE_SCHEMA.md`;
- `docs/BUG-016-A-008_BINDING_LEGACY_TYPED_TARGET_INCONSISTENTE.md`;
- `docs/BUG-016-A-009_SELECTOR_PATH_GLOBAL_SUBCONECTA_SCOPE_MULTI_REQUIREMENT.md`.

### Evidencia BEFORE-FIX

Toolchain: Node 22.23.2 / npm 10.9.9. Cada regresión se ejecutó aisladamente contra el código
productivo B2.4-C/C.2 previo al arreglo y falló con exit code 1:

1. H1: `sourceSchema` actual `undefined`, esperado `structural-requirements-v1.0`.
2. H2: `pathRefs=["P2"]`, `scopeDeterminate=true`, `resolutionDiagnostics=[]`, `eligible=true` y
   `reasonCodes=[]` para `legacyValue="P1" -> pathId:"P2"`.
3. H3: después de demostrar `C(R1)=["P1"]` y `C(R2)=["P2"]`, el agregado observó
   `actual=["P1"]`, `expected=["P1","P2"]`, `scopeDeterminate=true` y diagnostics vacíos.

La implementación productiva comienza únicamente después de esta captura.

### Implementación y resolución T13

H1 añade `sourceSchema: structuralRequirements.schema` al contexto canónico y B2 valida
`context.sourceSchema === structuralRequirements.schema === structural-requirements-v1.0`.
H2 comprueba literalmente `binding.legacyValue === String(binding.to.value)` antes de aceptar el
target. H3 agrega múltiples requirements mediante unión canónica de llamadas individuales, sin
cambiar la precedencia exacta dentro de cada una.

El primer focal AFTER produjo `77/78 PASS`: falló únicamente T13 porque el fixture histórico
declaraba aliases imposibles `SAME -> pathId:P1` y `SAME -> candidatePathEdgeId:E1`. Codex se
detuvo sin debilitar H2. La revisión humana B2.4-E.1 declaró incorrecto ese fixture y autorizó
exclusivamente materializar `SAME -> pathId:SAME` y
`SAME -> candidatePathEdgeId:SAME`, con memberOfPath `SAME -> SAME`.

SHA-256 del test antes de la excepción:
`289aab943f901eb3b2955263915243c85e1fc6a8b69c53b8e3de8bb3064072e0`.
SHA-256 después de la excepción:
`89c297412846e9030673856e803492169ce006d3c8bd4ef876713e74d1d9b612`.
Las assertions continúan exigiendo ausencia de `DOMAIN_AMBIGUOUS`, ahora exigen además ausencia de
`PROVENANCE_MISMATCH`, y comprueban literalmente ambas refs `domain + SAME`. No se modificó H2 ni
se añadió excepción productiva, heurística o alias.

### Focales B2.4-E

- `tests/constructiveScenarioContext.test.mjs`: 78/78 PASS;
- `tests/structuralRequirements.test.mjs`: 13/13 PASS;
- P1–P6, T1–T13, H1/H2/H3, permutation, aggregate/traces y FX-008: PASS.

Los gates integrales y conteos finales se registran después de completar la validación.

### Gates finales B2.4-E

| Gate | Resultado |
|---|---|
| `node --test tests/constructiveScenarioContext.test.mjs` | 78/78 PASS |
| `node --test tests/structuralRequirements.test.mjs` | 13/13 PASS |
| corpus combinado B1/B2/SPEC-015-E de 3 archivos | 112/112 PASS |
| `npm test` | Node 1126/1126 y componentes 49/49 PASS |
| `npm run validate` | PASS, exit code 0 |
| `make governance` | 22 archivos requeridos, 53 requisitos y 66 decisiones |
| `git diff --check` | PASS |

La validación integral B2.4-E usó Node 22.23.2 y npm 10.9.9 e incluyó: formato sobre 686
archivos de texto; lint PASS; Node 1126/1126; componentes 49/49; Rust 9/9; laboratorio 35/35;
cobertura PASS; 19 goldens semánticos verificados sin actualización; DXF 14 archivos con 0
errores, 0 reparaciones y 0 fallas de calidad; CalculiX 2.23 con 3/3 jobs; build Vite PASS;
migración válida de 187 archivos (129 idénticos, 58 cambios registrados y 2 fixtures); 773
archivos fuente/documentales inspeccionados sin artefactos baseline; contrato de derivados con 14
exportadores y 14 mutadores; auditoría Codex con 11 ejecuciones completas, 2 fallidas recuperadas y
0 fallidas no recuperadas; gobernanza PASS. Persisten sólo los warnings heredados de `block
v0.1.6`, el warning permitido del smoke CalculiX y el aviso Vite de chunk mayor a 600 kB.

B2.4-E queda implementada para revisión humana. B2 no se aprueba automáticamente, B3 no se inicia,
no hubo Git write ni mutación npm.

### Resguardo final B2.4-E

- fingerprint `git diff --binary` BEFORE:
  `c2b63acdbb2c77342317aec3f1613c1640af7881d8c12d4fc1aaf6add9662c14`;
- fingerprint `git diff --binary` AFTER:
  `da8e57bcc9f9c2ebe2df13187d595b670b69721188e558dbbd7974a205843f66`;
- SHA-256 final de `tests/constructiveScenarioContext.test.mjs`:
  `89c297412846e9030673856e803492169ce006d3c8bd4ef876713e74d1d9b612`;
- `src/core/structuralRequirements.js` conservó el hash preexistente
  `f6229cda67915db76ee1540db1cdd49ace3d4167621a992a1f66ba151f47b135`;
- todos los archivos preexistentes fuera de la allowlist conservaron individualmente sus SHA-256
  BEFORE/AFTER; no apareció ninguna mutación fuera de alcance.

Archivos modificados o creados por B2.4-E: `src/core/structuralReferenceResolutionContext.js`,
`src/core/constructiveScenarioContext.js`, `tests/structuralRequirements.test.mjs`,
`tests/constructiveScenarioContext.test.mjs`, los BUG `007`, `008` y `009`,
`specs/SPEC-016-A-arquitectura-soluciones-constructivas.md`, `specs/MANIFEST.json`, esta sesión y
`governance/DECISIONS.md`, `governance/STATUS.md`, `governance/TRACEABILITY.md`.

## Cierre humano B2 — B2-CLOSE

Después de B2.4-E/E.1 se ejecutó una auditoría consolidada READ-ONLY de
cierre.

Resultado:

- 28/28 propiedades contractuales obligatorias: PASS;
- `tests/structuralRequirements.test.mjs`: 13/13 PASS;
- `tests/constructiveScenarioContext.test.mjs`: 78/78 PASS;
- corpus combinado B1/B2/SPEC-015-E: 112/112 PASS;
- Node: 1126/1126 PASS;
- componentes: 49/49 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- `npm run validate`: PASS;
- governance: PASS;
- `git diff --check`: PASS;
- workspace READ-ONLY byte-idéntico BEFORE/AFTER.

La aclaración humana posterior al informe B2-CLOSE resolvió la única
ambigüedad restante del resumen:

- `LOAD_TRANSFER_REQUIREMENT` =
  `sr-requirement:sha256:21de80893e8e17b8c329316343ce6a7eb5e4e79441e434badd4a198e4a8a2331`;
- `LATERAL_RESISTANCE_REQUIREMENT` =
  `sr-requirement:sha256:f6ee85b857d00ee783b4bfe3eb2f0c1bb621a0dbe87b14f651cfad12b0767a84`;
- el test FX-008 de path/edge exactos usa explícitamente
  `LOAD_TRANSFER_REQUIREMENT`;
- `scopeRequirements()` incluye ambos requirements por defecto;
- `assignment()` referencia por defecto `LOAD_TRANSFER_REQUIREMENT`.

La frase que llamó a `f6ee…7a84` “requirement lateral gobernante” se
clasifica como **ERROR DE ROTULACIÓN DEL INFORME**, no como defecto del
producto o del contrato.

Decisión humana:

`SPEC-016-A / B2` queda **APROBADO Y CERRADO**.

El último output autorizado continúa siendo
`constructive-effective-input-v1.0`.

B3 continúa **NO AUTORIZADO** y este cierre no autoriza Git de escritura.
