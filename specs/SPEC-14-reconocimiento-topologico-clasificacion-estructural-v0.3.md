# SPEC-14 — Reconocimiento topológico y clasificación estructural v0.3

## Diagnóstico

El cuerpo normativo importado quedaba fuera de G0 por la capitalización de `Spec-14.md` y no
seguía el contrato documental. Su contenido debe permanecer literal y sus pendientes no pueden
resolverse implícitamente durante la normalización.

## Decisión

Conservar el cuerpo importado como un bloque opaco recuperable por marcadores, identificado por
SHA-256 y longitud. Esta envolvente agrega sólo gobernanza; no interpreta ni activa sus reglas.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: la futura implementación involucra topología, esquemas, geometría e intención estructural.

## Alcance

- Preservar íntegramente el cuerpo normativo importado de SPEC-14 v0.3.
- Mantener explícitas las decisiones pendientes del propio cuerpo para futuros cortes.

## Fuera de alcance

- Implementar el reconocedor, resolver decisiones pendientes o conciliarlo con el baseline.
- Modificar código de dominio, React, Tauri, DXF o INP desde esta normalización.

## Criterios de aceptación

1. El extractor recupera exactamente 46.182 bytes con SHA-256
   `6e13b9b3f99bc9117c8f8521ddd76ff6013a82b5f2c84dd899f728b5bcd1d538`.
2. G0 incluye el documento por su nombre canónico y reconoce su esfuerzo futuro.
3. Ninguna regla topológica se considera implementada por esta normalización.

## Evidencia

- `governance/IMPORTED_SPEC_BODIES.json` y `tests/importedSpecsGovernance.test.mjs`.
- Cierre `sessions/close-SPEC-GOV-C.md`.

## Cuerpo normativo importado — preservado literalmente

<!-- IMPORTED-NORMATIVE-BODY:BEGIN sha256=6e13b9b3f99bc9117c8f8521ddd76ff6013a82b5f2c84dd899f728b5bcd1d538 bytes=46182 -->
SPEC-14 · Reconocimiento topológico y clasificación estructural — v0.3

Estado: borrador v0.3 · 2026-08-02.
Base: geometría agnóstica agnostic-geometry-v1.0 + SPEC-08 v2.0 + SPEC-10 v1.0 + SPEC-11 v1.1 + SPEC-12 v1.0.
Posición en pipeline: después de validar la geometría de entrada y antes de SPEC-08.
Propósito: convertir geometría referenciada por ejes y niveles en una topología estructural explícita, trazable y determinista.

────────

0. Cambios consolidados de v0.3

Esta versión incorpora los ajustes derivados de aplicar SPEC-14 v0.2 a los 45 muros de casa-r0:

1. resolución explícita de cruces MID–MID;
2. tratamiento obligatorio por bandas Z de encuentros con cobertura vertical parcial;
3. proximidad encuentro–vano evaluada con envolventes constructivas, no con un umbral fijo aislado;
4. semántica explícita de límites y apoyos de cubierta;
5. búsqueda jerárquica del apoyo vertical inmediato antes de asociar un muro a fundación;
6. conflicto encuentro–vano evaluado tridimensionalmente antes de bloquear.

────────

1. Alcance

SPEC-14 reconoce y clasifica, sin efectuar cálculo resistente:

1. Muros normalizados.
2. Vanos normalizados.
3. Fundaciones y apoyos geométricos.
4. Continuidades colineales.
5. Muros apilados verticalmente.
6. Encuentros de extremo, esquina, T y cruz.
7. Relaciones muro–fundación.
8. Relaciones muro–techumbre.
9. Ejes estructurales y ejes de tabique, cuando esa información esté declarada.
10. Bordes topológicos y efectos estructurales candidatos.
11. Cortes topológicos para segmentación de paños.
12. Ambigüedades que impiden una clasificación segura.

SPEC-14 no determina:

• capacidad resistente;
• perfil requerido;
• tornillos, conectores o anclajes finales;
• si un muro es portante o sísmico cuando el dato no está declarado ni respaldado por una relación explícita;
• transformaciones T-01, T-02 o T-02-A4;
• modulación de montantes, placas o cadenetas;
• representación DXF.

────────

2. Principios normativos

RT-01 · Geometría primero

Toda relación topológica se deriva exclusivamente de coordenadas normalizadas y referencias válidas.

RT-02 · No inferencia resistente silenciosa

La geometría puede demostrar contacto, alineación, continuidad o superposición. No demuestra por sí sola función portante, función sísmica ni capacidad.

RT-03 · Clasificación explícita sobre inferencia

Un dato declarado por el proyecto tiene prioridad sobre una inferencia geométrica, siempre que sea válido y no contradictorio.

RT-04 · Determinismo

Con el mismo JSON de entrada, la misma versión de SPEC-14 y la misma configuración, la salida canónica debe ser byte a byte equivalente después de canonicalización.

RT-05 · Tolerancias declaradas

No se permite usar tolerancias implícitas. Toda comparación geométrica emplea los valores de §5.

RT-06 · Trazabilidad

Cada relación emitida debe indicar:

• entidades de origen;
• regla aplicada;
• evidencia geométrica;
• nivel de certeza;
• hallazgos asociados.

RT-07 · Separación de capas

La salida de SPEC-14 describe qué existe y cómo se relaciona. SPEC-08 decide qué transformación estructural aplicar.

────────

3. Entradas

3.1 Entrada obligatoria

```json
{
  "schema": "agnostic-geometry-v1.0",
  "grid": {},
  "elements": []
}
```

Campos mínimos requeridos:

• grid.xAxes[];
• grid.yAxes[];
• grid.zLevels[];
• elements[type=wall];
• identificadores únicos y resolubles.

3.2 Entrada opcional recomendada

```json
{
  "structuralIntent": {
    "axisRoles": [],
    "wallRoles": [],
    "intersectionIntents": [],
    "roofBoundaryRoles": [],
    "loadPaths": [],
    "diaphragms": [],
    "overrides": []
  }
}
```

Esta sección pertenece a la intención estructural del proyecto, no a la geometría agnóstica.

3.3 Configuración de reconocimiento

```json
{
  "recognitionConfig": {
    "linearTolerance": 0.1,
    "levelTolerance": 0.1,
    "angularToleranceDeg": 0.001,
    "minimumOverlap": 0.1,
    "minimumSupportOverlap": 38.0,
    "minimumSegmentLength": 0.1,
    "openingProximityReviewDistance": 150.0,
    "defaultAssemblyEnvelope": null,
    "roundDecimals": 3
  }
}
```

