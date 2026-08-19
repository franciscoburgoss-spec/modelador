# BUG-016-B-022 — Umbral ambiguo para solape 2D de openings en B3.2

## Estado

CERRADO — 18-ago-2026.

## Contexto

SPEC-016-B mantiene B3 abierto mediante D-072 y D-076 habilita el subcorte de
implementación B3.2 exclusivamente para Fase A READ-ONLY.

La frontera ratificada para dicho subcorte comprende las secciones técnicas:

- `B3.2 Hosts y frame local`;
- `B3.3 Dominio geométrico y openings`;
- `B3.4 Tolerancias`.

Durante la inspección READ-ONLY del contrato de dominio/openings se detectó una
ambigüedad material respecto del criterio que determina cuándo dos openings
presentan un solape 2D inválido.

## Hallazgo

La sección técnica B3.3 establece:

> Un solape 2D inválido entre openings falla cerrado.

La sección técnica B3.4 congela separadamente:

- `MATERIALIZATION_TOL_LINEAR_MM = 0.1`;
- `MATERIALIZATION_TOL_LEVEL_MM = 0.1`;
- `MATERIALIZATION_MIN_SEGMENT_MM = 0.1`;
- salida canónica a 3 decimales;
- comparación antes del redondeo;
- la tolerancia no modifica geometría autoritativa.

Sin embargo, el contrato no establece si alguna de estas tolerancias constituye
el umbral para determinar qué significa `solape 2D inválido`.

Tampoco se encontró en `sessions`, `docs` ni `governance` otra autoridad que
resuelva dicha semántica.

## Casos actualmente indeterminados

Con el contrato vigente, implementaciones distintas podrían resolver de manera
diferente, entre otros, los siguientes casos para dos openings del mismo host:

1. contacto exacto de borde en `s`, sin penetración;
2. contacto exacto de borde en `z`, sin penetración;
3. solape positivo menor que `0.1 mm` en una dimensión;
4. solape exactamente igual a `0.1 mm`;
5. solape superior a `0.1 mm`;
6. solape positivo en `s` pero separación en `z`;
7. solape positivo en `z` pero separación en `s`.

Esta diferencia altera qué `effectiveGeometry` es aceptada o rechazada por B3 y,
por extensión, puede alterar materialización, artifacts, IDs y SHA.

## Precedente inspeccionado

SPEC-014 contiene `openingOverlapFindings(...)`, que:

- agrupa openings por host;
- calcula intersección en `s` y `z`;
- usa su propio `config.minimumOverlap`;
- registra `RT-OPENING-OVERLAP` con severidad `error`.

Los tests de SPEC-014 congelan además `minimumOverlap: 0.1`.

Este precedente no constituye autoridad suficiente para B3.2 porque:

- pertenece al reconocimiento topológico de SPEC-014;
- su umbral es configuración propia de ese dominio;
- el resultado es un finding y no el fail-closed contractual exigido por
  SPEC-016-B;
- SPEC-016-B declara tolerancias propias de materialización.

Por tanto, B3.2 no debe importar silenciosamente `minimumOverlap` ni su semántica
desde SPEC-014.

## Diagnóstico

El defecto es una ambigüedad del contrato B3.2, no un defecto del productor de
geometría agnóstica ni de SPEC-014.

El término `solape 2D inválido` necesita una definición verificable propia de
SPEC-016-B antes de implementar la validación fail-closed.

No resolver esta ambigüedad permitiría que dos implementaciones compatibles con
el texto actual aceptaran/rechazaran de forma distinta la misma geometría
efectiva.

## Decisión requerida

Antes de implementar B3.2 debe congelarse explícitamente:

1. cómo se calcula el solape efectivo entre dos rectangles `Oi` del mismo host;
2. si el contacto de borde constituye o no solape;
3. qué relación existe, si alguna, entre
   `MATERIALIZATION_TOL_LINEAR_MM = 0.1` y el criterio de solape;
4. el tratamiento exacto de penetraciones positivas menores, iguales y mayores
   que `0.1 mm`;
5. que la comparación se realice antes del redondeo canónico;
6. que B3 falle cerrado cuando el criterio definido resulte inválido;
7. que la validación no repare, fusione, mueva ni reinterprete openings.

## Resguardos

Mientras este BUG permanezca abierto:

- no implementar la validación de solapes B3.2;
- no inferir que `MATERIALIZATION_TOL_LINEAR_MM` equivale a
  `minimumOverlap`;
- no reutilizar silenciosamente la configuración de SPEC-014;
- no reparar, fusionar, desplazar ni reinterpretar openings;
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

BUG-016-B-021 permanece abierto y es independiente de este defecto.

