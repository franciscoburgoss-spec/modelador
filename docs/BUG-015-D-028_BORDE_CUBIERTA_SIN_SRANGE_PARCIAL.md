# BUG-015-D-028 — Borde de cubierta sin `sRange` parcial en la UI

## Estado

**CERRADO 10-ago-2026.** Correctiva 14 aplicada; validación focal, integral y visual real completadas. La corrección complementaria del renderer se registró como BUG-015-D-029.

## Reproducción gobernante

En `Estructura → Intención estructural → Interfaces → Borde de cubierta`, la UI sólo permite seleccionar el `boundaryId` físico completo y crea:

```js
locator = { kind: 'boundary' };
```

El caso gobernante de FX-008 es la cubierta `1785161146258`, borde canónico:

```text
roof:1785161146258:edge:bab5d814565d49996597bfe157d6cbb3f0b41a3d61c2953ffc1e99b21df3b29c
```

El borde físico C/6→11A mide 10.400 mm y su dominio longitudinal canónico es `S=[12800,23200]`. La interfaz hacia la Cara +N del frontón C/6→7 ocupa sólo `S=[12800,14500]`, 1.700 mm.

## Causa

REV8 ya admite conceptualmente `locator.sRange` para una interfaz `roofBoundary` y la evidencia canónica de FX-008 usa el subtramo. Sin embargo:

1. `StructuralInterfacesPanel` no expone controles S para el borde de cubierta y siempre crea el locator completo.
2. La validación de contención de `roofBoundary` sólo comprueba que exista el owner y que `locator.kind === 'boundary'`; no comprueba que un `sRange` explícito esté contenido en el borde.
3. `Localizar` reconstruye siempre `boundary.start/end`, por lo que una interfaz parcial se muestra como el borde físico completo.

## Contrato de la Correctiva 14

- Se reutiliza `roofBoundaryFrame()` como convención canónica existente para el eje longitudinal S del borde; no se introduce una segunda convención geométrica.
- `boundary` sin `sRange` continúa significando el borde físico completo.
- Dejar S0/S1 en el rango completo desde la UI persiste exactamente `{ kind: 'boundary' }`; no agrega un `sRange` redundante ni cambia el `interfaceId` histórico.
- Un subtramo persiste `{ kind: 'boundary', sRange: [min,max] }`.
- Un rango invertido se canonicaliza y produce la misma identidad que su equivalente ordenado.
- Un rango nulo, no finito o fuera del dominio físico se rechaza antes de mutar el modelo.
- `Localizar` y la presentación visual de una interfaz parcial usan sólo el segmento interpolado declarado y ajustan sus bounds al subtramo.
- La tarjeta distingue el **borde físico** del **rango de interacción** cuando existe `sRange`.

## Límites explícitos

Esta correctiva no:

- cambia `modelVersion` ni `structural-intent-v1.1`;
- cambia `agnostic-geometry-v1.0` ni su exportador;
- crea `actionFamily`, `structuralFunction`, support o relaciones desde una interfaz;
- modifica `candidateLoadPaths.js`;
- toca CalculiX;
- ejecuta Git.

## Validación requerida

La puerta focal debe demostrar como mínimo:

1. interfaz completa sin `sRange` mantiene semántica e ID;
2. `S=[12800,14500]` sobre el borde norte real se acepta y conserva el ID canónico REV8;
3. rango invertido conserva identidad;
4. rangos fuera de `[12800,23200]`, nulos o no finitos fallan antes de mutar;
5. la UI permite editar S0/S1 y muestra borde físico versus interacción;
6. `Localizar` resalta sólo C/6→7 para la interfaz parcial;
7. B3 completo sigue persistiendo sin `sRange`;
8. los caminos de carga con extremo explícito sin support siguen en `SI-EXPLICIT-END-SUPPORT-UNRESOLVED`;
9. no hay cambios fuera del allowlist de Correctiva 14.

Sólo después de la salida focal verde se habilita la validación integral REV8.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 14. B1 parcial, persistencia del `sRange` y distinción borde físico/interacción validadas en localhost; la visualización exclusiva del subtramo quedó completada junto con BUG-029.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