La ausencia de configuración usa exactamente los valores de §5.

────────

4. Salida

4.1 Esquema

```json
{
  "schema": "recognized-structural-topology-v1.0",
  "sourceSchema": "agnostic-geometry-v1.0",
  "specVersion": "SPEC-14-v0.3",
  "config": {},
  "axes": [],
  "levels": [],
  "walls": [],
  "openings": [],
  "foundations": [],
  "roofSupports": [],
  "verticalSupports": [],
  "relations": [],
  "nodes": [],
  "segments": [],
  "findings": [],
  "canonicalSha256": ""
}
```

4.2 Niveles de certeza

|Valor      |Significado                                                 |
|-----------|------------------------------------------------------------|
|`declared` |Declarado explícitamente en la entrada                      |
|`derived`  |Deducido sin ambigüedad mediante una regla geométrica       |
|`candidate`|Geométricamente posible, pero requiere intención estructural|
|`ambiguous`|Existen dos o más clasificaciones válidas                   |
|`invalid`  |La geometría o referencia no permite construir la relación  |

────────

5. Tolerancias y canonicalización

|Parámetro                          |Valor por defecto|
|-----------------------------------|----------------:|
|`TOL_LINEAR`                       |0.1 mm           |
|`TOL_LEVEL`                        |0.1 mm           |
|`TOL_ANGLE`                        |0.001°           |
|`MIN_OVERLAP`                      |0.1 mm           |
|`MIN_SUPPORT_OVERLAP`              |38.0 mm          |
|`MIN_SEGMENT`                      |0.1 mm           |
|`OPENING_PROXIMITY_REVIEW_DISTANCE`|150.0 mm         |
|`DEFAULT_ASSEMBLY_ENVELOPE`        |`null`           |
|`ROUND_DECIMALS`                   |3                |

Reglas:

1. Resolver referencias antes de redondear.
2. Comparar usando tolerancias.
3. Redondear solo la salida canónica.
4. Ordenar listas por claves estables.
5. No usar el orden original del JSON como criterio geométrico.
6. Los IDs generados se derivan de claves semánticas estables, nunca de fecha, contador global o aleatoriedad.

Ejemplo de clave estable:

```text
relation|T_MID|wall:1784...|other:1785...|s:4200.000
```

────────

6. Fase R0 — Validación de referencias

R-REF-01 · IDs únicos

Todo id de eje, nivel, muro, vano, fundación y sistema de techumbre debe ser único dentro de su dominio.

Falla: RT-REF-DUPLICATE-ID.

R-REF-02 · Referencias resolubles

Deben resolverse:

• xStart, xEnd → xAxes.id;
• yStart, yEnd → yAxes.id;
• bottomZ, topZ, levelZ, supportLevelId → zLevels.id;
• wallLowId, wallHighId → muros existentes;
• referenceAxisId → eje compatible con axisType.

Falla: RT-REF-NOT-FOUND.

R-REF-03 · Dirección coherente

Para un muro direction=x:

• yStart == yEnd geométricamente;
• xStart != xEnd.

Para direction=y:

• xStart == xEnd geométricamente;
• yStart != yEnd.

Falla: RT-WALL-DIRECTION-MISMATCH.

R-REF-04 · Intervalo vertical válido

Debe cumplirse:

```text
topZ > bottomZ
```

Falla: RT-WALL-Z-INVALID.

────────

7. Fase R1 — Normalización geométrica

Cada muro se transforma a una representación canónica independiente del sentido original.

```json
{
  "wallId": 1784600403613,
  "axis": "x",
  "fixed": 0.0,
  "s0": 3000.0,
  "s1": 14500.0,
  "z0": 450.0,
  "z1": 4150.0,
  "length": 11500.0,
  "height": 3700.0,
  "source": {
    "startAxisId": 1784561646114,
    "endAxisId": 1784561646959,
    "fixedAxisId": 1784561925979
  }
}
```

Reglas:

• s0 = min(coordenadaInicio, coordenadaFin);
• s1 = max(...);
• fixed es la coordenada perpendicular constante;
• z0 y z1 son elevaciones absolutas;
• localS = worldS - s0;
• orientación canónica: X positivo o Y positivo.

R-NORM-01 · Longitud positiva

```text
length = s1 - s0 > MIN_SEGMENT
```

Falla: RT-WALL-ZERO-LENGTH.

R-NORM-02 · Vano dentro del dominio longitudinal

Para cada vano:

```text
openingS0 = position - width/2
openingS1 = position + width/2
```

Debe cumplirse:

```text
s0 - TOL_LINEAR <= openingS0
openingS1 <= s1 + TOL_LINEAR
```

Falla: RT-OPENING-OUTSIDE-WALL.

R-NORM-03 · Vano dentro del dominio vertical

```text
openingZ0 = z0 + sillHeight
openingZ1 = openingZ0 + height
```

Debe cumplirse:

```text
z0 - TOL_LEVEL <= openingZ0
openingZ1 <= z1 + TOL_LEVEL
```

Falla: RT-OPENING-Z-OUTSIDE-WALL.

R-NORM-04 · Vanos superpuestos

Dos vanos del mismo muro se consideran superpuestos solo si sus intervalos longitudinales y verticales se intersectan con longitud mayor que MIN_OVERLAP.

Hallazgo: RT-OPENING-OVERLAP.

Vanos apilados verticalmente con igual proyección longitudinal no se consideran error.

────────

8. Fase R2 — Agrupación por línea soporte

R-LINE-01 · Línea soporte

Dos muros pertenecen a la misma línea soporte cuando:

• tienen la misma dirección;
• sus coordenadas fixed difieren como máximo TOL_LINEAR.

Clave canónica:

```text
axis=x|fixed=1200.000
axis=y|fixed=12800.000
```

R-LINE-02 · Intervalos colineales

Para muros de la misma línea se calcula:

```text
overlapS = min(a.s1,b.s1) - max(a.s0,b.s0)
gapS = max(a.s0,b.s0) - min(a.s1,b.s1)
```

Clasificación:

|Condición                                     |Relación              |
|----------------------------------------------|----------------------|
|`overlapS > MIN_OVERLAP` y solapan en Z       |`COLLINEAR_OVERLAP`   |
|`abs(gapS) <= TOL_LINEAR` y solapan en Z      |`COLLINEAR_CONTIGUOUS`|
|`gapS > TOL_LINEAR`                           |`COLLINEAR_SEPARATED` |
|misma proyección S y contacto/continuidad en Z|evaluar R-STACK       |

