# BUG-015-D-031 — `roofBoundary` parcial presenta la longitud física completa en caminos candidatos

Fecha de registro: 2026-08-09
SPEC activa: SPEC-015-D REV8
Estado al registrar: reproducido visualmente en localhost, antes de corregir código.

Estado final: **cerrado 10-ago-2026** tras validación focal, integral y visual real.
## 1. Reproducción real

Caso gobernante: segunda cubierta del FX-008 sobre el frontón C/6→7.

- `roofGeometryId`: `1785161146258`
- borde humano: `B1`
- borde físico: C/6→11A
- longitud física: `10.400 mm`
- `boundaryId`: `roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c`
- interfaz declarada: `locator.kind = boundary`
- interacción declarada: `sRange = [12800,14500]`
- longitud de interacción: `1.700 mm`
- relación declarada: `support · gravity`, B1 entrega a `Cara +N · Muro X · 6→7 @ C`.

En `Estructura → Propuestas y caminos de carga candidatos → G↓ Gravedad`, el nodo se presentaba como:

`B1 · 10.400 mm · vigente`

mientras el camino mostraba `B1 → Cara +N` sin distinguir que la interfaz sólo cubre S 12800→14500.

## 2. Defecto

La presentación humana mezcla dos magnitudes diferentes:

1. la **longitud física del borde canónico** B1, que sigue siendo 10.400 mm; y
2. la **extensión efectiva de la interfaz estructural declarada**, que es sólo 1.700 mm.

El contrato estructural persistido es correcto. El defecto está en la capa de presentación de propuestas/caminos.

## 3. Causa raíz

`interfaceTarget()` en `src/core/structuralProposalVisualPresentation.js` construía `humanBoundaryLabel` exclusivamente desde:

`roofBoundary.label + roofBoundary.length3d`

sin considerar `intent.locator.sRange` cuando el `roofBoundary` era parcial.

El mismo `title` se reutiliza luego en los nodos y en los tramos de `GraphView`, por lo que la omisión se propagaba a la visualización del camino aunque `candidateLoadPaths` ya estuviera usando la interfaz correcta.

## 4. Corrección requerida

Para un `roofBoundary` con `locator.sRange` explícito que sea distinto del rango físico completo:

- conservar Bn y la longitud física como contexto;
- presentar explícitamente `Interacción S ...` y su longitud 3D;
- incorporar el S parcial al título humano que consume el camino candidato;
- no modificar identidad de interfaz, relación, grafo ni `candidateLoadPaths`.

Para un `roofBoundary` completo sin `sRange`, la presentación existente debe permanecer byte-semánticamente equivalente:

`B3 · 1.700 mm · vigente`

## 5. Resultado esperado para el caso real

Nodo:

`Interfaz estructural declarada · B1 · Interacción S 12800→14500 · 1.700 mm · borde físico 10.400 mm · vigente`

Título usado por el tramo:

`Borde de cubierta · Faldón poligonal 6–11A entre C–J · B1 · S 12800→14500`

De esta forma el camino `B1 → Cara +N` queda inequívocamente asociado sólo a C/6→7.

## 6. Invariantes

La correctiva no puede:

- modificar `candidateLoadPaths`;
- cambiar `interfaceId` ni `relationId`;
- inventar apoyo de extremo;
- convertir cara en acción lateral;
- cambiar schema ni `modelVersion`;
- modificar geometría agnóstica;
- modificar evidencia REV8;
- alterar CalculiX;
- alterar el estado persistido del navegador.

`SI-EXPLICIT-END-SUPPORT-UNRESOLVED` debe seguir apareciendo mientras no exista un soporte explícito del extremo.

## 7. Criterio de cierre

1. Tests puros confirman que el nodo parcial distingue interacción 1.700 mm de borde físico 10.400 mm.
2. Test de componente confirma que `G↓ Gravedad` muestra el `sRange` parcial también en el tramo del camino.
3. Un borde completo mantiene su presentación histórica.
4. Focal automático verde.
5. Integral REV8 verde.
6. Validación visual real en localhost confirma la presentación corregida.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 17. G↓ Gravedad distingue visualmente `Interacción S 12800→14500 · 1.700 mm` del borde físico de 10.400 mm en nodos y caminos.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
