# SPEC-015-D — Implementación de propuestas y caminos candidatos

## Estado de entrega

La Fase B y REV8 están **cerradas tras validación local autoritativa y visual real en el Mac el
10-ago-2026**. El cierre no ejecutó Git ni agregó autoridad estructural fuera del contrato.

## Corte implementado

### Motores puros

`src/core/structuralProposals.js` produce `structural-proposals-v1.0` desde geometría agnóstica,
intención, intención canónica de techumbre y topología R0–R5. Conserva evidencia de distancia,
solape longitudinal, solape Z, tolerancias y vanos visibles. No importa React, store, Three.js,
mutadores ni soluciones constructivas.

`src/core/candidateLoadPaths.js` produce `candidate-load-paths-v1.0` con dos grafos separados:

```text
G↓ gravity
L→ lateral
```

Los grafos no comparten nodos, aristas, rutas ni semánticas ocultas. Los estados permitidos son
candidatos completos, incompletos o bloqueados; `verified` está prohibido.

### Identidad, canonicalización y stale

`src/core/structuralProposalCommon.js` centraliza:

- IDs semánticos SHA-256 para propuesta, nodo, arista, ruta y finding;
- canonicalización independiente del orden de colecciones equivalentes;
- fingerprints separados de geometría, intención, techumbre y topología;
- tolerancias en milímetros y redondeo sólo de salida;
- rechazo tipado de referencias o entradas inválidas.

### Revisión humana persistente

`src/core/structuralProposalReviews.js` implementa
`structural-proposal-review-log-v1.0`, append-only y persistente en el modelo v3. Cada evento puede
contener una o N decisiones canónicas. Rechazar y diferir sólo agregan review; nunca crean intención
negativa ni trace de intención.

`src/core/applyStructuralProposalDecision.js` es la única frontera que puede convertir una
aceptación confirmada en intención. Comprueba propuesta, fuentes, target, intención previa y
fingerprint visual antes de mutar. Un stale produce `SI-PROPOSAL-STALE` y cero cambios.

### Lote homogéneo

La auditoría previa al empaquetado detectó y corrigió `BUG-015-D-002`. La aceptación masiva:

- exige al menos dos propuestas;
- exige la misma disposición;
- para aceptar, exige objetivos de elemento y el mismo patch;
- valida todos los fingerprints antes de mutar;
- usa `setElementIntentsBatch()` una sola vez;
- crea un único trace `batchSet` cuando hay cambios efectivos;
- agrega un único review event con N decisiones;
- entra al store como un solo snapshot de historial.

No se simula el lote mediante un bucle de mutaciones individuales.

### Vigencia de una aceptación materializada

La auditoría también detectó y corrigió `BUG-015-D-004`. Aceptar cambia legítimamente la intención
y, por tanto, el fingerprint agregado de fuentes. La materialización distingue ahora:

- `rejected`/`deferred`: propuesta y fuente agregada deben seguir exactas;
- `accepted`/`modifiedAndAccepted`: la propuesta debe seguir exacta y la intención vigente del
  objetivo debe coincidir con `appliedIntentFingerprint`.

Así, una aceptación no se supera a sí misma, un cambio ajeno no la invalida y una modificación
posterior del objetivo sí la marca `superseded`. Los guards stale previos a confirmar no cambian.

### Persistencia y store

`src/core/modelSchema.js` valida y canonicaliza el review log. La migración v2→v3 crea un log vacío
explícito; un proyecto v3 anterior que no contiene la clave sigue siendo válido y no inventa
historia.

`src/store/useModelStore.js` integra decisión individual y lote con `withHistory`. Undo/redo restaura
en conjunto:

```text
structuralIntent
structuralIntentTrace
structuralProposalReviews
```

### Workspace macro→micro

`StructuralProposalWorkspaceDialog.jsx` se abre desde
`Estructura → Propuestas y caminos candidatos…` y contiene:

1. resumen de fuentes, fingerprints y conteos;
2. lista buscable y selección múltiple;
3. evidencia geométrica y limitaciones;
4. grafo gravitacional;
5. grafo lateral con dirección X/Y explícita;
6. cuatro disposiciones humanas y lote homogéneo;
7. preview antes/después y confirmación final;
8. auditoría de review e intención trace.

Teclado y foco:

- flechas recorren filas de propuestas;
- Enter activa la fila enfocada;
- Tab queda contenido dentro del diálogo final;
- Escape cancela sin mutar;
- Ctrl/Cmd+Enter confirma sólo con preview preparado;
- el foco vuelve al control que abrió la decisión.

### Identidad visual sin IDs como etiqueta primaria

`structuralProposalVisualPresentation.js` reutiliza los descriptores y previews de SPEC-015-C-1.
Cada entidad visible sigue el orden:

```text
descriptor geométrico → preview → Localizar → Referencia técnica
```

El localizador es transitorio, vive fuera de `model`, encuadra la entidad y restaura vista y
selección. Los IDs continúan como claves canónicas copiables, pero no como identificación humana
única ni como `aria-label` principal.

