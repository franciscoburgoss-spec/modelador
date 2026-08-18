# Implementación SPEC-016-B

## Estado

ABIERTA — 15-ago-2026.

Fase A reformulada: APROBADA por revisión humana.

Baseline de apertura: `fde781c4c95fa66bab2fdb7014839922db1cdb33`.

Esfuerzo planificado: `high`.

## Decisión de apertura

SPEC-016-B se abre como desarrollo limpio del primer adaptador Metalcon productivo sobre SPEC-016-A. La migración del Metalcon legacy queda descartada. El legacy permanece congelado como referencia y fuera de la autoridad, inputs y outputs del nuevo adapter.

## Autoridades preservadas

- geometría agnóstica = autoridad física;
- `structuralIntent` = autoridad humana estructural;
- requirements = derivados no persistentes y `notVerified`;
- scenario configuration/assignments = autoridad constructiva;
- generated solution = derivada y efímera;
- receipt = evidencia persistente.

## Cortes aprobados

B1 protocolo común; B2 dominio Metalcon; B3 materialización; B4 requirements; B5 UI y evidencia.

## Corte actual

B3.2 — FASE A READ-ONLY HABILITADA — 17-ago-2026 mediante D-076.

B1 quedó CERRADO el 15-ago-2026 y B2 quedó CERRADO el 16-ago-2026 mediante
`SPEC-016-B / B2-CLOSE`. B3.1a quedó CERRADO mediante D-074 y B3.1b quedó
APROBADO Y CERRADO el 17-ago-2026 mediante D-076.

B3 continúa abierto por subcortes controlados. D-076 habilita exclusivamente
la Fase A READ-ONLY de B3.2; su implementación requiere una nueva aprobación
humana explícita. B4 y B5 permanecen pendientes, SPEC-016-B continúa abierta y
SPEC-016-C continúa bloqueada.

## Cierre documental verificado B1

B1 implementa exclusivamente el protocolo común:

- runtime adapter-neutral sin dispatch por adapter ID;
- capacidades ejecutables del runtime separadas de su shape enumerable;
- `configuration.inputRefs` explícitos, tipados y fail-closed;
- `constructive-library-context-v2.0`;
- `constructive-solution-v2.0`;
- artefactos/resolutions v2 comunes;
- receipt v1 compatible;
- runtime neutral v1 preservado.

Evidencia:

- `tests/constructiveSpec016BProtocol.test.mjs`: 7/7 PASS;
- suite constructiva: 192/192 PASS;
- Node: 1219/1219 PASS;
- componentes: 61/61 PASS;
- Rust: 9/9 PASS;
- laboratorio: 35/35 PASS;
- core coverage: 91,72 % líneas / 80,63 % ramas / 94,28 % funciones;
- store coverage: 92,77 % / 80,74 % / 93,41 %;
- `npm run validate`: PASS integral;
- `constructiveSolutionGeneration.js` conserva SHA-256 `683a9eee993939f721f232e695fdaba64978ba14f173e5485d4742b587bc73f9`;
- BUG-016-B-001 a BUG-016-B-008 cerrados;
- ningún algoritmo Metalcon nuevo implementado;
- ningún output constructivo derivado persistido;
- geometría agnóstica y `structuralIntent` permanecen autoridades inmutadas;
- `verificationState=notVerified`.

El cierre documental confirma además que BUG-016-B-007 y BUG-016-B-008 quedaron cerrados con `git diff --check`, `format:check` y governance PASS.

B1 queda cerrado sin cerrar SPEC-016-B. El siguiente corte permitido es B2 — dominio Metalcon, todavía pendiente de implementación.

## Límite B1

B1 puede modificar únicamente lo necesario para desacoplar el pipeline del generador neutral concreto, introducir runtime adapter-neutral, refs constructivas explícitas, library context v2, solution v2 y validadores comunes, conservando íntegramente el protocolo/regresiones neutral v1.

B1 NO implementa todavía algoritmos Metalcon.

## Invariantes B1