COLLINEAR_OVERLAP es inválido salvo que una regla de apilamiento vertical lo explique.

Hallazgo: RT-COLLINEAR-DUPLICATE.

R-LINE-03 · Cadena colineal

Muros COLLINEAR_CONTIGUOUS forman una cadena ordenada por (s0,s1,z0,z1,id).

La cadena no fusiona entidades. Solo crea una relación de continuidad geométrica.

────────

9. Fase R3 — Muros apilados

R-STACK-01 · Apilamiento exacto

Dos muros son apilados cuando:

• misma línea soporte;
• sus intervalos S coinciden dentro de tolerancia;
• abs(inferior.z1 - superior.z0) <= TOL_LEVEL.

Relación: STACKED_EXACT.

R-STACK-02 · Apilamiento parcial

Si existe solape longitudinal positivo, pero los intervalos S no coinciden:

Relación: STACKED_PARTIAL.

Debe emitirse un nodo en cada extremo del intervalo común.

R-STACK-03 · Superposición vertical

Si los intervalos Z se superponen en una misma línea y también se superponen en S:

Relación inválida: STACKED_OVERLAP.

Hallazgo: RT-WALL-VOLUME-OVERLAP.

R-STACK-04 · Discontinuidad vertical

Si existe separación vertical:

```text
gapZ = superior.z0 - inferior.z1 > TOL_LEVEL
```

Relación: STACKED_GAP, certeza candidate.

Hallazgo: RT-VERTICAL-LOAD-PATH-GAP.

────────

10. Fase R4 — Intersecciones entre muros perpendiculares

Sea A horizontal y B vertical. El punto teórico de intersección es:

```text
P = (B.fixed, A.fixed)
```

El punto pertenece al dominio de A si:

```text
A.s0 - TOL_LINEAR <= P.x <= A.s1 + TOL_LINEAR
```

Pertenece al dominio de B si:

```text
B.s0 - TOL_LINEAR <= P.y <= B.s1 + TOL_LINEAR
```

Además, los intervalos Z deben solaparse:

```text
overlapZ = min(A.z1,B.z1) - max(A.z0,B.z0) > MIN_OVERLAP
```

R-INT-01 · Estado longitudinal de un punto

Para cada muro:

|Estado   |Condición                          |
|---------|-----------------------------------|
|`START`  |`abs(p-s0) <= TOL_LINEAR`          |
|`END`    |`abs(p-s1) <= TOL_LINEAR`          |
|`MID`    |`s0+TOL_LINEAR < p < s1-TOL_LINEAR`|
|`OUTSIDE`|fuera del intervalo                |

R-INT-02 · Clasificación de encuentro

|Estado A|Estado B|Relación        |
|--------|--------|----------------|
|extremo |extremo |`CORNER_END_END`|
|extremo |MID     |`T_END_MID`     |
|MID     |extremo |`T_MID_END`     |
|MID     |MID     |`CROSS_MID_MID` |

La relación se expresa desde ambos muros, pero se almacena una sola vez con orden canónico de IDs.

R-INT-03 · Cobertura vertical del encuentro

Toda intersección perpendicular debe registrar explícitamente su cobertura vertical. No basta con conservar únicamente overlapZ.

Se calculan:

```text
zOverlap0 = max(A.z0,B.z0)
zOverlap1 = min(A.z1,B.z1)
overlapZ  = zOverlap1-zOverlap0
coverageA = overlapZ/(A.z1-A.z0)
coverageB = overlapZ/(B.z1-B.z0)
```

Clasificación:

|Condición                    |`verticalContactType`|
|-----------------------------|---------------------|
|`coverageA≈1` y `coverageB≈1`|`FULL_BOTH`          |
|`coverageA≈1` y `coverageB<1`|`FULL_A_PARTIAL_B`   |
|`coverageA<1` y `coverageB≈1`|`PARTIAL_A_FULL_B`   |
|`coverageA<1` y `coverageB<1`|`PARTIAL_BOTH`       |

Se considera cobertura completa cuando:

```text
abs(coverage-1.0) <= TOL_LEVEL/(altura del muro)
```

La relación debe incluir, como mínimo:

```json
{
  "zOverlap": [450.0, 3250.0],
  "overlapZ": 2800.0,
  "coverageA": 0.757,
  "coverageB": 1.0,
  "verticalContactType": "PARTIAL_A_FULL_B",
  "visibleInFlow": true
}
```

Cuando el contacto no sea FULL_BOTH:

• mantener la relación geométrica;
• emitir RT-INTERSECTION-PARTIAL-Z;
• mostrar obligatoriamente el intervalo común y las alturas no coincidentes en la auditoría visual;
• impedir que la salida reduzca el encuentro a una relación puramente bidimensional.

R-INT-04 · Cruce MID–MID

Un CROSS_MID_MID nunca se interpreta automáticamente como conexión estructural.

La intención debe declararse mediante structuralIntent.intersectionIntents[]:

```json
{
  "wallAId": 1784606313849,
  "wallBId": 1784752583321,
  "intent": "wallBContinues"
}
```

Valores permitidos:

```text
connected
wallAContinues
wallBContinues
bothContinue
noPhysicalConnection
```

Interpretación:

|`intent`              |Resultado topológico                                                    |
|----------------------|------------------------------------------------------------------------|
|`connected`           |ambos muros se conectan y el cruce se conserva como nodo compartido     |
|`wallAContinues`      |A continúa; B termina o se resuelve contra A                            |
|`wallBContinues`      |B continúa; A termina o se resuelve contra B                            |
|`bothContinue`        |ambos atraviesan el punto; la conexión resistente sigue siendo candidata|
|`noPhysicalConnection`|la coincidencia en planta no genera conexión física                     |

Sin declaración:

• relación: CROSS_MID_MID;
• certeza: ambiguous;
• hallazgo bloqueante: RT-CROSS-STRUCTURAL-INTENT-REQUIRED;
• SPEC-08 no puede ejecutarse sobre los segmentos afectados.

Con declaración válida, el hallazgo se cierra y la relación registra resolvedBy=structuralIntent.intersectionIntents.

R-INT-05 · Encuentros con cobertura Z parcial

Toda relación distinta de FULL_BOTH se conserva y se descompone obligatoriamente en bandas verticales:

1. banda común de encuentro;
2. banda exclusiva de A, si existe;
3. banda exclusiva de B, si existe.

La banda común puede producir efectos de encuentro. Las bandas exclusivas no heredan automáticamente continuidad, respaldo, transferencia ni borde estructural.

Salida mínima:

