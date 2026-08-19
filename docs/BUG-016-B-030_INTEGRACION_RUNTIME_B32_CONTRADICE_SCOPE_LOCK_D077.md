# BUG-016-B-030 — Integración runtime B3.2 contradice scope-lock D-077

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

La revisión dirigida del diff de SPEC-016-B B3.2 detectó una contradicción
material de alcance.

D-077 congela que implementation subcut B3.2 comprende exclusivamente las
secciones técnicas B3.2, B3.3 y B3.4 y declara que este corte no adelanta
`runtime`.

El mapa histórico de subcortes ubica:

- B3.2: frame local + openings + tolerancias + dominio;
- B3.6: runtime/generatedArtifacts.

Sin embargo, la implementación actual de B3.2 modifica
`src/core/metalconConstructiveRuntime.js` para invocar
`inspectMetalconSelectedWallGeometryB32()` y agrega tests de integración runtime.

Además `governance/STATUS.md` contiene simultáneamente:

- `ACTIVE-SCOPE ... phase=IMPLEMENTATION ... authorizedBy=D-076,D-077,D-083`;
- texto que afirma que la implementación de B3.2 no está autorizada y que
  `runtime` no forma parte del corte activo.

## Impacto

Los gates funcionales están verdes, pero eso no resuelve la contradicción de
autoridad. Cerrar B3.2 en este estado podría incorporar trabajo perteneciente a
B3.6 y dejar STATUS semánticamente inconsistente con D-083.

## Resguardo

Mientras este BUG permanezca abierto:

- no cerrar BUG-016-B-024/026/027/028;
- no declarar B3.2 cerrado;
- no avanzar B3.3+;
- no ejecutar Git write;
- no ampliar la integración runtime.

## Decisión requerida

La revisión humana debe decidir explícitamente entre:

1. mantener D-077 y retirar de B3.2 la integración runtime, conservando el
   módulo geométrico puro y su corpus focal; o
2. modificar explícitamente el scope-lock para incorporar runtime a B3.2.

Cualquier resolución debe corregir también la contradicción textual de
`governance/STATUS.md`.

## Criterio de cierre

1. resolución humana explícita;
2. scope-lock, STATUS y SPEC coherentes;
3. producto dentro del corte autorizado;
4. tests focales y regresión correspondiente verdes;
5. governance y `git diff --check` verdes.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la opción 1 y D-085 congeló la resolución:

- D-077 permanece intacta;
- B3.2 conserva exclusivamente las secciones técnicas B3.2/B3.3/B3.4;
- la lógica geométrica B3.2 permanece en su módulo puro;
- runtime/generatedArtifacts queda reservado a un subcorte posterior
  explícitamente autorizado;
- la integración runtime introducida durante B3.2 y sus tests específicos
  fueron retirados por scope drift, no para adaptar gates o conseguir verde;
- `governance/STATUS.md` quedó alineado con D-083 y D-085.

Evidencia posterior a la corrección:

- focal geométrico B3.2: 40/40 PASS;
- regresión SPEC-016-B: 81/81 PASS;
- scope-lock governance: 6/6 PASS;
- governance: 22 archivos, 56 requisitos y 85 decisiones — PASS;
- `git diff --check`: PASS;
- `git diff -- src/core/metalconConstructiveRuntime.js tests/constructiveSpec016BMetalconRuntime.test.mjs`: vacío.

Por tanto, el scope drift quedó eliminado sin modificar las decisiones
congeladas para acomodar implementación, tests ni validaciones.