SPEC-016-A permanece semánticamente intacta; `modelVersion` permanece 4; no se modifica v3→v4; no se persiste generated solution; `verificationState=notVerified`; ningún adapter obtiene acceso libre al modelo; refs irresolubles fallan cerradamente; runtime neutral continúa pasando sus regresiones; SPEC-016-C continúa bloqueada.

## Git

La autorización de apertura NO incluye `git add`, `git commit` ni `git push`. Cada frontera requiere autorización humana separada.

## Apertura verificada

SPEC-016-B-OPEN queda verificada documentalmente el 15-ago-2026.

Evidencia:

- baseline de apertura fde781c4c95fa66bab2fdb7014839922db1cdb33;
- SPEC-016-B activa;
- SPEC-016-C bloqueada;
- D-070 vigente;
- R-037 registrado;
- REQ-DOM-013, REQ-DOM-014 y REQ-UX-006 en curso;
- BUG-016-B-001, BUG-016-B-002 y BUG-016-B-003 cerrados;
- git diff --check PASS;
- make governance PASS;
- cero cambios en src/ y tests/.

El siguiente trabajo permitido es la inspección READ-ONLY de B1 antes de su implementación mecánica.

## Cierre humano B2 — B2-CLOSE

El 16-ago-2026 la revisión humana aprobó explícitamente:

`SPEC-016-B / B2-CLOSE`

La autorización se produce después de la implementación mecánica de B2, la
auditoría de alcance y la validación integral pre-cierre.

B2 queda aprobado y cerrado con la siguiente frontera:

- biblioteca Metalcon nueva, versionada y hasheada;
- configuración Metalcon estricta y fail-closed;
- refs constructivas explícitas sobre el protocolo B1;
- runtime Metalcon y adapter shell pre-B3;
- output `constructive-solution-v2.0` efímero;
- receipt v1 persistente;
- requirements pre-B3 exclusivamente `unresolved`;
- `verificationState=notVerified`;
- independencia estática y dinámica respecto del Metalcon legacy.

Caso real FX-008 verificado:

- muro lateral: `1784606313849`;
- cubierta: `1785158713616`;
- gap: `571.429 mm`;
- `constructionSelections=[]`;
- cero assignments;
- cero artefactos generados;
- transferencia y resistencia lateral permanecen `unresolved`;
- output no persistido;
- receipt persistido.

Evidencia técnica:

- B2.1 biblioteca: 8/8 PASS;
- B2.2 configuración: 7/7 PASS;
- B2.3 runtime: 4/4 PASS;
- regresión B1+B2: 26/26 PASS;
- `npm run validate`: PASS pre-cierre;
- Node 1238/1238;
- componentes 61/61;
- Rust 9/9;
- laboratorio 35/35;
- goldens 19;
- DXF 14 archivos, 0 errores y 0 reparaciones;
- CalculiX 3/3;
- build, migración, artefactos, derivados, auditoría y gobernanza PASS.

BUG-016-B-009 y BUG-016-B-010 quedan cerrados.

BUG-016-B-011 quedó CERRADO el 16-ago-2026 después de superar los gates
documentales post-cierre; su correctiva documental permanece materializada.

Este cierre no:

- cierra SPEC-016-B;
- inicia ni autoriza B3;
- implementa B4 o B5;
- desbloquea SPEC-016-C;
- modifica `modelVersion: 4`;
- convierte `resolved`, `fresh`, `complete` o cualquier resultado en
  `verified`;
- autoriza `git add`, commit o push.

## Apertura humana B3 — B3-OPEN

El 17-ago-2026 la revisión humana aprobó la Fase A B3 v1.0 después de revisar
la frontera efectiva real, `projectElement`, `projectPrism`, los openings
efectivos, los contratos B1/B2 y un ejemplo visual sobre una elevación real de
FX-008.

La aprobación autoriza exclusivamente B3 por subcortes controlados.

Contrato congelado para B3:

- geometría agnóstica efectiva permanece autoridad física;
- materialización sólo sobre hosts muro explícitos;
- frame local canónico `(s,z)`;
- grid maestro anclado en `s=0`;
- openings recortan materia y no reinician grid;
- studs cortos nacen del mismo grid maestro;
- wallEnds, jambas, `openingHead`, `openingSill` y tracks son referencias
  constructivas lógicas;