```json
{
  "verticalBands": [
    {"z0":450,"z1":3250,"state":"intersectionActive"},
    {"z0":3250,"z1":4150,"state":"wallAOnly"}
  ]
}
```

RT-INTERSECTION-PARTIAL-Z mantiene severidad warning, no bloquea el reconocimiento y debe mostrarse en la validación visual.

────────

11. Fase R5 — Nodos topológicos

Se genera un nodo por cada posición longitudinal significativa de un muro:

1. extremo inicial;
2. extremo final;
3. borde inicial de vano;
4. borde final de vano;
5. eje de encuentro perpendicular;
6. cambio de apilamiento;
7. límite de apoyo de fundación;
8. posición de carga o apoyo de techumbre declarada.

R-NODE-01 · Unificación

Nodos del mismo muro con coordenadas separadas por no más de TOL_LINEAR se unifican.

Prioridad semántica:

```text
wallEnd > openingEdge > structuralIntersection > roofSupport > foundationLimit > partitionIntersection > auxiliary
```

La unificación no elimina etiquetas secundarias; las conserva en roles[].

R-NODE-02 · Orden

Los nodos se ordenan por:

```text
wallId, localS, z0, nodeType, stableId
```

────────

12. Fase R6 — Rol de ejes

R-AXIS-01 · Fuente de rol

El rol de un eje se resuelve en este orden:

1. structuralIntent.axisRoles;
2. grid.*Axes[].structuralRole, si existe;
3. configuración externa versionada del proyecto;
4. sin dato: unknown.

Valores permitidos:

```text
structural
partition
mixed
unknown
```

R-AXIS-02 · Prohibición de hardcode global

La lista de ejes estructurales de casa-L no forma parte de la regla general. Debe almacenarse como configuración del caso.

Ejemplo:

```json
{
  "projectId": "casa-L",
  "axisRoles": [
    {"axis":"x","label":"1","role":"structural"},
    {"axis":"x","label":"3","role":"partition"},
    {"axis":"y","label":"A","role":"structural"},
    {"axis":"y","label":"C1","role":"partition"}
  ]
}
```

R-AXIS-03 · Eje auxiliar

Un eje con type=aux puede participar en geometría, pero su rol estructural es unknown salvo declaración explícita.

Hallazgo: RT-AUX-AXIS-ROLE-UNDECLARED cuando intervenga en una decisión estructural.

────────

13. Fase R7 — Rol preliminar del muro

El rol preliminar no constituye verificación resistente.

Valores:

```text
loadBearing
shearCandidate
loadBearingAndShearCandidate
partition
nonStructuralEnvelope
unknown
```

R-WROLE-01 · Rol declarado

structuralIntent.wallRoles tiene prioridad.

R-WROLE-02 · Tabique declarado por eje

Un muro sobre eje partition se clasifica partition, salvo override explícito.

R-WROLE-03 · Eje estructural

Un muro sobre eje structural se clasifica shearCandidate, no shearWall.

La palabra candidate es obligatoria porque la geometría no verifica capacidad, anclaje, revestimiento ni continuidad resistente.

R-WROLE-04 · Apoyo de techumbre

Si un roofSystem declara el muro como wallLowId o wallHighId, el muro recibe:

```text
supportsRoofGeometry = true
```

Esto permite clasificarlo como loadBearing solo cuando el contrato de roofSystem declara que dichos muros son apoyos resistentes.

Mientras ese contrato no exista:

```text
loadBearingCandidate = true
```

Hallazgo: RT-ROOF-SUPPORT-SEMANTICS-UNDECLARED.

R-WROLE-05 · Fundación coincidente

La existencia de fundación bajo un muro no demuestra por sí sola que sea portante. Se registra:

```text
hasFoundationGeometry = true
```

No se cambia automáticamente el rol del muro.

────────

14. Fase R8 — Resolución jerárquica de apoyos verticales

SPEC-14 debe buscar primero el apoyo vertical inmediato. Una coincidencia en planta con una fundación no basta para asociarla directamente a un muro superior.

R-SUP-01 · Orden obligatorio de búsqueda

Para cada muro se evalúa, en este orden:

1. muro colineal directamente inferior;
2. elemento horizontal de transferencia declarado;
3. fundación cuya coronación coincida con wall.z0;
4. apoyo geométrico no resuelto.

La primera relación válida gobierna. No se salta directamente a fundación si existe un apoyo intermedio compatible.

R-SUP-02 · Muro directamente inferior

Un muro inferior es candidato cuando:

• comparte línea soporte;
• existe solape longitudinal mayor que MIN_SUPPORT_OVERLAP;
• abs(inferior.z1-superior.z0) <= TOL_LEVEL.

Relaciones:

```text
SUPPORTED_BY_WALL_FULL
SUPPORTED_BY_WALL_PARTIAL
```

La relación debe indicar el intervalo común y no convierte automáticamente ninguno de los muros en portante.

R-SUP-03 · Elemento de transferencia

Cuando una viga, dintel maestro, losa o elemento horizontal esté declarado en la entrada, puede producir:

```text
SUPPORTED_BY_TRANSFER_ELEMENT
```

La geometría agnóstica actual puede no contener este tipo de elemento. En ese caso no se inventa.

R-FND-01 · Coincidencia de línea

Una fundación es candidata cuando tiene la misma dirección y abs(fixedWall-fixedFoundation) <= TOL_LINEAR.

R-FND-02 · Solape longitudinal

```text
supportS0 = max(wall.s0, foundation.s0)
supportS1 = min(wall.s1, foundation.s1)
supportLength = supportS1-supportS0
```

R-FND-03 · Semántica vertical

Para foundationType=corrida:

```text
supportElevation = elevation(levelZ) + topOffset
```

Solo se crea relación directa muro–fundación cuando:

```text
abs(wall.z0-supportElevation) <= TOL_LEVEL
```

Clasificación longitudinal:

|Condición                     |Relación                      |
|------------------------------|------------------------------|
|cubre el muro completo        |`FOUNDATION_FULL_SUPPORT`     |
|solape ≥ `MIN_SUPPORT_OVERLAP`|`FOUNDATION_PARTIAL_SUPPORT`  |
|solape positivo menor         |`FOUNDATION_POINTLIKE_SUPPORT`|

Si wall.z0 > supportElevation + TOL_LEVEL:

• no se emite FOUNDATION_FULL_SUPPORT ni FOUNDATION_PARTIAL_SUPPORT;
• se continúa buscando apoyo inmediato superior a la fundación;
• si no existe, se emite RT-VERTICAL-SUPPORT-UNRESOLVED;
• RT-FOUNDATION-VERTICAL-GAP queda reservado para geometrías que declaren explícitamente apoyo directo pese a la separación.

