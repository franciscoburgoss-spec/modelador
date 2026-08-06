# SPEC-015-C-1 — Implementación de identificación visual

## Estado de entrega

La Fase B está implementada sobre el ZIP real y queda **pendiente de la validación única en el Mac**.
No se declara cierre ni PASS de gates que este entorno no pudo ejecutar.

## Corte implementado

### Presentador geométrico puro

`src/core/structuralIntentVisualPresentation.js` consume `projectAgnosticGeometry(model)` y genera el
contrato transitorio `structural-intent-visual-presentation-v1.0` con:

- descriptores humanos para muro, pilar, viga y fundación;
- geometría de planta y elevación;
- vanos vinculados al host;
- contexto cercano exclusivamente geométrico;
- previews individual y masiva con marcas `T` y `S1…Sn`;
- fingerprints geométricos deterministas;
- estados `available`, `unsupportedVisualType`, `brokenReference` e `invalidGeometry`.

No importa React, Zustand, Three.js, topología, `wallTypes`, Metalcon, OSB ni soluciones
constructivas.

### Workspace y protección de borradores

`src/core/structuralIntentWorkspace.js` separa:

- fingerprint de intención;
- fingerprint geométrico;
- snapshot visual del borrador;
- validación individual y masiva justo antes de confirmar.

Una geometría cambiada produce `SI-VISUAL-PREVIEW-STALE`; una entidad eliminada conserva la fila
como referencia rota. Guardar y localizar quedan bloqueados hasta recargar o resolver.

### Preview y selección local

`StructuralIntentVisualPreview.jsx` muestra:

- planta contextual;
- elevación individual y vanos;
- fundaciones multicapa;
- lote con marcas estables;
- zoom, encuadre, hover, foco y activación por teclado;
- señales redundantes por texto, etiqueta, patrón y trazo.

La selección del workspace sigue siendo local y no se convierte en selección global.

### Localizador transitorio

`src/core/structuralIntentLocator.js` y el slice correspondiente del store mantienen el localizador
fuera de `model`. Al abrir guarda snapshot de:

- layout y vistas A/B;
- modo y nivel;
- selección global vigente.

El Canvas intercepta el clic del localizador antes del hit-test ordinario. Al salir se puede
restaurar o conservar la vista; la selección global se repone siempre. El workspace permanece
montado y el borrador no se descarta.

### Accesibilidad

- foco automático al panel compacto del localizador;
- `Escape` restaura la vista;
- `Enter` y `Space` activan targets del SVG;
- foco contenido en el diálogo principal;
- mensajes `aria-live` para target activo;
- stale y referencia rota usan alertas textuales, no sólo color.

## FX-008

La evidencia productiva usa exclusivamente `tests/fixtures/casa-L-completa-v3.json`:

```text
45 muros · 43 vanos · 32 fundaciones · 7 cubiertas · 77 elementos
```

Objetivo individual:

```text
1784605101040
Muro X · 7→11A @ C · NPT 450 → FRONTON GENERAL 4.150
L 8.700 · e 101,1 · h 3.700 · 3 vanos
```

Lote:

```text
S1 1784751397992
S2 1784752583321
S3 1784752639636
```

La secuencia `open → hover → request → activate → fit → restore` demuestra:

```text
historial:             0 cambios
structuralIntentTrace: 0 cambios
autoridad de intención:0 cambios
selección global:      preservada
vista:                 restaurada
```

## Pruebas añadidas

- `structuralIntentVisualPresentation.test.mjs`
- `structuralIntentVisualHitTest.test.mjs`
- `structuralIntentLocator.test.mjs`
- `structuralIntentLocatorStore.test.mjs`
- ampliación de `structuralIntentWorkspace.test.mjs`
- ampliación de `structuralIntentWorkspace.component.test.jsx`
- `spec015c1Evidence.test.mjs`
- `spec015c1Independence.test.mjs`

## Evidencia

- `evidence/spec-015-c-1/FX-008-SPEC-015-C-1.json`
- `evidence/spec-015-c-1/FX-008-SPEC-015-C-1.svg`
- `evidence/spec-015-c-1/MANIFEST.json`

## Gates ejecutados en este entorno

```text
make governance de apertura/implementación       PASS · 22 / 47 requisitos / 58 decisiones
presentador + hit-test + locator + workspace      PASS 17/17
generador y test de evidencia                     PASS 1/1
independencia y reversión                         PASS 2/2
cobertura focalizada de módulos nuevos            PASS · líneas 93,26 %
format:check                                      PASS · 534 archivos
verify:migration                                  PASS · 187 archivos / 58 cambios
verify:derived                                    PASS · 14 exportadores / 14 mutadores
codex:audit                                       PASS · 11 completas / 2 recuperadas / 0 abiertas
comprobación sintáctica JSX y node --check        PASS
aplicador sobre copia limpia                      PASS · árbol byte-identical
```

## Validación local autoritativa

El Mac objetivo ejecutó el validador autocontenido v3 sobre la implementación y el hotfix de
componente. Resultado:

```text
PASS - SPEC-015-C-1 validada completamente.
Logs: /Volumes/MEM EXT/Developer/modelador/artifacts/validation-spec-015-c-1/20260806-143453
```

Resumen: 22/22 tests enfocados, 10/10 componente enfocado, 913/913 Node, 31/31 componentes,
9/9 Rust, store 94,97 % líneas / 80,85 % ramas / 95,78 % funciones, 19 goldens, DXF 14 con
0/0, CalculiX 3/3, build, migración, artefactos, derivados, Codex y gobernanza PASS.

Los intentos previos quedaron registrados como BUG-015-C-002 (empaquetado), BUG-015-C-003
(expansión `awk`) y BUG-015-C-004 (suite de componente/protección huérfana). El validador v3 es la
autoridad final del corte.

## Exclusiones preservadas

- Propuestas estructurales continúa deshabilitado;
- Caminos de carga continúa deshabilitado;
- Topología estructural continúa deshabilitada;
- no se cambió schema persistente ni `modelVersion`;
- no se agregó intención a `agnostic-geometry-v1.0`;
- no se usó Git.
