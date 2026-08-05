# SPEC-015-B — Intención de techumbre, orientación resistente y bordes canónicos

**Estado:** cerrada · 2026-08-05

## Diagnóstico

`agnostic-geometry-v1.0` representa cada cubierta como una superficie límite planar. La geometría
permite conocer su polígono, pendiente y posición, pero no declara:

- dirección principal de los elementos resistentes;
- forma unidireccional, bidireccional o indeterminada de trabajo;
- función de cada borde;
- existencia o función de diafragma;
- transferencia hacia muros separados verticalmente.

La coincidencia entre un borde de cubierta y un muro no demuestra apoyo resistente. Sin una
intención de techumbre, SPEC-14 sólo puede producir relaciones geométricas candidatas.

El caso real contiene siete superficies de cubierta. Sus polígonos no poseen IDs de borde
persistentes. Una intención no puede referenciar de forma estable “el tercer vértice” o “el lado
izquierdo” porque el orden puede cambiar durante la canonicalización.

## Decisión

Activar `roofIntents[]` dentro de `structural-intent-v1.0` y crear bordes canónicos derivados de
las superficies emitidas por `projectAgnosticGeometry(model).roofGeometry`.

La colección ya existe vacía en el modelo nativo v3. Su activación no requiere incrementar
`modelVersion` ni migrar modelos v3 existentes.

La intención de techumbre define qué comportamiento se busca, pero no selecciona material,
cercha, costanera, viga, panel, perfil ni solución constructiva.

La orientación y las funciones de borde habilitan propuestas posteriores. No escriben intenciones
de muros y no determinan por sí solas un camino de carga.

## Autoridad geométrica

La única autoridad para construir bordes canónicos es una entrada válida
`agnostic-geometry-v1.0`.

Para cada cubierta se usan exclusivamente `roofGeometry[].id`, `roofGeometry[].source`,
`roofGeometry[].surface.kind` y `roofGeometry[].surface.boundary[]`.

No participan perfiles, espaciamientos, plantillas, patrones, miembros, modulación ni otros
campos constructivos de `roofPlanes[]` o `roofSystems[]`.

Esta SPEC no modifica `agnostic-geometry-v1.0`. Agregar o cambiar intención debe conservar
exactamente sus bytes y SHA-256.

## Bordes canónicos

El contrato usa `linearToleranceMm=0.1`, `minimumPlanLengthMm=0.1`,
`coordinateRoundDecimals=3`, `directionRoundDecimals=6`, `angularToleranceDeg=0.001`,
`hashAlgorithm=SHA-256` y `payloadVersion=roof-boundary-v1`.

Para cada superficie planar se crean segmentos cerrados entre vértices consecutivos. Cada borde
se normaliza sin depender del sentido del polígono.

Salida mínima:

```json
{
  "boundaryId": "roof:1785030887081:edge:<hash-semantico>",
  "roofGeometryId": 1785030887081,
  "start": {"x": 3000, "y": 0, "z": 3650},
  "end": {"x": 14500, "y": 0, "z": 3650},
  "length3d": 11500,
  "planDirection": {"x": 1, "y": 0},
  "zRange": [3650, 3650]
}
```

Reglas:

1. `boundaryId` se deriva de `roofGeometryId` y de los extremos canónicos en planta,
   redondeados a tres decimales. La coordenada Z no participa en la identidad.
2. Cada extremo se redondea a tres decimales, normaliza `-0` a `0` y se ordena
   lexicográficamente por `x` y luego `y`.
3. Todo segmento debe tener longitud en planta mayor que `0.1 mm`.
4. El hash usa SHA-256 completo, hexadecimal en minúsculas, sobre un payload versionado
   `roof-boundary-v1` que incluye el ID tipado de la cubierta y ambos extremos canónicos.
5. Invertir el polígono no cambia los IDs.
6. Rotar el punto inicial de una lista cerrada no cambia los IDs.
7. No se fabrican nombres como high/low/gutter sin intención o evidencia suficiente.
8. Un borde horizontal en Z no implica canaleta ni apoyo.
9. Una superficie con borde inválido, duplicado o no finito falla con código, ruta e IDs.
10. Bordes geométricamente iguales de cubiertas distintas conservan IDs diferentes.

## Contrato `roofIntents[]`

```json
{
  "intentId": "intent:roof:1785030887081",
  "roofGeometryId": 1785030887081,
  "loadDistribution": "oneWay",
  "primaryResistanceDirection": {"x": 0, "y": 1},
  "secondaryResistanceDirection": null,
  "diaphragmBehavior": "candidate",
  "boundaryIntents": [
    {
      "boundaryId": "roof:1785030887081:edge:...",
      "function": "gravitySupport",
      "source": "userDeclared"
    }
  ],
  "status": "declared",
  "source": "userDeclared",
  "notes": null
}
```

Sólo puede existir una intención vigente por `roofGeometryId`.