Si wall.z0 < supportElevation-TOL_LEVEL, se emite RT-FOUNDATION-WALL-PENETRATION.

R-FND-04 · Extremo sin apoyo

Un muro declarado portante y sin apoyo inmediato genera RT-LOAD-BEARING-WALL-UNSUPPORTED.

Un muro sin rol portante genera RT-VERTICAL-SUPPORT-UNRESOLVED con severidad warning.

────────

15. Fase R9 — Asociación muro–techumbre

R-ROOF-01 · Relación geométrica de borde

boundaryWallId, wallLowId o wallHighId crean una relación geométrica declarada con la cubierta, pero no demuestran por sí mismos apoyo resistente.

Relaciones geométricas permitidas:

```text
ROOF_BOUNDARY
ROOF_BOUNDARY_LOW
ROOF_BOUNDARY_HIGH
```

R-ROOF-02 · Semántica del límite de cubierta

La función debe declararse mediante structuralIntent.roofBoundaryRoles[] o un campo equivalente del sistema de cubierta:

```json
{
  "roofGeometryId": 1785030887081,
  "wallId": 1784600403613,
  "boundaryRole": "loadBearingSupport"
}
```

Valores permitidos:

```text
loadBearingSupport
lateralSupport
geometricBoundary
gutterSupport
nonStructuralBoundary
unknown
```

Efectos:

|`boundaryRole`         |Efecto preliminar                                        |
|-----------------------|---------------------------------------------------------|
|`loadBearingSupport`   |`loadBearingCandidate=true` y `supportsRoofGeometry=true`|
|`lateralSupport`       |apoyo lateral candidato, sin inferir carga vertical      |
|`gutterSupport`        |soporte local de canal, sin inferir muro portante        |
|`geometricBoundary`    |solo límite geométrico                                   |
|`nonStructuralBoundary`|sin función resistente                                   |
|`unknown` o ausente    |emitir advertencia                                       |

Cuando falte la semántica:

• conservar la relación geométrica;
• no clasificar automáticamente el muro como portante;
• emitir RT-ROOF-SUPPORT-SEMANTICS-UNDECLARED;
• mantener loadBearingCandidate sin resolver solo si la geometría sugiere apoyo.

R-ROOF-03 · Posiciones de carga declaradas

Cuando existan posiciones de cercha, viga o apoyo puntual, cada posición se proyecta sobre el muro correspondiente y genera un nodo roofLoadPosition.

R-ROOF-04 · Posición fuera del apoyo

Hallazgo: RT-TRUSS-POSITION-OUTSIDE-SUPPORT.

R-ROOF-05 · Duplicación de límites

Cuando un mismo muro participa en varias cubiertas, las relaciones se mantienen separadas por roofGeometryId o roofSystemId.

────────

16. Fase R10 — Bordes topológicos y efecto estructural candidato

SPEC-14 no crea jambas ni perfiles. En esta fase separa dos conceptos que no deben confundirse:

1. Borde topológico: posición que divide el dominio geométrico del muro.
2. Efecto estructural candidato: consecuencia que esa posición podría producir en la modulación posterior.

Todo borde se almacena con ambos campos:

```json
{
  "boundaryType": "perpendicularIntersection",
  "topologicalCut": true,
  "structuralEffect": "cutsStructuralPanel",
  "confidence": "derived"
}
```

Tipos topológicos:

```text
wallStart
wallEnd
openingLeft
openingRight
perpendicularIntersection
crossing
stackBoundary
foundationBoundary
roofLoadPosition
```

Efectos estructurales candidatos:

```text
physicalWallLimit
openingLimit
cutsStructuralPanel
forcesStudOnly
loadTransferCandidate
supportTransition
noStructuralEffect
unresolved
```

R-EDGE-01 · Encuentro estructural

Un T_*_MID segmenta el futuro paño solo si el eje perpendicular tiene rol structural.

Salida:

```text
boundaryType = perpendicularIntersection
topologicalCut = true
structuralEffect = cutsStructuralPanel
```

R-EDGE-02 · Encuentro tabique

Si el eje perpendicular es partition:

```text
boundaryType = perpendicularIntersection
topologicalCut = true
structuralEffect = forcesStudOnly
```

R-EDGE-03 · Rol desconocido

Si el eje es unknown:

```text
topologicalCut = true
structuralEffect = unresolved
```

Hallazgo bloqueante para SPEC-08:

RT-INTERSECTION-AXIS-ROLE-UNKNOWN.

R-EDGE-04 · Borde de vano

Todo borde de vano es corte topológico, aunque existan dos vanos apilados con la misma proyección horizontal.

```text
boundaryType = openingLeft | openingRight
topologicalCut = true
structuralEffect = openingLimit
```

Los intervalos verticales del vano deben conservarse para que SPEC-08 distinga bandas y vanos apilados.

R-EDGE-05 · Regla de independencia

topologicalCut=true no significa automáticamente que el borde corte un futuro paño estructural.

Ejemplos:

|Caso               |Corte topológico|Efecto estructural   |
|-------------------|---------------:|---------------------|
|Extremo del muro   |sí              |`physicalWallLimit`  |
|Borde de vano      |sí              |`openingLimit`       |
|T estructural      |sí              |`cutsStructuralPanel`|
|T de tabique       |sí              |`forcesStudOnly`     |
|Límite de fundación|sí              |`supportTransition`  |
|Nodo auxiliar      |sí              |`noStructuralEffect` |

SPEC-08 debe consultar structuralEffect; no puede inferirlo solo desde la existencia del nodo.

────────

17. Fase R11 — Segmentos topológicos candidatos

Los segmentos se forman entre nodos consecutivos de cada muro.

```json
{
  "segmentId": "seg:wall:1784...:3000.000:4200.000",
  "wallId": 1784600403613,
  "s0": 3000.0,
  "s1": 4200.0,
  "length": 1200.0,
  "leftBoundary": {},
  "rightBoundary": {},
  "activeOpenings": [],
  "axisRole": "structural",
  "topologicalState": "free",
  "structuralUse": "candidate"
}
```

R-SEG-01 · Segmento nulo

Segmentos con longitud <= MIN_SEGMENT no se emiten.

Sus nodos se unifican y se registra RT-NODE-COLLAPSED.

R-SEG-02 · Estado topológico del segmento

Un segmento puede estar:

• libre en toda la altura;
• ocupado parcialmente por vano;
• ocupado por varios vanos apilados;
• fuera del intervalo vertical de un muro apilado.