- deduplicación sólo intra-host;
- ninguna política automática de esquina/T/cruce;
- `panelCoverage` es cobertura lógica, no despiece de hojas;
- tolerancias B3 explícitas y determinismo canónico;
- B3 no usa `element.solids` como fallback de framing;
- B3 no consume Metalcon legacy;
- `assignments=[]`;
- artifacts B3 con `requirementRefs=[]`;
- requirements efectivos exclusivamente `unresolved`;
- `coverage=none`;
- `verificationState=notVerified`;
- B4 no mutará la identidad de artifacts B3 para adjudicarles requirements.

Subcortes autorizados:

- B3.1a contrato/resolver de familias; fixtures sólo no productivos;
- B3.1b catálogo productivo real inicial con fuente y aprobación humana;
- B3.2 frame/openings/tolerancias;
- B3.3 familia vertical;
- B3.4 familia horizontal;
- B3.5 panel coverage;
- B3.6 integración runtime;
- B3.7 determinismo, D-070, FX-008 y regresión.

La apertura no autoriza B4, B5, SPEC-016-C, `git add`, commit ni push.

### Resolución BUG-016-B-016 — estrategia B3.1

El 17-ago-2026 la revisión humana aprueba dividir B3.1 mediante D-073:

- B3.1a puede implementar el resolver contractual con fixtures explícitamente
  no productivos;
- B3.1b debe incorporar un catálogo inicial real, trazable y aprobado antes de
  B3.2;
- fixtures y nombres de tests no se promueven a producto;
- no se introducen defaults ni datos Metalcon legacy;
- conocer una sección real no implica capacidad ni requirement resuelto;
- `studSpacingMm` permanece explícito fuera del assembly.

La selección concreta de productos y fuentes de B3.1b será revisada
humanamente antes de escribir el catálogo productivo.

### Cierre B3.1a — resolver de familias

APROBADO Y CERRADO — 17-ago-2026 mediante D-074.

La revisión humana aprueba B3.1a con la siguiente evidencia ejecutada:

- resolver productivo:
  `src/core/metalconConstructiveFamilyResolver.js`;
- test focal:
  `tests/constructiveSpec016BMetalconFamilyResolver.test.mjs`;
- test focal B3.1a: 10/10 PASS;
- regresión SPEC-016-B biblioteca/configuración/runtime/resolver: 29/29 PASS;
- suite Node completa: 1248/1248 PASS;
- componentes: 61/61 PASS;
- `git diff --check`: PASS;
- `npm run format:check`: PASS, 774 archivos de texto;
- `make governance`: PASS previo al cierre, 22 archivos requeridos,
  56 requisitos y 73 decisiones;
- `npm run build`: PASS, 331 módulos transformados.

Hashes B3.1a verificados:

- resolver:
  `fc72056b518cf35f446c371ba2e8f62a8140003c89d7b023994850b0d418a817`;
- test:
  `c65bf064244b0722d79d882c16f43f9b41a9ab8ae6075dc14eaab9305bcabf4b`.

Los tres módulos cerrados de B2 permanecen byte-identical:

- biblioteca:
  `00f6092ebca5a735f452e02f6f7fcd9a547b3204f0a3008c7a02a1e3ea782823`;
- configuración:
  `78a4adf4abd81a7805e8125e26ad864434099e7e9d53cc7e9fde69503fdf8498`;
- runtime:
  `0c75ffeeae95a865d5cc2fa29a655e633570dc0b77ef647722c8c794add45952`.

La auditoría estática del resolver no encontró consumo de:

- Metalcon legacy;
- `effectiveGeometry`;
- `structuralIntent`;
- assignments;
- runtime;
- `generatedArtifacts`.

B3.1a no materializa geometría ni responde requirements.

D-074 habilita únicamente la Fase A READ-ONLY de B3.1b para revisar fuentes y
productos reales. No autoriza modificar todavía la biblioteca productiva,
integrar runtime, comenzar B3.2, B4, B5 o SPEC-016-C.