`roofIntents[]` se ordena canónicamente por `roofGeometryId` y cada `boundaryIntents[]`
por `boundaryId`.

Valores de `loadDistribution`:

```text
oneWay
twoWay
local
undetermined
```

Valores de `diaphragmBehavior`:

```text
intended
notIntended
candidate
undetermined
```

Valores de `boundaryIntents[].function`:

```text
gravitySupport
lateralSupport
gravityAndLateralSupport
geometricBoundary
gutterSupport
nonStructuralBoundary
undetermined
```

## Direcciones resistentes

Las direcciones representan ejes no orientados en planta: `v` y `-v` son equivalentes.

Canonicalización:

1. `x` e `y` deben ser finitos y la magnitud debe ser positiva.
2. El vector se normaliza mediante `Math.hypot(x, y)`.
3. El primer componente no nulo, en orden `x` y luego `y`, se fuerza positivo.
4. Los componentes se redondean a seis decimales y `-0` se normaliza a `0`.

Reglas por distribución:

- `oneWay`: `primaryResistanceDirection` es obligatoria y
  `secondaryResistanceDirection` debe ser `null`.
- `twoWay`: ambas direcciones son obligatorias, se ordenan lexicográficamente y no pueden
  ser paralelas ni antiparalelas dentro de `0.001°`.
- `local`: ambas direcciones deben ser `null`; declara que no existe una dirección global
  representativa para toda la superficie.
- `undetermined`: ambas direcciones deben ser `null`.

## Reglas de coherencia

1. Una dirección resistente no asigna automáticamente bordes de apoyo.
2. `gravitySupport` declara transferencia gravitacional buscada hacia una solución compatible.
3. `lateralSupport` no implica carga vertical.
4. `gravityAndLateralSupport` declara ambas funciones sin demostrar capacidad.
5. `gutterSupport` no convierte el borde en apoyo global.
6. `diaphragmBehavior=intended` expresa una función buscada, no rigidez ni capacidad verificadas.
7. Un borde omitido es semánticamente `undetermined`, pero no se agrega por heurística.
8. Un `boundaryId` no puede repetirse y debe pertenecer a la cubierta referenciada.
9. `status` debe ser `declared` y `source` debe ser `userDeclared`.
10. La intención puede ser parcial.
11. Ningún valor se deriva desde pendiente, canaleta, perfiles, modulación o cercanía a un muro.

## Mutaciones y resultados

Definir operaciones puras y atómicas: `setRoofIntent(roofGeometryId, intent)`,
`removeRoofIntent(roofGeometryId)` y `clearStructuralIntent()`.

`setRoofIntent` debe comprobar antes de mutar que existe exactamente una cubierta con ese ID,
que su superficie es resoluble y que todos los `boundaryId` declarados existen, son únicos y
pertenecen a esa cubierta.

Las operaciones retornan `affectedElementIds`, `affectedRoofGeometryIds` e
`invalidatedStructuralDerivatives`. En este corte, `invalidatedStructuralDerivatives` permanece
vacío porque aún no existen derivados estructurales posteriores persistidos; no se reutilizan los
flags `stale` de Metalcon, OSB o cerchas constructivas.

## Ciclo de vida y reconciliación

1. Eliminar una cubierta elimina atómicamente su intención vigente y los findings que la
   referencien.
2. Una cubierta sin intención conserva el flujo flexible actual de edición.
3. No se crean intenciones automáticamente al agregar una cubierta.
4. Si una mutación geométrica afecta una cubierta con intención, la geometría resultante debe
   seguir siendo resoluble; de lo contrario, la mutación completa falla antes de modificar el
   modelo.
5. Si todos los `boundaryId` referenciados permanecen vigentes, la intención se conserva
   exactamente.
6. Si desaparecen bordes referenciados, se eliminan sólo esas referencias y se crea el finding
   persistente `SI-ROOF-BOUNDARY-REVIEW-AFTER-GEOMETRY-CHANGE`.
7. El finding conserva la cubierta, los `boundaryId` afectados y las declaraciones removidas,
   con estado `open` y severidad `warning`.
8. Los bordes no se reasignan por índice, cercanía, orientación, nombre ni posición relativa.
9. Cambiar sólo campos constructivos que no alteran `roofGeometry` no modifica ni reconcilia
   la intención.
10. Cambios de parámetros, grilla, niveles o muros deben reconciliar atómicamente todas las
    cubiertas con intención cuya geometría resulte afectada.
11. `clearStructuralIntent()` elimina también `roofIntents[]` y sus findings asociados.

## Refinamiento de SPEC-14 v0.3

El contrato provisional `structuralIntent.roofBoundaryRoles[]` de R9 vinculaba una cubierta
directamente con un muro. SPEC-015-B lo reemplaza como autoridad de intención por
`roofIntents[].boundaryIntents[]`, vinculada a una cubierta y a un borde canónico, todavía sin
`wallId`.