SPEC-14 conserva la ocupación tridimensional y emite:

```json
{
  "topologicalState": "free|openingOccupied|multiOpening|stackExcluded",
  "activeOpenings": [],
  "zBands": []
}
```

R-SEG-03 · Utilidad estructural candidata

La utilidad estructural del segmento se almacena separadamente:

```json
{
  "structuralUse": "candidate|excluded|unresolved",
  "exclusionReasons": [],
  "governingBoundaries": []
}
```

Reglas:

• free no equivale automáticamente a candidate;
• un segmento ocupado por vano puede contener bandas estructurales superior o inferior;
• un segmento entre dos bordes topológicos de tabique puede seguir perteneciendo al mismo futuro paño resistente;
• SPEC-14 no evalúa todavía relación H/L, capacidad ni requisitos de revestimiento.

R-SEG-04 · Contrato para SPEC-08

SPEC-08 recibe:

• límites longitudinales;
• altura efectiva por intervalo Z;
• tipos de borde topológico;
• efectos estructurales candidatos;
• estado topológico del segmento;
• utilidad estructural candidata;
• vanos activos;
• rol del eje;
• rol preliminar del muro;
• relaciones de apoyo inmediato y su jerarquía;
• semántica declarada de límites de cubierta;
• posiciones de carga declaradas;
• hallazgos bloqueantes.

────────

18. Prioridad y resolución de conflictos

Cuando varias reglas afectan la misma posición:

1. Borde físico de muro.
2. Borde de vano.
3. Encuentro estructural.
4. Límite de apilamiento.
5. Posición de carga de techumbre.
6. Límite de fundación.
7. Encuentro de tabique.
8. Eje auxiliar.

La prioridad selecciona el rol principal, no elimina roles secundarios.

R-CONFLICT-01 · Encuentro y vano: evaluación tridimensional

Un encuentro no se considera dentro de un vano únicamente porque su eje caiga en la proyección longitudinal del vano. Debe existir solape tridimensional efectivo entre:

• posición o envolvente horizontal del encuentro;
• intervalo longitudinal del vano;
• intervalo Z del encuentro;
• intervalo Z del vano;
• espesores o envolventes físicas disponibles.

Se calculan:

```text
overlapS3D
overlapZ3D
assemblyEnvelopeA
assemblyEnvelopeB
```

Clasificación:

|Resultado                                            |Hallazgo                            |Severidad |
|-----------------------------------------------------|------------------------------------|----------|
|solo coincidencia del eje en planta                  |`RT-INTERSECTION-OPENING-PROJECTION`|`info`    |
|solape 3D probable, pero faltan espesores/envolventes|`RT-INTERSECTION-INSIDE-OPENING`    |`warning` |
|solape 3D confirmado                                 |`RT-INTERSECTION-INSIDE-OPENING`    |`blocking`|

SPEC-14 no desplaza automáticamente el encuentro ni el vano.

R-CONFLICT-02 · Proximidad encuentro–borde de vano

OPENING_PROXIMITY_REVIEW_DISTANCE=150 mm es una distancia de revisión, no un criterio geométrico de error.

La distancia debe medirse contra la referencia declarada disponible:

1. cara exterior de jamba, si existe;
2. envolvente física del ensamblaje, si existe;
3. cara física del muro;
4. eje geométrico, solo como último recurso.

Salida mínima:

```json
{
  "measuredFrom": "openingEdge|jambFace|assemblyEnvelope|wallAxis",
  "distance": 45.0,
  "requiredClearance": null,
  "status": "review|clear|conflict"
}
```

Reglas:

• distancia menor a 150 mm y sin envolvente: review, advertencia;
• envolventes compatibles: clear, sin hallazgo;
• solape de envolventes: conflict, bloqueante para SPEC-08;
• SPEC-08 debe recalcular con el ancho real del ensamblaje.

Hallazgo de revisión: RT-INTERSECTION-OPENING-PROXIMITY.

R-CONFLICT-03 · Apoyo de techumbre sobre vano

Si una posición de carga cae dentro de un vano:

RT-ROOF-LOAD-OVER-OPENING.

Bloquea la modulación automática hasta que SPEC-08 resuelva la transferencia.

────────

19. Catálogo de hallazgos

Referencias y geometría

• RT-REF-DUPLICATE-ID
• RT-REF-NOT-FOUND
• RT-WALL-DIRECTION-MISMATCH
• RT-WALL-Z-INVALID
• RT-WALL-ZERO-LENGTH
• RT-OPENING-OUTSIDE-WALL
• RT-OPENING-Z-OUTSIDE-WALL
• RT-OPENING-OVERLAP
• RT-COLLINEAR-DUPLICATE
• RT-WALL-VOLUME-OVERLAP

Topología

• RT-INTERSECTION-PARTIAL-Z
• RT-CROSS-STRUCTURAL-INTENT-REQUIRED
• RT-NODE-COLLAPSED
• RT-INTERSECTION-OPENING-PROJECTION
• RT-INTERSECTION-INSIDE-OPENING
• RT-INTERSECTION-OPENING-PROXIMITY

Clasificación

• RT-AUX-AXIS-ROLE-UNDECLARED
• RT-INTERSECTION-AXIS-ROLE-UNKNOWN
• RT-ROOF-SUPPORT-SEMANTICS-UNDECLARED
• RT-FOUNDATION-DATUM-SEMANTICS-UNDECLARED
• RT-FOUNDATION-VERTICAL-GAP
• RT-FOUNDATION-WALL-PENETRATION

Camino de cargas candidato

• RT-VERTICAL-SUPPORT-UNRESOLVED
• RT-VERTICAL-LOAD-PATH-GAP
• RT-LOAD-BEARING-WALL-UNSUPPORTED
• RT-WALL-FOUNDATION-PARTIAL
• RT-TRUSS-POSITION-OUTSIDE-SUPPORT
• RT-ROOF-LOAD-OVER-OPENING

Severidad

|Severidad |Efecto                                                         |
|----------|---------------------------------------------------------------|
|`error`   |No puede producirse topología válida                           |
|`blocking`|Topología válida, pero SPEC-08 no puede decidir automáticamente|
|`warning` |Requiere revisión; puede continuar con trazabilidad            |
|`info`    |Hecho relevante sin conflicto                                  |

────────

20. Orden obligatorio del pipeline

```text
R0  validar referencias
R1  normalizar geometría
R2  agrupar por línea soporte
R3  detectar apilamientos
R4  detectar intersecciones perpendiculares
R5  construir nodos
R6  resolver rol de ejes
R7  resolver rol preliminar de muros
R8  asociar fundaciones
R9  asociar techumbre
R10 etiquetar bordes candidatos
R11 construir segmentos topológicos
R12 auditar invariantes
R13 canonicalizar y calcular SHA-256
```

