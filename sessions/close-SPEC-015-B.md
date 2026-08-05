# Cierre — SPEC-015-B / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 05-ago-2026 |
| Commit base | `6def1c183f67700ba1d4dc0719526cc56982f1f2` |
| Rama | `main` |
| Spec | `SPEC-015-B` |
| Toolchain confirmado | Node 22.23.2; npm 10.9.9; toolchains restantes ejercitados por los gates locales |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No; `xhigh` permaneció prohibido |
| Logs autoritativos | `artifacts/validation-spec-015-b/20260805-170823` |

## Alcance ejecutado

Se implementaron bordes canónicos de `roofGeometry`, direcciones resistentes no orientadas y la
colección persistente `structuralIntent.roofIntents[]` sin cambiar `modelVersion: 3`. Las APIs
`setRoofIntent`, `removeRoofIntent` y `clearStructuralIntent` validan y canonicalizan antes de
mutar, no invalidan derivados constructivos y participan del historial.

La reconciliación se ejecuta atómicamente ante toda mutación que pueda cambiar indirectamente la
geometría de cubierta. Los IDs persistentes conservan intención; un borde desaparecido no se
reasigna y produce `SI-ROOF-BOUNDARY-REVIEW-AFTER-GEOMETRY-CHANGE`. Eliminar una cubierta retira
su intención y findings asociados. Cambios exclusivamente constructivos no alteran la intención.

La intención permanece fuera de `agnostic-geometry-v1.0`. No se implementaron UI definitiva,
propuestas automáticas, aceptación/rechazo, conexiones, caminos de carga, miembros,
dimensionamiento, Metalcon/OSB/modulación, R6–R12 ni F-009.

## Cambios principales

- `src/core/roofStructuralIntent.js` define bordes, direcciones, validación, canonicalización y
  reconciliación de intención de cubierta.
- `src/core/agnosticGeometry.js` expone proyección selectiva usando la misma autoridad geométrica.
- `src/core/structuralIntent.js` activa `roofIntents[]` sin habilitar las demás colecciones futuras.
- `src/core/modelSchema.js` valida resolubilidad sólo para cubiertas con intención y conserva v3.
- `src/store/useModelStore.js` integra APIs y reconciliación en una única mutación de historial.
- Las pruebas cubren corpus adversario, persistencia, importación sin inferencia, store y undo/redo.
- La evidencia FX-008 representa siete cubiertas y cuatro declaraciones reales sin clasificar
  automáticamente muros.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Bordes independientes de recorrido y Z | PASS | Inversión, rotación de inicio y cambio de elevación conservan IDs |
| SHA-256 y payload tipado | PASS | Coordenadas XY a 3 decimales y hash completo minúsculo |
| Direcciones no orientadas | PASS | `v` y `-v` canonicalizan igual; `twoWay` paralela se rechaza |
| Combinaciones de distribución | PASS | `oneWay`, `twoWay`, `local` y `undetermined` validados |
| Referencias de borde resolubles | PASS | Bordes ajenos, duplicados y desaparecidos cubiertos |
| Persistencia v3 sin inferencia | PASS | Roundtrip e importación v2 mantienen intención vacía cuando corresponde |
| Reconciliación atómica | PASS | Eliminar, mutar borde, finding y abortar irresolubilidad participan del historial |
| No reasignación heurística | PASS | No se usa índice, cercanía, orientación, nombre ni posición relativa |
| Derivados constructivos intactos | PASS | `invalidatedStructuralDerivatives` permanece vacío |
| Byte identity agnóstica | PASS | 81.875 bytes y SHA-256 `966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a` |
| Caso real FX-008 | PASS | 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas |
| Gates oficiales | PASS | Validador único local 24/24 |

## Validación local autoritativa

| Gate | Resultado |
|---|---|
| preflight-git | PASS |
| preflight-node-npm | PASS |
| preflight-dependencias | PASS |
| governance | PASS |
| evidencia-spec015b-generar | PASS |
| format-check | PASS |
| format-rust | PASS |
| eslint | PASS |
| tests-spec015b | PASS |
| tests-node-y-componentes | PASS |
| tests-rust | PASS |
| tauri-check | PASS |
| laboratorio-techumbre | PASS |
| cobertura-core-store | PASS |
| goldens | PASS |
| auditoria-dxf | PASS |
| smoke-calculix | PASS |
| build-vite | PASS |
| manifiesto-migracion | PASS |
| inventario-artefactos | PASS |
| contrato-derivados | PASS |
| auditoria-codex | PASS |
| byte-identity-y-evidencia | PASS |
| git-diff-check | PASS |

Resumen producido por el Mac:

```text
RESULTADO: PASS
GATES_APROBADOS: 24
DIRECTORIO_DE_LOGS: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-b/20260805-170823
AUTORIDAD: validación local ejecutada en este Mac
```

## Incidente de validación

La primera ejecución falló en `preflight-node-npm` porque el shell usaba Node 20.20.2. Al activar
Node 22.23.2, el preflight original siguió cargando Node 20 debido a `bash -lc`, que abría un shell
de login y reemplazaba el `PATH` de nvm. El script de entrega se corrigió a `bash -c`; la ejecución
posterior con npm 10.9.9 produjo el PASS autoritativo. No se modificó código del repositorio para
resolver este incidente.

## Prueba de la prueba

| Alteración | Resultado esperado |
|---|---|
| Invertir el polígono o rotar su primer vértice | IDs de borde idénticos |
| Cambiar sólo Z | IDs de borde idénticos y geometría 3D actualizada |
| Declarar un borde de otra cubierta | Rechazo antes de mutar |
| Reemplazar un borde desaparecido por otro cercano | La prueba falla; no existe reasignación heurística |
| Permitir que intención alcance el exportador agnóstico | Falla byte identity de 81.875 bytes y SHA-256 |

## Desviaciones y deudas

- El ZIP de entrada excluía `.git`; el aplicador verificó localmente el commit base y los 560
  archivos exactos antes de aplicar el parche.
- El defecto `bash -lc` pertenecía al validador externo entregado y quedó corregido antes del PASS.
- R-017 no bloqueó el corte y no fue intervenida.
- F-009 permanece P1 y bloquea afirmar que los planos están listos para ejecución.
- SPEC-08 continúa deshabilitada hasta completar y auditar R6–R12.

## Documentos actualizados

- [x] `governance/DECISIONS.md`, D-056
- [x] `governance/RISKS.md`, R-029
- [x] `governance/TRACEABILITY.md`, REQ-DOM-007
- [x] `governance/STATUS.md`
- [x] `governance/MIGRATION_MANIFEST.json`
- [x] `docs/SPEC-015-B_IMPLEMENTACION.md`
- [x] `docs/SPEC-015-B_TRAZA.md`
- [x] `evidence/spec-015-b/*`
- [x] `specs/SPEC-015-B-intencion-techumbre-y-bordes-canonicos.md`
- [x] `sessions/close-SPEC-015-B.md`
