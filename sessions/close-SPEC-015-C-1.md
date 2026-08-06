# Cierre — SPEC-015-C-1 / identificación visual de muros y elementos

> Documento inmutable después de publicar el commit.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 06-ago-2026 |
| Commit base | `961782f` (`Implementa y cierra SPEC-015-C`) |
| Rama | `main` |
| Spec | `SPEC-015-C-1` |
| Toolchain confirmado | Node 22.23.2; npm 10.9.9; Rust/Cargo, Tauri, Python/ezdxf y CalculiX ejercitados por la puerta local |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No; `xhigh` permaneció prohibido |
| Logs autoritativos | `artifacts/validation-spec-015-c-1/20260806-143453` |

## Alcance ejecutado

Se cerró `BUG-015-C-001` sin modificar el esquema persistente ni habilitar capacidades futuras. El
workspace identifica muros, columnas, vigas y fundaciones desde la geometría agnóstica mediante un
presentador puro. Cada objetivo dispone de descriptor verificable, planta, elevación, vanos y
contexto geométrico explícitamente no topológico. Los lotes usan marcas S1…Sn y mantienen separado
el integrante activo.

Lista, preview y Canvas se sincronizan mediante estado local/transitorio. Localizar compacta el
workspace, conserva el borrador, intercepta el hit-test antes de la selección ordinaria y permite
restaurar o conservar la vista. La selección global, historial, intención y
`structuralIntentTrace` permanecen sin cambios durante navegación, hover, zoom o localización.

Fingerprints separados detectan stale de intención y geometría. Referencias rotas permanecen
visibles y bloqueadas; no se sustituyen por otro elemento. La interacción usa teclado, foco visible,
texto, marcas y patrones, sin depender sólo del color.

## Exclusiones preservadas

- Propuestas estructurales, Caminos de carga y Topología continúan deshabilitados.
- No se implementaron SPEC-015-D, SPEC-015-E ni SPEC-016.
- No se infirió función resistente, apoyo, conexión ni camino de carga.
- No se agregaron datos visuales a `model`, `structuralIntent` ni `agnostic-geometry-v1.0`.
- `modelVersion` permanece en 3.
- F-009 y R-017 no fueron intervenidos.

## Cambios principales

- `structuralIntentVisualPresentation.js`: descriptor, geometría visual, contexto y fingerprints.
- `StructuralIntentVisualPreview.jsx`: planta/elevación, vanos, T/S1…Sn y estados visibles.
- `structuralIntentVisualHitTest.js`: selección local sólo sobre targets del preview.
- `structuralIntentLocator.js` y store: snapshot, fit, restaurar/conservar y cero autoridad.
- `Canvas.jsx`: intercepción del modo localizador antes de la selección global.
- `StructuralIntentWorkspaceDialog.jsx`: integración, stale, huérfanos, borradores y accesibilidad.
- Evidencia determinista FX-008, pruebas puras, store, componentes e independencia.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Descriptor real | PASS | Muro `1784605101040`: 7→11A @ C, 8.700×101,1×3.700 mm y 3 vanos |
| Preview individual | PASS | planta/elevación y marca T en FX-008 |
| Preview masiva | PASS | S1 `1784751397992`, S2 `1784752583321`, S3 `1784752639636` |
| Contexto no topológico | PASS | bounds/distancia/Z deterministas y vecinos no seleccionables |
| Sincronización bidireccional | PASS | lista↔preview↔Canvas con `activeId` local |
| Localizador reversible | PASS | abrir/hover/activar/fit/restaurar; historia y trace 0 |
| Selección global preservada | PASS | tests puros, store, componente e independencia |
| Borradores y stale | PASS | cambio de target bloqueado; fingerprints separados y recarga explícita |
| Referencias rotas | PASS | fila huérfana visible y formulario/acciones bloqueados desde apertura |
| Accesibilidad | PASS | teclado, foco, ARIA y señalización redundante |
| Independencia constructiva | PASS | 8 archivos inspeccionados y prueba de reversión |
| Geometría agnóstica | PASS | 45 muros, 43 vanos, 32 fundaciones y 7 cubiertas; sin mutación |

## Validación local autoritativa

El validador autocontenido v3 produjo:

```text
PASS - SPEC-015-C-1 validada completamente.
Logs: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-c-1/20260806-143453
No se ejecutó git add, commit ni push.
```

| Gate | Resultado |
|---|---|
| Dependencias y manifiesto objetivo | PASS |
| Gobernanza, evidencia e independencia | PASS |
| Tests enfocados | PASS · 22/22 |
| Componente enfocado | PASS · 10/10 |
| Node completo | PASS · 913/913 |
| Componentes completos | PASS · 31/31 |
| Rust | PASS · 9/9 |
| Cobertura store | PASS · 94,97 % líneas / 80,85 % ramas / 95,78 % funciones |
| Goldens | PASS · 19 |
| DXF | PASS · 14 archivos, 0 errores / 0 reparaciones |
| CalculiX | PASS · 3/3; 1 warning permitido por contrato |
| Build Vite | PASS · warning de chunk >600 kB documentado |
| Migración | PASS · 187 archivos, 58 cambios registrados, 2 fixtures |
| Artefactos y derivados | PASS · 614 archivos; 14 exportadores / 14 mutadores |
| Auditoría Codex | PASS · 11 completas, 2 fallidas recuperadas, 0 abiertas |
| Gobernanza final, diff, evidencia y manifiesto final | PASS |

## Prueba de la prueba

| Alteración | Detección esperada |
|---|---|
| Reutilizar `selectElement` al localizar | tests locator/store/componente e independencia |
| Hacer seleccionable un vecino de contexto | hit-test individual/lote |
| Guardar con preview stale | workspace y componente stale |
| Ocultar o habilitar una referencia rota | presenter/workspace/componente |
| Persistir el localizador dentro de `model` | independencia, evidencia e historial/trace |
| Importar vocabulario constructivo | auditor estático y reversión |

## Incidencias durante la entrega

- BUG-015-C-002: el primer paquete ubicó manifiestos en una carpeta distinta de la esperada por el
  aplicador; se sustituyó por un aplicador autocontenido.
- BUG-015-C-003: el primer validador autocontenido expandía `$1` dentro de `awk`; v2 lo sustituyó por
  `cut`.
- BUG-015-C-004: tres aserciones React eran ambiguas y una referencia rota no bloqueaba el formulario
  desde la apertura; el hotfix corrigió ambos puntos y v3 pasó la puerta completa.

Estas incidencias no cambiaron el contrato persistente ni habilitaron alcance adicional.

## Deudas y advertencias conservadas

- F-009 permanece P1: no afirmar que los planos están listos para ejecución.
- Vite mantiene el warning heredado por chunk inicial mayor a 600 kB.
- Rust mantiene el warning futuro de `block` 0.1.6 bajo D-040.
- SPEC-08 continúa deshabilitada hasta completar R12.

## Documentos actualizados

- [x] `specs/SPEC-015-C-1-identificacion-visual-muros-elementos.md`
- [x] `specs/MANIFEST.json`
- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `docs/SPEC-015-C-1_IMPLEMENTACION.md`
- [x] `docs/SPEC-015-C-1_TRAZA.md`
- [x] `sessions/implementation-SPEC-015-C-1.md`
- [x] `sessions/close-SPEC-015-C-1.md`
