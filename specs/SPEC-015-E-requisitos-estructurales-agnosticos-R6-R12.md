# SPEC-015-E — Integración R6–R12 y requisitos estructurales agnósticos

**Estado:** borrador de planificación · 2026-08-04

## Diagnóstico

SPEC-014-A/B implementan R0–R5 usando sólo geometría. El cuerpo de SPEC-14 v0.3 plantea R6–R12,
pero parte de su vocabulario debe ajustarse a la arquitectura acordada:

- la intención por elemento es autoridad;
- los ejes son agrupación o ayuda, no decisión automática;
- los roles constructivos no participan;
- la salida debe describir requisitos, no miembros;
- las rutas gravitacionales y laterales deben permanecer separadas;
- `candidate` no equivale a `verified`.

La salida necesaria para soluciones constructivas no es un catálogo de perfiles. Es un contrato
agnóstico de funciones, regiones, apoyos, transferencias, límites y hallazgos.

## Decisión

Completar R6–R12 consumiendo:

```text
agnostic-geometry-v1.0
+ structural-intent-v1.0
+ structural-proposals-v1.0
+ candidate-load-paths-v1.0
```

y producir:

```text
recognized-structural-topology-v1.0
structural-requirements-v1.0
```

La topología conserva relaciones geométricas. Los requisitos expresan qué debe resolver cualquier
solución constructiva.

## Revisión de R6 — contexto de ejes

Los ejes no clasifican automáticamente muros.

Orden:

1. intención declarada del elemento;
2. intención declarada de intersección;
3. contexto opcional del eje;
4. sin dato: `undetermined`.

Valores de contexto de eje:

```text
resistantContext
secondaryContext
mixedContext
undetermined
```

Efectos:

- sirven para propuestas y revisión masiva;
- no reemplazan `elementIntents`;
- un muro sobre eje resistente sin intención sigue indeterminado;
- un muro con intención explícita prevalece.

## Revisión de R7 — participación preliminar

Salida por elemento:

```json
{
  "elementId": 1784600403613,
  "declaredParticipation": "resistant",
  "declaredFunctions": ["inPlaneLateralResistance"],
  "candidateFunctions": [],
  "resolvedFunctions": [],
  "verificationState": "notVerified"
}
```

Separar siempre:

```text
declared
proposed/candidate
resolvedByScenario
verified
```

R7 no usa `loadBearing`, `shearWall`, MP1 ni nombres de materiales como estados definitivos.

## R8 — apoyos verticales

Mantener la búsqueda jerárquica:

1. muro inferior;
2. transferencia declarada;
3. fundación/base;
4. no resuelto.

Cada relación registra:

- geometría;
- intención;
- certeza;
- intervalo común;
- función;
- hallazgos.

La coincidencia con una fundación no vuelve portante al muro.

## R9 — asociación con techumbre

Consumir bordes canónicos e intención.

Relaciones:

```text
ROOF_GEOMETRIC_BOUNDARY
ROOF_GRAVITY_SUPPORT_CANDIDATE
ROOF_LATERAL_SUPPORT_CANDIDATE
ROOF_NONSTRUCTURAL_BOUNDARY
```

Una propuesta aceptada puede confirmar intención, pero la relación sigue sin estar verificada por
materialidad.

## R10 — bordes y efectos requeridos

Separar:

```text
topologicalBoundary
requiredStructuralEffect
```

Efectos agnósticos:

```text
physicalLimit
openingLimit
resistantRegionLimit
secondaryAttachmentPoint
loadTransferRequired
supportTransition
collectorConnectionRequired
noStructuralEffect
unresolved
```

No usar `forcesStudOnly`, porque “stud” pertenece a una solución entramada.

## R11 — segmentos y regiones

Cada muro se divide en regiones topológicas. La salida registra:

- límites;
- bandas Z;
- vanos activos;
- funciones declaradas;
- rutas asociadas;
- apoyos;
- exclusiones;
- requisitos de transferencia;
- estado de resolución.

No evalúa dimensiones o capacidad específicas de un material.

## R12 — auditoría

Invariantes mínimas:

1. todas las referencias resueltas;
2. ningún requisito proviene de una solución constructiva;
3. ninguna propuesta pendiente aparece como declaración;
4. rutas gravitacionales y laterales separadas;
5. toda función declarada posee al menos una región objetivo o un finding;
6. toda ruta incompleta explica el corte;
7. toda relación con cubierta referencia un borde canónico;
8. todo apoyo a fundación respeta la jerarquía;
9. ningún `verified=true` existe sin escenario y verificador;
10. determinismo e idempotencia.

