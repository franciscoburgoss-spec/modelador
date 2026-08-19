# BUG-016-B-043 — structuredClone incompatible con WebView macOS 11 en ruta SPEC-016-B

## Estado

CERRADO — 19-ago-2026.

## Contexto

SPEC-016-B B3.3 se encuentra en fase IMPLEMENTATION exclusivamente sobre la
sección técnica B3.5.

CUT-1 y CUT-2 se encontraban técnicamente verdes antes de esta detección:

- CUT-1: 10/10 PASS;
- CUT-2: 7/7 PASS;
- regresión SPEC-016-B: 112/112 PASS;
- WebView compatibility existente: 5/5 PASS;
- scope-lock: 6/6 PASS;
- governance: válida con 95 decisiones;
- auditoría anti-legacy: PASS;
- auditoría de no adelantar B3.6+: PASS.

## Hallazgo

Durante el último gate de compatibilidad se detectó uso productivo de:

`structuredClone(...)`

en la ruta nueva de SPEC-016-B.

El gate transversal existente de SPEC-004-D1 inspecciona explícitamente
`Object.hasOwn`, pero no cubre `structuredClone`.

## Evidencia en runtime objetivo

Se ejecutó una prueba directa mediante `WKWebView` nativo sobre el Mac objetivo
macOS 11.

Resultado real:

`WKWEBVIEW_RESULT= {"type":"undefined","works":false}`

Por tanto, `globalThis.structuredClone` no existe en el WebView objetivo.

Una prueba adicional en Node, retirando temporalmente `structuredClone`,
confirmó que CUT-2 depende actualmente de esa API:

`DEPENDENCIA_DETECTADA - TypeError structuredClone is not a function`

## Alcance observado

La inspección productiva detectó `structuredClone` no sólo en CUT-2, sino
también en módulos previamente existentes, entre ellos:

- `src/core/metalconConstructiveGeometry.js`;
- `src/core/metalconConstructiveLibrary.js`;
- `src/core/metalconScenarioConfiguration.js`;
- `src/core/structuralReferenceResolutionContext.js`.

También existen otros usos productivos fuera del núcleo inmediato de
SPEC-016-B.

## Contradicción

D-042 establece que el JavaScript productivo debe ejecutar en el WebView real
de macOS 11 y que built-ins ausentes en dicho runtime no pueden constituir una
dependencia productiva.

Los gates Node actuales no detectan esta incompatibilidad porque Node 22 sí
implementa `structuredClone`.

Por tanto existe una contradicción material entre el runtime objetivo congelado
y el código productivo actualmente aceptado por las suites.

## Impacto

B3.3 no puede declararse técnicamente cerrado mientras su ruta productiva
dependa de `structuredClone`.

El hallazgo no invalida las decisiones geométricas D-088 a D-095 ni los
resultados funcionales de CUT-1/CUT-2.

El defecto es de compatibilidad de runtime.

## Regla de corrección

Antes de modificar producción debe determinarse:

1. el cierre transitivo exacto de usos de `structuredClone` relevantes para
   SPEC-016-B;
2. si existe ya una abstracción compatible reutilizable;
3. el reemplazo mínimo necesario para eliminar la dependencia del built-in
   ausente;
4. un gate automático que impida reintroducir `structuredClone` en código
   productivo destinado al WebView.

No se modifican tests, validaciones ni decisiones para obtener verde.

## Scope

Este BUG bloquea el cierre técnico de SPEC-016-B B3.3 por una incompatibilidad
transversal de runtime.

No habilita:

- reinterpretar D-088 a D-095;
- B3.6;
- miembros horizontales;
- panelCoverage;
- runtime/generatedArtifacts constructivos;
- B4;
- B5;
- SPEC-016-C.

La existencia de usos adicionales fuera de SPEC-016-B deberá corregirse sólo
en la medida necesaria para restablecer el contrato transversal D-042, sin
aprovechar esta correctiva para refactorizaciones no relacionadas.

## Correctiva aplicada

La incompatibilidad se resolvió reutilizando la abstracción compatible existente:

`cloneJson(...)`

exportada por:

`src/core/structuralProposalCommon.js`

Se eliminaron los 14 usos productivos de `structuredClone` detectados en siete
archivos bajo `src/`.

No se agregó polyfill global ni dependencia nueva.

La correctiva conserva el contrato D-042: el JavaScript productivo no depende
de built-ins ausentes en el WKWebView objetivo de macOS 11.

También se agregó un gate transversal permanente en:

`tests/webviewCompatibility.test.mjs`

que inspecciona recursivamente producción y falla si reaparece
`structuredClone`.

## Evidencia posterior

Después de la correctiva:

- ocurrencias productivas de `structuredClone` bajo `src/`: `0`;
- WebView compatibility: `6/6 PASS`;
- SPEC-016-B B3.3 CUT-1: `10/10 PASS`;
- SPEC-016-B B3.3 CUT-2: `7/7 PASS`;
- regresión SPEC-016-B: `112/112 PASS`;
- constructiveGenerationReceipt: `20/20 PASS`;
- agnosticGeometryAudit: `7/7 PASS`;
- structural requirements/references: `20/20 PASS`;
- format check: PASS;
- `git diff --check`: limpio.

Las suites confirman que el reemplazo no modifica la semántica observable,
determinismo, hashes, geometría, receipts ni requisitos estructurales cubiertos.

## Impacto contractual

BUG-043 fue una incompatibilidad transversal de runtime.

Su resolución:

- no modifica D-088 a D-095;
- no modifica las reglas geométricas de CUT-1;
- no modifica las causas/roles verticales de CUT-2;
- no habilita B3.6;
- no habilita miembros horizontales;
- no habilita `panelCoverage`;
- no habilita runtime/generatedArtifacts constructivos;
- no habilita B4, B5 ni SPEC-016-C.

## Cierre verificado

CERRADO — 19-ago-2026.

La ruta productiva cubierta queda nuevamente compatible con D-042 y el defecto
queda protegido por un gate transversal automático.
