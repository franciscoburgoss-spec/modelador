# SPEC-015-D — Traza requisito → implementación → evidencia

| Requisito | Implementación | Prueba o evidencia |
|---|---|---|
| Propuestas no autoritativas | `structuralProposals.js` | `structuralProposals.test.mjs`; JSON FX-008 |
| Grafos G/L separados | `candidateLoadPaths.js` | `candidateLoadPaths.test.mjs`; SVG/HTML FX-008 |
| Sin estado `verified` | contratos + auditor estático | `spec015dIndependence.test.mjs` |
| IDs deterministas | `structuralProposalCommon.js` | permutación y ejecución repetida |
| Fingerprints por fuente | `sourceFingerprints()` | tests de determinismo y stale |
| Topología R0–R5 acotada | `structuralProposalWorkspace.js` | authorities/limitations en evidencia |
| Apoyo gravitacional inmediato | builder gravitacional | ruta completa e incompleta FX-008 |
| Vanos visibles | evidence.matches.openings | borde B5 y pruebas de propuestas |
| Lateral con dirección explícita | `analysisContexts` X/Y | gap 571,429 mm FX-008 |
| Transferencia lateral requerida | finding tipado | `SI-LATERAL-TRANSFER-REQUIRED` |
| Cielo falso excluido | grafo lateral | `falseCeilingNodeCount=0` en evidencia |
| Review append-only | `structuralProposalReviews.js` | `structuralProposalReviews.test.mjs` |
| Review aceptado vigente | `materializeStructuralProposalReviews()` | aceptación, cambio ajeno y cambio posterior del objetivo |
| Aceptar separado y confirmado | `applyStructuralProposalDecision.js` | decisión individual + stale tests |
| Rechazo/pendiente sin intención | acceptance adapter | trace e intención deepEqual |
| Lote homogéneo atómico | batch adapter + store | `structuralProposalBatchDecision.test.mjs`; store/component tests |
| Un solo history/review/batchSet | `withHistory` + `setElementIntentsBatch` | `structuralProposalStore.test.mjs` |
| Persistencia v3 retrocompatible | `modelSchema.js` | persistence/modelSchema/native tests |
| Descriptores antes de IDs | visual presenter | lateral graph descriptor tests |
| Preview y Localizar | locator + Canvas | locator puro y componente |
| Selección global intacta | locator fuera de model | snapshot de intención/trace/review |
| UI macro→micro | `StructuralProposalWorkspaceDialog.jsx` | test componente y parse JSX |
| Teclado/foco | navegación, trap, restore | test componente focalizado |
| Frontera sin store/React | motores puros | verificador + reversión de import/call |
| Sin solución constructiva | allowlist estática | verifier y evidencia sin términos prohibidos |
| Evidencia real | generador de evidencia | 45/43/32/7 y `MANIFEST.json` |
| Aplicador sin Git | script autocontenido | prueba sobre extracción limpia y segunda aplicación |
| Validador sin Git | script autocontenido | inventario propio + auditores temporales no-Git |

## Estado

La implementación, evidencia automática y validación visual real quedaron **cerradas el
10-ago-2026**. La traza constituye el cierre documental de SPEC-015-D REV8.

## Hotfix de validación local — BUG-015-D-008

La primera suite Node completa ejecutada en macOS sobre REV2 alcanzó 948 tests: 947 PASS y un
único fallo heredado de SPEC-015-C-1. La regresión esperaba todavía los menús de SPEC-015-D
bloqueados. REV3 actualiza sólo ese contrato de prueba para reconocer la transición temporal ya
cumplida: `Propuestas y caminos candidatos…` debe estar habilitado y SPEC-015-E continúa
bloqueada. No se modifica código productivo.

## REV4 — BUG-015-D-009

La validación local completa superó 948/948 pruebas Node y detectó dos expectativas obsoletas en `structuralProposalWorkspace.component.test.jsx`: una exigía trace en un rechazo y otra consultaba un placeholder no único. Se corrigieron únicamente las pruebas para respetar el contrato aprobado (rechazo = review sin trace) y la semántica accesible del campo `Código/motivo`. No se modificó código productivo.

## REV5 — BUG-015-D-010 (hipótesis refutada)

REV5 intentó atribuir el timeout de la prueba de teclado a propagación de `Escape` entre listeners de `window`. Una reproducción instrumentada posterior demostró que esa hipótesis era incorrecta: `Escape` retornó en 7 ms, el subdiálogo se cerró, el foco volvió a `Rechazar` y el proceso terminó naturalmente. REV6 retira por ello `stopImmediatePropagation()` y restaura el componente productivo a su comportamiento REV4.

## REV6 — BUG-015-D-011

El bloqueo fue reproducido de forma aislada dentro de `node:test`: la ejecución llegó a `T05 - Escape retornó` y quedó detenida específicamente en `await waitFor(...)` hasta el timeout externo de 15 s. La restauración productiva del foco usa `requestAnimationFrame`, no una mutación DOM que requiera sondeo general. REV6 elimina `waitFor` de esta prueba y espera explícitamente un frame antes de afirmar `document.activeElement`. No cambia el comportamiento productivo respecto de REV4.

## REV7 — hallazgos de prueba visual real

| Hallazgo | Evidencia / corrección | Invariante |
|---|---|---|
| BUG-015-D-012 | `proposalReadiness` + acción a Techumbre | cero inferencias automáticas |
| BUG-015-D-013 | localizador compacto con Restaurar/Conservar | 0 history / 0 review / 0 trace |
| MEJ-015-D-014 | `structuralConceptGlossary.js` + ayuda contextual | semántica única de UI |
| MEJ-015-D-015 | `proposal-relation` | derivado efímero, no autoritativo |
| MEJ-015-D-016 | `gutterSupport` → rótulo `Soporte local de canaleta` | valor persistido intacto |

## REV8 — Cierre de interfaces y caminos reales

| Hallazgo | Corrección | Evidencia de cierre |
|---|---|---|
| BUG-015-D-028 | `roofBoundary.sRange` parcial | B1 `S 12800→14500`, 1.700 mm, borde físico 10.400 mm |
| BUG-015-D-029 | renderer parcial en Canvas | Localizar/Encuadrar no resalta host completo |
| BUG-015-D-030 | gobernanza de Canvas | `verify:migration` 187/58 PASS |
| BUG-015-D-031 | presentación de B1 parcial | nodos/caminos separan interacción de borde físico |
| BUG-015-D-032 | llamada exterior de cara corta | C/6 visible sin etiqueta superpuesta |
| BUG-015-D-034 | rangos `face/end` parciales | C/6 y C/7 muestran locator real; 4/4 caminos completos |

Validación integral final: focal REV8 90/90, Node 996/996, componentes 49/49, Rust 9/9, lab
35/35, DXF 14 sin errores, CalculiX 3/3, build/migración/derivados/Codex/gobernanza PASS.
MEJ-015-D-033 queda abierta como mejora no bloqueante.