Tampoco autoriza `git add`, commit ni push.

### B3.1b — Fase A aprobada y catálogo congelado

APROBADO — 17-ago-2026 mediante D-075.

La revisión humana aprueba como catálogo productivo inicial exacto:

- `metalcon-profile:cintac-90ca085`:
  CINTAC Metalcon Estructural 90CA085, C sin perforación,
  90x38x12x0,85 mm, peso nominal 1,23 kg/m;
- `metalcon-profile:cintac-92c085`:
  CINTAC Metalcon Estructural 92C085, U 92x30x0,85 mm,
  peso nominal 1,00 kg/m;
- `metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90`:
  ASTM A653 SQ Gr 40, G90, 275 g/m2;
- `metalcon-panel:lp-osb-apa-protec-11_1-1220x2440`:
  LP OSB APA Protec, tablero estructural 11,1x1220x2440 mm.

Fuentes congeladas para este corte:

- Manual de Diseño Metalcon, Primera Edición, enero de 2004;
- Manual de Construcción Metalcon aportado por revisión humana;
- ficha oficial LP Chile OSB APA Protec revisada 17-ago-2026.

B3.1b no autoriza:

- Metalcon legacy;
- promoción de fixtures B3.1a a producto;
- `wallAssemblies`;
- defaults de `studSpacingMm`;
- capacidades, tablas de diseño o `Fy`/`Fu` de cálculo;
- assignments o requirement responses;
- integración B3.2;
- B4, B5 o SPEC-016-C.

B3.2 permanece bloqueado hasta gates verdes y cierre humano de B3.1b.

No hay autorización `git add`, commit ni push.

### Cierre B3.1b — catálogo productivo real

APROBADO Y CERRADO — 17-ago-2026 mediante D-076.

La revisión humana aprueba B3.1b después de materializar exactamente el
catálogo productivo autorizado por D-075:

- `metalcon-profile:cintac-90ca085`;
- `metalcon-profile:cintac-92c085`;
- `metalcon-material:cintac-metalcon-estructural-a653-sq-gr40-g90`;
- `metalcon-panel:lp-osb-apa-protec-11_1-1220x2440`.

El corte conserva:

- `wallAssemblies=[]`;
- `components=[]`;
- `connections=[]`;
- `studSpacingMm` explícito, sin default;
- sin capacities;
- sin `Fy`/`Fu` de cálculo;
- sin assignments;
- sin respuestas a requirements;
- `verificationState=notVerified`;
- Metalcon legacy exclusivamente como referencia histórica, nunca como input,
  migración, sincronización ni fallback.

Evidencia técnica ejecutada para B3.1b:

- catálogo productivo: 4/4 PASS;
- puente resolver + catálogo productivo: 1/1 PASS;
- focal integrada B2/B3.1: 26/26 PASS;
- SPEC-016-B completa: 41/41 PASS;
- Node: 1253/1253 PASS;
- componentes: 61/61 PASS;
- build: PASS, 331 módulos transformados;
- independencia legacy dinámica D-070: PASS;
- static forbidden scan del catálogo: PASS;
- `git diff --check`: PASS;
- `npm run format:check`: PASS;
- `make governance`: PASS.

Hashes verificados:

- resolver B3.1a:
  `fc72056b518cf35f446c371ba2e8f62a8140003c89d7b023994850b0d418a817`;
- catálogo productivo:
  `494e8eec1a12c0d775849f1f4a377e598580e1d43d7e02aed0e8575dcff0dc5f`;
- biblioteca constructiva:
  `b20627755ebfc727fb8d8cb88bc76e36843904a6f5002ef9f9ee3e4cf068db8a`;
- manifest productivo canónico:
  `6937c18a134c9bd4b228150f2336431723649e21f98fee9158ab9c7c1651e93d`.

D-076 libera únicamente la Fase A READ-ONLY de B3.2. No autoriza implementar
hosts/frame local, B4, B5 ni SPEC-016-C.

Tampoco autoriza `git add`, commit ni push.
