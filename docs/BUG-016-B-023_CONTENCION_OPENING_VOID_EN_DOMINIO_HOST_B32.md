# BUG-016-B-023 — Contención de opening.void en dominio host B3.2

## Estado

CERRADO — 18-ago-2026.

## Contexto

SPEC-016-B mantiene B3 abierto mediante D-072 y D-076 habilita el subcorte de
implementación B3.2 exclusivamente para Fase A READ-ONLY.

La frontera ratificada para dicho subcorte comprende las secciones técnicas:

- `B3.2 Hosts y frame local`;
- `B3.3 Dominio geométrico y openings`;
- `B3.4 Tolerancias`.

Durante la inspección READ-ONLY de la frontera `effectiveGeometry` se comprobó
que la proyección efectiva conserva el prisma del host y sus
`openings[].void`, pero no vuelve a validar su consistencia geométrica interna.

## Hallazgo

La sección técnica B3.3 define para cada host:

`M = [0,L] × [z0,z1]`

y para cada vano efectivo un rectángulo `Oi`, con materia conceptual:

`S = M \ union(Oi)`.

También establece que B3 no repara, fusiona ni reinterpreta geometría
autoritativa.

Sin embargo, el contrato no establece explícitamente que cada `Oi` deba quedar
completamente contenido en `M`, ni congela qué debe ocurrir cuando un
`opening.void` excede parcial o totalmente el dominio de su host.

## Frontera efectiva inspeccionada

`projectEffectiveConstructiveInput(...)` proyecta `geometry` después de evaluar
elegibilidad contextual.

`evaluateConstructiveScenarioContext(...)` comprueba, respecto de geometría:

- schema esperado;
- existencia de `elements` y `roofGeometry` como arrays;
- resolución de IDs requeridos por scope y configuración.

No valida, entre otras propiedades:

- `element.type`;
- `prism.kind`;
- coordenadas finitas;
- ortogonalidad;
- longitud, altura o espesor positivos;
- estructura geométrica de `openings`;
- `hostWallId`;
- contención de `opening.void` dentro del prisma host.

Por tanto, `Oi ⊆ M` no es una garantía propia de la frontera
`effectiveGeometry`.

## Productor agnóstico inspeccionado

El productor normal `agnosticGeometry.js` sí verifica al proyectar un opening
que sus límites longitudinales y verticales no excedan el muro, usando un
`EPSILON = 1e-7`.

También genera `opening.void` con:

- `kind: oriented-prism`;
- eje coincidente con el host;
- ancho y alto positivos;
- `start/end` ordenados por el eje del muro;
- espesor igual al host;
- posición vertical derivada de `bottom + sill`.

Estas garantías del productor no sustituyen una garantía de la frontera
efectiva que consume B3.

Además, `EPSILON = 1e-7` pertenece al productor agnóstico y no equivale a las
tolerancias propias de materialización B3.4.

## Casos actualmente indeterminados

Con el contrato vigente, implementaciones distintas podrían resolver de manera
diferente, entre otros, los siguientes casos:

1. `Oi` completamente contenido en `M`;
2. `Oi` tangente a `s=0`;
3. `Oi` tangente a `s=L`;
4. `Oi` tangente a `z=z0`;
5. `Oi` tangente a `z=z1`;
6. `Oi` excede longitudinalmente el host por una cantidad positiva;
7. `Oi` excede verticalmente el host por una cantidad positiva;
8. `Oi` excede simultáneamente en `s` y `z`;
9. `Oi` queda totalmente fuera de `M`;
10. el exceso es menor, igual o mayor que `0.1 mm`.

Una implementación podría rechazar `Oi ⊄ M`.

Otra podría aplicar literalmente `M \ Oi`, produciendo de hecho un recorte
implícito de la porción del opening exterior al host.

Ambas lecturas son posibles con el texto actual, pero producen distinta
aceptación de `effectiveGeometry` y pueden alterar materialización, artifacts,
IDs y SHA.

## Precedente inspeccionado

SPEC-014 contiene reglas explícitas de contención y errores:

- `RT-OPENING-OUTSIDE-WALL`;
- `RT-OPENING-Z-OUTSIDE-WALL`.

Este precedente demuestra que el proyecto ya distingue geométricamente un vano
fuera del dominio de su muro.

No constituye autoridad suficiente para B3.2 porque:

- pertenece al reconocimiento topológico SPEC-014;
- usa sus propias tolerancias;
- su semántica no está declarada como contrato de materialización
  SPEC-016-B.

B3.2 no debe importar silenciosamente esa configuración ni sus umbrales.

## Diagnóstico

El defecto es una ambigüedad contractual de B3.2.

La expresión `S = M \ union(Oi)` no basta para decidir si un `Oi` exterior a
`M` debe:

- rechazarse;
- recortarse implícitamente;
- tolerarse parcialmente.

La ausencia de una regla explícita permitiría diferencias de comportamiento
sobre la misma geometría efectiva.

## Decisión requerida

Antes de implementar B3.2 debe congelarse explícitamente:

1. si todo `Oi` debe satisfacer `Oi ⊆ M`;
2. si el contacto exacto con los límites de `M` es válido;
3. qué ocurre ante cualquier excedencia positiva en `s`;
4. qué ocurre ante cualquier excedencia positiva en `z`;
5. qué relación existe, si alguna, con
   `MATERIALIZATION_TOL_LINEAR_MM = 0.1` y
   `MATERIALIZATION_TOL_LEVEL_MM = 0.1`;
6. que la comparación se realice antes del redondeo canónico;
7. que B3 no recorte, mueva, repare ni reinterprete `Oi`;
8. la consecuencia fail-closed cuando la condición de contención no se cumpla,
   si ésa es la decisión aprobada.

## Propuesta técnica para revisión humana

La propuesta a evaluar durante Fase A es:

**todo `Oi` debe quedar completamente contenido en `M`.**

Bajo esta propuesta:

- contacto exacto con `s=0`, `s=L`, `z=z0` o `z=z1` es válido;
- cualquier excedencia estrictamente positiva en `s` o `z` falla cerrado;
- las tolerancias B3.4 no expanden `M` ni corrigen `Oi`;
- la comparación ocurre antes del redondeo;
- no existe clipping implícito;
- no se modifica la geometría autoritativa.

Esta propuesta aún no constituye contrato vigente ni implementación mientras
no exista aprobación humana explícita.

## Resguardos

Mientras este BUG permanezca abierto:

- no implementar la validación de contención B3.2;
- no asumir silenciosamente `Oi ⊆ M`;
- no aplicar clipping implícito;
- no expandir `M` mediante tolerancias de materialización;
- no mover, recortar, reparar ni reinterpretar openings;
- no importar silenciosamente reglas o tolerancias desde SPEC-014;
- no modificar geometría agnóstica autoritativa;
- no avanzar a la familia vertical B3.3 de implementación;
- no avanzar familia horizontal ni `panelCoverage`;
- no integrar runtime ni `generatedArtifacts`;
- no reabrir B3.1a ni B3.1b;
- no consumir, migrar, proyectar, sincronizar ni usar como fallback Metalcon
  legacy;
- mantener `modelVersion: 4`;
- mantener `scenario.assignments=[]` durante B3;
- mantener artifacts B3 con `requirementRefs=[]`;
- mantener requirements efectivos `unresolved`;
- mantener `verificationState=notVerified`;
- no abrir B4, B5 ni SPEC-016-C;
- no realizar `git add`, commit, push, reset ni restore sin autorización humana
  separada.

## Alcance de esta apertura

Esta apertura crea únicamente el registro documental de la ambigüedad.

No corrige todavía:

- `specs/SPEC-016-B-adaptador-metalcon.md`;
- `governance/STATUS.md`;
- `governance/TRACEABILITY.md`;
- `governance/DECISIONS.md`;
- `sessions/implementation-SPEC-016-B.md`;
- código productivo;
- schemas;
- tests.

BUG-016-B-021 y BUG-016-B-022 permanecen abiertos y son independientes de este
defecto.

## Corpus adversario congelado

D-080 congela el siguiente corpus mínimo para la futura validación autorizada
de contención de openings en el dominio local de su host.

Para todos los casos:

`M = [0,4000] × [0,2800]`

