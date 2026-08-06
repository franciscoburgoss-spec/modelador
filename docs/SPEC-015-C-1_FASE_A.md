# SPEC-015-C-1 — Informe de Fase A

## Resultado

La Fase A quedó completada exclusivamente con documentos y un prototipo aislado. No se modificaron
componentes React productivos, store, core productivo, tests, schemas, STATUS ni gobernanza activa.

## Base verificada

```text
ZIP SHA-256:      88a1a7ffd2746892cfed2bc821a2112bc1edd2e058b9acd4cbde08bc6fa7d9b9
Archivos iniciales: 589
unzip -t:         PASS
.git:             ausente
STATUS:           SPEC-015-C cerrada; SPEC-015-D pendiente
modelVersion:     3
make governance:  PASS baseline · 22 archivos / 46 requisitos / 57 decisiones
prueba pura:      PASS 5/5 structuralIntentWorkspace.test.mjs
```

La ausencia de `.git` impide recalcular `main/961782f`; esa referencia se mantiene como baseline
declarado por el contexto y es coherente con las autoridades internas del ZIP.

## FX-008 verificado con código productivo

```text
fixture SHA-256:   6cc9e2d1d452c6da26984b23b01a047ca7c9c1465e34e9129caf69784f7b3f09
geometría bytes:   81.875
geometría SHA-256: 966c0f25bd1b05a525a0432f96a997c8321bd67ef05425ebd0e2df804c97f24a
77 elementos · 45 muros · 43 vanos · 32 fundaciones · 7 cubiertas
```

## Hallazgos principales

1. El BUG se reproduce directamente en `renderElements`: no existe descriptor ni preview.
2. Techumbre ya tiene el patrón correcto de geometría vinculada a formulario.
3. La selección de lote de SPEC-015-C es local y debe conservarse.
4. `centerOnElement` no crea historial, pero cambia selección global, vista y nivel; no debe
   reutilizarse sin un localizador separado.
5. El store permite slices transitorios fuera de `model`, por lo que no hace falta migración.
6. El borrador actual sólo detecta stale de intención; C-1 necesita fingerprint geométrico separado.
7. Las intenciones huérfanas no aparecen como filas porque el workspace parte sólo de
   `geometry.elements`.
8. El diálogo modal oculta el Canvas; localizar requiere compactarlo sin desmontar el workspace.

## Decisiones cerradas

- presentador geométrico puro sobre `projectAgnosticGeometry`;
- etiquetas nominales sólo por coincidencia ±0,1 mm;
- contexto cercano por bounds y distancia, explícitamente no topológico;
- preview individual con planta/elevación/vanos;
- preview de lote con S1…Sn, sin fusionar geometría;
- activeId, selectedIds y hoveredId separados;
- localizador transitorio fuera de `model` y de la selección global;
- snapshot de vista con Restaurar/Conservar;
- fingerprints de intención y geometría;
- orphans visibles;
- teclado y señalización no dependiente del color.

## Prototipo aislado

`prototypes/SPEC-015-C-1/FX-008-SPEC-015-C-1-prototipo.html` incluye:

- reproducción actual/propuesta;
- target individual real `1784605101040`;
- lote real de tres muros;
- vanos, ejes, niveles y contexto real;
- navegación lista↔preview;
- zoom y localización temporal simulada;
- estados dirty/stale/referencia rota;
- auditoría automática con historial, trace y mutaciones de autoridad en cero.

El prototipo se genera desde el fixture mediante
`prototypes/SPEC-015-C-1/generate-prototype.mjs` y no depende de datos mockup geométricos.

## Checks ejecutados en Fase A

```text
unzip -t del ZIP inmutable                         PASS
SHA-256 de entradas                                PASS
make governance sobre baseline sin cambios         PASS
node --test tests/structuralIntentWorkspace.test.mjs PASS 5/5
proyección FX-008 con agnosticGeometry.js           PASS
comparación bytes/hash FX-008                       PASS
regeneración determinista del prototipo             PASS
HTMLParser                                          PASS · 2 scripts
node --check del JavaScript embebido                PASS
render headless del prototipo                       PASS · sin errores de página
interacciones individual/lote/localizador           PASS
prueba aislada navegación/hover/selección/zoom      PASS · historial 0 · trace 0
comparación de árbol                                PASS · 589 originales idénticos
```

No se ejecutaron ni se declaran como gates:

- suite completa Node/componentes;
- cobertura;
- Rust/Tauri;
- build;
- DXF/CalculiX;
- validador futuro de SPEC-015-C-1.

## Archivos añadidos en Fase A

```text
specs/SPEC-015-C-1-identificacion-visual-muros-elementos.md
docs/BUG-015-C-001_REPRODUCCION_FASE_A.md
docs/SPEC-015-C-1_FASE_A.md
prototypes/SPEC-015-C-1/generate-prototype.mjs
prototypes/SPEC-015-C-1/FX-008-SPEC-015-C-1-data.json
prototypes/SPEC-015-C-1/FX-008-SPEC-015-C-1-prototipo.html
prototypes/SPEC-015-C-1/MANIFEST.json
```

## Prohibiciones preservadas

- sin Propuestas estructurales;
- sin Caminos de carga;
- sin Topología;
- sin cambio silencioso de selección global;
- sin código productivo;
- sin tests de implementación;
- sin STATUS;
- sin Git.

## Siguiente paso condicionado

Esperar aprobación explícita. Sólo después corresponde abrir formalmente SPEC-015-C-1, actualizar
STATUS, registrar el BUG, ejecutar governance y comenzar la Fase B.
