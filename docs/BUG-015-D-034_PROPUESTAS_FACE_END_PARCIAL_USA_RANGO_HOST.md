# BUG-015-D-034 — Propuestas presenta `face/end` parciales con el rango completo del host

## Estado

**CERRADO 10-ago-2026.** Correctiva 19 aplicada; focal, integral y validación visual real completadas.

## Evidencia real FX-008

Durante la validación visual en localhost, después de declarar y persistir los dos receptores explícitos del frontón C/6→7, el workspace `Estructura → Propuestas → G↓ Gravedad` construyó correctamente cuatro caminos `completeCandidate` de 4 tramos y eliminó `SI-EXPLICIT-END-SUPPORT-UNRESOLVED`.

Las interfaces persistidas eran:

- apoyo C/6: `Cara −N · Muro Y · B→I @ 6`, `locator.sRange=[1949.45,2050.55]`, `locator.zRange=[3250,4150]`;
- apoyo C/7: `Extremo S máximo · Muro Y · A→C @ 7`, `locator.sRange=[1999.9,2000]`, `locator.zRange=[3250,4150]`.

Sin embargo, la columna `Nodos` de Propuestas las describía usando la envolvente completa del host:

- C/6: `S 1200→6600 · Z 450→4150`;
- C/7: `S 0→2000 · Z 450→4150`.

La discrepancia era sólo de presentación: `technicalReference.locator` conservaba los rangos declarados y `candidateLoadPaths` ya consumía las relaciones explícitas correctas.

## Causa

`src/core/structuralProposalVisualPresentation.js::interfaceTarget()` usa `describeInterfaceIntent()` como subtítulo genérico para interfaces cuyo owner es `element`.

`describeInterfaceIntent()` describe intencionalmente el marco completo del muro (`frame.s0→frame.s1`, `frame.z0→frame.z1`), no el rango local de la interacción. Esto es correcto como descripción del host, pero no como descripción efectiva de una interfaz persistida con `locator.sRange`/`locator.zRange` explícitos.

La Correctiva 17 ya separó correctamente el rango de interacción de un `roofBoundary` parcial. Faltaba aplicar el mismo principio de presentación a `face`, `end` y `region` de elementos sin modificar sus contratos de autoridad.

## Corrección

La presentación de una interfaz sobre `ownerRef.kind='element'` debe preferir los rangos declarados en el locator:

- `locator.sRange`, cuando existe y es finito;
- `locator.zRange`, cuando existe y es finito;
- sólo si alguno no está declarado, usar el rango correspondiente del host como fallback de compatibilidad.

La corrección se limita a `structuralProposalVisualPresentation.js` y regresiones. No modifica `structuralInterfaces.js`, IDs, relaciones, `candidateLoadPaths`, geometría agnóstica ni estado persistido.

## Criterios de cierre

1. C/6 se presenta como `S 1949.45→2050.55 · Z 3250→4150 · vigente`.
2. C/7 se presenta como `S 1999.9→2000 · Z 3250→4150 · vigente`.
3. Las interfaces del propio frontón que ya ocupan todo su rango conservan su texto observable.
4. `technicalReference.locator` no cambia.
5. Los caminos gravitacionales siguen siendo cuatro `completeCandidate` de 4 tramos cuando ambos apoyos están declarados.
6. No reaparece `SI-EXPLICIT-END-SUPPORT-UNRESOLVED`.
7. `candidateLoadPaths`, schema, `modelVersion`, geometría agnóstica, CalculiX y evidencia REV8 permanecen intactos.
8. No se ejecuta Git durante la correctiva.

## Fuera de alcance

`MEJ-015-D-033 — Encuadre adaptativo para interfaces pequeñas` permanece como mejora de usabilidad separada. Esta correctiva no cambia zoom, `visibleBounds`, Canvas ni el comportamiento de `Encuadrar`.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 19. Nodos de C/6 y C/7 muestran los rangos persistidos y los cuatro caminos permanecen `completeCandidate · 4 tramos` antes y después de `Recalcular`.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
