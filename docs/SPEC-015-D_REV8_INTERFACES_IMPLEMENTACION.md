# SPEC-015-D REV8 — Implementación de interfaces estructurales

## Base

Entrada: working tree REV7 validado, 671 archivos. REV8 mantiene `modelVersion=3` y la geometría `agnostic-geometry-v1.0` sin cambios.

## Contrato persistente

`structural-intent-v1.1` agrega `interfaceIntents[]` y `relationIntents[]`. La migración desde v1.0 es pura, idempotente y agrega sólo arreglos vacíos.

## Caso gobernante FX-008

Frontón `1784819708086`, C/6→7, X, S=12.800→14.500, Z=3.250→4.150.

- cubierta al lado y<C entra por `faceNegativeN`;
- cubierta al lado y>C entra por `facePositiveN`;
- ambas relaciones son `gravity`; ninguna cara implica `lateral`;
- una relación `loadTransfer` puede entregar hacia `endLowS` y `endHighS`;
- los apoyos en 6 y 7 deben declararse; sin ellos el path termina en `SI-EXPLICIT-END-SUPPORT-UNRESOLVED`.

## Alternativa continua C/6→11A

Una relación `loadTransfer` usa dos `carrierRegions`:

1. frontón C/6→7, S 12.800→14.500, Z 3.250→4.150;
2. muro C/7→11A, S 14.500→23.200, Z 3.250→4.150.

No se borra, divide verticalmente ni fusiona geometría. No existe `structuralAssembly` en REV8.

## Stale, split, merge y delete

- cambio geométrico del mismo host conserva interfaz y la marca stale;
- una nueva relación no puede consumir una interfaz stale: 0 mutaciones;
- split elimina referencias al host fuente y conserva snapshot en finding; no nearest-rebind;
- merge se bloquea mientras los muros fuente tengan intención/interfaces/regiones pendientes;
- delete elimina interfaces y relaciones dependientes en la misma acción y registra trace mixto.

## UI

`Intención estructural → Interfaces` permite declarar interfaces y relaciones. `Propuestas → Interfaces` muestra interfaces, regiones y relaciones con descriptor humano, ayuda contextual y Localizar/Ver relación efímero.

## Evidencia y validación

Ver `evidence/spec-015-d-rev8/` y `tests/structuralInterfaces.test.mjs`, `tests/candidateLoadPathsInterfaces.test.mjs`, `tests/structuralProposalVisualPresentation.test.mjs`.

No se ejecutó Git.

## Cierre posterior a Correctivas 14–19

La validación visual real extendió REV8 con las Correctivas 14–19 sin cambiar schema,
`modelVersion`, geometría agnóstica ni la autoridad de `candidateLoadPaths`:

| Correctiva | Hallazgo | Resultado |
|---|---|---|
| 14 | BUG-015-D-028 | `roofBoundary` admite `sRange` parcial con contención y backcompat de borde completo |
| 15 | BUG-015-D-029 | Canvas localiza sólo la evidencia del subtramo de cubierta |
| 16 | BUG-015-D-030 | `Canvas.jsx` registrado correctamente en `MIGRATION_MANIFEST` |
| 17 | BUG-015-D-031 | presentación distingue interacción parcial de longitud física del borde |
| 18 | BUG-015-D-032 | etiqueta de cara corta usa llamada exterior sin ocultar la evidencia |
| 19 | BUG-015-D-034 | `face/end/region` presentan `locator.sRange/zRange` y no el rango completo del host |

El caso final FX-008 conserva cuatro caminos gravitacionales `completeCandidate · 4 tramos` desde
B1/B3 hasta fundación, con apoyos C/6 y C/7 explícitos. La validación integral y visual final se
registra en `SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
