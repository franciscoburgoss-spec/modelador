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

B2 — PENDIENTE DE IMPLEMENTACIÓN.

B1 quedó CERRADO el 15-ago-2026. La SPEC permanece abierta y B2 requiere su propio desarrollo controlado.

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