Correspondencia futura: `loadBearingSupport` pasa a `gravitySupport`; `lateralSupport`,
`geometricBoundary`, `gutterSupport` y `nonStructuralBoundary` conservan su significado;
`unknown` pasa a `undetermined`. `gravityAndLateralSupport` es una ampliación nueva.

## Relación con muros

Esta SPEC sólo prepara consultas geométricas:

```text
borde con función declarada
  ↓
búsqueda futura de elementos coincidentes
```

No crea:

- intención de muro;
- propuesta aceptada;
- relación portante definitiva;
- conexión;
- elemento de transferencia;
- miembro de techumbre.

## Caso real obligatorio

Usar las siete superficies del fixture real.

La evidencia debe mostrar:

1. cada polígono y sus bordes canónicos;
2. la dirección resistente declarada por el usuario;
3. cada borde con su función o estado indeterminado;
4. muros cercanos sólo como contexto geométrico, sin colorearlos como portantes;
5. frontones altos y bajos visibles;
6. sectores donde muros interiores terminan bajo la cubierta;
7. ausencia de decisiones automáticas sobre esos muros.

Como mínimo se cubrirán las superficies:

```text
1785030887081
1785161146258
1785161396221
1785161662029
```

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: introduce IDs geométricos estables, un contrato de intención de cubierta y determinismo
  frente a permutaciones.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Referenciar bordes por índice | El índice depende del orden de vértices |
| Inferir apoyo desde la pendiente | La pendiente no demuestra función resistente |
| Inferir canaleta desde la cota baja | Puede ser sólo un límite geométrico |
| Guardar cerchas o costaneras | Son una solución constructiva posterior |
| Asignar automáticamente muros portantes | Viola la autoridad del usuario |

## Alcance

- Canonicalizar bordes de `roofGeometry`.
- Definir `roofIntents[]`.
- Validar orientación, distribución y funciones de borde.
- Persistir intención de techumbre en el modelo v3.
- Mantener determinismo y no mutación.
- Preparar evidencia visual del proyecto real.
- Incorporar reconciliación atómica de intenciones ante cambios de geometría de cubierta.
- Mantener `invalidatedStructuralDerivatives=[]` hasta que existan derivados estructurales
  persistidos.

## Fuera de alcance

- UI.
- Propuestas para muros.
- Caminos de carga.
- Diafragma calculado.
- Posiciones de cercha.
- Miembros o materiales.
- Soluciones Metalcon, madera, SIP o albañilería.
- Cambios al schema geométrico.
- R8–R12 productivos.

## Criterios de aceptación

1. Las siete superficies reales producen bordes únicos, finitos y estables.
2. Invertir o rotar el orden de vértices conserva los mismos bordes e IDs.
3. Una intención válida se guarda y reabre sin alterar la cubierta geométrica.
4. `oneWay`, `twoWay`, `local` y `undetermined` validan exactamente sus campos requeridos.
5. Ningún rol de borde crea o cambia una intención de muro.
6. Un borde inexistente, duplicado o perteneciente a otra cubierta falla antes de mutar.
7. Cambiar sólo una intención de techumbre no cambia los bytes de `agnostic-geometry-v1.0`.
8. La evidencia visual real distingue geometría, intención declarada y estados indeterminados.
9. Ningún módulo nuevo importa soluciones constructivas.
10. Una prueba de reversión basada en índices de vértice falla al invertir el polígono.
11. Pruebas enfocadas, cobertura, build, gates de gobernanza y cierre pasan.
12. Cambiar sólo la elevación o pendiente, sin modificar el límite en planta, conserva los
    mismos `boundaryId`.
13. Eliminar una cubierta elimina atómicamente su intención y sus findings asociados.
14. Una mutación que vuelve irresoluble una cubierta con intención falla antes de modificar el
    modelo.
15. Si desaparece un borde declarado, se elimina sólo esa referencia y se crea
    `SI-ROOF-BOUNDARY-REVIEW-AFTER-GEOMETRY-CHANGE` sin reasignación automática.
16. Cambiar únicamente campos constructivos que no alteran `roofGeometry` conserva exactamente
    la intención.
17. Las API informan `affectedRoofGeometryIds` y mantienen `invalidatedStructuralDerivatives=[]`.
18. El modelo permanece en versión 3 y reabre `roofIntents[]` sin una migración nueva.

## Evidencia

- Tests de canonicalización de bordes.
- Permutaciones de vértices y sentido.
- Tests del contrato de intención y canonicalización de direcciones.
- Tests de ciclo de vida, reconciliación y findings persistentes.
- Tests del resultado de API con `affectedRoofGeometryIds` e invalidación estructural vacía.
- Prueba de reapertura en `modelVersion=3` sin migración nueva.
- Fixture real con siete cubiertas.
- SVG/HTML de validación visual paso a paso.
- Inspección de dependencias.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-015-B.md`.

## Corte sugerido

Detener cuando el usuario pueda persistir una intención de techumbre completa mediante API de
dominio, todavía sin UI y sin propuestas para muros.
