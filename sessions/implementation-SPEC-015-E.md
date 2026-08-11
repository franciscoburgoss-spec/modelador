# Sesión de implementación — SPEC-015-E

**Estado:** abierta; Fase B autorizada por el usuario el 10-ago-2026; contrato congelado antes de
modificar código productivo.

## Objetivo

Completar SPEC-14 R6–R12 y producir `structural-requirements-v1.0` como salida agnóstica,
determinista, no persistente y no verificada, consumiendo la intención explícita v1.1 y las
interfaces/relaciones REV8 sin introducir ninguna solución constructiva.

## Esfuerzo

- planificado: `high`
- efectivo al abrir la sesión: `high`
- escalamiento: no usado; `xhigh` prohibido

## Baseline certificado

- rama: `main`
- commit corto: `6d371bd`
- commit completo: `6d371bd5062de3f8a647bfce0631d722b63f8f26`
- upstream: `origin/main`, sin divergencia al certificar B0
- ZIP: `2bde041150cec4655619501057d164f5c1c147f2c3b6a49c04ec1f864fcd5614`
- input: 719 archivos, contenido y `SHA256SUMS` verificados por el creador oficial
- toolchain: Node 22.23.2 / npm 10.9.9
- `make governance` antes de abrir B1: PASS, 22 archivos requeridos / 49 requisitos / 60 decisiones
- ninguna operación Git de escritura autorizada en esta apertura

## Autoridades congeladas

1. `agnostic-geometry-v1.0`: geometría física.
2. `recognized-structural-topology-v1.0` R0–R5: hecho topológico derivado.
3. `structural-intent-v1.1`: autoridad humana persistente.
4. `interfaceIntents[]` / `relationIntents[]`: especializaciones locales persistentes REV8.
5. propuestas/review y `candidate-load-paths-v1.0`: evidencia/contexto no autoritativo.
6. R6–R12 y `structural-requirements-v1.0`: derivados recalculables, no persistentes y `notVerified`.

## Hallazgos previos registrados antes de implementación

- `H-015-E-B-001`: el campo vigente `sourceFingerprints.elementIntentSha256` de SPEC-015-D tiene
  nombre más estrecho que su contenido real, porque actualmente hashea el root completo de
  `structuralIntent`; SPEC-015-E debe separar fingerprint agregado y fingerprints proyectados sin
  corregirlo silenciosamente.
- `H-015-E-B-002`: `lateral=0` en el checkpoint REV8 no prueba `notApplicable`; el caso sólo puede
  clasificarse desde una declaración explícita o conservarse como ausencia de escenario/intención.
- `H-015-E-B-003`: una relación o interfaz local sobre cara/rango no autoriza promover esa función a
  todo el elemento anfitrión.
- `H-015-E-A-001`: salvedad de procedencia del ZIP cerrada en B0 mediante regeneración oficial desde
  `main@6d371bd`; SHA idéntico al analizado en Fase A.

## Caso real de apertura

FX-008 conserva como invariantes de regresión 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas;
B1 mantiene 10.400 mm físicos y 1.700 mm de interacción; C/6 y C/7 mantienen rangos parciales;
los cuatro caminos gravitacionales continúan `completeCandidate` y ninguno es `verified`.

El escenario lateral explícito de Fase A conserva un gap de 571,429 mm y debe producir
`SR-LOAD-TRANSFER-REQUIRED` sin seleccionar miembro, perfil, material ni detalle constructivo.

## Prohibiciones de esta sesión

- no inferir intención desde `wallType`, MP1/MP2/MP3, `tabique`, Metalcon u OSB;
- no convertir `candidate`/`completeCandidate` en `verified`;
- no convertir `supportedByFoundation` en apoyo resistente verificado;
- no persistir R6–R12 o requisitos dentro del archivo nativo;
- no usar fallback geométrico para sustituir una relación explícita stale/broken;
- no abrir SPEC-016 ni diseñar soluciones constructivas;
- no ejecutar Git de escritura sin autorización explícita del usuario.

## Primer gate

Tras esta apertura documental, ejecutar `make governance`. No comenzar B2 hasta que G0 quede verde.

## B2 — núcleo puro R6–R12 preparado

El corte B2 agrega una capa pura y reversible que recibe la salida R0–R5 congelada y produce en
paralelo topología R0–R12 y `structural-requirements-v1.0`; no reescribe el reconocedor R0–R5 ni
integra UI.

Antes de aceptar código se registraron y corrigieron:

- `BUG-015-E-001`: `regions[].requirementRefs[]` no tenía colección raíz resoluble; se agrega
  `requirements[]` al contrato y a su orden canónico.
- `BUG-015-E-002`: B1.1 dejó una entrada huérfana duplicada en `specs/MANIFEST.json`; se elimina y
  G0 se endurece para rechazar entradas sin nombre, duplicadas, formalmente inválidas o inexistentes.

Prevalidación aislada sobre el mismo input certificado:

- pruebas focales R0–R5 + REV8 + B2: 47/47 PASS;
- B2 propio: 10/10 PASS;
- `make governance`: PASS, 22 archivos / 50 requisitos / 61 decisiones;
- reversión de entrada huérfana del manifiesto: FAIL esperado y restauración a verde;
- `npm run format:check`: PASS;
- lint pendiente de ejecutar en el repositorio local con dependencias instaladas; el ZIP aislado no
  contiene `node_modules`.

No se ejecutó Git de escritura durante la preparación de este corte.

## B3 — evidencia real FX-008 preparada

El corte B3 se mantiene fuera de la UI productiva. Agrega un generador reproducible y evidencia
JSON/SVG/HTML sobre el fixture real para revisar visualmente R6–R12 antes de aprobar la SPEC.

Durante la preparación se registró `H-015-E-B3-001`: el cierre REV8 con `Propuestas=0` quedó sólo en
persistencia local del navegador y no existe un snapshot versionado que permita reconstruir ese review
state. B3 lo conserva como referencia documental y no lo presenta como cálculo reproducido.

Prevalidación aislada B3:

- generador de evidencia: PASS;
- tests B3: 4/4 PASS;
- FX-008: 45/43/32/7, 8 interfaces, 5 relaciones;
- checkpoint reproducible: 4 caminos gravitacionales ligados a relaciones, 0 laterales,
  `lateralStatus=notDeclared`, `notVerified`;
- B1: 10.400 mm físicos / 1.700 mm interacción;
- C/6 y C/7: rangos parciales exactos;
- lateral explícito: gap 571,429 mm → `SR-LOAD-TRANSFER-REQUIRED`;
- localizador: 0 cambios de historia/trace/intención, vista restaurada y selección preservada.

No se integró UI, store, persistencia R6–R12 ni solución constructiva y no se ejecutó Git de escritura.

## B3.1 — correctiva visual posterior a revisión humana

La revisión visual del HTML B3 detectó y registró antes de corregir:

- `BUG-015-E-003`: anotaciones superpuestas con geometría;
- `BUG-015-E-004`: foco negro grueso ocultaba geometría fuente;
- `BUG-015-E-005`: C/6 y C/7 ilegibles a la escala de B1;
- `BUG-015-E-006`: IDs técnicos usados como nombre principal en lateral;
- `BUG-015-E-007`: G1–G4 auditados pero no inspeccionables individualmente.

B3.1 se limita al generador/evidencia y sus pruebas. Mantiene intacto el núcleo R6–R12 y agrega líderes exteriores, halo no destructivo, detalles `NO A ESCALA`, descriptores humanos y foco G1–G4. Ninguna operación Git de escritura fue ejecutada durante la preparación.

## B3.2 — correctiva semántica de extremos R11 y referencias support/transfer

La revisión humana de B3.1 detectó que C/7 mostraba `L=0,1 mm`. Antes de corregir se rastreó el origen hasta REV8: `locator.kind=end`, `end=highS`, `sRange=[1999.9,2000]`. La banda de 0,1 mm es envolvente de localización/tolerancia, no longitud física.

Se registraron antes de implementar:

- `BUG-015-E-010`: R11 descartaba `kind=end` y materializaba la envolvente como rango físico.
- `BUG-015-E-011`: el contrato documental de `supports/transfers` no coincidía con el shape plural/n-ario de B2.

B3.2 corrige el contrato aún no cerrado de `structural-requirements-v1.0`: R11 discrimina `longitudinalLocation.kind=range|end`; C/7 queda en `highS`, `anchorS=2000`, con `localizationEnvelope=[1999.9,2000]` sólo como evidencia geométrica. `supports/transfers` referencian regiones mediante `targetRegionRefs[]`; el overlap de `candidatePath` permanece en `evidence.overlapRange` y no crea autoridad.

No se modifica REV8, geometría agnóstica, intención persistente, candidate paths, store ni UI productiva. Ninguna operación Git de escritura forma parte de esta correctiva.

## B3.2.1 — correctiva visual de legibilidad del extremo C/7

La revisión visual posterior a B3.2 confirmó la semántica `end/highS` pero detectó que el texto crítico
del detalle C/7 quedaba truncado por el ancho fijo del inset SVG.

Se registró antes de corregir:

- `BUG-015-E-012`: el detalle C/7 mostraba correctamente `anchorS=2000`, pero la explicación de
  `localizationEnvelope=[1999.9,2000]` y la advertencia “NO es longitud física” quedaban parcialmente
  fuera de la tarjeta, debilitando la revisión humana del hallazgo que motivó B3.2.

B3.2.1 modifica únicamente la composición SVG/HTML del generador de evidencia: separa la localización,
tolerancia, banda Z y advertencia en líneas explícitas dentro del mismo inset. No modifica R11,
`structural-requirements-v1.0`, REV8, geometría, intención, candidate paths, store ni UI productiva.