## Corpus adversario congelado

D-079 congela el siguiente corpus mínimo para la futura validación autorizada
de solape 2D entre openings del mismo host. Los rectangles se expresan como
`[sMin,sMax] × [zMin,zMax]`.

| Caso | O1 | O2 | Resultado esperado |
|---|---|---|---|
| OVL-DISJOINT | `[0,1000] × [0,1000]` | `[1200,2200] × [0,1000]` | válido; sin solape |
| OVL-TOUCH-S | `[0,1000] × [0,1000]` | `[1000,2000] × [0,1000]` | válido; `overlapS=0` |
| OVL-TOUCH-Z | `[0,1000] × [0,1000]` | `[0,1000] × [1000,2000]` | válido; `overlapZ=0` |
| OVL-TOUCH-CORNER | `[0,1000] × [0,1000]` | `[1000,2000] × [1000,2000]` | válido; contacto puntual |
| OVL-S-ONLY | `[0,1000] × [0,1000]` | `[900,1900] × [1200,2200]` | válido; penetración sólo en `s` |
| OVL-Z-ONLY | `[0,1000] × [0,1000]` | `[1200,2200] × [900,1900]` | válido; penetración sólo en `z` |
| OVL-BOTH-0.05 | `[0,1000] × [0,1000]` | `[999.95,2000] × [999.95,2000]` | inválido; fail-closed |
| OVL-BOTH-0.1 | `[0,1000] × [0,1000]` | `[999.9,2000] × [999.9,2000]` | inválido; fail-closed |
| OVL-BOTH-0.1001 | `[0,1000] × [0,1000]` | `[999.8999,2000] × [999.8999,2000]` | inválido; fail-closed |
| OVL-S-0.05-Z-100 | `[0,1000] × [0,1000]` | `[999.95,2000] × [900,1900]` | inválido; penetración positiva en ambos ejes |

Los casos `0.05`, `0.1` y `0.1001` demuestran expresamente que
`MATERIALIZATION_TOL_LINEAR_MM`, `MATERIALIZATION_TOL_LEVEL_MM` y
`MATERIALIZATION_MIN_SEGMENT_MM` no constituyen un umbral de solape.

El criterio es exclusivamente:

`overlapS > 0 && overlapZ > 0`

y se evalúa antes del redondeo canónico. B3 no fusiona, mueve, recorta ni
reinterpreta openings y no reutiliza `minimumOverlap` de SPEC-014.

## Criterios de cierre

BUG-016-B-022 podrá cerrarse cuando:

1. exista una definición inequívoca y verificable de `solape 2D inválido`;
2. contacto de borde y penetraciones alrededor de `0.1 mm` tengan semántica
   explícita;
3. quede definida la relación, o ausencia de relación, con las tolerancias B3.4;
4. la comparación sea previa al redondeo;
5. la consecuencia fail-closed esté congelada;
6. SPEC-014 permanezca únicamente como precedente conceptual y no como
   autoridad importada silenciosamente;
7. los gates documentales aplicables permanezcan verdes;
8. exista revisión humana explícita antes de autorizar implementación B3.2.

## Cierre verificado

CERRADO — 18-ago-2026.

La revisión humana materializada por D-079 resuelve inequívocamente la
ambigüedad de solape 2D:

- `overlapS = min(s1Max,s2Max) - max(s1Min,s2Min)`;
- `overlapZ = min(z1Max,z2Max) - max(z1Min,z2Min)`;
- existe solape inválido únicamente cuando
  `overlapS > 0 && overlapZ > 0`;
- contacto exacto de borde o esquina es válido;
- toda penetración estrictamente positiva en ambas dimensiones falla cerrado,
  incluso por `0.05`, `0.1` o `0.1001 mm`;
- las tolerancias B3.4 y `MATERIALIZATION_MIN_SEGMENT_MM` no son umbrales de
  solape;
- la comparación ocurre antes del redondeo canónico;
- SPEC-014 permanece sólo como precedente conceptual y no como autoridad
  importada;
- B3 no repara, fusiona, desplaza ni reinterpreta openings.

La regla está materializada en `SPEC-016-B / B3.3-B3.4` y el corpus adversario
queda congelado en este BUG.

Evidencia previa al cierre:

- `make governance`: PASS — 22 archivos requeridos, 56 requisitos y 80 decisiones;
- `git diff --check`: PASS.

Este cierre es exclusivamente documental/contractual de Fase A. No autoriza
implementación B3.2, no cierra BUG-016-B-023 ni BUG-016-B-024 y no habilita
B3.3 de implementación, B4, B5, SPEC-016-C ni Git write.