No se permite ejecutar SPEC-08 antes de completar R12 sin errores.

────────

21. Validación visual obligatoria del flujo

Toda versión nueva o modificada de una SPEC que transforme geometría debe validarse con al menos un caso real antes de aprobarse.

R-VIS-01 · Secuencia mínima

```text
SPEC → caso real → ejecución paso a paso → visualización → hallazgos → ajuste de reglas
```

R-VIS-02 · Contenido mínimo

La visualización debe mostrar:

1. datos de entrada utilizados;
2. fases ejecutadas en orden;
3. geometría antes y después de cada fase relevante;
4. nodos, relaciones y segmentos generados;
5. reglas aplicadas y resultado de cada regla;
6. niveles de certeza;
7. hallazgos y decisiones pendientes;
8. contrato entregado a la SPEC siguiente.

R-VIS-03 · Caso de regresión

El caso visual aprobado debe conservarse como caso de regresión versionado. Un cambio posterior que altere el resultado debe:

• explicar la causa;
• actualizar la visualización;
• registrar el cambio en el historial;
• producir un nuevo hash canónico esperado.

R-VIS-04 · No sustitución de auditoría

La validación visual complementa, pero no reemplaza:

• pruebas automatizadas;
• auditoría de invariantes;
• determinismo;
• idempotencia;
• revisión técnica humana.

R-VIS-05 · Evidencia del caso casa-L

La primera evidencia de esta regla corresponde al muro 1784670218571 sobre eje H. Debe mantenerse como referencia visual de R0–R11 para SPEC-14.

────────

22. Invariantes de auditoría

V-RT-01 · Referencias

Cero referencias no resueltas.

V-RT-02 · Dominio

Todo muro tiene longitud y altura positivas.

V-RT-03 · Vanos

Todo vano pertenece a un único muro y se encuentra dentro de su dominio.

V-RT-04 · Relaciones únicas

No existen relaciones duplicadas para la misma clave canónica.

V-RT-05 · Simetría

Toda relación entre dos muros es consultable desde ambos participantes.

V-RT-06 · Nodos ordenados

Los nodos de cada muro son estrictamente crecientes en localS después de unificación.

V-RT-07 · Cobertura de segmentos

La unión de segmentos topológicos cubre exactamente [0,L], sin huecos ni superposiciones, salvo intervalos explícitamente excluidos.

V-RT-08 · Rol de corte resuelto

Todo encuentro T usado para segmentar paños tiene rol de eje structural o partition; nunca unknown.

V-RT-09 · Determinismo

Dos ejecuciones sobre la misma entrada producen el mismo canonicalSha256.

V-RT-10 · No mutación

SPEC-14 no modifica el JSON agnóstico de origen.

V-RT-11 · Apoyo vertical inmediato

Ningún muro con z0 superior a la coronación de fundación puede recibir una relación directa FOUNDATION_* si existe un apoyo intermedio compatible o si la cota no coincide.

V-RT-12 · Cruce resuelto

Todo CROSS_MID_MID entregado a SPEC-08 posee una intención válida o permanece bloqueado.

V-RT-13 · Conflicto vano–encuentro

Un conflicto bloqueante dentro de vano requiere evidencia tridimensional o una envolvente constructiva declarada.

V-RT-14 · Semántica de cubierta

Ninguna relación geométrica de cubierta clasifica automáticamente un muro como portante sin boundaryRole=loadBearingSupport o declaración equivalente.

────────

23. Reglas específicas para casa-L

Estas reglas son configuración del caso, no parte universal de SPEC-14.

22.1 Roles de ejes

```json
{
  "projectId": "casa-L",
  "axisRoles": {
    "structural": [
      "1","2","4","6","7","9","11","11A","13","15","16",
      "A","B","C","F","G","H","I","J","M","N","O"
    ],
    "partition": [
      "3","5","8","10","12","14","C1","D","K","L"
    ]
  }
}
```

22.2 Ejes auxiliares

aux, aux2 y aux3 permanecen unknown hasta declarar su función.

22.3 Fundaciones

El JSON actual contiene solo cuatro fundaciones corridas. SPEC-14 debe reconocerlas como geometría parcial de apoyo y no asumir que los demás muros carecen definitivamente de fundación.

22.4 Techumbre

roofSystems contiene perfiles, modulación y posiciones de cercha. Para mantener una entrada agnóstica futura, se recomienda separar:

```text
roofGeometry
roofStructuralIntent
roofStructuralSolution
```

En la versión actual, SPEC-14 consume solo:

• IDs de muros límite;
• geometría del faldón;
• dirección;
• posición de cerchas;
• cota de apoyo.

Ignora perfiles y patrón reticulado para reconocimiento topológico.

────────

24. Contrato de entrega a SPEC-08

SPEC-14 debe entregar por muro:

```json
{
  "wallId": 1784600403613,
  "geometry": {
    "axis": "x",
    "fixed": 0.0,
    "s0": 3000.0,
    "s1": 14500.0,
    "z0": 450.0,
    "z1": 4150.0
  },
  "classification": {
    "axisRole": "structural",
    "wallRole": "loadBearingAndShearCandidate",
    "confidence": "candidate"
  },
  "relations": {
    "intersections": [],
    "collinear": [],
    "stacked": [],
    "verticalSupports": [],
    "foundations": [],
    "roofBoundaries": []
  },
  "boundaries": [],
  "segments": [],
  "blockingFindings": []
}
```

SPEC-08 puede transformar únicamente cuando:

1. no hay errores de SPEC-14;
2. cada encuentro relevante tiene rol resuelto;
3. los límites de paño están ordenados y no son ambiguos;
4. los vanos están normalizados;
5. las posiciones de carga concentrada declaradas están asociadas a un muro o marcadas como hallazgo;
6. todo cruce MID–MID está resuelto o excluido;
7. toda asociación vertical usa el apoyo inmediato;
8. los conflictos encuentro–vano bloqueantes poseen evidencia tridimensional.

────────

25. Algoritmo de referencia

