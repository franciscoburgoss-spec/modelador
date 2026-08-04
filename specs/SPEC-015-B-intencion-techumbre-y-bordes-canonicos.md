# SPEC-015-B — Intención de techumbre, orientación resistente y bordes canónicos

**Estado:** borrador de planificación · 2026-08-04

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

Extender `structural-intent-v1.0` con `roofIntents[]` y crear bordes canónicos derivados de cada
`roofGeometry`.

La intención de techumbre define qué se espera del sistema, pero no selecciona material, cercha,
costanera, viga, panel ni perfil.

La orientación y los roles de borde habilitan propuestas posteriores. No escriben intenciones de
muros y no determinan por sí solos un camino de carga.

## Bordes canónicos

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

1. `boundaryId` se deriva de `roofGeometryId` y extremos canónicos redondeados según el contrato.
2. Invertir el polígono no cambia los IDs.
3. Rotar el punto inicial de una lista cerrada no cambia los IDs.
4. No se fabrican nombres como high/low/gutter sin intención o evidencia suficiente.
5. Un borde horizontal en Z no implica canaleta ni apoyo.
6. Una superficie con borde inválido o duplicado falla con contexto.

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

## Reglas de coherencia

1. `oneWay` requiere `primaryResistanceDirection`.
2. `twoWay` requiere dos direcciones no paralelas.
3. La dirección se expresa en planta mediante vector unitario canónico.
4. Una dirección no asigna automáticamente bordes de apoyo.
5. `gravitySupport` declara que el borde debe transferir carga gravitacional hacia una solución
   compatible.
6. `lateralSupport` no implica carga vertical.
7. `gutterSupport` no convierte el borde en apoyo global.
8. `diaphragmBehavior=intended` expresa una función buscada, no rigidez ni capacidad verificadas.
9. Un borde omitido queda `undetermined`; no se rellena por heurística.
10. La intención puede ser parcial.

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
- Incorporar invalidación de derivados posteriores de techumbre/intención.

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

## Evidencia

- Tests de canonicalización de bordes.
- Permutaciones de vértices y sentido.
- Tests del contrato de intención.
- Fixture real con siete cubiertas.
- SVG/HTML de validación visual paso a paso.
- Inspección de dependencias.
- Prueba de reversión.
- Cierre `sessions/close-SPEC-015-B.md`.

## Corte sugerido

Detener cuando el usuario pueda persistir una intención de techumbre completa mediante API de
dominio, todavía sin UI y sin propuestas para muros.