| Caso | Oi | Resultado esperado |
|---|---|---|
| CNT-INSIDE | `[500,1500] × [500,2000]` | válido; `Oi ⊆ M` |
| CNT-TOUCH-S0 | `[0,1000] × [500,2000]` | válido; contacto exacto con `s=0` |
| CNT-TOUCH-SL | `[3000,4000] × [500,2000]` | válido; contacto exacto con `s=L` |
| CNT-TOUCH-Z0 | `[500,1500] × [0,1000]` | válido; contacto exacto con `z=z0` |
| CNT-TOUCH-Z1 | `[500,1500] × [1800,2800]` | válido; contacto exacto con `z=z1` |
| CNT-OUT-S-0.05 | `[-0.05,1000] × [500,2000]` | inválido; fail-closed |
| CNT-OUT-S-0.1 | `[-0.1,1000] × [500,2000]` | inválido; fail-closed |
| CNT-OUT-S-0.1001 | `[-0.1001,1000] × [500,2000]` | inválido; fail-closed |
| CNT-OUT-SL-0.05 | `[3000,4000.05] × [500,2000]` | inválido; fail-closed |
| CNT-OUT-Z-0.05 | `[500,1500] × [-0.05,1000]` | inválido; fail-closed |
| CNT-OUT-Z-0.1 | `[500,1500] × [-0.1,1000]` | inválido; fail-closed |
| CNT-OUT-Z-0.1001 | `[500,1500] × [-0.1001,1000]` | inválido; fail-closed |
| CNT-OUT-Z1-0.05 | `[500,1500] × [1800,2800.05]` | inválido; fail-closed |
| CNT-OUT-BOTH | `[-10,1000] × [1800,2810]` | inválido; fail-closed |
| CNT-FULLY-OUTSIDE | `[4500,5000] × [3000,3500]` | inválido; fail-closed |

Los casos `0.05`, `0.1` y `0.1001` demuestran expresamente que
`MATERIALIZATION_TOL_LINEAR_MM` y `MATERIALIZATION_TOL_LEVEL_MM` no expanden
`M` ni convierten un opening exterior en válido.

La condición es exactamente `Oi ⊆ M` y se evalúa antes del redondeo canónico.
El contacto exacto con los límites es válido; cualquier excedencia
estrictamente positiva en `s` o `z` falla cerrado.

B3 no aplica clipping implícito, no mueve, recorta, repara ni reinterpreta
`Oi`, y no reutiliza tolerancias o findings de SPEC-014.

## Criterios de cierre

BUG-016-B-023 podrá cerrarse cuando:

1. exista una definición inequívoca y verificable de contención `Oi ⊆ M`;
2. quede definido el tratamiento de contacto exacto con los límites del host;
3. quede definido el tratamiento de cualquier excedencia positiva;
4. quede definida la relación, o ausencia de relación, con las tolerancias B3.4;
5. la comparación sea previa al redondeo;
6. quede prohibido cualquier clipping, reparación o reinterpretación implícita;
7. la consecuencia fail-closed esté congelada si así lo aprueba la revisión
   humana;
8. SPEC-014 permanezca únicamente como precedente conceptual;
9. los gates documentales aplicables permanezcan verdes;
10. exista revisión humana explícita antes de autorizar implementación B3.2.

## Cierre verificado

CERRADO — 18-ago-2026.

La revisión humana materializada por D-080 resuelve inequívocamente la
contención de openings en el dominio local del host:

- cada `Oi` debe satisfacer exactamente `Oi ⊆ M`;
- el contacto exacto con `s=0`, `s=L`, `z=z0` o `z=z1` es válido;
- cualquier excedencia estrictamente positiva en `s` o `z` falla cerrado,
  incluso por `0.05`, `0.1` o `0.1001 mm`;
- `MATERIALIZATION_TOL_LINEAR_MM` y `MATERIALIZATION_TOL_LEVEL_MM` no expanden
  `M` ni convierten un opening exterior en válido;
- la comparación ocurre antes del redondeo canónico;
- no existe clipping implícito;
- B3 no mueve, recorta, repara ni reinterpreta `Oi`;
- SPEC-014 permanece sólo como precedente conceptual y no como autoridad
  importada.

La regla está materializada en `SPEC-016-B / B3.3-B3.4` y el corpus adversario
queda congelado en este BUG.

Evidencia previa al cierre:

- `make governance`: PASS — 22 archivos requeridos, 56 requisitos y 80 decisiones;
- `git diff --check`: PASS.

Este cierre es exclusivamente documental/contractual de Fase A. No autoriza
implementación B3.2, no cierra BUG-016-B-024 y no habilita B3.3 de
implementación, B4, B5, SPEC-016-C ni Git write.
