# Cierre — SPEC-GOV-C / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-GOV-C` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | medium |
| Esfuerzo efectivo | medium |
| Escalamiento | No |

## Alcance ejecutado

Se normalizaron como un único corte SPEC-08 base, su addendum y SPEC-09 a SPEC-14. Cada documento
recibió nombre canónico, las seis secciones contractuales de G0, declaración de esfuerzo futuro y
un bloque delimitado que conserva literalmente su cuerpo normativo. No se implementaron reglas
constructivas ni se modificó código de aplicación, DXF o INP.

## Cambios

- Ocho archivos canónicos comienzan con `SPEC-`; `Spec-14.md` ya no queda fuera del inventario.
- `governance/IMPORTED_SPEC_BODIES.json` fija correspondencia uno a uno, bytes y SHA-256.
- `extractImportedNormativeBody` recupera el bloque opaco sin normalización de texto.
- G0 comparte un validador de encabezados exactos y la prueba enfocada cubre su reversión.
- F-010 quedó resuelto; estado, trazabilidad, riesgo R-011 y decisión D-046 quedaron actualizados.

## Inventario y preservación

| Original | Canónico | Bytes | SHA-256 |
|---|---|---:|---|
| `SPEC-08   Transformaciones criterios estructurales v2 0.md` | `SPEC-08-transformaciones-estructurales-modulacion-v2.0.md` | 9.876 | `3fc94c9691dbd16cc7c5e9c96b0a26c5204b05c1e108b1eea8439c145126524b` |
| `SPEC-08___Addendum_criterios_estructurales_v2_0.md` | `SPEC-08-addendum-criterios-estructurales-v2.0.md` | 4.104 | `261cbeb415fff42a24a2d8dd4da0a5a9d534156ac4db1b655165e749c6df8425` |
| `SPEC-09___Reglas_representacion_DXF_v1_2.md` | `SPEC-09-reglas-representacion-dxf-v1.2.md` | 4.141 | `ba923404ac92c88de1984a82d0fa12e7a306219ea8565b3d3b182d5345ccec6d` |
| `SPEC-10   Composicion elevaciones por eje v1 0.md` | `SPEC-10-composicion-elevaciones-por-eje-v1.0.md` | 3.871 | `bc6df874a9ea9bdf19843656c65753435064c139b563dd652c6e610a6c1794b8` |
| `SPEC-11___Pipeline_modulacion_v1_1.md` | `SPEC-11-pipeline-modulacion-v1.1.md` | 4.481 | `068f2770bba77e9169ee17e8a3bee4ce0a690128015545cc69b1dc08c7ec0489` |
| `SPEC-12___Convencion_coordenadas_representacion_DXF_v1_0.md` | `SPEC-12-convencion-coordenadas-representacion-dxf-v1.0.md` | 3.955 | `5f39e1c4e96a0fd02e319355770df8a038b5fd144a01cc320b1b2ebff56228c6` |
| `SPEC-13___Layout_espacio_modelo_y_papel_v1_0.md` | `SPEC-13-layout-espacio-modelo-y-papel-v1.0.md` | 3.658 | `ef4b0ebed1bd05ef979258e9ca88d55735878714f7e0e52b4c2423a6ea64c38c` |
| `Spec-14.md` | `SPEC-14-reconocimiento-topologico-clasificacion-estructural-v0.3.md` | 46.182 | `6e13b9b3f99bc9117c8f8521ddd76ff6013a82b5f2c84dd899f728b5bcd1d538` |

Total preservado: 80.268 bytes.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Ocho documentos canónicos | PASS | Manifiesto con 8 entradas únicas; nombres originales ausentes |
| Secciones G0 y esfuerzo futuro | PASS | 8/8 envolventes; esfuerzo `high` según matriz aprobada |
| Cuerpo recuperable byte a byte | PASS | 8 longitudes y 8 SHA-256 coinciden con el inventario previo |
| Sin pérdida de contenido importado | PASS | Extractor por `Buffer`; total recuperado 80.268 bytes |
| F-010 resuelto | PASS | `make governance` posterior a la normalización sólo observa la ejecución actual aún abierta |
| Reversión de sección obligatoria | PASS | Retirar `## Diagnóstico` de una copia genera el error G0; restaurar produce cero errores |
| Gates documentales/técnicos | PASS | 796 Node, 18 componentes, 9 Rust, 35 lab y puerta restante verde |
| Esfuerzo y lanzador | PASS al retorno | Inicio `866c563f-e753-4b20-9be6-104ff2491012`: medium planificado/enviado; este cierre confirma medium efectivo |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `node --test tests/importedSpecsGovernance.test.mjs tests/reasoningEffortGovernance.test.mjs tests/codexSpecLauncher.test.mjs` | PASS | 16/16 |
| `make governance` | PASS al retorno | F-010 = 0; dentro del hijo sólo espera su propio `launch_completed` |
| `npm run validate` | PASS al retorno | Todos los gates hasta `codex:audit` verdes; el padre anexa el evento final al terminar el hijo |
| `git diff --check` | PASS | Sin whitespace errors |

El registro Codex es append-only. Durante la ejecución hija, `codex:audit` debe rechazar el único
`launch_started` todavía sin pareja. Al retornar código 0, el lanzador lee este cierre, compara
`medium == medium == medium` y anexa `launch_completed`; ése es el paso final de la ejecución
consolidada y no se simula ni se escribe manualmente desde el hijo.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Se retira `## Diagnóstico` de una copia de SPEC-08 normalizada | 1 (`falta "## Diagnóstico"`) |
| Se restaura la sección original | 0 |

## Desviaciones y deudas descubiertas

- La rama conservó el nombre heredado `spec/GOV-A-reasoning-effort-policy`: `.git` es de sólo
  lectura en esta ejecución. No se alteró historial ni se descartaron cambios acumulados de GOV-A/B.
- La primera invocación heredó Node 20.20.2 y se detuvo en opciones de cobertura. Se cargó NVM y la
  puerta gobernada se repitió completa con Node 22.23.2, sin cambiar archivos para ocultar la falla.
- No se abrió deuda constructiva nueva. F-009 y R-011 permanecen con su alcance anterior.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-046