```python
def recognize_topology(model, config):
    indexes = validate_and_index(model)
    axes = normalize_axes(indexes, config)
    levels = normalize_levels(indexes, config)
    walls = normalize_walls(indexes, axes, levels, config)
    openings = normalize_openings(walls, indexes, config)
    foundations = normalize_foundations(indexes, axes, levels, config)
    roof_geometry = normalize_roof_geometry(model, indexes, config)

    line_groups = group_support_lines(walls, config)
    collinear = detect_collinear_relations(line_groups, config)
    stacked = detect_stacked_relations(line_groups, config)
    intersections = detect_perpendicular_intersections(walls, config)
    intersections = resolve_cross_intents(
        intersections, model.get("structuralIntent", {}), config
    )
    intersections = build_vertical_intersection_bands(intersections, walls, config)

    axis_roles = resolve_axis_roles(model, axes, config)
    wall_roles = resolve_preliminary_wall_roles(
        walls, axis_roles, model.get("structuralIntent"), config
    )

    vertical_supports = resolve_immediate_vertical_supports(
        walls, stacked, foundations, model.get("elements", []), config
    )
    roof_relations = associate_roof_boundaries(
        walls, roof_geometry, model.get("structuralIntent", {}), config
    )

    nodes = build_topological_nodes(
        walls, openings, intersections, stacked, vertical_supports,
        roof_relations, axis_roles, config
    )

    opening_conflicts = evaluate_intersection_opening_3d(
        walls, openings, intersections, config
    )
    boundaries = classify_boundaries(nodes, intersections, axis_roles, config)
    segments = build_segments(walls, nodes, openings, boundaries, config)
    findings = audit_topology(
        walls, openings, collinear, stacked, intersections,
        vertical_supports, roof_relations, opening_conflicts,
        nodes, segments, config
    )

    output = assemble_output(...)
    return canonicalize_and_hash(output, config)
```

────────

26. Pruebas mínimas obligatorias

1. Muro aislado sin vanos.
2. Dos muros colineales contiguos.
3. Dos muros colineales superpuestos inválidos.
4. Esquina extremo–extremo.
5. Encuentro T estructural.
6. Encuentro T de tabique.
7. Encuentro T con rol desconocido.
8. Cruce MID–MID sin intención: bloquea.
9. Cruce MID–MID con connected.
10. Cruce MID–MID con wallAContinues.
11. Cruce MID–MID con wallBContinues.
12. Cruce MID–MID con bothContinue.
13. Cruce MID–MID con noPhysicalConnection.
14. Muro apilado exacto.
15. Muro apilado parcial.
16. Muro apilado con gap vertical.
17. Vano simple.
18. Dos vanos apilados.
19. Vanos superpuestos inválidos.
20. Encuentro con cobertura vertical parcial y bandas Z correctas.
21. Encuentro próximo a vano sin envolvente: advertencia.
22. Encuentro próximo con envolventes compatibles: sin conflicto.
23. Encuentro con solape 3D confirmado dentro de vano: bloquea.
24. Muro a nivel de coronación con apoyo total de fundación.
25. Muro a nivel de coronación con apoyo parcial de fundación.
26. Muro superior apoyado sobre muro inferior: SUPPORTED_BY_WALL_*.
27. Muro superior sin apoyo inmediato: RT-VERTICAL-SUPPORT-UNRESOLVED.
28. Cubierta con geometricBoundary: no genera candidato portante.
29. Cubierta con loadBearingSupport: genera loadBearingCandidate.
30. Cubierta sin semántica: advertencia.
31. Posición de carga de cubierta sobre muro.
32. Posición de carga de cubierta sobre vano.
33. Distinción topologicalCut versus structuralEffect.
34. Reordenamiento aleatorio del JSON con mismo hash canónico.
35. Ejecución repetida con mismo resultado.
36. Caso completo casa-L.
37. Caso completo casa-r0.
38. Evidencia visual R0–R13 del caso real de regresión.

────────

27. Criterios de aceptación v1.0

SPEC-14 puede pasar a v1.0 cuando:

• todas las reglas R0–R13 estén implementadas;
• las 38 pruebas mínimas estén automatizadas;
• casa-L produzca cero errores geométricos;
• todos los encuentros T usados por SPEC-08 tengan rol resuelto;
• la salida sea determinista e idempotente;
• exista auditoría JSON con conteos y hallazgos;
• exista validación visual versionada de al menos un caso real completo;
• SPEC-08 deje de contener listas hardcodeadas de ejes del proyecto;
• SPEC-11 incorpore formalmente SPEC-14 antes de E2.

────────

28. Decisiones resueltas y pendientes

DR-14-01 · Semántica vertical de fundaciones — resuelta

foundation.levelZ + topOffset representa la coronación del sobrecimiento. La asociación directa solo procede cuando coincide con wall.z0.

DR-14-02 · Jerarquía de apoyo vertical — resuelta en v0.3

El apoyo inmediato se busca en el orden: muro inferior → elemento de transferencia → fundación → no resuelto.

DR-14-03 · Cruces MID–MID — resuelta en v0.3

Se exige uno de cinco valores explícitos en intersectionIntents. Sin declaración, el caso bloquea SPEC-08.

DR-14-04 · Cobertura vertical parcial — resuelta en v0.3

Los encuentros parciales se representan mediante bandas Z y no heredan efectos fuera de la banda común.

DR-14-05 · Semántica de cubierta — resuelta en v0.3

boundaryWallId representa solo relación geométrica. La función resistente se declara mediante roofBoundaryRoles.boundaryRole.

DR-14-06 · Proximidad y conflicto con vanos — resuelta en v0.3

La proximidad de 150 mm es un umbral de revisión. El bloqueo requiere solape de envolventes o evidencia tridimensional.

DP-14-07 · Rol estructural por tramo

Definir el contrato final para declarar intención por tramo, manteniendo prioridad tramo > muro > eje.

DP-14-08 · Envolventes constructivas

Definir qué SPEC provee espesores, caras físicas, jambas y envolventes de ensamblaje para cerrar conflictos 3D con precisión. Hasta entonces, SPEC-14 conserva estados review y unresolved.

────────

29. Historial

|Versión|Fecha     |Cambio                                                                                                                                                                                                                  |
|-------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|v0.1   |2026-08-02|Primera definición completa del reconocimiento topológico, contrato de salida, reglas de clasificación y auditoría                                                                                                      |
|v0.2   |2026-08-02|Explicita cobertura vertical parcial; separa borde topológico y efecto estructural; formaliza datum de fundaciones; incorpora validación visual                                                                         |
|v0.3   |2026-08-02|Resuelve cruces MID–MID por intención explícita; introduce bandas Z; jerarquiza apoyos verticales; declara roles de cubierta; convierte proximidad a vano en revisión por envolventes y exige evidencia 3D para bloquear|
<!-- IMPORTED-NORMATIVE-BODY:END -->