## Aplicación real FX-008

La evidencia productiva usa `tests/fixtures/casa-L-completa-v3.json`:

```text
45 muros · 43 vanos · 32 fundaciones · 7 cubiertas
```

### Gravedad

Ruta completa candidata:

```text
cubierta 1785030887081
→ borde B5 declarado gravitySupport
→ muro 1784604634483
→ fundación 1784817889908
```

Ruta incompleta:

```text
cubierta 1785030887081
→ borde B3 declarado gravitySupport
→ frontón superior 1784819708086
→ apoyo inmediato no resuelto
```

La búsqueda no cruza el vacío ni salta directamente a una fundación.

### Lateral

```text
Faldón rectangular 1–6 entre B–H
→ diafragma intended · dirección de análisis X
→ gap vertical 571,429 mm
→ Muro X · 3→5 @ C1
```

Se emite `SI-LATERAL-TRANSFER-REQUIRED`. El cielo falso no se convierte en nodo, arista,
diafragma, colector ni solución.

## Evidencia

- `evidence/spec-015-d/FX-008-SPEC-015-D.json`
- `evidence/spec-015-d/FX-008-SPEC-015-D.svg`
- `evidence/spec-015-d/FX-008-SPEC-015-D.html`
- `evidence/spec-015-d/MANIFEST.json`

La evidencia reproduce aceptar, modificar y aceptar, rechazar, diferir y stale en escenarios
aislados, además de los grafos separados y los descriptores humanos.

## Gates ejecutados en este entorno

```text
make governance                                  PASS · 22 / 49 requisitos / 60 decisiones
format:check                                     PASS · 565 archivos antes de documentación final
pruebas enfocadas puras/integración              PASS · 45/45
prueba de independencia y dos reversiones        PASS
projector/evidencia SPEC-015-D                   PASS · JSON/SVG/HTML
verify:migration                                 PASS · 187 archivos / 58 cambios registrados
verify:derived                                   PASS · 14 exportadores / 14 mutadores
verify:goldens                                   PASS · 19 artefactos
codex:audit                                      PASS · 11 completas / 2 recuperadas / 0 abiertas
laboratorio roofPlane                            PASS · 35/35
parse sintáctico de JSX modificado               PASS · TypeScript sin errores de parseo
```

## Gates no ejecutables aquí

- `lint`, componentes y build: las dependencias fueron excluidas del ZIP y el registry disponible
  no pudo restaurar paquetes como `zustand`/`tsx`; los comandos no iniciaron el producto.
- Rust/Tauri: `cargo` no está instalado en este entorno.
- DXF/CalculiX oficiales: dependen internamente de Git; se registró `BUG-015-D-003`. El validador
  entregado ejecuta equivalentes sin Git en el Mac.
- Cobertura completa: depende del árbol de dependencias.

Estos límites no se interpretan como PASS ni como fallos del producto. La validación local única es
la autoridad antes de cerrar o ejecutar Git.

## Exclusiones preservadas

- no se incorporaron Metalcon, OSB, perfiles, materiales ni soluciones constructivas;
- no se implementó cálculo de capacidad, rigidez, anclajes o deformaciones;
- no se completaron R6–R12 de SPEC-14;
- ningún motor escribe silenciosamente en `structuralIntent`;
- no existe estado candidato `verified`;
- no se cerró SPEC-015-D;
- no se ejecutó commit, add, push, pull, checkout ni otra operación de repositorio.

## REV7 — Corte correctivo de revisión visual pre-cierre

La revisión visual real en localhost detectó que el localizador actualizaba una planta inaccesible detrás del workspace y que el estado vacío no explicaba qué intención faltaba. Además se formalizó la semántica visible de las decisiones de techumbre.

REV7 incorpora:

- `proposalReadiness` para estados vacíos accionables;
- localizador compacto reutilizando el patrón SPEC-015-C-1;
- preview `proposal-relation` con origen, borde, objetivo y solape;
- `structural-concept-glossary-v1.0` como fuente semántica única;
- ayuda contextual en Intención estructural → Techumbre;
- rótulo `Soporte local de canaleta` conservando el valor canónico `gutterSupport`.

No cambia la autoridad de `structuralIntent`, los motores de decisión, review log, trace ni reglas de stale.

## Cierre autoritativo REV8 — 10-ago-2026

El validador integral final pasó 90/90 pruebas focales REV8, 996/996 Node, 49/49 componentes, 9/9
Rust, 35/35 laboratorio, cobertura core/store sobre sus gates, DXF 14 archivos sin errores, CalculiX
3/3, build, migración, derivados, Codex audit y gobernanza. La revisión visual real cerró
BUG-015-D-028/029/030/031/032/034 y comprobó cuatro caminos gravitacionales completos hasta
fundación. Ver `SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.

MEJ-015-D-033 queda pendiente como mejora de encuadre no bloqueante.
