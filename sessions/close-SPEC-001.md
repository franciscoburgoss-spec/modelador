# Cierre — SPEC-001 / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-001-model-security-integrity.md` |
| Toolchain | Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró el corte completo de seguridad de fórmulas e integridad de importación: parser aritmético
cerrado, esquema `modelVersion: 1`, migración v0→v1, validación previa, commit transaccional al
store, preservación de las dos fuentes de techumbre y feedback tipado visible.

## Cambios

- `numericExpression.js` tokeniza, construye AST y evalúa sólo números, referencias y `+ - * /`.
- `projectParams.js` usa claves propias, nombres reservados y límites de AST/referencias.
- `modelSchema.js` clona, migra secuencialmente y valida estructura e invariantes.
- El store conserva `roofSystems` y `roofPlanes`; ningún error de importación muta el modelo.
- `ModelImportBanner` presenta errores y advertencias sin depender de la consola.
- Fixtures v0/v1 y quince pruebas nuevas cubren seguridad, migración, store y roundtrip.
- El manifiesto retiene los hashes de origen y registra por spec los cambios posteriores.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Payload y variantes peligrosas rechazados | PASS | `tests/projectParamsSecurity.test.mjs`; efecto global permanece en 0 |
| 2. Fórmulas válidas conservan resultados | PASS | 92 fórmulas de `casa-L`/`modelo-26` conservan 101,1 |
| 3. Sin acceso a prototipo | PASS | mapa con prototipo nulo, `Object.hasOwn` y nombres reservados |
| 4. Entradas inválidas no mutan estado | PASS | `{}`, JSON truncado y versión 999 conservan identidad del modelo |
| 5. Fixture por versión histórica | PASS | `model-v0.json` y fixture vigente `model-v1-dual-roof.json` |
| 6. Migración idempotente | PASS | segunda ejecución no aplica pasos y produce igualdad profunda |
| 7. `casa-L` conserva dos `roofSystems` | PASS | abrir, guardar y reabrir mantiene 2 |
| 8. Ambas fuentes se preservan con precedencia | PASS | warning `ROOF_SOURCE_PRECEDENCE`; ambos arreglos iguales |
| 9. Apertura/migración no sobrescribe original | PASS | entrada permanece byte a byte igual; la ruta de apertura sólo lee |
| 10. Reversión hace fallar regresiones | PASS | parser anterior 4/6 fallas; store anterior 5/5 fallas |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos, 26 requisitos, 17 decisiones |
| `npm run validate` con Node 22 | PASS | 533/533; laboratorio 35/35; core 90,48 %; store 57,80 %; build OK |
| `node scripts/migration-manifest.mjs --compare <origen>` | PASS | 187 archivos; 183 idénticos, 4 cambios registrados; origen intacto |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| `src/core/projectParams.js` restaurado desde el commit anterior en copia temporal | 4/6 |
| `src/store/useModelStore.js` restaurado desde el commit anterior en copia temporal | 5/5 |

## Desviaciones y deudas descubiertas

- La primera invocación de `npm run validate` heredó Node 20 del shell y falló al llegar a las
  opciones de cobertura. Se repitió completa tras `nvm use 22`, versión fijada por el proyecto.
- El chunk inicial pasó de 611,54 a 621,69 kB raw. El warning continúa visible y permanece bajo
  R-010 / `SPEC-005`; no se amplió este corte con optimización de bundle.
- No se modificaron DXF ni INP; por tanto no correspondían auditoría `ezdxf` ni smoke CalculiX.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-017