## Contrato `structural-requirements-v1.0`

```json
{
  "schema": "structural-requirements-v1.0",
  "sourceGeometrySha256": "...",
  "sourceIntentSha256": "...",
  "sourceTopologySha256": "...",
  "elements": [],
  "regions": [],
  "supports": [],
  "transfers": [],
  "gravityPaths": [],
  "lateralPaths": [],
  "findings": [],
  "blockingDecisions": [],
  "eligibleForConstructiveSolutions": false,
  "canonicalSha256": "..."
}
```

`eligibleForConstructiveSolutions=true` significa que una solución puede intentar resolver el
contrato. No significa conformidad ni capacidad.

## Hallazgos

Reutilizar los hallazgos geométricos compatibles de SPEC-14 y añadir:

```text
SR-INTENT-UNRESOLVED
SR-DECLARED-FUNCTION-WITHOUT-REGION
SR-GRAVITY-PATH-INCOMPLETE
SR-LATERAL-PATH-INCOMPLETE
SR-TRANSFER-REQUIRED
SR-DIAPHRAGM-REQUIRED
SR-USER-DECISION-PENDING
SR-SOLUTION-NOT-APPLIED
```

## Caso real obligatorio

La evidencia debe mostrar:

1. geometría completa;
2. intenciones aceptadas;
3. propuestas pendientes y rechazadas diferenciadas;
4. rutas gravitacionales desde techumbre;
5. rutas laterales hacia muros interiores;
6. gaps de transferencia;
7. fundaciones candidatas;
8. regiones resultantes;
9. contrato entregado a una futura solución Metalcon;
10. ausencia total de miembros Metalcon.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: completa la topología estructural agnóstica y redefine la frontera de entrada de todas
  las soluciones constructivas.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Mantener eje estructural como autoridad | Puede clasificar muros sin decisión |
| Usar `forcesStudOnly` | Introduce una pieza de entramado |
| Entregar directamente a SPEC-08 Metalcon | Impide otros sistemas |
| Marcar rutas como verificadas | No existe materialidad ni cálculo |
| Fusionar topología y requisitos | Dificulta distinguir hechos geométricos de exigencias |

## Alcance

- Completar R6–R12.
- Ajustar vocabulario de ejes y muros.
- Producir requisitos estructurales agnósticos.
- Integrar apoyos, techumbre, segmentos y rutas.
- Auditar decisiones pendientes.
- Definir elegibilidad para soluciones.
- Aplicar y visualizar el caso real.
- Mantener determinismo y no mutación.

## Fuera de alcance

- Aplicar Metalcon.
- Generar perfiles, paneles o armaduras.
- Verificar resistencia o rigidez.
- Calcular solicitaciones sísmicas.
- Crear escenarios.
- Migrar `wallTypes`.
- DXF constructivo.

## Criterios de aceptación

1. R0–R12 se ejecutan en orden y conservan las relaciones R0–R5 existentes.
2. La intención por elemento tiene prioridad; los ejes no crean decisiones definitivas.
3. Ningún término o dato Metalcon aparece en la salida.
4. Las rutas gravitacionales y laterales se conservan separadas.
5. Un muro interior lateral con gap produce región candidata y transferencia requerida.
6. Los frontones vinculados a bordes declarados producen apoyos candidatos, no verificados.
7. Cada requisito puede rastrearse a geometría, intención o decisión humana.
8. Propuestas pendientes no se convierten en requisitos aceptados.
9. `eligibleForConstructiveSolutions` sólo es true sin decisiones bloqueantes.
10. Permutaciones equivalentes conservan salida y SHA-256.
11. El fixture real conserva 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas.
12. La evidencia visual cumple la secuencia SPEC → caso real → flujo → hallazgos → ajuste.
13. Prueba de reversión que reintroduzca `wallType.role` falla.
14. Gates, build y cierre pasan.

## Evidencia

- Tests R6–R12.
- Tests del contrato de requisitos.
- Inspección de vocabulario y dependencias.
- Fixture real y casos mínimos.
- SVG/HTML de flujo.
- Pruebas de determinismo.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-015-E.md`.

## Corte sugerido

Detener cuando exista un contrato estructural completo, agnóstico y consumible por adaptadores,
sin implementar todavía ningún sistema constructivo.
