# SPEC-015-C-1 — Traza requisito → implementación → evidencia

| Requisito | Implementación | Prueba o evidencia |
|---|---|---|
| Descriptor verificable | `structuralIntentVisualPresentation.js` | `structuralIntentVisualPresentation.test.mjs`; FX-008 JSON |
| Preview individual | `StructuralIntentVisualPreview.jsx` | test de componente; SVG FX-008 |
| Planta, elevación y vanos | presentador + preview | objetivo `1784605101040`, 3 vanos |
| Preview de lote | `buildStructuralIntentVisualPreview` | S1–S3 en tests y evidencia |
| Contexto no topológico | selección por bounds/distancia/Z | determinismo y contexto FX-008 |
| Lista ↔ preview | `activeId`, hover y activación local | test de componente |
| Preview ↔ Canvas | hit-test visual + request transitorio | `structuralIntentVisualHitTest.test.mjs` |
| No ampliar selección global | intercepción previa a `selectElement` | locator puro + independencia |
| Localizar y restaurar | `structuralIntentLocator.js` | secuencia auditada historia/trace 0 |
| Borrador protegido | bloqueo de cambio de target | test de componente `SI-DRAFT-TARGET-CHANGE-BLOCKED` |
| Stale geométrico | fingerprint separado | tests individual y lote stale |
| Referencia rota | filas huérfanas y controles bloqueados | presenter/workspace/component tests |
| Teclado y foco | Enter/Space, Escape, trap y autofocus | test de componente + parse JSX |
| No depender sólo del color | marcas, texto, patrones y trazos | SVG y componente |
| Independencia constructiva | auditor estático | `spec015c1Independence.test.mjs` |
| No habilitar C-1 fuera de alcance | MenuBar conserva tres items disabled | auditor de independencia |
| Evidencia real FX-008 | generador determinista | JSON/SVG/MANIFEST |
| Validador único | `validar_SPEC_015_C_1_AUTOCONTENIDO_v3.sh` | PASS completo; logs `artifacts/validation-spec-015-c-1/20260806-143453` |


## Cierre

La traza queda verificada por `sessions/close-SPEC-015-C-1.md`. La validación local aprobó la suite
completa y los gates finales sin ejecutar operaciones Git.
